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
  const regDomain = (h) => { const p = String(h || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean); if (p.length <= 2) return p.join('.');
    const sld = /^(co|com|net|org|gov|edu|ac|ltd|plc|sch|nic|or|ne|go|mil|biz|info)$/; return (sld.test(p[p.length - 2]) && p[p.length - 1].length === 2) ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
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
  return { text, attr, hostOf, regDomain, refKey, sameSite, isInfra, isScraper, isSearchPage, isWire, normUrl, cleanUrl, placementAt, anchorPlacements, linksTo, pageFacts, contextAt, challenge, emailsIn, verify, mention, domainKind, quality, values, anchorKind, SPAM_RE, isGambling, footPath, footprints };
})();
// ---- outreach kit (v4.13 Link Builder, LINK_BUILDER_SPEC.md; inlined after the link kit): contacts, qualification, topic fit, our page and
// the link text to ask for. Regex only (the n8n sandbox has no URL / DOM).
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
  function rivalOf(o) {
    const d = String(o.domain || '').toLowerCase().replace(/^www\./, ''); const dr = LK.regDomain(d);
    const hit = (list, label) => {
      for (const c of (list || [])) { const x = domOf(c); if (!x || !d) continue;
        if (LK.sameSite(d, x) || LK.sameSite(x, d) || (dr && dr === LK.regDomain(x))) return rivalEntry(c, label);
      }
      return null;
    };
    return hit(o.competitors, 'a competitor of yours') || hit(o.serp_rivals, 'a site that outranks you for one of your own keywords');
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
    if (rival && LIST_TYPES.has(type) && isRoundup(o)) return '';   // asking a rival's "best X" list to add you is fair game
    if (rival) return 'a competing site of yours (' + rival.domain + '): ' + rival.why + ', and a competitor does not link to your page';
    const site = (SITE_EXEMPT.has(type) || (LIST_TYPES.has(type) && isRoundup(o))) ? null : siteOffer(o);
    if (site && site.offered.length >= SITE_MIN_SERVICES && site.signals.length >= SITE_MIN_SIGNALS && site.local)
      return 'a competing provider: their own site' + (site.pages.length ? ' (' + site.pages.join(', ') + ')' : '') + ' offers ' + site.offered.length + ' of your services ("'
        + site.offered.slice(0, 3).join('", "') + '"' + (site.offered.length > 3 ? ' …' : '') + ') with the signals of a vendor selling them ("' + site.signals.slice(0, 2).join('", "') + '")'
        + (o.country ? ' in ' + o.country : '');
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
const base = $('Analyze Keywords').first().json;
const targets = $('BL Targets').all().map(i => i.json);
const sums = $('Backlink Summary Answers').all().map(i => i.json);
const gapRes = $input.first().json || {};

const rows = targets.map((t, i) => {
  const task = sums[i]?.tasks?.[0] || {};
  const r = task.result?.[0] || null;
  if (!r) return { domain: t.domain, is_you: t.is_you, available: false, error: task.status_message || sums[i]?.error?.message || 'no data' };
  const rd = r.referring_domains ?? null;
  return {
    domain: t.domain, is_you: t.is_you, available: true,
    domain_rank: r.rank ?? null,
    backlinks: r.backlinks ?? null,
    referring_domains: rd,
    dofollow_pct: rd ? Math.round((1 - (r.referring_domains_nofollow || 0) / rd) * 100) : null,
    spam_score: r.backlinks_spam_score ?? null,
    broken_backlinks: r.broken_backlinks ?? null
  };
});

const available = rows.some(r => r.available);
const you = rows.find(r => r.is_you) || {};
const comps = rows.filter(r => !r.is_you && r.available);
const median = (arr) => { const a = arr.filter(v => v != null).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const medians = {
  referring_domains: median(comps.map(c => c.referring_domains)),
  backlinks: median(comps.map(c => c.backlinks)),
  domain_rank: median(comps.map(c => c.domain_rank))
};

// P34-4 (live 2026-10-12): this list used to be DataForSEO's answer, unfiltered, and recommended a ministry and two link sellers.
// The Link Builder's gates now run on it too (v5/code/_outreach_kit.js, the same rules the Backlink Monitor applies): who is never
// pitched, and whether anything ties the domain to this site's topics. Every domain stays in the list, with the reason.
const gapItems = gapRes.tasks?.[0]?.result?.[0]?.items || [];
const kwOf = (k) => String((k && (k.keyword || k.query)) || k || '');
const sk0 = base.site_keywords || {};
const gapTopics = [base.keyword, base.business, base.business_type, String(base.domain || '').split('.')[0].replace(/[^a-z0-9]+/gi, ' '),
  ...(sk0.seeds || []).slice(0, 10).map(kwOf), ...(sk0.keyword_gap || []).slice(0, 10).map(kwOf), ...(sk0.easy_wins || []).slice(0, 10).map(kwOf),
  ...(sk0.striking_distance || []).slice(0, 10).map(kwOf)].filter(Boolean).join(' ');
const gapTld = ({ GB: 'uk' })[base.country_iso] || String(base.country_iso || '').toLowerCase();
const weAreAccredited = OK.accredited(base.accreditation || ((base.profile || {}).accreditation));
const gap0 = gapItems.map(it => {
  const vals = Object.values(it.domain_intersection || {});
  const first = vals[0] || {};
  return { referring_domain: first.target || first.domain || it.domain || it.referring_domain || null, rank: first.rank ?? null, links_to_competitors: vals.length,
    spam_score: first.backlinks_spam_score ?? null, title: String(first.title || '').slice(0, 160) };
}).filter(g => g.referring_domain).slice(0, 25);
const gapFarms = LK.footprints(gap0.map(g => ({ ref_domain: LK.refKey(g.referring_domain), from_url: 'https://' + g.referring_domain + '/', anchor: '', page_title: g.title })), { domain: base.domain, brands: [String(base.business || '')] });
const gap = gap0.map(g => {
  const farm = gapFarms.get(LK.refKey(g.referring_domain)) || '';
  const no = farm || OK.noPitch(g.referring_domain, { spam: g.spam_score, title: g.title, accredited: weAreAccredited });
  const t = no ? { ok: false, why: '' } : OK.gapTopic(g.referring_domain, { topics: gapTopics, title: g.title, country_tld: gapTld, topic_label: String(base.keyword || 'your topics') });
  return { ...g, pitch: !no && t.ok, reason: no || t.why };
});
const gapPitch = gap.filter(g => g.pitch);

const findings = [];
const works = [];
const F = (severity, title, evidence, why, fix) => findings.push({
  category: 'Authority', severity, title, evidence, why, fix,
  sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site'
});

if (!available) {
  findings.push({ category: 'Authority', severity: 'Info', title: 'Backlink data not available', evidence: 'Backlinks API returned: ' + (rows[0] && rows[0].error || 'no data'), why: 'Backlink numbers need the DataForSEO Backlinks API to be active.', fix: 'Activate the Backlinks API to include link authority in the next report.', sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site', scoring: false });
} else if (you.available) {
  if (medians.referring_domains && (you.referring_domains || 0) < medians.referring_domains * 0.1) {
    F('High', 'Far fewer referring domains than competitors',
      you.referring_domains + ' referring domains vs competitor median ' + Math.round(medians.referring_domains),
      'Links from other websites are one of the strongest ranking signals; competitors are far ahead.',
      'Earn links from partner directories, industry associations, suppliers, press and guest content.');
  } else if (medians.referring_domains && you.referring_domains >= medians.referring_domains) {
    works.push('Referring domains on par with competitors (' + you.referring_domains + ' vs median ' + Math.round(medians.referring_domains) + ')');
  }
  if (you.dofollow_pct != null && you.dofollow_pct < 50 && you.referring_domains > 5) {
    F('Low', 'Most links are nofollow', you.dofollow_pct + '% of referring domains give followed links',
      'Nofollow links pass little ranking value.', 'Prioritise editorial links, directories and partners that give followed links.');
  }
  if (you.spam_score != null && you.spam_score > 30) {
    F('Medium', 'High backlink spam score', 'Spam score ' + you.spam_score,
      'A high share of low-quality links can hold rankings back.', 'Review the worst linking domains and disavow clearly manipulative ones.');
  }
  if (you.broken_backlinks > 10) {
    F('Low', 'Backlinks pointing to broken pages', you.broken_backlinks + ' backlinks lead to pages that no longer exist',
      'Link value is lost when links point to 404 pages.', 'Redirect the old URLs to the most relevant live pages.');
  }
}
if (gapPitch.length) {
  F('Medium', 'Link opportunities: sites that link to competitors but not to you',
    gapPitch.length + ' of ' + gap.length + ' domains are worth a pitch. Top: ' + gapPitch.slice(0, 5).map(g => g.referring_domain).join(', ')
      + (gap.length > gapPitch.length ? '. ' + (gap.length - gapPitch.length) + ' are left out (e.g. ' + gap.filter(g => !g.pitch).slice(0, 3).map(g => g.referring_domain + ' — ' + g.reason).join('; ') + ')' : ''),
    'Sites that already link to your competitors are the most likely to link to you.',
    'Reach out to these sites with a listing request, partnership or useful resource. The ones left out are not worth asking: a government list is joined by applying, and a site that sells links passes nothing on.');
} else if (gap.length) {
  F('Info', 'No link opportunities worth a pitch in this gap',
    'All ' + gap.length + ' sites that link to your competitors are government portals, link sellers or off topic for you (e.g. ' + gap.slice(0, 3).map(g => g.referring_domain + ' — ' + g.reason).join('; ') + ')',
    'A link is only worth asking for when the site is a real publisher on your subject; the rest pass nothing on or need an application.',
    'Earn links from partner directories, industry associations, suppliers and press on your own subject instead.');
}

return [{
  json: {
    ...base,
    authority: { available, rows, medians, gap },
    extra_findings: [...(base.extra_findings || []), ...findings],
    extra_works: [...(base.extra_works || []), ...works]
  }
}];