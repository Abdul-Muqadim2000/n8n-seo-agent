// The pages to read this run (free): every new prospect to qualify (best score first; also the Backlink Monitor's and AI Growth's), resource
// pages found by search, pages that link to a competitor's dead page (DataForSEO), evidence for the listings checklist (our own home / about
// pages and the competitors' homepages: links and sameAs to the platforms; member lists like the UAE Ministry of Finance's; guessed profile
// URLs on platforms that answer a plain fetch), and our old URLs from the Wayback Machine (does each still answer?).
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
  const normUrl = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/#.*$/, '').replace(/[?&](utm_[a-z]+|ref|fbclid|gclid)=[^&]*/g, '').replace(/\?$/, '').replace(/\/+$/, '');
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
  return { text, attr, hostOf, regDomain, refKey, sameSite, isInfra, isScraper, isWire, normUrl, placementAt, anchorPlacements, linksTo, pageFacts, contextAt, challenge, emailsIn, verify, mention, domainKind, quality, values, anchorKind, SPAM_RE, isGambling, footPath, footprints };
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
function siteKind(businessType, topicText) {   // the checklists that apply: a consultancy that also sells software gets both
  const t = String(businessType || '') + ' ' + String(topicText || '');
  if (/restaurant|cafe|clinic|dental|salon|store|shop|hotel|gym|plumb|electric|lawyer|law firm|real estate|local ?business|medical|spa|bakery/i.test(t)) return ['local'];
  const agency = /agency|consult|marketing services|design studio|development services|professional ?service|accounting firm|audit firm/i.test(t);
  const software = /software|saas|platform|\bapp\b|cloud|e-?invoic|\berp\b|automation|\bapi\b/i.test(t);
  return agency && software ? ['agency', 'saas'] : agency ? ['agency'] : ['saas'];
}

const plans = $('LB Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const rows = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && typeof r === 'object' && Object.keys(r).length && !r.error); } catch (e) { return []; } };
const prospects = rows('Load Link Prospects'), outreach = rows('Load Link Outreach'), ledger = rows('Load Backlinks');
let sreqs = [], sresps = []; try { sreqs = $('LB Source Requests').all().map(i => i.json); sresps = $('Fetch LB Sources').all().map(i => i.json || {}); } catch (e) {}
let dreqs = [], dresps = []; try { dreqs = $('LB DFS Requests').all().map(i => i.json).filter(r => !r.skip); dresps = $('Run LB DFS').all().map(i => i.json || {}); } catch (e) {}
const body = (r) => { if (!r) return null; if (r.body && typeof r.body === 'object') return r.body; if (r.posts || r.results || Array.isArray(r)) return r; try { return JSON.parse(String(r.body ?? r.data ?? '')); } catch (e) { return null; } };
const BIG = /(^|\.)(google|youtube|facebook|linkedin|wikipedia|amazon|apple|microsoft|reddit|quora|instagram|twitter|x|tiktok|medium|github|pinterest|bing|yahoo|duckduckgo)\.[a-z.]+$/i;
const DOC = /\.(pdf|docx?|xlsx?|pptx?|zip|csv|xml|json|txt|mp4|mp3)(\?|$)/i;
const ASSET = /\.(css|js|mjs|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot|xml|json|txt|pdf|map|webmanifest)(\?|$)/i;
const out = [];
for (const p of plans) {
  const add = (kind, url, extra = {}) => { if (!/^https?:\/\//i.test(url || '') || out.some(o => o.json.site_id === p.site_id && o.json.url === url && o.json.kind === kind)) return; /* one fetch per purpose */ out.push({ json: { site_id: p.site_id, kind, url: String(url).slice(0, 500), ...extra } }); };
  const linking = new Set(ledger.filter(l => l.site_id === p.site_id && l.status !== 'lost').map(l => l.ref_domain));
  const known = new Set([...outreach.filter(o => o.site_id === p.site_id).map(o => o.prospect_domain + '|' + o.type)]);
  const comp = new Set(p.competitors.map(c => LK.regDomain(c)));
  const skipD = (d) => !d || LK.sameSite(d, p.domain) || comp.has(LK.regDomain(d)) || BIG.test(d) || LK.isInfra(d) || LK.isScraper(d) || LK.isWire(d) || linking.has(LK.refKey(d));
  // 1. prospects to qualify: new, not yet qualified, best score first (reclaims are fixed on our own site)
  const todo = prospects.filter(x => x.site_id === p.site_id && (x.status || 'new') === 'new' && x.type !== 'reclaim' && !known.has(x.prospect_domain + '|' + x.type) && !skipD(x.prospect_domain))
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)).slice(0, p.qualify_max);
  for (const x of todo) add('prospect', (x.source_url && !DOC.test(x.source_url)) ? x.source_url : 'https://' + x.prospect_domain + '/', { prospect_domain: x.prospect_domain, type: x.type });
  // 2. resource pages found by search (monthly)
  let nRes = 0;
  sreqs.forEach((r, i) => { if (r.site_id !== p.site_id || r.kind !== 'resource_search') return; const j = body(sresps[i]) || {};
    for (const it of (j.results || [])) { const d = LK.hostOf(it.url); if (nRes >= 8 || skipD(d) || DOC.test(it.url) || known.has(LK.refKey(d) + '|resource') || out.some(o => o.json.prospect_domain === LK.refKey(d))) continue;
      nRes++; add('prospect', it.url, { prospect_domain: LK.refKey(d), type: 'resource', topic: r.topic, title: String(it.title || '').slice(0, 160) }); } });
  // 3. pages linking to a competitor's dead page (DataForSEO, monthly)
  let nBr = 0;
  dreqs.forEach((r, i) => { if (r.site_id !== p.site_id) return; const res = (((dresps[i] || {}).tasks || [])[0] || {}).result || []; const items = (res[0] || {}).items || [];
    for (const it of items) { const d = LK.refKey(it.domain_from); if (nBr >= 10 || skipD(d) || known.has(d + '|broken') || out.some(o => o.json.prospect_domain === d)) continue; nBr++;
      add('prospect', it.url_from, { prospect_domain: d, type: 'broken', dead_url: it.url_to || '', dead_anchor: String(it.anchor || '').slice(0, 120), competitor: r.competitor, rank: Number(it.domain_from_rank) || 0 }); } });
  // 4. listings evidence (monthly)
  if (p.due.listings) {
    add('self', p.home); add('self', p.home.replace(/\/$/, '') + '/about'); add('self', p.home.replace(/\/$/, '') + '/about-us');
    for (const c of p.competitors.slice(0, 3)) add('comp_home', 'https://' + c + '/', { competitor: c });
    const kind = siteKind(p.profile.business_type, p.topics.join(' '));
    const slug = String(p.brand || p.domain.split('.')[0]).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    for (const l of listingsFor(kind, p.country_iso, p.topics.join(' ') + ' ' + p.profile.business_type, '')) {
      if (l.list) add('listing_list', l.list, { listing_id: l.id });
      else if (l.fetchable && l.guess) add('listing_profile', l.guess({ slug, domain: p.domain }), { listing_id: l.id, guessed: true });
    }
    sreqs.forEach((r, i) => { if (r.site_id !== p.site_id || r.kind !== 'listing_search') return; const l = LISTINGS.find(x => x.id === r.listing_id); const j = body(sresps[i]) || {};
      const hit = (j.results || []).find(it => l && l.re && l.re.test(it.url || '')); if (hit) add('listing_profile', hit.url, { listing_id: l.id }); });
  }
  // 5. our old URLs (Wayback CDX, monthly): does each still answer? (a 404 with history = a redirect to add)
  sreqs.forEach((r, i) => { if (r.site_id !== p.site_id || r.kind !== 'wayback') return; const j = body(sresps[i]); const list = Array.isArray(j) ? j.slice(1) : [];
    const seen = new Set(); let n = 0;
    for (const row of list) { const u = String(row[0] || ''); const h = LK.hostOf(u); if (!LK.sameSite(h, p.domain) || ASSET.test(u) || /[?#]/.test(u) || /\/(wp-json|wp-admin|feed|cdn-cgi|_next|static)\b/i.test(u)) continue;
      const k = LK.normUrl(u); if (seen.has(k) || n >= 60) continue; seen.add(k); n++;
      add('wayback_check', u.replace(/^http:/i, 'https:'), { archived_at: String(row[2] || '').slice(0, 8) }); } });
}
return out.length ? out : [{ json: { skip: true } }];
