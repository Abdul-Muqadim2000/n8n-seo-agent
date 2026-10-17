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
// G14 (2026-10-13, system review FIX_PLAN.md; CRITERIA_technical… 1.4): the response-versus-render diff.
// Two readings of every key page are in: the **raw first response** (*Fetch Raw Pages*, a plain GET — what a crawler that does not run
// JavaScript receives, which is every AI crawler today) and the **rendered page** (*Render Key Pages*, the Jina Reader render path of
// v5/code/Render_Requests.js, or the JavaScript crawl as the fallback). Six figures are read from both with the same parser — title, main
// heading, canonical link, robots meta, links on the page, text length — and every one of them says which reading it came from.
// Rules this node keeps:
//   * URLs are compared host-agnostically: the crawl reports www. hosts while a canonical may use the bare host, and that is NOT a mismatch.
//   * a reading that failed is "not checked" with the reason (a bot challenge, an HTTP error, a DNS failure, an empty body) — never
//     "no difference". A crawl run without JavaScript is not a rendered reading and never stands in for one.
//   * nothing here can fail the audit.
//   * R119 (2026-10-16): the first response is read as a plain request under our own audit user agent — it no longer carries Google's bot page. A site that
//     answers named AI crawlers differently is the AI crawler access check's finding (robots.txt per bot, CDN block test), not this diff's.
/*__LINK_KIT__*/
let prev = {};
try { prev = $('Analyze CrUX').first().json || {}; } catch (e) {}
if (!prev.probe) { try { const i = $input.first().json || {}; if (i.probe || i.skip) prev = i; } catch (e2) {} }

let reqs = [];
try { reqs = $('Render Diff Targets').all().map(i => i.json || {}); } catch (e) {}
let renders = [];
try { renders = $('Render Key Pages').all().map(i => i.json || {}); } catch (e) {}
let raws = [];
try { raws = $('Fetch Raw Pages').all().map(i => i.json || {}); } catch (e) {}
let crawled = [];
try { crawled = ($('Get Crawled Pages Answers').first().json.tasks?.[0]?.result?.[0]?.items || []).filter(p => p && p.url); } catch (e) {}

const targets = reqs.filter(r => r && r.url && !r.skip);
const plan = (reqs[0] || {}).render_plan || { pages: 0, cap: 0, crawl_js: false, figures: [] };
const S = (v) => String(v == null ? '' : v).trim();
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const pathOf = (u) => S(u).replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '') || '/';

// ---- host-agnostic URL comparison (www. vs the bare host, a trailing slash, the scheme and tracking parameters are all the same URL) ----
const normU = (u) => {
  const raw = S(u);
  if (!raw) return '';
  const m = raw.match(/^https?:\/\/([^\/?#]+)([^?#]*)/i);
  const host = m ? m[1].toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '') : '';
  const p = (m ? m[2] : raw.replace(/[?#].*$/, '')) || '/';
  return host + ((p.replace(/\/+$/, '') || '/').toLowerCase());
};
const sameUrl = (a, b) => !!normU(a) && normU(a) === normU(b);

// ---- one reading of a page, from HTML: the same parser for the raw response and for the rendered page ----
const robotsOf = (html, headers) => {
  const metas = [...S(html).matchAll(/<meta\b[^>]*>/gi)].map(x => x[0])
    .filter(t => /name\s*=\s*["']?(robots|googlebot)\b/i.test(t))
    .map(t => S(LK.attr(t, 'content')).toLowerCase()).filter(Boolean);
  const H = {};
  for (const [k, v] of Object.entries(headers || {})) H[String(k).toLowerCase()] = S(v);
  const xr = S(H['x-robots-tag']).toLowerCase();
  return [...new Set([...metas, ...(xr ? ['x-robots-tag: ' + xr] : [])])].join(', ');
};
const linkCount = (html, url) => {
  const own = LK.regDomain(LK.hostOf(url));
  let internal = 0, external = 0;
  for (const m of S(html).matchAll(/<a\b([^>]*)>/gi)) {
    const href = S(LK.attr(m[1], 'href'));
    if (!href || /^(#|javascript:|mailto:|tel:|sms:|data:)/i.test(href)) continue;
    const h = LK.hostOf(href);
    if (!h || LK.sameSite(h, own)) internal++; else external++;
  }
  return { internal, external, total: internal + external };
};
// ---- B5-1 (2026-10-15, benchmark area 5; Screaming Frog v24's "Find Uncrawlable Links"): link-shaped things no crawler can follow ----
// A card, a tile, a table row or a button that navigates with a script is not a link: it carries no href, so nothing queues the page behind
// it and no internal-link signal reaches it. It is the usual cause of the orphan pages the crawl reports ("no crawlable internal links"),
// and until today the audit named that symptom and *guessed* the cause in its own words. This reads the HTML we have already fetched for the
// response-versus-render diff — nothing extra is requested and nothing is paid for. Regex only: the n8n Code sandbox has no DOM.
const UNC_KINDS = {
  javascript_href: 'an <a href="javascript:…"> link',
  anchor_without_href: 'an <a> with no href that navigates on click',
  anchor_to_nowhere: 'an <a href="#"> that navigates on click',
  element_as_link: 'an element used as a link (no <a href>)'
};
const looksLikeUrl = (t) => /^(?:https?:\/\/|\/)[^\s"'<>]*$/i.test(S(t));
const uncrawlable = (html) => {
  const out = [];
  const navAttr = (attrs) => S(LK.attr(attrs, 'data-href') || LK.attr(attrs, 'data-url') || LK.attr(attrs, 'data-link') || '').slice(0, 120);
  const navScript = (attrs) => S((S(attrs).match(/(?:location(?:\.href)?\s*=\s*|window\.open\s*\(\s*|navigate\s*\(\s*|router\.push\s*\(\s*)["']([^"']{1,120})["']/i) || [])[1]);
  const target = (attrs) => navAttr(attrs) || navScript(attrs);
  for (const m of S(html).matchAll(/<a\b([^>]*)>/gi)) {
    const attrs = m[1]; const href = S(LK.attr(attrs, 'href'));
    const click = /\bonclick\s*=/i.test(attrs) || /\bdata-(?:href|url|link)\s*=/i.test(attrs);
    if (/^javascript:/i.test(href)) out.push({ kind: 'javascript_href', tag: 'a', detail: href.slice(0, 120) });
    else if (!href && click) out.push({ kind: 'anchor_without_href', tag: 'a', detail: target(attrs) });
    else if (/^#?$/.test(href) && href === '#' && click) out.push({ kind: 'anchor_to_nowhere', tag: 'a', detail: target(attrs) });
  }
  for (const m of S(html).matchAll(/<(div|span|li|button|td|tr|section|article|h[1-6])\b([^>]*(?:\bonclick\s*=|\bdata-(?:href|url|link)\s*=|\bhref\s*=)[^>]*)>/gi)) {
    const tag = m[1].toLowerCase(); const attrs = m[2];
    const t = target(attrs) || S(LK.attr(attrs, 'href'));
    if (!looksLikeUrl(t)) continue;                 // a script that is not navigation, or a target we cannot read, is not counted
    out.push({ kind: 'element_as_link', tag, detail: t.slice(0, 120) });
  }
  return { count: out.length, kinds: [...new Set(out.map(x => x.kind))], samples: out.slice(0, 5) };
};
const readHtml = (html, headers, url) => {
  const facts = LK.pageFacts(html, headers, url);
  const h1s = [...S(html).matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => LK.text(m[1])).filter(Boolean);
  const links = linkCount(html, url);
  return { ok: true, title: S(facts.title), h1: S(h1s[0]), h1_count: h1s.length, canonical: S(facts.canonical),
    robots: robotsOf(html, headers), links: links.total, internal_links: links.internal, words: num(facts.words) || 0, js_shell: !!facts.js_shell,
    uncrawlable: uncrawlable(html) };
};
// why a reading could not be used ("not checked", never "no difference")
const failureOf = (res, label) => {
  const r = res || {};
  const html = S(r.html ?? r.body ?? r.data);
  const status = num(r.statusCode ?? r.status) || 0;
  const err = r.error ? S(r.error.message || r.error.description || r.error).slice(0, 160) : '';
  if (err && !html) return 'the ' + label + ' failed: ' + err;
  if (LK.challenge(status, html)) return 'the ' + label + ' hit a bot challenge' + (status ? ' (HTTP ' + status + ')' : '');
  if (status >= 400) return 'the ' + label + ' answered HTTP ' + status;
  if (!html) return 'the ' + label + ' returned no HTML';
  if (!/<html|<body|<head/i.test(html)) return 'the ' + label + ' returned no HTML document';
  return '';
};
// the JavaScript crawl as the rendered reading of last resort (only when the crawl really rendered JavaScript)
const fromCrawl = (url) => {
  if (!plan.crawl_js) return null;
  const hit = crawled.find(p => sameUrl(p.url, url));
  if (!hit) return null;
  const meta = hit.meta || {};
  const nonIdx = (((prev.crawl_extras || {}).non_indexable) || []).find(x => sameUrl(x.url, url));
  const robots = [nonIdx && /noindex/i.test(S(nonIdx.reason)) ? 'noindex' : '', meta.follow === false ? 'nofollow' : ''].filter(Boolean).join(', ');
  // B-1: the crawl's title and heading are decoded once, as readHtml decodes the first response's
  return { ok: true, title: LK.text(S(meta.title)), h1: LK.text(S((meta.htags || {}).h1 && (meta.htags || {}).h1[0])), h1_count: (((meta.htags || {}).h1) || []).length,
    canonical: S(meta.canonical), robots, links: (num(meta.internal_links_count) || 0) + (num(meta.external_links_count) || 0),
    internal_links: num(meta.internal_links_count) || 0, words: num((meta.content || {}).plain_text_word_count) || 0, js_shell: false };
};

// ---- B5-4 (2026-10-16, benchmark area 5; Screaming Frog carries 10 hreflang issues, Semrush an International SEO report) ----
// The hreflang set a page declares, read from the first response we already hold: <link rel="alternate" hreflang="…" href="…"> in the HTML
// and the same relation in the HTTP Link header. (A set declared only in the XML sitemap is not read here, and the finding says so.)
const hreflangOf = (html, headers) => {
  const out = [];
  for (const m of S(html).matchAll(/[<]link\b[^>]*>/gi)) {
    const t = m[0];
    if (!/\brel\s*=\s*["']?alternate\b/i.test(t)) continue;
    const lang = S(LK.attr(t, 'hreflang')); if (!lang) continue;
    out.push({ lang, href: S(LK.attr(t, 'href')), from: 'html' });
  }
  const H = {}; for (const [k, v] of Object.entries(headers || {})) H[String(k).toLowerCase()] = S(v);
  for (const part of S(H.link).split(/,\s*(?=<)/)) {
    const u = part.match(/^<([^>]*)>/); const l = part.match(/hreflang\s*=\s*"?([A-Za-z0-9-]+)"?/i);
    if (u && l && /rel\s*=\s*"?[^;]*alternate/i.test(part)) out.push({ lang: S(l[1]), href: S(u[1]), from: 'header' });
  }
  return out;
};
// language[-script][-REGION], or x-default (ISO 639-1/-2 language, ISO 15924 script, ISO 3166-1 alpha-2 or UN M.49 region)
const hreflangValid = (c) => /^x-default$/i.test(c) || /^[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?$/i.test(c);

// ---- the figures, and what each one is attributed to ----
const FIGURES = [
  { key: 'title', label: 'Title', kind: 'text' },
  { key: 'h1', label: 'Main heading (H1)', kind: 'text' },
  { key: 'canonical', label: 'Canonical link', kind: 'url' },
  { key: 'robots', label: 'Robots meta', kind: 'text' },
  { key: 'links', label: 'Links on the page', kind: 'count' },
  { key: 'words', label: 'Text length (words)', kind: 'count' }
];
const SOURCE_RAW = 'the first response (raw HTML)';
const SOURCE_REN = 'after JavaScript (rendered page)';
// B-1 (2026-10-17): text is compared as the decoded text both readers hold (readHtml decodes once; the crawl's figures are decoded once
// in fromCrawl), never decoded a second time here ("&amp;amp;" is the text "&amp;", R62)
const normText = (v) => S(v).toLowerCase().replace(/\s+/g, ' ').trim();
const same = (f, a, b) => f.kind === 'url' ? (sameUrl(a, b) || (!S(a) && !S(b)))
  : f.kind === 'count' ? (Number(a) === Number(b) || (Math.max(Number(a) || 0, Number(b) || 0) > 0 && Math.min(Number(a) || 0, Number(b) || 0) / Math.max(Number(a) || 0, Number(b) || 0) >= 0.8))
    : normText(a) === normText(b);
const grew = (f, rawV, renV) => {   // a count that is materially bigger after JavaScript
  if (f.kind !== 'count') return false;
  const a = Number(rawV) || 0, b = Number(renV) || 0;
  return b >= (f.key === 'links' ? 10 : 150) && (a === 0 || a / b < 0.4);
};
// B-1 (2026-10-17, re-rating 2026-10-17, exec 739, High): the 20 pages paired with the JavaScript crawl compared OUR parser's count of every
// <a> and every word of the first response with DataForSEO's OWN counts after rendering (`internal_links_count + external_links_count` —
// unique links — and `plain_text_word_count`, the main text without the navigation). Two different rulers: /security read "52 links, 694
// words" against "29, 439", every one of the 20 pages came out SMALLER after JavaScript — the opposite of what script-written content does —
// and the audit raised "AI crawlers see a different version of 20 key page(s)" on a server-rendered site whose first response GPTBot and a
// browser receive byte for byte. Two rules now:
//   * a count only ever matters in ONE direction: the rendered page having MORE than the first response (that is content a non-rendering
//     crawler misses). A first response that carries more than the rendered reading hides nothing from any crawler: it is `raw_more`, never
//     a finding, on every path;
//   * on a crawl-paired page the two counts come from two different counting methods, so only a gap no counting difference can explain is
//     read as script-written content: the crawl (which counts unique links and the main text only, i.e. LESS than our parser) must see at
//     least CRAWL_GAP times what our parser found in the first response. Anything closer is `not_compared`, with the reason, and scores
//     nothing. Title, main heading and canonical link mean the same thing in both readings and are compared (entities decoded).
const CRAWL_GAP = 2.5;
const pairedCount = (f, rawV, renV) => {
  const a = Number(rawV) || 0, b = Number(renV) || 0;
  if (b >= (f.key === 'links' ? 10 : 150) && (a === 0 || b >= CRAWL_GAP * a)) return { state: 'js_only', from: SOURCE_REN + ' — the JavaScript crawl counted ' + b + ', at least ' + CRAWL_GAP + ' times the ' + a + ' in the first response, more than its own way of counting can explain' };
  return { state: 'not_compared', from: 'not compared: the JavaScript crawl counts ' + (f.key === 'links' ? 'unique links' : 'the main text only') + ' and our parser counts ' + (f.key === 'links' ? 'every link' : 'every word') + ' of the first response, so ' + a + ' against ' + b + ' is a difference of method, not of content' };
};

const pages = [];
const notChecked = [];
const hreflangBy = [];   // B5-4: [{ url, path, entries }] for every page whose first response was read
// B5-6: the pages rendered by the render service come first; with a JavaScript crawl, up to 20 more are read raw and paired with the crawl
const extras = plan.crawl_js ? ((plan.raw_extra || []).filter(x => x && x.url)) : [];
const jobs = targets.map((t, i) => ({ t, i, extra: false })).concat(extras.map((t, j) => ({ t, i: targets.length + j, extra: true })));
for (const job of jobs) {
  const t = job.t, i = job.i;
  const renRes = job.extra ? null : (renders[i] || null);
  const rawRes = raws.find(r => r && sameUrl(r.url, t.url)) || raws[i] || null;
  const rawFail = failureOf(rawRes, 'raw request');
  const renFail = job.extra ? 'it was paired with the JavaScript crawl, not rendered again' : failureOf(renRes, 'render');
  const raw = rawFail ? null : readHtml(S((rawRes || {}).html ?? (rawRes || {}).body ?? (rawRes || {}).data), (rawRes || {}).headers, t.url);
  if (raw) hreflangBy.push({ url: t.url, path: pathOf(t.url), entries: hreflangOf(S((rawRes || {}).html ?? (rawRes || {}).body ?? (rawRes || {}).data), (rawRes || {}).headers) });
  let rendered = renFail ? null : readHtml(S((renRes || {}).html ?? (renRes || {}).body ?? (renRes || {}).data), (renRes || {}).headers, t.url);
  let rendered_source = rendered ? 'render_service' : '';
  if (!rendered) { const c = fromCrawl(t.url); if (c) { rendered = c; rendered_source = 'crawl_js'; } }

  if (!raw || !rendered) {
    const why = [rawFail, rendered ? '' : (renFail + (plan.crawl_js ? ', and the JavaScript crawl has no reading of this page' : ', and the crawl did not render JavaScript, so it cannot stand in'))].filter(Boolean).join('; ');
    const row = { url: t.url, path: pathOf(t.url), kind: t.kind || 'page', checked: false, not_checked: why || 'neither reading could be used', figures: [], js_only: [], rendered_source, paired_with_crawl: job.extra };
    pages.push(row); notChecked.push(row);
    continue;
  }
  const figures = FIGURES.map(f => {
    const a = raw[f.key], b = rendered[f.key];
    const hasA = f.kind === 'count' ? (Number(a) || 0) > 0 : !!S(a);
    const hasB = f.kind === 'count' ? (Number(b) || 0) > 0 : !!S(b);
    let state = 'same', from = SOURCE_RAW;
    // B5-6: the crawl keeps the indexing rule it derived, not the meta tag, so the two robots readings are not comparable for a crawl-paired page
    if (job.extra && f.key === 'robots') return { figure: f.label, key: f.key, raw: a, rendered: b, state: 'not_compared', from: 'not compared (the crawl keeps its own indexing rule)' };
    // B-1: a crawl-paired count is read only in the one direction its method can support (see pairedCount)
    if (job.extra && f.kind === 'count') { const pc = (Number(a) || 0) === (Number(b) || 0) ? { state: 'same', from: SOURCE_RAW } : pairedCount(f, a, b); return { figure: f.label, key: f.key, raw: a, rendered: b, state: pc.state, from: pc.from }; }
    if (!hasA && !hasB) { state = 'absent'; from = 'neither reading has it'; }
    else if (!hasA && hasB) { state = 'js_only'; from = SOURCE_REN; }
    else if (hasA && !hasB) { state = job.extra ? 'not_compared' : 'raw_only'; from = job.extra ? 'not compared: the JavaScript crawl kept no ' + f.label.toLowerCase() + ' for this page' : SOURCE_RAW; }
    else if (f.kind === 'count' && (Number(a) || 0) > (Number(b) || 0)) { state = same(f, a, b) ? 'same' : 'raw_more'; from = state === 'same' ? SOURCE_RAW : 'the first response has more than the rendered page — nothing is hidden from a crawler that does not run JavaScript'; }
    else if (!same(f, a, b)) { state = grew(f, a, b) ? 'js_only' : 'differs'; from = state === 'js_only' ? SOURCE_REN : 'the two readings differ'; }
    return { figure: f.label, key: f.key, raw: a, rendered: b, state, from };
  });
  // B5-1: what a crawler cannot follow is read from the rendered page where we have one (that is the DOM Google ends up with), and from
  // the first response otherwise. `fromCrawl` has no HTML of its own, so it carries no count and the page simply reports none.
  const uncRen = (rendered_source === 'render_service' && rendered.uncrawlable && rendered.uncrawlable.count) ? rendered.uncrawlable : null;
  const uncRaw = (raw.uncrawlable && raw.uncrawlable.count) ? raw.uncrawlable : null;
  const unc = uncRen || uncRaw || { count: 0, kinds: [], samples: [] };
  pages.push({ url: t.url, path: pathOf(t.url), kind: t.kind || 'page', checked: true, not_checked: '', rendered_source, paired_with_crawl: job.extra,
    figures, js_only: figures.filter(f => f.state === 'js_only').map(f => f.key),
    differs: figures.filter(f => f.state === 'differs').map(f => f.key), not_compared: figures.filter(f => f.state === 'not_compared').map(f => f.key), js_shell: !!raw.js_shell,
    uncrawlable: unc.count, uncrawlable_kinds: unc.kinds, uncrawlable_samples: unc.samples,
    uncrawlable_read_from: unc.count ? (uncRen ? 'the rendered page' : 'the first response') : '' });
}

const checked = pages.filter(p => p.checked);
const withJs = checked.filter(p => p.js_only.length);
// B5-1: the orphan pages the crawl found, which is what link-shaped elements without an href usually cause
const orphanPages = crawled.filter(p => (p.checks || {}).is_orphan_page === true);
const uncPages = checked.filter(p => (p.uncrawlable || 0) > 0);
const uncTotal = uncPages.reduce((n, p) => n + (p.uncrawlable || 0), 0);
const uncrawlable_links = { pages_with: uncPages.length, pages_checked: checked.length, total: uncTotal,
  kinds: [...new Set(uncPages.flatMap(p => p.uncrawlable_kinds || []))], orphan_pages: orphanPages.length,
  method: 'Read from the HTML of the key pages already fetched for this check: <a> tags with no href or a javascript: href that navigate on click, and elements (div, span, li, button, table rows) that carry a page address in an onclick or a data-href. A crawler follows none of them, so the pages behind them are reached only if something else links to them.' };
// ---- B5-4: the hreflang sets of the pages read, checked against each other. SILENT when no page declares any (a one-language site has nothing to check) ----
const hlDeclaring = hreflangBy.filter(h => h.entries.length);
let hreflang = null;
const hlProblems = { invalid: [], relative: [], no_self: [], no_return: [], duplicate: [], no_default: [] };
if (hlDeclaring.length) {
  const held = new Map(hreflangBy.map(h => [normU(h.url), h]));
  for (const h of hlDeclaring) {
    const bad = h.entries.filter(e => !hreflangValid(e.lang)); if (bad.length) hlProblems.invalid.push({ ...h, detail: bad.slice(0, 4).map(e => '"' + e.lang + '"').join(', ') });
    const rel = h.entries.filter(e => !/^https?:\/\//i.test(e.href)); if (rel.length) hlProblems.relative.push({ ...h, detail: rel.slice(0, 3).map(e => e.lang + ' \u2192 ' + (e.href || '(empty)')).join(', ') });
    if (!h.entries.some(e => sameUrl(e.href, h.url))) hlProblems.no_self.push({ ...h, detail: 'declares ' + h.entries.length + ' alternate(s), none of them this page' });
    const byLang = new Map(); for (const e of h.entries) { const k = e.lang.toLowerCase(); (byLang.get(k) || byLang.set(k, new Set()).get(k)).add(normU(e.href)); }
    const dup = [...byLang.entries()].filter(([, v]) => v.size > 1).map(([k]) => k); if (dup.length) hlProblems.duplicate.push({ ...h, detail: 'the same language points at different addresses: ' + dup.slice(0, 4).join(', ') });
    if (!h.entries.some(e => /^x-default$/i.test(e.lang))) hlProblems.no_default.push({ ...h, detail: 'no x-default' });
    // return tags, judged only against pages whose own set we hold: a missing return link is a link the other page does not give back
    const missing = [];
    for (const e of h.entries) {
      if (sameUrl(e.href, h.url)) continue;
      const other = held.get(normU(e.href)); if (!other) continue;
      if (!other.entries.some(x => sameUrl(x.href, h.url))) missing.push(e.lang + ' \u2192 ' + pathOf(e.href));
    }
    if (missing.length) hlProblems.no_return.push({ ...h, detail: 'the alternate does not link back: ' + missing.slice(0, 4).join(', ') });
  }
  hreflang = { declared_on: hlDeclaring.length, pages_read: hreflangBy.length, pages: hlDeclaring.map(h => ({ path: h.path, languages: h.entries.map(e => e.lang).slice(0, 30) })).slice(0, 25),
    problems: Object.fromEntries(Object.entries(hlProblems).map(([k, v]) => [k, v.length])),
    method: 'Read from the first response of the pages checked above (the link rel=alternate hreflang tags and the Link header): valid language/region codes, absolute addresses, a self-reference, one address per language, an x-default, and return links between the pages whose set we hold. A set declared only in the XML sitemap is not read, and a return link is checked only against pages read in this run.' };
}
const render_diff = {
  available: checked.length > 0,
  crawl_js: !!plan.crawl_js,
  uncrawlable_links,
  not_available: checked.length ? '' : (targets.length ? 'no key page could be read twice: ' + (notChecked[0] ? notChecked[0].not_checked : 'both readings failed') : (plan.reason || 'no page to compare')),
  pages, pages_checked: checked.length, pages_not_checked: notChecked.length, pages_with_js_only: withJs.length,
  // B5-6: how many of the pages were read raw and paired with the JavaScript crawl instead of being rendered again
  paired_with_crawl: checked.filter(p => p.paired_with_crawl).length, paired_note: plan.raw_pairs_note || '',
  hreflang,
  cap: plan.cap || 0, rendered_source: checked.length ? checked[0].rendered_source : '',
  // B-1: the method says exactly what was compared, and how, for each of the two kinds of page
  method: 'Each page was read twice: a plain GET of the page under our own audit user agent (the first response, what a crawler that does not run JavaScript receives from a plain request; a site that answers named AI bots differently is read by the AI crawler access check, not here) and the same page after its scripts ran. '
    + 'For the ' + (plan.cap || 5) + ' key pages rendered by the render service both readings are HTML and title, main heading, canonical link, robots meta, links and text length are read from both with the same parser. '
    + (extras.length ? 'With this JavaScript crawl ' + extras.length + ' more pages are paired with the crawl itself (it is already the rendered reading, one free plain request each). The crawl keeps its own figures, not the HTML: title, main heading and canonical link are compared as text (entities decoded); the robots rule is not compared (the crawl keeps the rule it derived); links and words are counted differently (the crawl counts unique links and the main text, our parser every link and every word), so a count is read as script-written content only when the crawl saw at least ' + CRAWL_GAP + ' times what the first response carries, and is otherwise not compared. ' : '')
    + 'A count only matters when the page after JavaScript has more than the first response: a first response that carries more hides nothing from a crawler. URLs are compared without the www. prefix.',
  pages_counts_not_compared: checked.filter(p => (p.not_compared || []).some(k => k === 'links' || k === 'words')).length,
  figures: FIGURES.map(f => f.label),
  checked_at: new Date().toISOString()
};

// ---- findings ----
const findings = [];
const works = [];
// `figure` names the reading this finding came from (h1, words, title, canonical, robots, links, uncrawlable, all). Build Site Issues uses
// it to join a crawl-wide symptom to its cause instead of scoring both (build section 65, B5-2).
const F = (category, severity, title, evidence, why, fix, urls, scoring, figure) => findings.push({ category, severity, title, evidence, why, fix,
  sample_urls: (urls || []).slice(0, 5), affected_count: (urls || []).length || null, affected_pct: checked.length ? Math.round(((urls || []).length / checked.length) * 100) : null,
  affected_of: checked.length, affected_unit: extras.length ? 'pages read twice' : 'key pages read twice',   // R72: the percentage is a share of the key pages read twice, not of the crawl
  scope: 'page', scoring: scoring !== false, source: 'render_diff', figure: figure || '' });
const quote = (p, key) => { const f = p.figures.find(x => x.key === key) || {}; return p.path + ': ' + (key === 'links' || key === 'words' ? (Number(f.raw) || 0) + ' in the first response, ' + (Number(f.rendered) || 0) + ' after JavaScript' : '"' + S(f.rendered).slice(0, 70) + '" (the first response has ' + (S(f.raw) ? '"' + S(f.raw).slice(0, 70) + '"' : 'none') + ')'); };
const only = (key) => checked.filter(p => p.js_only.includes(key));
const differ = (key) => checked.filter(p => (p.differs || []).includes(key));

const h1Only = only('h1');
if (h1Only.length) F('Crawlability & Indexing', 'High', 'The main heading of ' + h1Only.length + ' page(s) only appears after JavaScript',
  h1Only.map(p => quote(p, 'h1')).join(' · '),
  'The heading is the strongest on-page signal of what a page is about. A crawler that does not run JavaScript — every AI crawler today, and Google on its first pass — sees the page without it.',
  'Render the <h1> on the server (server-side rendering, static generation or a prerender layer) so it is in the HTML of the first response.',
  h1Only.map(p => p.url), true, 'h1');

const textOnly = only('words');
if (textOnly.length) F('Crawlability & Indexing', 'High', 'The page text of ' + textOnly.length + ' page(s) only appears after JavaScript',
  textOnly.map(p => quote(p, 'words')).join(' · '),
  'A page whose text arrives only after its scripts run is an empty shell to any crawler that does not render, so it cannot be quoted, summarised or cited.',
  'Serve the main content in the first HTML response. Where that is a bigger change, add a prerender layer for crawlers first.',
  textOnly.map(p => p.url), true, 'words');

const titleBad = [...only('title'), ...differ('title')];
if (titleBad.length) F('On-Page', 'Medium', 'The title of ' + titleBad.length + ' page(s) is written by JavaScript',
  titleBad.map(p => quote(p, 'title')).join(' · '),
  'The title is what search engines and AI answers show. When the first response carries a different title (or none), that is the one a non-rendering crawler indexes.',
  'Put the final <title> in the server response instead of setting it from a script after load.',
  titleBad.map(p => p.url), true, 'title');

const canonBad = [...only('canonical'), ...differ('canonical')];
if (canonBad.length) F('Crawlability & Indexing', 'Medium', 'The canonical link of ' + canonBad.length + ' page(s) is not in the first response',
  canonBad.map(p => quote(p, 'canonical')).join(' · '),
  'A canonical that a script inserts is ignored by crawlers that do not render, so duplicates of the page can be indexed instead of the one you chose. (A www. host against a bare host is the same URL and is not counted here.)',
  'Output <link rel="canonical"> in the server-rendered <head>.',
  canonBad.map(p => p.url), true, 'canonical');

const robotsBad = [...only('robots'), ...differ('robots')];
if (robotsBad.length) {
  const blocksAfter = robotsBad.filter(p => { const f = p.figures.find(x => x.key === 'robots') || {}; return /noindex|none/i.test(S(f.rendered)) && !/noindex|none/i.test(S(f.raw)); });
  F('Crawlability & Indexing', blocksAfter.length ? 'High' : 'Medium', 'The robots meta of ' + robotsBad.length + ' page(s) changes after JavaScript',
    robotsBad.map(p => quote(p, 'robots')).join(' · '),
    blocksAfter.length ? 'A script adds noindex after load: the page looks indexable in the first response and asks to be dropped once rendered, and which reading wins is out of your hands.'
      : 'The indexing rules a crawler reads depend on whether it rendered the page, so two crawlers can treat the same page differently.',
    'Decide the robots directive on the server and send the same one in the first response (or as an X-Robots-Tag header).',
    robotsBad.map(p => p.url), true, 'robots');
}

const linksOnly = only('links');
if (linksOnly.length) F('Crawlability & Indexing', 'Medium', 'Most links of ' + linksOnly.length + ' page(s) appear only after JavaScript',
  linksOnly.map(p => quote(p, 'links')).join(' · '),
  'Links that a script writes are not followed by crawlers that do not render, so the pages behind them can stay undiscovered.',
  'Output real <a href> links in the server response for navigation and in-content links (a script may still enhance them).',
  linksOnly.map(p => p.url), true, 'links');

// ---- B5-4: hreflang (only when a page of the site declares it) ----
if (hreflang) {
  const HF = (sev, title, key, why, fix) => { const list = hlProblems[key]; if (!list.length) return;
    F('Technical', sev, title.replace(/\bN\b/, String(list.length)), list.map(h => h.path + ': ' + h.detail).join(' \u00b7 '), why, fix, list.map(h => h.url), true, 'hreflang'); };
  HF('Medium', 'The hreflang tags of N page(s) use a code Google does not accept', 'invalid', 'A code that is not a valid language (and optional region) is ignored, so the language versions are not tied together and the wrong one can be shown.', 'Use ISO 639-1 language codes with an optional ISO 3166-1 region (en, en-GB, ar-AE) or x-default.');
  HF('Medium', 'The hreflang addresses of N page(s) are not absolute', 'relative', 'hreflang takes a full URL including the protocol; a relative path is not reliable.', 'Write each alternate as a full address (https://example.com/ar/).');
  HF('Medium', 'N page(s) with hreflang do not point to themselves', 'no_self', 'Each page of a language set should list itself as well as its alternates, or the set is incomplete.', 'Add a self-referencing hreflang entry on every page of the set.');
  HF('Medium', 'The hreflang return links of N page(s) are missing on the alternate', 'no_return', 'An alternate that does not link back is ignored: both pages must list each other.', 'Add the reciprocal hreflang entry on the alternate page.');
  HF('Medium', 'N page(s) give one language two different addresses', 'duplicate', 'When one language points at two addresses Google cannot tell which is meant and may ignore the set.', 'List one address per language and region.');
  HF('Low', 'N page(s) with hreflang have no x-default', 'no_default', 'x-default tells Google which version to show people whose language is not in the set; it is recommended, not required.', 'Add an alternate link with hreflang x-default pointing at the page you want for everyone else.');
}

// ---- B5-1 (2026-10-15, benchmark area 5): the links a crawler cannot follow, and the orphan pages they explain ----
// Three or more on one page, or any on two pages, is a pattern and not a stray widget. The severity follows the harm that is visible in
// this same audit: Medium where the crawl already reports orphan pages or where most links appear only after JavaScript (the pages behind
// them are genuinely unreachable), Low otherwise - it is still worth fixing, never worth ranking first.
if (uncTotal >= 3 || uncPages.length >= 2) {
  const sev = (orphanPages.length || linksOnly.length) ? 'Medium' : 'Low';
  const kinds = uncrawlable_links.kinds.map(k => UNC_KINDS[k] || k);
  F('Crawlability & Indexing', sev, uncTotal + ' link(s) on ' + uncPages.length + ' key page(s) are built without a real <a href>',
    uncPages.map(p => p.path + ': ' + p.uncrawlable + ' (' + (p.uncrawlable_samples || []).map(x => '<' + x.tag + '>' + (x.detail ? ' \u2192 ' + x.detail : '')).slice(0, 3).join(', ') + ')').join(' \u00b7 ')
      + (orphanPages.length ? ' \u2014 the crawl also found ' + orphanPages.length + ' orphan page(s) with no crawlable internal link, which is what these usually cause' : ''),
    'A card, a tile or a button that navigates with a script is not a link: ' + kinds.join(', ') + '. No crawler queues the page behind it and no internal-link signal reaches it, so those pages are crawled rarely, rank on their own merits only, and are invisible to the AI crawlers, which do not run JavaScript at all.',
    'Make each one a real <a href="\u2026"> to the same address (the script can stay on top of it for the behaviour you want). The crawler, the AI crawlers and keyboard users all follow it then.',
    uncPages.map(p => p.url), true, 'uncrawlable');
}

const differsAny = checked.filter(p => p.js_only.length || (p.differs || []).length);
if (differsAny.length) F('AI Search Readiness', 'Medium', 'AI crawlers see a different version of ' + differsAny.length + ' key page(s)',
  differsAny.map(p => p.path + ' (' + [...p.js_only, ...(p.differs || [])].map(k => (FIGURES.find(f => f.key === k) || {}).label).join(', ') + ')').join(' · '),
  'ChatGPT, Perplexity, Claude and the other AI crawlers fetch the HTML and do not run JavaScript, so anything a script adds is invisible to the answers they write.',
  'Server-render at least the title, the main heading, the opening answer and the in-content links of every page you want quoted.',
  differsAny.map(p => p.url), true, 'all');

if (notChecked.length) F('Technical', 'Info', 'The response-versus-render check could not be completed for ' + notChecked.length + ' page(s)',
  notChecked.map(p => p.path + ': ' + p.not_checked).join(' · '),
  'A reading that failed says nothing about the page: it is reported as not checked rather than as "no difference".',
  notChecked.some(p => /bot challenge/.test(p.not_checked)) ? 'Allow our crawler through the bot protection (or share a staging URL) so the two readings can be compared.' : 'Nothing to do if the page answered for visitors; the next audit tries again.',
  notChecked.map(p => p.url), false, '');

if (checked.length && !withJs.length && !checked.some(p => (p.differs || []).length)) {
  const ncP = checked.filter(p => (p.not_compared || []).length).length;   // B-1: say which figures were not compared on the crawl-paired pages
  works.push('Every ' + (extras.length ? '' : 'key ') + 'page checked (' + checked.length + ') serves its title, heading, canonical, robots rule, links and text in the first response, so crawlers that do not run JavaScript see the same page as Google does'
    + (ncP ? ' (on ' + ncP + ' page(s) paired with the JavaScript crawl the robots rule and the link and word counts were compared only as far as the crawl\'s own way of counting allows: see the method)' : ''));
}

return [{ json: { ...prev, skip: undefined, render_diff,
  extra_findings: [...(prev.extra_findings || []), ...findings],
  extra_works: [...(prev.extra_works || []), ...works] } }];
