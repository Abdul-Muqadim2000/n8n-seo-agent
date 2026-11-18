// Earned media for AI (v4.12): the exact third-party pages AI cited in answers that did NOT name the business — the strongest lever on AI mentions
// (earned media is most of what AI cites; brand mentions on other sites track AI visibility far more than links do). Each page fetched: does it
// name the business, which competitors does it name, how to reach its author. One action per kind (a "best of" list: ask to be added; an article:
// offer a quote or data; news: pitch a comment; a review site: build the profile; a forum thread: answer it as yourself; video / LinkedIn: publish
// there; official list: apply). A page that now names the business is a win. The three most valuable new ones per site get drafts (AI Outreach
// Writer); they join the Backlink Monitor's prospects (type ai_source), which finds contacts and writes follow-ups.
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
    // client reports 2026-11-11 (188): a row an index named with no page we ever read (no address, no visits, never found) is not an average
    // link: its placement and editorial weight are unknown, so they count below average (devaicon: 775 such rows reached 50 and filled "Best")
    const unseen = !l.from_url && !(Number(l.visits) > 0) && l.verify !== 'found';
    const place = unseen ? 0.4 : ({ content: 1, body: 0.65, sidebar: 0.4, nav: 0.3, footer: 0.2, comment: 0.1 }[l.placement || 'body'] ?? 0.6);
    const editorial = (unseen ? 0.6 : 1) * (l.original === false ? 0.4 : 1) * (Number(l.sitewide) >= 20 ? 0.5 : 1) * (['guest_post', 'sponsored'].includes(l.link_type) ? 0.4 : 1);
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
  // client reports 2026-11-11 (section 188, devaicon.com: 774 of 1,289 rows): an AUTOMATIC REPORT PAGE (a site checker / WHOIS / "worth" /
  // trust checker on an established domain, or a name made of SEO-tool words on a new cheap ending that only a link index has named and our
  // own check never found a link on). Every site gets hundreds; Google ignores them. Same rule as the app (app/shared/src/backlinks.ts
  // isAutoReportSite); keep the two equal.
  const AR_CHEAP_TLD = new Set(['shop', 'store', 'site', 'online', 'website', 'space', 'xyz', 'top', 'icu', 'click', 'link', 'fun', 'buzz', 'monster', 'cfd', 'sbs', 'cyou', 'bond', 'quest', 'rest', 'lol', 'pw', 'cam', 'bar', 'mom', 'vip', 'win', 'bid', 'loan', 'work', 'party']);
  const AR_TOOL_WORD = /seo|traffic|backlink|rank|serp|visit|audit|analy[sz]|metric|stat|report|monitor|check|crawl|index|domain|url|page|site|web|link|organic|keyword|score|worth|value|bot|hits|click|track|insight|spy|lookup|search|position|authority|referr|views?|boost|signal|scan|tool|data|info|trend|rate|test|review|list|dir|catalog|submit/;
  // review D11: a token counts only as a whole part of the name (followed by a dot or a hyphen), so worthington.edu, informer.ae,
  // valuationexperts.com, webrankinfo.com or builtwithdesign.co are not report pages; the bare words worth / informer / valuation are gone
  const AR_REPORT_HOST = /(^|[.-])(whois|who\.is|siteprice|sitestats?|site-?info|hypestat|similarsites?|sitelike|sitesimilar|websiteoutlook|statshow|domaintools|robtex|builtwith|urlscan|siteindices|dnslytics|ipaddress|host\.io|domainbigdata|webstatsdomain|siteliner|rank2traffic|websiteinformer|traffic-?estimate|seo-?analy[sz]er|seositecheckup|sitechecker|domainstats|scamadviser|scam-?detector|trustscam|isitlegit|urlvoid|siteadvisor|scamdoc|gridinsoft)(?=[.-])/;
  const isAutoReport = (domain, row) => { const d = String(domain || '').toLowerCase().trim().replace(/^www\./, '').replace(/\.$/, ''); if (!d) return false; const r = row || {};
    if (Number(r.visits) > 0 || /\.(?:edu|gov|mil|ac\.[a-z]{2}|edu\.[a-z]{2}|gov\.[a-z]{2})$/.test(d)) return false;   // review D11: real people came, or a public body
    if (AR_REPORT_HOST.test(d)) return true;
    const dot = d.lastIndexOf('.'); if (dot < 0) return false;
    let src = r.sources; if (typeof src === 'string') { try { src = JSON.parse(src); } catch (e) { src = src.split(/[,\s]+/); } }
    const onlyIndex = Array.isArray(src) && src.length > 0 && src.every(x => String(x) === 'dfs');
    return AR_CHEAP_TLD.has(d.slice(dot + 1)) && AR_TOOL_WORD.test(d.slice(0, dot)) && onlyIndex && r.verify !== 'found' && !(Number(r.visits) > 0); };
  // ---- CR17-E (client report 2026-11-17, devaicon.com C4; build section 195): what a WON link is ----
  // Live, three "links won this month" were domain collisions: a bebee.com job listing that names the client (a Search Console sample row,
  // no address of ours, never read by us), another bebee page, and github.com/hassan1818 (a developer's profile, nofollow) matched to a
  // github.com prospect about an Open edX theme. Nobody had been written to. The rule now, one for every path (Backlink Monitor, Link
  // Builder, Reply Reader, the app): a link counts as WON only when (1) we contacted that site (contacted_at: our sender, or "I sent it
  // myself" in the app), (2) our own reading found a link to the client's host on a page of that site, and (3) that page passes the junk
  // gates below. A clean link nobody asked for is "already links to you" (the Backlinks page's business, never a link-building result);
  // a link on a junk page is "found, low value". A won link turns lost when its ledger row is lost (two misses).
  // Job boards and job pages: a scraped listing names the employer, nobody there adds a link (bebee "Machine Learning Engineer - DEVAICON").
  const JOB_HOST = /(^|\.)(bebee|indeed|glassdoor|rozee|naukri|naukrigulf|bayt|monster|ziprecruiter|jooble|careerjet|simplyhired|wuzzuf|gulftalent|mustakbil|jobstreet|seek|reed|totaljobs|stepstone|dice|jobrapido|adzuna|neuvoo|careerbuilder|jobsdb|laimoon|workable|recruitee|smartrecruiters|greenhouse|lever|wellfound)\.[a-z.]+$|^(jobs|careers)\.[a-z0-9-]+\.[a-z.]+$/;
  const JOB_PATH = /(^|\/)(jobs?|job-listings?|vacanc(?:y|ies)|careers?\/jobs?)(\/|$)/i;
  const JOB_TITLE = /\b\d+\+?\s+[^|]{0,60}\bjobs?\b|\bjobs? in\b|\bhiring\b|\bvacanc(?:y|ies)\b|\bapply now\b|\|\s*bebee\b/i;
  const pathOf = (u) => String(u || '').replace(/^[a-z][a-z0-9+.-]*:\/\/[^\/?#]*/i, '').replace(/[?#].*$/, '');
  const isJobBoard = (u, title) => { const h = hostOf(u) || String(u || '').toLowerCase().replace(/^www\./, '').replace(/[\/?#].*$/, ''); if (!h) return false;
    if (JOB_HOST.test(h)) return true;
    const path = /^[a-z][a-z0-9+.-]*:\/\//i.test(String(u || '')) ? pathOf(u) : '';
    return (/(^|\.)linkedin\.[a-z.]+$/.test(h) && /^\/jobs(\/|$)/i.test(path)) || (JOB_PATH.test(path) && JOB_TITLE.test(String(title || ''))); };
  // A profile on a platform (a person's or a company's own page there) or anything on a code host: the page belongs to whoever posted it,
  // so a link there is theirs to keep, not a placement anyone won (github.com/hassan1818, linkedin.com/in/..., medium.com/@...).
  const PROFILE = [
    [/(^|\.)(github\.com|gitlab\.com|bitbucket\.org|sourceforge\.net)$/, /./, 'a code host'],
    [/(^|\.)linkedin\.[a-z.]+$/, /^\/(in|pub|company|school|showcase)\//i, 'a profile'],
    [/(^|\.)(x\.com|twitter\.com|facebook\.com|instagram\.com|tiktok\.com|threads\.net|pinterest\.[a-z.]+|behance\.net|dribbble\.com|about\.me|linktr\.ee|producthunt\.com)$/, /^\/[^\/]+\/?$|^\/@/, 'a profile'],
    [/(^|\.)medium\.com$/, /^\/@/, 'a profile'], [/(^|\.)youtube\.com$/, /^\/(@|channel\/|c\/|user\/)/i, 'a channel page'],
    [/(^|\.)reddit\.com$/, /^\/(u|user)\//i, 'a profile'], [/(^|\.)quora\.com$/, /^\/profile\//i, 'a profile'], [/(^|\.)stackoverflow\.com$/, /^\/users\//i, 'a profile'],
    [/(^|\.)crunchbase\.com$/, /^\/person\//i, 'a profile'], [/(^|\.)dev\.to$/, /^\/[^\/]+\/?$/, 'a profile'],
  ];
  const profilePage = (u) => { const h = hostOf(u); if (!h) return ''; const path = pathOf(u) || '/';
    for (const [hr, pr, what] of PROFILE) if (hr.test(h) && pr.test(path)) return what + ' on ' + regDomain(h);
    return ''; };
  // the one junk gate for a page that links to the client (o: a ledger row or a fresh reading: ref_domain, from_url, page_title, link_type,
  // noindex, canonical_elsewhere, sources, verify, visits; opts.farms: LK.footprints' map) -> '' or the reason in plain words
  function junkLink(o, opts = {}) {
    const r = o || {}; const url = String(r.from_url || r.url || ''); const d = String(r.ref_domain || refKey(hostOf(url)) || '').toLowerCase();
    if (r.link_type === 'spam' || (opts.farms && opts.farms.has && opts.farms.has(d))) return 'a link-farm or spam page';
    if (r.link_type === 'scraper' || isScraper(d) || isAutoReport(d, r)) return 'an automatic report page';
    if (isGambling(d)) return 'a gambling site';
    if (isWire(d)) return 'a press-release wire';
    if (isInfra(d)) return 'a hosting or link-shortener page';
    const kind = domainKind(d); if (['search', 'ai', 'mail', 'tool'].includes(kind)) return 'not a website page';
    if (isJobBoard(url || d, r.page_title || r.title)) return 'a job listing';
    const prof = profilePage(url); if (prof) return prof;
    if (isSearchPage(url)) return "a search-results page of someone else's site";
    if (r.noindex === true || r.noindex === 'true') return 'a page search engines are told not to index';
    if (r.canonical_elsewhere === true || r.canonical_elsewhere === 'true') return 'a page that points search engines to another address';
    return '';
  }
  // o: { prospect: { prospect_domain, status, contacted_at, won_at, verified_at, type, source_url }, rows: ledger rows (any site; filtered here),
  //      site: the client's domain, reading: a fresh LK.verify result with its url (optional), contacted: true when the caller knows we wrote
  //      (optional), won_url: the page the won link was found on (the Link Builder's checks.won.url; else the prospect's source_url), farms, now,
  //      max_age_days (a ledger reading older than this is not evidence, default 35) }
  // -> { state: won | already_links | low_value | lost | not_found, won, contacted, reason, url, rel, gone, before_contact }
  // FX-LINKS (review R2, 2026-11-18):
  //  * M1: a won link is `lost` only when the ledger row of THE WON PAGE is lost (the Backlink Monitor's own two-miss rule on that page) and it
  //    was lost AFTER the win; a lost row of another page of the domain, or one lost before the win (the reason we pitched "restore the
  //    link"), is not about this link. A link never confirmed by our check (a person's claim, verified_at empty) cannot be lost either.
  //  * L3: a link the ledger saw before anyone wrote to them is `already_links` (not a result), except for a pitch to restore a link (type
  //    lost) and for a prospect that was already won or lost (its win stands while the link is there; a lost one comes back when found).
  //  * L1: `gone` says every ledger row of the domain to us is lost: a stale reading (older than max_age_days) is "read again", never "gone".
  function wonCheck(o) {
    const x = o || {}; const p = x.prospect || {}; const site = String(x.site || '').toLowerCase().replace(/^www\./, '');
    const pd = String(p.prospect_domain || '').toLowerCase().replace(/^www\./, ''); const key = refKey(pd), reg = regDomain(pd);
    const contacted = !!x.contacted || !!String(p.contacted_at || '').trim();
    const now = x.now ? new Date(x.now).getTime() : Date.now(); const maxAge = (Number(x.max_age_days) || 35) * 864e5;
    const ofSite = (r) => { const rd = String(r.ref_domain || '').toLowerCase(); const h = hostOf(r.from_url || r.url); return !!pd && (rd === key || (!!reg && regDomain(rd) === reg) || (!!h && (sameSite(h, reg) || refKey(h) === key))); };
    const mine = (x.rows || []).filter(r => r && ofSite(r));
    const toUs = (u) => !!site && sameSite(hostOf(u), site);
    const fresh = (r) => { const t = Date.parse(r.verified_at || r.last_seen || ''); return !Number.isFinite(t) || now - t <= maxAge; };
    const was = String(p.status || '');
    const ct = Date.parse(String(p.contacted_at || ''));
    // L3: when the ledger first saw this page link to us (a fresh reading takes the ledger row of the same page)
    const firstSeen = (e) => { const own = Date.parse(String(e.first_seen || '')); if (Number.isFinite(own)) return own;
      const u = normUrl(e.from_url || e.url || ''); const r = u ? mine.find(m => normUrl(m.from_url) === u && m.status !== 'lost') : null; return r ? Date.parse(String(r.first_seen || '')) : NaN; };
    const beforeContact = (e) => { if (!Number.isFinite(ct) || ['won', 'lost'].includes(was) || String(p.type || '') === 'lost') return false; const f = firstSeen(e); return Number.isFinite(f) && f < ct - 864e5; };
    const ev = [];
    if (x.reading && x.reading.verify === 'found') ev.push({ ...x.reading, from_url: x.reading.url || x.reading.from_url || '', ref_domain: key, page_title: x.reading.title || x.reading.page_title || '' });
    for (const r of mine) if (r.status !== 'lost' && r.verify === 'found' && toUs(r.to_url) && fresh(r)) ev.push(r);
    const judged = ev.map(e => ({ e, junk: junkLink(e, { farms: x.farms }) }));
    const clean = judged.find(j => !j.junk);
    const toUsRows = mine.filter(r => !r.to_url || toUs(r.to_url));
    const gone = toUsRows.length > 0 && toUsRows.every(r => r.status === 'lost');
    if (clean) {
      const early = contacted && beforeContact(clean.e);
      const won = contacted && !early;
      return { state: won ? 'won' : 'already_links', won, contacted, gone: false, before_contact: early,
        reason: won ? 'our check found your link on their page' : early ? 'they linked to you before anyone wrote to them: not a link-building result' : 'they link to you, but nobody was written to: not a link-building result',
        url: String(clean.e.from_url || ''), rel: String(clean.e.rel || '') };
    }
    if (judged.length) return { state: 'low_value', won: false, contacted, gone: false, before_contact: false, reason: 'a link to you is there, but on ' + judged[0].junk + ': it does not count', url: String(judged[0].e.from_url || ''), rel: String(judged[0].e.rel || '') };
    if (was === 'won' && String(p.verified_at || '').trim()) {
      const wonUrl = normUrl(x.won_url || p.source_url || ''); const wonT = Date.parse(String(p.won_at || p.verified_at || ''));
      const lostT = (r) => Date.parse(String(r.lost_at || r.verified_at || r.last_seen || ''));
      const about = mine.filter(r => r.status === 'lost' && (!r.to_url || toUs(r.to_url)) && (wonUrl ? normUrl(r.from_url) === wonUrl : gone) && (!Number.isFinite(wonT) || (Number.isFinite(lostT(r)) && lostT(r) > wonT)));
      const lost = about[0];
      if (lost) return { state: 'lost', won: false, contacted, gone, before_contact: false, reason: 'the link is gone (' + String(lost.lost_reason || 'missing twice').replace(/_/g, ' ') + ')', url: String(lost.from_url || ''), rel: '' };
    }
    return { state: 'not_found', won: false, contacted, gone, before_contact: false, reason: 'no link to you was found on their pages', url: '', rel: '' };
  }
  // FX-LINKS (review R2 M2, 2026-11-18): a note a PERSON wrote on a prospect ("who you contacted, replies, follow-up dates") is never
  // overwritten by the engine or the app: our own line goes after it, behind "Our check: ", and replaces only our earlier line. A note that is
  // ours (empty, or one of the sentences the engine / the app write) is replaced as before.
  const NOTE_MARK = '\nOur check: ';
  const SYS_NOTE = /^(not a won link:|won \d{4}-\d\d-\d\d|won again \d{4}|they link(ed)? to you|a link to you is there|no link to you|our check found|sent by you from your own e-mail|you said the link is live|not a fit \(marked|the AI question|the draft written for them earlier was withdrawn|the link builder writes to them|set aside:|found again)/i;
  const personNote = (n) => { const t = String(n || '').split(NOTE_MARK)[0].trim(); return !!t && !SYS_NOTE.test(t); };
  const noteWith = (old, add, max = 300) => {
    const own = String(old || '').split(NOTE_MARK)[0].trim(); const a = String(add || '').trim();
    if (!personNote(own)) return a.slice(0, max);
    if (!a) return own.slice(0, Math.max(max, own.length));
    return own.length + NOTE_MARK.length + a.length <= max ? own + NOTE_MARK + a : own.length + NOTE_MARK.length + 20 <= max ? own + NOTE_MARK + a.slice(0, max - own.length - NOTE_MARK.length) : own;   // the person's text is never cut
  };
  return { isJobBoard, profilePage, junkLink, wonCheck, noteWith, personNote, text, attr, hostOf, regDomain, isSuffix, refKey, sameSite, isInfra, isScraper, isAutoReport, isSearchPage, isWire, normUrl, cleanUrl, placementAt, anchorPlacements, linksTo, pageFacts, contextAt, challenge, emailsIn, verify, mention, domainKind, quality, values, anchorKind, SPAM_RE, isGambling, footPath, footprints };
})();

// ---- outreach kit (v4.13 Link Builder, LINK_BUILDER_SPEC.md; inlined after the link kit): contacts, qualification, topic fit, our page and
// the link text to ask for. Regex only (the n8n sandbox has no URL / DOM).
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
// ---- KW-COMP (2026-10-21, K6 / A-24 / RV-6): who is a COMPETITOR, one answer for research, the ladder and the full report ----
// Research took its competitors from ONE results page and its #2 was a job board (naukrigulf.com): 545 of 1,168 pool keywords came from
// job and directory sites. On 2026-10-21 the set held help.ardoq.com and job boards again. The leaders (Semrush, Ahrefs) pick organic
// competitors by keyword OVERLAP. A competitor here is a business that ranks for several of the client's in-topic keywords and sells
// something comparable; never a job board, directory, marketplace, review site, news or media site, government or free-zone authority,
// search engine, social network, Q&A site, the help / docs / community pages of another product, a course provider, an encyclopedia, a
// global platform, a "top 10 companies" list, or the client itself.
//  * CMP.kindOf(domain, url, title, snippet) -> { kind, label, by: 'host' | 'result' }: 'business' when nothing rules it out.
//    A HOST kind (naukrigulf.com, help.ardoq.com, difc.ae) rules the whole domain out; a RESULT kind (a jobs page, a list article, a
//    course page on an ordinary business domain) only means that one result is no evidence of competing.
//  * CMP.select({ serps: [{ keyword, items }], declared, own_domain, n, boost }) -> { picked, excluded, too_few, serps_read, note }
//    Scores each business by how many of the results pages the run already bought it appears in, weighted by position. With three or more
//    pages read a business must appear on at least two ("several of your keywords"). The competitors the owner declared stay first.
//    Nothing here buys anything.
const CMP = (() => {
  const S = (v) => String(v == null ? '' : v);
  const host = (h) => S(h).toLowerCase().trim().replace(/^[a-z]+:\/\//, '').replace(/^www\d?\./, '').replace(/[\/?#:].*$/, '').replace(/\.$/, '');
  const reg = (h) => { const x = host(h); const p = x.split('.').filter(Boolean); if (p.length <= 2) return x;
    const sl = p.slice(-2).join('.'); return /^(co|com|org|net|gov|ac|edu|ltd|plc|sch|nic|mil|gob|gouv)\.[a-z]{2}$/.test(sl) ? p.slice(-3).join('.') : sl; };
  const LABEL = { you: 'your own site', job: 'job board', directory: 'business directory', marketplace: 'marketplace or freelance platform',
    review: 'review or comparison site', media: 'news or media site', gov: 'government or free-zone authority', search: 'search engine',
    social: 'social network', qa: 'Q&A site or forum', help: 'help, docs or community pages of another product', education: 'course or education provider',
    reference: 'encyclopedia or reference site', platform: 'global software platform', list: 'list of companies, not a seller', business: 'business', unknown: 'unreadable address' };
  // the name, then only a public suffix (indeed.com, uk.indeed.com, indeed.ae, x.co.uk): a business's own subdomain "connect.acme.com" is not "connect"
  const SUF = '(?:com|net|org|co|io|ai|info|biz|me|tv|ly|app|fyi|news|[a-z]{2})(?:\\.[a-z]{2})?';
  const alt = (a) => new RegExp('(^|\\.)(' + a.join('|').replace(/\./g, '\\.') + ')\\.' + SUF + '$');
  // host lists: the name before the public suffix, any country ending (indeed.com, indeed.ae)
  const HOSTS = [
    ['search', alt(['google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'yandex', 'ask', 'ecosia', 'naver', 'brave'])],
    ['social', alt(['linkedin', 'facebook', 'instagram', 'twitter', 'x', 'tiktok', 'youtube', 'youtu', 'pinterest', 'threads', 'snapchat', 'vimeo', 'telegram', 't', 'whatsapp', 'slideshare', 'scribd'])],
    ['qa', alt(['reddit', 'quora', 'stackoverflow', 'stackexchange', 'superuser', 'serverfault', 'answers', 'discord', 'spiceworks'])],
    ['job', alt(['naukrigulf', 'naukri', 'indeed', 'glassdoor', 'bayt', 'monster', 'monstergulf', 'foundit', 'gulftalent', 'ziprecruiter', 'jooble', 'careerjet',
      'simplyhired', 'wellfound', 'laimoon', 'drjobpro', 'jobsdb', 'jobstreet', 'seek', 'reed', 'totaljobs', 'careerbuilder', 'rozee', 'dubaicareers', 'gulfjobs', 'naukrigulf', 'akhtaboot', 'tanqeeb', 'wuzzuf', 'payscale', 'salary', 'levels'])],
    ['review', alt(['g2', 'capterra', 'getapp', 'softwareadvice', 'trustradius', 'trustpilot', 'peerspot', 'softwaresuggest', 'gartner', 'sitejabber', 'saashub',
      'alternativeto', 'producthunt', 'selecthub', 'financesonline', 'comparably', 'reviews', 'softwareworld', 'crozdesk', 'technologyadvice'])],
    ['directory', alt(['clutch', 'themanifest', 'goodfirms', 'sortlist', 'designrush', 'techbehemoths', '2gis', 'yellowpages', 'yelp', 'crunchbase', 'dnb', 'zoominfo',
      'kompass', 'hidubai', 'uaeyp', 'serchen', 'topdevelopers', 'itfirms', 'appfutura', 'f6s', 'owler', 'cbinsights', 'tracxn', 'pitchbook', 'dubaidirectory',
      'uaecompanies', 'yello', 'cybo', 'tradeindia', 'europages', 'expertmarket', 'agencyspotter', 'upcity', 'bark', 'thumbtack', 'emiratesyellowpages'])],
    ['marketplace', alt(['upwork', 'fiverr', 'freelancer', 'toptal', 'peopleperhour', 'guru', 'amazon', 'noon', 'daraz', 'ebay', 'alibaba', 'aliexpress', 'dubizzle',
      'bayut', 'propertyfinder', 'appsource.microsoft', 'apps.shopify', 'marketplace.microsoft', 'aws.amazon', 'apps.odoo', 'play.google', 'apps.apple'])],
    ['media', alt(['khaleejtimes', 'gulfnews', 'thenationalnews', 'thenational', 'arabianbusiness', 'zawya', 'gulfbusiness', 'emirates247', 'wam', 'bloomberg', 'reuters',
      'forbes', 'forbesmiddleeast', 'cnbc', 'bbc', 'cnn', 'nytimes', 'theguardian', 'businessinsider', 'techcrunch', 'wired', 'zdnet', 'computerweekly', 'itp', 'economymiddleeast',
      'wamda', 'medium', 'substack', 'entrepreneur', 'inc', 'fastcompany', 'venturebeat', 'techradar', 'theverge', 'engadget', 'mashable', 'hbr', 'techtarget', 'cio',
      'computerworld', 'infoworld', 'analyticsinsight', 'towardsdatascience', 'kdnuggets', 'marktechpost', 'abcmoney', 'ft', 'wsj', 'economist', 'aljazeera', 'alarabiya',
      'skynewsarabia', 'albayan', 'alkhaleej', 'emaratalyoum', 'gitex', 'menabytes', 'magnitt', 'smeadvisor', 'cxotoday', 'datacenterdynamics', 'itnewsafrica', 'tahawultech'])],
    ['reference', alt(['wikipedia', 'wikihow', 'wikidata', 'britannica', 'investopedia', 'merriam-webster', 'dictionary', 'thefreedictionary', 'wiktionary', 'statista'])],
    ['education', alt(['coursera', 'udemy', 'edx', 'simplilearn', 'greatlearning', 'mygreatlearning', 'upgrad', 'udacity', 'datacamp', 'skillshare', 'pluralsight',
      'euro-training', 'usaii', 'iabac', 'knowledgehut', 'edureka', 'intellipaat', 'futurelearn', 'khanacademy', 'britishcouncil', 'emeritus', 'classcentral', 'w3schools'])],
    // free zones and authorities of the UAE (a business sets up THROUGH them; they compete with no one), plus the region's tax portals
    ['gov', alt(['difc', 'dmcc', 'dafz', 'jafza', 'rakez', 'ifza', 'meydanfz', 'shams', 'adgm', 'dso', 'dwtc', 'kezad', 'saif-zone', 'srtip', 'hfz', 'dic', 'dubaiinternetcity',
      'dubaicommercity', 'fujairahfreezone', 'ajmanfreezone', 'uaqftz', 'adafz', 'twofour54', 'dubaichamber', 'abudhabichamber', 'sharjahchamber', 'ded', 'dubaided', 'tamm',
      'u', 'zatca', 'mof', 'mohre', 'dubai', 'abudhabi', 'investindubai', 'gdrfad', 'moec', 'tdra',
      // KWL-RES D10: government foundations and initiatives (dubaifuture.ae was a ladder's #1 "competitor"); the title rule below finds the rest
      'dubaifuture', 'digitaldubai', 'smartdubai', 'dub', 'dubaiai', 'museumofthefuture', 'mbrf', 'mbrsg', 'adio', 'dubaiaicampus', 'aiseer'])],
    ['platform', alt(['microsoft', 'dynamics', 'office', 'apple', 'oracle', 'sap', 'salesforce', 'hubspot', 'ibm', 'aws', 'azure', 'github', 'gitlab', 'atlassian', 'zoho',
      'shopify', 'wix', 'wordpress', 'squarespace', 'adobe', 'openai', 'nvidia', 'meta', 'notion', 'odoo', 'intuit', 'quickbooks', 'xero', 'netsuite', 'workday', 'servicenow', 'cloudflare'])],
  ];
  const HELP_SUB = /^(help|support|docs|doc|documentation|kb|knowledge|knowledgebase|community|communities|techcommunity|academy|developer|developers|dev|learn|forum|forums|answers|faq|status|wiki|careers|jobs|training|university|partners?)\./;
  const kindOfHost = (domainOrUrl, own) => {
    const h = host(domainOrUrl); if (!h || !/\./.test(h)) return 'unknown';
    const o = host(own); if (o && (h === o || h.endsWith('.' + o) || reg(h) === reg(o))) return 'you';
    if (/(^|\.)(gov|mil|int|gob|gouv|govt|government)(\.[a-z]{2})?$/.test(h) || /\.(gov|mil)\.[a-z]{2}$/.test(h)) return 'gov';
    if (/(^|\.)(edu|ac)\.[a-z]{2}$/.test(h) || /\.edu$/.test(h)) return 'education';
    for (const [k, re] of HOSTS) if (re.test(h)) return k;
    if (HELP_SUB.test(h) && h.split('.').length >= 3) return 'help';
    const lab = reg(h).split('.')[0];
    if (/(jobs|careers|recruit|vacanc|hiring)/.test(lab)) return 'job';
    if (/(freezone|free-zone|freezon)/.test(lab) || /^[a-z]{2,10}fz$/.test(lab)) return 'gov';
    if (/(news|times|magazine|herald|tribune|gazette|journal|chronicle|insider|digest|money)$/.test(lab) || /^(the)?news/.test(lab)) return 'media';
    if (/(directory|yellowpages|listings?)$/.test(lab) || /^(top|best)(firms|companies|agencies|developers|vendors)/.test(lab)) return 'directory';
    if (/(university|college|institute|academy|school)$/.test(lab) || /^(university|college)/.test(lab)) return 'education';
    return 'business';
  };
  // what ONE result is, on an ordinary business domain: a jobs page, a list of companies, a course page (the domain may still compete elsewhere)
  const JOB_T = /\b(jobs?|vacanc(?:y|ies)|careers?|hiring|recruit\w*|salar(?:y|ies)|job openings?)\b/i;
  const JOB_AR = /(وظائف|وظيفة|رواتب|توظيف)/;
  const LIST_T = /\b(?:top|best|leading)\s+(?:\d+\s+)?[\w\s&.,-]{0,50}?\b(?:companies|firms|agencies|providers|consultants|consultancies|partners|vendors|developers|integrators|implementers|tools)\b|\b\d+\s+(?:best|top|leading)\b|\blist of\b|\btop\s*\d+\b/i;
  // the address of a list article: /rankings/..., /top-10-ai-consulting-companies, /blog/ai-companies-in-dubai (r04: consultancy-me.com, leewayhertz.com)
  const LIST_P = /\/(?:rankings?\/|[^\/?#]*\b(?:top|best)-(?:\d+-)?[^\/?#]*(?:companies|firms|agencies|providers|consultants|consultancies|vendors|partners|developers|tools)\b|[^\/?#]*\b(?:companies|firms|agencies)-in-)/;   // not "consultants-in-dubai": that is a vendor's own service page (hlbhamt.com)
  const LIST_AR = /(أفضل\s*\d*\s*شركات|قائمة)/;
  const COURSE_T = /\b(course|courses|certification (?:course|program(?:me)?|exam|training)|certificate program(?:me)?|bootcamp|diploma|program fee|enrol(?:l|ment)?|syllabus|curriculum|online training)\b/i;
  const COURSE_AR = /(دورة|دورات|شهادة معتمدة)/;
  const kindOfResult = (url, title, snippet) => {
    const t = S(title); const u = S(url).toLowerCase(); const p = u.replace(/^[a-z]+:\/\/[^\/]+/, '');
    if (JOB_T.test(t) || JOB_AR.test(t) || /\/(jobs?|careers?|vacanc\w*)(\/|$|-|\?)/.test(p)) return 'job';
    if (LIST_T.test(t) || LIST_AR.test(t) || LIST_P.test(p)) return 'list';
    if (COURSE_T.test(t) || COURSE_AR.test(t) || /\/(courses?|certifications?|training-courses?)(\/|$|-)/.test(p)) return 'education';
    return 'business';
  };
  // KWL-RES D10 (2026-10-21 live keyword test, exec 125): dubaifuture.ae (Dubai Future Foundation) was the ladder's top competitor: no host list
  // can name every authority, foundation, council or chamber, but their own results say what they are. A NAMED body ("Dubai Future Foundation",
  // "Roads and Transport Authority", "UAE Cyber Security Council", "Dubai Chamber") in the title, or a snippet that calls the site a government
  // entity / initiative, rules the whole domain out (a business result that merely mentions government work is not one: the name must end in
  // the word, or the snippet must say the site is the government's).
  // the name must be a whole segment of the title (the site name before or after "|", " - ", ":"), so a case study titled "How we helped
  // the Roads and Transport Authority" on a business's site is not read as the authority's own page
  const GOV_NAME_SEG = /^(?:the\s+)?(?:[A-Z][\w'&.-]*\s+(?:(?:of|and|for|the|de)\s+)?){1,6}(?:Foundation|Authority|Council|Chamber(?: of Commerce(?: and Industry)?)?|Municipality)(?:\s*\([A-Z]{2,6}\))?$|^(?:the\s+)?(?:Ministry|Government) of\s+[A-Z][\w\s&'-]{1,60}$/;
  const GOV_NAME_T = { test: (t) => S(t).split(/\s+[|\u2013\u2014:-]\s+|\s*\|\s*/).map(x => x.trim()).filter(Boolean).some(x => GOV_NAME_SEG.test(x)) };
  const GOV_SNIP = /\b(?:(?:a|an|the)\s+(?:federal|government|governmental|public)\s+(?:entity|initiative|agency|body|authority|department|foundation|organi[sz]ation|program(?:me)?|platform)|government[- ](?:owned|backed|led|initiative|entity)|established by (?:the )?(?:government|(?:an? |royal |emiri )?decree|law)|chamber of commerce|ministry of)\b/i;
  const govSignal = (title, snippet) => GOV_NAME_T.test(S(title)) || GOV_SNIP.test(S(title) + ' ' + S(snippet));
  const kindOf = (domain, url, title, snippet, own) => {
    const hk = kindOfHost(domain || url, own);
    if (hk !== 'business') return { kind: hk, label: LABEL[hk] || hk, by: 'host' };
    if (govSignal(title, snippet)) return { kind: 'gov', label: LABEL.gov, by: 'host' };
    const rk = kindOfResult(url, title, snippet);
    return { kind: rk, label: LABEL[rk] || rk, by: rk === 'business' ? '' : 'result' };
  };
  const weight = (p) => { const n = Number(p) || 99; return n <= 10 ? +(1 - (n - 1) * 0.07).toFixed(2) : n <= 20 ? 0.25 : n <= 30 ? 0.1 : 0; };
  const listOf = (v) => (Array.isArray(v) ? v : S(v).split(/[,;\n]+/)).map(host).filter(Boolean);
  const select = (o) => {
    o = o || {}; const own = host(o.own_domain); const n = Math.max(1, Number(o.n) || 3);
    const serps = (Array.isArray(o.serps) ? o.serps : []).filter(s => s && Array.isArray(s.items) && s.items.some(x => x && (!x.type || x.type === 'organic')));
    const read = serps.length;
    const cand = new Map(); const excl = new Map();
    // KWL-RES D10: a domain one of whose results names it a government body is a government body on every results page
    const govRegs = new Set(); for (const s of serps) for (const it of s.items) { if (!it || (it.type && it.type !== 'organic')) continue; const h = host(it.domain || it.url);
      if (h && kindOfHost(h, own) === 'business' && govSignal(it.title, it.description || it.snippet)) govRegs.add(reg(h)); }
    serps.forEach((s, si) => {
      const kw = S(s.keyword).trim();
      const seenHere = new Set();
      for (const it of s.items) {
        if (!it || (it.type && it.type !== 'organic')) continue;
        const h = host(it.domain || it.url); if (!h) continue;
        const pos = Number(it.rank_group || it.rank_absolute || it.rank || it.position) || 99;
        const k0 = kindOf(h, it.url, it.title, it.description || it.snippet, own);
        const k = (k0.kind === 'business' || k0.by === 'result') && govRegs.has(reg(h)) ? { kind: 'gov', label: LABEL.gov, by: 'host' } : k0;
        const d = k.by === 'host' ? (k.kind === 'gov' && govRegs.has(reg(h)) ? reg(h) : h) : reg(h);
        if (k.kind === 'you') continue;
        if (k.kind !== 'business') {
          const e = excl.get(d) || { domain: d, kind: k.kind, label: k.label, by: k.by, seen_in: 0, best_position: 99, example: '', kinds: {} };
          e.best_position = Math.min(e.best_position, pos);
          e.kinds[k.kind] = (e.kinds[k.kind] || 0) + 1;
          if (!seenHere.has('x:' + d)) { e.seen_in++; seenHere.add('x:' + d); }
          if (!e.example) e.example = S(it.title).replace(/\s+/g, ' ').trim().slice(0, 90) + (kw ? ' (for "' + kw + '")' : '');
          excl.set(d, e); continue;
        }
        if (seenHere.has(d)) continue; seenHere.add(d);
        const c = cand.get(d) || { domain: d, serps: 0, score: 0, best_position: 99, keywords: [] };
        const b = typeof o.boost === 'function' ? (Number(o.boost(it, d)) || 1) : 1;
        c.serps++; c.score = +(c.score + weight(pos) * b).toFixed(3); c.best_position = Math.min(c.best_position, pos);
        if (kw && c.keywords.length < 6) c.keywords.push(kw + ' #' + pos);
        cand.set(d, c);
      }
    });
    // a domain with result-level exclusions AND a counting appearance is a business: its list / jobs page is not held against it
    for (const d of cand.keys()) { const e = excl.get(d); if (e && e.by === 'result') excl.delete(d); }
    for (const e of excl.values()) if (e.by === 'result') { const top = Object.entries(e.kinds).sort((a, b) => b[1] - a[1])[0]; e.kind = top[0]; e.label = LABEL[e.kind] || e.kind; }
    const minSerps = read >= 3 ? 2 : 1;
    const ev = (c) => read <= 1 ? 'ranks #' + c.best_position + (c.keywords[0] ? ' for "' + c.keywords[0].replace(/ #\d+$/, '') + '"' : '') + ' (the only results page read)'
      : 'ranks for ' + c.serps + ' of your ' + read + ' keywords (best #' + c.best_position + ')';
    const ranked = [...cand.values()].sort((a, b) => b.score - a.score || b.serps - a.serps || a.best_position - b.best_position || a.domain.localeCompare(b.domain));
    const too_few = ranked.filter(c => c.serps < minSerps).map(c => ({ domain: c.domain, serps: c.serps, why: 'seen on only ' + c.serps + ' of your ' + read + ' results pages' }));
    const fromSerps = ranked.filter(c => c.serps >= minSerps);
    // the owner's own list first: kept unless the address itself is a job board, a directory, an authority… (said, not silently dropped)
    const declared = []; const declaredRefused = [];
    for (const d0 of [...new Set(listOf(o.declared))]) {
      const hk = kindOfHost(d0, own); if (hk === 'you') continue;
      const d = hk === 'business' || hk === 'unknown' ? reg(d0) : d0;
      if (hk !== 'business' && hk !== 'unknown') { declaredRefused.push({ domain: d, kind: hk, label: LABEL[hk], by: 'host', seen_in: 0, example: 'you named it as a competitor, but it is a ' + LABEL[hk] }); continue; }
      if (declared.some(x => x.domain === d)) continue;
      const c = cand.get(d);
      declared.push({ domain: d, source: 'declared', serps: c ? c.serps : 0, of: read, score: c ? c.score : 0, best_position: c ? c.best_position : null,
        keywords: c ? c.keywords : [], evidence: 'declared by you as a competitor' + (c ? '; ' + ev(c) : read ? '; not seen on the ' + read + ' results page(s) read' : '') });
    }
    const picked = [...declared, ...fromSerps.filter(c => !declared.some(x => x.domain === c.domain))
      .map(c => ({ domain: c.domain, source: 'results', serps: c.serps, of: read, score: c.score, best_position: c.best_position, keywords: c.keywords, evidence: ev(c) }))].slice(0, Math.max(n, declared.length));
    const excluded = [...declaredRefused, ...[...excl.values()].sort((a, b) => b.seen_in - a.seen_in || a.best_position - b.best_position || a.domain.localeCompare(b.domain))]
      .map(({ kinds, ...e }) => e);
    const exText = excluded.slice(0, 6).map(e => e.domain + ' (' + e.label + ')').join(', ');
    const note = !read
      ? (declared.length ? 'No results page was read on this run, so only the competitor(s) you declared are used: ' + declared.map(d => d.domain).join(', ') + '.'
        : 'No results page was read on this run and you declared no competitor, so no competitor was used.')
      : (declared.length ? declared.length + ' competitor(s) you declared, then ' : '')
        + (read === 1 ? (picked.length > declared.length ? 'the businesses on Google\'s results page for "' + S(serps[0].keyword) + '"' : 'no other business on Google\'s results page for "' + S(serps[0].keyword) + '"')
          + ' (one results page only, so this is a thin read)'
          : picked.length > declared.length ? 'the businesses that rank for the most of your ' + read + ' keywords on the results pages this run read' : 'no other business ranked often enough on the ' + read + ' results pages read')
        + (minSerps > 1 ? '; a business must rank for at least ' + minSerps + ' of them' : '')
        + (exText ? '. Passed over: ' + exText : '') + '.';
    return { picked, excluded: excluded.slice(0, 20), too_few: too_few.slice(0, 10), serps_read: read, min_serps: minSerps, note };
  };
  // ---- CR17-F (2026-11-17, client report C5, build section 196): ONE role per site, for every screen and every engine path ----
  // devaicon.com saw LinkedIn, Clutch and edX called "a competing site of yours" (the Link Builder), and SAP, Salesforce and Oracle as the
  // businesses AI recommends instead of it (AI visibility), while the keyword research labelled the same hosts a platform, a directory and an
  // education site. Five kits held five host lists (_ki.js, _rivals.js, _ai_entities.js, _link_kit.js and this one) and the consumers that put
  // the word "competitor" on screen used the weakest. CMP.role is the one answer; every list below is the union of theirs (the harness holds
  // each kit's list to it, scenarios_cr17_f.js CR17F1).
  //  * CMP.role(host, ctx) -> { role, class, by, reason, words }
  //    role: competitor (sells a comparable service, or chosen by the client), listing (directories, review sites, marketplaces: a place to be
  //    listed, never a rival), also_ranks (platforms, social networks, publishers, education portals, Q&A, code hosts: they rank, they compete
  //    for no customer), authority (government, regulators, standards bodies), software (a maker of software the buyer may consider, named by
  //    AI or ranking: SAP, Salesforce, Zapier), your_platform (the maker of the platform the client builds on, named by its own services:
  //    Microsoft for a Dynamics partner, openedx.org for an Open edX shop), not_competitor (the client said so), you, unknown.
  //    ctx: { own_domain, services, topics, principals, chosen, declared, not_competitors, overrides: { host: 'chosen' | 'not_competitor' },
  //           ki: { host: KI class }, url }. The client's word wins (chosen, then not_competitor), then the platform the client builds on,
  //    then the host lists, then the KI class read from evidence, then the host's own name; a host nothing rules out is a business: competitor.
  //  * CMP.partnerDirectory(url) - a principal's partner / marketplace directory (openedx.org/partners, microsoftpartners.microsoft.com,
  //    appsource.microsoft.com): a place to be listed, whoever's site it is on.
  //  * CMP.listPage(title, url) - a page that lists companies ("AI / Automation Agencies in Pakistan", "/agencies/..."), beyond "best" / "top".
  //  * CMP.oneList({ declared, ki_rows, not_competitors, own_domain, max }) - THE competitor list of a site: what the client declared in Site
  //    settings, plus what it chose on the Competitors page, minus what it marked not a competitor (or dismissed there). Monitors and the app
  //    read this one list.
  //  * CMP.LEFT_OUT - the reason codes (and plain words) of a prospect the competitor gate leaves out; the Link Builder stores the code.
  const RX = (names) => new RegExp('(^|\\.)(' + names.map(n => n.replace(/\./g, '\\.')).join('|') + ')\\.' + SUF + '$');
  const ROLE_LISTS = {
    // makers of software a buyer may consider (KI PLATFORM_HOSTS / PRINCIPALS, AIE PLATFORMS, CMP platform): never a competitor of a services firm
    software: RX(['microsoft', 'dynamics', 'office', 'azure', 'sap', 'oracle', 'netsuite', 'salesforce', 'hubspot', 'zoho', 'odoo', 'infor', 'epicor', 'ifs', 'unit4', 'sage', 'acumatica',
      'syspro', 'xero', 'quickbooks', 'intuit', 'freshbooks', 'tally', 'tallysolutions', 'workday', 'servicenow', 'shopify', 'magento', 'adobe', 'atlassian', 'notion', 'slack', 'zapier', 'make',
      'monday', 'asana', 'trello', 'clickup', 'airtable', 'freshworks', 'freshdesk', 'zendesk', 'pipedrive', 'intercom', 'mailchimp', 'dropbox', 'box', 'docusign', 'stripe', 'paypal',
      'twilio', 'okta', 'bitrix24', 'insightly', 'keap', 'sugarcrm', 'vtiger', 'creatio', 'openai', 'anthropic', 'nvidia', 'ibm', 'aws', 'apple', 'meta', 'canva', 'figma', 'uipath',
      'automationanywhere', 'blueprism', 'n8n', 'moodle', 'openedx', 'axim', 'totara', 'docebo', 'talentlms', 'cornerstoneondemand', 'wave', 'cloudflare', 'mulesoft', 'tableau', 'qlik',
      'snowflake', 'databricks', 'elastic', 'mongodb', 'redhat', 'vmware', 'cisco', 'google']),
    // places to be listed (CMP directory / review / marketplace, KI DIRECTORY_HOSTS, AIE DIRECTORY, RV NOT_RIVAL directories)
    listing: RX(['clutch', 'themanifest', 'goodfirms', 'sortlist', 'designrush', 'techbehemoths', 'topdevelopers', 'itfirms', 'appfutura', 'f6s', 'g2', 'capterra', 'getapp', 'softwareadvice',
      'trustradius', 'trustpilot', 'peerspot', 'softwaresuggest', 'gartner', 'saashub', 'alternativeto', 'producthunt', 'selecthub', 'financesonline', 'softwareworld', 'crozdesk',
      'technologyadvice', 'appvizer', 'softwarefinder', 'softwareconnect', 'top10erp', 'erpfocus', 'upcity', 'agencyspotter', 'expertise', 'yelp', 'yell', 'yellowpages', '2gis', 'crunchbase',
      'zoominfo', 'dnb', 'kompass', 'hidubai', 'uaeyp', 'serchen', 'bark', 'thumbtack', 'rightfirms', 'techreviewer', 'vendorland', 'builtin', 'zoftwarehub', 'sitejabber', 'comparably',
      'reviews', 'owler', 'cbinsights', 'tracxn', 'pitchbook', 'dubaidirectory', 'uaecompanies', 'yello', 'cybo', 'tradeindia', 'europages', 'expertmarket', 'emiratesyellowpages',
      'selectedfirms', 'featuredcustomers', 'justdial', 'sulekha', 'businesslist', 'ensun', 'wadline', 'softwarereviews', 'sourceforge', 'dubizzle', 'upwork', 'fiverr', 'freelancer',
      'toptal', 'peopleperhour', 'guru', 'appsource.microsoft', 'marketplace.microsoft', 'microsoftpartners.microsoft', 'apps.shopify', 'apps.odoo', 'itprofiles', 'brandmentions', 'connect', 'expatwoman']),
    // they rank, they compete for no customer (CMP social / qa / reference / education / media / search / job, KI PLATFORM_HOSTS publishers and
    // code hosts, KI MEDIA_HOSTS, AIE MEDIA / SOCIAL / RESEARCH, LK social, RV NOT_RIVAL social / news)
    also_ranks: RX(['linkedin', 'lnkd', 'facebook', 'fb', 'instagram', 'twitter', 'x', 'tiktok', 'youtube', 'youtu', 'pinterest', 'threads', 'snapchat', 'vimeo', 'telegram', 'whatsapp',
      'slideshare', 'scribd', 'issuu', 'reddit', 'quora', 'stackoverflow', 'stackexchange', 'superuser', 'serverfault', 'discord', 'spiceworks', 'tumblr', 'medium', 'substack',
      'github', 'gitlab', 'bitbucket', 'npmjs', 'readthedocs', 'wordpress', 'blogspot', 'wix', 'weebly', 'squarespace', 'fandom', 'wikipedia', 'wikimedia', 'wikihow', 'wikidata',
      'britannica', 'investopedia', 'merriam-webster', 'dictionary', 'statista', 'researchgate', 'academia', 'sciencedirect', 'springer', 'ieee', 'arxiv', 'mdpi', 'ncbi',
      'forrester', 'idc', 'mckinsey', 'bcg', 'bain', 'business', 'khaleej', 'marketsandmarkets', 'mordorintelligence', 'grandviewresearch', 'frost',
      'coursera', 'udemy', 'edx', 'simplilearn', 'greatlearning', 'mygreatlearning', 'upgrad', 'udacity', 'datacamp', 'skillshare', 'pluralsight', 'edureka', 'intellipaat',
      'futurelearn', 'khanacademy', 'classcentral', 'w3schools', 'emeritus', 'knowledgehut',
      'google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'yandex', 'ecosia', 'brave', 'chatgpt', 'perplexity', 'gemini', 'claude',
      'indeed', 'glassdoor', 'naukri', 'naukrigulf', 'bayt', 'monster', 'gulftalent', 'rozee', 'mustakbil', 'wuzzuf', 'bebee', 'ziprecruiter', 'jooble',
      'gulfnews', 'khaleejtimes', 'thenationalnews', 'thenational', 'zawya', 'arabianbusiness', 'gulfbusiness', 'reuters', 'bloomberg', 'forbes', 'forbesmiddleeast', 'cnbc', 'bbc', 'cnn',
      'ft', 'wsj', 'techcrunch', 'entrepreneur', 'economist', 'businessinsider', 'arabnews', 'timesofindia', 'dawn', 'tribune', 'propakistani', 'techjuice', 'techradar', 'pcmag', 'zdnet',
      'cio', 'computerweekly', 'itpro', 'techtarget', 'wired', 'theverge', 'engadget', 'mashable', 'venturebeat', 'inc', 'fastcompany', 'hbr', 'nytimes', 'theguardian', 'itp',
      'economymiddleeast', 'wamda', 'magnitt', 'cxotoday', 'tahawultech', 'menabytes', 'analyticsinsight', 'towardsdatascience', 'kdnuggets', 'marktechpost', 'erpresearch',
      'erpsoftwareblog', 'msdynamicsworld', 'dynamicscommunity', 'technologyevaluation', 'panorama-consulting', 'erpnews', 'tradearabia', 'emirates247', 'wam', 'albayan', 'alkhaleej',
      'argaam', 'saudigazette', 'nerdwallet', 'aljazeera', 'alarabiya', 'about', 'linktr', 'carrd', 'bio', 'beacons']),
    // regulators and public bodies whose addresses do not end in .gov (KI GOV_HOSTS, AIE GOV, CMP gov)
    authority: RX(['centralbank', 'cbuae', 'ico', 'fca', 'cma', 'sbp', 'secp', 'pta', 'fbr', 'sama', 'zatca', 'rbi', 'sebi', 'ecb', 'europa', 'edpb', 'vara', 'dfsa', 'fsra',
      'tdra', 'citra', 'qcb', 'cbb', 'cbo', 'cbk', 'mas', 'bnm', 'bis', 'imf', 'worldbank', 'oecd', 'who', 'difc', 'adgm', 'dmcc', 'dafz', 'dafza', 'jafza', 'rakez', 'dso', 'ifza', 'shams',
      'kezad', 'dwtc', 'dubaichamber', 'abudhabichamber', 'dubaided', 'saifzone', 'ajmanfreezone', 'fujairahfreezone', 'hamriyahfz', 'mof', 'mohre', 'u', 'ai.gov', 'peppol', 'openpeppol', 'w3', 'iso']),
    // global consultancies and the Big Four: they sell IT and AI consulting, so they compete (class enterprise; owner decision, HANDOFF_F.md)
    enterprise: RX(['deloitte', 'pwc', 'kpmg', 'ey', 'accenture', 'capgemini', 'cognizant', 'infosys', 'wipro', 'tcs', 'hcltech', 'kearney', 'protiviti', 'grantthornton', 'bdo'])
  };
  // the platform a client builds on, named by its own services (the KI table of principals, kept in step by CR17F1)
  const PRINCIPALS = [
    { re: /\b(microsoft|dynamics|d365|business central|power platform|power bi|power apps|power automate|fabric|copilot|azure|sharepoint|office 365|microsoft 365|m365|navision|nav|great plains|dynamics gp|dynamics ax)\b/i,
      hosts: ['microsoft.com', 'dynamics.com', 'microsoft.ae', 'azure.com', 'powerbi.com', 'powerplatform.com', 'office.com', 'microsoftonline.com', 'windows.net', 'sharepoint.com'] },
    { re: /\bopen ?edx\b/i, hosts: ['openedx.org', 'axim.org', 'edx.readthedocs.io', 'openedx.atlassian.net'] },
    { re: /\bodoo\b/i, hosts: ['odoo.com'] }, { re: /\bsap\b|s\/?4 ?hana/i, hosts: ['sap.com'] }, { re: /\bsalesforce\b/i, hosts: ['salesforce.com'] },
    { re: /\bhubspot\b/i, hosts: ['hubspot.com'] }, { re: /\bzoho\b/i, hosts: ['zoho.com'] }, { re: /\bnetsuite\b/i, hosts: ['netsuite.com', 'oracle.com'] },
    { re: /\boracle\b/i, hosts: ['oracle.com'] }, { re: /\bsage\b/i, hosts: ['sage.com'] }, { re: /\bshopify\b/i, hosts: ['shopify.com'] },
    { re: /\baws\b|amazon web services/i, hosts: ['aws.amazon.com', 'amazonaws.com'] }, { re: /\bgoogle cloud\b|\bgcp\b/i, hosts: ['cloud.google.com'] },
    { re: /\bgoogle workspace\b/i, hosts: ['workspace.google.com'] }, { re: /\bpeppol\b/i, hosts: ['peppol.org', 'peppol.eu'] },
    { re: /\bmoodle\b/i, hosts: ['moodle.org', 'moodle.com'] }, { re: /\bservicenow\b/i, hosts: ['servicenow.com'] }, { re: /\bacumatica\b/i, hosts: ['acumatica.com'] },
    { re: /\bwordpress\b/i, hosts: ['wordpress.org', 'wordpress.com'] }, { re: /\bmagento\b|adobe commerce/i, hosts: ['magento.com', 'adobe.com'] }
  ];
  // a software maker COMPETES with a client that sells the same kind of software (Odoo for a Dynamics 365 ERP partner, SAP and Oracle for an
  // Odoo partner, Zoho Payroll for a payroll firm: harness accuracy set ai_entities.json T06 T13 T30); for anyone else (an AI or software
  // services firm named next to SAP and Salesforce in an AI-automation answer) it is a software maker. A client "sells" a category when two of
  // its services name it (or one of three or fewer); with no services known nothing can be judged and the maker stays a competitor, as before.
  const SOFT_CAT = {
    erp: { client: /\b(?:erp|dynamics 365|d365|business central|navision|nav|great plains|dynamics (?:gp|ax|nav)|finance (?:&|and) operations|odoo|netsuite|sap|acumatica|sage|syspro|epicor|infor|tally|zoho books|erpnext)\b/i,
      makers: RX(['sap', 'oracle', 'netsuite', 'odoo', 'sage', 'xero', 'quickbooks', 'intuit', 'tally', 'tallysolutions', 'infor', 'epicor', 'ifs', 'unit4', 'acumatica', 'syspro', 'workday', 'microsoft', 'dynamics', 'zoho', 'freshbooks']) },
    crm: { client: /\b(?:crm|salesforce|hubspot|customer engagement|dynamics 365 sales|pipedrive|zoho crm|sugarcrm)\b/i,
      makers: RX(['salesforce', 'hubspot', 'pipedrive', 'freshworks', 'zendesk', 'sugarcrm', 'vtiger', 'creatio', 'bitrix24', 'insightly', 'keap', 'zoho', 'microsoft', 'dynamics', 'oracle', 'sap']) },
    lms: { client: /\b(?:lms|open ?edx|moodle|learning management|e-?learning platform|docebo|totara)\b/i,
      makers: RX(['moodle', 'openedx', 'axim', 'docebo', 'totara', 'talentlms', 'cornerstoneondemand']) },
    payroll: { client: /\b(?:payroll|wps|hr software|hrms|hcm)\b/i, makers: RX(['zoho', 'sage', 'xero', 'quickbooks', 'intuit', 'workday', 'sap', 'oracle']) },
    ecommerce: { client: /\b(?:shopify|magento|woocommerce|e-?commerce platform)\b/i, makers: RX(['shopify', 'magento', 'adobe', 'wix', 'squarespace', 'bigcommerce']) }
  };
  const clientCats = (ctx) => { const o = ctx || {}; const sv = [].concat(o.services || []).map(x => S(x && typeof x === 'object' ? (x.name || x.label || '') : x)).filter(Boolean);
    if (!sv.length) return null; const out = new Set();
    for (const [k, c] of Object.entries(SOFT_CAT)) { const n = sv.filter(x => c.client.test(x)).length; if (n >= 2 || (n >= 1 && sv.length <= 3)) out.add(k); }
    return out; };
  const sellsSameSoftware = (h, ctx) => { const cats = clientCats(ctx); if (cats === null) return true; for (const k of cats) if (SOFT_CAT[k].makers.test(h)) return true; return false; };
  const ROLES = ['competitor', 'listing', 'also_ranks', 'authority', 'software', 'your_platform', 'not_competitor', 'you', 'unknown'];
  // the words a client reads for each role (Rankings "Above you", AI visibility, the Link Builder's left-out list)
  const ROLE_WORDS = { competitor: 'a competitor', listing: 'a directory or list where companies are listed', also_ranks: 'a platform or publisher that also ranks',
    authority: 'a government or public body', software: 'a software maker', your_platform: 'the maker of the platform you work with', not_competitor: 'not a competitor (your choice)',
    you: 'your own site', unknown: 'not a web address' };
  // KI classes -> roles (the KI page's evidence, when the caller has it)
  const KI_ROLE = { direct: 'competitor', adjacent: 'competitor', principal: 'your_platform', directory: 'listing', publisher_list: 'listing', platform: 'also_ranks', media: 'also_ranks',
    education: 'also_ranks', job_board: 'also_ranks', government: 'authority' };
  // CMP host kinds -> roles
  const KIND_ROLE = { job: 'also_ranks', directory: 'listing', review: 'listing', marketplace: 'listing', media: 'also_ranks', gov: 'authority', search: 'also_ranks', social: 'also_ranks',
    qa: 'also_ranks', reference: 'also_ranks', education: 'also_ranks', help: 'also_ranks', platform: 'software' };
  const listOfH = (v) => (Array.isArray(v) ? v : S(v).split(/[,;\n]+/)).map(x => host(x && typeof x === 'object' ? (x.domain || x.host || x.comp_domain) : x)).filter(Boolean);
  const sameOrSub = (h, d) => !!d && (h === d || h.endsWith('.' + d) || reg(h) === reg(d));
  const principalHosts = (ctx) => { const o = ctx || {}; const txt = [].concat(o.services || [], o.topics || []).map(x => S(x && typeof x === 'object' ? (x.name || x.label || '') : x)).join(' | ');
    const out = new Set(listOfH(o.principals)); for (const p of PRINCIPALS) if (p.re.test(txt)) p.hosts.forEach(x => out.add(x)); return [...out]; };
  // a principal's partner / app directory: a place to be listed, whoever's site it is on
  const PARTNER_HOST = /^(microsoftpartners\.microsoft\.com|appsource\.microsoft\.com|marketplace\.microsoft\.com|partner\.microsoft\.com|partners\.salesforce\.com|appexchange\.salesforce\.com|ecosystem\.hubspot\.com|apps\.odoo\.com|apps\.shopify\.com|partnerfinder\.sap\.com|aws\.amazon\.com\/partners|marketplace\.zoho\.com)/;
  const PARTNER_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:partners?|partner-directory|find-a-partner|partner-finder|service-providers|providers|marketplace|solution-providers)(?:\/|$|\?)/i;
  const partnerDirectory = (url) => { const u = S(url).toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, ''); if (!u) return false;
    if (PARTNER_HOST.test(u)) return true; const p = u.replace(/^[^\/?#]+/, '') || '/'; return PARTNER_PATH.test(p); };
  // a page that lists companies: CMP's list rule, or a plural seller noun as its head ("AI / Automation Agencies in Pakistan"), or an address
  // made for listings (/agencies/..., /companies/..., /directory/...)
  const SELLERS_HEAD = /(?:^|[|\-:]\s*)(?:[\w&\/.+-]+\s+){0,5}(?:companies|firms|agencies|providers|consultants|consultancies|vendors|partners|developers|integrators|specialists|studios)(?:\s+(?:in|for|near|across)\s+[\w\s,&-]{2,40})?\s*(?:$|[|\-:(])/i;
  const LISTING_PATH = /\/(?:agencies|companies|firms|vendors|providers|directory|directories|listings?|rankings?|top-[\w-]+)\//i;
  const listPage = (title, url) => { const t = S(title); const p = S(url).replace(/^[a-z]+:\/\/[^\/]+/i, '');
    return kindOfResult(url, title, '') === 'list' || SELLERS_HEAD.test(t) || LISTING_PATH.test(p + '/'); };
  /** CMP.role(host, ctx) -> { role, class, by, reason, words } (see above) */
  const role = (h0, ctx) => {
    const o = ctx || {}; const h = host(h0 && typeof h0 === 'object' ? (h0.domain || h0.host) : h0);
    const out = (r, cls, by, reason) => ({ role: r, class: cls, by, reason, words: ROLE_WORDS[r] || r, host: h, reg: h ? reg(h) : '' });
    if (!h || !/\./.test(h)) return out('unknown', '', 'rule', 'not a web address');
    const own = host(o.own_domain); if (own && sameOrSub(h, own)) return out('you', '', 'rule', 'your own site');
    const R = reg(h);
    const ov = o.overrides && typeof o.overrides === 'object' ? (o.overrides[h] || o.overrides[R] || '') : '';
    const inL = (v) => listOfH(v).some(d => sameOrSub(h, d) || reg(d) === R);
    if (ov === 'not_competitor' || inL(o.not_competitors)) return out('not_competitor', 'user', 'user', 'you marked it as not a competitor');
    if (ov === 'chosen' || inL(o.chosen) || inL(o.declared)) return out('competitor', 'user', 'user', 'you chose it as a competitor');
    const pr = principalHosts(o);
    if (pr.some(d => sameOrSub(h, d))) return out('your_platform', 'principal', 'rule', 'the maker of a platform your services are built on');
    if (/(^|\.)(gov|mil|int|gob|gouv|govt|government)(\.[a-z]{2})?$/.test(h) || /\.(gov|mil)\.[a-z]{2}$/.test(h)) return out('authority', 'government', 'rule', 'a government or public body');
    if (/(^|\.)(edu|ac)\.[a-z]{2}$/.test(h) || /\.edu$/.test(h)) return out('also_ranks', 'education', 'rule', 'a school or university');
    if (ROLE_LISTS.authority.test(h)) return out('authority', 'government', 'rule', 'a government, regulator or standards body');
    if (ROLE_LISTS.listing.test(h)) return out('listing', 'directory', 'rule', 'a directory, review site or marketplace where companies are listed');
    if (ROLE_LISTS.software.test(h)) return sellsSameSoftware(h, o) ? out('competitor', 'software_vendor', 'rule', 'it makes software of a kind you sell') : out('software', 'software', 'rule', 'a maker of software buyers may consider');
    if (ROLE_LISTS.also_ranks.test(h)) return out('also_ranks', 'platform', 'rule', 'a platform, network, publisher or course site that ranks for searches but sells no comparable service');
    if (ROLE_LISTS.enterprise.test(h)) return out('competitor', 'enterprise', 'rule', 'a global consultancy that sells IT and AI services');
    const kc = o.ki && typeof o.ki === 'object' ? (o.ki[h] || o.ki[R] || '') : '';
    if (KI_ROLE[kc]) return out(KI_ROLE[kc], kc, 'ki', 'read from its own pages on the Competitors page');
    const k = kindOfHost(h, own);
    if (k === 'you') return out('you', '', 'rule', 'your own site');
    if (KIND_ROLE[k]) return out(KIND_ROLE[k], k, 'rule', LABEL[k] || k);
    return out('competitor', 'business', 'rule', 'a business site');
  };
  const isCompetitor = (h, ctx) => role(h, ctx).role === 'competitor';
  // the left-out reasons of the competitor gate (the Link Builder stores the code in seo_link_outreach.reason_code; the app reads the words)
  const LEFT_OUT = {
    competitor: 'a competitor of yours: it does not link to a competitor',
    competitor_list: 'a competitor of yours: its own list ranks itself, not you',
    listing: 'a directory or list where companies are listed: add yourself to it instead (see Listings)',
    your_platform: 'the maker of the platform you work with, not a competitor: get listed in its partner directory instead',
    software: 'a software maker, not a competitor: its pages link to its own product, not to service providers'
  };
  /** CMP.oneList({ declared, ki_rows, not_competitors, own_domain, max }) -> { list, chosen, declared, removed } - THE competitor list of a site */
  const oneList = (o0) => {
    const o = o0 || {}; const own = host(o.own_domain); const max = Math.max(1, Number(o.max) || 5);
    const rows = (Array.isArray(o.ki_rows) ? o.ki_rows : []).filter(r => r && r.comp_domain && (!o.site_id || !r.site_id || S(r.site_id) === S(o.site_id)));
    const st = (r) => S(r.status).toLowerCase();
    // FX-LINKS (review R2 M3, 2026-11-18): the client's LATEST decision on a domain wins, whichever row holds it (the market-less row of
    // "Not a competitor" on AI visibility, or a market row of the Competitors page). Site Admin now writes every row of the domain at once;
    // this keeps rows written before that consistent too. A domain with no decision of the client keeps the old rule.
    const at = (r) => { const t = Date.parse(S(r.updated_at)); return Number.isFinite(t) ? t : 0; };
    const latest = new Map();
    for (const r of rows) { if (S(r.status_by) !== 'user' || !['chosen', 'watch', 'dismissed', 'not_competitor'].includes(st(r))) continue;
      const d = host(r.comp_domain); const was = latest.get(d); const offR = ['dismissed', 'not_competitor'].includes(st(r));
      if (!was || at(r) > at(was) || (at(r) === at(was) && offR && !['dismissed', 'not_competitor'].includes(st(was)))) latest.set(d, r); }   // same time (or none): "not a competitor" wins, as before
    const decided = (d) => latest.has(d) ? st(latest.get(d)) : '';
    const chosen = [...new Set(rows.filter(r => st(r) === 'chosen').map(r => host(r.comp_domain)))].filter(d => !decided(d) || decided(d) === 'chosen');
    const offOf = (d) => decided(d) ? ['dismissed', 'not_competitor'].includes(decided(d)) : rows.some(r => host(r.comp_domain) === d && st(r) === 'not_competitor');
    const off = new Set([...listOfH(o.not_competitors), ...[...new Set(rows.map(r => host(r.comp_domain)))].filter(offOf)]);   // the undated list (seo_monitors.not_competitors) has no time to compare: it stays off, as before
    const declared = listOfH(o.declared);
    const list = []; for (const d of [...declared, ...chosen]) { if (!d || (own && sameOrSub(d, own)) || off.has(d) || [...off].some(x => reg(x) === reg(d)) || list.includes(d)) continue; list.push(d); }
    return { list: list.slice(0, max), chosen, declared, removed: [...off] };
  };
  return { kindOf, kindOfHost, kindOfResult, govSignal, select, weight, host, reg, LABEL, role, isCompetitor, oneList, partnerDirectory, listPage, principalHosts, ROLES, ROLE_WORDS, LEFT_OUT, ROLE_LISTS, PRINCIPALS, KI_ROLE, SOFT_CAT };
})();
// CR17-F (2026-11-17, section 196): the one role classifier (CMP.role, v5/code/_competitors.js) comes with this kit; the build inlines it once per node.
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
  // CR17-F: a host whose ONE role (CMP.role) is not `competitor` is never a rival or a provider of your category; NOT_RIVAL stays the floor
  const roleCtx = (c) => ({ own_domain: c.own || c.own_domain || '', services: [...(c.services || []), ...(c.terms || [])], topics: c.topics || [], principals: c.principals || [], not_competitors: c.not_competitors || [], declared: c.declared_ctx || [] });
  const nonCompetitor = (d, c) => typeof CMP === 'object' && CMP && CMP.role ? CMP.role(d, roleCtx(c || {})).role !== 'competitor' : false;
  const NOT_RIVAL_HOST = (d, c) => NOT_RIVAL.test(reg(d)) || NOT_RIVAL.test(norm(d)) || nonCompetitor(d, c);
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
    if (c.domain && NOT_RIVAL_HOST(c.domain, c)) return '';   // a platform, an official body, a news site, a directory or a consultancy is never a provider of your category
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
    // CR17-F: a directory, a platform, a software maker, an authority or the platform you build on is never a rival, however it was met
    const biz = (d) => !nonCompetitor(d && typeof d === 'object' ? (d.domain || d.host) : d, c);
    for (const d of (c.ai || [])) if (biz(d)) add(d, 'business', 'a business AI recommends instead of you');
    for (const d of (c.serp || [])) if (biz(d)) add(d, 'serp', 'a site that outranks you for one of your own keywords');
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
    const add = (d, why) => { const x = reg(d); if (!x || !/\./.test(x) || x === own || NOT_RIVAL.test(x) || nonCompetitor(x, c) || out.has(x)) return; out.set(x, { domain: x, why }); };   // CR17-F: CMP.role, with the client's services and its not-a-competitor list
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
  // CR17-F (2026-11-17, client report C5, section 196): a link prospect found through an AI question keeps that question's topic after the panel
  // retired it (AI-FOCUS retired devaicon's 12 Open edX questions on 2026-10-27; 25 of its 54 prospects still came from them). RV.retiredSource
  // (prospect, prompts) -> the retired question it came from, or null: its question (the quoted text of `detail`, "for \"...\"") or its topics
  // ("about a, b") match stored questions, and every one of them is retired. A prospect already pitched, replied or won is never retired.
  const PITCHED = /^(contacted|replied|won|sent|followup|follow_up|in_progress|approved|scheduled)$/;
  const retiredSource = (pr, prompts) => {
    const r = pr || {}; if (S(r.retired_at) || PITCHED.test(S(r.status).toLowerCase()) || S(r.contacted_at)) return null;
    const lo = (x) => S(x).toLowerCase().replace(/\s+/g, ' ').trim();
    const det = S(r.detail); const q = lo((det.match(/for "([^"]{12,})"/) || [])[1] || '');
    const about = lo((det.match(/\babout ([^—"]+?)(?: — |$)/) || [])[1] || '').split(/\s*,\s*/).filter(x => x.length >= 3);
    const mine = (prompts || []).filter(x => x && S(x.site_id) === S(r.site_id) && S(x.prompt));
    const hits = mine.filter(x => (q && lo(x.prompt).startsWith(q.replace(/\s*$/, ''))) || (about.length && about.some(t => t === lo(x.keyword) || t === lo(x.topic))));
    if (!hits.length || hits.some(x => S(x.status || 'active') !== 'retired')) return null;
    return hits.sort((a, b) => S(b.retired_at).localeCompare(S(a.retired_at)))[0];
  };
  return { set, providerOf, storefront, menuOf, families, reg, aiRivals, marketMedia, ROUNDUP, FAMILIES, NOT_RIVAL, nonCompetitor, retiredSource };
})();
const OK = (() => {
  const STOP = new Set('a an and are as at be but by for from has have how i in into is it its of on or our that the their this to was what when where which who why will with you your best top guide vs new more most about all can do does get here how'.split(' '));
  const words = (s) => String(s || '').toLowerCase().replace(/&[a-z]+;/g, ' ').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').split(' ').filter(w => w.length > 2 && !STOP.has(w));
  const stem = (w) => w.length > 5 ? w.replace(/(ingly|ings|ing|ments|ment|ations|ation|ions|ion|ies|ers|er|ed|es|s|e)$/, '') : w;   // invoice / invoices / invoicing → invoic (S30: a 5-letter prefix matched consultancy ~ consumer)
  // shared distinctive words, weighted by how rare each word is among the site's own pages (a site's topic words appear everywhere: IDF)
  function fit(a, b, df, nDocs) {
    const A = new Set(words(a).map(stem)), B = new Set(words(b).map(stem)); if (!A.size || !B.size) return 0;
    let num = 0, den = 0; const w = (t) => Math.log(1 + (nDocs || 1) / (1 + ((df && df.get(t)) || 0)));
    for (const t of B) { den += w(t); if (A.has(t)) num += w(t); }
    return den ? Math.round(100 * num / den) / 100 : 0;
  }
  // contacts on a page: who to write to, best first (a named person or the author on their own domain, then editorial, then general)
  const ROLE = { editorial: /^(editor|editors|editorial|news|newsroom|press|media|pr|content|stories|tips|submissions?|contribute|features)@/, general: /^(info|hello|hi|contact|team|office|enquir(y|ies)|inquir(y|ies)|admin|marketing|partnerships?|partner|sales|business|support|help)@/ };
  const BAD = /^(no-?reply|donotreply|privacy|abuse|postmaster|webmaster|dpo|legal|gdpr|unsubscribe|jobs|careers|hr|recruit(ing|ment)?|billing|invoices?|accounts?payable|security|noc)@/;
  const kindOf = (e) => ROLE.editorial.test(e) ? 'editorial' : ROLE.general.test(e) ? 'general' : /^[a-z]+([._-][a-z]+)?@/.test(e) ? 'person' : 'other';
  function contactsIn(html, domain, url) {
    const out = []; const seen = new Set(); const add = (e, w, src) => { const x = String(e || '').toLowerCase().trim(); if (seen.has(x) || BAD.test(x)) return; seen.add(x); out.push({ email: x, kind: kindOf(x), own: LK.sameSite(x.split('@')[1], domain), w, source_url: src }); };
    for (const e of LK.emailsIn(html, domain)) add(e, 1, url);
    return out; }
  // only addresses on the prospect's own domain: a page often lists other companies' addresses (live 2026-10-11: an address on a provider's
  // own site was stored as the Ministry of Finance's contact, because the Ministry's provider list names that provider)
  const rankContacts = (list) => [...list].filter(c => c.own).sort((a, b) => (b.own - a.own) || ({ person: 3, editorial: 2, general: 1, other: 0 }[b.kind] - { person: 3, editorial: 2, general: 1, other: 0 }[a.kind]) || (b.w - a.w)).slice(0, 3);
  // the author's page and the contact form of a prospect page
  function authorUrl(html, base) {
    const h = String(html || ''); let u = '';
    const rel = h.match(/<a\b[^>]*\brel\s*=\s*["'][^"']*\bauthor\b[^"']*["'][^>]*>/i); if (rel) u = LK.attr(rel[0], 'href') || '';
    if (!u) { const m = h.match(/"author"\s*:\s*(?:\[\s*)?\{[^{}]*?"url"\s*:\s*"([^"]+)"/i); if (m) u = m[1]; }
    if (!u) { const m = h.match(/<a\b[^>]*href\s*=\s*["']([^"']*\/(?:author|authors|writer|team|people|profile)\/[^"'#?]+)["']/i); if (m) u = m[1]; }
    if (!u) return ''; if (/^\/\//.test(u)) u = 'https:' + u; else if (/^\//.test(u)) u = String(base || '').replace(/^(https?:\/\/[^\/]+).*$/i, '$1') + u;
    return /^https?:\/\//i.test(u) ? u.slice(0, 300) : ''; }
  const OFF_TOPIC = 0.25;   // gap / competitor / resource / broken prospects below this topic match are not pitched (live 2026-10-11: Navan, Stripe, WEF from the Common Crawl gap)
  const contactForm = (html, url) => /<form\b[\s\S]{0,4000}?<textarea\b/i.test(String(html || '')) && /contact|enquir|inquir|get-in-touch|reach|write-for-us|contribute/i.test(String(url || '')) ? url : '';
  // signs a site sells links or is a link farm (Google: "sites used for the purpose of passing outgoing links"; research 2026-10-10)
  function sellSignals(html, facts) {
    const t = LK.text(html).toLowerCase().slice(0, 60000); const r = [];
    if (/(sponsored|guest) post[^.]{0,80}(\$|usd|eur|£|price|pricing|rate card|fee)|(\$|usd)\s?\d+[^.]{0,40}(per|a) (post|article|link)|dofollow (link|backlink)s? (guaranteed|included)|buy (a )?(guest post|backlink)|link insertion/.test(t)) r.push('sells posts or links');
    // LIVE1 (2026-11-07): read without the choices of a form's drop-down (<select>): code-brew.ae, a software firm, was refused as gambling
    // because its quote form's "Industry" list offers "Fantasy & Betting"; the options a form offers are not what the page is about
    const tg = /<select\b/i.test(String(html || '')) ? LK.text(String(html).replace(/<select\b[\s\S]*?<\/select>/gi, ' ')).toLowerCase().slice(0, 60000) : t;
    if (/\b(casino|betting|sportsbook|cbd oil|essay writing|payday loan|escort|replica watches)\b/.test(tg)) r.push('gambling / CBD / essay-mill topics');
    if (facts && facts.outbound_domains > 150) r.push(facts.outbound_domains + ' different sites linked from one page');
    if (/(write for us|guest post|sponsored post|contribute)[^.]{0,150}(\$\s?\d|usd\s?\d|€\s?\d|£\s?\d|\bfee\b|\bpaid\b|\bpricing\b)|(\$\s?\d+|\bfee\b)[^.]{0,80}(guest post|sponsored post|write for us)/.test(t)) r.push('paid guest posts');   // a price next to the offer (S30: "with prices and setup time" on an ordinary list page)
    return r; }
  // the recipient's country from the top-level domain (else the site's own market) — for the consent rules the app applies
  const CC = { de: 'DE', at: 'AT', ch: 'CH', fr: 'FR', uk: 'GB', ie: 'IE', es: 'ES', it: 'IT', nl: 'NL', be: 'BE', se: 'SE', no: 'NO', dk: 'DK', fi: 'FI', pl: 'PL', pt: 'PT', cz: 'CZ', gr: 'GR', ro: 'RO', hu: 'HU',
    ae: 'AE', sa: 'SA', qa: 'QA', kw: 'KW', bh: 'BH', om: 'OM', eg: 'EG', jo: 'JO', in: 'IN', pk: 'PK', sg: 'SG', my: 'MY', au: 'AU', nz: 'NZ', ca: 'CA', us: 'US', za: 'ZA', ng: 'NG', ke: 'KE', br: 'BR', mx: 'MX', jp: 'JP', cn: 'CN', tr: 'TR' };
  const countryOf = (domain) => { const d = String(domain || '').toLowerCase(); const m = d.match(/\.([a-z]{2})$/); return m && CC[m[1]] ? CC[m[1]] : ''; };
  // our page to point to and the link text to ask for (LINK_BUILDER_SPEC.md §5). pages: [{ url, title, keyword, kind, page_type, position,
  // rds, kw_share, pitched }] (kind: home | hub | guide | answer | article | case | money); p: the prospect { type, text, dead_text, to_url }
  const HOME_TYPES = new Set(['mention', 'list', 'listing', 'press', 'digest', 'podcast', 'ai_list']);   // L5: an answer in the press and a guest appearance name the business, so they point at the homepage
  // CR17-E (client report 2026-11-17, C4; build section 195): the link text is REAL text, never a kind. Live every card read "Link text: Your
  // brand name" (a label for the kind `brand`) although "Devaicon" was on file. Brand = the business name; title = our page's own title
  // without the brand suffixes ("Open edX Services | Devaicon" -> "Open edX Services"); url = the bare address. Never a search keyword.
  const normName = (s) => String(s || '').toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9&]+/g, '');
  function stripBrand(title, brand, domain) {
    const segs = String(title || '').replace(/\s+/g, ' ').trim().split(/\s+[|–—-]\s+|\s*\|\s*/).map(x => x.trim()).filter(Boolean);
    const b = normName(brand), lab = normName(String(domain || '').replace(/^www\./, '').split('.')[0]);
    const keep = segs.filter(x => { const n = normName(x); return n && n !== b && n !== lab && n !== normName(domain); });
    return (keep[0] || '').slice(0, 90);
  }
  const bareUrl = (u) => String(u || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  // -> { kind: brand | title | url | as before, text }: the text an editor would write anyway (Google's link spam policy names optimised
  // anchor text in requested links); with no title on record the brand stands in, with no brand on file the bare address does
  function anchorText(kind, page, brand, domain) {
    const k = String(kind || 'brand');
    if (k === 'as before') return { kind: k, text: '' };
    if (k === 'url') return { kind: 'url', text: bareUrl((page && page.url) || '') || bareUrl(domain) };
    if (k === 'title') { const t = stripBrand(page && page.title, brand, domain); if (t) return { kind: 'title', text: t }; }
    const b = String(brand || '').trim();
    return b && normName(b) !== normName(domain) ? { kind: 'brand', text: b.slice(0, 80) } : { kind: 'url', text: bareUrl((page && page.url) || '') || bareUrl(domain) };
  }
  // an editorial "top / best X companies" article (an ai_source or list page) asks for the page that sells X; a directory profile, a mention
  // or a journalist answer names the business (the homepage)
  const EDITORIAL_LIST = /\b(top\s*\d+|top ten|best|leading|companies|firms|agencies|providers|vendors|alternatives?|vs\.?|versus|compar(?:e|ed|ison))\b/i;
  const NO_PAGE = 'no_matching_page';
  // a page of ours aimed at ANOTHER market than their page (a Pakistan list pitched our UAE page): half the score
  const PLACES = /\b(uae|u\.a\.e|dubai|abu dhabi|sharjah|emirates|pakistan|lahore|karachi|islamabad|saudi|ksa|riyadh|jeddah|qatar|doha|kuwait|bahrain|oman|egypt|cairo|india|uk|london|usa|canada|australia|singapore|gcc)\b/gi;
  const placesOf = (t) => new Set((String(t || '').toLowerCase().match(PLACES) || []).map(x => x.replace(/\./g, '')));
  const otherMarket = (probe, x) => { const a = placesOf(probe), b = placesOf([x.title, String(x.url || '').replace(/[\/_.-]+/g, ' ')].join(' ')); return a.size > 0 && b.size > 0 && ![...b].some(w => a.has(w)); };
  function pickTarget(p, pages, df, nDocs, home, brand, domain) {
    const done = (r) => { const pg = r.url ? (pages.find(x => x.url === r.url) || { url: r.url, title: r.title || '' }) : null; const a = r.url ? anchorText(r.anchor, pg, brand, domain || '') : { kind: '', text: '' }; return { ...r, anchor: a.kind || r.anchor, anchor_text: a.text }; };
    if (p.type === 'lost' && p.to_url) return done({ url: p.to_url, reason: 'the page it used to link to', anchor: 'as before', fit: 1 });
    const inner = (pages || []).filter(x => x.url && x.kind !== 'home');
    const fitOf = (probe, x) => fit(probe, [x.title, x.keyword, String(x.url || '').replace(/^https?:\/\/[^\/]+/, '').replace(/[\/_.-]+/g, ' ')].join(' '), df, nDocs);   // the URL's words too: titles come from Search Console queries (live 2026-10-11)
    if ((p.type === 'list' || p.type === 'ai_list') && EDITORIAL_LIST.test(String(p.text || ''))) {
      const best = inner.filter(x => (x.kind === 'money' || x.kind === 'service') && !otherMarket(p.text, x)).map(x => ({ x, f: fitOf(p.text, x) })).filter(s => s.f >= 0.4).sort((a, b) => b.f - a.f)[0];
      if (best) return done({ url: best.x.url, reason: 'their article lists providers of what this page sells (topic match ' + Math.round(best.f * 100) + '%)', anchor: 'brand', fit: best.f, title: best.x.title });
    }
    if (HOME_TYPES.has(p.type)) return done({ url: home, reason: p.type === 'list' || p.type === 'ai_list' ? 'lists link to the homepage' : 'a mention or a listing names the business: the homepage', anchor: 'brand', fit: 1 });
    const probe = p.type === 'broken' ? (p.dead_text || p.text) : ['gap', 'comp_new'].includes(p.type) ? p.text + ' ' + (p.topics || '') : p.text;   // they link to competitors for OUR topics: aim at our page on them
    const scored = inner.map(x => {
      const f = fit(probe, [x.title, x.keyword, String(x.url || '').replace(/^https?:\/\/[^\/]+/, '').replace(/[\/_.-]+/g, ' ')].join(' '), df, nDocs);   // the URL's words too: titles come from Search Console queries (live 2026-10-11)
      const pos = Number(x.position) || 0; const band = pos >= 4 && pos <= 15 ? 1 : pos >= 16 && pos <= 30 ? 0.6 : pos >= 1 && pos <= 3 ? 0.3 : 0.4;
      const rds = Number(x.rds) || 0; const need = rds === 0 ? 1 : rds <= 5 ? 0.9 : rds <= 20 ? 0.7 : 0.5;
      const type = x.kind === 'money' ? 0.6 : 1;   // publishers link to guides; the guide links on to the service page
      const paced = (Number(x.pitched) || 0) >= (rds < 20 ? 4 : Math.max(4, Math.round(rds * 0.2)));
      return { x, f, score: paced ? 0 : f * band * need * type * (otherMarket(probe, x) ? 0.5 : 1), band, pos, rds, paced };
    }).filter(s => s.f >= 0.2 && s.score > 0).sort((a, b) => b.score - a.score);
    if (!scored.length) {
      // CR17-E: no silent homepage. Live 7 of devaicon's 20 open pitches went to the homepage "because no page matched" (an "Open edX vs
      // Moodle" article while /capabilities/open-edx-services exists). The homepage stays only when it really is about their topic.
      const hp = (pages || []).find(x => x.kind === 'home') || { url: home, title: '' };
      const hf = fit(probe, [hp.title, brand, ...(pages || []).filter(x => x.kind === 'home').map(x => x.keyword)].join(' '), df, nDocs);
      if (hf >= 0.4) return done({ url: home, reason: 'your homepage is about their topic (topic match ' + Math.round(hf * 100) + '%)', anchor: 'brand', fit: hf });
      const topic = String(probe || '').replace(/\s+/g, ' ').trim().slice(0, 70);
      return { url: '', hold: NO_PAGE, reason: 'no page of yours covers their topic' + (topic ? ' ("' + topic + '")' : '') + ': publish one first, then this pitch can go out', anchor: '', anchor_text: '', fit: 0 };
    }
    const s = scored[0]; const why = [s.pos >= 4 && s.pos <= 15 ? 'ranks #' + s.pos + ' (close to the top)' : s.pos ? 'ranks #' + s.pos : 'not ranking yet', s.rds ? s.rds + ' linking sites' : 'no links yet', 'topic match ' + Math.round(s.f * 100) + '%'];
    return done({ url: s.x.url, reason: why.join(' · '), anchor: (Number(s.x.kw_share) || 0) > 0.15 ? 'brand' : 'title', fit: s.f, title: s.x.title });
  }
  // government sites list providers through accreditation or an application, never through a pitch (the listings checklist covers them).
  // CR17-E (195): the fit gate's own government list (v5/code/_fit_gate.js fitGovHost; build section 195 asserts these four patterns are
  // the fit gate's, character for character). This kit had a shorter rule of its own, so u.ae (the UAE government portal) was a pitch.
  const GOV_RE = [/(^|\.)gov(\.[a-z]{2,3})?$/, /(^|\.)(gouv|gob|go|gv)\.[a-z]{2}$/, /(^|\.)mil(\.[a-z]{2})?$/, /(^|\.)(u\.ae|government\.ae|dubai\.ae|abudhabi\.ae|sharjah\.ae|ajman\.ae|rak\.ae|tax\.gov\.ae|europa\.eu)$/];
  const isGov = (d) => { const h = String(d || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^(www|m|app|en|ar)\./, '');
    return GOV_RE.some(re => re.test(h)) || /(^|\.)govt(\.[a-z]{2})?$/.test(h); };
  // ---- who is never worth a pitch (D13, live 2026-10-11) ----
  // a mailbox provider, a generated contact / company database, a CDN or a statistics page: they turn up in link data as hosts, but there is
  // nobody there who could add a link (outlook.com and zoominfo.com were listed as broken-link prospects)
  const MAILHOST = /^(gmail\.com|googlemail\.com|outlook\.[a-z.]{2,6}|hotmail\.[a-z.]{2,6}|live\.[a-z.]{2,6}|msn\.com|yahoo\.[a-z.]{2,6}|ymail\.com|aol\.com|icloud\.com|me\.com|gmx\.[a-z.]{2,5}|web\.de|mail\.(com|ru)|email\.com|protonmail\.com|proton\.me|tutanota\.com|yandex\.[a-z.]{2,5}|fastmail\.com|rediffmail\.com|qq\.com|naver\.com|163\.com|office\.com|office365\.com|microsoftonline\.com|sharepoint\.com|mimecast\.com)$/i;
  const DATABROKER = /^(zoominfo\.[a-z.]+|apollo\.io|lusha\.com|rocketreach\.co|signalhire\.com|leadiq\.com|cognism\.com|seamless\.ai|hunter\.io|snov\.io|clearbit\.com|uplead\.com|datanyze\.com|contactout\.com|anymailfinder\.com|skrapp\.io|getprospect\.com|kaspr\.io|lead411\.com|slintel\.com|6sense\.com|owler\.com|dnb\.com|bizapedia\.com|opencorporates\.com|zaubacorp\.com|tofler\.in|signal\.ai)$/i;
  function badHost(domain) {
    const d = String(domain || '').toLowerCase().trim().replace(/^www\./, '');
    if (!d || !/\./.test(d)) return '';
    if (MAILHOST.test(d)) return 'a mailbox provider (' + d + '), not a website whose editor could add a link';
    if (DATABROKER.test(d)) return 'a contact / company database (' + d + '): its pages are generated, nobody there edits them';
    if (LK.isInfra(d)) return 'infrastructure (' + d + ': a CDN, a hosting platform or a link shortener), not a site to write to';
    if (LK.isScraper(d)) return 'an automatically generated statistics page (' + d + '), not a site to write to';
    if (LK.isJobBoard(d, '')) return 'a job board (' + d + '): its pages are job listings, nobody there adds a link';   // CR17-E: bebee.com was drafted a pitch
    return '';
  }
  // a bare homepage is no place for a link to add: only a listing, a list, a mention or a journalist request is pitched on the front page
  const HOME_OK = new Set(['mention', 'list', 'listing', 'ai_list', 'press', 'digest', 'podcast', 'lost', 'reclaim']);   // L5: a show's front page is where its contact and its guest invitation live
  const isHomeUrl = (u) => /^https?:\/\/[^\/?#]+\/?([?#]|$)/i.test(String(u || ''));
  const homepageOnly = (type, url) => (isHomeUrl(url) && !HOME_OK.has(String(type || '')))
    ? 'only their homepage was found: a front page has no section a link could be added to (find the page on your topic first)' : '';
  // "accredited / pre-approved / certified provider" lists: a business gets on them by applying with the accreditation, never by a pitch —
  // and asking to be added without it claims something we cannot stand behind (live 2026-10-11: two ASP lists were asked to add Tech&)
  const ACCRED_RE = /\b(accredited|accreditation|pre-?approved|approved|certified|licen[cs]ed|authori[sz]ed|registered)\b[^.\n]{0,40}\b(service providers?|providers?|asps?|partners?|vendors?|suppliers?|list|lists|directory|register|registry)\b|\b(service providers?|providers?|asps?|partners?|vendors?)\b[^.\n]{0,25}\b(accredited|pre-?approved|approved|certified|licen[cs]ed)\b/i;
  const accreditedList = (text) => ACCRED_RE.test(String(text || ''));
  // the facts on file say the business itself holds an accreditation ("none" / "not accredited" / "applying" do not)
  const accredited = (fact) => { const f = String(fact || '').trim(); if (!f) return false;
    if (/^(no\b|none|not\b|non-|never|pending|in progress|planned|applying|applied|n\/?a|unknown|tbc|tbd)/i.test(f)) return false;
    return /accredit|certif|licen|authoris|authoriz|approved|peppol|iso ?\d|registered|member/i.test(f); };
  // a prospect that sells what we sell: a declared competitor, or their own page offering our services with the signals of a vendor selling
  // them. A publisher writing about our topic has the words but not the signals; a list that leaves us out, a mention or a journalist
  // request is still pitched when the publisher also sells something (the ask there is "add us", not "link to us").
  const VENDOR_RE = /(book|schedule|request)(?: a| your)? (?:demo|call|consultation)|free trial|start (?:for )?free|talk to (?:sales|an expert|our advisor)|our (?:software|platform|product|products|solution|solutions|services|suite)|request (?:a )?quote|why choose us|our (?:clients|customers) (?:include|trust)|pricing plans?|per user ?\/ ?month|we (?:provide|offer|deliver|implement|build) /gi;
  const SELL_EXEMPT = new Set(['list', 'listing', 'ai_list', 'mention', 'press', 'digest', 'podcast', 'lost', 'reclaim']);   // L5: a journalist request and a podcast that takes guests are asked "will you cover us", not "link to us" — the declared-competitor check above still runs
  const THEIRS_RE = /\b(solutions?|services?|software|platform|suite|provider|providers|consultan\w+|implementation|company)\b/i;
  // R4 (2026-10-13, re-rating): the gate only read the prospect's page, so a competitor's *guide* passed. Live, flick.network was a `ready`
  // resource prospect with a drafted sequence while the same run's Rank Tracker had just found it at #1 for the ladder head "e invoicing in
  // uae", and basware.com (an AP / e-invoicing vendor) reached `needs_contact`. The refusal now matches the prospect's REGISTRABLE domain
  // against the declared competitors (seo_monitors.competitors) and the SERP competitors the ladder / verdict measured, and says which it was.
  // A list page ("best X", a directory, a mention, a journalist request) stays pitchable even on a rival's domain: the ask there is "add us to
  // your list", which is legitimate; pitching their guide or resource page is not.
  const LIST_TYPES = new Set(['list', 'listing', 'ai_list', 'mention', 'press']);
  const domOf = (c) => String((c && typeof c === 'object' ? (c.domain || c.d || c.host) : c) || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '').replace(/\.$/, '');
  // R21 (2026-10-14, the second re-rating): three prospects that sell exactly what the owner sells reached `ready`, two of them as drafted
  // pitches waiting for the owner. `ae.invoiceq.com` had been recorded ABOVE techand.ai for "peppol uae" on two days, yet `invoiceq.com`
  // was pitched for a brand link to the home page: the stored SERP host was matched as it stands, so a rival on a SUBDOMAIN was a
  // different site. Every host on both sides is now reduced to its registrable domain before it is matched (the host the rank check
  // really saw is quoted in the reason), and a prospect whose own page sells our service is refused on that evidence alone - whether or
  // not it is on the declared list and whether or not the rank checks happened to see it.
  const rivalEntry = (c, label) => {
    const x = domOf(c); if (!x) return null;
    const o = (c && typeof c === 'object') ? c : {};
    const pos = Number(o.position || o.p) || 0; const kw = String(o.keyword || '').slice(0, 60);
    const reg = LK.regDomain(x) || x;
    const seen = String(o.host || '').toLowerCase().replace(/^www\./, '').replace(/\.$/, '') || x;   // the host the rank check really showed
    const where = ((seen !== reg ? seen + ' ranks ' : '') + (pos ? '#' + pos : '') + (kw ? ' for "' + kw + '"' : '')).trim();
    return { domain: reg, host: seen, why: label + ((pos || seen !== reg) ? ' (' + where + ')' : '') };
  };
  // C-2 / C-8 (re-rating 2026-10-17): the one rival set (RV, v5/code/_rivals.js) - a declared competitor or a business AI recommends
  // instead of you (`ai_rivals`: the Answer Analyst's aliases and the stored AI-visibility rivals) is a BUSINESS rival; a site that only
  // outranks you is a SERP rival. `kind` says which, because only a SERP rival's "best X" list stays pitchable.
  function rivalOf(o) {
    const d = String(o.domain || '').toLowerCase().replace(/^www\./, ''); const dr = LK.regDomain(d);
    // LIVE1 (2026-11-07): a social or professional network is never a competitor (linkedin.com, where any author posts, was refused as "a site
    // that outranks you" because a LinkedIn article ranked #3 for one of the client's keywords); what its pages say is judged by the other rules
    if (d && LK.domainKind(d) === 'social') return null;
    // CR17-F (2026-11-17, client report C5, section 196): only a COMPETITOR (CMP.role, the one classifier) is a rival. clutch.co, edx.org,
    // github.com, brandmentions.pk's agency list, openedx.org and Microsoft (for a Microsoft partner) outranked the client or were named by
    // AI, and were left out as "a competing site of yours". What they really are is said by competitorCheck below.
    if (d && !isRivalRole(o, d)) return null;
    const hit = (list, label, kind) => {
      for (const c of (list || [])) { const x = domOf(c); if (!x || !d) continue;
        if (LK.sameSite(d, x) || LK.sameSite(x, d) || (dr && dr === LK.regDomain(x))) { const e = rivalEntry(c, (c && typeof c === 'object' && c.why) || label); return e ? { ...e, kind } : null; }
      }
      return null;
    };
    return hit(o.competitors, 'a competitor of yours', 'business') || hit(o.ai_rivals, 'a business AI recommends instead of you', 'business')
      || hit(o.serp_rivals, 'a site that outranks you for one of your own keywords', 'serp');
  }
  // a rival's "best X" list is still fair game - but only when the page really IS such a list. A mention, a resource page or the rival's
  // own front page is not: "add us to your list" has somewhere to go, "link to our guide" has not.
  const ROUNDUP_RE = /\b(best|top\s*\d+|top ten|alternatives?|round-?up|shortlist|directory|listing|list of|compar(?:e|ed|ison)|vs)\b/i;
  const isRoundup = (o) => ROUNDUP_RE.test(String(o.title || '')) || ROUNDUP_RE.test(String(o.url || o.page_url || '').replace(/[\/_?.&=-]+/g, ' '))
    || (typeof CMP === 'object' && !!CMP && !!CMP.listPage && CMP.listPage(o.title, o.url || o.page_url));   // CR17-F: "AI / Automation Agencies in Pakistan", /agencies/...
  // ---- R86 (2026-10-16, re-rating defect C-10): the competitor test judged only the prospect PAGE. daxin-global.ae (whose own pages
  // sell Odoo, Dynamics 365, Business Central and e-invoicing in Dubai) and qzinfomatics.com ("Microsoft Dynamics 365 Partner in Dubai")
  // reached `ready` because their blog article named too few of the customer's 30 services to reach the 45% bar — a bar over a
  // 30-service list is the problem, not its value. The SITE is now judged too, on the pages the run already fetched for contacts
  // (about / contact / home): a business whose own pages offer at least SITE_MIN_SERVICES of our services — each service matched by
  // all of its words, single-word services left out because one word ("builder", "finance") proves nothing — with the signals of a
  // vendor selling them, in our market (the country named, or its domain ending), is a competing provider whatever its article is.
  const SITE_MIN_SERVICES = 2, SITE_MIN_SIGNALS = 2;
  const SITE_EXEMPT = new Set(['lost', 'reclaim', 'digest', 'podcast']);   // a lost link, a journalist request, a show: the ask is not "link to our page"
  const MARKET = { AE: ['uae', 'u\\.a\\.e', 'dubai', 'abu dhabi', 'sharjah', 'ajman', 'united arab emirates', 'emirates'], SA: ['ksa', 'saudi', 'riyadh', 'jeddah', 'dammam'], QA: ['qatar', 'doha'],
    KW: ['kuwait'], BH: ['bahrain', 'manama'], OM: ['oman', 'muscat'], EG: ['egypt', 'cairo'], GB: ['uk', 'united kingdom', 'london', 'england'], US: ['usa', 'united states'], IN: ['india'], PK: ['pakistan'],
    SG: ['singapore'], AU: ['australia'], CA: ['canada'], DE: ['germany', 'deutschland'] };
  const TLD_OF = Object.fromEntries(Object.entries(CC).map(([k, v]) => [v, k]));
  const marketRe = (o) => { const iso = String(o.country_iso || '').toUpperCase(); const words = [...(MARKET[iso] || []), ...(o.country ? [String(o.country).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')] : [])];
    return words.length ? new RegExp('(^|[^a-z])(' + words.join('|') + ')($|[^a-z])', 'i') : null; };
  function siteOffer(o) {
    const text = String(o.site_text || '').slice(0, 60000); if (text.length < 200) return null;
    const T = new Set(words(text).map(stem));
    const offered = []; const seen = new Set();
    for (const sv of (o.terms || [])) { const st = [...new Set(words(sv).map(stem))]; const key = st.slice().sort().join(' ');
      if (st.length < 2 || seen.has(key)) continue; seen.add(key); if (st.every(w => T.has(w))) offered.push(String(sv)); }
    const signals = [...new Set((text.match(VENDOR_RE) || []).map(x => x.toLowerCase().replace(/\s+/g, ' ').trim()))];
    const re = marketRe(o); const iso = String(o.country_iso || '').toUpperCase(); const d = String(o.domain || '').toLowerCase();
    const local = !re ? true : re.test(text) || (TLD_OF[iso] ? d.endsWith('.' + TLD_OF[iso]) : false);
    return { offered, signals, local, pages: (o.site_pages || []).slice(0, 3) };
  }
  // CR17-F: the one role of a prospect's site, with the client's own services (the platform it builds on) and choices
  const roleCtxOf = (o) => ({ services: [...(o.terms || []), ...(o.services || [])], topics: o.topics || [], declared: (o.competitors || []).map(domOf).filter(Boolean),
    not_competitors: o.not_competitors || [], principals: o.principals || [], url: o.url || o.page_url || '' });
  const roleOfSite = (o, d) => (typeof CMP === 'object' && CMP && CMP.role) ? CMP.role(d, roleCtxOf(o)) : null;
  const isRivalRole = (o, d) => { const r = roleOfSite(o, d); return !r || r.role === 'competitor'; };
  /** OK.competitorCheck(o) -> { code, role, reason }: why the competitor gate leaves a prospect out ('' when it does not). `code` is one of
   *  CMP.LEFT_OUT's keys (competitor, competitor_list, listing, your_platform, software), stored by the Link Builder as reason_code; `reason` is
   *  the sentence sellsSame always returned (a competitor's wording is unchanged). */
  function competitorCheck(o) {
    const type = String(o.type || '');
    const d = String(o.domain || '').toLowerCase().replace(/^www\./, '');
    const r = d ? roleOfSite(o, d) : null;
    const LO = (typeof CMP === 'object' && CMP && CMP.LEFT_OUT) || {};
    // a directory, the partner directory of the platform you build on, that platform's maker or a software maker: never "a competing site";
    // a list, a mention, a journalist request, a show or a lost link on them is still asked (the ask there is "add us" / "put it back")
    if (r && !SELL_EXEMPT.has(type)) {
      const pd = typeof CMP === 'object' && CMP.partnerDirectory && CMP.partnerDirectory(o.url || o.page_url || '');
      if (r.role === 'listing' || (pd && ['your_platform', 'software'].includes(r.role))) return { code: 'listing', role: r.role, reason: LO.listing || 'a directory: add yourself to it instead' };
      if (r.role === 'your_platform') return { code: 'your_platform', role: r.role, reason: LO.your_platform || 'the platform you work with, not a competitor' };
      if (r.role === 'software') return { code: 'software', role: r.role, reason: LO.software || 'a software maker, not a competitor' };
    }
    // a platform, a publisher, an authority or a site the client marked not a competitor: the other rules judge its page, never this one
    if (r && r.role !== 'competitor') return { code: '', role: r.role, reason: '' };
    const why = sellsSameBiz(o);
    return { code: why ? (/its own list ranks itself/.test(why) ? 'competitor_list' : 'competitor') : '', role: r ? r.role : '', reason: why };
  }
  function sellsSame(o) { return competitorCheck(o).reason; }
  function sellsSameBiz(o) {
    const type = String(o.type || '');
    const rival = rivalOf(o);
    // a SERP rival's "best X" list is fair game (a publisher that outranks you); a business rival's own list is not - it ranks itself first
    // and does not add a competitor (C-2: flick.network, named by AI instead of you, was pitched "ask the editor to add you to this list")
    if (rival && rival.kind === 'serp' && (LIST_TYPES.has(type) || type === 'ai_source') && isRoundup(o)) return '';
    if (rival) return 'a competing site of yours (' + rival.domain + '): ' + rival.why + (rival.kind === 'business' && isRoundup(o) ? ', and its own list ranks itself, not you' : ', and a competitor does not link to your page');
    const site = (SITE_EXEMPT.has(type) || (LIST_TYPES.has(type) && isRoundup(o))) ? null : siteOffer(o);
    if (site && site.offered.length >= SITE_MIN_SERVICES && site.signals.length >= SITE_MIN_SIGNALS && site.local)
      return 'a competing provider: their own site' + (site.pages.length ? ' (' + site.pages.join(', ') + ')' : '') + ' offers ' + site.offered.length + ' of your services ("'
        + site.offered.slice(0, 3).join('", "') + '"' + (site.offered.length > 3 ? ' …' : '') + ') with the signals of a vendor selling them ("' + site.signals.slice(0, 2).join('", "') + '")'
        + (o.country ? ' in ' + o.country : '');
    // C-8 (after the service-overlap evidence above, which names what their site offers): a site that sells your CATEGORY (ERP, e-invoicing, IT, AI, cloud) by its title, its address or its own about / contact text,
    // whatever product names it uses - erp-dubai.ae "ERPNext Implementation Partner", penieltech.com "Odoo Implementation"
    if (!SITE_EXEMPT.has(type) && typeof RV !== 'undefined') {
      const cat = RV.providerOf({ domain: o.domain, title: o.title, url: o.url || o.page_url, site_text: o.site_text, page_html: o.page_html, topics: o.topics, services: o.terms });   // C-8 leftover (F-L): page_html = the prospect page itself (its menu + sales buttons)
      if (cat) return 'a competing provider: ' + cat;
    }
    const terms = [...new Set((o.terms || []).flatMap(t => words(t).map(stem)))];
    if (terms.length < 2) return '';
    const title = String(o.title || ''); const text = String(o.text || '').slice(0, 30000);
    const T = new Set(words(title + ' ' + text).map(stem));
    const share = terms.filter(t => T.has(t)).length / terms.length;
    const signals = [...new Set((text.match(VENDOR_RE) || []).map(x => x.toLowerCase().replace(/\s+/g, ' ').trim()))];
    const theirs = THEIRS_RE.test(title) && words(title).map(stem).some(w => terms.includes(w));
    const topic = Number(o.fit) > 0 ? Number(o.fit) : 0;   // the topic match this run measured on their page, where it read one
    // their page sells our service: our words AND the signals of a vendor selling them, confirmed by the title or by that measured match
    // (deloitte.com at 54% and alaan.com at 65% were `ready` on 2026-10-14 with no title THEIRS_RE could read)
    if (!(signals.length >= 2 && share >= 0.45 && (theirs || topic >= 0.5))) return '';
    if (SELL_EXEMPT.has(type) && (!LIST_TYPES.has(type) || isRoundup(o))) return '';   // a roundup, a journalist request, a podcast, a lost link: the ask there is not "link to our guide"
    return 'a competing provider: their page sells what you sell (' + Math.round(share * 100) + '% of your service words'
      + (topic ? ', topic match ' + Math.round(topic * 100) + '%' : '') + ', "' + signals.slice(0, 2).join('", "') + '")';
  }
  // does a page name the business? Punctuation in a name ("Tech&") breaks \b, so every name is matched by its letter / digit runs with a
  // little punctuation allowed between them, and the domain counts as a name too.
  // P34-2 (live 2026-10-12): "Tech&" collapses to the four-letter run "tech", which matched the plain word "tech" on three unrelated
  // pages and claimed listings the site does not have — SaaSHub ("Tech Alternatives", 20x "tech", 0x "techand"), AlternativeTo and the
  // UAE Ministry of Finance accredited-provider list. A name decides that on its own only when it is distinctive: the domain, or letter /
  // digit runs of at least MIN_NAME_RUN characters. A shorter name is matched only with its own punctuation in place ("Tech&", "Tech &"),
  // never as the bare letters, so the stripped-ampersand form is never evidence on its own. (Entities are decoded by LK.text first.)
  const MIN_NAME_RUN = 5;
  const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function nameRe(n) {
    const s = String(n || '').trim(); const runs = s.toLowerCase().match(/[a-z0-9]+/g) || [];
    if (!runs.length) return null;
    const isDomain = runs.length >= 2 && /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(s);
    if (isDomain || runs.join('').length >= MIN_NAME_RUN) return new RegExp('(^|[^a-z0-9])' + runs.join('[^a-z0-9]{0,3}') + '($|[^a-z0-9])', 'i');
    if (!/[^a-z0-9\s]/i.test(s)) return null;   // four letters and nothing else: too common a word to claim anything by itself
    return new RegExp('(^|[^a-z0-9])' + s.toLowerCase().split(/\s+/).map(reEsc).join('\\s*'), 'i');
  }
  function namesUs(text, names) {
    const t = String(text || '');
    for (const n of (names || [])) { const re = nameRe(n); if (re && re.test(t)) return String(n); }
    return '';
  }
  // ---- the cold link gap: who is never pitched when all we know is the domain (P34-4, live 2026-10-12) ----
  // The full SEO report's "Link opportunities" told the owner to "reach out with a listing request, partnership or useful resource" to
  // mof.gov.ae (a ministry you join by accreditation), backlinkcheckers.space and buyhighda.space (sites whose business is selling
  // links). The Backlink Monitor refuses all three on the same data; this is the rule both of them use. The spam score is the link
  // index's own 0-100 (DataForSEO `backlinks_spam_score`).
  const SELLWORD = /(backlink|dofollow|link ?building|link ?farm|guest ?post|high ?da|seo ?link|buy ?link|authority ?link|link ?juice|link ?exchange|pbn)/i;
  function noPitch(domain, o) {
    const x = o || {}; const d = String(domain || '').toLowerCase().replace(/^www\./, '');
    if (!d || !/\./.test(d)) return 'not a website';
    if (isGov(d)) return 'a government site: you get on its lists by applying or being accredited, not by a pitch (see the listings checklist)';
    const bad = badHost(d); if (bad) return bad;
    if (LK.isWire(d)) return 'a press-release wire (' + d + '): a link there is a paid release, not an editorial link';
    if (LK.isGambling(d)) return 'a gambling site (' + d + ')';
    const name = d.replace(/\.[a-z.]{2,}$/, '').replace(/[.-]+/g, ' ');
    if (SELLWORD.test(name)) return 'its own name offers links ("' + name.slice(0, 40) + '"): a site that sells links passes nothing on and risks a penalty';
    if (Number(x.spam) >= 30) return 'a spam score of ' + Math.round(Number(x.spam)) + ' of 100 in the link index';
    if (!x.accredited && accreditedList(String(x.title || '') + ' ' + name)) return 'a list of accredited / approved providers: you get on it by applying with the accreditation, and the facts on file do not say you hold one';
    return '';
  }
  // and whether anything ties a bare domain to our topics: a topic word inside its own name, a title we know for it, or our own market's
  // domain ending (the 25% rule the Link Builder applies to the page it fetches, OFF_TOPIC)
  function gapTopic(domain, o) {
    const x = o || {}; const d = String(domain || '').toLowerCase().replace(/^www\./, '');
    const name = d.replace(/\.[a-z.]{2,}$/, '').replace(/[.-]+/g, ' ');
    const topicStems = new Set(words(x.topics || '').map(stem).filter(w => w.length >= 4));
    if (words(name).map(stem).some(w => topicStems.has(w))) return { ok: true, why: 'its name carries your topic' };
    const f = x.title ? fit(x.topics, x.title, x.df, x.docs) : 0;
    if (f >= OFF_TOPIC) return { ok: true, why: 'its page matches your topics (' + Math.round(100 * f) + '%)' };
    const tld = String(x.country_tld || '').toLowerCase();
    if (tld.length === 2 && tld !== 'us' && d.endsWith('.' + tld)) return { ok: true, why: 'a site in your market (.' + tld + ')' };
    return { ok: false, why: 'off topic for you: neither its name, its page nor its country ties it to ' + (String(x.topic_label || '') || 'your topics') };
  }
  // ---- LIVE1 (2026-11-07, the first live AI ranking run): a placement AI ranking would pitch, through the Link Builder's own verdicts and rules,
  // BEFORE it is chosen. Live, AI ranking chose five lists the Link Builder had already refused (competitors' own lists, paid guest posts) or
  // had already written to, so the Link Builder drafted none. Read from the stored rows only (no fetch): the Link Builder's latest verdict on
  // this site's page (not_fit, with its reason), any earlier pitch to the same site (a drafted sequence, a sent or answered e-mail, a stored
  // draft), and the rules that need no page: a mailbox / database / CDN host, a government site, a bare homepage, a competing site.
  // -> { refused: '' | why, contact: 'email' | 'form' | '', email, form }. A contact form only is allowed: the caller marks it a manual step.
  // the platforms the Link Builder never reads for a pitch (LB_Page_Requests' BIG list, kept identical; harness LIVE1-3 compares the two): a page
  // there belongs to whoever posted it, nobody edits it for a pitch, and the Link Builder would never qualify or draft it
  const PLATFORM = /(^|\.)(google|youtube|facebook|linkedin|wikipedia|amazon|apple|microsoft|reddit|quora|instagram|twitter|x|tiktok|medium|github|pinterest|bing|yahoo|duckduckgo)\.[a-z.]+$/i;
  const PITCHED = new Set(['drafted', 'needs_edit', 'approved', 'scheduled', 'sending', 'sent', 'replied', 'won', 'bounced', 'opted_out', 'stopped', 'contacted', 'declined']);
  const pkey = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  function placementVet(o) {
    const x = o || {}; const host = domOf(x.domain || LK.hostOf(x.url)); const d = LK.regDomain(host) || host; if (!d) return { refused: 'no site address', contact: '', email: '', form: '' };
    const mine = (r) => { const y = domOf(r && r.prospect_domain); return !!y && (LK.sameSite(y, d) || LK.regDomain(y) === d); };
    const outs = (x.outreach || []).filter(mine), pros = (x.prospects || []).filter(mine);
    const when = (r) => String(r.drafted_at || r.contacted_at || r.checked_at || r.updated_at || r.updatedAt || '').slice(0, 10);
    const pitched = outs.find(r => PITCHED.has(String(r.status || '')) || String(r.sequence_json || '').length > 2 || !!String(r.drafted_at || ''))
      || pros.find(r => PITCHED.has(String(r.status || '')) || !!String(r.contacted_at || '') || !!String(r.drafted_at || '') || !!String(r.outreach_body || '').trim());
    if (pitched) return { refused: 'the Link Builder already wrote to ' + d + (when(pitched) ? ' (' + when(pitched) + ')' : '') + ': one pitch per site, nothing new to send', contact: '', email: '', form: '' };
    const nf = outs.filter(r => String(r.status || '') === 'not_fit' && (String(r.type || '') === 'ai_source' || (pkey(r.page_url) && pkey(r.page_url) === pkey(x.url))))
      .sort((a, b) => String(b.checked_at || b.updatedAt || '').localeCompare(String(a.checked_at || a.updatedAt || '')))[0];
    if (nf) return { refused: 'the Link Builder ruled it out' + (when(nf) ? ' on ' + when(nf) : '') + ': ' + String(nf.fit_reason || 'not a fit').slice(0, 240), contact: '', email: '', form: '' };
    const why = badHost(d) || (PLATFORM.test(host) || PLATFORM.test(d) ? 'a platform page (' + d + '): the Link Builder does not pitch a platform, a post there belongs to whoever wrote it' : '') || (isGov(d) ? 'government site: you get on its lists by applying or being accredited, not by a pitch (see the listings checklist)' : '') || homepageOnly('ai_source', x.url)
      || sellsSame({ type: 'ai_source', domain: d, competitors: x.competitors || [], serp_rivals: x.serp_rivals || [], ai_rivals: x.ai_rivals || [], topics: x.topics || [], title: x.title || '', url: x.url || '', terms: x.terms || [] });
    if (why) return { refused: why, contact: '', email: '', form: '' };
    const jl = (v) => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
    const email = String(x.contact_email || '').trim() || (outs.map(r => String(r.contact_email || '') || String((jl(r.contacts_json)[0] || {}).email || '')).find(Boolean) || '') || (pros.map(r => String(r.contact_email || '')).find(Boolean) || '');
    const form = email ? '' : (String(x.contact_url || '').trim() || outs.map(r => String(r.contact_form_url || '')).find(Boolean) || pros.map(r => String(r.contact_url || '')).find(Boolean) || '');
    return { refused: '', contact: email ? 'email' : form ? 'form' : '', email, form };
  }
  // ---- CR17-E (client report 2026-11-17, C4e; build section 195): one verdict per WEBSITE, kept across runs ----
  // Live, abstract-technology.de was "Ready to send" (its blog post, type ai_source) and "Checked and left out: a competing provider" (its
  // free-trial page, type resource) on the same screen: each (site, type) row was judged alone. A reason that is about the WEBSITE (a
  // competitor, a government portal, a platform, a job board, a site that sells links, too little authority) now applies to every row and
  // type of that registrable domain, this run and every later run (stored verdicts are re-read each run with a code), and stored rows are
  // re-judged under the current rules without fetching anything, so a row qualified before a rule existed heals by itself.
  const REASON_CODES = [
    ['client_declined', /marked (in the app|not a fit)|not a fit \(marked/i],
    ['government', /government site/i],
    ['platform', /a platform page|a code host on|a profile on|a channel page on/i],
    ['job_board', /job board|job listing/i],
    ['not_a_site', /mailbox provider|contact \/ company database|infrastructure \(|statistics page|not a website/i],
    ['competitor_list', /its own list ranks itself/i],
    ['competitor', /competing (site|provider)|competitor of yours|recommends instead of you/i],
    ['listing', /a directory or list where companies are listed/i],
    ['your_platform', /the maker of the platform you work with/i],
    ['software', /a software maker, not a competitor/i],
    ['sells_links', /sells posts or links|paid guest posts|offers links|link-farm|spam score|gambling|essay-mill|press-release wire|different sites linked from one page/i],
    ['low_authority', /too little authority/i],
    ['accreditation', /accredited \/ approved providers/i],
    ['no_matching_page', /no page of yours covers their topic/i],
    ['off_topic', /off topic|off your topics/i],
    ['language', /another language/i],
    ['page_gone', /answers 4\d\d|does not answer|page itself is gone/i],
    ['homepage_only', /only their homepage/i],
    ['page_changed', /no longer carr|dead link is no longer/i],
    ['writer_skip', /^writer:/i],
  ];
  const reasonCode = (why) => { const t = String(why || ''); if (!t.trim()) return ''; for (const [c, re] of REASON_CODES) if (re.test(t)) return c; return 'other'; };
  const DOMAIN_CODES = new Set(['government', 'platform', 'job_board', 'not_a_site', 'competitor', 'competitor_list', 'sells_links', 'low_authority']);
  // the topic floor for pitches that ask "link to our page" (0.25 let course listings, a stock exchange and accounting bodies through at 30-33%)
  const TOPIC_FLOOR = 0.4, TOPIC_FLOOR_TYPES = new Set(['resource', 'ai_source', 'gap', 'comp_new']);
  // the link index's own authority (DataForSEO domain rank 0-1000; 0 = unknown, never a refusal)
  const MIN_RANK = 40;
  const lowAuthority = (rank) => { const r = Number(rank) || 0; return r > 0 && r < MIN_RANK ? 'too little authority to pass anything on (rank ' + Math.round(r) + ' of 1,000 in the link index)' : ''; };
  const PLATFORM_WHY = (d) => 'a platform page (' + d + '): a post there belongs to whoever wrote it, nobody edits it for a pitch';
  // a stored row judged again under today's rules, with nothing fetched: '' when it still passes. row: { prospect_domain, type, page_url,
  // page_title }; c: { competitors, serp_rivals, ai_rivals, topics, terms, accredited, spam, rank }
  const NO_REQUALIFY = new Set(['press', 'digest', 'podcast', 'redirect', 'reclaim']);
  function requalify(row, c) {
    const x = row || {}; const o = c || {}; const d = domOf(x.prospect_domain); const type = String(x.type || '');
    if (!d || !/\./.test(d) || NO_REQUALIFY.has(type)) return '';
    if (isGov(d)) return 'government site: you get on its lists by applying or being accredited, not by a pitch (see the listings checklist)';
    const bad = badHost(d); if (bad) return bad;
    const host = LK.hostOf(x.page_url) || d;
    if (PLATFORM.test(d) || PLATFORM.test(host)) return PLATFORM_WHY(LK.regDomain(d) || d);
    if (LK.isJobBoard(x.page_url || d, x.page_title)) return 'a job listing (' + d + '): nobody there adds a link';
    const np = noPitch(d, { title: x.page_title, spam: o.spam, accredited: !!o.accredited }); if (np) return np;
    const la = lowAuthority(o.rank); if (la) return la;
    return sellsSame({ type, domain: d, competitors: o.competitors || [], serp_rivals: o.serp_rivals || [], ai_rivals: o.ai_rivals || [], topics: o.topics || [], title: x.page_title || '', url: x.page_url || '', terms: o.terms || [] });
  }
  // rows: every outreach row of a site (this run's and the stored ones) -> Map registrable domain -> { why, code, type } for the domain-level
  // verdicts; the newest verdict wins, a verdict the client gave on one pitch stays on that pitch
  function domainVerdicts(rows) {
    const m = new Map();
    for (const r of [...(rows || [])].sort((a, b) => String(a.checked_at || '').localeCompare(String(b.checked_at || '')))) {
      if (String(r.status || '') !== 'not_fit') continue; const code = String(r.reason_code || '') || reasonCode(r.fit_reason); if (!DOMAIN_CODES.has(code)) continue;
      const d = LK.regDomain(domOf(r.prospect_domain)); if (d) m.set(d, { why: String(r.fit_reason || ''), code, type: String(r.type || '') });
    }
    return m;
  }
  return { OFF_TOPIC, TOPIC_FLOOR, TOPIC_FLOOR_TYPES, MIN_RANK, lowAuthority, reasonCode, DOMAIN_CODES, requalify, domainVerdicts, PLATFORM_WHY, NO_PAGE, anchorText, stripBrand, isGov, words, stem, fit, contactsIn, placementVet, PLATFORM, rankContacts, authorUrl, contactForm, sellSignals, countryOf, pickTarget, kindOf,
    badHost, isHomeUrl, homepageOnly, accreditedList, accredited, sellsSame, competitorCheck, siteOffer, rivalOf, isRoundup, LIST_TYPES, namesUs, nameRe, MIN_NAME_RUN, noPitch, gapTopic, SELLWORD };
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
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let reqs = [], res = []; try { reqs = $('Earned Requests').all().map(i => i.json); res = $('Fetch Cited Pages').all().map(i => i.json); } catch (e) {}
const prospects = (() => { try { return $('Load Link Prospects (Growth)').all().map(i => i.json).filter(r => r && r.site_id); } catch (e) { return []; } })();
const dec = (s) => String(s || '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;|&rsquo;/gi, "'");
const strip = (h) => dec(String(h || '').replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (t) => new RegExp('(^|[^a-z0-9])' + esc(String(t).toLowerCase()) + '($|[^a-z0-9])', 'i');
const ACTION = {
  list: (b, h) => ['outreach', 'Ask the editor of ' + h + ' to add ' + b + ' to this list (AI reads it for the answer)'],
  article: (b, h) => ['outreach', 'Offer the author on ' + h + ' a quote, a data point or a correction that names ' + b],
  news: (b, h) => ['outreach', 'Pitch an expert comment or data to ' + h + ' (assistants quote news coverage)'],
  review: (b, h) => ['profile', 'Create or complete ' + b + "'s profile on " + h + ' and ask clients for reviews there'],
  forum: (b, h) => ['reply', 'Answer this thread helpfully as yourself (say you work for ' + b + '); no link spam'],
  video: (b, h) => ['publish', 'Publish a short video answering the question on ' + h + ' (assistants cite videos for how-to questions)'],
  social: (b, h) => ['publish', 'Publish a post answering the question on ' + h + ' under your company page'],
  official: (b, h) => ['apply', 'An official source AI trusts here (' + h + '): if ' + b + ' qualifies for its list or registry (an accreditation, a licence, a partner list), apply; otherwise cite it on your page for this question'],
  encyclopedia: (b, h) => ['coverage', 'Earn independent press coverage first; ' + h + ' only describes businesses that independent sources cover (never write about yourself there)'],
  competitor: (b, h) => ['content', 'A competitor\'s own page is cited here: answer the same question better on your site'],
};
// R83 (2026-10-16, re-rating defect C-7): the businesses AI recommends instead of you are never earned media to pitch. The Growth
// Plan's competitors are the AI visibility table's 8 rows plus the declared ones; the exclusion set also takes every business the
// Answer Analyst learned a website for (the `ai_brands:` cache the AI Visibility Tracker writes), by registrable domain.
const cacheRowsG = (() => { try { return $('Load Cache (Growth)').all().map(i => i.json).filter(r => r && r.key); } catch (e) { return []; } })();
const aliasDomains = (sid) => { const row = cacheRowsG.find(r => r.key === 'ai_brands:' + sid); if (!row) return []; try { return Object.values(JSON.parse(row.value || '{}') || {}).map(String); } catch (e) { return []; } };
const out = [];
for (const p of plans) {
  const business = p.business_name || p.domain;
  // AIR (P3 guard, CONTRACTS.md §5): with AI ranking ON for this site (Growth Plan's air_on), a prospect AIR wrote (type ai_source, origin
  // 'ai_rank') is AIR's: this step neither re-writes it nor drafts for it. Off or shadow, the row is written as an AI Growth row again (rollback).
  const airOn = p.air_on === true;
  const airHosts = new Set(airOn ? prospects.filter(x => x.site_id === p.site_id && x.type === 'ai_source' && x.origin === 'ai_rank').map(x => x.prospect_domain) : []);
  const ownReg = LK.regDomain(p.domain) || p.domain;
  // CR17-F (2026-11-17, client report C5, section 196): a rival is a COMPETITOR by the one classifier (CMP.role): openedx.org for an Open edX shop,
  // Microsoft for a Microsoft partner, SAP or Salesforce named by AI, a directory or a platform are never "a business AI recommends instead of you"
  const roleCtx = { own_domain: p.domain, services: p.services || [], topics: p.topics || [], declared: p.competitors || [], not_competitors: p.not_competitors || [] };
  const rivals = new Set([...(p.competitors || []), ...(p.rival_sources || []), ...aliasDomains(p.site_id)].map(d => LK.regDomain(String(d || '').toLowerCase().replace(/^www\./, '')) || '').filter(d => d && /\./.test(d) && d !== ownReg && !OK.isGov(d) && CMP.role(d, roleCtx).role === 'competitor'));
  const rivalOf = (h) => rivals.has(LK.regDomain(String(h || '').toLowerCase().replace(/^www\./, '')) || '');   // D12: never the domain label ("techand" for Tech&) — the site model's name, else the domain
  const ourRes = p.brand_names.map(wordRe);
  const sellTerms = ((p.services || []).length ? p.services : [p.profile && p.profile.business_type]).filter(Boolean);
  const pageText = new Map();   // their page, for the competitor gate (never stored: the earned rows stay small)
  const fetched = new Map(); reqs.forEach((q, i) => { if (q && q.site_id === p.site_id) fetched.set(q.url, res[i] || {}); });
  const items = p.earned.map(e => {
    const r = fetched.get(e.url); let mentions_us = null, named = [], title = e.title, contact_email = '', contact_url = '', fetch_status = 0;
    if (r) { fetch_status = Number(r.statusCode) || 0; const html = String(r.body ?? r.data ?? '');
      if (fetch_status >= 200 && fetch_status < 300 && html.length > 120) { const text = strip(html).toLowerCase(); pageText.set(e.url, text.slice(0, 20000)); mentions_us = ourRes.some(re => re.test(text)); named = p.competitors.filter(c => { const lab = c.split('.')[0]; return wordRe(c).test(text) || (lab.length >= 5 && wordRe(lab).test(text)); }).slice(0, 6);
        if (!title) title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').slice(0, 140);
        contact_email = ((html.match(/mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i) || [])[1] || '').toLowerCase();
        const cu = [...html.matchAll(/href=["']([^"'#]+)["'][^>]*>([^<]{0,40})</gi)].find(m => /contact|write for us|contribute|submit|editor|advertis|get listed|add your/i.test(m[2] + ' ' + m[1]));
        if (cu) contact_url = /^https?:/i.test(cu[1]) ? cu[1] : (cu[1].startsWith('/') ? 'https://' + e.host + cu[1] : ''); } }
    const [type, action] = (ACTION[e.kind] || ACTION.article)(business, e.host);
    const value = Math.round(10 * e.citations * (1 + e.engines.length / 2) * ({ list: 1.4, article: 1.1, news: 1.2, review: 1.2, forum: 1, official: 1.3, video: 0.9, social: 0.8, encyclopedia: 0.6, competitor: 0.3 }[e.kind] || 1)) / 10;
    // R83: a page on the site of a business AI names instead of you is a competitor's page — answer the question better on your own
    // site. C-2 (re-rating 2026-10-17): its "best X" list too - every site in this set is a BUSINESS rival (declared, or named by AI),
    // and a competitor's own list ranks itself, not you (flick.network: "Ask the editor of flick.network to add Tech& to this list" while
    // the AI visibility run named it among the businesses AI recommends instead, and the Link Builder refused it). The Link Builder's
    // exemption is for a SERP-only rival (a publisher that outranks you), which this set does not hold. A site that sells your category
    // by its own title or address (RV.providerOf: "ERPNext Implementation Partner", "Odoo Implementation") is a competitor here too.
    const sells = rivalOf(e.host) ? '' : (OK.isGov(e.host) ? '' : RV.providerOf({ domain: e.host, title, url: e.url, topics: p.topics || [], services: p.services || [] }));
    const rival = rivalOf(e.host) || !!sells;
    if (rival) { const [t2, a2] = ACTION.competitor(business, e.host); return { ...e, kind: 'competitor', rival: true, rival_why: sells ? 'it sells what you sell: ' + sells : 'a business AI recommends instead of you', title, mentions_us, competitors_named: named, contact_email, contact_url, fetch_status, action: a2, action_type: t2, value: Math.round(10 * e.citations * (1 + e.engines.length / 2) * 0.3) / 10 }; }
    return { ...e, title, mentions_us, competitors_named: named, contact_email, contact_url, fetch_status, action, action_type: type, value };
  }).sort((a, b) => b.value - a.value);
  // prospects (type ai_source, one row per site + domain): the exact page, what it names, the action; drafts for the 3 most valuable new ones
  const rows = []; const jobs = []; const named_now = [];   // CR17-E: pages that name you since this run (an AI-visibility result, never a won link)
  for (const e of items.filter(x => x.kind !== 'competitor').slice(0, 12)) {
    if (rows.some(r => r.prospect_domain === e.host) || airHosts.has(e.host)) continue;   // AIR guard: on only
    const old0 = prospects.find(x => x.site_id === p.site_id && x.prospect_domain === e.host && x.type === 'ai_source') || {}; const old = old0.status === 'drafted' ? { ...old0, status: 'new' } : old0;   // 'drafted' (2026-10-10 runs) is not an app status
    const won = e.mentions_us === true;
    if (won && !/it names you now/.test(String(old0.detail || ''))) named_now.push({ prospect_domain: e.host, source_url: e.url });
    const kept = DRAFTS.carry(old, { handover: !!p.link_builder });
    const detail = 'AI cites this ' + e.kind + ' ' + e.citations + 'x (' + e.engines.join(', ') + ') for "' + (e.questions[0] || '').slice(0, 90) + '"' + (e.title ? ' — "' + e.title.slice(0, 80) + '"' : '') + (e.competitors_named.length ? '; it names ' + e.competitors_named.join(', ') : '') + (e.mentions_us === false ? ', not you' : won ? '; it names you now' : '');
    const row = { site_id: p.site_id, domain: p.domain, prospect_domain: e.host, type: 'ai_source', rank: Number(old.rank) || 0, spam_score: Number(old.spam_score) || 0, detail: detail.slice(0, 500), source_url: e.url, target_url: old.target_url || '',
      // CR17-E (195): a page that names you is not a WON link (LK.wonCheck: contacted + a link our check found); the mention rides the detail and the app's "names you" mark
      status: old.status || 'new', first_seen: old.first_seen || p.checked_at, last_seen: p.checked_at, won_at: old.won_at || '',
      outreach_subject: kept.outreach_subject, outreach_body: kept.outreach_body, drafted_at: kept.drafted_at,   // P34-1: a draft written before the D12 / D13 gates, or one handed to the Link Builder, is withdrawn — never offered again
      note: e.action.slice(0, 300), score: Math.min(100, Math.round(e.value * 8)), origin: 'ai_growth', contact_email: old.contact_email || e.contact_email, contact_url: old.contact_url || e.contact_url, contacted_at: old.contacted_at || '',
      followup_step: Number(old.followup_step) || 0, followup_subject: old.followup_subject || '', followup_body: old.followup_body || '', verified_at: old.verified_at || '', retired_at: '' };   // CR17-F: cited again this week, so not retired
    rows.push(row);
    // ---- D12: one writer, and the Link Builder's gates ----
    // With the Link Builder on, nothing is drafted here: the row above is the hand-over (its detail names the question AI cites them for),
    // and the Link Builder qualifies it, finds the contacts on their own domain and writes the sequence. With it off, the same gates decide
    // whether a draft may be written at all (live 2026-10-11: drafts went to two government portals and three competitors).
    const kindType = e.kind === 'list' ? 'list' : e.kind === 'forum' ? 'mention' : 'ai_source';
    const outreachKind = ['outreach', 'reply'].includes(e.action_type);   // a review profile, a video or a Wikipedia entry is the owner's own work: no writer is involved
    const blocked = !outreachKind ? '' : p.link_builder ? 'the Link Builder writes to them (one writer): approve the pitch on the Link building page'
      : (OK.badHost(e.host)
        || (OK.isGov(e.host) ? 'government site: you get on its lists by applying or being accredited, not by a pitch' : '')
        || OK.homepageOnly(kindType, e.url)
        || OK.sellsSame({ type: kindType, domain: e.host, competitors: p.competitors, ai_rivals: [...(p.rival_sources || []), ...aliasDomains(p.site_id)], topics: p.topics || [], title: e.title, url: e.url, text: pageText.get(e.url) || '', terms: sellTerms })
        || (!OK.accredited(p.accreditation) && OK.accreditedList(e.title + ' ' + e.url) ? 'a list of accredited / approved providers: you get on it by applying with the accreditation, and the facts on file do not say you hold one' : ''));
    if (blocked) row.note = String(blocked).slice(0, 300);
    if (kept.superseded && !blocked) row.note = (DRAFTS.reason + '; ' + row.note).slice(0, 300);   // P34-1: the owner is told the old pitch was withdrawn, not shown it again
    if (!won && !blocked && !kept.outreach_body && outreachKind && !['won', 'declined', 'contacted'].includes(String(old.status || '')) && jobs.length < 3)
      jobs.push({ n: jobs.length + 1, prospect_domain: e.host, kind: e.kind, action_type: e.action_type, url: e.url, title: e.title, question: e.questions[0] || '', competitors_named: e.competitors_named, engines: e.engines });
    if (blocked) e.no_draft = String(blocked).slice(0, 160);
  }
  // ---- B9-7: one correction target per wrong claim: the claim, the true fact from the profile, the cited pages that carry it ----
  // The Growth Plan decided which claims have a fact on file (`fact_on_file`); a claim without one stays "needs your fact" and is never
  // drafted. A page is drafted for only when its own text carries the claim (we fetched it); a page we could not read, or that does not
  // say it, is listed as "not confirmed" - the answer cited it, which is not the same as the page saying it. Drafting goes through the
  // one outreach writer (the jobs below join the AI Outreach Writer's list), or - with the Link Builder on - the page is handed over as
  // a prospect row. Nothing is sent from here.
  const wordsIn = (t) => [...new Set((String(t || '').toLowerCase().match(/[a-z0-9]{4,}|\d{2,}/g) || []))];
  const corrections = [];
  for (const c of (p.corrections || [])) {
    const cw = wordsIn(c.claim);
    const pages = (c.pages || []).map(pg => {
      const r = fetched.get(pg.url); const st = r ? Number(r.statusCode) || 0 : 0; const html = r ? String(r.body ?? r.data ?? '') : '';
      const ok = st >= 200 && st < 300 && html.length > 120; const text = ok ? strip(html).toLowerCase() : '';
      const confirmed = !ok ? null : (cw.length >= 2 && cw.filter(w => text.includes(w)).length / cw.length >= 0.6);
      const contact_email = ok ? ((html.match(/mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i) || [])[1] || '').toLowerCase() : '';
      return { ...pg, fetched: ok, carries_claim: confirmed, contact_email };
    });
    const target = c.fact_on_file ? pages.find(pg => pg.carries_claim === true && !OK.badHost(pg.host) && !OK.isGov(pg.host) && !rivalOf(pg.host)) : null;
    let status = c.status, note = c.note, draft_job = null;
    if (c.fact_on_file) {
      if (!pages.length) { status = 'no_page'; note = 'AI made this claim but no third-party page was cited in those answers: nothing to correct at a publisher. Make sure your own pages state the fact plainly.'; }
      else if (!target) { status = 'page_not_confirmed'; note = 'None of the cited pages could be read saying this (' + pages.map(pg => pg.host + (pg.fetched ? ': does not say it' : ': not readable')).join('; ') + '): no correction is drafted for a claim we cannot show on the page.'; }
      else if (airHosts.has(target.host)) { status = 'handed_over'; note = 'AI ranking already works with ' + target.host + ' (its prospect row): the correction is left to it.'; }
      else if (p.link_builder) { status = 'handed_over'; note = 'Handed to the Link Builder (one writer): ' + target.host + ' carries the claim. Approve the pitch on the Link building page.';
        const hit = rows.find(r => r.prospect_domain === target.host);
        const line = 'Correction needed: "' + c.claim + '" - the fact on file: ' + c.true_fact;
        if (hit) { hit.detail = (hit.detail + '. ' + line).slice(0, 500); hit.note = (String(hit.note || '') + ' ' + line).trim().slice(0, 300); }
        else { const old = prospects.find(x => x.site_id === p.site_id && x.prospect_domain === target.host && x.type === 'ai_source') || {};
          rows.push({ site_id: p.site_id, domain: p.domain, prospect_domain: target.host, type: 'ai_source', rank: Number(old.rank) || 0, spam_score: Number(old.spam_score) || 0, detail: line.slice(0, 500), source_url: target.url, target_url: old.target_url || '',
            status: old.status || 'new', first_seen: old.first_seen || p.checked_at, last_seen: p.checked_at, won_at: old.won_at || '', outreach_subject: old.outreach_subject || '', outreach_body: old.outreach_body || '', drafted_at: old.drafted_at || '',
            note: line.slice(0, 300), score: 40, origin: 'ai_growth', contact_email: old.contact_email || target.contact_email || '', contact_url: old.contact_url || '', contacted_at: old.contacted_at || '',
            followup_step: Number(old.followup_step) || 0, followup_subject: old.followup_subject || '', followup_body: old.followup_body || '', verified_at: old.verified_at || '', retired_at: old.retired_at || '' }); } }
      else if (jobs.length < 5) { status = 'draft_requested'; note = 'Drafted for you to review (never sent): ' + target.url;
        draft_job = { n: jobs.length + 1, prospect_domain: target.host, kind: 'correction', action_type: 'correction', url: target.url, title: target.title, question: '', claim: c.claim, true_fact: c.true_fact, competitors_named: [], engines: c.engines || [] };
        jobs.push(draft_job); }
      else { status = 'queued'; note = 'More corrections than drafts this week: it comes up again next run.'; }
    }
    corrections.push({ claim: c.claim, true_fact: c.true_fact, fact_on_file: c.fact_on_file, status, note, engines: c.engines, is_new: c.is_new, pages, job_n: draft_job ? draft_job.n : null });
  }
  out.push({ json: { site_id: p.site_id, domain: p.domain, business, earned: items, prospect_rows: rows, outreach_jobs: jobs, corrections, named_now } });
}
return out.length ? out : [{ json: { skip: true } }];
