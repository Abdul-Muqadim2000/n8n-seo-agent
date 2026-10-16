// Link Builder: everything read this run turned into decisions (LINK_BUILDER_SPEC.md §2-§6), per site —
// - journalist requests matched to the site's topics (deadline kept), resource pages, competitors' broken links → new prospects;
// - every prospect read qualified: gone / blocked / sells links / other language / already linking → not a fit (with the reason); the
//   evidence a personal first line can quote (the sentence naming us, the dead link, the list, the section on our topic); up to 3 contacts
//   ranked author / named person → editorial → general; a contact form when there is no address; the recipient's country (consent rules);
//   our page to point to and the link text to ask for (pickTarget: topic match × position band × links needed, paced per page);
// - the listings checklist (linked / listed / missing / submitted / unknown — a blocked check is unknown, never missing), competitors present;
// - our old URLs that now 404 → redirects to add; what each won link did for its page (impact, with a control group);
// - L5 (2026-10-13): journalist requests from a media digest the app read in the customer's mailbox, and podcast shows that take guests
//   (qualified like every other prospect: on topic, still publishing, says it takes guests, a contact on the show's own domain);
// - L6 (2026-10-13): what kind of page earns links in this market, from the competitors' most-linked pages (never a promise of links);
// - this week's writer jobs: the best `budget` ready prospects (value × fit), not in free-only checks.
// G12 (2026-10-13, FIX_PLAN): the control-group comparison that read what a won link did now also reads what a page CHANGE did
// (section 5b). One implementation (CT, v5/code/_change_test.js), one set of graded verdicts, the same table (seo_link_impact, with a
// `kind` column: link | page_change). Nothing in it ever says a change caused a move.
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

// ---- the "links you can add yourself" checklist (v4.13, LINK_BUILDER_SPEC.md §4; inlined by the build) ----
// Research 2026-10-10 (fetched profiles, platform docs): most big directories block automated checks (G2 DataDome, Capterra, Clutch, TrustRadius,
// Product Hunt, Crunchbase → 403 / challenge), so detection uses what can be seen: the site's own and its competitors' links and sameAs to
// the platform, our link ledger and GA4 referrals, a guessed profile URL where the platform answers, and the platform's public page or list.
// A blocked check is "unknown", never "missing". Link kinds as seen on real profiles (they change: re-checked, never hard-coded in the UI):
// TrustRadius followed; Clutch / GoodFirms / SaaSHub nofollow; Product Hunt ugc; G2 no crawlable link; Capterra none on free profiles.
// Nothing is submitted for the customer (the platforms' terms forbid bots; Google names automated link creation as link spam).
// fields: id, name, host (link / referral matching), cat, kinds (saas | agency | local | any), countries (ISO-2 list, empty = all), topics
// (regex on the site's topics / business type, optional), integ (regex on the site's own pages: shown only for integrations it has),
// re (profile URL), guess (profile URL from { slug, domain }), fetchable (answers a plain fetch), list (a single public page that lists
// members: fetched and searched for the domain / name), link, ai (how much AI answers draw on it), prio (1 first), submit, why.
const LISTINGS = [
  { id: 'mof_asp', name: 'UAE Ministry of Finance — accredited e-invoicing providers', host: 'mof.gov.ae', cat: 'government', kinds: ['saas', 'agency', 'any'], countries: ['AE'], topics: /e-?invoic|peppol|einvoic/i,
    list: 'https://mof.gov.ae/en/about-us/initiatives/einvoicing/pre-approved-einvoicing-service-providers/', link: 'followed', ai: 'high', prio: 1, submit: 'https://mof.gov.ae/en/about-us/initiatives/einvoicing/',
    why: 'Only accredited providers may offer e-invoicing in the UAE; each listed provider gets a followed link from the Ministry, and AI answers cite this page. Accreditation: Peppol-certified provider for 2 years, ISO 27001 + 22301, insurance — or appear through your accredited partner.' },
  { id: 'openpeppol', name: 'OpenPeppol certified service providers', host: 'peppol.org', cat: 'industry', kinds: ['saas', 'any'], countries: [], topics: /e-?invoic|peppol|einvoic/i,
    list: 'https://peppol.org/members/peppol-certified-service-providers/', link: 'none', ai: 'medium', prio: 2, submit: 'https://peppol.org/join/',
    why: 'The industry body\'s list of certified access points; a strong trust signal for buyers and AI, required for UAE accreditation.' },
  { id: 'g2', name: 'G2', host: 'g2.com', cat: 'reviews', kinds: ['saas'], re: /g2\.com\/products\/([a-z0-9-]+)/i, guess: (x) => 'https://www.g2.com/products/' + x.slug + '/reviews',
    link: 'none', ai: 'high', prio: 1, submit: 'https://sell.g2.com/', why: 'Buyers and AI assistants read G2 when comparing software; G2 also runs Capterra, GetApp and Software Advice.' },
  { id: 'capterra', name: 'Capterra / GetApp / Software Advice', host: 'capterra.com', cat: 'reviews', kinds: ['saas'], re: /capterra\.com\/p\/\d+\/[^\/"'\s]+/i,
    link: 'none', ai: 'high', prio: 1, submit: 'https://www.capterra.com/vendors/', why: 'One listing reaches three comparison sites that buyers and AI answers use for "best X software".' },
  { id: 'trustradius', name: 'TrustRadius', host: 'trustradius.com', cat: 'reviews', kinds: ['saas'], re: /trustradius\.com\/products\/([a-z0-9-]+)/i, guess: (x) => 'https://www.trustradius.com/products/' + x.slug + '/reviews',
    link: 'followed', ai: 'medium', prio: 1, submit: 'https://www.trustradius.com/vendors', why: 'The one big review site whose vendor button is a followed link.' },
  { id: 'saashub', name: 'SaaSHub', host: 'saashub.com', cat: 'directory', kinds: ['saas'], re: /saashub\.com\/([a-z0-9-]+)$/i, guess: (x) => 'https://www.saashub.com/' + x.slug, fetchable: true,
    link: 'nofollow', ai: 'low', prio: 3, submit: 'https://www.saashub.com/submit', why: 'Free listing with alternatives pages buyers browse.' },
  { id: 'alternativeto', name: 'AlternativeTo', host: 'alternativeto.net', cat: 'directory', kinds: ['saas'], re: /alternativeto\.net\/software\/([a-z0-9-]+)/i, guess: (x) => 'https://alternativeto.net/software/' + x.slug + '/about/',
    link: 'unknown', ai: 'low', prio: 3, submit: 'https://alternativeto.net/', why: 'Shown when people look for alternatives to your competitors.' },
  { id: 'producthunt', name: 'Product Hunt', host: 'producthunt.com', cat: 'launch', kinds: ['saas'], re: /producthunt\.com\/(products|posts)\/([a-z0-9-]+)/i, guess: (x) => 'https://www.producthunt.com/products/' + x.slug,
    link: 'ugc', ai: 'low', prio: 3, submit: 'https://www.producthunt.com/posts/new', why: 'A launch page and a burst of visitors; worth it with a real launch or new feature.' },
  { id: 'crunchbase', name: 'Crunchbase', host: 'crunchbase.com', cat: 'company', kinds: ['saas', 'agency', 'any'], re: /crunchbase\.com\/organization\/([a-z0-9-]+)/i, guess: (x) => 'https://www.crunchbase.com/organization/' + x.slug,
    link: 'nofollow', ai: 'medium', prio: 2, submit: 'https://www.crunchbase.com/', why: 'The company database journalists, investors and AI assistants use to describe a business.' },
  { id: 'linkedin', name: 'LinkedIn company page', host: 'linkedin.com', cat: 'social', kinds: ['saas', 'agency', 'local', 'any'], re: /linkedin\.com\/company\/([a-z0-9-]+)/i,
    link: 'nofollow', ai: 'high', prio: 1, submit: 'https://www.linkedin.com/company/setup/new/', why: 'AI answers on B2B topics cite LinkedIn; buyers check it before they reply.' },
  { id: 'youtube', name: 'YouTube channel', host: 'youtube.com', cat: 'social', kinds: ['saas', 'agency', 'local', 'any'], re: /youtube\.com\/(@[a-z0-9._-]+|channel\/[a-z0-9_-]+|c\/[a-z0-9_-]+)/i,
    link: 'nofollow', ai: 'high', prio: 2, submit: 'https://www.youtube.com/create_channel', why: 'YouTube mentions correlate with AI visibility more than any other signal (Ahrefs 2025); short explainers are enough.' },
  { id: 'trustpilot', name: 'Trustpilot', host: 'trustpilot.com', cat: 'reviews', kinds: ['local', 'any'], re: /trustpilot\.com\/review\/([a-z0-9.-]+)/i, guess: (x) => 'https://www.trustpilot.com/review/' + x.domain,
    link: 'nofollow', ai: 'medium', prio: 3, submit: 'https://business.trustpilot.com/', why: 'Reviews for small-business and consumer buyers.' },
  { id: 'clutch', name: 'Clutch', host: 'clutch.co', cat: 'reviews', kinds: ['agency'], re: /clutch\.co\/profile\/([a-z0-9-]+)/i, guess: (x) => 'https://clutch.co/profile/' + x.slug,
    link: 'nofollow', ai: 'medium', prio: 1, submit: 'https://clutch.co/get-listed', why: 'The review site buyers use to shortlist agencies and service firms.' },
  { id: 'goodfirms', name: 'GoodFirms', host: 'goodfirms.co', cat: 'reviews', kinds: ['agency', 'saas'], re: /goodfirms\.co\/(company|software)\/([a-z0-9-]+)/i, guess: (x) => 'https://www.goodfirms.co/company/' + x.slug,
    link: 'nofollow', ai: 'low', prio: 2, submit: 'https://www.goodfirms.co/get-listed', why: 'Agency and software directory with category rankings.' },
  { id: 'designrush', name: 'DesignRush', host: 'designrush.com', cat: 'directory', kinds: ['agency'], re: /designrush\.com\/agency\/profile\/([a-z0-9-]+)/i,
    link: 'unknown', ai: 'low', prio: 3, submit: 'https://www.designrush.com/agency/get-listed', why: 'Agency directory with "best agencies" lists.' },
  { id: 'google_business', name: 'Google Business Profile', host: 'google.com', cat: 'local', kinds: ['local'], re: /(google\.[a-z.]+\/maps\/place|g\.page|maps\.app\.goo\.gl)/i,
    link: 'website', ai: 'high', prio: 1, submit: 'https://business.google.com/', why: 'Maps and local results; only for a staffed office or a service area (online-only businesses are not eligible).' },
  { id: 'bing_places', name: 'Bing Places', host: 'bing.com', cat: 'local', kinds: ['local'], link: 'website', ai: 'medium', prio: 2, submit: 'https://www.bingplaces.com/', why: 'Bing Maps and Copilot; imports your Google profile in a few clicks.' },
  { id: 'apple_business', name: 'Apple Business', host: 'apple.com', cat: 'local', kinds: ['local'], link: 'website', ai: 'low', prio: 2, submit: 'https://business.apple.com/', why: 'Apple Maps and Siri.' },
  { id: 'facebook', name: 'Facebook page', host: 'facebook.com', cat: 'social', kinds: ['local'], re: /facebook\.com\/([a-z0-9.]+)\/?$/i, link: 'nofollow', ai: 'low', prio: 3, submit: 'https://www.facebook.com/pages/create', why: 'Local customers check it for hours and reviews.' },
  { id: 'yellowpages_uae', name: 'Yellow Pages UAE', host: 'yellowpages-uae.com', cat: 'directory', kinds: ['saas', 'agency', 'local', 'any'], countries: ['AE'], re: /yellowpages-uae\.com\/[^"'\s]+/i,
    link: 'unknown', ai: 'low', prio: 3, submit: 'https://www.yellowpages-uae.com/pages/list-your-business', why: 'Free UAE business listing with a link to your website.' },
  { id: 'dubai_chambers', name: 'Dubai Chambers commercial directory', host: 'dubaichambers.com', cat: 'chamber', kinds: ['saas', 'agency', 'local', 'any'], countries: ['AE'],
    link: 'unknown', ai: 'low', prio: 3, submit: 'https://www.dubaichambers.com/', why: 'For members: the chamber directory buyers and partners search.' },
  { id: 'appsource', name: 'Microsoft Marketplace (AppSource)', host: 'appsource.microsoft.com', cat: 'marketplace', kinds: ['saas'], integ: /microsoft dynamics|dynamics 365|business central|microsoft 365|azure/i,
    link: 'unknown', ai: 'medium', prio: 2, submit: 'https://partner.microsoft.com/', why: 'A "Contact me" listing has no technical requirements; Dynamics customers look for add-ons there.' },
  { id: 'zoho_marketplace', name: 'Zoho Marketplace', host: 'marketplace.zoho.com', cat: 'marketplace', kinds: ['saas'], integ: /\bzoho\b/i, link: 'unknown', ai: 'low', prio: 2, submit: 'https://marketplace.zoho.com/', why: 'Zoho Books / Invoice users find integrations there.' },
  { id: 'odoo_apps', name: 'Odoo Apps', host: 'apps.odoo.com', cat: 'marketplace', kinds: ['saas'], integ: /\bodoo\b/i, link: 'unknown', ai: 'low', prio: 2, submit: 'https://apps.odoo.com/', why: 'Odoo users install connectors from the app store.' },
  { id: 'sap_store', name: 'SAP Store', host: 'store.sap.com', cat: 'marketplace', kinds: ['saas'], integ: /\bsap\b/i, link: 'unknown', ai: 'low', prio: 3, submit: 'https://www.sap.com/partners.html', why: 'Through the SAP partner programme; for SAP integrations.' },
  { id: 'hubspot_marketplace', name: 'HubSpot App Marketplace', host: 'ecosystem.hubspot.com', cat: 'marketplace', kinds: ['saas'], integ: /\bhubspot\b/i, link: 'unknown', ai: 'low', prio: 3, submit: 'https://developers.hubspot.com/', why: 'Needs 3+ active installs; for a real HubSpot integration.' },
  { id: 'xero_apps', name: 'Xero App Store', host: 'apps.xero.com', cat: 'marketplace', kinds: ['saas'], integ: /\bxero\b/i, link: 'unknown', ai: 'low', prio: 3, submit: 'https://developer.xero.com/', why: 'For a Xero integration.' },
  { id: 'quickbooks_apps', name: 'QuickBooks App Store', host: 'apps.intuit.com', cat: 'marketplace', kinds: ['saas'], integ: /quickbooks/i, link: 'unknown', ai: 'low', prio: 3, submit: 'https://developer.intuit.com/', why: 'For a QuickBooks integration.' }];
const LISTING_HOSTS = LISTINGS.map(l => l.host);
// which entries apply to a site: its kind (from the business type and topics), country, topics, and the integrations its own pages name
function listingsFor(kinds, iso, topicText, siteText) {
  const K = Array.isArray(kinds) ? kinds : [kinds];
  return LISTINGS.filter(l => (K.some(k => l.kinds.includes(k)) || (l.kinds.includes('any') && !K.includes('local') && l.cat !== 'local')) && (!l.countries || !l.countries.length || l.countries.includes(String(iso || '').toUpperCase()))
    && (!l.topics || l.topics.test(topicText || '')) && (!l.integ || l.integ.test(siteText || '')));
}
// What a fetched listing page is allowed to claim (P34-2, live 2026-10-12): three listings came back "listed" when they were not —
// SaaSHub and the UAE Ministry of Finance list because the brand "Tech&" matched the plain word "tech" (neither page contains
// "techand"), AlternativeTo because a 403 bot wall was read as a profile found by search. A listing is claimed only on hard evidence:
// a link to our host (linked), or the page naming us distinctively (listed; OK.namesUs decides what counts as a name). A blocked or
// challenged page claims nothing — "unknown", never "listed" and never "missing" — and the caller keeps the last definite answer.
// o: { blocked, status, links_us, rel, named, as_list, guessed, gone, url }
function listingClaim(o) {
  const x = o || {}; const where = x.as_list ? 'list' : 'profile';
  if (x.blocked) return { status: 'unknown', evidence: 'the platform blocked this check' + (x.status ? ' (HTTP ' + x.status + ')' : '') + ': nothing can be read from it' };
  if (x.links_us) return { status: 'linked', evidence: 'the ' + where + ' links to you' };
  if (x.named) return { status: 'listed', evidence: 'the ' + where + ' names you ("' + String(x.named).slice(0, 40) + '") without a link' };
  if (x.gone) return x.guessed ? { status: 'missing', evidence: 'no profile at ' + String(x.url || '') } : { status: 'unknown', evidence: 'the page we found is gone: check the platform' };
  if (x.as_list) return { status: 'missing', evidence: 'the list does not name you' };
  return { status: 'unknown', evidence: 'the page at ' + String(x.url || '') + ' does not name you: it may belong to another product, or your profile may use a different name' };
}
function siteKind(businessType, topicText) {   // the checklists that apply: a consultancy that also sells software gets both
  const t = String(businessType || '') + ' ' + String(topicText || '');
  if (/restaurant|cafe|clinic|dental|salon|store|shop|hotel|gym|plumb|electric|lawyer|law firm|real estate|local ?business|medical|spa|bakery/i.test(t)) return ['local'];
  const agency = /agency|consult|marketing services|design studio|development services|professional ?service|accounting firm|audit firm/i.test(t);
  const software = /software|saas|platform|\bapp\b|cloud|e-?invoic|\berp\b|automation|\bapi\b/i.test(t);
  return agency && software ? ['agency', 'saas'] : agency ? ['agency'] : ['saas'];
}

// ---- change test (G12, 2026-10-13, system review FIX_PLAN.md; CRITERIA_technical_tracking_reporting_ai_links.md 3.4) ----
// "We changed the page and clicks went up" is not a result: seasonality and Google's own updates move every page on a site at once
// (P1: CausalImpact, Brodersen et al. 2015 - measuring a change needs a control or a counterfactual; P2: even the most reliable test
// type SearchPilot publishes wins only about 2 times in 3). The Link Builder already measured a won link against a control group of
// the site's OTHER pages over the same weeks; this kit is that same comparison, lifted out so a PAGE CHANGE can be read the same way.
// The verdicts are graded and deliberately weak: "likely helped" / "possibly helped" / "no clear effect yet" / "too early to tell" /
// "can't tell". Nothing here ever says a change CAUSED anything - a control group narrows the alternatives, it does not prove a cause.
const CT = (() => {
  const LABELS = { likely_helped: 'Likely helped', possibly_helped: 'Possibly helped', no_effect_yet: 'No clear effect yet', too_early: 'Too early to tell', cant_tell: 'Can\'t tell' };
  const MIN_WEEKS = 6;          // a change read before 6 weeks says "too early": Google needs weeks to settle (P2: ~10 weeks per position for a link)
  const MIN_OTHERS = 3;         // fewer than 3 other pages to compare with = no usable control group, so the verdict can only be "possibly"
  const r1 = (n) => Math.round(10 * n) / 10;
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
  const S = (v) => String(v == null ? '' : v);
  const NOTES = {
    link: { early: 'read at 6, 10 and 16 weeks after the link went live', no_data: 'the page had no search impressions before or after the link' },
    page: { early: 'read at 6, 10 and 16 weeks after the change', no_data: 'the page had no search impressions before or after the change' },
  };
  const label = (v) => LABELS[v] || S(v);
  /**
   * One change, against the control group of the site's other pages over the same window. Positions: lower is better, so a positive
   * `page_change` means the page moved UP. `others` are the control pages' own moves (before - after), unrounded.
   * o: { weeks, base, now, others, joint, kind, min_weeks, min_others, no_data, early }
   */
  const compare = (o) => {
    const x = o || {}; const kind = NOTES[x.kind] ? x.kind : 'page';
    const minWeeks = x.min_weeks == null ? MIN_WEEKS : x.min_weeks, minOthers = x.min_others == null ? MIN_OTHERS : x.min_others;
    const weeks = Math.max(0, Math.floor(Number(x.weeks) || 0));
    const out = { weeks, base_position: 0, position: 0, page_change: 0, control_change: 0, control_spread: 0, control_pages: 0, effect: 0, verdict: '', verdict_label: '', note: '' };
    if (weeks < minWeeks) { out.verdict = 'too_early'; out.note = S(x.early) || NOTES[kind].early; out.verdict_label = label(out.verdict); return out; }
    const base = x.base == null || x.base === '' ? null : Number(x.base), now = x.now == null || x.now === '' ? null : Number(x.now);
    if (!Number.isFinite(base) || !Number.isFinite(now) || base <= 0 || now <= 0) {
      out.verdict = 'cant_tell'; out.note = S(x.no_data) || NOTES[kind].no_data; out.verdict_label = label(out.verdict); return out; }
    const others = (x.others || []).map(Number).filter(Number.isFinite);
    out.base_position = r1(base); out.position = r1(now); out.page_change = r1(out.base_position - out.position);
    const mid = median(others);
    out.control_change = r1(mid); out.control_spread = r1(median(others.map(d => Math.abs(d - mid)))); out.control_pages = others.length;
    out.effect = r1(out.page_change - out.control_change);
    const joint = Number(x.joint) || 0;
    out.verdict = others.length < minOthers ? (out.effect > 1 ? 'possibly_helped' : 'no_effect_yet')
      : out.effect > Math.max(1, 2 * out.control_spread) && !joint ? 'likely_helped'
      : out.effect > Math.max(0.5, out.control_spread) ? 'possibly_helped' : 'no_effect_yet';
    out.verdict_label = label(out.verdict);
    out.note = (joint ? (kind === 'link' ? 'another link to this page within 4 weeks (credit shared); ' : 'another change to this page within 4 weeks (credit shared); ') : '')
      + (others.length < minOthers ? 'few other pages to compare with; ' : '')
      + 'position ' + out.base_position + ' → ' + out.position + ' vs the site\'s other pages ' + (out.control_change >= 0 ? '+' : '') + out.control_change;
    return out;
  };
  const method = 'Each change is dated and read against a control group: the same page\'s average Google position before and after, minus what the site\'s OTHER pages did over the same weeks. That removes the part of the move that was the season, the market or a Google update. "Likely helped" means the page beat its control group by more than twice the spread of the control group itself and nothing else changed on that page in the same four weeks; "possibly helped" means it beat the control group by less than that; "no clear effect yet" means it did not. A control group narrows the alternatives: it is never proof of cause.';
  const summary = (rows) => { const list = (rows || []); const by = (v) => list.filter(r => r.verdict === v).length;
    return { total: list.length, likely_helped: by('likely_helped'), possibly_helped: by('possibly_helped'), no_effect_yet: by('no_effect_yet'), too_early: by('too_early'), cant_tell: by('cant_tell'),
      read: list.filter(r => !['too_early', 'cant_tell'].includes(r.verdict)).length }; };
  return { compare, label, summary, method, LABELS, NOTES, MIN_WEEKS, MIN_OTHERS, r1, median };
})();
// ---- podcast kit (L5, LINK_BUILDER_SPEC.md §2: podcast guest opportunities; inlined after the link kit) ----
// A guest appearance on a show in the site's topics earns an editorial link from the show's own page, and the owner has to say yes to it —
// so the shows are found for free, qualified like any other prospect and pitched only when there is a contact on the show's OWN domain.
// Where the list comes from: Apple's podcast directory (`itunes.apple.com/search`) needs no key at all. The **Podcast Index API**
// (`SEO_PODCASTINDEX_API_KEY` / `SEO_PODCASTINDEX_API_SECRET`) signs every request with sha1(key + secret + unix time); an n8n credential
// cannot compute that per request and a node may not hold the secret ($env is blocked in nodes on this instance), so the signed path waits
// for the owner's key **and** a signing step — `shows()` already reads both answers, so only the URL changes when it arrives.
// Regex only (the n8n Code sandbox has no URL and no DOM).
const PC = (() => {
  const S = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : 0; };
  const APPLE = 'https://itunes.apple.com/search?media=podcast&entity=podcast&limit=25&term=';
  const INDEX = 'https://api.podcastindex.org/api/1.0/search/byterm?max=25&clean&fulltext&q=';
  /** one search URL for a topic; `signed` only when the Podcast Index key and a signing step are in place (see the note above) */
  const searchUrl = (topic, signed) => (signed ? INDEX : APPLE) + encodeURIComponent(S(topic).slice(0, 80));
  const KEEP_TITLE = /[a-z]/i;
  /** the shows in a search answer, from either shape (Apple `results`, Podcast Index `feeds`), newest-looking first, deduplicated by feed */
  function shows(j) {
    const out = []; const seen = new Set();
    const add = (o) => { const k = (o.feed || o.title).toLowerCase(); if (!o.feed || !KEEP_TITLE.test(o.title) || seen.has(k)) return; seen.add(k); out.push(o); };
    for (const r of ((j || {}).results || [])) add({ provider: 'apple', title: S(r.collectionName || r.trackName), author: S(r.artistName), feed: S(r.feedUrl),
      platform_url: S(r.collectionViewUrl || r.trackViewUrl), site: '', episodes: num(r.trackCount), genres: (Array.isArray(r.genres) ? r.genres : []).map(S).filter(Boolean), updated: S(r.releaseDate).slice(0, 10) });
    for (const r of ((j || {}).feeds || [])) add({ provider: 'podcastindex', title: S(r.title), author: S(r.author || r.ownerName), feed: S(r.url || r.originalUrl),
      platform_url: '', site: S(r.link), episodes: num(r.episodeCount), genres: Object.values((r.categories && typeof r.categories === 'object') ? r.categories : {}).map(S).filter(Boolean),
      updated: r.lastUpdateTime ? new Date(Number(r.lastUpdateTime) * 1000).toISOString().slice(0, 10) : '' });
    return out;
  }
  const tag = (xml, name) => { const m = String(xml || '').match(new RegExp('<' + name + '\\b[^>]*>([\\s\\S]*?)</' + name + '>', 'i')); return m ? m[1] : ''; };
  const strip = (t) => S(String(t || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;
  /** what an RSS feed says about the show: its own website, its description, the owner's address, how many episodes and how fresh it is */
  function feed(xml) {
    const x = String(xml || '');
    const chan = (x.match(/<channel\b[\s\S]*?(?:<item\b|<\/channel>)/i) || [x])[0];
    const link = strip(tag(chan, 'link')) || (chan.match(/<atom:link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || [])[1] || '';
    const owner = tag(chan, 'itunes:owner');
    const mail = strip(tag(owner, 'itunes:email')) || (owner.match(EMAIL) || [])[0] || (strip(tag(chan, 'managingEditor')).match(EMAIL) || [])[0] || '';
    const dates = [...x.matchAll(/<pubDate>([^<]{6,60})<\/pubDate>/gi)].map(m => Date.parse(m[1])).filter(t => Number.isFinite(t)).sort((a, b) => b - a);
    return { site: /^https?:\/\//i.test(link) ? link.slice(0, 300) : '', title: strip(tag(chan, 'title')).slice(0, 160),
      description: strip(tag(chan, 'description') || tag(chan, 'itunes:summary')).slice(0, 2000), owner_email: S(mail).toLowerCase(),
      author: strip(tag(chan, 'itunes:author')).slice(0, 120), episodes: (x.match(/<item\b/gi) || []).length,
      last_episode: dates.length ? new Date(dates[0]).toISOString().slice(0, 10) : '', episode_titles: [...x.matchAll(/<item\b[\s\S]*?<title>([\s\S]*?)<\/title>/gi)].slice(0, 12).map(m => strip(m[1]).slice(0, 160)).filter(Boolean) };
  }
  // does the show take guests? Said in its own words — a page that invites guests, or a run of episodes that are interviews.
  const INVITE = /(be (?:a|our|my) guest|guest application|apply to (?:be|come on)[^.]{0,30}guest|pitch (?:a|us a|your)[^.]{0,20}(?:guest|story|topic|idea)|(?:suggest|nominate|recommend) a guest|guest form|want to be (?:on|a guest on) the (?:show|podcast)|submit (?:a |your )?guest|guest inquir|guest request|appear on the (?:show|podcast)|come on the (?:show|podcast))/i;
  const INTERVIEW = /\b(interview[sd]?|in conversation with|we (?:talk|speak) (?:to|with)|joins? (?:me|us) (?:on|to)|my guest|our guest|guest[s]?:)\b/i;
  // R27 (2026-10-14, the second re-rating): the week's report offered "Alchemy Uncensored" with the evidence
  // `They say: "b-0"> Efficient Hiring Process We respect your time by managing streamlined, back-to-back interview schedule…` — a
  // leftover HTML attribute from an unrelated page of the show's site, quoted at the owner. A stripper that cuts at the first ">"
  // leaves the rest of an attribute behind whenever a ">" sits inside one, so the text we quote from is cleaned of attribute
  // remains first, and every quote is cut at word and sentence boundaries. A quote that is still not prose is dropped: an
  // opportunity with no quote is honest, a quote of markup is not.
  const ATTR = /(?:^|[\s"'])[a-z-]{1,24}\s*=\s*["'][^"']{0,200}["']/gi;
  const FRAGMENT = /(^|\s)[^\s]{0,40}["']\s*>/g;                       // `b-0">` and friends: the tail of an attribute the stripper cut
  const prose = (t) => S(String(t || '').replace(ATTR, ' ').replace(FRAGMENT, ' ').replace(/[{}<>]|\/?>/g, ' ').replace(/&[a-z#0-9]{2,8};/gi, ' '));
  const PROSE_OK = /^[A-Za-z0-9À-ɏ"'(]/;
  /** a quote a person can read: no markup, starting and ending on a whole word, nothing left of an attribute */
  function cleanQuote(q, max) {
    let x = prose(q).replace(/^[^A-Za-z0-9À-ɏ"'(]+/, '').trim();
    if (!x) return '';
    const limit = Number(max) || 220;
    if (x.length > limit) { const cut = x.slice(0, limit); const at = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' ')); x = (at > 40 ? cut.slice(0, at) : cut).trim() + '…'; }
    const letters = (x.match(/[A-Za-zÀ-ɏ]/g) || []).length;
    return (x.length >= 24 && letters >= x.length * 0.55 && PROSE_OK.test(x)) ? x : '';
  }
  /** { ok, strength: 'invites' | 'interviews', quote } — with nothing of the sort, ok is false and the show is not pitched */
  function guestSignal(texts) {
    const list = (Array.isArray(texts) ? texts : [texts]).map(t => prose(t)).filter(Boolean);
    for (const t of list) { const m = t.match(INVITE); if (m) { const i = Math.max(0, m.index - 90); return { ok: true, strength: 'invites', quote: cleanQuote(t.slice(i, m.index + 160)) }; } }
    const hits = list.flatMap(t => (t.match(new RegExp(INTERVIEW.source, 'gi')) || []));
    if (hits.length >= 2) { const t = list.find(x => INTERVIEW.test(x)) || ''; const m = t.match(INTERVIEW); return { ok: true, strength: 'interviews', quote: cleanQuote(t.slice(Math.max(0, m.index - 90), m.index + 160)) }; }
    return { ok: false, strength: '', quote: '' };
  }
  /** the show's own description wins over its website, and a stronger signal wins over a weaker one (R27) */
  const RANK = { invites: 2, interviews: 1 };
  function pickSignal(fromFeed, fromSite) {
    const a = fromFeed && fromFeed.ok ? fromFeed : null, b = fromSite && fromSite.ok ? fromSite : null;
    if (a && b) return (RANK[b.strength] || 0) > (RANK[a.strength] || 0) ? b : a;   // the feed is the show's own voice: it only loses to a stronger signal
    return a || b || { ok: false, strength: '', quote: '' };
  }
  // a show with no episode in the last half year is not worth a pitch (the feed is the only evidence either way)
  const STALE_DAYS = 200;
  const stale = (last, now) => { if (!last) return false; const d = (new Date(now || Date.now()).getTime() - new Date(last).getTime()) / 864e5; return d > STALE_DAYS ? Math.round(d) : 0; };
  // R27: a guest appearance costs the owner an hour of their own time, so a show has to be further inside our topics than the 25% that
  // qualifies a page for a link (OK.OFF_TOPIC). 29% is not a show worth an hour.
  const MIN_FIT = 0.4;
  return { searchUrl, shows, feed, guestSignal, pickSignal, cleanQuote, prose, stale, STALE_DAYS, MIN_FIT, APPLE, INDEX, strip };
})();
const plans = $('LB Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const rows = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && typeof r === 'object' && Object.keys(r).length && !r.error && !r.skip); } catch (e) { return []; } };
const pair = (a, b) => { try { const R = $(a).all().map(i => i.json); const S = $(b).all().map(i => i.json || {}); return R.map((r, i) => ({ r, x: S[i] || {} })).filter(o => !o.r.skip); } catch (e) { return []; } };
const prospects = rows('Load Link Prospects'), outreach = rows('Load Link Outreach'), listingRows = rows('Load Listings'), ledger = rows('Load Backlinks'), impacts = rows('Load Link Impact'), queries = rows('Load Query History');
const contentLog = rows('Load Content Log');   // G12: the dates pages went live, for the page-change test of section 5b
const sources = pair('LB Source Requests', 'Fetch LB Sources'), pagesRead = pair('LB Page Requests', 'Fetch LB Pages'), second = pair('LB Second Requests', 'Fetch LB Second');
const dfs = pair('LB DFS Requests', 'Run LB DFS Answers');   // L6: the competitors' most-linked pages (kind `pages`); the broken-link answers are read in LB Page Requests
const now = new Date(); const iso = now.toISOString(); const day = iso.slice(0, 10);
const htmlOf = (x) => String(x.body ?? x.data ?? ''); const statusOf = (x) => Number(x.statusCode || x.status || 0);
const jsonOf = (x) => { if (!x) return null; if (x.body && typeof x.body === 'object') return x.body; if (x.posts || Array.isArray(x)) return x; try { return JSON.parse(String(x.body ?? x.data ?? '')); } catch (e) { return null; } };
const errOf = (x) => x.error ? String(x.error.message || x.error.description || x.error).slice(0, 160) : '';
const pathKey = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
// the median and the one-decimal rounding of the control-group reading live in CT now (v5/code/_change_test.js), used by both kinds
const LIKELY = { lost: 0.7, mention: 0.9, list: 0.5, comp_new: 0.55, gap: 0.4, ai_source: 0.35, resource: 0.45, broken: 0.6, press: 0.5, digest: 0.55, podcast: 0.35 };
// L6: the kinds of page that earn links, each with the words that give it away, how many referring domains make it worth saying, and
// what the work actually is. A kind nobody in this market has links for is not suggested.
const ASSET_MIN_RDS = 3, ASSET_MIN_TOTAL = 5;
const ASSET_KINDS = [
  { kind: 'data', label: 'A data study of your market', re: /\b(report|survey|statistic|statistics|benchmark|benchmarks|data|study|research|index|trends?|salaries|salary|state of|insights?)\b/, how: 'numbers nobody else publishes: ask your own customers, or count what you already see' },
  { kind: 'tool', label: 'A free tool or calculator', re: /\b(calculator|calculate|tool|tools|generator|checker|estimator|simulator|quiz)\b/, how: 'one page that does one calculation your buyers make by hand' },
  { kind: 'template', label: 'A template or checklist to download', re: /\b(template|templates|checklist|checklists|sample|samples|form|forms|policy|contract|spreadsheet|download|downloads)\b/, how: 'the document your buyers rebuild every time' },
  { kind: 'guide', label: 'A definitive guide', re: /\b(guide|guides|handbook|what-is|what is|how-to|how to|ultimate|complete|101|basics|explained|glossary|definition|requirements|rules|deadlines?)\b/, how: 'the one page that answers the whole question, kept up to date and dated' },
];
// the posts of #journorequest (one shared fetch + per-topic searches), newest first, deduplicated
const posts = new Map();
for (const { r, x } of sources.filter(o => o.r.kind === 'press')) for (const pst of ((jsonOf(x) || {}).posts || [])) { const rec = pst.record || {}; if (!pst.uri || posts.has(pst.uri)) continue;
  const handle = (pst.author || {}).handle || ''; const rkey = String(pst.uri).split('/').pop();
  posts.set(pst.uri, { uri: pst.uri, rkey, handle, name: (pst.author || {}).displayName || handle, text: String(rec.text || ''), at: String(rec.createdAt || pst.indexedAt || ''), url: 'https://bsky.app/profile/' + handle + '/post/' + rkey, site_id: r.site_id, topic: r.topic || '' }); }
const deadlineOf = (t) => { for (const m of String(t).matchAll(/deadline[:\s-]+([^\n.]{2,40})/gi)) if (/\d|today|tomorrow|tonight|asap|eod|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(m[1])) return m[1].trim(); return ''; };   // the deadline followed by a date, not "the 2027 deadline means…"
const out = [];
for (const p of plans) {
  const sid = p.site_id; const comp = p.competitors.map(c => LK.regDomain(c));
  const myLedger = ledger.filter(l => l.site_id === sid); const linking = new Set(myLedger.filter(l => l.status !== 'lost').map(l => l.ref_domain));
  const myProspects = prospects.filter(x => x.site_id === sid); const myOutreach = outreach.filter(o => o.site_id === sid);
  // IDF over our own pages: a site's topic words are everywhere; the rare shared words decide the topic match
  const df = new Map(); const docs = p.pages.map(x => [x.title, x.keyword].join(' ')); for (const d of docs) for (const w of new Set(OK.words(d).map(OK.stem))) df.set(w, (df.get(w) || 0) + 1);
  const topicText = [...p.topics, p.profile.business_type].join(' ');
  // D13: what we sell (the site model's services, else the topics) and whether the facts say we hold an accreditation — the two things
  // that decide whether a prospect is a competitor and whether an accredited-provider list may be asked to add us
  const sellTerms = (p.services && p.services.length ? p.services : [...p.topics, p.profile.business_type]).filter(Boolean);
  const weAreAccredited = OK.accredited(p.accreditation);
  const outreach_rows = [], prospect_rows = [], listing_rows = [], fixes = [];
  const base = (o) => ({ site_id: sid, domain: p.domain, prospect_domain: o.prospect_domain, type: o.type, status: o.status, score: o.score || 0, fit: o.fit || 0, fit_reason: o.fit_reason || '', checks_json: JSON.stringify(o.checks || {}),
    page_url: o.page_url || '', page_title: o.page_title || '', evidence: String(o.evidence || '').slice(0, 600), contacts_json: JSON.stringify(o.contacts || []), contact_email: (o.contacts || [])[0] ? o.contacts[0].email : '', contact_form_url: o.contact_form_url || '',
    country: o.country || '', language: o.language || '', target_url: o.target_url || '', target_reason: o.target_reason || '', anchor_hint: o.anchor_hint || '', sequence_json: o.sequence_json || '', deadline: o.deadline || '', drafted_at: o.drafted_at || '', checked_at: iso, request_id: p.request_id || '' });
  const newProspect = (o) => ({ site_id: sid, domain: p.domain, prospect_domain: o.prospect_domain, type: o.type, rank: o.rank || 0, spam_score: 0, detail: String(o.detail || '').slice(0, 300), source_url: o.page_url || '', target_url: o.target_url || '',
    status: 'new', first_seen: iso, last_seen: iso, won_at: '', outreach_subject: '', outreach_body: '', note: '', score: o.score || 0, origin: o.origin || 'link_builder', contact_email: (o.contacts || [])[0] ? o.contacts[0].email : '', contact_url: (o.contacts || [])[0] ? o.contacts[0].source_url || '' : '',
    contacted_at: '', followup_step: 0, followup_subject: '', followup_body: '', verified_at: '', drafted_at: '' });   // the Link Builder's own sequence lives in seo_link_outreach; this row never carries a draft
  // ---- 1. journalist requests (Bluesky #journorequest): recent, on our topics, deadline not obviously past ----
  const press = [...posts.values()].filter(x => (!x.site_id || x.site_id === sid) && (now.getTime() - new Date(x.at).getTime()) / 864e5 <= 10)
    .map(x => ({ ...x, f: OK.fit(x.text, topicText + ' ' + p.topics.join(' '), df, docs.length) })).filter(x => x.f >= 0.34).sort((a, b) => b.f - a.f).slice(0, 3);
  for (const x of press) { if (myOutreach.some(o => o.type === 'press' && o.page_url === x.url)) continue;
    const em = (String(x.text).match(/[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/i) || [])[0];
    const o = { prospect_domain: (String(x.handle || 'bsky') + '/' + x.rkey).toLowerCase(), type: 'press',   /* one row per request: a journalist account posts many */ status: em ? 'ready' : 'needs_contact', score: Math.round(60 * x.f + 20), fit: x.f, fit_reason: 'request on your topic (' + Math.round(x.f * 100) + '% match)', page_url: x.url, page_title: 'Journalist request by ' + x.name,
      evidence: x.text.slice(0, 500), contacts: em ? [{ email: em.toLowerCase(), kind: 'person', own: false, source_url: x.url }] : [], contact_form_url: em ? '' : x.url, deadline: deadlineOf(x.text), target_url: p.home, target_reason: 'an expert answer names the business: the homepage', anchor_hint: 'brand', checks: { posted: x.at.slice(0, 10), how: em ? 'e-mail in the request' : 'reply on Bluesky or the link in the request' } };
    outreach_rows.push(base(o)); prospect_rows.push(newProspect({ ...o, detail: 'Journalist request: ' + x.text.slice(0, 240), origin: 'bluesky' })); }
  // ---- 1b. L5: journalist requests from a media digest (HARO / Source of Sources), read in the customer's own mailbox ----
  // A digest arrives as e-mail, so the web app parses it (app/shared/src/digest.ts) and writes one `digest` prospect per request; with no
  // mailbox connected nothing arrives and this does nothing. Here each new request becomes a pitch: the request itself is the evidence to
  // quote, the deadline is kept, and the reply goes to the address the digest gives (an anonymised address on the service's own domain is
  // how these are answered — the own-domain contact rule is for sites we found ourselves). Off-topic requests, outlets nobody may pitch and
  // competitors are refused with the reason, exactly as for every other kind.
  const digests = myProspects.filter(x => x.type === 'digest' && (x.status || 'new') === 'new' && !myOutreach.some(o => o.prospect_domain === x.prospect_domain && o.type === 'digest'));
  for (const x of digests) {
    const text = String(x.detail || ''); const noteOf = String(x.note || '');
    const f = OK.fit(text + ' ' + noteOf, topicText + ' ' + p.topics.join(' '), df, docs.length);
    // most requests are anonymised (the digest names the outlet but no website), so the row is keyed by the service and the query's
    // own id: the checks that need a real domain are then skipped, never failed. The topic fit and the draft gate always apply.
    const named = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(String(x.prospect_domain || ''));
    const why = (named ? (OK.noPitch(x.prospect_domain, { title: noteOf, spam: Number(x.spam_score) || 0, accredited: weAreAccredited })
      || OK.sellsSame({ type: 'digest', domain: x.prospect_domain, competitors: p.competitors, serp_rivals: p.serp_rivals })) : '')   // R21: a SERP rival counts here too
      || (f < 0.3 ? 'off topic for you (' + Math.round(f * 100) + '% match with your pages)' : '');
    const em = String(x.contact_email || '').toLowerCase() || (text.match(/[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/i) || [])[0] || '';
    const dl = (noteOf.match(/\d{4}-\d{2}-\d{2}/) || [])[0] || '';
    const o = { prospect_domain: x.prospect_domain, type: 'digest', score: Number(x.score) || Math.round(100 * LIKELY.digest * (0.4 + 0.6 * Math.min(1, f + 0.2))), fit: f,
      fit_reason: why || 'a journalist request on your topic (' + Math.round(f * 100) + '% match)', page_url: x.source_url || '', page_title: (noteOf || 'Journalist request').slice(0, 140),
      evidence: text.slice(0, 500), contacts: em ? [{ email: em, kind: OK.kindOf(em), own: false, source_url: x.source_url || '' }] : [], contact_form_url: em ? '' : (x.source_url || ''),
      country: OK.countryOf(x.prospect_domain), language: '', deadline: dl, target_url: p.home, target_reason: 'an expert answer names the business: the homepage', anchor_hint: 'brand',
      checks: { source: 'journalist digest read in your mailbox', how: em ? 'answer the address the digest gives' : 'the digest gives no address: answer in the digest itself', reasons: why ? [why] : [] } };
    o.status = why ? 'not_fit' : (em ? 'ready' : 'needs_contact');
    outreach_rows.push(base(o));
  }
  // ---- 2. every prospect page read: qualify, evidence, contacts, our page ----
  const contactsBy = new Map(); const formBy = new Map(); const deadBy = new Map();
  // R86: the prospect's own SITE, from the about / contact / home pages this run already fetched for contacts — read by the competitor
  // test next to the prospect page, so a provider selling our services in our market is refused whatever its article is about
  const siteBy = new Map();
  for (const { r, x } of second.filter(o => o.r.site_id === sid)) {
    const html = htmlOf(x); const st = statusOf(x);
    if (r.kind === 'contact' && html && st < 400 && !LK.challenge(st, html)) { const sb = siteBy.get(r.prospect_domain) || { text: '', pages: [] }; if (sb.text.length < 60000) { sb.text += ' ' + LK.text(html).slice(0, 30000); sb.pages.push(String(r.url || '').replace(/^https?:\/\/(www\.)?/i, '')); } siteBy.set(r.prospect_domain, sb);
      const l = contactsBy.get(r.prospect_domain) || []; l.push(...OK.contactsIn(html, r.prospect_domain, r.url)); contactsBy.set(r.prospect_domain, l); const f = OK.contactForm(html, r.url); if (f && !formBy.has(r.prospect_domain)) formBy.set(r.prospect_domain, f); }
    if (r.kind === 'outbound') { const e = errOf(x); const dead = st === 404 || st === 410 || /ENOTFOUND|NXDOMAIN|EAI_AGAIN.*ENOTFOUND|certificate has expired/i.test(e);
      if (dead) { const l = deadBy.get(r.prospect_domain) || []; l.push({ url: r.url, anchor: r.anchor, status: st || 'no DNS', on_page: r.on_page }); deadBy.set(r.prospect_domain, l); } }
  }
  const siteOf = (dom) => { const sb = siteBy.get(dom); return sb ? { site_text: sb.text, site_pages: sb.pages, country: p.country || '', country_iso: p.country_iso || '' } : { country: p.country || '', country_iso: p.country_iso || '' }; };
  for (const { r, x } of pagesRead.filter(o => o.r.site_id === sid && o.r.kind === 'prospect')) {
    const stored = myProspects.find(y => y.prospect_domain === r.prospect_domain && y.type === r.type) || {};
    const html = htmlOf(x); const st = statusOf(x); const e = errOf(x);
    const o = { prospect_domain: r.prospect_domain, type: r.type, page_url: r.url, score: Number(stored.score) || 0, checks: {}, country: OK.countryOf(r.prospect_domain) };
    const isNew = !stored.prospect_domain;
    if (linking.has(LK.refKey(r.prospect_domain))) continue;   // already links to us (the Backlink Monitor marks it won)
    let reasons = [];
    if (OK.isGov(r.prospect_domain)) reasons.push('government site: you get on its lists by applying or being accredited, not by a pitch (see the listings checklist)');
    if ((!html && e) || st === 404 || st === 410) reasons.push(st ? 'their page answers ' + st : 'their site does not answer');
    const blocked = !!html && LK.challenge(st, html);
    const facts = html && !blocked ? LK.pageFacts(html, x.headers, r.url) : {};
    if (html && !blocked) { reasons.push(...OK.sellSignals(html, facts));
      const lang = String(facts.lang || '').slice(0, 2).toLowerCase(); const L = String(p.language_code || 'en').slice(0, 2).toLowerCase();
      if (lang && lang !== L && !(lang === 'ar' && /^(AE|SA|QA|KW|BH|OM|EG|JO)$/.test(p.country_iso || ''))) reasons.push('page in another language (' + lang + ')'); }   // Arabic pages in Arab markets are fine for an English pitch
    const t = html && !blocked ? LK.text(html) : '';
    o.page_title = facts.title || r.title || stored.detail || '';
    // the evidence a first line can quote
    let evidence = '';
    if (r.type === 'broken' && r.dead_url) { const at = html.indexOf(r.dead_url.replace(/^https?:/, '')); if (html && at < 0 && !blocked) reasons.push('the dead link is no longer on their page');
      evidence = 'Dead link on their page: "' + (r.dead_anchor || r.dead_url) + '" → ' + r.dead_url + (at >= 0 ? ' — ' + LK.contextAt(html, at, 120) : ''); o.checks.dead = { url: r.dead_url, anchor: r.dead_anchor, competitor: r.competitor }; }
    const dead = (deadBy.get(r.prospect_domain) || []).filter(d => !LK.sameSite(LK.hostOf(d.url), p.domain));
    if (dead.length && !o.checks.dead) { o.checks.dead = dead[0]; if (['resource', 'gap', 'comp_new'].includes(r.type) && !evidence) { evidence = 'Dead link on their page: "' + (dead[0].anchor || dead[0].url) + '" → ' + dead[0].url + ' (' + dead[0].status + ')'; o.checks.angle = 'broken'; } }   // on a list or a mention the ask stays "add us"
    if (!evidence && r.type === 'mention' && t) { const re = new RegExp(p.brand_names.map(b => String(b).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i'); const i = t.search(re); if (i >= 0) evidence = 'They name you: "…' + t.slice(Math.max(0, i - 140), i + 160).trim() + '…"'; }
    if (!evidence && t) { const named = comp.filter(c => t.toLowerCase().includes(c.split('.')[0])); const sent = t.split(/(?<=[.!?])\s+/).find(s => s.length > 40 && s.length < 400 && OK.fit(s, topicText, df, docs.length) >= 0.3);
      evidence = [named.length ? 'Names ' + named.join(', ') : '', sent ? '"' + sent.trim().slice(0, 300) + '"' : ''].filter(Boolean).join(' — '); o.checks.competitors_named = named; }
    if (!evidence) evidence = stored.detail || '';
    o.evidence = evidence;
    // topic fit (their page vs our topics); a low match is a note, not a refusal — the writer decides with the evidence
    o.fit = t ? OK.fit(o.page_title + ' ' + t.slice(0, 4000), topicText, df, docs.length) : (blocked ? 0.3 : 0);
    o.fit_reason = blocked ? 'their page blocks automated reading: check it yourself' : 'topic match ' + Math.round(o.fit * 100) + '%' + (facts.noindex ? ' · page is noindex (no search value)' : '');
    o.language = String(facts.lang || '').slice(0, 5);
    // ---- D13: who is never pitched (live 2026-10-11: competitors, bare homepages, mailbox providers and contact databases were) ----
    const bad = OK.badHost(r.prospect_domain); if (bad) reasons.push(bad);
    const onlyHome = OK.homepageOnly(r.type, r.url); if (onlyHome) reasons.push(onlyHome);
    const competing = OK.sellsSame({ type: r.type, domain: r.prospect_domain, competitors: p.competitors, serp_rivals: p.serp_rivals, title: o.page_title, text: t, terms: sellTerms, url: r.url, fit: o.fit, ...siteOf(r.prospect_domain) });   // R4: a SERP rival counts as a competitor; R21: the page's URL and the topic match it just measured
    if (competing) reasons.push(competing);
    if (!weAreAccredited && OK.accreditedList(o.page_title + ' ' + r.url))   // the page IS such a list (its title / address says so); a page that merely names accredited providers is fine
      reasons.push('a list of accredited / approved providers: you get on it by applying with the accreditation, and the facts on file do not say you hold one (asking to be added claims it)');
    // contacts: the page itself + author / contact / about pages
    const cands = [...(html && !blocked ? OK.contactsIn(html, r.prospect_domain, r.url) : []), ...(contactsBy.get(r.prospect_domain) || [])];
    if (stored.contact_email && !cands.some(c => c.email === stored.contact_email)) cands.push({ email: stored.contact_email, kind: OK.kindOf(stored.contact_email), own: LK.sameSite(stored.contact_email.split('@')[1], r.prospect_domain), w: 2, source_url: stored.contact_url || '' });
    o.contacts = OK.rankContacts(cands); o.contact_form_url = o.contacts.length ? '' : (formBy.get(r.prospect_domain) || '');
    // our page and the link text
    const lostRow = r.type === 'lost' ? myLedger.find(l => l.ref_domain === r.prospect_domain) : null;
    const toCanon = (u) => { const hit = (p.pages || []).find(x => pathKey(x.url) === pathKey(u)); return hit ? hit.url : u; };   // D13 / D15: the page we ask them to link to is the one on our canonical host, not the host an old ledger row stored
    const tg = OK.pickTarget({ type: r.type === 'ai_source' && /list|best|top/i.test(o.page_title) ? 'ai_list' : (o.checks.angle === 'broken' ? 'broken' : r.type), text: o.page_title + ' ' + evidence, topics: p.topics.slice(0, 2).join(' '), dead_text: o.checks.dead ? [o.checks.dead.anchor, String(o.checks.dead.url).replace(/[\/_.-]+/g, ' ')].join(' ') : '', to_url: lostRow ? toCanon(lostRow.to_url) : '' }, p.pages, df, docs.length, p.home);
    o.target_url = tg.url; o.target_reason = tg.reason; o.anchor_hint = tg.anchor;
    if (!blocked && t && ['gap', 'comp_new', 'resource', 'broken'].includes(r.type) && o.fit < (r.type === 'broken' ? 0.15 : OK.OFF_TOPIC)) reasons.push('off topic for you (' + Math.round(o.fit * 100) + '% match)');
    if (isNew) o.score = Math.round(100 * (LIKELY[r.type] || 0.3) * (0.4 + 0.6 * Math.min(1, o.fit + 0.2)) * (r.rank ? Math.min(1.2, 0.6 + Number(r.rank) / 600) : 1));
    o.status = reasons.length ? 'not_fit' : (o.contacts.length ? 'ready' : 'needs_contact');
    o.checks.reasons = reasons; o.checks.page_status = st || (e ? 'error' : ''); o.checks.blocked = blocked; o.checks.noindex = !!facts.noindex;
    if (o.status === 'not_fit') o.fit_reason = reasons.join('; ');
    outreach_rows.push(base(o));
    if (isNew && o.status !== 'not_fit') prospect_rows.push(newProspect({ ...o, rank: r.rank || 0, detail: r.type === 'broken' ? 'Links to ' + (r.competitor || 'a competitor') + "'s dead page " + r.dead_url : r.type === 'resource' ? 'Resource page on "' + (r.topic || p.topics[0] || '') + '": ' + o.page_title : o.page_title, origin: r.type === 'broken' ? 'dfs' : 'web' }));
  }
  // ---- 2b. prospects nobody can be written to, refused without reading their site (D13): a mailbox provider, a contact database, a CDN,
  //      a statistics page, a government portal or a declared competitor. The Backlink Monitor and AI Growth keep finding them. ----
  for (const x of myProspects.filter(x => (x.status || 'new') === 'new' && x.type !== 'reclaim'
      && !outreach_rows.some(o => o.prospect_domain === x.prospect_domain && o.type === x.type)
      && !myOutreach.some(o => o.prospect_domain === x.prospect_domain && o.type === x.type && o.status === 'drafted'))) {
    const why = OK.badHost(x.prospect_domain)
      || (OK.isGov(x.prospect_domain) ? 'government site: you get on its lists by applying or being accredited, not by a pitch (see the listings checklist)' : '')
      || OK.sellsSame({ type: x.type, domain: x.prospect_domain, competitors: p.competitors, serp_rivals: p.serp_rivals, title: x.detail || '', url: x.page_url || '', terms: sellTerms, ...siteOf(x.prospect_domain) });   // R4 / R21; R86: their own site, when this run read it
    if (!why) continue;
    outreach_rows.push(base({ prospect_domain: x.prospect_domain, type: x.type, status: 'not_fit', score: Number(x.score) || 0, fit: 0, fit_reason: why,
      page_url: x.source_url || '', page_title: String(x.detail || '').slice(0, 140), evidence: String(x.detail || ''), country: OK.countryOf(x.prospect_domain), checks: { reasons: [why], read: false } }));
  }
  // ---- 2c. L5: podcast shows that take guests (free; the show's own website came from its RSS feed and was fetched this run) ----
  // A guest appearance earns an editorial link from the show's own page, and only the owner can accept the invitation. A show is pitched
  // only when it is on our topics, still publishing, says somewhere that it takes guests, and has a contact on its OWN domain: an address
  // on a podcast platform or a free mailbox belongs to nobody we can write to about the show.
  for (const { r, x } of second.filter(o => o.r.site_id === sid && o.r.kind === 'podcast_site')) {
    if (linking.has(LK.refKey(r.prospect_domain))) continue;
    if (outreach_rows.some(o => o.prospect_domain === r.prospect_domain && o.type === 'podcast')) continue;
    const stored = myProspects.find(y => y.prospect_domain === r.prospect_domain && y.type === 'podcast') || {};
    const html = htmlOf(x); const st = statusOf(x); const e = errOf(x);
    const blocked = !!html && LK.challenge(st, html);
    const facts = html && !blocked ? LK.pageFacts(html, x.headers, r.url) : {};
    const t = html && !blocked ? LK.text(html) : '';
    const reasons = [];
    if ((!html && e) || st === 404 || st === 410) reasons.push(st ? "the show's site answers " + st : "the show's site does not answer");
    if (html && !blocked) reasons.push(...OK.sellSignals(html, facts));
    const bad = OK.noPitch(r.prospect_domain, { title: r.show_title, accredited: weAreAccredited }); if (bad) reasons.push(bad);
    const competing = OK.sellsSame({ type: 'podcast', domain: r.prospect_domain, competitors: p.competitors, serp_rivals: p.serp_rivals }); if (competing) reasons.push(competing);
    const fit = OK.fit([r.show_title, r.summary, t.slice(0, 3000)].join(' '), topicText, df, docs.length);
    // R27 (2026-10-14): "Alchemy Uncensored" was offered to the owner at a 29% match. A guest appearance is the owner's own hour, so the
    // show has to be on our topics by more than the 25% that qualifies a page for a link (PC.MIN_FIT).
    if (fit < PC.MIN_FIT) reasons.push('the show is off your topics (' + Math.round(fit * 100) + '% match; a guest appearance needs at least ' + Math.round(PC.MIN_FIT * 100) + '%)');
    const quiet = PC.stale(r.last_episode, now); if (quiet) reasons.push('no new episode for ' + quiet + ' days: the show looks finished');
    // R27: the quote comes from the show's OWN description (the feed), and only then from its website, read as prose - the live report
    // quoted `"b-0"> Efficient Hiring Process …`, an attribute fragment from an unrelated page of the site.
    const fromFeed = r.guest_strength ? { ok: true, strength: r.guest_strength, quote: PC.cleanQuote(r.guest_quote), from: 'the show’s own description' } : { ok: false, strength: '', quote: '' };
    const own = t ? { ...PC.guestSignal([PC.prose(t).slice(0, 20000)]), from: 'the show’s website' } : { ok: false, strength: '', quote: '' };
    const guest = PC.pickSignal(fromFeed, own);
    if (!guest.ok) reasons.push('nothing on the show or in its feed says it takes guests: not pitched');
    const cands = [...(html && !blocked ? OK.contactsIn(html, r.prospect_domain, r.url) : []), ...(contactsBy.get(r.prospect_domain) || [])];
    if (r.owner_email) cands.push({ email: String(r.owner_email).toLowerCase(), kind: OK.kindOf(r.owner_email), own: LK.sameSite(String(r.owner_email).split('@')[1] || '', r.prospect_domain), w: 2, source_url: r.feed_url || '' });
    const contacts = OK.rankContacts(cands);
    const form = contacts.length ? '' : (formBy.get(r.prospect_domain) || OK.contactForm(html, r.url) || '');
    if (!reasons.length && !contacts.length && !form) reasons.push('no contact on the show’s own domain (' + r.prospect_domain + '): the address it publishes is on a podcast platform or a free mailbox, so there is nobody to write to about the show');
    const o = { prospect_domain: r.prospect_domain, type: 'podcast', page_url: r.url, page_title: String(r.show_title || facts.title || '').slice(0, 140), fit,
      fit_reason: reasons.length ? reasons.join('; ') : 'a show on your topics (' + Math.round(fit * 100) + '% match) that ' + (guest.strength === 'invites' ? 'invites guests' : 'runs interviews'),
      evidence: [r.show_title ? '“' + r.show_title + '”' + (r.show_author ? ' by ' + r.show_author : '') : '', r.episodes ? r.episodes + ' episodes' : '', r.last_episode ? 'last episode ' + r.last_episode : '',
        guest.quote ? 'They say (' + (guest.from || 'the show’s own description') + '): "' + PC.cleanQuote(guest.quote, 220) + '"' : ''].filter(Boolean).join(' · ').slice(0, 500),
      contacts, contact_form_url: form, country: OK.countryOf(r.prospect_domain), language: String(facts.lang || '').slice(0, 5),
      target_url: p.home, target_reason: 'a guest appearance names the business: the homepage', anchor_hint: 'brand',
      score: Math.round(100 * LIKELY.podcast * (0.4 + 0.6 * Math.min(1, fit + 0.2)) * (guest.strength === 'invites' ? 1.2 : 1)),
      checks: { reasons, guest: guest.strength, guest_quote_from: guest.quote ? (guest.from || '') : '', episodes: r.episodes || 0, last_episode: r.last_episode || '', feed: r.feed_url || '', platform: r.platform_url || '', page_status: st || (e ? 'error' : ''), blocked } };
    o.status = reasons.length ? 'not_fit' : (contacts.length ? 'ready' : 'needs_contact');
    outreach_rows.push(base(o));
    if (!stored.prospect_domain && o.status !== 'not_fit') prospect_rows.push(newProspect({ ...o, detail: 'Podcast: ' + String(r.show_title || r.prospect_domain) + (r.episodes ? ' (' + r.episodes + ' episodes)' : ''), origin: 'podcast' }));
  }
  // ---- 3. our old URLs that now 404 (Wayback) → a redirect to the closest live page ----
  for (const { r, x } of pagesRead.filter(o => o.r.site_id === sid && o.r.kind === 'wayback_check')) {
    const st = statusOf(x); if (st !== 404 && st !== 410) continue;
    const words = String(r.url).replace(/^https?:\/\/[^\/]+/, '').replace(/[\/_.-]+/g, ' ');
    const best = p.pages.filter(pg => pg.kind !== 'home').map(pg => ({ pg, f: OK.fit(words, [pg.title, pg.keyword, pg.url.replace(/[\/_.-]+/g, ' ')].join(' '), df, docs.length) })).sort((a, b) => b.f - a.f)[0];
    fixes.push({ from: r.url, to: best && best.f >= 0.3 ? best.pg.url : p.home, archived_at: r.archived_at, status: st });
  }
  for (const f of fixes.slice(0, 30)) outreach_rows.push(base({ prospect_domain: LK.normUrl(f.from), type: 'redirect',   /* one row per old URL */ status: 'fix', page_url: f.from, target_url: f.to, target_reason: 'answered ' + f.status + '; archived ' + String(f.archived_at).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'), evidence: 'Add a 301 redirect from ' + f.from + ' to ' + f.to + ' (links and bookmarks to the old URL keep working).', checks: { kind: 'wayback' } }));
  // ---- 3b. B11-2 (2026-10-15, benchmark area 11): the links already won, read again on their own page ----------------------
  // A link won through outreach was proven exactly once — at the moment of the reply — and then nothing looked at it again. When no
  // crawler indexes the linking page (the normal case for a small site's first links) it never enters the backlink ledger either, so
  // the Backlink Monitor's weekly re-check never reaches it: the links the customer worked hardest for were the ones nobody verified
  // twice, while "Links won" went on counting them for ever. Criterion 4C.7 is "confirmed live by our own check, THEN monitored"
  // (INVARIANTS rule 4: a record says a thing exists only while the thing exists).
  // The state machine, which is the whole point:
  //   found                      -> `live`, the miss count back to 0
  //   missing / gone             -> a miss. ONE miss is `at_risk`, never a loss; TWO readings in a row make it `lost` (the peppol.org
  //                                 rule: one reading is not evidence, and a page can come back)
  //   blocked / JavaScript shell / fetch error -> `not_checked`, the miss count UNTOUCHED (INVARIANTS rule 3: a call that failed is
  //                                 evidence we do not have, and nothing may be concluded from it — a bot wall is not a removed link)
  // Only a confirmed loss moves the prospect off `won`, and it carries the date it was won and the reason it is no longer there.
  const won_checks = [];
  for (const { r, x } of pagesRead.filter(o => o.r.site_id === sid && o.r.kind === 'won')) {
    if (outreach_rows.some(o => o.prospect_domain === r.prospect_domain && o.type === r.type)) continue;
    const stored = myOutreach.find(o => o.prospect_domain === r.prospect_domain && o.type === r.type) || {};
    let ck = {}; try { ck = JSON.parse(stored.checks_json || '{}') || {}; } catch (e) { ck = {}; }
    const before = ck.won || {};
    const v = LK.verify(x, p.domain, { url: r.url });
    const readable = ['found', 'missing', 'gone'].includes(v.verify);
    const misses = v.verify === 'found' ? 0 : readable ? (Number(before.misses) || 0) + 1 : (Number(before.misses) || 0);
    const state = v.verify === 'found' ? 'live' : !readable ? 'not_checked' : misses >= 2 ? 'lost' : 'at_risk';
    const why = v.verify === 'found' ? (v.rel === 'follow' ? 'the link is on the page' : 'the link is on the page, marked ' + v.rel)
      : v.verify === 'gone' ? 'their page answered ' + (v.status || 'nothing') + ': the page itself is gone'
      : v.verify === 'missing' ? 'their page no longer carries a link to you'
      : v.verify === 'blocked' ? 'their site blocks automatic checks, so this was not read'
      : v.verify === 'js' ? 'their page needs JavaScript to show its links, so this was not read'
      : 'their page could not be read (' + String(v.error || v.status || 'no answer').slice(0, 80) + ')';
    const w = { url: r.url, at: iso, state, misses, verify: v.verify, rel: v.verify === 'found' ? v.rel : '', placement: v.verify === 'found' ? v.placement : '',
      anchor: v.verify === 'found' ? String(v.anchor || '').slice(0, 120) : '', why, won_at: String(r.won_at || ''), was: before.state || '' };
    won_checks.push({ prospect_domain: r.prospect_domain, type: r.type, ...w });
    outreach_rows.push(base({ prospect_domain: r.prospect_domain, type: r.type, status: stored.status || 'won', score: Number(stored.score) || 0, fit: Number(stored.fit) || 0,
      fit_reason: state === 'live' ? 'the link is live (checked ' + day + ')' : state === 'not_checked' ? 'the link could not be checked: ' + why : why,
      checks: { ...ck, won: w }, page_url: r.url, page_title: stored.page_title || '', evidence: stored.evidence || '', contacts: [], contact_form_url: stored.contact_form_url || '',
      country: stored.country || '', language: stored.language || '', target_url: v.verify === 'found' ? (v.to_url || stored.target_url || '') : (stored.target_url || ''),
      target_reason: stored.target_reason || '', anchor_hint: stored.anchor_hint || '', sequence_json: stored.sequence_json || '', deadline: stored.deadline || '', drafted_at: stored.drafted_at || '' }));
    if (state === 'lost') { const pr = myProspects.find(y => y.prospect_domain === r.prospect_domain && y.type === r.type);
      if (pr) prospect_rows.push({ ...pr, status: 'lost', last_seen: iso, verified_at: iso, note: String('won ' + String(r.won_at || '').slice(0, 10) + ', gone by ' + day + ': ' + why).slice(0, 300) }); }
  }
  // ---- 4. the listings checklist ----
  if (p.due.listings) {
    const selfHtml = pagesRead.filter(o => o.r.site_id === sid && o.r.kind === 'self').map(o => htmlOf(o.x)).join(' ');
    const kind = siteKind(p.profile.business_type, p.topics.join(' '));
    for (const l of listingsFor(kind, p.country_iso, topicText, LK.text(selfHtml))) {
      const old = listingRows.find(y => y.site_id === sid && y.listing_id === l.id) || {};
      let status = 'unknown', profile_url = '', rel = l.link, evidence = '', blocked_now = false;
      const led = myLedger.find(y => y.status !== 'lost' && (y.ref_domain === l.host || LK.sameSite(y.ref_domain, l.host) || LK.sameSite(l.host, y.ref_domain)) && (l.list ? LK.normUrl(y.from_url) === LK.normUrl(l.list) : l.re ? l.re.test(y.from_url || '') : true));   // the list page itself, the profile pattern, else the host
      if (led) { status = 'linked'; profile_url = led.from_url || ''; rel = led.rel || rel; evidence = 'their page links to you (link check)'; }
      const selfLink = l.re ? [...selfHtml.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]).find(u => l.re.test(u)) || (selfHtml.match(new RegExp('"(https?:[^"]*' + l.host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^"]*)"', 'i')) || [])[1] : '';
      if (status === 'unknown' && selfLink && (!l.re || l.re.test(selfLink))) { status = 'listed'; profile_url = selfLink; evidence = 'your site links to the profile'; }
      const comps = [];
      for (const o of pagesRead.filter(o => o.r.site_id === sid && o.r.kind === 'comp_home')) { const h = htmlOf(o.x); if (l.re && [...h.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].some(m => l.re.test(m[1]))) comps.push(o.r.competitor); }
      for (const o of pagesRead.filter(o => o.r.site_id === sid && ((o.r.listing_id === l.id && (o.r.kind === 'listing_list' || o.r.kind === 'listing_profile')) || (l.list && o.r.kind === 'prospect' && LK.normUrl(o.r.url) === LK.normUrl(l.list))))) {   // a list page read as a prospect counts too
        const h = htmlOf(o.x); const st = statusOf(o.x); const asList = o.r.kind === 'listing_list' || o.r.kind === 'prospect';
        // P34-2 (live 2026-10-12): a page nobody could read claims nothing. A challenge, any 4xx that is not a 404 / 410 and any 5xx is
        // "blocked": AlternativeTo answered 403 ("Just a moment…") and was reported "listed" because a search had found the URL.
        const blocked = !h || LK.challenge(st, h) || (st >= 400 && st !== 404 && st !== 410);
        const v = blocked ? { verify: 'blocked' } : LK.verify(o.x, p.domain, { url: o.r.url });
        const claim = listingClaim({ blocked, status: st, links_us: v.verify === 'found', named: blocked ? '' : OK.namesUs(LK.text(h), [p.brand, ...(p.brand_names || []), p.domain]),
          as_list: asList, guessed: !!o.r.guessed, gone: st === 404 || st === 410, url: o.r.url });   // OK.namesUs: a whole brand token or the domain, never "tech" for "Tech&"
        if (blocked) { blocked_now = true;   // a URL a search found is still worth opening by hand — but it is not a listing until someone sees it
          const found = o.r.kind === 'listing_profile' && !o.r.guessed;
          if (found && !profile_url) profile_url = o.r.url;
          if (status === 'unknown') evidence = found ? 'a profile was found by search (' + o.r.url + ') but the platform blocks checks' + (st ? ' (HTTP ' + st + ')' : '') + ': open it to confirm — it is not counted as a listing' : claim.evidence;
          continue; }
        if (claim.status === 'linked') { status = 'linked'; profile_url = o.r.url; rel = v.rel; evidence = claim.evidence; }
        else if (claim.status === 'listed' && status !== 'linked') { status = 'listed'; profile_url = o.r.url; evidence = claim.evidence; }
        else if (status === 'unknown' && claim.status === 'missing') { status = 'missing'; evidence = claim.evidence; }
        else if (status === 'unknown') { evidence = evidence || claim.evidence; }
        if (asList) for (const c of p.competitors) if (h.toLowerCase().includes(c.toLowerCase()) && !comps.includes(c)) comps.push(c);
      }
      // D13: a platform that blocks this week's check keeps the last definite answer with the date it was checked — never a fresh "unknown"
      // (the Ministry of Finance list flipped from "missing" to "unknown" within one day, live 2026-10-11)
      if (status === 'unknown' && ['linked', 'listed', 'missing'].includes(String(old.status || ''))) {
        status = old.status; profile_url = profile_url || old.profile_url || '';
        evidence = old.status + ' (checked ' + String(old.checked_at || '').slice(0, 10) + ')' + (blocked_now ? ' · the platform blocks checks now' : ' · nothing new could be read this week'); }
      if (['submitted', 'ignored'].includes(old.status) && !['linked', 'listed'].includes(status)) { status = old.status; }
      listing_rows.push({ site_id: sid, domain: p.domain, listing_id: l.id, name: l.name, category: l.cat, status, profile_url: profile_url || old.profile_url || '', rel: status === 'linked' ? rel : l.link, competitors: comps.join(', '), submit_url: l.submit || '',
        priority: l.prio + (comps.length ? -0.5 : 0), why: (evidence ? evidence + ' · ' : '') + l.why, checked_at: iso, submitted_at: old.submitted_at || '', note: old.note || '' });
    }
  }
  // ---- 4b. L6: what kind of page earns links in this market (the competitors' most-linked pages, DataForSEO domain_pages, monthly) ----
  // Their pages with the most referring domains say what this market links to; the idea is a kind of page to make, tied to the pages that
  // prove it and the referring domains those hold. An idea is never a promise: it is what worked for someone else, with the evidence.
  const asset_ideas = [];
  const compPages = [];
  for (const { r, x } of dfs.filter(o => o.r.site_id === sid && (o.r.kind || '') === 'pages')) {
    const tasks = (x && x.tasks) ? x.tasks : ((jsonOf(x) || {}).tasks || []);   // the DataForSEO node answers with a parsed object, as LB Page Requests reads it
    const items = (((tasks[0] || {}).result) || []).flatMap(q => (q || {}).items || []);
    for (const it of items) {
      const url = String(it.url || it.page_address || ''); const rds = Number(it.referring_domains) || 0;
      if (!/^https?:\/\//i.test(url) || rds < ASSET_MIN_RDS) continue;
      const title = String(((it.meta || {}).title) || '').slice(0, 160);
      const path = url.replace(/^https?:\/\/[^\/]+/, '');
      compPages.push({ competitor: r.competitor, url, title, rds, home: /^\/?$/.test(path.replace(/[?#].*$/, '')), words: (title + ' ' + path.replace(/[\/_.?=&+-]+/g, ' ')).toLowerCase() });
    }
  }
  for (const K of ASSET_KINDS) {
    const hits = compPages.filter(x => !x.home && K.re.test(x.words)).sort((a, b) => b.rds - a.rds).slice(0, 3);
    const rds = hits.reduce((n, x) => n + x.rds, 0);
    if (!hits.length || rds < ASSET_MIN_TOTAL) continue;
    const who = [...new Set(hits.map(h => h.competitor))];
    asset_ideas.push({ kind: K.kind, idea: K.label + ' — ' + (p.topics[0] || p.profile.business_type || 'your topic'), how: K.how, rds, pages_seen: hits.length,
      basis: hits.length + ' page' + (hits.length === 1 ? '' : 's') + ' of this kind on ' + who.join(', ') + ' hold ' + rds + ' referring domain' + (rds === 1 ? '' : 's') + ' between them',
      examples: hits.map(h => ({ url: h.url, title: h.title, competitor: h.competitor, rds: h.rds })) });
  }
  asset_ideas.sort((a, b) => b.rds - a.rds); asset_ideas.splice(4);   // at most a handful, the best-evidenced first
  // ---- 5. what each won link did for its page (Search Console positions, control group of the site's other pages) ----
  const myQ = queries.filter(q => q.site_id === sid && q.page);
  const periods = [...new Set(myQ.map(q => String(q.period_end || '')))].filter(Boolean).sort();
  const pagePos = (period) => { const m = new Map(); for (const q of myQ.filter(q => String(q.period_end) === period)) { const k = pathKey(q.page); const i = Math.max(1, Number(q.impressions) || 0); const pos = Number(q.position) || 0; if (!pos) continue; const e = m.get(k) || { w: 0, s: 0, c: 0, q: q.query, qi: 0 }; e.w += i; e.s += pos * i; e.c += Number(q.clicks) || 0; if (i > e.qi) { e.q = q.query; e.qi = i; } m.set(k, e); } return m; };
  const impact_rows = [];
  // links that appeared after tracking began (the first run records every existing link as first seen that day: no t0 for them; live 2026-10-11)
  const trackStart = myLedger.map(l => String(l.first_seen || '')).filter(Boolean).sort()[0] || '';
  const farms = LK.footprints(myLedger, { domain: p.domain, brands: p.brand_names || [] });   // link-farm pages (D3): no impact tracking, whatever an older ledger row says
  const won = myLedger.filter(l => l.status !== 'lost' && l.kind === 'web' && l.link_type !== 'spam' && !farms.has(l.ref_domain) && l.to_url && l.first_seen && trackStart && new Date(l.first_seen).getTime() - new Date(trackStart).getTime() >= 7 * 864e5 && (now.getTime() - new Date(l.first_seen).getTime()) / 864e5 <= 200 && (l.verify === 'found' || Number(l.seo_value) >= 20));
  const lastPeriod = periods[periods.length - 1];
  // one reading: the page's own move before / after the date, minus what the site's OTHER pages did over the same weeks (CT.compare).
  // `exclude` keeps pages that changed inside the same window out of the control group, as the link reading always did.
  const readChange = (o) => {
    const t0 = String(o.t0).slice(0, 10); const weeks = Math.floor((now.getTime() - new Date(t0).getTime()) / (7 * 864e5)); const k = pathKey(o.target_url);
    const before = periods.filter(x => x <= t0).pop(); const after = lastPeriod;
    const B = before ? pagePos(before) : null, A = after && after !== before ? pagePos(after) : null;
    const pb = B && B.get(k), pa = A && A.get(k);
    const others = (B && A) ? [...A.keys()].filter(x => x !== k && B.has(x) && !o.exclude(x, before)).map(x => (B.get(x).s / B.get(x).w) - (A.get(x).s / A.get(x).w)) : [];
    const cmp = CT.compare({ kind: o.kind === 'page_change' ? 'page' : 'link', weeks, base: pb ? pb.s / pb.w : null, now: pa ? pa.s / pa.w : null, others, joint: o.joint,
      no_data: !myQ.length ? 'no Search Console data for this site' : (!before && o.kind === 'page_change') ? 'no stored Search Console period from before the change' : '' });
    const read = !['too_early', 'cant_tell'].includes(cmp.verdict);
    return { site_id: sid, domain: p.domain, kind: o.kind, change: o.change || '', ref_domain: o.ref_domain || '', from_url: o.from_url || '', target_url: o.target_url, t0, weeks: cmp.weeks,
      base_position: cmp.base_position, base_clicks: read ? pb.c : 0, position: cmp.position, clicks: read ? pa.c : 0, page_change: cmp.page_change, control_change: cmp.control_change,
      control_spread: cmp.control_spread, effect: cmp.effect, verdict: cmp.verdict, note: cmp.note, keyword: read ? (pa.q || pb.q || '') : '', updated_at: iso };
  };
  for (const l of won.slice(0, 30)) {
    const t0 = String(l.first_seen).slice(0, 10); const k = pathKey(l.to_url);
    impact_rows.push(readChange({ kind: 'link', t0, target_url: l.to_url, ref_domain: l.ref_domain, from_url: l.from_url || '',
      exclude: (x, before) => won.some(w => pathKey(w.to_url) === x && String(w.first_seen).slice(0, 10) >= before),
      joint: won.filter(w => w !== l && pathKey(w.to_url) === k && Math.abs(new Date(w.first_seen).getTime() - new Date(t0).getTime()) <= 28 * 864e5).length }));
  }
  // ---- 5b. G12: what each PAGE CHANGE did for its page, read exactly the same way (seo_content_log dates, kind page_change) ----
  const changes = new Map();
  for (const r of contentLog.filter(r => r.site_id === sid && String(r.published_at || '').slice(0, 10) && String(r.published_url || ''))) {
    const t0 = String(r.published_at).slice(0, 10); const k = pathKey(r.published_url);
    const kind = (String(r.existing_page_url || '') && pathKey(r.existing_page_url) === k) ? 'rewritten' : 'published';
    const old = changes.get(k);
    if (!old || t0 > old.t0) changes.set(k, { t0, url: String(r.published_url), change: kind, keyword: String(r.keyword || '') });
  }
  const changeList = [...changes.values()].filter(c => (now.getTime() - new Date(c.t0).getTime()) / 864e5 <= 400).sort((a, b) => b.t0.localeCompare(a.t0)).slice(0, 30);
  for (const c of changeList) {
    impact_rows.push(readChange({ kind: 'page_change', t0: c.t0, target_url: c.url, change: c.change,
      exclude: (x, before) => changes.has(x) && changes.get(x).t0 >= before && x !== pathKey(c.url),
      joint: won.filter(w => pathKey(w.to_url) === pathKey(c.url) && Math.abs(new Date(w.first_seen).getTime() - new Date(c.t0).getTime()) <= 28 * 864e5).length }));
  }
  // ---- 6. this week's writer jobs: the best ready prospects (new rows of this run + stored ready rows), not in free-only checks ----
  // R86: a `ready` row stored by an earlier run is put through the same site test when this run read that site, so a competing
  // provider qualified before the rule existed is refused now instead of being drafted
  const storedRivals = p.serp_rivals;
  for (const o of myOutreach.filter(o => o.status === 'ready' && !o.sequence_json && siteBy.has(o.prospect_domain) && !outreach_rows.some(n => n.prospect_domain === o.prospect_domain && n.type === o.type))) {
    const why = OK.sellsSame({ type: o.type, domain: o.prospect_domain, competitors: p.competitors, serp_rivals: storedRivals, title: o.page_title || '', url: o.page_url || '', terms: sellTerms, ...siteOf(o.prospect_domain) });   // R21's SERP rivals too (build section 58 counts the four first-pass calls)
    if (!why) continue;
    let ck = {}; try { ck = JSON.parse(o.checks_json || '{}') || {}; } catch (e) { ck = {}; }
    outreach_rows.push(base({ ...o, status: 'not_fit', fit_reason: why, contacts: (() => { try { return JSON.parse(o.contacts_json || '[]'); } catch (e) { return []; } })(), checks: { ...ck, reasons: [why] } }));
  }
  const ready = [...outreach_rows.filter(o => o.status === 'ready'), ...myOutreach.filter(o => o.status === 'ready' && !o.sequence_json && !outreach_rows.some(n => n.prospect_domain === o.prospect_domain && n.type === o.type))]
    .map(o => ({ ...o, rankv: (Number(o.score) || 0) * (0.5 + Number(o.fit || 0)) })).sort((a, b) => b.rankv - a.rankv);
  const jobs = p.free_only ? [] : ready.slice(0, p.budget).map(({ rankv, ...o }) => o);
  const stillOld = (k) => !(myOutreach.find(o => o.prospect_domain + '|' + o.type === k) || {}).sequence_json;
  out.push({ json: { site_id: sid, domain: p.domain, email: p.email, callback_url: p.callback_url, request_id: p.request_id, on_demand: p.on_demand, free_only: p.free_only, checked_at: iso,
    outreach_rows, prospect_rows, listing_rows, impact_rows, jobs: jobs.filter(j => stillOld(j.prospect_domain + '|' + j.type)), fixes, asset_ideas, won_checks,
    cache_row: { key: 'linkbld:' + sid, kind: 'linkbld', site_id: sid, value: JSON.stringify({ ...p.state, listings_at: p.due.listings ? iso : p.state.listings_at, resources_at: p.due.resources ? iso : p.state.resources_at, wayback_at: p.due.wayback ? iso : p.state.wayback_at, broken_at: p.due.broken ? iso : p.state.broken_at,
      podcasts_at: p.due.podcasts ? iso : p.state.podcasts_at, assets_at: p.due.assets ? iso : p.state.assets_at, last_run: iso }), updated_at: iso },
    summary: { press: press.length, digests: outreach_rows.filter(o => o.type === 'digest' && o.status !== 'not_fit').length,
      podcasts: outreach_rows.filter(o => o.type === 'podcast' && o.status !== 'not_fit').length, podcasts_read: second.filter(o => o.r.site_id === sid && o.r.kind === 'podcast_site').length,
      asset_ideas: asset_ideas.length, asset_pages: compPages.length, qualified: outreach_rows.filter(o => !['not_fit', 'fix'].includes(o.status)).length, not_fit: outreach_rows.filter(o => o.status === 'not_fit').length, needs_contact: outreach_rows.filter(o => o.status === 'needs_contact').length,
      ready: ready.length, to_draft: jobs.length, redirects: fixes.length, listings_missing: listing_rows.filter(l => l.status === 'missing').length, listings_linked: listing_rows.filter(l => l.status === 'linked').length,
      impact_reads: impact_rows.filter(r => r.kind === 'link' && !['too_early', 'cant_tell'].includes(r.verdict)).length,
      page_changes: impact_rows.filter(r => r.kind === 'page_change').length,
      change_reads: impact_rows.filter(r => r.kind === 'page_change' && !['too_early', 'cant_tell'].includes(r.verdict)).length,
      // B11-2: what our own re-read of the won links found. `won_unchecked` is deliberately its own number: a bot wall is not a lost link.
      won_checked: won_checks.length, won_live: won_checks.filter(w => w.state === 'live').length, won_at_risk: won_checks.filter(w => w.state === 'at_risk').length,
      won_lost: won_checks.filter(w => w.state === 'lost').length, won_unchecked: won_checks.filter(w => w.state === 'not_checked').length } } });
}
return out.length ? out : [{ json: { skip: true } }];
