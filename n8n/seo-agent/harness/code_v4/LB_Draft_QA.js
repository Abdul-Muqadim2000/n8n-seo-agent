// The draft gate (L2, system review 2026-10-11): every sequence the Outreach Sequence Writer wrote is checked here before the app may offer
// it for approval — the claims against the facts on file (wrapped for the owner), nothing left in brackets, the address on the prospect's own
// domain, a real quote from their page, one link to the page we chose on our canonical host, the length and one clear ask, the words we never
// use, and the business name as the site model has it (DQ, v5/code/_draft_qa.js). A draft that fails is held ("needs_edit") with its reasons:
// the owner edits it in the app, automatic mode skips it, and nothing is sent. The steps carry the waits in working days (follow-ups after 4
// and 8; a journalist request — on Bluesky or from a digest — gets one follow-up after 3).
// L7 (2026-10-13): the writer gives every sequence a second subject in the other style; it is kept only when it passes the same
// checks (length, nothing left in brackets, none of the words we never use, not a copy of the first). LB Rows then gives half the
// batch each subject, so the app can read the reply rate per style.
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
  const NOT_RIVAL_HOST = (d) => NOT_RIVAL.test(reg(d)) || NOT_RIVAL.test(norm(d));
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
    if (c.domain && NOT_RIVAL_HOST(c.domain)) return '';   // a platform, an official body, a news site, a directory or a consultancy is never a provider of your category
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
    for (const d of (c.ai || [])) add(d, 'business', 'a business AI recommends instead of you');
    for (const d of (c.serp || [])) add(d, 'serp', 'a site that outranks you for one of your own keywords');
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
    const add = (d, why) => { const x = reg(d); if (!x || !/\./.test(x) || x === own || NOT_RIVAL.test(x) || out.has(x)) return; out.set(x, { domain: x, why }); };
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
  return { set, providerOf, storefront, menuOf, families, reg, aiRivals, marketMedia, ROUNDUP, FAMILIES, NOT_RIVAL };
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
    if (/\b(casino|betting|sportsbook|cbd oil|essay writing|payday loan|escort|replica watches)\b/.test(t)) r.push('gambling / CBD / essay-mill topics');
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
  function pickTarget(p, pages, df, nDocs, home) {
    if (p.type === 'lost' && p.to_url) return { url: p.to_url, reason: 'the page it used to link to', anchor: 'as before', fit: 1 };
    if (HOME_TYPES.has(p.type)) return { url: home, reason: p.type === 'list' || p.type === 'ai_list' ? 'lists link to the homepage' : 'a mention or a listing names the business: the homepage', anchor: 'brand', fit: 1 };
    const probe = p.type === 'broken' ? (p.dead_text || p.text) : ['gap', 'comp_new'].includes(p.type) ? p.text + ' ' + (p.topics || '') : p.text;   // they link to competitors for OUR topics: aim at our page on them
    const scored = pages.filter(x => x.url && x.kind !== 'home').map(x => {
      const f = fit(probe, [x.title, x.keyword, String(x.url || '').replace(/^https?:\/\/[^\/]+/, '').replace(/[\/_.-]+/g, ' ')].join(' '), df, nDocs);   // the URL's words too: titles come from Search Console queries (live 2026-10-11)
      const pos = Number(x.position) || 0; const band = pos >= 4 && pos <= 15 ? 1 : pos >= 16 && pos <= 30 ? 0.6 : pos >= 1 && pos <= 3 ? 0.3 : 0.4;
      const rds = Number(x.rds) || 0; const need = rds === 0 ? 1 : rds <= 5 ? 0.9 : rds <= 20 ? 0.7 : 0.5;
      const type = x.kind === 'money' ? 0.6 : 1;   // publishers link to guides; the guide links on to the service page
      const paced = (Number(x.pitched) || 0) >= (rds < 20 ? 4 : Math.max(4, Math.round(rds * 0.2)));
      return { x, f, score: paced ? 0 : f * band * need * type, band, pos, rds, paced };
    }).filter(s => s.f >= 0.2 && s.score > 0).sort((a, b) => b.score - a.score);
    if (!scored.length) return { url: home, reason: 'no page of ours matches their topic closely: the homepage', anchor: 'brand', fit: 0 };
    const s = scored[0]; const why = [s.pos >= 4 && s.pos <= 15 ? 'ranks #' + s.pos + ' (close to the top)' : s.pos ? 'ranks #' + s.pos : 'not ranking yet', s.rds ? s.rds + ' linking sites' : 'no links yet', 'topic match ' + Math.round(s.f * 100) + '%'];
    return { url: s.x.url, reason: why.join(' · '), anchor: (Number(s.x.kw_share) || 0) > 0.15 ? 'brand' : 'title', fit: s.f, title: s.x.title };
  }
  // government sites list providers through accreditation or an application, never through a pitch (the listings checklist covers them)
  const isGov = (d) => /(^|\.)(gov|gouv|gob|govt|mil)(\.[a-z]{2})?$/i.test(String(d || '').toLowerCase());
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
  const isRoundup = (o) => ROUNDUP_RE.test(String(o.title || '')) || ROUNDUP_RE.test(String(o.url || o.page_url || '').replace(/[\/_?.&=-]+/g, ' '));
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
  function sellsSame(o) {
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
  return { OFF_TOPIC, isGov, words, stem, fit, contactsIn, rankContacts, authorUrl, contactForm, sellSignals, countryOf, pickTarget, kindOf,
    badHost, isHomeUrl, homepageOnly, accreditedList, accredited, sellsSame, siteOffer, rivalOf, isRoundup, LIST_TYPES, namesUs, nameRe, MIN_NAME_RUN, noPitch, gapTopic, SELLWORD };
})();

// ---- claims kit (D14, 2026-10-11; inlined by build_monitors.py): statements about the business that only the owner can vouch for. With no
// facts on file the Reply Reader's suggested answer invented "we're not directly accredited by the Ministry, but we work with accredited
// providers" (live 2026-10-11). A sentence that claims an accreditation, certification, partnership, licence, registration, approval, award,
// membership, founding year, location, age, size, client count, percentage or price is kept only when the facts on file carry the same word
// stem (or the same number); otherwise it is wrapped in [Owner: confirm — …] and the answer needs the owner. One list for every draft
// (CL.CLAIM_RE; L2 reuses it for the outreach sequences). Regex only, no model.
const CL = (() => {
  const CLAIM_RE = /\b(?:accredit\w*|certif\w*|iso[ -]?\d{4,5}|partner\w*|authori[sz]ed|licen[cs]ed|registered|approved|award\w*|member(?:s|ship)? of|founded|since \d{4}|headquarter\w*|based in|offices? in|\d[\d,.]*\+? ?(?:years?|yrs|clients?|customers?|projects?|companies|countries|employees|staff|users|installations?|implementations?)|\d[\d,.]*\s?%|(?:aed|usd|eur|gbp|sar|inr|\$|€|£)\s?\d[\d,.]*|\d[\d,.]*\s?(?:aed|usd|eur|gbp|sar|dirhams?|dollars?)|pric(?:e|es|ed|ing)|fees?|free of charge|no charge|discount\w*)\b/gi;
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9%$€£]+/g, ' ').replace(/\s+/g, ' ').trim();
  // the piece of a claim that the facts must carry: its number, else the first word's stem (7 letters: "accredited" → "accredi", "authorised" / "authorized" → "authori")
  const keyOf = (m) => { const x = norm(m); const num = x.match(/\d[\d,.]*/); if (num) return num[0].replace(/[,.]+$/, '');
    const w = x.split(' ')[0]; const st = w.replace(/(ations?|ation|ings?|ed|es|s|ship|ships)$/, ''); return (st.length >= 5 ? st : w).slice(0, 7); };
  // L2 (2026-10-11): a claim is only ours when the sentence speaks about us -- "the date it was approved" on their own list says nothing
  // about our business. The outreach draft gate passes { ours: true, brand }, so a sentence about the prospect's page is left alone; the
  // Reply Reader checks every sentence (its whole answer is about us).
  const OURS_RE = /\b(we|we.?re|we.?ve|our|ours|us|i|i.?m|i.?ve|my)\b/i;
  // text: a draft; facts: what we know (any string); opts.skip: a string that is never a claim (the signature); opts.ours / opts.brand:
  // see above. Returns the text with every unsupported claim sentence wrapped and the list of what was wrapped.
  function check(text, facts, opts = {}) {
    const t = String(text || ''); if (!t.trim()) return { text: t, flags: [] };
    const F = norm(facts); const body = opts.skip ? t.split(String(opts.skip)).join(' ') : t;
    const flags = []; let out = t;
    for (const s0 of body.split(/(?<=[.!?])\s+|\n+/)) { const s = s0.trim(); if (s.length < 4 || /^\[[^\]]*\]$/.test(s)) continue;
      if (opts.ours && !(OURS_RE.test(s) || (opts.brand && s.toLowerCase().includes(String(opts.brand).toLowerCase())))) continue;
      let plain = s.replace(/\[[^\]]*\]/g, ' ').replace(/https?:\/\/\S+/g, ' ');   // a word in a URL is not a claim (our own slug says "accredited-service-providers")
      if (opts.ours) plain = plain.replace(/["\u201c\u201d][^"\u201c\u201d]{3,200}["\u201c\u201d]/g, ' ');   // L2: words inside quotation marks are THEIR words (a pitch quotes their page title), never our claim
      const bad = [...plain.matchAll(CLAIM_RE)].map(m => m[0]).filter(m => { const k = keyOf(m); return k && !F.includes(k); });
      if (!bad.length) continue;
      flags.push({ claim: bad[0], sentence: s.slice(0, 200) });
      if (out.includes(s)) out = out.replace(s, '[Owner: confirm — ' + s + ']'); }
    return { text: out, flags };
  }
  // ---- A-15 (2026-10-17, re-rating 2026-10-17): what a written PAGE says about the business's own terms and scope ----
  // Live (exec 771, business facts and profile empty) the page told buyers "We charge for advice and delivery. Licences sit on a separate
  // line of the quote, you can buy them through any channel …", "Some can, but Tech& does not [manage a complete office IT setup]" and
  // "Tech& does not handle company formation" — none of it on any of the site's 33 pages, and the quality check listed none of it.
  // CL.business(text, corpus, opts) reads every sentence that speaks about the business (we / our / us, or one of its names in
  // opts.names) and holds three kinds of statement against `corpus` (the business facts, the profile, the site model and the site's own
  // pages this run read):
  //   * its commercial terms — what it charges, quotes, bills, licenses, guarantees, refunds, discounts, how it contracts or resells;
  //   * its scope — what it does NOT do, NEVER or ONLY does ("Tech& does not handle company formation");
  //   * its credentials — accreditation, certification, partnership, awards, founding year, a count of years / clients / staff.
  // A statement is supported when ONE sentence of the corpus carries its trigger (the same number, the trigger's stem; for a scope
  // statement, a negation) and at least half of its own content words. Anything else is returned as unsupported, with the sentence; the
  // caller marks it [Confirm: …] for the owner. Sentences already holding a bracket are left alone (a note is never nested).
  // The subject must be the business: "we …", "<name> …", "our <team / prices / quotes …>" — "configuration does not meet your needs" and
  // "you can act on it with another partner" say nothing about it. Questions (a buyer's checklist) are never claims.
  const BIZ_TERMS = /\b(?:charg(?:e|es|ed|ing)|quot(?:e|es|ed|ing)|bill(?:s|ed|ing)?|invoice (?:you|clients|customers)|pricing|priced|fixed[- ]price|flat[- ](?:fee|rate)|fees?|retainers?|contracts?|lock[- ]?in|refund\w*|money[- ]back|guarantee[sd]?|warrant(?:y|ies)|discount\w*|commissions?|mark-?ups?|resell(?:er|ers|s|ing)?|sells?|payment terms|free of charge|at no (?:extra )?cost|no (?:hidden )?(?:fees|charges|costs))\b/i;
  const BIZ_CRED = /\b(?:accredit\w*|certified|certifications?|iso[ -]?\d{4,5}|(?:gold|silver|solutions|certified|official|premier|authori[sz]ed|preferred|cloud solution) partner(?:s|ship)?|partner of the year|award\w*|member(?:s|ship)? of|founded|since (?:19|20)\d\d|headquarter\w*|offices? in|\d[\d,.]*\+? ?(?:years?|yrs|clients?|customers?|projects?|employees|staff|consultants|engineers|implementations?))\b/i;
  const BIZ_ADVICE = /\b(?:do|does|did|will|would|can|could)(?:\s+not|n['’]t)\s+(?:need|have to|recommend|suggest|advise|expect|know|mean|matter|depend|apply|require you|replace|guarantee you)\b/i;   // advice to the reader, not a statement of our scope
  const OURS_PAGE = /\b(?:[Ww]e|[Ww]e['’](?:re|ve|ll|d)|[Oo]ur|[Oo]urs|us)\b/;
  const escR = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const STOPW = new Set('the a an and or of for to in on with by at from as is are was were be been it its this that these those you your they them their there here can could will would should may might must do does did not no never only also just than then so such some any all each other more most very into over under about through which who whom what when where why how our we us ours has have had'.split(' '));
  const stem = (w) => { let x = String(w).toLowerCase().replace(/licens/g, 'licenc'); if (x.length > 5) x = x.replace(/(?:ations?|ings?|ies|ed|es|s)$/, ''); else if (x.length > 3) x = x.replace(/s$/, ''); return x; };
  const words = (s, drop) => norm(s).split(' ').filter(w => w.length > 2 && !STOPW.has(w) && !(drop || []).includes(w)).map(stem);
  function business(text, corpus, opts = {}) {
    const t = String(text || ''); const out = { flags: [], checked: 0 };
    if (!t.trim()) return out;
    const names = (opts.names || []).map(n => String(n || '').trim()).filter(n => n.length >= 3);
    const nameWords = [...new Set(names.flatMap(n => norm(n).split(' ')).filter(Boolean))];
    const SUBJ = '(?:\\b[Ww]e|\\b[Oo]ur (?:team|consultants|engineers|people|firm|company|prices|fees|quotes|contracts|recommendations)' + names.map(n => '|' + (/^\w/.test(n) ? '\\b' : '') + escR(n)).join('') + ')';
    const SCOPE = new RegExp(SUBJ + '\\s+(?:(?:do|does|did|will|would|can|could)(?:\\s+not|n[\'’]t)\\b|(?:never|only)\\b)|(?:\\b[Ww]e[\'’]re|\\b[Ww]e are' + names.map(n => '|' + escR(n) + ' is').join('') + ')\\s+not\\s+an?\\b');
    const SUBJ_RE = new RegExp(SUBJ);
    const NEG_ANY = /\b(?:do|does|did|will|would|can|could)(?:\s+not|n['’]t)\b|\b(?:never|only)\b|\bnot an?\b/i;
    const cs = String(corpus || '').split(/(?<=[.!?])\s+|\n+/).map(s => ({ n: norm(s), w: new Set(words(s, nameWords)), neg: NEG_ANY.test(s) })).filter(x => x.n.length > 3);
    const lines = t.split('\n'); let prevLine = '';
    for (const line of lines) {
      const L = line.trim();
      if (!L || /^#{1,6}\s/.test(L) || /^\|/.test(L) || /^(?:Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):/i.test(L)) { if (L) prevLine = L.replace(/^#+\s*/, ''); continue; }
      const sents = L.replace(/\*\*/g, '').split(/(?<=[.!?])\s+(?=[A-Z"“(])/);
      for (let i = 0; i < sents.length; i++) {
        const s = sents[i].trim().replace(/^[-*]\s+/, '');
        if (s.length < 6 || /\?\s*$/.test(s) || /[\[\]]/.test(s.replace(/\[[^\[\]]*\]\([^)]*\)/g, ''))) continue;
        const plain = s.replace(/\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '');
        if (!(OURS_PAGE.test(plain) || SUBJ_RE.test(plain))) continue;
        let kind = null, trig = null, m;
        if ((m = plain.match(SCOPE)) && !BIZ_ADVICE.test(plain) && !/\b(?:what|whether|if)\s+$/i.test(plain.slice(0, m.index))) { kind = 'scope'; trig = m[0]; }
        else if (SUBJ_RE.test(plain) && (m = plain.match(BIZ_TERMS))) { kind = 'terms'; trig = m[0]; }
        else if (SUBJ_RE.test(plain) && (m = plain.match(BIZ_CRED)) && !(/^member/i.test(m[0]) && names.some(n => plain.slice(m.index + m[0].length).trim().toLowerCase().startsWith(n.toLowerCase())))) { kind = 'credential'; trig = m[0]; }   // CT-FIX: "membership of <the business>" is joining it, not a credential it holds
        if (!kind) continue;
        out.checked++;
        // an elliptical sentence ("Some can, but Tech& does not.") is read with the sentence or heading before it
        let W = words(plain, nameWords);
        if (W.length < 2) W = [...new Set(W.concat(words(i > 0 ? sents[i - 1] : prevLine, nameWords)))];
        const key = kind === 'credential' ? keyOf(trig) : stem((norm(trig).split(' ').filter(w => !STOPW.has(w) && !nameWords.includes(w))[0]) || norm(trig));
        const supported = cs.some(c => {
          if (kind === 'scope' ? !c.neg : !(key && c.n.includes(key))) return false;
          if (kind === 'credential' && /\d/.test(key)) return true;   // the same number on the site's own pages: "20+ Years"
          const hit = W.filter(w => c.w.has(w)).length; return W.length ? hit / W.length >= 0.5 : false;
        });
        if (!supported) out.flags.push({ kind, trigger: trig, sentence: s, rewrite: neutral(s, { kind, corpus, business: names[0] }) });   // CT-FIX: the whole sentence (Content QA finds and wraps it); a display cut is the reader's
      }
      prevLine = L;
    }
    return out;
  }
  // ---- E-CLAIM (2026-10-21, pre-launch run exec 42): what a page PROMISES in the business's name must be on file ----
  // Live (exec 42, techand.ai "ai consultant") the page promised "You receive a prioritised use-case backlog, data readiness findings and
  // an ROI case", "We test a proof of concept ... documented test results", "You receive a runbook and monitoring dashboards", a training
  // plan and "a self-study pack", "document each decision for your audit team" and "we stop there". The client states none of it.
  // CT-FIX (2026-10-22, labelled set harness/accuracy/claims.json): the first version listed commitment VERBS, so it missed every promise
  // phrased another way ("we have delivered 150 projects", "our fixed fee starts at USD 15,000", "training is included at no extra cost",
  // a verb-less deliverable under "What you get", every Arabic sentence) and flagged a page's own call to action and a guide's narration.
  // It now decides by SUBJECT, not by verb. A sentence is a commitment of the business when:
  //   * the business is its grammatical subject: "we / we'll / we're / we have", a sentence that opens with "our <anything>", the
  //     business's name in the first words ("Every Azdan implementation takes ...", "As a Microsoft partner, Tech& implements ..."), the
  //     name followed by a verb anywhere, or "with us / from us / by <name>";
  //   * in a section about the business (its H2 group names it, speaks as we / our in a subject, or is headed by a phase on file): an offer
  //     to the reader ("you will receive / your team gets ..."), a passive line ("is delivered / are included / are part of the service"),
  //     a cost or duration line ("Membership costs EUR 2,500"), a phase or training line;
  //   * a list item under a business lead-in ("Our engagement includes:", or a heading such as "What you get from Tech&"): each item
  //     inherits the lead-in, verb or not. Table rows, headings and the meta description are read the same way (subject rules only).
  // Never a commitment: a question; the page's call to action (an imperative in the closing / CTA section, "<imperative> and we will
  // ...", "our team will reply ..."), unless it names a price, quote, fee or guarantee; guide narration ("in this guide we cover ...",
  // "below we map ..."); words inside quotation marks; a worked example ("say we start with ..."); a sentence whose agent is a named third
  // party ("you receive a TRN from the FTA"); "we" inside a relative clause ("most distributors we work with ...").
  // Support: one corpus sentence (or two adjacent ones: a fact is often split over a line break) carries at least half of its content
  // words, every number it states is on file as a whole number (number words are digits, "two decades" = 20 years, "round-the-clock" =
  // 24/7), and every strong qualifier it uses (only, exclusive, platinum, gold, largest, leading, first ...) is on that same fact.
  // Arabic: normalised like the keyword gate (alef forms, ta marbuta, alef maqsura, diacritics, tatweel, Arabic-Indic digits); a sentence
  // in the first person plural ("نحن / نقدم / نضمن / لدينا / فريقنا ...") or an offer ("ستحصل") is a commitment; its business terms are
  // read through a small bilingual lexicon and held against the same facts with the same rule (fewer than two terms read = cannot be
  // checked = flagged for the owner).
  const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90, hundred: 100 };
  // the same meaning in the words a writer or a site uses: applied to the claim and to the facts before anything is compared
  // CT-FIX2 (live page 2026-10-22, D1): the long and the short name of a place are one name ("United Arab Emirates" = "UAE")
  const canon = (s) => String(s || '')
    .replace(/\bthe united arab emirates\b|\bunited arab emirates\b/gi, 'UAE').replace(/\bkingdom of saudi arabia\b|\bsaudi arabia\b/gi, 'KSA').replace(/\bgulf cooperation council\b/gi, 'GCC')
    .replace(/\b(?:a|one) decade\b/gi, '10 years').replace(/\b(two|three|four|five) decades\b/gi, (m, n) => (NUMW[n.toLowerCase()] * 10) + ' years')
    .replace(/\b(?:a|one) dozen\b/gi, '12').replace(/\b(?:around|round)[- ]the[- ]clock\b|\b24\s*x\s*7\b|\b24 hours a day,? 7 days a week\b|\b24 hours a day\b/gi, '24/7')
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|ninety|hundred)\b/gi, (m) => String(NUMW[m.toLowerCase()]))
    .replace(/(\d)\s*-\s*(day|week|month|year|hour|minute)s?\b/gi, '$1 $2s');
  // whole numbers only: "within 10 days" is not supported by "2010", "100" or "10x"; a single digit counts only with its unit ("8 weeks")
  const UNIT = '(?:days?|weeks?|months?|years?|hours?|minutes?|business days|working days)';
  const numsOf = (s) => {
    const t = canon(s); const out = [];
    for (const m of t.matchAll(/(?<![\w.,])(\d[\d,]*(?:\.\d+)?)(?![\w])/g)) { const n = m[1].replace(/,/g, '').replace(/\.0+$/, '');
      if (/^\d$/.test(n)) { const u = t.slice(m.index + m[0].length).match(new RegExp('^\\+?\\s+(?:to \\d+\\s+)?(' + UNIT + ')', 'i')); if (u) out.push(n + ' ' + stem(u[1].split(' ').pop())); }
      else out.push(n); }
    return out;
  };
  const STRONG = /\b(?:only|sole|exclusive\w*|platinum|gold|silver|diamond|elite|premier|largest|biggest|leading|first|#1|number one|best|official|award[- ]winning)\b/gi;
  const ARABIC = /[؀-ۿ]/;
  const arNorm = (s) => String(s || '').replace(/[ً-ْٰـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/٬/g, ',');
  // business terms in Arabic (normalised, without the article) -> the English word the facts use; phrases first
  const AR_LEX = [['على مدار الساعه', '24/7'], ['طوال ايام الاسبوع', '24/7'], ['المنطقه الحره', 'freezone'], ['دليل تشغيل', 'runbook'], ['لوحات متابعه', 'monitoring dashboards'],
    ['نموذج تجريبي', 'pilot'], ['النموذج التجريبي', 'pilot'], ['نت سويت', 'netsuite'], ['ذكاء اصطناعي', 'ai'], ['عامين', '2 years'], ['سنتين', '2 years'],
    ['دعم', 'support'], ['خبره', 'experience'], ['عام', 'years'], ['عاما', 'years'], ['اعوام', 'years'], ['سنه', 'years'], ['سنوات', 'years'], ['قطاع', 'industry'],
    ['مكتب', 'office'], ['مقر', 'based'], ['مطار', 'airport'], ['دبي', 'dubai'], ['امارات', 'uae'], ['خليج', 'gcc'], ['سعوديه', 'ksa'], ['مصر', 'egypt'], ['شريك', 'partner'],
    ['مايكروسوفت', 'microsoft'], ['اوراكل', 'oracle'], ['تنفيذ', 'implementation'], ['ضمان', 'guarantee'], ['نضمن', 'guarantee'], ['استرداد', 'refund'], ['اموال', 'money'],
    ['شهاده', 'certification'], ['معتمد', 'certified'], ['رسوم', 'fee'], ['تكلفه', 'cost'], ['سعر', 'price'], ['درهم', 'aed'], ['تقييم', 'assessment'], ['جاهزيه', 'readiness'],
    ['اطلاق', 'go-live'], ['تدريب', 'training'], ['اسبوع', 'weeks'], ['اسابيع', 'weeks'], ['شهر', 'months'], ['اشهر', 'months'], ['يوم', 'days'], ['ايام', 'days'], ['مجاني', 'free'],
    ['مجانا', 'free'], ['خصم', 'discount'], ['مستشار', 'consultant'], ['مستشارون', 'consultants'], ['عملاء', 'clients'], ['مشروع', 'project'], ['مشاريع', 'projects'], ['ترخيص', 'licence'],
    ['بيانات', 'data'], ['واحد', '1'], ['اثنان', '2'], ['ثلاثه', '3'], ['اربعه', '4'], ['خمسه', '5'], ['سته', '6'], ['سبعه', '7'], ['ثمانيه', '8'], ['تسعه', '9'], ['عشره', '10'], ['عشرين', '20']]
    .map(([a, e]) => [arNorm(a).split(' ').map(w => w.replace(/^ال(?=\S{3,})/, '')).join(' '), e]);
  const AR_WE = new Set(['نحن', 'لدينا', 'عندنا', 'نقدم', 'نوفر', 'نضمن', 'نلتزم', 'نتعهد', 'نعمل', 'نساعد', 'نبني', 'نصمم', 'ننفذ', 'نسلم', 'نتقاضى', 'نفرض', 'ندير', 'نخدم', 'نختبر', 'ندرب', 'نراجع', 'نرد', 'سنقوم', 'سنقدم', 'سنوفر', 'سنرسل', 'سنسلم'].map(arNorm));
  const AR_OFFER = new Set(['ستحصل', 'تحصل', 'ستتلقى', 'تتلقى', 'ستستلم'].map(arNorm));
  const AR_CTA = /^(?:احجز|تواصل|اتصل|اطلب|ابدا|سجل|راسلنا|ارسل|انضم|جرب|تحدث)/;
  const AR_NOT_OURS = new Set(['هنا', 'احيانا', 'لنا'].map(arNorm));
  const arTokens = (s) => arNorm(s).replace(/[^؀-ۿ0-9a-z%\s]/gi, ' ').split(/\s+/).filter(Boolean);
  const arStrip = (w) => w.replace(/^(?:وال|بال|لل|فال|كال|ال|و|ب|ل|ف)(?=\S{3,})/, '');
  const arOurs = (s) => { const T = arTokens(s); if (AR_CTA.test(T[0] || '')) return null;
    if (T.some(w => AR_WE.has(w) || AR_WE.has(arStrip(w)) || (w.length >= 5 && /نا$/.test(w) && !AR_NOT_OURS.has(w)))) return 'we';
    if (T.some(w => AR_OFFER.has(w))) return 'offer'; return null; };
  const arToEnglish = (s) => { let t = ' ' + arTokens(s).map(arStrip).join(' ') + ' '; const hits = [];
    for (const [a, e] of AR_LEX) { const re = new RegExp('(?:^|\\s)(?:ال)?' + a.replace(/\s+/g, '\\s+(?:ال)?') + '(?:نا|ها|كم|ك)?(?=\\s)', 'g'); if (re.test(t)) { hits.push(e); t = t.replace(re, ' '); } }
    const digits = (s.match(/\d[\d,]*/g) || []).concat((arNorm(s).match(/\d[\d,]*/g) || []));
    const lat = (String(s).match(/[A-Za-z][A-Za-z0-9&-]+/g) || []);
    return { text: [...new Set(digits)].join(' ') + ' ' + lat.join(' ') + ' ' + hits.join(' '), terms: hits.length + lat.length };
  };
  const SAY_RE = /\b(?:says?|said|states?|stated|notes?|noted|told|according to|writes?|wrote|explains?|explained)\b/i;
  const NARR_OPEN = /^(?:in this (?:guide|article|post|page|section|piece|checklist)|in the (?:next|following) sections?|in the sections? below|below|above|here|next|throughout this (?:guide|article|page)|as we (?:saw|said|noted|explained|mentioned)|later in this (?:guide|article))\b/i;
  const NARR_VERB = /^(?:we|we['’]ll)\s+(?:will\s+)?(?:cover|explain|walk (?:you )?through|look at|outline|list|compare|answer|explore|discuss|break down|summari[sz]e|unpack|examine|describe|go through|show you)\s+(?:the|these|this|what|how|why|when|which|each|every|\d+|both|all)\b/i;
  const EXAMPLE_RE = /^(?:say|suppose|imagine|assume|picture|let['’]?s say|for (?:example|instance), (?:say|suppose|imagine|if))\b/i;
  const ADVICE_WE = /^(?:we|we['’]d)\s+(?:would\s+|always\s+|strongly\s+)?(?:recommend|suggest|advise|encourage|urge)\b/i;
  const CTA_START = /^(?:book|call|contact|talk|email|e-mail|schedule|get in[- ]touch|arrange|request|get a|get your|get started|share|send|ask|tell us|reach|start|join|sign up|try|download|visit|speak|let['’]s|fill in|message|claim|see how|find out|learn more|ready to|read|see|explore|discover|check out|browse|compare)\b/i;
  // CT-FIX2 (live page 2026-10-22, D2): "To test one use case first, [book a discovery call]" is an invitation behind a purpose clause
  const PURPOSE_LEAD = /^(?:to|if you (?:want|need|would like) to|when you are ready to|for)\s+[^,]{3,80},\s+/i;
  const CTA_HEAD = /\b(?:next steps?|get started|getting started with us|contact|talk to|book|ready to|let['’]s talk|work with us|request|speak to|get in touch|start (?:your|a|with))\b/i;
  const CTA_FOLLOW = /\b(?:reply|replies|respond|responds|get back to you|call you back|be in touch|contact you|review (?:it|them|your|the details)|(?:confirm|check|tell you) (?:whether|which|if)|send (?:you )?(?:a |the )?(?:written )?(?:plan|proposal|summary|recommendation|outline|next steps)|prepare a (?:fixed-scope |short )?(?:proposal|plan)|set up a call|arrange a call)\b/i;
  const CTA_TERMS = /\b(?:quotes?|quoted|price[sd]?|pricing|fees?|cost|guarantee\w*|refund\w*|money[- ]back|warrant\w*|discount\w*)\b|(?:aed|usd|eur|gbp|sar|\$|€|£)\s?\d/i;
  // ---- H2 (2026-10-27, R1_PIPELINE_ANALYSIS.md: the four production pages 949 / 2195 / 2552 / 2575) ----
  // Of 33 sentences flagged as unsupported statements about the client, 9 were generic advice to the reader and 4 calls to action. The
  // shapes the rules read as commitments, and are not:
  //   * an instruction to the reader, also as a list item under "We use five steps:" ("Inventory every customisation ...", "Map each
  //     report ...", "Run a parallel close ...") or after a short label ("AED and multi-currency. Ask how ...");
  //   * a buyer checklist item ("Why it matters: ... What to ask: ...") and an item of a readiness checklist ("One controls engineer and
  //     one data owner are named to own the pilot." under "Is your plant ready? A readiness checklist");
  //   * an invitation whose only promise is the conversation itself ("Book a consultation and we will test your shortlist against these
  //     criteria"), "Get in-touch" written with a hyphen, and "We will confirm whether ..." in the closing section.
  // An imperative under a lead-in that lists what the business delivers ("Our engagement includes:") is still read as a commitment.
  const IMPER = /^(?:inventory|classify|map|cleanse|clean up|run|check|ask|confirm|test|review|agree|define|document|set|plan|choose|pick|list|compare|budget|train|measure|start|keep|make|use|write|build|decide|identify|assess|validate|verify|prepare|involve|name|assign|segment|fit|skip|shortlist|avoid|limit|track|record|collect|export|archive|retire|replace|rebuild|reconcile|complete|schedule|estimate|secure|protect|align|prioriti[sz]e|score|rank|interview|gather|capture|label|monitor|log|weigh|insist on|require|treat|give|separate|apply|bring|move|freeze|lock|switch|upgrade|migrate|connect|integrate|expect|look for|watch|note|read|tie|link|cut|drop|add|remove|split|group|sort|count)\s+(?:every|each|all|the|a|an|your|our|one|two|three|four|five|six|how|whether|what|which|who|when|where|any|this|these|those|it|them|only|no|master|data|for|on|in|with|at|up|down|out|off|vendors|partners|reports|systems|users|staff|people|teams?|both|several|key|critical|current|existing|legacy|old|new)\b/i;
  const LABEL_LEAD = /^[A-Z][^.:!?]{1,50}[.:]\s+(?=[A-Z])/;   // "AED and multi-currency. Ask how ..." -> "Ask how ..."
  const CHECK_ITEM = /\b(?:what to ask|why it matters|what to check|questions? to ask|ask (?:how|whether|which|who|what|if|for|about))\b/i;
  const CHECKLIST_HEAD = /\b(?:checklist|check before|is your [^?]{1,40} ready|are you ready|readiness (?:check|test|questions)|self[- ]check|questions to ask|what to ask|before you (?:choose|buy|sign|start|shortlist|commit))\b/i;
  const INVITE_AND = /^(?:book|request|schedule|arrange|get in[- ]touch|contact|call|talk to|speak to|ask for|start with)\b[^.]{0,80}?\b(?:consultation|call|meeting|session|demo|review|assessment|chat|conversation)\b[^.]{0,40}?\b(?:and|then|so)\s+(?:we|our team)(?:\s+will|['’]ll)?\s+(?:review|test|check|confirm|assess|discuss|answer|walk you through|look at|go through|map|compare)\b/i;
  const TIME_TERM = /\b(?:within|in under|in less than)\s+\d|\b\d+\s*(?:hours?|days?|weeks?|months?|business days|working days)\b/i;
  const STANCE_VERB = /^(?:say|says|believe|think|feel|know|mean|tell|note|see|find|prefer|like|love|value|care|treat|consider|admit|agree|disagree)\b/i;
  const COMMIT_VERB = /\b(?:test|tests|build|builds|design|designs|deliver|delivers|provide|provides|offer|offers|document|documents|train|trains|run|runs|give|gives|hand|hands|include|includes|cover|covers|stop|stops|tell|tells|guarantee|guarantees|commit|commits|charge|charges|bill|bills|invoice|invoices|quote|quotes|set up|sets up|assign|assigns|monitor|monitors|support|supports|manage|manages|handle|handles|migrate|migrates|implement|implements|deploy|deploys|integrate|integrates|review|reviews|audit|audits|write|writes|create|creates|produce|produces|prepare|prepares|assess|assesses|track|tracks|measure|measures|refund|refunds|promise|promises|ensure|ensures|keep|keeps|work|works|serve|serves|start|starts|begin|begins|complete|completes|respond|responds|reply|replies|host|hosts|maintain|maintains|operate|operates|resell|resells|sell|sells|license|licenses|certif(?:y|ies)|has|have|had|is|are|was|were|holds?|employs?|costs?|takes?|lasts?|comes?|wins?|won)\b/;
  const OFFER_RE = /\b(?:you|your (?:team|teams|staff|people|users|admins|organisation|organization|business|company))\s+(?:will\s+|['’]ll\s+|also\s+|then\s+|always\s+)?(?:receive|receives|get|gets|keep|keeps|walk away with|leave with|are given|are handed|can expect|will have)\b|\b(?:business users|users|admins|makers)\s+(?:will\s+)?(?:get|gets|receive)\b/i;
  const TRAIN_RE = /^(?:admins|makers|(?:business )?users|staff|employees|your (?:team|staff|admins|users|people))\s+(?:learn|are trained|get trained|receive training)\b/i;
  const PHASE_RE = /^(?:this|each|every|the)\s+(?:phase|stage|step|engagement|service|workstream|programme|program|package|plan)\s+(?:covers|includes|ends|delivers|starts|runs|takes|comes with)\b/i;
  const PASSIVE_RE = /\b(?:is|are|will be|comes?|come)\s+(?:also\s+|always\s+)?(?:delivered|included|provided|offered|covered|handled|priced|billed|charged|backed|guaranteed|agreed|named|assigned|documented|defined|signed off|set up|tested|trained|reviewed|free of charge|at no (?:extra )?cost|part of (?:the|every|each|our|all)|available (?:to|for|with|at)|bundled|built in|supplied)\b/i;
  const COSTTIME_RE = /\b(?:costs?|starts? at|is priced at|takes|lasts|runs for)\s+(?:about\s+|around\s+|from\s+|just\s+|only\s+)?(?:(?:aed|usd|eur|gbp|sar|\$|€|£)\s?)?\d/i;
  const BILL_RE = /\b(?:quote|quotes|quoted|invoice\w*|billed|billing|line item|separate line|fees?|payment|deposit|retainer|hourly|day rate|licen[cs]es? (?:sit|are|is)|charged?)\b/i;
  const LEAD_HEAD = /\b(?:what you get|you get|you receive|deliverables?|includes?|included|what (?:we|\S+) (?:deliver|delivers|does|do|handles?|offers?|covers?|provides?)|our (?:services|engagement|approach|offer|packages?|scope))\b/i;
  // words that say nothing on their own about what is promised: they never count for or against support
  const GENERIC = new Set('you your receive get gets keep give gives offer provide include includes cover covers phase stage step engagement service then also each every well real live new own way part make makes work business client clients team teams solution solutions reason scope sometimes have has more than over typical typically either before after'.split(' ').map(stem));
  // a name that is only part of a fuller name of the business names something else ("peppol" is the network, "OpenPeppol" the
  // organisation): only the full names are a subject
  const fullNames = (list) => { const ns = (list || []).map(n => String(n || '').trim()).filter(n => n.length >= 3); const k = (n) => norm(String(n).replace(/&/g, 'and')).replace(/ /g, '');
    return ns.filter(n => !ns.some(o => k(o) !== k(n) && k(o).includes(k(n)))); };
  function commitments(text, corpus, opts = {}) {
    const t = String(text || ''); const out = { flags: [], checked: 0 };
    if (!t.trim()) return out;
    const names = fullNames(opts.names);
    const nameWords = [...new Set(names.flatMap(n => norm(n).split(' ')).filter(Boolean))];
    const skip = new Set((opts.skip || []).map(s => norm(s)));
    const NAMES = names.map(n => (/^\w/.test(n) ? '\\b' : '') + escR(n) + (/\w$/.test(n) ? '\\b' : '')).join('|');
    const NAME_RE = NAMES ? new RegExp('(?:' + NAMES + ')', 'i') : null;
    const NAME_VERB = NAMES ? new RegExp('(?:' + NAMES + ')(?:[\'’]s)?(?:\\s+(?:also|then|now|always|typically|usually|will|can|has|have))*\\s+' + COMMIT_VERB.source.slice(2), 'i') : null;
    const NAME_BY = NAMES ? new RegExp('\\b(?:with|from|by|at)\\s+(?:' + NAMES + ')', 'i') : null;
    // H2 (2026-10-27, exec 2195): "Nova& explains which edition suits UAE firms." says what the page explains, like "in this guide we cover ..."
    const NAME_NARR = NAMES ? new RegExp('^(?:' + NAMES + ')(?:\\s*\\([^)]*\\))?\\s+(?:explains|describes|outlines|shows|covers|compares|walks you through|sets out|answers)\\s+(?:which|how|what|why|when|whether|the|each|every)\\b', 'i') : null;
    const WE_SUBJ = /(?:^|[,;:]\s*|\b(?:and|but|so|then|that|because|where|when|if|once|after|before|until|while|which|or)\s+)(?:we|we['’](?:ll|re|ve|d))\s+(?!recommend|suggest|advise|encourage|urge)\S/i;
    const OUR_SUBJ = /(?:^|\b(?:and|but|so|then|because|while)\s+|[;:]\s*)our\s+\S+(?:\s+\S+){0,5}?\s+(?:is|are|was|were|has|have|will|can|also|costs?|starts?|takes?|includes?|covers?|runs?|lets?|helps?|handles?|monitors?|provides?|delivers?|offers?|works?|holds?|builds?|designs?|comes?|begins?|ends?|means?|gives?|charges?|bills?|supports?|serves?|keeps?|treats?|does|did|consists?)\b/i;
    const WITH_US = /\b(?:with|from|by)\s+us\b/i;
    const lead = (s) => s.replace(/^(?:yes|no|in short|in practice|today|also|first|next|finally|then|so|and|but|instead|however|in addition|for that reason|as a result|on top of that|after go-live|unlike [^,]{3,60}|as an? [^,]{3,60}|for [^,]{3,40}|after [^,]{3,40}|once [^,]{3,40}|during [^,]{3,40}|in [^,]{3,40}|at [^,]{3,40}|with [^,]{3,40}|if [^,]{3,80}|when [^,]{3,60}|where [^,]{3,60}),\s+/i, '');
    const nameFirst = (s) => { if (!NAME_RE) return false; const w = s.split(/\s+/).slice(0, 4).join(' '); const m = w.match(NAME_RE); if (!m) return false;
      const before = w.slice(0, m.index).trim().toLowerCase(); return !/\b(?:of|for|to|with|from|about|by|at|than|like|on|in)$/.test(before); };
    const bizSubject = (p) => { const s = lead(p);
      if (WE_SUBJ.test(s) && !ADVICE_WE.test(s)) return 'we';
      if (OUR_SUBJ.test(s)) return 'our';
      if (nameFirst(s) || (NAME_VERB && NAME_VERB.test(s))) return 'name';
      if (WITH_US.test(s) || (NAME_BY && NAME_BY.test(s))) return 'with';
      return null; };
    const quoteless = (s) => s.replace(/["“][^"“”]{3,300}["”]/g, ' ').replace(/\s+/g, ' ').trim();
    // the third party who acts: "from the FTA", "issued by the Ministry", "<Org> says"
    const thirdParty = (s) => { const m = s.match(/\b(?:from|by|issued by|with)\s+(?:the\s+)?([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*)*)/); return !!(m && !(NAME_RE && NAME_RE.test(m[1])) && !/^(?:Us|Our|We)$/.test(m[1])); };
    const cnorm = norm(canon(corpus));
    const cnums = new Set(numsOf(corpus));
    const csents = String(corpus || '').split(/(?<=[.!?])\s+|\n+/).map(s => canon(s)).filter(s => s.trim());
    const cs = []; for (let i = 0; i < csents.length; i++) { const one = csents[i]; const two = i + 1 < csents.length ? one + ' ' + csents[i + 1] : one;
      for (const x of (two === one ? [one] : [one, two])) { const w = new Set(words(x, nameWords)); if (w.size) cs.push({ w, low: x.toLowerCase() }); } }
    // H2 (2026-10-27, exec 949): a site's own page states one phase as a paragraph of short sentences ("We at Nova& begin with business
    // discovery ... translated into business requirements ... through gap-fit analysis ... with an ROI assessment"), and a page sentence
    // that names the phase sums it up; no single sentence of the paragraph carries half of it. A whole paragraph (one line of the text on
    // file, at most 1,200 characters) counts too, with a higher bar: 65% of the content words and at least three of them.
    const PARA_MIN = 0.65;
    const cpara = String(corpus || '').split(/\n+/).map(x => canon(x)).filter(x => x.length <= 1200 && (x.match(/[.!?](?:\s|$)/g) || []).length >= 2)
      .map(x => ({ w: new Set(words(x, nameWords)), low: x.toLowerCase() })).filter(x => x.w.size);
    const support = (plain, english) => {
      const c0 = canon(english || plain);
      const W = [...new Set(words(c0, nameWords))].filter(w => !GENERIC.has(w));
      const nums = numsOf(c0);
      const numsOk = nums.every(n => cnums.has(n) || (/ /.test(n) && cnorm.includes(n.split(' ')[0] + ' ' + n.split(' ')[1].slice(0, 4))));
      const strong = [...new Set((c0.match(STRONG) || []).map(x => x.toLowerCase()))];
      let best = 0, para = 0;
      for (const c of cs) { const r = W.length ? W.filter(w => c.w.has(w)).length / W.length : 0; if (r > best && strong.every(q => c.low.includes(q))) best = r; }
      if (W.length >= 3) for (const c of cpara) { const r = W.filter(w => c.w.has(w)).length / W.length; if (r > para && strong.every(q => c.low.includes(q))) para = r; }
      const byPara = best < 0.5 && para >= PARA_MIN;
      return { W, best: byPara ? para : best, numsOk, ok: numsOk && W.length > 0 && (best >= 0.5 || byPara), ...(byPara ? { paragraph: true } : {}) };
    };
    // H2 (2026-10-27, execs 949 / 2552 / 2575): "We work from Faisalabad as well as Ajman, so site visits ... are practical" and "We are a
    // Microsoft partner, so weigh our view of SAP with that in mind" state one fact on file and draw a consequence from it. The fact is
    // what is held against the file; the consequence is read only when it is itself a term (a price, a guarantee, a number not on file)
    // or a commitment in the business's own voice ("..., so we deliver it in 4 weeks"); a stance ("so we also say where ...") is not. Only a
    // head in the business's own voice (we / our / its name) is split, and a consequence that limits or ranks ("only", "first") is read whole.
    const SO_RE = /^(.{8,}?),\s+so\s+(.{6,})$/i; const STRONG_ONE = new RegExp(STRONG.source, 'i');
    const supportSo = (plain) => { const sp = supportJoined(plain); if (sp.ok) return sp; const m = plain.match(SO_RE); if (!m) return sp;
      const tail = m[2]; const tn = numsOf(tail); const hb = bizSubject(m[1]);
      if (!hb || hb === 'with' || STRONG_ONE.test(tail.replace(/\bnot (?:always )?(?:the|a)\s+(?:best|first|only|right)\b/gi, ' ')) || CTA_TERMS.test(tail) || TIME_TERM.test(canon(tail)) || !tn.every(n => cnums.has(n))) return sp;
      const tw = tail.match(/^(?:we|we['’]ll|our team)\s+(?:(?:also|then|always|will|can|usually|typically)\s+)*(\S+)/i);
      if (tw && !STANCE_VERB.test(tw[1]) && !supportJoined(tail).ok) return sp;
      const hs = supportJoined(m[1]); return hs.ok ? { ...hs, so_split: true } : sp; };
    // CT-FIX2 (live page 2026-10-22, D1): "We serve enterprises across the UAE and the GCC and bring 20+ years of industry experience" joins
    // two facts that sit in two places on file; each half is held against the facts on its own, and the sentence is supported when both are
    const JOIN_RE = /,?\s+and\s+(?=(?:we\s+|also\s+)?(?:bring|brings|have|has|hold|holds|serve|serves|offer|offers|deliver|delivers|run|runs|work|works|employ|employs|support|supports|operate|operates)\b)/i;
    const supportJoined = (plain, english) => { const sp = support(plain, english); if (sp.ok || english || !JOIN_RE.test(plain)) return sp;
      const parts = plain.split(JOIN_RE).map(x => x.trim()).filter(x => x.length >= 8); if (parts.length < 2) return sp;
      const subj = (plain.match(/^(\S+(?:\s+\S+)?)\s/) || [])[1] || '';
      const sps = parts.map((x, i) => support(i === 0 ? x : subj + ' ' + x));
      return sps.every(x => x.ok) ? { ...sp, best: Math.min(...sps.map(x => x.best)), ok: true, joined: true } : sp; };
    // the facts on file closest to a sentence (for the second reader): up to 3, the best word overlap first
    const topFacts = (plain) => { const W = [...new Set(words(canon(plain), nameWords))].filter(w => !GENERIC.has(w)); if (!W.length) return [];
      const sc = []; for (let i = 0; i < csents.length; i++) { const ws = new Set(words(csents[i], nameWords)); const r = W.filter(w => ws.has(w)).length / W.length; if (r > 0) sc.push([r, i]); }
      sc.sort((a, b) => b[0] - a[0]); return sc.slice(0, 3).map(([, i]) => csents[i].trim().slice(0, 400)); };
    // a phase or a service the business names on file, as the subject: "Run & Optimize covers ...", "Assess & Envision includes ..."
    const PHASE_SUBJ = /^([A-Z][\w-]*(?:\s+(?:&|and)\s+[A-Z][\w-]*)+)\s+(?:also\s+|then\s+)?(?:covers?|includes?|adds?|extends?|delivers?|provides?|ends?|starts?|runs?|takes?|gives?|keeps?|sets?|handles?|brings?|is|are)\b/;
    const phaseSubject = (s) => { const m = s.match(PHASE_SUBJ); return !!(m && norm(m[1]).length >= 6 && cnorm.includes(norm(m[1]))); };
    const TITLE_SUBJ = /^((?:[A-Z][\w&-]*\s+){0,3}[A-Z][\w&-]*)\s+(?:also\s+)?[a-z]+s\b/;
    const onFileSubject = (s) => { const m = s.match(TITLE_SUBJ); return !!(m && norm(m[1]).length >= 6 && cnorm.includes(norm(m[1]))); };
    const cands = []; const seenC = new Set();
    const addCand = (o) => { const k = norm(o.plain); if (!k || seenC.has(k)) return; seenC.add(k); cands.push(o); };
    // sections: one H2 group = the H2 and the H3s under it; a list item remembers its lead-in
    const groups = []; let g = null, para = [], lastLead = null, headLead = null;
    const flushPara = () => { if (para.length && g) { const p = para.join(' '); g.items.push({ p, kind: 'para' }); lastLead = /:\s*$/.test(p) ? p : null; } para = []; };
    for (const line of t.split('\n')) {
      const L = line.trim();
      const h = L.match(/^(#{1,6})\s+(.*)$/);
      if (h) { flushPara(); if (h[1].length <= 2 || !g) { g = { heads: [], items: [] }; groups.push(g); } g.heads.push(h[2]); headLead = h[2]; lastLead = null; g.items.push({ p: h[2], kind: 'head' }); continue; }
      if (!g) { g = { heads: [], items: [] }; groups.push(g); }
      // W0-A (2026-10-29, page-quality PLAN Fix 1, R4 D1): the meta description is search-result copy written from the brief, not a
      // statement on the page. Read as a claim, its call to action ("then book a consultation with ...") was wrapped, emptied and asked as a
      // client question (production run 3299). It is skipped like the title and the slug; PF.meta (_page_fix.js) gives it one narrow field
      // check (a price, a guarantee, a timeline or a number not on file is dropped) instead.
      if (!L || /^\[[^\]]*\]$/.test(L) || /^(?:Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)\s*:/i.test(L)) { flushPara(); if (!L) { /* a blank line keeps the lead-in for the list below it */ } continue; }
      if (/^\|/.test(L)) { flushPara(); if (/^\|[\s:|-]+\|?$/.test(L)) { const hd = g.items[g.items.length - 1]; if (hd && hd.kind === 'table') g.items.pop(); continue; }   // the header row is labels, not a statement
        g.items.push({ p: L.replace(/^\||\|$/g, '').split('|').map(x => x.trim()).filter(Boolean).join('; ') + '.', kind: 'table' }); continue; }
      if (/^(?:[-*]|\d+[.)])\s+/.test(L)) { const leadIn = para.length ? para.join(' ') : null; flushPara(); g.items.push({ p: L.replace(/^(?:[-*]|\d+[.)])\s+/, ''), kind: 'li', lead: leadIn && /:\s*$/.test(leadIn) ? leadIn : lastLead, head: headLead }); continue; }
      para.push(L);
    }
    flushPara();
    // CT-FIX2 (live page 2026-10-22, D3): an image caption is read as a statement on the page (card 3 repeated the go / no-go promise)
    for (const c of (opts.captions || [])) { const txt = String(c || '').trim(); if (txt) groups.push({ heads: [], items: [{ p: txt, kind: 'caption' }], captions: true }); }
    const headOnFile = (hd) => { const pre = norm(String(hd).split(':')[0]); return pre.length >= 6 && cnorm.includes(pre); };
    const clean = (s) => s.replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim();
    const sentsOf = (p) => p.replace(/\*\*/g, '').split(/(?<=[.!?])\s+(?=[A-Z"(\[“؀-ۿ])|(?<=[.!?؟])\s+/).map(s => s.trim()).filter(Boolean);
    const isLast = (G) => groups.filter(x => x.heads.length).slice(-1)[0] === G && groups.filter(x => x.heads.length).length >= 2;
    const ctaGroup = (G) => G.heads.some(hd => CTA_HEAD.test(hd) || /\?\s*$/.test(hd) && /\b(?:ready|want|need) to\b/i.test(hd)) || isLast(G);
    for (const G of groups) {
      const aboutBiz = !!G.captions || G.heads.some(hd => headOnFile(hd) || (NAME_RE && NAME_RE.test(hd)) || /\b(?:we|our|us)\b/i.test(hd))
        || G.items.some(it => it.kind === 'para' && sentsOf(it.p).some(s => bizSubject(quoteless(clean(s)))));
      const cta = ctaGroup(G);
      for (const it of G.items) {
        if (it.kind === 'head' && !(WE_SUBJ.test(lead(clean(it.p))) || (NAME_VERB && NAME_VERB.test(clean(it.p))))) continue;   // a heading is read only when it is a sentence with the business as subject ("Why Tech&" is a label)
        const sents = (it.kind === 'li' || it.kind === 'table' || it.kind === 'head' || it.kind === 'caption') ? [it.p] : sentsOf(it.p); let lastBill = false;
        for (const s of sents) {
          const plain0 = clean(s);
          const full = s.replace(/^[-*]\s+/, '');
          if (plain0.length < 12 || /[?؟]\s*$/.test(plain0) || /[\[\]]/.test(s.replace(/!?\[[^\[\]]*\]\([^)]*\)/g, '')) || skip.has(norm(s))) { lastBill = skip.has(norm(s)) && BILL_RE.test(plain0); continue; }
          if (ARABIC.test(plain0)) {   // Arabic: the first person plural or an offer; the same support rule through the lexicon
            const why = arOurs(plain0); if (!why || (why === 'offer' && !aboutBiz)) continue;
            out.checked++;
            const en = arToEnglish(plain0); const sp = support(plain0, en.text);
            if (opts.trace) out.trace = (out.trace || []).concat([{ s: plain0.slice(0, 90), why: 'ar-' + why, W: sp.W, best: Math.round(100 * sp.best), numsOk: sp.numsOk }]);
            if (sp.ok && en.terms >= 2) { if (opts.collect) addCand({ sentence: full, plain: plain0, why: 'ar-' + why, rule_flag: false, support: Math.round(100 * sp.best), kind: 'process', where: it.kind, facts: topFacts(en.text) }); continue; }
            const ek = en.text;
            const akind = /guarantee|refund/.test(ek) ? 'guarantee' : /fee|cost|price|aed|discount|free/.test(ek) ? 'pricing' : /certif/.test(ek) ? 'credential' : /weeks|days|months/.test(ek) ? 'timeline' : why === 'offer' ? 'deliverable' : 'process';
            out.flags.push({ kind: akind, sentence: full, support: Math.round(100 * sp.best), where: it.kind, rewrite: neutral(full, { kind: akind, corpus, business: names[0] }) });
            if (opts.collect) addCand({ sentence: full, plain: plain0, why: 'ar-' + why, rule_flag: true, support: Math.round(100 * sp.best), kind: akind, where: it.kind, facts: topFacts(en.text) });
            continue;
          }
          if (it.kind === 'para' && /:\s*$/.test(plain0)) { lastBill = false; continue; }   // a lead-in ("Our engagement includes:") introduces the list; its items are read
          const hasQuote = /["“][^"“”]{3,300}["”]/.test(plain0);
          const plain = quoteless(plain0);
          if (hasQuote && SAY_RE.test(plain)) { lastBill = false; continue; }   // a quotation with its speaker: their words, not ours
          const L0 = lead(plain);
          if (ADVICE_WE.test(L0) && opts.collect && !NARR_OPEN.test(plain)) addCand({ sentence: full, plain, why: 'advice', rule_flag: false, support: 0, kind: 'process', where: it.kind, facts: topFacts(plain) });   // "we recommend a go / no-go review ...": the second reader decides
          if (NARR_OPEN.test(plain) || NARR_VERB.test(L0) || EXAMPLE_RE.test(plain) || ADVICE_WE.test(L0)) { lastBill = false; continue; }
          const pc = plain.replace(PURPOSE_LEAD, '');   // CT-FIX2 (D2): "To test one use case first, [book a call]" is the invitation itself
          if (cta && (CTA_START.test(pc) || CTA_FOLLOW.test(pc)) && !CTA_TERMS.test(pc)) { lastBill = false; continue; }   // the call to action invites a conversation; a price or a guarantee in it is still a term
          if (CTA_START.test(pc) && !/\b(?:and|then)\s+(?:we|our team)\b/i.test(pc) && !CTA_TERMS.test(pc)) { lastBill = false; continue; }   // an imperative on its own is advice or an invitation
          // H2 (2026-10-27): advice to the reader, a buyer or readiness checklist item, an invitation to the conversation on file, the page's
          // own narration in the business's name (see IMPER above); an imperative under a lead-in that lists deliverables is still read
          const pcl = (it.kind === 'li' || it.kind === 'table') ? pc.replace(LABEL_LEAD, '') : pc;
          const bizLead = it.kind === 'li' && !!it.lead && LEAD_HEAD.test(it.lead);
          if (!bizLead && !CTA_TERMS.test(pc) && !/\b(?:and|then)\s+(?:we|our team)\b/i.test(pcl) && (IMPER.test(pc) || IMPER.test(pcl) || CTA_START.test(pcl))) { lastBill = false; continue; }
          if (it.kind === 'li' && !bizLead && !bizSubject(plain) && (CHECK_ITEM.test(plain) || G.heads.some(hd => CHECKLIST_HEAD.test(hd)))) { lastBill = false; continue; }
          if (INVITE_AND.test(pc) && !CTA_TERMS.test(pc) && !TIME_TERM.test(canon(pc))) { lastBill = false; continue; }
          if (NAME_NARR && NAME_NARR.test(pc)) { lastBill = false; continue; }
          let why = null; const subj = bizSubject(plain);
          if (subj) why = subj;
          else if (phaseSubject(plain)) why = 'phase';   // CT-FIX2 (D3): a phase on file as the subject is the business speaking
          else if (it.kind === 'li' && ((it.lead && (bizSubject(clean(it.lead)) || (NAME_RE && NAME_RE.test(it.lead)) || LEAD_HEAD.test(it.lead) || /\b(?:we|our)\b/i.test(it.lead))) || (!it.lead && it.head && LEAD_HEAD.test(it.head) && (aboutBiz || (NAME_RE && NAME_RE.test(it.head)))))) why = 'list';
          else if (aboutBiz && it.kind !== 'head' && !thirdParty(plain)) {
            if (OFFER_RE.test(plain)) why = 'offer';
            else if (TRAIN_RE.test(plain) || PHASE_RE.test(plain)) why = 'phase';
            else if (PASSIVE_RE.test(plain) || COSTTIME_RE.test(plain)) why = 'passive';
            else if (lastBill && BILL_RE.test(plain)) why = 'billing';
          }
          if (why && (why === 'offer' || why === 'with') && thirdParty(plain)) why = null;
          lastBill = !!why && BILL_RE.test(plain);
          if (!why) {   // not a commitment to the rules; a wider net for the second reader: a section about the business, a name on file as the subject, the business named
            if (opts.collect && !thirdParty(plain) && ((aboutBiz && (COMMIT_VERB.test(plain.toLowerCase()) || OFFER_RE.test(plain) || PASSIVE_RE.test(plain))) || onFileSubject(plain) || (NAME_RE && NAME_RE.test(plain)) || /\b(?:we|our|us)\b/i.test(plain)))
              addCand({ sentence: full, plain, why: 'wide', rule_flag: false, support: 0, kind: 'process', where: it.kind, facts: topFacts(plain) });
            continue;
          }
          out.checked++;
          const lab = why === 'list' && s.match(/^\s*\*\*([^*]{3,60}?):?\*\*:?\s+\S/);   // "**AI strategy:** candidate use cases ...": the label is the service the lead-in commits to
          const sp0 = supportSo(plain); const sp = (!sp0.ok && lab && support(lab[1]).ok) ? support(lab[1]) : sp0;
          if (opts.trace) out.trace = (out.trace || []).concat([{ s: plain.slice(0, 90), why, W: sp.W, best: Math.round(100 * sp.best), numsOk: sp.numsOk }]);
          if (sp.ok || !sp.W.length) { if (opts.collect) addCand({ sentence: full, plain, why, rule_flag: false, support: Math.round(100 * sp.best), kind: 'process', where: it.kind, facts: topFacts(plain) }); continue; }   // nothing but generic words: nothing to hold against the facts
          const kind = /\b(?:charg|bill|fee|price|pricing|quote|invoice|payment|licen[cs]es? (?:sit|are)|separate line|cost|free|discount)/i.test(plain) ? 'pricing'
            : /\b(?:guarantee|warrant|refund|promise)/i.test(plain) ? 'guarantee'
              : /\b(?:within|\d+\s*(?:days?|weeks?|months?|hours?|minutes?))\b|\b(?:days|weeks|months)\b/i.test(canon(plain)) ? 'timeline'
                : /\b(?:certified|certif|accredit|partner|iso)/i.test(plain) ? 'credential'
                  : /\b(?:stop|only|not|never|scope|covers|includes)\b/i.test(plain) ? 'scope'
                    : (why === 'offer' || why === 'phase' || why === 'list' || why === 'passive' || /\b(?:deliver|provide|runbook|pack|report|dashboard|document)/i.test(plain)) ? 'deliverable' : 'process';
          // E-CLAIM / CT-FIX: the WHOLE sentence is returned (Content QA finds and wraps it in the copy); a display cut belongs to the reader
          out.flags.push({ kind, sentence: full, support: Math.round(100 * sp.best), where: it.kind, rewrite: neutral(full, { kind, corpus, business: names[0] }) });   // H2: what to do with it (additive)
          if (opts.collect) addCand({ sentence: full, plain, why, rule_flag: true, support: Math.round(100 * sp.best), kind, where: it.kind, facts: topFacts(plain) });
        }
      }
    }
    if (opts.collect) out.candidates = cands;
    return out;
  }
  // CT-FIX2 (2026-10-22): does ONE fact carry a sentence? Every number of the sentence is on that fact and at least 40% of its content
  // words. The second reader's "supported by F3" is accepted only when this holds (evaluation run 2: Haiku named a fact for "Our
  // fixed-price readiness assessment costs AED 25,000" that carries no price).
  const backs = (sent, fact) => { const c0 = canon(sent); const nums = numsOf(c0); const fn = new Set(numsOf(fact));
    if (!nums.every(n => fn.has(n))) return false;
    const W = [...new Set(words(c0, []))].filter(w => !GENERIC.has(w)); if (!W.length) return true;
    const F = new Set(words(canon(fact), [])); return W.filter(w => F.has(w)).length / W.length >= 0.4; };
  // ---- H2 (2026-10-27): what to do with a flagged sentence (R1 §3.3 and recommendation 3 / 9) ----
  // CL.neutral(sentence, { kind, corpus, business }) -> { action, neutral, needs_client_fact, question, suggestion, why }. Deterministic,
  // no model. Three outcomes:
  //   * reword: a method or step written in the business's voice keeps its value as advice to the reader, so it is rewritten without the
  //     business as subject ("We use five steps:" -> "A five-step approach works well:", "In those projects, we check that every VAT
  //     code ..." -> "Check that every VAT code ...", "As an ISO 27001 certified team, we give each AI service ..." -> "Give each AI
  //     service ..."); needs_client_fact false;
  //   * delete: a stance in the business's name with nothing to keep ("When Business Central is enough, we say so"); false as well;
  //   * ask: a deliverable, term, price, time, guarantee, credential, location or number only the client can confirm. `question` is the
  //     plain question to put to the client and `suggestion` the closest thing their own site and facts on file already say (empty when
  //     nothing is close), so the answer can start from it. needs_client_fact true.
  const NEUTRAL_KEEP = /^(?:are|is|was|were|have|has|had|hold|holds|employ|employs|serve|serves|work|works|bring|brings|deliver|delivers|offer|offers|provide|provides|charge|charges|guarantee|guarantees|promise|promises|send|sends|give you|hand)\b/i;
  const NEUTRAL_STANCE = /^(?:say|says|believe|think|feel|know|mean|tell|note|admit|agree|disagree)\b/i;
  const capFirst = (x) => x ? x.charAt(0).toUpperCase() + x.slice(1) : x;
  function neutral(sentence, o = {}) {
    const raw = String(sentence || '').replace(/^\[(?:Confirm|Owner)[^:]*:\s*/i, '').replace(/\]$/, '');
    const s0 = raw.replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim();
    const biz = String(o.business || '').trim() || 'the business';
    const kind = String(o.kind || '');
    const out = { action: 'ask', neutral: '', needs_client_fact: true, question: '', suggestion: '', why: '' };
    if (!s0) return out;
    // the closest statement the business already makes about itself (its own pages, facts, profile)
    const W = [...new Set(words(canon(s0), []))].filter(w => !GENERIC.has(w));
    let best = 0, bestS = '';
    if (W.length) for (const c of String(o.corpus || '').split(/(?<=[.!?])\s+|\n+/)) { const t = c.trim(); if (t.length < 20 || t.length > 400) continue;
      const cw = new Set(words(canon(t), [])); const r = W.filter(w => cw.has(w)).length / W.length; if (r > best) { best = r; bestS = t; } }
    const suggestion = best >= 0.25 ? bestS.slice(0, 300) : '';
    let s = s0.replace(/^(?:in (?:those|these|our|such|all|most) (?:projects|engagements|cases|implementations|rollouts),?\s+|in practice,?\s+|as an? [^,]{3,60},\s+|before [^,]{3,60},\s+)/i, '');
    // what is left once the lead is gone decides: "As an ISO 27001 certified team, we give ..." keeps only the method
    const nums = numsOf(canon(s)).filter(n => !/^365$/.test(n));
    const termy = CTA_TERMS.test(s) || TIME_TERM.test(canon(s)) || nums.length > 0 || OFFER_RE.test(s);
    const kindNow = /\b(?:guarantee|warrant|refund)/i.test(s) ? 'guarantee' : /\b(?:certified|certif|accredit|partner|iso)\b/i.test(s) ? 'credential' : (kind === 'credential' || kind === 'guarantee') ? 'process' : kind;
    const ownWork = /\b(?:consultations?|engagements?|our clients|with clients|client projects|projects we)\b/i;   // "We use this self-check in first consultations": the business's own practice, only it can say
    if (/\b(?:we|our team)\s+(?:(?:also|will|always|simply)\s+)*(?:say so|tell you so|say where|admit|believe|think|feel)\b/i.test(s0) && !termy) {
      out.action = 'delete'; out.needs_client_fact = false; out.why = 'a stance in the business\'s name that adds nothing the reader can use; delete it'; return out; }
    // "We use five steps:" -> "A five-step approach works well:"
    let m = s.match(/^(?:we|our team)\s+(?:use|follow|run|apply)\s+(?:a\s+)?([a-z0-9]+)[- ](?:steps?|stages?|phases?|checks?|questions?)\b\s*(.*)$/i);
    if (m && !termy) { const tail = m[2].replace(/^[:.]\s*/, '');
      out.neutral = 'A ' + m[1].toLowerCase() + '-step approach works well' + (tail ? ': ' + tail : ':'); out.action = 'reword'; out.needs_client_fact = false; out.why = 'a method, rewritten as advice to the reader'; return out; }
    m = s.match(/^(?:we|we['’]ll|our team)\s+((?:(?:also|then|always|first|will|can|usually|typically|carefully|still)\s+)*)([a-z-]+)\b\s*(.*)$/i);
    if (m && NEUTRAL_STANCE.test(m[2]) && !termy) { out.action = 'delete'; out.needs_client_fact = false; out.why = 'a stance in the business\'s name that adds nothing the reader can use; delete it'; return out; }
    if (m && !termy && !ownWork.test(m[3]) && !NEUTRAL_KEEP.test(m[2]) && !['guarantee', 'credential'].includes(kindNow) && m[3].length >= 8) {
      const verb = m[2].toLowerCase().replace(/^(\w+?)(?:ies)$/, '$1y');
      const rest = m[3].replace(/,?\s+and\s+(?:we|our team)\s+(?:also\s+|then\s+|will\s+)*/gi, ', and ').replace(/\bour\b/gi, 'your').replace(/\bus\b/g, 'your team');
      out.neutral = capFirst(verb) + ' ' + rest.replace(/\s+$/, ''); if (!/[.!?:]$/.test(out.neutral)) out.neutral += '.';
      out.action = 'reword'; out.needs_client_fact = false; out.why = 'a method or step, rewritten as advice to the reader'; return out; }
    // everything else needs the client: a question with the closest fact on file
    const q = s0.length > 140 ? s0.slice(0, 137).replace(/\s+\S*$/, '') + ' ...' : s0;
    const Q = { pricing: 'What does ' + biz + ' charge for this, and may the page say it?',
      guarantee: 'Does ' + biz + ' offer this guarantee in writing, and may the page say it?',
      timeline: 'How long does this take with ' + biz + ', and may the page give that time?',
      credential: 'Which certification or partner status does ' + biz + ' hold for this, and may the page name it?',
      deliverable: 'What does a client of ' + biz + ' receive at this step?',
      scope: 'Does ' + biz + ' do this, and is it part of every engagement?' };
    out.question = (Q[kindNow] || 'Is this true for ' + biz + '?') + ' The page says: "' + q + '"';
    out.suggestion = suggestion;
    out.why = suggestion ? 'only the client can confirm it; the closest thing on file is offered as a starting point' : 'only the client can confirm it; nothing on file is close';
    return out;
  }
  return { CLAIM_RE, keyOf, check, business, commitments, canon, numsOf, arNorm, backs, neutral };
})();

// ---- the draft gate (L2, system review 2026-10-11; inlined by the build next to the link kit, the outreach kit and the claims kit) ----
// Every outreach e-mail passes the same deterministic checks before it is offered for approval: it says nothing about the business that the
// facts do not carry (CL, D14), it leaves nothing for the owner to fill in, it writes to an address on the prospect's own domain, it quotes
// something that is really on their page, it carries exactly one link — our chosen page on our canonical host —, it is short, it makes one
// clear ask, it avoids the words we never use, and it writes the business name as the site model has it. A draft that fails is held
// ("needs_edit") with its reasons instead of being offered; nothing is ever sent from here.
// The app mirrors these rules in app/shared/src/draft-qa.ts (the approval queue refuses a held draft, automatic mode skips it): the two must
// change together, as Cadence_Plan.js and app/server/src/services/cadence.ts do.
const DQ = (() => {
  const LIMITS = { first: 120, press_first: 200, followup: 60, subject: 70 };
  const BANNED = [[/\bback\s?links?\b/i, 'the word "backlink"'], [/\b(do|no)-?follow\b/i, 'link jargon'], [/\blink (building|exchange|swap|juice)\b/i, 'link jargon'],
    [/\b(seo|serps?)\b/i, 'SEO jargon'], [/\b(domain authority|domain rating|\bda\s?\d{1,3}\b|\bdr\s?\d{1,3}\b)/i, 'authority metrics'],
    [/\b(ai (answers?|assistants?|search|overview|overviews|mode|visibility)|chatgpt|perplexity|copilot|gemini)\b/i, 'how we found them (AI answers)'],
    [/\b(ranks?|ranking|rankings|rank higher|search rankings)\b/i, 'talk of rankings'],
    [/\b(world.?class|best.in.class|revolutionary|cutting.edge|game.chang\w+|one.stop.shop|leading provider)\b/i, 'hype'],
    [/i hope (this|you) (e-?mail |message )?(finds you well|are doing well)|i('ve| have) been (reading|following) (your|the) (blog|site|work|newsletter) for (years|a while|some time)/i, 'filler or fake familiarity'],
    [/\b(guest post|sponsored post|paid (link|placement)|in exchange for a link)\b/i, 'an offer we never make']];
  const STOPW = new Set('the and for with from your our you are was has have that this they their them will can into out about more most than then when what which who why how not but any one two all its also been being here there over under per via'.split(' '));
  const S = (v) => String(v == null ? '' : v);
  const wordCount = (t) => S(t).replace(/\[[^\]]*\]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const linksIn = (t) => [...S(t).matchAll(/https?:\/\/[^\s<>()"'\]]+/gi)].map(m => m[0].replace(/[.,;:!?)\]]+$/, ''));
  const bracketsIn = (t) => [...S(t).matchAll(/\[[^\]\n]{1,160}\]/g)].map(m => m[0]);
  const hostOf = (u) => S((S(u).match(/^https?:\/\/([^\/?#]+)/i) || [])[1]).toLowerCase().replace(/^www\./, '');   // the sandbox has no URL constructor
  const pathKey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const grams = (t, n) => { const w = S(t).toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter(x => x.length > 2 && !STOPW.has(x)); const out = [];
    for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n).join(' ')); return out; };
  // something from their page really said back to them: three distinctive words in a row from the page title, the evidence we stored or the
  // dead link's text / address (it is what makes a first line personal, and what the research says doubles replies)
  const quotesThem = (body, cands) => { const B = new Set(grams(body, 3));
    for (const c of cands) { for (const g of grams(c, 3)) if (B.has(g)) return g; } return ''; };
  const mask = (e) => { const [u = '', d = ''] = S(e).toLowerCase().split('@'); return u.slice(0, 1) + '***@' + d; };
  /** d: { type, steps: [{ subject, body }], to, prospect_domain, page_url, page_title, evidence, dead }
   *  ctx: { facts, signer, brand, brand_known, domain, canonical_host, target_url, competitors, accreditation / accredited } */
  function check(d, ctx) {
    const c = ctx || {}; const type = S(d.type); const press = type === 'press' || type === 'digest';   // L5: a request from a journalist digest is a press answer (its reply address is the digest's, and an answer may be longer than a pitch)
    const steps = (d.steps || []).map(x => ({ step: Number(x.step) || 0, subject: S(x.subject), body: S(x.body) }));
    const held = [], notes = [];
    const add = (why) => { if (why && !held.includes(why)) held.push(why); };
    if (!steps.length || !steps[0].body.trim()) { return { ok: false, held: ['no e-mail was written'], notes, steps }; }
    if (!steps[0].subject.trim()) add('the first e-mail has no subject');
    // 1. nothing left for the owner to fill in (a bracket is deliberate: the writer must not guess — but it cannot be sent as it stands)
    for (const st of steps) for (const b of bracketsIn(st.body + ' ' + st.subject)) add('needs you: ' + b.slice(0, 80));
    // 2. claims the facts on file do not carry are wrapped for the owner (CL, D14) and held
    for (const st of steps) { const r = CL.check(st.body, c.facts, { skip: c.signer, ours: true, brand: c.brand }); st.body = r.text;
      for (const f of r.flags) add('needs your confirmation: "' + S(f.claim).slice(0, 60) + '"'); }
    // 3. the recipient is on the prospect's own domain (never an address found on their page that belongs to someone else)
    const toDomain = S(d.to).toLowerCase().split('@')[1] || '';
    // a journalist request is answered at the address in the request (the "prospect" is a post, not a website), so it is exempt
    if (d.to && d.prospect_domain && !press && !d.prospect_domain.includes('/') && !(LK.sameSite(toDomain, d.prospect_domain) || LK.sameSite(d.prospect_domain, toDomain)))
      add('the address ' + mask(d.to) + ' is not on ' + d.prospect_domain);
    // 4. exactly one link per e-mail, ours, on our canonical host, and the page we chose
    const host = S(c.canonical_host || c.domain).toLowerCase().replace(/^www\./, '');
    steps.forEach((st, i) => { const ls = linksIn(st.body);
      if (ls.length > 1) add((i ? 'follow-up ' + i : 'the first e-mail') + ' carries ' + ls.length + ' links (one, to your page)');
      for (const u of ls) { const h = hostOf(u);
        if (!LK.sameSite(h, c.domain) && !LK.sameSite(c.domain, h)) add((i ? 'follow-up ' + i : 'the first e-mail') + ' links to ' + (h || 'nowhere') + ', not to your site');
        else if (host && h !== host) add('the link uses ' + h + '; your site is served on ' + host); } });
    if (!linksIn(steps.map(x => x.body).join('\n')).length) add('no link to your page');
    else if (c.target_url && !steps.some(st => linksIn(st.body).some(u => pathKey(u) === pathKey(c.target_url)))) add('none of the e-mails links to the page we chose (' + S(c.target_url).slice(0, 80) + ')');
    // 5. who is being written to (a stored "ready" row from an older run can still be one of these)
    add(OK.badHost(d.prospect_domain));
    if (OK.isGov(d.prospect_domain)) add('a government site: it lists providers through accreditation or an application, never through a pitch');
    add(OK.homepageOnly(type, d.page_url));
    add(OK.sellsSame({ type, domain: d.prospect_domain, competitors: c.competitors || [], serp_rivals: c.serp_rivals || [], ai_rivals: c.ai_rivals || [], topics: c.topics || [], title: d.page_title, url: d.page_url }));   // R21
    if (!(c.accredited === undefined ? OK.accredited(c.accreditation) : c.accredited) && OK.accreditedList(S(d.page_title) + ' ' + S(d.page_url)))
      add('a list of accredited / approved providers: the facts on file do not say you hold that accreditation');
    // 6. a real quote from their page (only when we have evidence to quote)
    if (S(d.evidence).trim() || S(d.page_title).trim()) {
      const cands = [d.page_title, d.evidence, (d.dead || {}).anchor, S((d.dead || {}).url).replace(/[\/_.-]+/g, ' ')].map(S).filter(Boolean);
      if (!quotesThem(steps[0].body + ' ' + steps[0].subject, cands)) add('the first e-mail quotes nothing that is on their page');
    }
    // 7. length, subject, one clear ask
    const w0 = wordCount(steps[0].body); const lim = press ? LIMITS.press_first : LIMITS.first;
    if (w0 > lim) add('the first e-mail is ' + w0 + ' words (at most ' + lim + ')');
    if (steps[0].subject.length > LIMITS.subject) add('the subject is ' + steps[0].subject.length + ' characters (at most ' + LIMITS.subject + ')');
    steps.slice(1).forEach((st, i) => { const w = wordCount(st.body); if (w > LIMITS.followup) add('follow-up ' + (i + 1) + ' is ' + w + ' words (at most ' + LIMITS.followup + ')'); });
    const asks = (steps[0].body.match(/\?/g) || []).length;
    if (asks > 2) add('the first e-mail asks ' + asks + ' questions: make one clear ask');
    if (!press && !asks && !/\b(would you|could you|can you|are you|let me know|happy to (send|share)|glad to send|glad to share|shall i|if (it|that|this) (helps|fits|is useful|would help))\b/i.test(steps[0].body))
      add('the first e-mail makes no clear ask');
    // 8. words we never use
    for (const st of steps) for (const [re, why] of BANNED) if (re.test(st.body) || re.test(st.subject)) add('uses ' + why);
    // 9. the business name exactly as the site model has it (the domain label is not a brand: "techand" for Tech&)
    const brandKey = S(c.brand).toLowerCase().replace(/[^a-z0-9]+/g, '');
    const label = S(c.domain).split('.')[0].toLowerCase();
    if (c.brand_known && label.length >= 4 && !brandKey.includes(label)) {
      const re = new RegExp('(^|[^a-z0-9.@/])' + label + '($|[^a-z0-9.@-])', 'i');
      if (steps.some(st => re.test(st.body) || re.test(st.subject))) add('writes the business name as "' + label + '"; it is "' + c.brand + '"');
    }
    if (c.brand_known && !OK.namesUs(steps[0].body, [c.brand])) notes.push('the first e-mail never names the business');
    return { ok: !held.length, held, notes, steps };
  }
  return { LIMITS, check, quotesThem, grams, linksIn, bracketsIn, wordCount };
})();

// ---- subject-line A/B (L7, LINK_BUILDER_SPEC.md §2): two subjects a batch, the reply rate per variant, and silence until there is
// enough to read. The writer gives every batch two subjects; each drafted sequence carries one of them (A, B, A, B … across the batch),
// so the two go out in equal numbers. Nothing is sent that a person has not approved: this only decides which subject a draft carries.
// **No verdict under MIN_SENDS first e-mails per variant** — at 12 sends a 2-point difference in reply rate is noise, so the counts are
// shown and the line reads "not enough sends yet". Mirrored in app/shared/src/outreach.ts (`subjectAbStats`, `subjectVariantFor`):
// the two must change together.
const AB = (() => {
  const MIN_SENDS = 30;            // per variant, before anything may be called ahead (first e-mails only; follow-ups ride the same thread)
  const MIN_GAP_POINTS = 2;        // reply rates closer than this are read as "no difference"
  const VARIANTS = ['A', 'B'];
  /** which variant the nth draft of a batch carries (A, B, A, B …) */
  const variantFor = (i) => VARIANTS[Math.abs(Math.round(Number(i) || 0)) % VARIANTS.length];
  const rate = (replied, sent) => (sent > 0 ? Math.round((1000 * replied) / sent) / 10 : null);
  /** o: { variants: [{ variant, subject, sent, replied }] } -> the counts per variant, whether they may be read, and one honest line */
  function read(o) {
    const given = ((o || {}).variants || []).filter(x => x && VARIANTS.includes(String(x.variant || '').toUpperCase()));
    const rows = VARIANTS.map(v => {
      const hit = given.find(x => String(x.variant).toUpperCase() === v) || {};
      const sent = Math.max(0, Math.round(Number(hit.sent) || 0));
      const replied = Math.min(sent, Math.max(0, Math.round(Number(hit.replied) || 0)));
      return { variant: v, subject: String(hit.subject || '').slice(0, 140), sent, replied, reply_rate: rate(replied, sent), enough: sent >= MIN_SENDS };
    });
    const live = rows.filter(r => r.sent > 0);
    const enough = live.length >= 2 && live.every(r => r.enough);
    const counts = rows.map(r => r.variant + ': ' + r.replied + ' replies from ' + r.sent + ' e-mail' + (r.sent === 1 ? '' : 's')).join(' · ');
    if (!live.length) return { rows, enough: false, leader: '', verdict: 'nothing_sent', min_sends: MIN_SENDS, note: 'No first e-mails have gone out yet, so there is nothing to compare.', counts };
    if (!enough) {
      const short = rows.filter(r => r.sent < MIN_SENDS).map(r => r.variant + ' (' + r.sent + ' of ' + MIN_SENDS + ')').join(', ');
      return { rows, enough: false, leader: '', verdict: 'not_enough', min_sends: MIN_SENDS,
        note: 'Not enough sends yet to call a subject better: ' + MIN_SENDS + ' first e-mails per variant are needed, and ' + short + ' ' + (short.includes(',') ? 'are' : 'is') + ' short. ' + counts + '.', counts };
    }
    const sorted = [...live].sort((a, b) => b.reply_rate - a.reply_rate);
    const gap = Math.round((sorted[0].reply_rate - sorted[sorted.length - 1].reply_rate) * 10) / 10;
    if (gap < MIN_GAP_POINTS) return { rows, enough: true, leader: '', verdict: 'no_difference', min_sends: MIN_SENDS, gap,
      note: 'Both subjects reply about equally well (' + counts + '): keep either.', counts };
    return { rows, enough: true, leader: sorted[0].variant, verdict: 'ahead', min_sends: MIN_SENDS, gap,
      note: 'Subject ' + sorted[0].variant + ' is ahead by ' + gap + ' points (' + counts + '). One test on this many e-mails is a hint, not a rule.', counts };
  }
  // the second subject a draft may carry: different from the first, short, nothing left in brackets, none of the words we never use
  const BAD_SUBJECT = /(backlink|dofollow|do-follow|link exchange|link swap|guest post|sponsored post|\bSEO\b)/i;
  const MAX_SUBJECT = 70;
  function altOk(alt, first) {
    const a = String(alt || '').replace(/\s+/g, ' ').trim(); const f = String(first || '').replace(/\s+/g, ' ').trim();
    if (!a) return 'no second subject was written';
    if (a.length > MAX_SUBJECT) return 'the second subject is ' + a.length + ' characters (at most ' + MAX_SUBJECT + ')';
    if (/[[\]{}]|\(confirm/i.test(a)) return 'the second subject still has something to fill in';
    if (BAD_SUBJECT.test(a)) return 'the second subject uses a word we never use';
    if (a.toLowerCase() === f.toLowerCase()) return 'the second subject is the same as the first';
    return '';
  }
  return { read, variantFor, altOk, VARIANTS, MIN_SENDS, MIN_GAP_POINTS, MAX_SUBJECT };
})();
const plans = $('LB Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let inputs = [], outs = [];
try { inputs = $('LB Writer Input').all().map(i => i.json).filter(j => !j.skip); outs = $('Outreach Sequence Writer').all().map(i => i.json); } catch (e) {}
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
const clean = (t, n) => String(t || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
const out = [];
inputs.forEach((job, i) => {
  const p = plans.find(x => x.site_id === job.site_id) || {};
  const o = outs[i] || {}; const res = o && !o.error ? (parse(o.output) || {}) : {};
  const verdicts = [];
  for (const sq of (res.sequences || [])) {
    const j = (job.jobs || []).find(x => x.n === Number(sq.n)); if (!j) continue;
    const press = ['press', 'digest'].includes(j.type);
    const raw = (sq.steps || []).filter(x => clean(x.body, 10)).sort((a, b) => Number(a.step) - Number(b.step)).slice(0, press ? 2 : 3);
    if (!raw.length) { verdicts.push({ n: j.n, prospect_domain: j.prospect_domain, type: j.type, ok: false, held: ['no e-mail was written'], notes: [], steps: [] }); continue; }
    const v = DQ.check({ type: j.type, steps: raw.map((x, k) => ({ step: k, subject: k === 0 ? clean(x.subject, 90) : '', body: clean(x.body, k === 0 ? 2200 : 900) })),
      to: j.to || '', prospect_domain: j.prospect_domain, page_url: j.page_url, page_title: j.page_title, evidence: j.evidence, dead: j.dead },
      { facts: job.facts, signer: job.signer, brand: p.brand || job.business, brand_known: !!p.brand_known, domain: p.domain || job.domain, canonical_host: p.canonical_host || p.domain || job.domain,
        target_url: j.target_url, competitors: p.competitors || [], serp_rivals: p.serp_rivals || [], ai_rivals: p.ai_rivals || [], topics: p.topics || [], accredited: OK.accredited(p.accreditation) });   // R21: the last gate sees the SERP rivals too
    const waits = press ? [0, 3] : [0, 4, 8];
    const alt = press ? '' : clean(sq.subject_b, 90);   // a journalist answer keeps "Re: " + their request: there is nothing to test there
    const altWhy = press ? '' : AB.altOk(alt, v.steps[0] ? v.steps[0].subject : '');
    verdicts.push({ n: j.n, prospect_domain: j.prospect_domain, type: j.type, ok: v.ok, held: v.held, notes: altWhy ? [...v.notes, altWhy] : v.notes,
      subject_alt: altWhy ? '' : alt,
      steps: v.steps.map((x, k) => ({ step: k, wait_days: waits[k], subject: k === 0 ? x.subject : '', body: x.body })) });
  }
  const writer_skip = (res.skip || []).map(sk => { const j = (job.jobs || []).find(x => x.n === Number(sk.n)); return j ? { n: j.n, prospect_domain: j.prospect_domain, type: j.type, reason: clean(sk.reason, 200) } : null; }).filter(Boolean);
  out.push({ json: { site_id: job.site_id, domain: job.domain, verdicts, writer_skip, checked: verdicts.length, held: verdicts.filter(v => !v.ok).length,
    writer_error: o && o.error ? String(o.error.message || o.error).slice(0, 200) : '' } });
});
return out.length ? out : [{ json: { skip: true } }];
