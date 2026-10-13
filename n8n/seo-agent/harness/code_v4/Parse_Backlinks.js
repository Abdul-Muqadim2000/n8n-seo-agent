// Per site: link profile now vs the last check, links lost (important ones = alert), new links (spammy ones flagged), links pointing to broken
// pages on the site (reclaim with a redirect), 12 months of history, unlinked brand mentions, the link gap (domains linking to competitors, not
// to you), alerts and the prospect candidates. Rank and spam score are DataForSEO's 0-1000 and 0-100 scales.
// v4.10 (BACKLINKS_SPEC.md): the ledger — every referring site from every source, with the result of our own link check:
// - a link is LOST only after two misses in a row (or one miss of a link DataForSEO also reports lost), with the reason: link removed, page
//   gone (404 / 410 / domain gone), or not seen by any source for 120 days; a bot challenge or a JavaScript-only page is "not checked", never lost;
//   a link that turns nofollow or whose page turns noindex is flagged, not lost;
// - three values per link (SEO / referral / brand, LK.values) and the "best links" (SEO value 50+);
// - coverage: how many referring sites each source sees, how many only one source sees, and the share of Google's own sample (the uploaded
//   Search Console export) that DataForSEO and all sources together see;
// - mentions checked on the page (named without a link = the warmest outreach), "best X" list pages that name competitors and not you,
//   sites that just linked to a competitor (DataForSEO, since the last full run) and the Common Crawl gap;
// - prospects scored value x likelihood (an unlinked mention converts far more often than a cold gap site).
// D3 (2026-10-11): the footprint gate (LK.footprints) runs on the whole ledger before scoring — the same page path or keyword anchor on 3+
// sites, link-selling / gambling anchors, gambling hosts — and makes its members "spam" whatever the index or the analyst said: value 0,
// out of best links / wins / at-risk / important-lost / prospects, on the disavow candidates (review-only), listed as farms in the report.
// ---- link kit (v4.10, inlined by build_monitors.py): reads a fetched page the way a link checker does — the links to a site with their rel,
// anchor and placement, page facts (noindex, canonical, outbound links, language) and contact e-mails. Regex only: the n8n sandbox has no URL
// constructor and no DOM. Hosts are compared without "www." (crawls report www. URLs while canonicals often use the bare host).
const LK = (() => {
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'param']);
  const ent = (s) => String(s || '').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;|&#160;/gi, ' ').replace(/&#(\d+);/g, (m, d) => { try { return String.fromCodePoint(Number(d)); } catch (e) { return m; } });
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
  function sellsSame(o) {
    const d = String(o.domain || '').toLowerCase().replace(/^www\./, '');
    for (const c of (o.competitors || [])) { const x = String(c || '').toLowerCase().replace(/^www\./, '');
      if (x && (LK.sameSite(d, x) || LK.sameSite(x, d) || LK.regDomain(d) === LK.regDomain(x))) return 'a competing site of yours (' + x + '): a competitor does not link to you'; }
    if (SELL_EXEMPT.has(String(o.type || ''))) return '';
    const terms = [...new Set((o.terms || []).flatMap(t => words(t).map(stem)))];
    if (terms.length < 2) return '';
    const title = String(o.title || ''); const text = String(o.text || '').slice(0, 30000);
    const T = new Set(words(title + ' ' + text).map(stem));
    const share = terms.filter(t => T.has(t)).length / terms.length;
    const signals = [...new Set((text.match(VENDOR_RE) || []).map(x => x.toLowerCase().replace(/\s+/g, ' ').trim()))];
    const theirs = THEIRS_RE.test(title) && words(title).map(stem).some(w => terms.includes(w));
    return (share >= 0.45 && signals.length >= 2 && theirs)
      ? 'a competing provider: their page sells what you sell (' + Math.round(share * 100) + '% of your service words, "' + signals.slice(0, 2).join('", "') + '")' : '';
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
    badHost, isHomeUrl, homepageOnly, accreditedList, accredited, sellsSame, namesUs, nameRe, MIN_NAME_RUN, noPitch, gapTopic, SELLWORD };
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
    const services = uniq([...listOf(x.services), ...listOf(desc0.products_or_services), ...listOf(desc0.services), ...listOf(desc0.main_services), ...(jparse(row.services_json, []) || [])].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
    const navStored = jparse(row.nav_pages_json, []) || [];
    const navFresh = x.nav_pages || (html && canonical_host ? navFromHtml(html, canonical_host) : []);
    const nav_pages = (navFresh.length ? navFresh : navStored).map(p => ({ url: S(p.url), title: S(p.title), path: S(p.path) || pathOf(p.url) })).filter(p => p.url).slice(0, 12);

    const pages = (Array.isArray(x.pages) ? x.pages : []).map(p => ({ url: S(p.url), title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod),
      queries: Array.isArray(p.queries) ? p.queries : (jparse(p.queries_json, []) || []) })).filter(p => p.url);

    const business_facts = S(req.business_facts || x.business_facts || row.business_facts).slice(0, 2000);
    const cta = S(req.cta || x.cta || row.cta).slice(0, 200);
    const mon = x.monitors || {};
    const brand_names = uniq([...listOf(mon.brand_names), ...listOf(x.brand_names), ...listOf(row.brand_names), nameHit.value].filter(Boolean));
    const competitors = uniq([...listOf(mon.competitors), ...listOf(x.competitors), ...listOf(row.competitors)].map(bare).filter(d => d && d !== domain)).slice(0, 8);
    const accreditation = S(x.accreditation || row.accreditation);
    const updated_at = S(x.updated_at) || S(row.model_updated_at) || new Date().toISOString();

    return { site_id, domain, canonical_host, host_source, home_url: 'https://' + canonical_host + '/',
      business_name: nameHit.value, name_source: nameHit.source, logo_url: logoHit.value, logo_source: logoHit.source,
      nap, services, nav_pages, pages, business_facts, cta, brand_names, competitors, accreditation,
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
  const matchPage = (model, keyword) => {
    const want = termsOf(keyword); if (!want.length) return null;
    const key = tokensOf(keyword).join(' ');
    const inv = pages(model);
    for (const p of inv) {
      const q = (p.queries || []).find(x => tokensOf(x.query || x.keyword || x).join(' ') === key && (Number((x || {}).impressions) || 0) > 0);
      if (q) return { url: p.url, title: p.title, source: p.source, matched_by: 'query', score: 1, impressions: Number(q.impressions) || 0 };
    }
    let best = null;
    for (const p of inv) {
      const slug = termsOf(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''));
      const title = termsOf(S(p.title) + ' ' + S(p.h1));
      const inSlug = want.filter(t => slug.includes(t)).length / want.length;
      const inTitle = want.filter(t => title.includes(t)).length / want.length;
      const score = Math.max(inSlug, inTitle);
      if (score + 1e-9 >= MATCH_MIN && (!best || score > best.score)) best = { url: p.url, title: p.title, source: p.source, matched_by: inSlug >= inTitle ? 'slug' : 'title', score: Math.round(score * 100) / 100, impressions: 0 };
    }
    return best;
  };
  // D11: a stored seo_pages row carries its queries as the JSON string `queries_json`, so both shapes are accepted here
  const queriesOf = (p) => Array.isArray(p.queries) ? p.queries : (jparse(p.queries_json, []) || []);
  const withPages = (model, more) => ({ ...model, pages: (() => { const seen = new Set(); const out = [];
    for (const p of [...pages(model), ...(Array.isArray(more) ? more : [])]) { const u = S(p.url); if (!u) continue; const k = pathOf(u).replace(/\/$/, '').toLowerCase();
      if (seen.has(k)) { const old = out.find(o => pathOf(o.url).replace(/\/$/, '').toLowerCase() === k); if (old) { old.title = old.title || S(p.title); old.h1 = old.h1 || S(p.h1); old.lastmod = old.lastmod || S(p.lastmod); const q = queriesOf(p); if (q.length) old.queries = q; } continue; }
      seen.add(k); out.push({ url: u, title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries: queriesOf(p) }); }
    return out; })() });
  // the model exactly as it was stored (seo_sites row or a seo_cache value), with its own timestamp -- never "now", so isFresh() is honest
  const stored = (row) => { const r = (row && typeof row === 'object') ? row : {}; return (S(r.canonical_host) || S(r.model_updated_at)) ? from(r, {}) : null; };
  const FRESH_DAYS = 7;
  const ageDays = (model) => { const t = Date.parse(S((model || {}).model_updated_at)); return Number.isFinite(t) ? (Date.now() - t) / 864e5 : Infinity; };
  const isFresh = (model, days) => !!(model && S(model.canonical_host) && ageDays(model) < (Number(days) > 0 ? Number(days) : FRESH_DAYS));
  // exactly the seo_sites columns the model owns (plus the two keys), ready to merge into a site row or a cache value
  const COLUMNS = ['site_id', 'domain', 'canonical_host', 'business_name', 'logo_url', 'nap_json', 'services_json', 'nav_pages_json', 'business_facts', 'cta', 'brand_names', 'competitors', 'accreditation', 'model_updated_at'];
  const toRow = (model) => { const m = model || {};
    return { site_id: S(m.site_id), domain: S(m.domain), canonical_host: S(m.canonical_host), business_name: S(m.business_name), logo_url: S(m.logo_url),
      nap_json: JSON.stringify(nap(m)), services_json: JSON.stringify(services(m)), nav_pages_json: JSON.stringify((m.nav_pages || []).map(p => ({ url: p.url, title: p.title }))),
      business_facts: S(m.business_facts).slice(0, 2000), cta: S(m.cta).slice(0, 200), brand_names: (m.brand_names || []).join(', ').slice(0, 500),
      competitors: (m.competitors || []).join(', ').slice(0, 500), accreditation: S(m.accreditation).slice(0, 200), model_updated_at: S(m.model_updated_at) };
  };
  const pageRows = (model) => pages(model).map(p => ({ site_id: S((model || {}).site_id), url: S(p.url), title: S(p.title).slice(0, 300), h1: S(p.h1).slice(0, 300),
    source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries_json: JSON.stringify(p.queries || []), updated_at: S((model || {}).model_updated_at) || new Date().toISOString() }));
  return { from, stored, siteUrl, apiTarget, name, nap, services, pages, facts, matchPage, withPages, toRow, pageRows, COLUMNS, isFresh, ageDays, FRESH_DAYS, MATCH_MIN,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml } };
})();
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const all = (n) => { try { return $(n).all().map(i => i.json || {}); } catch (e) { return []; } };
const reqs = all('BL Requests'), resps = all('Run BL Requests');
const greqs = all('Gap Requests'), gresps = all('Run Gap Requests');
const areqs = all('Authority Requests'), aresps = all('Run Authority');
const dreqs = all('DR Requests'), dresps = all('Fetch DR');
const merged = all('Link Merge').filter(m => !m.skip);
const ver = all('Verify Links').filter(v => !v.skip);
const ljobs = all('Link Analyst Jobs').filter(j => !j.skip), louts = all('Link Analyst');
const SPAM_WORDS = LK.SPAM_RE;   // one list of link-selling words for new links, the ledger gate and the Link Builder (D3)
const BIG = /(^|\.)(google|youtube|facebook|linkedin|wikipedia|amazon|apple|microsoft|reddit|quora|instagram|twitter|x|tiktok|medium|github|pinterest|blogspot|wordpress|tumblr)\.[a-z.]+$/i;
const result = (rs, i) => { const t = ((rs[i] || {}).tasks || [])[0] || {}; return { ok: t.status_code === 20000, res: (t.result || [])[0] || null, cost: Number(t.cost) || 0, error: t.status_code && t.status_code !== 20000 ? t.status_message : ((rs[i] || {}).error ? String((rs[i].error.message || rs[i].error)).slice(0, 160) : null) }; };
const pathOf = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/i, '') || '/';
const toks = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length > 2);
const parseJ = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
const clamp = (x) => Math.max(0, Math.min(1, x));
const authOf = (x) => Math.max(x.authority > 0 ? clamp((Number(x.authority) - 40) / 520) : 0, x.dr > 0 ? clamp(Number(x.dr) / 90) : 0, x.cc_rank > 0 ? clamp(1 - Math.log10(Number(x.cc_rank)) / 7.2) : 0);
const LIKELY = { reclaim: 1, mention: 0.9, lost: 0.7, comp_new: 0.55, list: 0.5, gap: 0.4, ai_source: 0.35 };
// household names (Common Crawl top 5,000, rank 700+, DR 85+) rarely link to a small business: their value is real, the chance is not
// (live finding 2026-10-08: stripe.com outranked mof.gov.ae, which links to both competitors)
const effortOf = (x) => (Number(x.cc_rank) > 0 && Number(x.cc_rank) < 5000) || Number(x.authority) >= 700 || Number(x.dr) >= 85 ? 0.7 : 1;
const scoreOf = (type, x, extra = 1) => Math.round(100 * clamp((LIKELY[type] || 0.3) * extra) * (0.35 + 0.65 * authOf(x)) * (type === 'reclaim' || type === 'lost' ? 1 : effortOf(x)));
return plans.map(p => {
  const get = (kind) => { const out = []; reqs.forEach((r, i) => { if (r.site_id === p.site_id && r.kind === kind) out.push({ ...result(resps, i), req: r }); }); return out; };
  const one = (kind) => get(kind)[0] || { ok: false, res: null, cost: 0, error: 'not requested' };
  const costOf = (rq, rs) => rq.reduce((s, r, i) => s + (r.site_id === p.site_id ? result(rs, i).cost : 0), 0);
  const cost = costOf(reqs, resps) + costOf(greqs, gresps) + costOf(areqs, aresps);
  const m = merged.find(x => x.site_id === p.site_id) || { entries: [], mention_pages: [], list_pages: [], cc_gap: [], sources: {} };
  const now = p.checked_at; const today = now.slice(0, 10);
  // ---------------- DataForSEO view (as before) ----------------
  const S = one('summary'); const sm = S.res || {};
  const summary = { rank: Number(sm.rank) || 0, backlinks: Number(sm.backlinks) || 0, referring_domains: Number(sm.referring_domains) || 0, referring_domains_nofollow: Number(sm.referring_domains_nofollow) || 0, spam_score: Number(sm.backlinks_spam_score) || 0, broken_backlinks: Number(sm.broken_backlinks) || 0, broken_pages: Number(sm.broken_pages) || 0, available: S.ok, error: S.error };
  const spamOf = (x) => Number(x.backlink_spam_score) >= 50 || SPAM_WORDS.test(String(x.anchor || '') + ' ' + String(x.page_from_title || ''));
  const link = (x) => ({ from_domain: String(x.domain_from || '').replace(/^www\./, ''), from_url: x.url_from || '', to_url: x.url_to || '', anchor: String(x.anchor || '').slice(0, 120), dofollow: !!x.dofollow, domain_rank: Number(x.domain_from_rank) || 0, page_rank: Number(x.page_from_rank) || 0, spam: Number(x.backlink_spam_score) || 0, first_seen: String(x.first_seen || '').slice(0, 10), last_seen: String(x.last_seen || '').slice(0, 10), title: String(x.page_from_title || '').slice(0, 120) });
  const dfsLost = ((one('lost').res || {}).items || []).map(link);
  const news = ((one('new').res || {}).items || []).map(x => ({ ...link(x), spammy: spamOf(x) }));
  const spammy = news.filter(x => x.spammy);
  const home = SM.siteUrl({ canonical_host: p.canonical_host, domain: p.domain }, '/');   // D15: the host the site really serves
  const live = [...p.assets.map(a => a.url), home];
  const suggest = (u) => { const t = new Set(toks(pathOf(u))); let best = live[live.length - 1], score = 0; for (const c of live) { const s = toks(pathOf(c)).filter(x => t.has(x)).length; if (s > score) { score = s; best = c; } } return best; };
  const tsNew = ((one('timeseries').res || {}).items || []).map(x => ({ month: String(x.date || '').slice(0, 7), backlinks: Number(x.backlinks) || 0, referring_domains: Number(x.referring_domains) || 0, rank: Number(x.rank) || 0 }));
  const tsMap = new Map((p.stored_timeseries || []).filter(x => x && x.month).map(x => [x.month, x])); for (const x of tsNew) tsMap.set(x.month, x);
  const ts = [...tsMap.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-13);
  // ---------------- authority from this run (bulk ranks / spam, Ahrefs DR) and the Link Analyst's labels ----------------
  const rankOf = new Map(), spamOfD = new Map(), drOf = new Map();
  areqs.forEach((r, i) => { if (r.site_id !== p.site_id || r.skip) return; const res = result(aresps, i).res; for (const it of ((res || {}).items || [])) { const d = LK.refKey(LK.hostOf('//' + String(it.target || '').replace(/^https?:\/\//, ''))); if (!d) continue; if (r.kind === 'ranks') rankOf.set(d, Number(it.rank) || 0); if (r.kind === 'spam') spamOfD.set(d, Number(it.spam_score) || 0); } });
  let dr_error = ''; dreqs.forEach((r, i) => { if (r.site_id !== p.site_id || r.skip) return; const x = dresps[i] || {}; const j = (x.body && typeof x.body === 'object') ? x.body : (x.domain_rating ? x : parseJ(x.data));
    if (!j || !j.domain_rating) { dr_error = String((x.error && (x.error.message || x.error)) || (j && (j.error || j.message)) || 'no answer').slice(0, 160); return; } for (const t of (j.domain_rating.targets || [])) drOf.set(LK.refKey(String(t.target || '').toLowerCase().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '')), Number(t.domain_rating) || 0); });   // Ahrefs answers 'techand.ai/' (trailing slash, live 2026-10-08)
  const labels = new Map(); ljobs.forEach((j, k) => { if (j.site_id !== p.site_id) return; const o = louts[k] || {}; const parsed = o.error ? null : parseJ(o.output); for (const a of ((parsed || {}).links || [])) { const d = j.ids[Number(a.n) - 1]; if (d) labels.set(d, { link_type: String(a.type || 'other').toLowerCase(), relevance: Math.max(0, Math.min(3, Number(a.relevance) || 0)) / 3, note: String(a.note || '').slice(0, 140) }); } });
  // ---------------- the link check results ----------------
  const vLink = new Map(), vMention = [], vList = [], vTarget = [];
  for (const v of ver) { if (v.site_id !== p.site_id) continue; if (v.purpose === 'link') vLink.set(v.ref_domain, v); else if (v.purpose === 'mention') vMention.push(v); else if (v.purpose === 'list') vList.push(v); else if (v.purpose === 'target') vTarget.push(v); }
  // mention pages that link: they join the entries as a new referrer (source news / web)
  const entries = [...m.entries];
  for (const v of vMention) if (v.verify === 'found' && v.ref_domain && !entries.some(e => e.ref_domain === v.ref_domain)) { entries.push({ ref_domain: v.ref_domain, kind: 'web', sources: [v.source === 'news' ? 'news' : 'web'], from_url: v.url, to_url: v.to_url || '', anchor: v.anchor || '', first_seen: today, last_seen: today, authority: 0, visits: 0, visits_28d: 0, key_events: 0, pages: [{ url: v.url }], prev: null, ai_cited: false }); vLink.set(v.ref_domain, v); }
  // ---------------- the ledger ----------------
  const brands = (p.brand_names || []).filter(b => !String(b).includes('.'));
  const ledger = [], lostNow = [], atRisk = [], relChanged = [], wins = [];
  for (const e of entries) {
    const pv = e.prev || {}; const v = vLink.get(e.ref_domain); const lab = labels.get(e.ref_domain) || {};
    const prevStatus = pv.status || ''; const freshEvidence = e.sources.some(s => ['dfs', 'bing', 'gsc', 'import', 'cc'].includes(s)) && !e.dfs_lost || (e.visits_28d || 0) > 0;
    let status = prevStatus || 'live', miss = Number(pv.miss_count) || 0, lost_reason = pv.lost_reason || '', lost_at = pv.lost_at || '', verify = pv.verify || 'unchecked', verified_at = pv.verified_at || '';
    let from_url = e.from_url || pv.from_url || '', to_url = e.to_url || pv.to_url || '', anchor = e.anchor || pv.anchor || '', rel = e.rel || pv.rel || '', placement = e.placement || pv.placement || '';
    let noindex = pv.noindex === true || pv.noindex === 'true', canon = pv.canonical_elsewhere === true || pv.canonical_elsewhere === 'true', outbound = Number(e.outbound || pv.outbound) || 0, title = pv.page_title || '', context = pv.context || '';
    if (v) {
      verify = v.verify;
      if (v.verify === 'found') {
        if (prevStatus === 'lost') wins.push({ ref_domain: e.ref_domain, url: v.url, why: 'restored' });
        if (pv.verify === 'found' && (pv.rel || 'follow') === 'follow' && v.rel !== 'follow' && Number(pv.seo_value) >= 25) relChanged.push({ ref_domain: e.ref_domain, url: v.url, rel: v.rel, was: 'follow' });
        if (pv.verify === 'found' && !noindex && v.noindex && Number(pv.seo_value) >= 25) relChanged.push({ ref_domain: e.ref_domain, url: v.url, rel: 'noindex', was: 'indexed' });
        status = 'live'; miss = 0; lost_reason = ''; lost_at = ''; verified_at = now; from_url = v.url; to_url = v.to_url || to_url; anchor = v.anchor || anchor; rel = v.rel; placement = v.placement; noindex = !!v.noindex; canon = !!v.canonical_elsewhere; outbound = v.outbound_domains || outbound; title = v.title || title; context = String(v.context || '').slice(0, 400);
      } else if (v.verify === 'missing' || v.verify === 'gone') {
        miss += 1; verified_at = now;
        const confirmed = miss >= 2 || !!e.dfs_lost;
        if (confirmed && !(freshEvidence && v.verify === 'missing' && e.pages.some(x => x.url !== v.url))) { if (prevStatus !== 'lost') { lost_at = now; lostNow.push({ e, v, reason: v.verify === 'gone' ? 'page_gone' : 'link_removed' }); } status = 'lost'; lost_reason = v.verify === 'gone' ? (/ENOTFOUND/i.test(v.error || '') ? 'domain_gone' : 'page_gone') : 'link_removed'; }
        else if (confirmed) { status = 'live'; miss = 0; const other = e.pages.find(x => x.url !== v.url); from_url = other ? other.url : from_url; }   // the link moved to another page of the same site: check that one next time
        else { status = 'at_risk'; atRisk.push({ e, v }); }
      }
    } else if (e.dfs_lost && prevStatus !== 'lost') { status = 'at_risk'; atRisk.push({ e, v: { url: e.dfs_lost.url, verify: 'unchecked' } }); }
    else if (!e.sources.length && prevStatus !== 'lost' && String(pv.last_seen || '') && (Date.now() - new Date(pv.last_seen).getTime()) / 864e5 > 120 && !(pv.verify === 'found' && (Date.now() - new Date(pv.verified_at || 0).getTime()) / 864e5 < 60)) { status = 'lost'; lost_reason = 'not_seen'; lost_at = now; }
    else if (e.sources.length && prevStatus === 'lost' && !['link_removed', 'page_gone', 'domain_gone'].includes(pv.lost_reason)) { status = 'live'; lost_reason = ''; lost_at = ''; }
    const sources = [...new Set([...String(pv.sources || '').split(',').filter(Boolean), ...e.sources])];
    const authority = Math.max(Number(e.authority) || 0, rankOf.get(e.ref_domain) || 0, (rankOf.has(e.ref_domain) || e.authority > 0) ? 0 : Number(pv.authority) || 0);
    const dr = drOf.has(e.ref_domain) ? drOf.get(e.ref_domain) : Number(pv.dr) || 0;
    const cc_rank = Number(e.cc_rank) || Number(pv.cc_rank) || 0;
    const spam = Math.max(Number(e.spam) || 0, spamOfD.get(e.ref_domain) || 0, e.spam ? 0 : Number(pv.spam_score) || 0);
    const link_type = lab.link_type || e.link_type || pv.link_type || ''; const relevance = lab.relevance != null ? lab.relevance : (pv.relevance !== '' && pv.relevance != null ? Number(pv.relevance) : null);
    const anchor_kind = LK.anchorKind(anchor, p.domain, brands);
    const row = { site_id: p.site_id, domain: p.domain, ref_domain: e.ref_domain, kind: e.kind || 'web', from_url: String(from_url).slice(0, 500), to_url: String(to_url).slice(0, 500), anchor: String(anchor).slice(0, 160), anchor_kind,
      rel: rel || (sources.every(s => s === 'ga4' || s === 'cc' || s === 'gsc' || s === 'bing') ? '' : 'follow'), placement: placement || '', link_type, relevance: relevance == null ? '' : +Number(relevance).toFixed(2), note: lab.note || pv.note || '',
      sources: sources.join(','), source_count: e.sources.length, first_seen: [e.first_seen, String(pv.first_seen || '').slice(0, 10)].filter(Boolean).sort()[0] || today, last_seen: [e.last_seen, String(pv.last_seen || '').slice(0, 10), v && v.verify === 'found' ? today : ''].filter(Boolean).sort().pop() || today,
      status, lost_at, lost_reason, miss_count: miss, verify, verified_at, noindex, canonical_elsewhere: canon, outbound, page_title: String(title).slice(0, 160), context: String(context).slice(0, 400),
      authority, dr, cc_rank, page_keywords: Number(e.page_keywords) || Number(pv.page_keywords) || 0, spam_score: spam, original: e.original === false ? false : (e.original === true ? true : (pv.original === false || pv.original === 'false' ? false : true)), sitewide: Number(e.sitewide) || Number(pv.sitewide) || 0, links: Number(e.links) || Number(pv.links) || 0,
      visits: Number(e.visits) || (e.sources.includes('ga4') ? 0 : Number(pv.visits) || 0), key_events: Number(e.key_events) || 0, ai_cited: !!e.ai_cited, updated_at: now };
    row.visits_28d = e.visits_28d || 0; row._prev_status = prevStatus; row._new = !e.prev; row._dfs_new = !!e.dfs_new; row._sources_now = e.sources; row._found_new = !!(v && v.verify === 'found' && !e.prev); row._url = v ? v.url : '';
    ledger.push(row);
  }
  // ---------------- the footprint gate (D3): link-farm clusters over the whole ledger, before scoring ----------------
  const fp = LK.footprints(ledger, { domain: p.domain, brands, titles: (p.assets || []).map(a => a.title) });
  // G18-1 (2026-10-12, the accuracy set, ACCURACY_SET.md section 6): a search-results page of an unrelated site is worth nothing in search,
  // but nothing marked it, so robuta.com/?q=business+impact was reported as techand.ai's BEST link (SEO value 57) above OpenPeppol's real
  // members list (35). Such a page is labelled 'scraper' here — exactly as the whois / stats hosts already are (LK.isScraper) — and
  // LK.values' existing cap of 5 then applies, with brand value 0. Two bounds, so a real link is never written off: a host whose own name
  // or page title ties it to our topics keeps its label (a search page of an industry portal can still be a genuine listing), and a label
  // the Link Analyst or a source gave (editorial, listing, directory …) is never overwritten. The footprint gate above is untouched: a
  // search page is low value, not a link farm, so it stays out of the disavow list.
  const topicText = [...(p.topics || []), ...(p.assets || []).map(x => x && x.title).filter(Boolean)].join(' ');
  const topicStems = [...new Set(OK.words(topicText).map(OK.stem))].filter(w => w.length >= 3);
  const hostCarriesTopic = (d) => { const l = String(d || '').toLowerCase().replace(/^www\./, '').replace(/\.[a-z.]{2,}$/, '').replace(/[^a-z0-9]/g, ''); return !!l && topicStems.some(t => l.includes(t)); };
  const titleCarriesTopic = (t) => { const s = String(t || '').trim(); return s.length > 3 && OK.fit(topicText, s) >= OK.OFF_TOPIC; };
  const searchPage = (row) => LK.isSearchPage(row.from_url) && (!row.link_type || row.link_type === 'other')
    && !hostCarriesTopic(row.ref_domain) && !titleCarriesTopic(row.page_title);
  for (const row of ledger) {
    if (fp.has(row.ref_domain)) { row.link_type = 'spam'; row.note = ('link farm: ' + fp.get(row.ref_domain)).slice(0, 140); }
    else if (searchPage(row)) { row.link_type = 'scraper'; row.note = ('a search-results page on a site unrelated to your topics (' + String(row.from_url).slice(0, 80) + '): no SEO value, nothing to do').slice(0, 140); }
    const val = LK.values({ ...row, spam: row.spam_score, relevance: row.relevance === '' ? null : row.relevance });
    row.seo_value = val.seo; row.referral_value = val.referral; row.brand_value = val.brand;
    if (row._found_new && row.link_type !== 'spam' && (val.seo >= 50 || ['editorial', 'press', 'listing', 'resource'].includes(row.link_type))) wins.push({ ref_domain: row.ref_domain, url: row._url, why: 'new', seo: val.seo, link_type: row.link_type });
  }
  const spamSet = new Set(ledger.filter(r => r.link_type === 'spam').map(r => r.ref_domain));
  const farms = ledger.filter(r => spamSet.has(r.ref_domain)).map(r => ({ ref_domain: r.ref_domain, from_url: r.from_url, status: r.status, reason: fp.get(r.ref_domain) || 'labelled spam by the Link Analyst', authority: r.authority, spam: r.spam_score }));
  const liveRows = ledger.filter(r => r.status !== 'lost' && r.kind === 'web');
  const importantOf = (r) => Number(r.spam_score || r.spam) < 40 && !['spam', 'scraper'].includes(r.link_type) && (Number(r.seo_value) >= 35 || r.authority >= 150 || r.dr >= 40 || Number(r.visits) >= 5 || ['editorial', 'press'].includes(r.link_type));   // spam links are never "important", whatever their authority
  // P1-2 (2026-10-12, Phase 1 live check): a link-farm page is never "lost" — the 13 cluster pages filled "Links lost" with "Ask the editor to
  // restore it" and drove the "referring sites fell 17 -> 4" alert. The footprint gate (D3) has labelled them by now, so they are dropped here
  // from the lost list, from the reclaim advice and from the referring-sites drop, exactly as they already were from best / wins / at-risk.
  const lostRows = lostNow.filter(({ e }) => !spamSet.has(e.ref_domain)).map(({ e, v, reason }) => { const r = ledger.find(x => x.ref_domain === e.ref_domain) || {}; const pv = e.prev || {};
    return { from_domain: e.ref_domain, from_url: v.url || r.from_url, to_url: r.to_url, anchor: r.anchor, dofollow: (pv.rel || r.rel || 'follow') === 'follow', domain_rank: r.authority, dr: r.dr, spam: r.spam_score, last_seen: String(pv.last_seen || '').slice(0, 10) || (e.dfs_lost || {}).last_seen || '', reason: r.lost_reason || reason,
      seo_value: Number(pv.seo_value) || r.seo_value, visits: r.visits, title: pv.page_title || '', important: importantOf({ ...r, seo_value: Number(pv.seo_value) || r.seo_value }) }; });
  const important_lost = lostRows.filter(l => l.important);
  // the DataForSEO-reported losses still unconfirmed are listed as "reported lost — checking"
  const lost = [...lostRows, ...dfsLost.filter(l => !spamSet.has(LK.refKey(l.from_domain)) && !lostRows.some(x => x.from_domain === LK.refKey(l.from_domain))).map(l => ({ ...l, reason: 'reported_lost', pending: true }))];
  // ---------------- reclaim: links pointing to own pages that no longer load (DataForSEO + our own status check of the most-linked pages) ----------------
  const reclaimMap = new Map();
  for (const x of ((one('broken').res || {}).items || [])) { const b = { ...link(x), status: Number(x.url_to_status_code) || null }; if (spamSet.has(LK.refKey(b.from_domain))) continue; const r = reclaimMap.get(b.to_url) || { broken_url: b.to_url, status: b.status, links: 0, domains: new Set(), redirect_to: suggest(b.to_url) }; r.links++; r.domains.add(b.from_domain); reclaimMap.set(b.to_url, r); }   // a farm page linking to a dead page of ours is no reason to write to anyone (P1-2)
  for (const t of vTarget.filter(t => t.broken)) { const r = reclaimMap.get(t.url) || { broken_url: t.url, status: t.status || null, links: 0, domains: new Set(), redirect_to: suggest(t.url) }; r.links = Math.max(r.links, t.referring || 1); for (const l of ledger.filter(l => l.to_url === t.url && !spamSet.has(l.ref_domain))) r.domains.add(l.ref_domain); reclaimMap.set(t.url, r); }
  const reclaim = [...reclaimMap.values()].filter(r => r.links > 0).map(r => ({ ...r, domains: [...r.domains].slice(0, 8) })).sort((a, b) => b.links - a.links).slice(0, 20);
  // ---------------- mentions (checked on the page), list pages, competitor new links, the gap ----------------
  const linking = new Set(liveRows.map(r => r.ref_domain));
  const mentions = [];
  for (const v of vMention) { if (!v.named || v.verify === 'found' || linking.has(v.ref_domain) || mentions.some(x => x.domain === v.ref_domain)) continue; mentions.push({ domain: v.ref_domain, url: v.url, title: String(v.title || '').slice(0, 140), source: v.source, date: v.date || '', context: String(v.context || '').slice(0, 300), verified: true, domain_rank: rankOf.get(v.ref_domain) || 0, dr: drOf.get(v.ref_domain) || 0 }); }
  const fetchedMention = new Set(vMention.map(v => v.url));
  for (const mp of (m.mention_pages || []).filter(x => x.source === 'dfs_mention' && !fetchedMention.has(x.url))) { if (linking.has(mp.domain) || mentions.some(x => x.domain === mp.domain)) continue; mentions.push({ domain: mp.domain, url: mp.url, title: mp.title, source: mp.source, verified: false, domain_rank: mp.authority || rankOf.get(mp.domain) || 0, dr: drOf.get(mp.domain) || 0 }); }
  mentions.sort((a, b) => (b.verified - a.verified) || ((b.dr || 0) - (a.dr || 0)) || ((b.domain_rank || 0) - (a.domain_rank || 0)));   // checked on the page first, then by authority
  const lists = vList.filter(v => v.verify !== 'gone' && v.verify !== 'error').map(v => ({ domain: v.ref_domain, url: v.url, title: v.title, topic: v.topic, competitors: v.competitors_named || [], named: !!v.named, linked: !!v.linked, domain_rank: rankOf.get(v.ref_domain) || 0, dr: drOf.get(v.ref_domain) || 0 }));
  // D23 (2026-10-11 system review): a competitor's sister domain is never a prospect. Comparing the first label missed clear.in next to
  // cleartax.com, so a shared brand stem of at least 5 characters counts too (clear ~ cleartax), and so does a page that canonicalises or
  // redirects to the competitor (the fetched page's own rel=canonical, which follows redirects). A short label still has to match exactly,
  // so zoho.com and zohoreviews.com stay apart.
  const labelOfD = (d) => String(d || '').toLowerCase().replace(/^www\./, '').split('.')[0].replace(/[^a-z0-9]/g, '');
  const compLabels = (p.competitors || []).map(c => labelOfD(c)).filter(l => l.length >= 4);
  const canonTo = new Map();
  for (const v of [...vLink.values(), ...vMention, ...vList]) { const h = LK.refKey(LK.hostOf(v.canonical || '')); if (h && v.ref_domain && h !== v.ref_domain) canonTo.set(v.ref_domain, h); }
  const sibling = (d) => { const l = labelOfD(d); if (!l) return false;
    if (compLabels.some(c => c === l || (Math.min(c.length, l.length) >= 5 && (c.startsWith(l) || l.startsWith(c))))) return true;
    const to = canonTo.get(LK.refKey(d));
    return !!to && (p.competitors || []).some(c => LK.sameSite(to, String(c).toLowerCase())); };
  const compNew = []; for (const c of get('comp_new')) for (const x of ((c.res || {}).items || [])) { const d = LK.refKey(x.domain_from); if (!d || linking.has(d) || BIG.test(d) || LK.isInfra(d) || LK.isWire(d) || sibling(d) || Number(x.backlink_spam_score) >= 30 || compNew.some(y => y.domain === d)) continue;
    compNew.push({ domain: d, competitor: c.req.competitor, url: x.url_from || '', first_seen: String(x.first_seen || '').slice(0, 10), domain_rank: Number(x.domain_from_rank) || 0, dr: drOf.get(d) || 0, anchor: String(x.anchor || '').slice(0, 100), title: String(x.page_from_title || '').slice(0, 120) }); }
  compNew.sort((a, b) => b.domain_rank - a.domain_rank);
  const ccTld = ({ GB: 'uk' })[p.country_iso] || String(p.country_iso || '').toLowerCase();
  const localOf = (d) => ccTld.length === 2 && ccTld !== 'us' && String(d || '').toLowerCase().endsWith('.' + ccTld) ? 1.25 : 1;   // .ae for a UAE site: a local site is a likelier, more relevant link
  // D23 (2026-10-11 system review): the topic gate on the cold link gap. The Link Builder refuses a prospect under a 25% topic match on
  // the page it fetches (OK.OFF_TOPIC, _outreach_kit.js); the monitor never fetches a gap domain, so the evidence here is the domain's own
  // name, a title we already know for it, and the market's domain ending. A domain passes when a topic word is inside its name
  // (einvoicingnews.com), when a known title matches our topics by 25% or more, or when it is on the market's own domain ending (a .ae
  // site that links to both UAE competitors is relevant to a UAE business even when its name says nothing). Everything else is listed in
  // the link gap with the reason and never stored as a prospect to pitch -- stripe.com, weforum.org and kirkland.com were waiting in the
  // app as prospects after the live run of 2026-10-11.
  const titleOfD = new Map();   // topicText / topicStems are built above, at the footprint gate (G18-1 uses them too)
  const putTitle = (d, t) => { const k = LK.refKey(d); if (k && t && !titleOfD.has(k)) titleOfD.set(k, String(t).slice(0, 200)); };
  for (const r of ledger) putTitle(r.ref_domain, r.page_title);
  for (const x of mentions) putTitle(x.domain, x.title);
  for (const x of lists) putTitle(x.domain, [x.title, x.topic].filter(Boolean).join(' '));
  for (const x of compNew) putTitle(x.domain, [x.title, x.anchor].filter(Boolean).join(' '));
  const onTopic = (d) => {
    if (hostCarriesTopic(d)) return { ok: true, why: 'its name carries your topic' };   // the same name rule G18-1 uses above
    const t = titleOfD.get(LK.refKey(d));
    if (t) { const f = OK.fit(topicText, t); if (f >= OK.OFF_TOPIC) return { ok: true, why: 'its page matches your topics (' + Math.round(100 * f) + '%)' }; }
    if (ccTld.length === 2 && ccTld !== 'us' && String(d || '').toLowerCase().endsWith('.' + ccTld)) return { ok: true, why: 'a site in your market (.' + ccTld + ')' };
    return { ok: false, why: 'off topic for you: neither its name, its page nor its country ties it to ' + ((p.topics || [])[0] || 'your topics') };
  };
  const gi = greqs.findIndex(g => g.site_id === p.site_id && !g.skip); const G = gi >= 0 ? result(gresps, gi) : null; const competitors = gi >= 0 ? greqs[gi].competitors : p.competitors;
  const freshGap = ((G && G.res && G.res.items) || []).map(it => { const vals = Object.entries(it.domain_intersection || {}); const f = (vals[0] || [])[1] || {};
    return { domain: LK.refKey(String(f.target || '').replace(/^www\./, '')), rank: Number(f.rank) || 0, spam: Number(f.backlinks_spam_score) || 0, links_to: vals.map(([k]) => competitors[Number(k) - 1]).filter(Boolean), backlinks: vals.reduce((s, [, v]) => s + (Number(v.backlinks) || 0), 0), source: 'dfs' }; })
    .filter(g => g.domain && g.spam < 30 && !BIG.test(g.domain) && !LK.isInfra(g.domain) && !LK.isWire(g.domain) && !sibling(g.domain) && !linking.has(g.domain) && g.domain !== p.domain).sort((a, b) => (b.links_to.length - a.links_to.length) || (b.rank - a.rank)).slice(0, 30);
  const ccGap = (m.cc_gap || []).filter(g => !linking.has(g.domain) && !BIG.test(g.domain) && !LK.isInfra(g.domain) && !LK.isWire(g.domain) && !sibling(g.domain) && (spamOfD.get(g.domain) || 0) < 30).map(g => ({ domain: g.domain, rank: rankOf.get(g.domain) || 0, spam: spamOfD.get(g.domain) || 0, links_to: g.links_to, backlinks: 0, cc_rank: g.cc_rank, source: 'cc' }));
  const gapBase = gi >= 0 ? freshGap : (p.stored_gap || []).filter(g => !linking.has(g.domain) && !LK.isWire(g.domain)).map(g => ({ ...g, source: 'dfs' }));
  const gap = [...gapBase]; for (const g of ccGap) { const x = gap.find(y => y.domain === g.domain); if (x) { x.source = 'both'; x.cc_rank = g.cc_rank; x.links_to = [...new Set([...x.links_to, ...g.links_to])]; } else gap.push(g); }
  gap.sort((a, b) => (b.links_to.length - a.links_to.length) || ((b.source === 'both') - (a.source === 'both')) || (b.rank - a.rank) || ((a.cc_rank || 9e9) - (b.cc_rank || 9e9)));
  const weAreAccredited = OK.accredited(p.accreditation);
  for (const g of gap) { const v = onTopic(g.domain); g.off_topic = !v.ok; g.topic_reason = v.why;
    // P34-1 / P34-4 (live 2026-10-12): a government portal, a mailbox provider, a contact database, infrastructure, a statistics page
    // or an accredited-provider list is listed in the gap table and never pitched — a ministry's list is joined by applying or being
    // accredited, not by an e-mail (mof.gov.ae and uae-asp.ae came back as gap prospects carrying a drafted pitch).
    g.no_pitch = OK.noPitch(g.domain, { spam: g.spam, title: titleOfD.get(LK.refKey(g.domain)) || '', accredited: weAreAccredited }); }   // D23 / P34-4: shown in the gap table with the reason, never pitched
  const gap_off_topic = gap.filter(g => g.off_topic).length;
  // ---------------- coverage: who sees what ----------------
  const srcNow = (r) => r._sources_now || [];
  const per = {}, only = {}; for (const r of liveRows) { const s = srcNow(r); for (const x of s) per[x] = (per[x] || 0) + 1; if (s.length === 1) only[s[0]] = (only[s[0]] || 0) + 1; }
  const gscSet = new Set(liveRows.filter(r => srcNow(r).includes('gsc')).map(r => r.ref_domain));
  const dfsSet = new Set(liveRows.filter(r => srcNow(r).includes('dfs')).map(r => r.ref_domain));
  const coverage = { union: liveRows.length, social: ledger.filter(r => r.status !== 'lost' && r.kind === 'social').length, per_source: per, only_in: only, dfs_share: liveRows.length ? Math.round(100 * dfsSet.size / liveRows.length) : 0,
    gsc_sample: gscSet.size, dfs_sees_google: gscSet.size ? Math.round(100 * [...gscSet].filter(d => dfsSet.has(d)).length / gscSet.size) : null, all_see_google: gscSet.size ? Math.round(100 * [...gscSet].filter(d => srcNow(liveRows.find(r => r.ref_domain === d)).length > 1).length / gscSet.size) : null,
    verified: liveRows.filter(r => r.verify === 'found').length, checked_now: [...vLink.values()].length, blocked: [...vLink.values()].filter(v => v.verify === 'blocked' || v.verify === 'js').length, status: m.sources || {} };
  // ---------------- anchors, pages, values ----------------
  const kinds = {}; for (const r of liveRows) kinds[r.anchor_kind] = (kinds[r.anchor_kind] || 0) + 1;
  const anchors = { kinds, top: ((one('anchors').res || {}).items || []).slice(0, 15).map(a => ({ anchor: String(a.anchor || '').slice(0, 80), referring_domains: Number(a.referring_domains) || 0, backlinks: Number(a.backlinks) || 0, kind: LK.anchorKind(a.anchor, p.domain, brands) })) };
  const pages = ((one('pages').res || {}).items || []).slice(0, 15).map(x => ({ url: x.page, referring_domains: Number((x.page_summary || {}).referring_domains) || 0, backlinks: Number((x.page_summary || {}).backlinks) || 0, status: (vTarget.find(t => t.url === x.page) || {}).status || Number(x.status_code) || null }));
  // G18-1: a link a cap has written off (link farm, search-results page) is never one of the site's "best links" for SEO, whatever is left
  // of its score — a capped 5 above nothing is still nothing. Referral keeps every row: the visits it sends are measured, not judged.
  const CAPPED = ['spam', 'scraper'];
  const by = (k, seo) => [...liveRows].filter(r => !(seo && CAPPED.includes(r.link_type))).sort((a, b) => b[k] - a[k]).filter(r => r[k] > 0).slice(0, 10).map(r => ({ ref_domain: r.ref_domain, from_url: r.from_url, value: r[k], link_type: r.link_type, visits: r.visits }));
  const values = { best_seo: by('seo_value', true), best_referral: by('referral_value'), best_brand: by('brand_value', true) };
  const best_links = liveRows.filter(r => r.seo_value >= 50).length;
  const referral = { visits: liveRows.reduce((s, r) => s + (Number(r.visits) || 0), 0), visits_28d: liveRows.reduce((s, r) => s + (Number(r.visits_28d) || 0), 0), key_events: liveRows.reduce((s, r) => s + (Number(r.key_events) || 0), 0) };
  // ---------------- alerts ----------------
  const prev = p.previous; const alerts = [];
  const REASON = { link_removed: 'link removed', page_gone: 'page gone', domain_gone: 'site gone', not_seen: 'not seen for 4 months' };
  const actionable = important_lost.filter(l => l.reason !== 'domain_gone'), siteGone = important_lost.filter(l => l.reason === 'domain_gone');
  if (actionable.length) alerts.push({ level: 'high', text: actionable.length + ' important link(s) lost (checked twice): ' + actionable.slice(0, 3).map(l => l.from_domain + ' (' + (REASON[l.reason] || l.reason) + ')').join(', ') + '.' });
  if (siteGone.length) alerts.push({ level: 'low', text: siteGone.length + ' linking site(s) no longer exist (' + siteGone.slice(0, 3).map(l => l.from_domain).join(', ') + '): those links cannot be won back.' });
  if (relChanged.length) alerts.push({ level: 'medium', text: relChanged.length + ' valuable link(s) changed: ' + relChanged.slice(0, 3).map(r => r.ref_domain + ' is now ' + r.rel).join(', ') + '.' });
  if (spammy.length >= 3) alerts.push({ level: 'medium', text: spammy.length + ' new spammy links (PBN / link-farm pages) since ' + p.since.slice(0, 10) + '. Google ignores most of them; nothing to do unless you get a manual action.' });
  const newMoney = ledger.filter(r => r._new && r.anchor_kind === 'money' && (r.spam_score >= 30 || (r.relevance !== '' && r.relevance < 0.34)));
  if (newMoney.length >= 10) alerts.push({ level: 'medium', text: newMoney.length + ' new off-topic links with keyword anchors at once — a possible negative-SEO pattern. Keep watching; disavow only if a manual action follows.' });
  if (prev && summary.available && prev.spam_score && summary.spam_score - prev.spam_score >= 15) alerts.push({ level: 'medium', text: 'Link spam score rose from ' + prev.spam_score + ' to ' + summary.spam_score + '.' });
  // the drop alert counts real referring sites only: a link-farm cluster leaving is not a loss (P1-2). The stored union counted the farms, so
  // the farm pages that were live at the last check are taken off it too; the alert says so when any were.
  const farmLiveNow = ledger.filter(r => spamSet.has(r.ref_domain) && r.kind === 'web' && r.status !== 'lost').length;
  const farmLivePrev = ledger.filter(r => spamSet.has(r.ref_domain) && r.kind === 'web' && !r._new && r._prev_status !== 'lost').length;
  const cleanNow = liveRows.length - farmLiveNow, cleanPrev = Math.max(0, (prev ? Number(prev.union_domains) || 0 : 0) - farmLivePrev);
  if (prev && cleanPrev >= 10 && cleanNow < cleanPrev * 0.9) alerts.push({ level: 'medium', text: 'Referring sites (all sources) fell from ' + cleanPrev + ' to ' + cleanNow + '.' + (farmLivePrev || farmLiveNow ? ' (Link-farm pages are not counted.)' : '') });
  else if (prev && !prev.union_domains && summary.available && prev.referring_domains >= 10 && summary.referring_domains < prev.referring_domains * 0.9) alerts.push({ level: 'medium', text: 'Referring domains fell from ' + prev.referring_domains + ' to ' + summary.referring_domains + '.' });
  const atRiskOut = atRisk.filter(({ e }) => !spamSet.has(e.ref_domain));   // a link-farm page is never "at risk": there is nothing to win back (D3)
  const riskImportant = atRiskOut.filter(({ e }) => { const r = ledger.find(x => x.ref_domain === e.ref_domain) || {}; return importantOf(e.prev ? { ...r, seo_value: Number(e.prev.seo_value) || r.seo_value } : r); });
  if (riskImportant.length) alerts.push({ level: 'low', text: riskImportant.length + ' valuable link(s) not found on their page this week (' + riskImportant.slice(0, 3).map(x => x.e.ref_domain).join(', ') + '); checked again next week before calling them lost.' });
  if (reclaim.length) alerts.push({ level: 'low', text: reclaim.reduce((s, r) => s + r.links, 0) + ' link(s) point to ' + reclaim.length + ' broken page(s): redirect them to keep the value.' });
  if (farms.length >= 3) alerts.push({ level: 'low', text: farms.length + ' link(s) from link farms / PBN pages set aside (no value, on the disavow candidates for review): ' + farms.slice(0, 3).map(f => f.ref_domain).join(', ') + (farms.length > 3 ? ' …' : '') + '. Google ignores them unless you get a manual action.' });
  const deliver = p.mode === 'full' || p.on_demand || alerts.some(a => a.level === 'high' || a.level === 'medium');
  // disavow candidates (review only: Google ignores most spam; disavow only for a manual action or a paid-link pattern you did not create)
  const disavow = [...new Set([...spammy.filter(x => x.spam >= 60 || SPAM_WORDS.test(x.anchor + ' ' + x.title)).map(x => LK.refKey(x.from_domain)), ...ledger.filter(r => r.link_type === 'spam').map(r => r.ref_domain)])];   // the whole cluster, live or gone (D3)
  const disavow_text = disavow.length ? '# Disavow candidates for ' + p.domain + ' (' + today + ')\n# Review before uploading at https://search.google.com/search-console/disavow-links — Google ignores most spam links on its own;\n# disavow only for a manual action or a clear paid-link pattern you did not create.\n' + disavow.map(d => 'domain:' + d).join('\n') + '\n' : '';
  // ---------------- prospects: value x likelihood ----------------
  const target0 = (p.assets[0] || {}).url || home;
  const candidates = [
    ...important_lost.map(l => ({ prospect_domain: l.from_domain, type: 'lost', origin: 'check', rank: l.domain_rank, spam_score: l.spam, score: scoreOf('lost', { authority: l.domain_rank, dr: l.dr }), detail: (REASON[l.reason] || 'lost') + ': linked to ' + pathOf(l.to_url) + ' from ' + l.from_url + (l.last_seen ? ' until ' + l.last_seen : ''), source_url: l.from_url, target_url: l.to_url })),
    ...reclaim.flatMap(r => r.domains.slice(0, 3).map(d => ({ prospect_domain: d, type: 'reclaim', origin: 'check', rank: 0, spam_score: 0, score: scoreOf('reclaim', ledger.find(x => x.ref_domain === d) || {}), detail: 'Links to ' + pathOf(r.broken_url) + ' (HTTP ' + (r.status || 'error') + '): 301-redirect it to ' + pathOf(r.redirect_to), source_url: '', target_url: r.redirect_to }))),
    ...mentions.slice(0, 12).map(x => ({ prospect_domain: x.domain, type: 'mention', origin: x.source, rank: x.domain_rank, spam_score: 0, score: scoreOf('mention', { authority: x.domain_rank, dr: x.dr }, x.verified ? 1 : 0.8), detail: 'Mentions you without a link' + (x.verified ? ' (checked on the page)' : '') + ': ' + x.title, source_url: x.url, target_url: home })),
    ...lists.filter(l => !l.named && l.competitors.length).slice(0, 8).map(l => ({ prospect_domain: l.domain, type: 'list', origin: 'web', rank: l.domain_rank, spam_score: 0, score: scoreOf('list', { authority: l.domain_rank, dr: l.dr }, (1 + 0.15 * (l.competitors.length - 1)) * localOf(l.domain)), detail: '"' + String(l.title).slice(0, 90) + '" lists ' + l.competitors.join(', ') + ', not you', source_url: l.url, target_url: target0 })),
    ...lists.filter(l => l.named && !l.linked).slice(0, 4).map(l => ({ prospect_domain: l.domain, type: 'mention', origin: 'web', rank: l.domain_rank, spam_score: 0, score: scoreOf('mention', { authority: l.domain_rank, dr: l.dr }), detail: 'Lists you without a link: ' + String(l.title).slice(0, 100), source_url: l.url, target_url: home })),
    ...compNew.slice(0, 10).map(c => ({ prospect_domain: c.domain, type: 'comp_new', origin: 'dfs', rank: c.domain_rank, spam_score: 0, score: scoreOf('comp_new', { authority: c.domain_rank, dr: c.dr }, localOf(c.domain)), detail: 'Linked to ' + c.competitor + ' on ' + c.first_seen + (c.title ? ': ' + c.title : ''), source_url: c.url, target_url: target0 })),
    ...gap.filter(g => !g.off_topic && !g.no_pitch && (g.source !== 'cc' ? gi >= 0 : true)).slice(0, 25).map(g => ({ prospect_domain: g.domain, type: 'gap', origin: g.source, rank: g.rank, spam_score: g.spam, score: scoreOf('gap', { authority: g.rank, dr: drOf.get(g.domain) || 0, cc_rank: g.cc_rank }, (1 + 0.6 * (g.links_to.length - 1)) * localOf(g.domain)),   /* links to several competitors: the strongest intent signal; on the market's own domain ending: more relevant */ detail: 'Links to ' + g.links_to.join(', ') + (g.backlinks ? ' (' + g.backlinks + ' links)' : '') + ', not to you' + (g.source === 'cc' ? ' (Common Crawl)' : ''), source_url: '', target_url: target0 }))];
  const ledger_rows = ledger.map(({ visits_28d, _prev_status, _new, _dfs_new, _sources_now, _found_new, _url, ...r }) => r);
  const new_links = [...news.map(n => ({ ...n, verified: (vLink.get(LK.refKey(n.from_domain)) || {}).verify || '' })),
    ...ledger.filter(r => r._new && !r._dfs_new && r.kind === 'web' && r.status !== 'lost').map(r => ({ from_domain: r.ref_domain, from_url: r.from_url, to_url: r.to_url, anchor: r.anchor, dofollow: r.rel === 'follow', domain_rank: r.authority, dr: r.dr, page_rank: 0, spam: r.spam_score, first_seen: r.first_seen, last_seen: r.last_seen, title: r.page_title, spammy: r.link_type === 'spam', sources: r.sources, verified: r.verify }))]
    .filter((x, i, a) => a.findIndex(y => LK.refKey(y.from_domain) === LK.refKey(x.from_domain)) === i);
  return { json: { ...p, competitors, summary, lost, important_lost, new_links, spammy, reclaim, refdomains: [...linking].slice(0, 2000), timeseries: ts, mentions, gap, gap_off_topic, gap_stored: gi < 0 && gapBase.length > 0, gap_checked: gi < 0 ? ((p.stored_gap || [])[0] || {}).last_seen || '' : p.checked_at.slice(0, 10),
    lists, comp_new: compNew.slice(0, 20), coverage, anchors, pages, values, best_links, referral, wins: wins.filter(w => !spamSet.has(w.ref_domain)), at_risk: atRiskOut.map(({ e, v }) => ({ ref_domain: e.ref_domain, url: v.url, verify: v.verify })), rel_changed: relChanged.filter(r => !spamSet.has(r.ref_domain)), farms, dr_enabled: drOf.size > 0, dr_error,
    ledger_rows, alerts, deliver, disavow_text, candidates, gap_error: G && !G.ok ? G.error : null, cost_usd: +cost.toFixed(4) } };
});
