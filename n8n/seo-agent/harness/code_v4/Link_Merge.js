// One list of who links to the site, from every source (v4.10, BACKLINKS_SPEC.md §3): DataForSEO (referring domains + one link per domain with
// its details, new / lost), Bing Webmaster Tools (its own crawl, verified sites), the Search Console link exports the person uploaded (Google's
// own sample), GA4 referrals (links that send visits), Wikipedia and Hacker News, the Common Crawl web graph (133M domains, refreshed monthly by
// the linkgraph job: seo_link_graph), and the ledger of earlier runs. Keyed by referring site
// (registrable domain; platform subdomains such as x.blogspot.com stay separate). E-mail, chat, search, payment and AI hosts from GA4 are not
// links on the web and are dropped; social networks are kept and marked. Also collects the pages to check for mentions (news, web search,
// Content Analysis) and the "best X" list pages. Per site one item; *Verify Requests* decides what to fetch.
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
  function placementAt(html, idx) {
    const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g; const stack = []; let m;
    while ((m = re.exec(html)) && m.index < idx) {
      const close = m[1] === '/', tag = m[2].toLowerCase(), attrs = m[3] || '';
      if (!close && (tag === 'script' || tag === 'style' || tag === 'template')) { const end = html.toLowerCase().indexOf('</' + tag, re.lastIndex); if (end < 0 || end > idx) break; re.lastIndex = end; continue; }
      if (VOID.has(tag) || /\/\s*$/.test(attrs)) continue;
      if (close) { let at = -1; for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === tag) { at = i; break; } if (at >= 0) stack.length = at; }
      else stack.push({ tag, cls: ((attrs.match(/\b(?:class|id|role|itemprop)\s*=\s*["'][^"']*["']/gi) || []).join(' ')).toLowerCase() });
    }
    // whole class / id / role tokens, not substrings: page builders put "widget" or "header" in every wrapper (Elementor's "elementor-widget-container")
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
  return { text, attr, hostOf, regDomain, refKey, sameSite, isInfra, isScraper, isWire, normUrl, placementAt, linksTo, pageFacts, contextAt, challenge, emailsIn, verify, mention, domainKind, quality, values, anchorKind };
})();

const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const all = (n) => { try { return $(n).all().map(i => i.json || {}); } catch (e) { return []; } };
const reqs = all('BL Requests'), resps = all('Run BL Requests');
const sreqs = all('Source Requests'), sresps = all('Fetch Sources');
const nreqs = all('News Requests'), nresps = all('Fetch News');
const bcreqs = all('Bing Requests'), bcresps = all('Fetch Bing Counts'), breqs = all('Bing Link Requests'), bresps = all('Fetch Bing');
const bingSites = (() => { try { const r = $('Fetch Bing Sites').first().json || {}; const j = (r.body && typeof r.body === 'object') ? r.body : (r.d ? r : JSON.parse(String(r.body ?? r.data ?? '{}'))); return { ok: Array.isArray(j.d), urls: (j.d || []).map(x => String(x.Url || '')), error: j.Message || j.message || (r.error && (r.error.message || r.error)) || '' }; } catch (e) { return { ok: false, urls: [], error: '' }; } })();
const greqs = all('Referral Requests'), gresps = all('GA4 Referrals');
const ledger = all('Load Backlinks').filter(r => r && r.site_id && r.ref_domain);
const imports = all('Load Link Imports').filter(r => r && r.site_id && (r.ref_domain || r.from_url));
const prospects = all('Load Link Prospects').filter(r => r && r.site_id && r.prospect_domain);
const graph = all('Load Link Graph').filter(r => r && r.site_id && r.ref_domain);
const dfsRes = (r) => { const t = ((r || {}).tasks || [])[0] || {}; return t.status_code === 20000 ? ((t.result || [])[0] || {}) : null; };
const json = (r) => { if (!r) return null; if (r.body && typeof r.body === 'object') return r.body; const raw = r.body ?? r.data; if (raw && typeof raw === 'object') return raw; try { return JSON.parse(String(raw || '')); } catch (e) { return (r.query || r.articles || r.hits || r.results || r.d || r.rows) ? r : null; } };
const ymd = (s) => String(s || '').slice(0, 10);
const SEM = { main: 'content', article: 'content', section: 'content', '': 'body', header: 'nav', nav: 'nav', footer: 'footer', aside: 'sidebar', details: 'body', summary: 'body' };
const BIG = /(^|\.)(google|youtube|facebook|linkedin|wikipedia|amazon|apple|microsoft|reddit|quora|instagram|twitter|x|tiktok|medium|github|pinterest|blogspot|wordpress|tumblr)\.[a-z.]+$/i;
const DOC = /\.(pdf|docx?|xlsx?|pptx?|odt|rtf|zip|rar|7z|gz|csv|mp4|mp3|mov|jpe?g|png|gif|webp|svg)(?:[?#]|$)/i;   // documents and media: no links to check, and a 16 MB PDF stalled the live run (2026-10-08)
const LISTY = /\b(best|top|leading|\d{1,3}\b.*\b(companies|providers|vendors|tools|software|solutions|firms|agencies|platforms)|vs\.?|versus|compar|alternativ|review|list of|directory|ranking)/i;   // a "best X" page, not a product or FAQ page
const out = [];
for (const p of plans) {
  const M = new Map(); const now = p.checked_at; const today = ymd(now);
  const get = (host) => { const kind = LK.domainKind(host, p.domain); if (['self', 'mail', 'tool', 'search', 'ai'].includes(kind)) return null; const k = LK.refKey(host); if (!k || LK.sameSite(k, p.domain)) return null;
    if (!M.has(k)) M.set(k, { ref_domain: k, kind, sources: new Set(), from_url: '', to_url: '', anchor: '', rel: '', placement: '', first_seen: '', last_seen: '', authority: 0, page_keywords: 0, spam: 0, original: null, sitewide: 0, links: 0, visits: 0, visits_28d: 0, key_events: 0, dfs_lost: null, pages: [] });
    return M.get(k); };
  const seen = (e, src, d) => { e.sources.add(src); const x = ymd(d) || today; if (!e.first_seen || x < e.first_seen) e.first_seen = x; if (!e.last_seen || x > e.last_seen) e.last_seen = x; };
  const page = (e, url, src) => { if (url && !e.pages.some(x => x.url === url)) e.pages.push({ url, src }); if (url && !e.from_url) e.from_url = url; };
  const mine = (arr, list) => list.map((r, i) => [r, arr[i]]).filter(([r]) => r && r.site_id === p.site_id);
  // ---- DataForSEO
  for (const [r, resp] of mine(resps, reqs)) {
    const res = dfsRes(resp); if (!res) continue; const items = res.items || [];
    if (r.kind === 'refdomains') for (const x of items) { const e = get(x.domain); if (!e) continue; seen(e, 'dfs', x.first_seen); e.authority = Math.max(e.authority, Number(x.rank) || 0); e.spam = Number(x.backlinks_spam_score) || e.spam; e.sitewide = Math.max(e.sitewide, Number(x.backlinks) || 0); e.links = Math.max(e.links, Number(x.backlinks) || 0); }
    if (r.kind === 'links' || r.kind === 'new') for (const x of items) { const e = get(x.domain_from); if (!e) continue; seen(e, 'dfs', x.first_seen); e.last_seen = ymd(x.last_seen) > e.last_seen ? ymd(x.last_seen) : e.last_seen;
      page(e, x.url_from, 'dfs'); if (!e.to_url) e.to_url = x.url_to || ''; if (!e.anchor) e.anchor = String(x.anchor || (x.alt ? '[image] ' + x.alt : '')).slice(0, 160);
      if (!e.rel) e.rel = x.dofollow ? 'follow' : ((x.attributes || []).includes('sponsored') ? 'sponsored' : (x.attributes || []).includes('ugc') ? 'ugc' : 'nofollow');
      e.placement = e.placement || SEM[String(x.semantic_location || '')] || 'body'; e.authority = Math.max(e.authority, Number(x.domain_from_rank) || 0); e.spam = Math.max(e.spam, Number(x.backlink_spam_score) || 0);
      e.page_keywords = Math.max(e.page_keywords, Number(((x.ranked_keywords_info || {}).page_from_keywords_count_top_100)) || 0); if (x.original === false) e.original = false; else if (e.original === null && x.original === true) e.original = true;
      e.outbound = Number(x.page_from_external_links) || e.outbound || 0; if (r.kind === 'new') e.dfs_new = true; }
    if (r.kind === 'lost') for (const x of items) { const e = get(x.domain_from); if (!e) continue; e.sources.add('dfs'); e.dfs_lost = { url: x.url_from || '', last_seen: ymd(x.last_seen) }; page(e, x.url_from, 'dfs_lost');
      e.authority = Math.max(e.authority, Number(x.domain_from_rank) || 0); if (!e.anchor) e.anchor = String(x.anchor || '').slice(0, 160); if (!e.to_url) e.to_url = x.url_to || ''; if (!e.rel) e.rel = x.dofollow ? 'follow' : 'nofollow'; }
  }
  // ---- Bing Webmaster Tools (GetUrlLinks per linked page; when the API key is set and the site is in the key's Bing account)
  const inBing = bingSites.urls.some(u => LK.hostOf(u) === p.domain);
  const bing = { connected: false, in_account: inBing, error: p.bing && !bingSites.ok ? String(bingSites.error || 'Bing Webmaster API did not answer').slice(0, 160) : '', pages: 0, links: 0 };
  for (const [r, resp] of [...mine(bcresps, bcreqs), ...mine(bresps, breqs)]) {
    const j = json(resp) || {}; const d = j.d;
    if (!d) { const msg = String(j.Message || j.message || (resp && resp.error && (resp.error.message || resp.error)) || '').slice(0, 160); if (msg && !bing.error) bing.error = msg; continue; }
    bing.connected = true;
    if (r.kind === 'bing_counts') bing.pages += (d.Links || []).length;
    if (r.kind === 'bing_links') for (const x of (d.Details || [])) { const e = get(LK.hostOf(x.Url)); if (!e) continue; seen(e, 'bing', today); page(e, x.Url, 'bing'); if (!e.to_url) e.to_url = r.link || ''; if (!e.anchor && x.AnchorText) e.anchor = String(x.AnchorText).slice(0, 160); bing.links++; }
  }
  // ---- Search Console exports uploaded in the app (latest upload per kind)
  const myImp = imports.filter(x => x.site_id === p.site_id); const latestAt = {};
  for (const x of myImp) if (!latestAt[x.source] || String(x.imported_at) > latestAt[x.source]) latestAt[x.source] = String(x.imported_at);
  const gsc = { rows: 0, domains: new Set(), uploaded_at: Object.values(latestAt).sort().pop() || '' };
  for (const x of myImp) { if (String(x.imported_at) !== latestAt[x.source]) continue; const host = x.ref_domain || LK.hostOf(x.from_url); const e = get(host); if (!e) continue;
    const src = String(x.source || '').startsWith('gsc') ? 'gsc' : 'import'; seen(e, src, x.last_crawled || x.imported_at); if (x.from_url) page(e, x.from_url, src); if (x.to_url && !e.to_url) e.to_url = x.to_url; e.links = Math.max(e.links, Number(x.links) || 0); gsc.rows++; if (src === 'gsc') gsc.domains.add(e.ref_domain); }
  // ---- GA4 referrals
  const ga4 = { connected: false, error: '', sources: 0, visits: 0, key_events: 0, excluded: [] };
  for (const [r, resp] of mine(gresps, greqs)) {
    const j = json(resp) || {}; if (j.error || (resp && resp.error)) { ga4.error = String((j.error && j.error.message) || (resp.error && (resp.error.message || resp.error)) || '').slice(0, 160); continue; }
    ga4.connected = true; const rows = j.rows || [];
    if (r.kind === 'ref_sources') for (const row of rows) { const host = String(row.dimensionValues[0].value || ''); const range = (row.dimensionValues[1] || {}).value || 'year'; const m = row.metricValues.map(v => Number(v.value) || 0);
      const kind = LK.domainKind(host, p.domain); if (['self', 'mail', 'tool', 'search', 'ai'].includes(kind)) { if (range === 'year' && kind !== 'self') ga4.excluded.push(host); continue; }
      const e = get(host); if (!e) continue; if (range === 'year') { seen(e, 'ga4', today); e.visits += m[0]; e.key_events += m[2]; ga4.visits += m[0]; ga4.key_events += m[2]; ga4.sources++; } else e.visits_28d += m[0]; }
    if (r.kind === 'ref_pages') for (const row of rows) { const ref = String(row.dimensionValues[0].value || ''); const host = LK.hostOf(ref) || String(row.dimensionValues[1].value || ''); const e = M.get(LK.refKey(host)); if (!e) continue;
      if (/^https?:\/\/[^\/]+\/[^?#]+/.test(ref)) page(e, ref, 'ga4'); }
  }
  // ---- Wikipedia, Hacker News (free APIs) and the mention / list candidates
  const mentionPages = [], listPages = [];
  const wiki = { pages: 0 }, hn = { stories: 0 };
  for (const [r, resp] of mine(sresps, sreqs)) {
    const j = json(resp) || {};
    if (r.kind === 'wiki') for (const x of ((j.query || {}).exturlusage || [])) { if (Number(x.ns) !== 0 || !LK.sameSite(LK.hostOf(x.url), p.domain)) continue; const host = r.lang + '.wikipedia.org'; const e = get(host); if (!e) continue; seen(e, 'wiki', today); e.rel = 'nofollow'; e.placement = 'content';
      page(e, 'https://' + host + '/wiki/' + encodeURIComponent(String(x.title || '').replace(/ /g, '_')), 'wiki'); if (!e.to_url) e.to_url = x.url; e.anchor = e.anchor || String(x.title || '').slice(0, 160); e.link_type = 'resource'; wiki.pages++; }
    if (r.kind === 'hn') for (const x of (j.hits || [])) { if (!LK.sameSite(LK.hostOf(x.url), p.domain)) continue; const e = get('news.ycombinator.com'); if (!e) continue; seen(e, 'hn', x.created_at); page(e, 'https://news.ycombinator.com/item?id=' + x.objectID, 'hn'); if (!e.to_url) e.to_url = x.url; e.anchor = e.anchor || String(x.title || '').slice(0, 160); e.link_type = 'forum'; hn.stories++; }
    if (r.kind === 'searx_mention' || r.kind === 'searx_list') for (const x of (j.results || []).slice(0, 20)) { const host = LK.hostOf(x.url); if (!host || LK.sameSite(host, p.domain) || LK.domainKind(host, p.domain) !== 'web' || LK.isScraper(host) || DOC.test(x.url) || /^\[pdf\]/i.test(String(x.title || '')) || (p.competitors || []).some(c => LK.sameSite(host, c))) continue;
      if (r.kind === 'searx_list' && !LISTY.test(String(x.title || '') + ' ' + String(x.url || ''))) continue;
      (r.kind === 'searx_list' ? listPages : mentionPages).push({ url: x.url, domain: LK.refKey(host), title: String(x.title || '').slice(0, 160), source: r.kind === 'searx_list' ? 'web_list' : 'web', topic: r.topic || '' }); }
  }
  for (const [r, resp] of mine(nresps, nreqs)) { const j = json(resp) || {}; for (const a of (j.articles || [])) { const host = LK.hostOf(a.url); if (!host || LK.sameSite(host, p.domain) || DOC.test(a.url) || LK.isScraper(host)) continue;
    mentionPages.push({ url: a.url, domain: LK.refKey(host), title: String(a.title || '').slice(0, 160), source: 'news', date: String(a.seendate || '').replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3'), language: a.language || '' }); } }
  for (const [r, resp] of mine(resps, reqs)) { if (r.kind !== 'mentions') continue; const res = dfsRes(resp); for (const x of ((res || {}).items || [])) { const host = String(x.domain || ''); if (!host || LK.sameSite(host, p.domain) || BIG.test(host)) continue;
    if (DOC.test(x.url || '') || LK.isScraper(host) || (p.competitors || []).some(c => LK.sameSite(host, c))) continue;
    mentionPages.push({ url: x.url || '', domain: LK.refKey(host), title: String((x.content_info || {}).title || '').slice(0, 160), source: 'dfs_mention', authority: Number(x.domain_rank) || 0 }); } }
  // ---- Common Crawl web graph (domain level; no anchors, dates or nofollow — the link check fills them): referring domains and a free
  // authority rank for every domain (harmonic centrality position among 133M domains)
  const myGraph = graph.filter(r => r.site_id === p.site_id); const release = (myGraph.filter(r => r.release).sort((a, b) => String(b.checked_at || '').localeCompare(String(a.checked_at || '')))[0] || {}).release || '';   // the job's newest write (release names do not sort: jun-jul-aug > jul-aug-sep)
  const ccRank = new Map(); const ccGap = [];
  for (const r of myGraph) { if (release && r.release !== release) continue; const k = LK.refKey(r.ref_domain); if (Number(r.hc_pos) > 0) ccRank.set(k, Number(r.hc_pos));
    if (r.kind === 'link') { const e = get(r.ref_domain); if (e) { seen(e, 'cc', r.checked_at); e.cc_rank = Number(r.hc_pos) || 0; } }
    if (r.kind === 'gap' && !LK.isInfra(r.ref_domain) && !LK.isWire(r.ref_domain)) ccGap.push({ domain: k, cc_rank: Number(r.hc_pos) || 0, links_to: String(r.links_to || '').split(',').map(x => x.trim()).filter(Boolean) }); }
  // ---- the ledger of earlier runs (kept: sources seen before, verification history, analyst labels)
  const prev = new Map(ledger.filter(r => r.site_id === p.site_id).map(r => [r.ref_domain, r]));
  for (const [k, r] of prev) { if (M.has(k)) continue; if (['mail', 'tool', 'search', 'ai', 'self'].includes(r.kind)) continue; M.set(k, { ref_domain: k, kind: r.kind || 'web', sources: new Set(), from_url: r.from_url || '', to_url: r.to_url || '', anchor: r.anchor || '', rel: '', placement: '', first_seen: ymd(r.first_seen), last_seen: ymd(r.last_seen), authority: Number(r.authority) || 0, page_keywords: Number(r.page_keywords) || 0, spam: Number(r.spam_score) || 0, original: r.original === false || r.original === 'false' ? false : null, sitewide: Number(r.sitewide) || 0, links: Number(r.links) || 0, visits: 0, visits_28d: 0, key_events: 0, dfs_lost: null, pages: r.from_url ? [{ url: r.from_url, src: 'ledger' }] : [], carried: true }); }
  const linkedDomains = new Set([...M.values()].filter(e => !e.carried || (prev.get(e.ref_domain) || {}).status !== 'lost').map(e => e.ref_domain));
  const dedupe = (arr) => arr.filter((x, i) => x.url && arr.findIndex(y => y.url === x.url) === i);
  const ai_sources = new Set(prospects.filter(x => x.site_id === p.site_id && x.type === 'ai_source').map(x => LK.refKey(x.prospect_domain)));
  const entries = [...M.values()].map(e => ({ ...e, sources: [...e.sources], prev: prev.get(e.ref_domain) || null, ai_cited: ai_sources.has(e.ref_domain), cc_rank: e.cc_rank || ccRank.get(e.ref_domain) || 0 }));
  const counts = {}; for (const e of entries) for (const s of e.sources) counts[s] = (counts[s] || 0) + 1;
  out.push({ json: { site_id: p.site_id, domain: p.domain, mode: p.mode, entries, mention_pages: dedupe(mentionPages).filter(m => !linkedDomains.has(m.domain) || m.source === 'news').slice(0, 120), list_pages: dedupe(listPages).slice(0, 20),
    cc_gap: ccGap.filter(g => !linkedDomains.has(g.domain)).sort((a, b) => (b.links_to.length - a.links_to.length) || (a.cc_rank - b.cc_rank)).slice(0, 60), cc_rank: Object.fromEntries([...ccRank].slice(0, 3000)),
    sources: { cc: { release, links: myGraph.filter(r => r.kind === 'link' && r.release === release).length, checked_at: myGraph.map(r => String(r.checked_at || '')).sort().pop() || '' }, counts, bing: { ...bing, enabled: !!p.bing }, gsc: { rows: gsc.rows, domains: gsc.domains.size, uploaded_at: gsc.uploaded_at }, ga4: { ...ga4, property: p.ga4_property_id || '', excluded: [...new Set(ga4.excluded)].slice(0, 10) }, wiki, hn } } });
}
return out.length ? out : [{ json: { skip: true } }];
