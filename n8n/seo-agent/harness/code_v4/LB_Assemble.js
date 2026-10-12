// Link Builder: everything read this run turned into decisions (LINK_BUILDER_SPEC.md §2-§6), per site —
// - journalist requests matched to the site's topics (deadline kept), resource pages, competitors' broken links → new prospects;
// - every prospect read qualified: gone / blocked / sells links / other language / already linking → not a fit (with the reason); the
//   evidence a personal first line can quote (the sentence naming us, the dead link, the list, the section on our topic); up to 3 contacts
//   ranked author / named person → editorial → general; a contact form when there is no address; the recipient's country (consent rules);
//   our page to point to and the link text to ask for (pickTarget: topic match × position band × links needed, paced per page);
// - the listings checklist (linked / listed / missing / submitted / unknown — a blocked check is unknown, never missing), competitors present;
// - our old URLs that now 404 → redirects to add; what each won link did for its page (impact, with a control group);
// - this week's writer jobs: the best `budget` ready prospects (value × fit), not in free-only checks.
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
  return { text, attr, hostOf, regDomain, refKey, sameSite, isInfra, isScraper, isWire, normUrl, cleanUrl, placementAt, anchorPlacements, linksTo, pageFacts, contextAt, challenge, emailsIn, verify, mention, domainKind, quality, values, anchorKind, SPAM_RE, isGambling, footPath, footprints };
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
  // only addresses on the prospect's own domain: a page often lists other companies' addresses (live 2026-10-11: sajid@advintek.ae was stored
  // as the Ministry of Finance's contact because the Ministry's provider list names Advintek)
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
  const HOME_TYPES = new Set(['mention', 'list', 'listing', 'press', 'ai_list']);
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
  return { OFF_TOPIC, isGov, words, stem, fit, contactsIn, rankContacts, authorUrl, contactForm, sellSignals, countryOf, pickTarget, kindOf };
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
const rows = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && typeof r === 'object' && Object.keys(r).length && !r.error && !r.skip); } catch (e) { return []; } };
const pair = (a, b) => { try { const R = $(a).all().map(i => i.json); const S = $(b).all().map(i => i.json || {}); return R.map((r, i) => ({ r, x: S[i] || {} })).filter(o => !o.r.skip); } catch (e) { return []; } };
const prospects = rows('Load Link Prospects'), outreach = rows('Load Link Outreach'), listingRows = rows('Load Listings'), ledger = rows('Load Backlinks'), impacts = rows('Load Link Impact'), queries = rows('Load Query History');
const sources = pair('LB Source Requests', 'Fetch LB Sources'), pagesRead = pair('LB Page Requests', 'Fetch LB Pages'), second = pair('LB Second Requests', 'Fetch LB Second');
const now = new Date(); const iso = now.toISOString(); const day = iso.slice(0, 10);
const htmlOf = (x) => String(x.body ?? x.data ?? ''); const statusOf = (x) => Number(x.statusCode || x.status || 0);
const jsonOf = (x) => { if (!x) return null; if (x.body && typeof x.body === 'object') return x.body; if (x.posts || Array.isArray(x)) return x; try { return JSON.parse(String(x.body ?? x.data ?? '')); } catch (e) { return null; } };
const errOf = (x) => x.error ? String(x.error.message || x.error.description || x.error).slice(0, 160) : '';
const pathKey = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const r1 = (n) => Math.round(10 * n) / 10;
const LIKELY = { lost: 0.7, mention: 0.9, list: 0.5, comp_new: 0.55, gap: 0.4, ai_source: 0.35, resource: 0.45, broken: 0.6, press: 0.5 };
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
  const outreach_rows = [], prospect_rows = [], listing_rows = [], fixes = [];
  const base = (o) => ({ site_id: sid, domain: p.domain, prospect_domain: o.prospect_domain, type: o.type, status: o.status, score: o.score || 0, fit: o.fit || 0, fit_reason: o.fit_reason || '', checks_json: JSON.stringify(o.checks || {}),
    page_url: o.page_url || '', page_title: o.page_title || '', evidence: String(o.evidence || '').slice(0, 600), contacts_json: JSON.stringify(o.contacts || []), contact_email: (o.contacts || [])[0] ? o.contacts[0].email : '', contact_form_url: o.contact_form_url || '',
    country: o.country || '', language: o.language || '', target_url: o.target_url || '', target_reason: o.target_reason || '', anchor_hint: o.anchor_hint || '', sequence_json: o.sequence_json || '', deadline: o.deadline || '', drafted_at: o.drafted_at || '', checked_at: iso, request_id: p.request_id || '' });
  const newProspect = (o) => ({ site_id: sid, domain: p.domain, prospect_domain: o.prospect_domain, type: o.type, rank: o.rank || 0, spam_score: 0, detail: String(o.detail || '').slice(0, 300), source_url: o.page_url || '', target_url: o.target_url || '',
    status: 'new', first_seen: iso, last_seen: iso, won_at: '', outreach_subject: '', outreach_body: '', note: '', score: o.score || 0, origin: o.origin || 'link_builder', contact_email: (o.contacts || [])[0] ? o.contacts[0].email : '', contact_url: (o.contacts || [])[0] ? o.contacts[0].source_url || '' : '',
    contacted_at: '', followup_step: 0, followup_subject: '', followup_body: '', verified_at: '' });
  // ---- 1. journalist requests (Bluesky #journorequest): recent, on our topics, deadline not obviously past ----
  const press = [...posts.values()].filter(x => (!x.site_id || x.site_id === sid) && (now.getTime() - new Date(x.at).getTime()) / 864e5 <= 10)
    .map(x => ({ ...x, f: OK.fit(x.text, topicText + ' ' + p.topics.join(' '), df, docs.length) })).filter(x => x.f >= 0.34).sort((a, b) => b.f - a.f).slice(0, 3);
  for (const x of press) { if (myOutreach.some(o => o.type === 'press' && o.page_url === x.url)) continue;
    const em = (String(x.text).match(/[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/i) || [])[0];
    const o = { prospect_domain: (String(x.handle || 'bsky') + '/' + x.rkey).toLowerCase(), type: 'press',   /* one row per request: a journalist account posts many */ status: em ? 'ready' : 'needs_contact', score: Math.round(60 * x.f + 20), fit: x.f, fit_reason: 'request on your topic (' + Math.round(x.f * 100) + '% match)', page_url: x.url, page_title: 'Journalist request by ' + x.name,
      evidence: x.text.slice(0, 500), contacts: em ? [{ email: em.toLowerCase(), kind: 'person', own: false, source_url: x.url }] : [], contact_form_url: em ? '' : x.url, deadline: deadlineOf(x.text), target_url: p.home, target_reason: 'an expert answer names the business: the homepage', anchor_hint: 'brand', checks: { posted: x.at.slice(0, 10), how: em ? 'e-mail in the request' : 'reply on Bluesky or the link in the request' } };
    outreach_rows.push(base(o)); prospect_rows.push(newProspect({ ...o, detail: 'Journalist request: ' + x.text.slice(0, 240), origin: 'bluesky' })); }
  // ---- 2. every prospect page read: qualify, evidence, contacts, our page ----
  const contactsBy = new Map(); const formBy = new Map(); const deadBy = new Map();
  for (const { r, x } of second.filter(o => o.r.site_id === sid)) {
    const html = htmlOf(x); const st = statusOf(x);
    if (r.kind === 'contact' && html && st < 400 && !LK.challenge(st, html)) { const l = contactsBy.get(r.prospect_domain) || []; l.push(...OK.contactsIn(html, r.prospect_domain, r.url)); contactsBy.set(r.prospect_domain, l); const f = OK.contactForm(html, r.url); if (f && !formBy.has(r.prospect_domain)) formBy.set(r.prospect_domain, f); }
    if (r.kind === 'outbound') { const e = errOf(x); const dead = st === 404 || st === 410 || /ENOTFOUND|NXDOMAIN|EAI_AGAIN.*ENOTFOUND|certificate has expired/i.test(e);
      if (dead) { const l = deadBy.get(r.prospect_domain) || []; l.push({ url: r.url, anchor: r.anchor, status: st || 'no DNS', on_page: r.on_page }); deadBy.set(r.prospect_domain, l); } }
  }
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
    // contacts: the page itself + author / contact / about pages
    const cands = [...(html && !blocked ? OK.contactsIn(html, r.prospect_domain, r.url) : []), ...(contactsBy.get(r.prospect_domain) || [])];
    if (stored.contact_email && !cands.some(c => c.email === stored.contact_email)) cands.push({ email: stored.contact_email, kind: OK.kindOf(stored.contact_email), own: LK.sameSite(stored.contact_email.split('@')[1], r.prospect_domain), w: 2, source_url: stored.contact_url || '' });
    o.contacts = OK.rankContacts(cands); o.contact_form_url = o.contacts.length ? '' : (formBy.get(r.prospect_domain) || '');
    // our page and the link text
    const lostRow = r.type === 'lost' ? myLedger.find(l => l.ref_domain === r.prospect_domain) : null;
    const tg = OK.pickTarget({ type: r.type === 'ai_source' && /list|best|top/i.test(o.page_title) ? 'ai_list' : (o.checks.angle === 'broken' ? 'broken' : r.type), text: o.page_title + ' ' + evidence, topics: p.topics.slice(0, 2).join(' '), dead_text: o.checks.dead ? [o.checks.dead.anchor, String(o.checks.dead.url).replace(/[\/_.-]+/g, ' ')].join(' ') : '', to_url: lostRow ? lostRow.to_url : '' }, p.pages, df, docs.length, p.home);
    o.target_url = tg.url; o.target_reason = tg.reason; o.anchor_hint = tg.anchor;
    if (!blocked && t && ['gap', 'comp_new', 'resource', 'broken'].includes(r.type) && o.fit < (r.type === 'broken' ? 0.15 : OK.OFF_TOPIC)) reasons.push('off topic for you (' + Math.round(o.fit * 100) + '% match)');
    if (isNew) o.score = Math.round(100 * (LIKELY[r.type] || 0.3) * (0.4 + 0.6 * Math.min(1, o.fit + 0.2)) * (r.rank ? Math.min(1.2, 0.6 + Number(r.rank) / 600) : 1));
    o.status = reasons.length ? 'not_fit' : (o.contacts.length ? 'ready' : 'needs_contact');
    o.checks.reasons = reasons; o.checks.page_status = st || (e ? 'error' : ''); o.checks.blocked = blocked; o.checks.noindex = !!facts.noindex;
    if (o.status === 'not_fit') o.fit_reason = reasons.join('; ');
    outreach_rows.push(base(o));
    if (isNew && o.status !== 'not_fit') prospect_rows.push(newProspect({ ...o, rank: r.rank || 0, detail: r.type === 'broken' ? 'Links to ' + (r.competitor || 'a competitor') + "'s dead page " + r.dead_url : r.type === 'resource' ? 'Resource page on "' + (r.topic || p.topics[0] || '') + '": ' + o.page_title : o.page_title, origin: r.type === 'broken' ? 'dfs' : 'web' }));
  }
  // ---- 3. our old URLs that now 404 (Wayback) → a redirect to the closest live page ----
  for (const { r, x } of pagesRead.filter(o => o.r.site_id === sid && o.r.kind === 'wayback_check')) {
    const st = statusOf(x); if (st !== 404 && st !== 410) continue;
    const words = String(r.url).replace(/^https?:\/\/[^\/]+/, '').replace(/[\/_.-]+/g, ' ');
    const best = p.pages.filter(pg => pg.kind !== 'home').map(pg => ({ pg, f: OK.fit(words, [pg.title, pg.keyword, pg.url.replace(/[\/_.-]+/g, ' ')].join(' '), df, docs.length) })).sort((a, b) => b.f - a.f)[0];
    fixes.push({ from: r.url, to: best && best.f >= 0.3 ? best.pg.url : p.home, archived_at: r.archived_at, status: st });
  }
  for (const f of fixes.slice(0, 30)) outreach_rows.push(base({ prospect_domain: LK.normUrl(f.from), type: 'redirect',   /* one row per old URL */ status: 'fix', page_url: f.from, target_url: f.to, target_reason: 'answered ' + f.status + '; archived ' + String(f.archived_at).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'), evidence: 'Add a 301 redirect from ' + f.from + ' to ' + f.to + ' (links and bookmarks to the old URL keep working).', checks: { kind: 'wayback' } }));
  // ---- 4. the listings checklist ----
  if (p.due.listings) {
    const selfHtml = pagesRead.filter(o => o.r.site_id === sid && o.r.kind === 'self').map(o => htmlOf(o.x)).join(' ');
    const kind = siteKind(p.profile.business_type, p.topics.join(' '));
    for (const l of listingsFor(kind, p.country_iso, topicText, LK.text(selfHtml))) {
      const old = listingRows.find(y => y.site_id === sid && y.listing_id === l.id) || {};
      let status = 'unknown', profile_url = '', rel = l.link, evidence = '';
      const led = myLedger.find(y => y.status !== 'lost' && (y.ref_domain === l.host || LK.sameSite(y.ref_domain, l.host) || LK.sameSite(l.host, y.ref_domain)) && (l.list ? LK.normUrl(y.from_url) === LK.normUrl(l.list) : l.re ? l.re.test(y.from_url || '') : true));   // the list page itself, the profile pattern, else the host
      if (led) { status = 'linked'; profile_url = led.from_url || ''; rel = led.rel || rel; evidence = 'their page links to you (link check)'; }
      const selfLink = l.re ? [...selfHtml.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]).find(u => l.re.test(u)) || (selfHtml.match(new RegExp('"(https?:[^"]*' + l.host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^"]*)"', 'i')) || [])[1] : '';
      if (status === 'unknown' && selfLink && (!l.re || l.re.test(selfLink))) { status = 'listed'; profile_url = selfLink; evidence = 'your site links to the profile'; }
      const comps = [];
      for (const o of pagesRead.filter(o => o.r.site_id === sid && o.r.kind === 'comp_home')) { const h = htmlOf(o.x); if (l.re && [...h.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].some(m => l.re.test(m[1]))) comps.push(o.r.competitor); }
      for (const o of pagesRead.filter(o => o.r.site_id === sid && ((o.r.listing_id === l.id && (o.r.kind === 'listing_list' || o.r.kind === 'listing_profile')) || (l.list && o.r.kind === 'prospect' && LK.normUrl(o.r.url) === LK.normUrl(l.list))))) {   // a list page read as a prospect counts too
        const h = htmlOf(o.x); const st = statusOf(o.x);
        if (!h || LK.challenge(st, h)) { if (o.r.kind === 'listing_profile' && !o.r.guessed && status === 'unknown') { status = 'listed'; profile_url = o.r.url; evidence = 'found by search; the platform blocks checks: open it to confirm'; } continue; }
        if (st === 404 || st === 410) { if (status === 'unknown' && o.r.guessed) { status = 'missing'; evidence = 'no profile at ' + o.r.url; } continue; }
        const asList = o.r.kind === 'listing_list' || o.r.kind === 'prospect';
        const v = LK.verify(o.x, p.domain, { url: o.r.url });
        if (v.verify === 'found') { status = 'linked'; profile_url = o.r.url; rel = v.rel; evidence = asList ? 'the list links to you' : 'the profile links to you'; }
        else if (new RegExp('\\b' + String(p.brand).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(LK.text(h)) && status !== 'linked') { status = 'listed'; profile_url = o.r.url; evidence = asList ? 'the list names you without a link' : 'the profile names you'; }
        else if (status === 'unknown' && asList) { status = 'missing'; evidence = 'the list does not name you'; }
        if (asList) for (const c of p.competitors) if (h.toLowerCase().includes(c.toLowerCase()) && !comps.includes(c)) comps.push(c);
      }
      if (['submitted', 'ignored'].includes(old.status) && !['linked', 'listed'].includes(status)) { status = old.status; }
      listing_rows.push({ site_id: sid, domain: p.domain, listing_id: l.id, name: l.name, category: l.cat, status, profile_url: profile_url || old.profile_url || '', rel: status === 'linked' ? rel : l.link, competitors: comps.join(', '), submit_url: l.submit || '',
        priority: l.prio + (comps.length ? -0.5 : 0), why: (evidence ? evidence + ' · ' : '') + l.why, checked_at: iso, submitted_at: old.submitted_at || '', note: old.note || '' });
    }
  }
  // ---- 5. what each won link did for its page (Search Console positions, control group of the site's other pages) ----
  const myQ = queries.filter(q => q.site_id === sid && q.page);
  const periods = [...new Set(myQ.map(q => String(q.period_end || '')))].filter(Boolean).sort();
  const pagePos = (period) => { const m = new Map(); for (const q of myQ.filter(q => String(q.period_end) === period)) { const k = pathKey(q.page); const i = Math.max(1, Number(q.impressions) || 0); const pos = Number(q.position) || 0; if (!pos) continue; const e = m.get(k) || { w: 0, s: 0, c: 0, q: q.query, qi: 0 }; e.w += i; e.s += pos * i; e.c += Number(q.clicks) || 0; if (i > e.qi) { e.q = q.query; e.qi = i; } m.set(k, e); } return m; };
  const impact_rows = [];
  // links that appeared after tracking began (the first run records every existing link as first seen that day: no t0 for them; live 2026-10-11)
  const trackStart = myLedger.map(l => String(l.first_seen || '')).filter(Boolean).sort()[0] || '';
  const farms = LK.footprints(myLedger, { domain: p.domain, brands: p.brand_names || [] });   // link-farm pages (D3): no impact tracking, whatever an older ledger row says
  const won = myLedger.filter(l => l.status !== 'lost' && l.kind === 'web' && l.link_type !== 'spam' && !farms.has(l.ref_domain) && l.to_url && l.first_seen && trackStart && new Date(l.first_seen).getTime() - new Date(trackStart).getTime() >= 7 * 864e5 && (now.getTime() - new Date(l.first_seen).getTime()) / 864e5 <= 200 && (l.verify === 'found' || Number(l.seo_value) >= 20));
  for (const l of won.slice(0, 30)) {
    const t0 = String(l.first_seen).slice(0, 10); const weeks = Math.floor((now.getTime() - new Date(t0).getTime()) / (7 * 864e5)); const k = pathKey(l.to_url);
    const before = periods.filter(x => x <= t0).pop(); const after = periods[periods.length - 1];
    const row = { site_id: sid, domain: p.domain, ref_domain: l.ref_domain, from_url: l.from_url || '', target_url: l.to_url, t0, weeks, base_position: 0, base_clicks: 0, position: 0, clicks: 0, page_change: 0, control_change: 0, control_spread: 0, effect: 0, verdict: '', note: '', keyword: '', updated_at: iso };
    const B = before ? pagePos(before) : null, A = after && after !== before ? pagePos(after) : null;
    const pb = B && B.get(k), pa = A && A.get(k);
    if (weeks < 6) { row.verdict = 'too_early'; row.note = 'read at 6, 10 and 16 weeks after the link went live'; }
    else if (!pb || !pa) { row.verdict = 'cant_tell'; row.note = !myQ.length ? 'no Search Console data for this site' : 'the page had no search impressions before or after the link'; }
    else {
      row.base_position = r1(pb.s / pb.w); row.position = r1(pa.s / pa.w); row.base_clicks = pb.c; row.clicks = pa.c; row.keyword = pa.q || pb.q || ''; row.page_change = r1(row.base_position - row.position);
      const others = [...A.keys()].filter(x => x !== k && B.has(x) && !won.some(w => pathKey(w.to_url) === x && String(w.first_seen).slice(0, 10) >= before)).map(x => (B.get(x).s / B.get(x).w) - (A.get(x).s / A.get(x).w));
      row.control_change = r1(median(others)); row.control_spread = r1(median(others.map(d => Math.abs(d - median(others))))); row.effect = r1(row.page_change - row.control_change);
      const joint = won.filter(w => w !== l && pathKey(w.to_url) === k && Math.abs(new Date(w.first_seen).getTime() - new Date(t0).getTime()) <= 28 * 864e5).length;
      row.verdict = others.length < 3 ? (row.effect > 1 ? 'possibly_helped' : 'no_effect_yet') : row.effect > Math.max(1, 2 * row.control_spread) && !joint ? 'likely_helped' : row.effect > Math.max(0.5, row.control_spread) ? 'possibly_helped' : 'no_effect_yet';
      row.note = (joint ? 'another link to this page within 4 weeks (credit shared); ' : '') + (others.length < 3 ? 'few other pages to compare with; ' : '') + 'position ' + row.base_position + ' → ' + row.position + ' vs the site\'s other pages ' + (row.control_change >= 0 ? '+' : '') + row.control_change;
    }
    impact_rows.push(row);
  }
  // ---- 6. this week's writer jobs: the best ready prospects (new rows of this run + stored ready rows), not in free-only checks ----
  const ready = [...outreach_rows.filter(o => o.status === 'ready'), ...myOutreach.filter(o => o.status === 'ready' && !o.sequence_json && !outreach_rows.some(n => n.prospect_domain === o.prospect_domain && n.type === o.type))]
    .map(o => ({ ...o, rankv: (Number(o.score) || 0) * (0.5 + Number(o.fit || 0)) })).sort((a, b) => b.rankv - a.rankv);
  const jobs = p.free_only ? [] : ready.slice(0, p.budget).map(({ rankv, ...o }) => o);
  const stillOld = (k) => !(myOutreach.find(o => o.prospect_domain + '|' + o.type === k) || {}).sequence_json;
  out.push({ json: { site_id: sid, domain: p.domain, email: p.email, callback_url: p.callback_url, request_id: p.request_id, on_demand: p.on_demand, free_only: p.free_only, checked_at: iso,
    outreach_rows, prospect_rows, listing_rows, impact_rows, jobs: jobs.filter(j => stillOld(j.prospect_domain + '|' + j.type)), fixes,
    cache_row: { key: 'linkbld:' + sid, kind: 'linkbld', site_id: sid, value: JSON.stringify({ ...p.state, listings_at: p.due.listings ? iso : p.state.listings_at, resources_at: p.due.resources ? iso : p.state.resources_at, wayback_at: p.due.wayback ? iso : p.state.wayback_at, broken_at: p.due.broken ? iso : p.state.broken_at, last_run: iso }), updated_at: iso },
    summary: { press: press.length, qualified: outreach_rows.filter(o => !['not_fit', 'fix'].includes(o.status)).length, not_fit: outreach_rows.filter(o => o.status === 'not_fit').length, needs_contact: outreach_rows.filter(o => o.status === 'needs_contact').length,
      ready: ready.length, to_draft: jobs.length, redirects: fixes.length, listings_missing: listing_rows.filter(l => l.status === 'missing').length, listings_linked: listing_rows.filter(l => l.status === 'linked').length,
      impact_reads: impact_rows.filter(r => !['too_early', 'cant_tell'].includes(r.verdict)).length } } });
}
return out.length ? out : [{ json: { skip: true } }];
