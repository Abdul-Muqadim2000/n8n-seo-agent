// "I published a page": verifies the live page (HTTP status, noindex, title, meta description, H1, canonical, JSON-LD, length, keyword use,
// images; v4.4: author byline + Person schema and date for articles, TOC and cluster links for hubs, LocalBusiness + visible phone, VideoObject + transcript),
// resolves it to the content-log row and/or the ladder row for that keyword, prepares the rows to store, and suggests pages to link from
// (pages of the site with impressions whose path shares a word with the keyword, plus the other ladder pages).
const d = $('Normalize Input').first().json;
// The fetch result is read explicitly: the input item here is the last Data Table load, not the HTTP response (live finding 2026-10-02).
let r = {}; try { r = (($('Fetch Published Page').first() || {}).json) || {}; } catch (e) { r = { error: { message: 'fetch step did not run: ' + String(e.message || e).slice(0, 120) } }; }
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(x => x && typeof x === 'object' && !x.error); } catch (e) { return []; } };
const logs = rowsOf('Load Content Log (Published)'), ladders = rowsOf('Load Ladders (Published)'), qh = rowsOf('Load Query History (Published)');
const now = new Date().toISOString(); const url = String(d.published_url || '').trim();
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const domain = normD(d.domain); const site_id = 'site_' + domain.replace(/[^a-z0-9]+/g, '-');
let kw = norm(d.keyword);
const rid = String(d.content_request_id || '').trim();
let log = (rid ? logs.find(l => normD(l.domain) === domain && String(l.request_id) === rid) : null) || (kw ? logs.find(l => normD(l.domain) === domain && norm(l.keyword) === kw) : null) || null;
if (!kw && log) kw = norm(log.keyword);
// The ladder row follows the draft that was found, not the words typed (techand.ai on production, 2026-10-23: the draft was found by its
// request id, the typed "microsoft dynamics 365 erp system" matched no rung, so the rung "is microsoft dynamics 365 an erp system" stayed
// not_ready with page_exists false while its content-log row said published). Order: the draft's ladder id + keyword, the draft's keyword,
// then the typed keyword (the older path).
const onSite = ladders.filter(l => normD(l.domain) === domain);
const logKw = log ? norm(log.keyword) : '';
const ladder = (log && log.ladder_id && logKw ? onSite.find(l => l.ladder_id === log.ladder_id && norm(l.keyword) === logKw) : null)
  || (logKw ? onSite.find(l => norm(l.keyword) === logKw) : null)
  || (kw ? onSite.find(l => norm(l.keyword) === kw) : null) || null;
// ---- live checks ----
const bodyOf = (r) => { const b = r && (r.body != null ? r.body : r.data); return typeof b === 'string' ? b : (b ? JSON.stringify(b) : ''); };   // the HTTP node puts text responses under `data` (live finding 2026-10-02)
const status = Number(r.statusCode) || 0; const body = bodyOf(r);
const fetchErr = r.error ? String(r.error.message || r.error.description || r.error).slice(0, 160) : null;
// production 2026-11-10 (devaicon.com): a title tag is HTML, so "Banking &amp; Financial Services Technology | Devaicon" failed "Title tag uses
// the keyword" for "banking & financial services technology" (norm() read "amp" as a word). Entities are decoded before any check reads them.
const decodeEnt = (t) => String(t || '').replace(/&#x([0-9a-f]{1,6});/gi, (m, h) => { const n = parseInt(h, 16); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' '; })
  .replace(/&#(\d{1,7});/g, (m, n) => (Number(n) > 0 && Number(n) < 0x110000 ? String.fromCodePoint(Number(n)) : ' '))
  .replace(/&(?:amp|AMP);/g, '&').replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&(?:rsquo|lsquo);/gi, "'").replace(/&(?:rdquo|ldquo);/gi, '"').replace(/&(?:ndash|mdash);/gi, '-');
const pick1 = (re) => { const x = body.match(re); return x ? decodeEnt(x[1]).replace(/\s+/g, ' ').trim() : ''; };
const title = pick1(/<title[^>]*>([\s\S]*?)<\/title>/i);
const h1 = pick1(/<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '').trim();
const metaDesc = pick1(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || pick1(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
const canonical = pick1(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || pick1(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
const robotsMeta = pick1(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["']/i); const hdrs = r.headers || {}; const xRobots = String(hdrs['x-robots-tag'] || '');
const noindex = /noindex/i.test(robotsMeta) || /noindex/i.test(xRobots);
const jsonld = (body.match(/application\/ld\+json/gi) || []).length;
const text = decodeEnt(body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const words = text.split(' ').filter(Boolean).length;
const kwIn = (s) => !!kw && norm(s).includes(kw);
const live = status === 200 && !fetchErr;
const same = (a, b) => String(a || '').replace(/\/$/, '').toLowerCase() === String(b || '').replace(/\/$/, '').toLowerCase();
const checks = [
  { name: 'Page is live (HTTP 200)', ok: live, detail: fetchErr ? fetchErr : 'HTTP ' + (status || 'no response') },
  { name: 'Not blocked from indexing', ok: !noindex, detail: noindex ? 'noindex found (' + (robotsMeta || xRobots) + ')' : 'no noindex directive' },
  { name: 'Title tag uses the keyword', ok: !!title && kwIn(title), detail: title ? title.slice(0, 120) : 'no <title> found' },
  { name: 'Meta description present (50-160 characters)', ok: metaDesc.length >= 50 && metaDesc.length <= 160, detail: metaDesc ? metaDesc.length + ' characters' : 'missing' },
  { name: 'One H1 heading', ok: !!h1, detail: h1 ? h1.slice(0, 120) : 'no <h1> found' },
  { name: 'Canonical points to this URL', ok: !canonical || same(canonical, url), detail: canonical || 'no canonical tag (acceptable)' },
  { name: 'Structured data (JSON-LD) present', ok: jsonld > 0, detail: jsonld + ' block(s)' },
  { name: 'Enough content on the page', ok: words >= 600, detail: words + ' words on the whole page, menus included' }   // section 191: the article's own count is added below
];
// ---- images on the live page (content images only: no icons, logos, pixels, SVG) ----
// Section 191 (client reports 2026-11-16, devaicon.com): the images were read from the WHOLE page, so the "related articles" cards and the
// avatar of a "book a session" box counted as content images (one page passed "at least 2 images" with one real image and failed "alt text"
// on decorative alt="" thumbnails), and a page with no image at all failed six image checks for one reason. Now:
//   * the article is read: its <article>, else its <main>, else the page from its H1; a <footer>, <aside> or <nav> inside it is page chrome;
//   * an image with an empty alt inside a link, or sized under 64 pixels by its classes, is decorative (counted apart, never "without alt");
//   * no content image = ONE failed check, "Images in the article", that says what the page shows instead (a background picture, the
//     images we delivered that are not on it); the other image checks only apply to a page that has images;
//   * an image loaded from a service that serves other people's pictures (Google Images thumbnails, LinkedIn, Facebook, Instagram,
//     Pinterest, X, Bing) fails "Images hosted on your website": the client may not have the right to it and it can disappear;
//   * the images we delivered (request `delivered_images`, file names, sent by the app) are looked for on the page by file name.
// Review M1 (2026-11-16): the FIRST <article> of a page is often a card (an insight, a testimonial) on a page whose content sits in <main>. The
// region is the <article> that holds the page's H1, else the longest article (150+ words) that starts after the H1 (read from the H1, so a
// hero image between the H1 and the article counts), else the <main> that holds the H1, else the page from its H1 to "Related ..." /
// <footer>. Articles of under 150 words inside the region are cards and are left out. A hero <img> in <main> just above the article (6,000
// characters at most) is kept.
const tagWords = (x) => String(x || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const articlesOf = (h) => { const out = [], st = []; for (const m of h.matchAll(/<\/?article\b[^>]*>/gi)) { if (m[0][1] !== '/') st.push(m.index); else if (st.length) { const a = st.pop(); out.push({ start: a, end: m.index + m[0].length, inner: h.slice(h.indexOf('>', a) + 1, m.index) }); } } return out; };
const dropCards = (x) => { let y = x; for (const a of articlesOf(x).filter(a => tagWords(a.inner) < 150).sort((p, q) => q.start - p.start)) y = y.slice(0, a.start) + ' ' + y.slice(a.end); return y; };
const regionOf = (h) => {
  const h1At = h.search(/<h1\b/i); const arts = articlesOf(h);
  const mainM = h.match(/<main\b[^>]*>/i); const mainAt = mainM ? mainM.index : -1; const mainEnd = mainAt >= 0 ? (h.indexOf('</main>', mainAt) >= 0 ? h.indexOf('</main>', mainAt) : h.length) : -1;
  const lead = (at) => (mainAt >= 0 && mainAt < at && at - mainAt <= 6000 && at <= mainEnd ? mainAt + mainM[0].length : at);
  const own = h1At >= 0 ? arts.filter(a => a.start < h1At && h1At < a.end).sort((p, q) => (p.end - p.start) - (q.end - q.start))[0] : null;
  if (own) return { html: dropCards(h.slice(lead(own.start), own.end)), from: 'article' };
  const big = arts.filter(a => (h1At < 0 || a.start > h1At) && tagWords(a.inner) >= 150).sort((p, q) => tagWords(q.inner) - tagWords(p.inner))[0];
  if (big) return { html: dropCards(h.slice(h1At >= 0 ? lead(h1At) : lead(big.start), big.end)), from: 'article' };
  if (mainAt >= 0 && (h1At < 0 || (h1At > mainAt && h1At < mainEnd))) return { html: dropCards(h.slice(mainAt + mainM[0].length, mainEnd)), from: 'main' };
  const rest = h1At >= 0 ? h.slice(h1At) : h; const f = rest.search(/<footer\b|<h[23][^>]*>\s*(?:related (?:articles|posts|capabilities|guides|reading)|you may also like|read more)\b/i);
  return { html: dropCards(f > 0 ? rest.slice(0, f) : rest), from: h1At >= 0 ? 'h1' : 'body' }; };
const REG = regionOf(body);
const articleHtml = REG.html.replace(/<(footer|aside|nav)\b[\s\S]*?<\/\1>/gi, ' ');
const attrOf = (tag, a) => { const m = tag.match(new RegExp('\\s' + a + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? (m[2] != null ? m[2] : (m[3] != null ? m[3] : (m[4] || ''))) : null; };
// the opening <a ...> tag an image sits in ('' when it is in no link)
const linkOf = (h, at) => { const pre = h.slice(Math.max(0, at - 4000), at); const lo = pre.toLowerCase(); const o = lo.lastIndexOf('<a '); if (o < 0 || o < lo.lastIndexOf('</a>')) return ''; const e = pre.indexOf('>', o); return e > o ? pre.slice(o, e + 1) : pre.slice(o); };
// review L3: an empty-alt image in a link is decorative only as a card or thumbnail (its class, the link's class or the file name say so, or it
// is small); a content image linked to its own file or a lightbox (the link points at an image) is a content image without alt text
const CARDISH = /card|thumb|teaser|related|tile|excerpt|post-?image|preview/i;
const smallByClass = (cls) => { const sz = String(cls || '').split(/\s+/).map(t => (t.match(/^(?:w|h|size)-(\d+(?:\.5)?)$/) || [])[1]).filter(Boolean).map(Number); return sz.length > 0 && Math.max(...sz) <= 16; };
const imgAll = [...articleHtml.matchAll(/<img\b[^>]*>/gi)].map(m => { const t = m[0]; return { src: decodeEnt(attrOf(t, 'src') || attrOf(t, 'data-src') || ''), alt: attrOf(t, 'alt'), w: attrOf(t, 'width'), h: attrOf(t, 'height'), loading: attrOf(t, 'loading'), cls: attrOf(t, 'class') || '', at: m.index }; })
  .filter(i => i.src && !/^data:/i.test(i.src) && !/\.svg(\?|$)/i.test(i.src) && !/logo|icon|avatar|sprite|pixel|tracking|badge|flag|emoji|author|headshot|gravatar/i.test(i.src + ' ' + (i.alt || '')) && !(i.w && Number(i.w) <= 64) && !(i.h && Number(i.h) <= 64));
const decorative = imgAll.filter(i => { if (smallByClass(i.cls)) return true; if (i.alt == null || String(i.alt).trim()) return false;
  const a = linkOf(articleHtml, i.at); if (!a) return false; const href = attrOf(a, 'href') || '';
  if (/\.(?:jpe?g|png|webp|avif|gif)(?:[?#]|$)/i.test(href) || /lightbox|fancybox|data-lightbox|glightbox/i.test(a)) return false;
  return CARDISH.test(i.cls + ' ' + (attrOf(a, 'class') || '') + ' ' + i.src) || (Number(i.w) > 0 && Number(i.w) <= 400) || (Number(i.h) > 0 && Number(i.h) <= 300); });
const imgs = imgAll.filter(i => !decorative.includes(i));
const kwTok = new Set(kw.split(' ').filter(t => t.length > 2));
const noAlt = imgs.filter(i => !i.alt || !String(i.alt).trim());
const topicAlt = imgs.some(i => i.alt && (norm(i.alt).includes(kw) || norm(i.alt).split(' ').filter(t => kwTok.has(t)).length >= Math.min(2, kwTok.size)));
const generic = imgs.filter(i => /(^|\/)(img|dsc|dcim|image|photo|screenshot|screen shot|untitled|unnamed|download|[0-9a-f]{16,})[-_ ]?[0-9a-z]*\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(i.src));
const noDims = imgs.filter(i => !i.w || !i.h);
const modern = imgs.filter(i => /\.(webp|avif)(\?|$)/i.test(i.src));
const ogImage = pick1(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || pick1(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
const imgHost = (u) => (String(u || '').match(/^(?:https?:)?\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i) || [])[1] || '';
const BORROWED = [[/(^|\.)(gstatic\.com|googleusercontent\.com|ggpht\.com)$/i, 'Google Images'], [/(^|\.)licdn\.com$/i, 'LinkedIn'], [/(^|\.)(fbcdn\.net|fbsbx\.com)$/i, 'Facebook'], [/(^|\.)cdninstagram\.com$/i, 'Instagram'], [/(^|\.)pinimg\.com$/i, 'Pinterest'], [/(^|\.)twimg\.com$/i, 'X (Twitter)'], [/(^|\.)(bing\.net|bing\.com)$/i, 'Bing images']];
// review L9: a website hosted on Blogger / Google Sites (or one that keeps its own pictures on LinkedIn) serves its own images from those hosts:
// only a Google Images thumbnail (encrypted-tbn*.gstatic.com) is always someone else's; any other service is "borrowed" unless the site
// itself is built there (its generator, its domain) or most of the page's own images, logo included, come from it
const allHosts = [...body.matchAll(/<img[^>]*>/gi)].map(m => imgHost(decodeEnt(attrOf(m[0], 'src') || '')).toLowerCase()).filter(Boolean);
const generator = pick1(/<meta[^>]+name=["']generator["'][^>]*content=["']([^"']+)["']/i);
const hostedOn = (re) => /blogger|google sites/i.test(generator) && re.test('googleusercontent.com') || /\.blogspot\.com$/.test(domain) && re.test('googleusercontent.com') || (allHosts.length >= 3 && allHosts.filter(h => re.test(h)).length * 2 >= allHosts.length);
const borrowedOf = (u) => { const h = imgHost(u).toLowerCase(); if (!h || h === domain || h.endsWith('.' + domain)) return null; if (/^encrypted-tbn\d*\.gstatic\.com$/.test(h)) return { host: h, source: 'Google Images' }; const b0 = BORROWED.find(([re]) => re.test(h)); if (b0 && hostedOn(b0[0])) return null; const b = BORROWED.find(([re]) => re.test(h)); return b ? { host: h, source: b[1] } : null; };
const borrowed = imgs.map(i => ({ i, b: borrowedOf(i.src) })).filter(x => x.b);
// the hero a theme paints as a CSS background (style="background-image:url(...)") in the page's main part, before the article text
const bgZone = (() => { const h1At = body.search(/<h1\b/i); if (h1At < 0) return ''; const m0 = body.search(/<main\b/i); return body.slice(m0 >= 0 && m0 < h1At ? m0 : Math.max(0, h1At - 6000), h1At + 1500); })();
const bgUrl = ([...bgZone.matchAll(/background-image\s*:\s*url\(\s*(?:&quot;|["'])?([^"')&]+(?:&amp;[^"')&]+)*)(?:&quot;|["'])?\s*\)/gi)].map(m => decodeEnt(m[1]).trim()).find(u => u && !/^data:/i.test(u) && !/\.svg(\?|$)/i.test(u)) || '');
const bgBorrowed = bgUrl ? borrowedOf(bgUrl) : null;
// the images we delivered with the page, by file name
const fileOf = (u) => decodeEnt(String(u || '')).replace(/[?#].*$/, '').split('/').pop().toLowerCase();
const sentImgs = (Array.isArray(d.delivered_images) ? d.delivered_images : []).map(x => fileOf(x)).filter(x => /\.[a-z0-9]{3,4}$/.test(x)).slice(0, 10);
// review L8: a CMS renames uploads (WordPress "name-1024x576.webp", "-scaled", "-e1699999999", "-1"; hash suffixes), so a file is matched by
// its stem: equal stems = on the page; one stem inside the other, or 80% of their words shared = "probably ours"
const stemOf = (f) => String(f || '').toLowerCase().replace(/\.[a-z0-9]{2,5}$/, '').replace(/-\d{2,5}x\d{2,5}$/, '').replace(/-(?:scaled|e\d{6,}|\d{1,2})$/, '').replace(/[-_.][0-9a-f]{6,}$/, '').replace(/-\d{2,5}x\d{2,5}$/, '');
const pageStems = [...new Set([...body.matchAll(/(?:src|srcset|data-src|href|content)\s*=\s*["']([^"']+)["']/gi)].flatMap(m => m[1].split(',').map(x => fileOf(x.trim().split(/\s+/)[0]))).filter(f => /\.(?:jpe?g|png|webp|avif|gif)$/.test(f)).map(stemOf).filter(x => x.length >= 4))];
const near = (a, b) => { if (a.length >= 8 && b.length >= 8 && (a.includes(b) || b.includes(a))) return true; const A = a.split(/[-_]+/).filter(Boolean), B = new Set(b.split(/[-_]+/).filter(Boolean)); return A.length >= 3 && A.filter(w => B.has(w)).length / Math.max(A.length, B.size) >= 0.8; };
const sentOnPage = sentImgs.filter(f => pageStems.includes(stemOf(f)));
const sentProbably = sentImgs.filter(f => !sentOnPage.includes(f) && pageStems.some(p => near(stemOf(f), p)));
const delivered = { sent: sentImgs.length, on_page: sentOnPage.length, probably: sentProbably.length, missing: sentImgs.filter(f => !sentOnPage.includes(f) && !sentProbably.includes(f)) };
const advice = [];
if (bgUrl) advice.push('The top picture of the page is a background set by the page style' + (bgBorrowed ? ', loaded from ' + bgBorrowed.source + ' (' + bgBorrowed.host + ')' : '') + ': search engines do not read it as an image and it cannot carry alt text');
if (delivered.sent && delivered.missing.length === delivered.sent) advice.push('We could not find any of the ' + delivered.sent + ' images we made for this page on it: they are ready to upload, with their alt text, in the page\'s report');
else if (delivered.sent && delivered.missing.length) advice.push('We found ' + (delivered.sent - delivered.missing.length) + ' of the ' + delivered.sent + ' images we made for this page on it' + (delivered.probably ? ' (' + delivered.probably + ' under another file name, probably ours)' : ''));
const images = { count: imgs.length, decorative: decorative.length, without_alt: noAlt.length, topic_in_alt: topicAlt, generic_names: generic.map(i => i.src.split('/').pop()).slice(0, 5), without_dimensions: noDims.length, modern_format: modern.length, og_image: ogImage || '',
  read_from: REG.from, background: bgUrl ? { url: bgUrl.slice(0, 300), ...(bgBorrowed || {}) } : null, borrowed: borrowed.map(x => ({ src: x.i.src.slice(0, 300), host: x.b.host, source: x.b.source })).slice(0, 5), delivered, advice };
if (!imgs.length) {
  checks.push({ name: 'Images in the article', ok: false, detail: 'No images in the article' + (decorative.length ? ' (' + decorative.length + ' small or decorative picture' + (decorative.length === 1 ? '' : 's') + ' not counted)' : '') + (advice.length ? '. ' + advice.join('. ') : '') });
} else {
  checks.push(
    { name: 'At least 2 content images', ok: imgs.length >= 2, detail: imgs.length + ' content image(s) in the article' + (decorative.length ? ' (' + decorative.length + ' decorative not counted)' : '') + (delivered.sent && delivered.missing.length ? '. ' + advice[advice.length - 1] : '') },
    { name: 'Every image has alt text', ok: !noAlt.length, detail: noAlt.length ? noAlt.length + ' image(s) without alt text' : 'all ' + imgs.length + ' have alt text' },
    { name: 'An image alt text names the topic', ok: topicAlt, detail: topicAlt ? 'yes' : 'none of the alt texts mentions "' + kw + '"' },
    { name: 'Descriptive image file names', ok: !generic.length, detail: generic.length ? generic.map(i => i.src.split('/').pop()).slice(0, 3).join(', ') : 'ok' },
    { name: 'Images carry width and height', ok: !noDims.length, detail: noDims.length ? noDims.length + ' image(s) without width/height (layout shift)' : 'ok' },
    { name: 'Modern image format (WebP / AVIF)', ok: modern.length >= Math.ceil(imgs.length / 2), detail: modern.length + ' of ' + imgs.length + ' in WebP/AVIF' });
  if (borrowed.length) checks.push({ name: 'Images hosted on your website', ok: false, detail: borrowed.length + ' image(s) loaded from ' + [...new Set(borrowed.map(x => x.b.source))].join(', ') + ' (' + [...new Set(borrowed.map(x => x.b.host))].slice(0, 2).join(', ') + '): use your own image, which you have the right to publish' });
}
checks.push({ name: 'Open Graph image for sharing', ok: /^https?:\/\//i.test(ogImage), detail: ogImage ? ogImage.slice(0, 100) : 'no og:image tag' });
// ---- v4.4: E-E-A-T, hub, local and video checks — only where they apply to this page ----
const ld = []; for (const m of body.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) { try { const j = JSON.parse(m[1].trim()); const arr = Array.isArray(j) ? j : (j['@graph'] ? j['@graph'] : [j]); ld.push(...arr.filter(x => x && typeof x === 'object')); } catch (e) {} }
const typesOf = (x) => [].concat(x['@type'] || []).map(String);
const ldTypes = ld.flatMap(typesOf);
const findLd = (re) => ld.find(x => typesOf(x).some(y => re.test(y)));
const pageType = String((log || {}).page_type || (ladder || {}).page_type || '').toLowerCase();
const isArticle = /blog|guide|article|pillar|hub|case stud/.test(pageType) || ldTypes.some(y => /^(Article|BlogPosting|NewsArticle|TechArticle)$/.test(y));
const extra = [];
if (isArticle) {
  const art = findLd(/^(Article|BlogPosting|NewsArticle|TechArticle)$/) || {};
  const authorLd = [].concat(art.author || []).map(a => (a && a.name) || '').filter(n => n && !/^\[/.test(n));
  const person = findLd(/^Person$/);
  const bylineHtml = /rel=["']author["']|class=["'][^"']*\b(author|byline)\b/i.test(body);
  const byText = text.slice(0, 4000).match(/\bBy\s+([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+){1,3})/);
  const authorName = authorLd[0] || (person && person.name && !/^\[/.test(person.name) ? person.name : '') || (byText ? byText[1] : '');
  extra.push({ name: 'Author named (byline and Person schema)', ok: !!authorName && (bylineHtml || !!byText) && (!!person || authorLd.length > 0), detail: authorName ? authorName + (person ? ' · Person schema' : authorLd.length ? ' · author in Article schema' : ' · no author in the schema') + (bylineHtml || byText ? ' · byline' : ' · no visible byline') : 'no author on the page (add the byline, author box and Person schema from the blog package)' });
  const dated = /<time\b/i.test(body) || !!(art.dateModified || art.datePublished) || /\b(updated|published|last reviewed)\b[^.]{0,20}\d{4}/i.test(text.slice(0, 5000));
  extra.push({ name: 'Date shown (published or updated)', ok: dated, detail: art.dateModified ? 'dateModified ' + String(art.dateModified).slice(0, 10) : art.datePublished ? 'datePublished ' + String(art.datePublished).slice(0, 10) : dated ? 'date on the page' : 'no date found' });
  const insight = (text.match(/\[Author insight:[^\]]*\]/gi) || []).length + (text.match(/\[(Author Name|Job title|Two-sentence bio)[^\]]*\]/gi) || []).length;
  if (insight) extra.push({ name: 'No author placeholders left', ok: false, detail: insight + ' [bracketed] author line(s) still on the page' });
}
const isHub = /pillar|hub/.test(pageType) || Number((ladder || {}).rung) === 4;
if (isHub) {
  const jump = (body.match(/href=["']#[a-z0-9][^"']*["']/gi) || []).length;
  extra.push({ name: 'Table of contents with jump links', ok: jump >= 3, detail: jump + ' in-page link(s)' });
  if (ladder) { const sibs = ladders.filter(l => normD(l.domain) === domain && l.ladder_id === ladder.ladder_id && l.keyword !== ladder.keyword && l.target_url);
    const linked = sibs.filter(l => { const p = String(l.target_url).replace(/^https?:\/\/[^\/]+/i, '').replace(/\/$/, ''); return p && new RegExp('href=["\'](https?:\\/\\/[^"\']*)?' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\/?["\'#?]', 'i').test(body); });
    const liveSibs = sibs.filter(l => l.status === 'published' || l.page_exists === true || l.page_exists === 'true');
    extra.push({ name: 'Links down to the cluster pages', ok: liveSibs.every(l => linked.includes(l)) && linked.length >= Math.min(3, sibs.length), detail: 'links to ' + linked.length + ' of ' + sibs.length + ' ladder pages (' + liveSibs.length + ' live)' + (liveSibs.filter(l => !linked.includes(l)).length ? '; missing: ' + liveSibs.filter(l => !linked.includes(l)).map(l => l.keyword).slice(0, 4).join(', ') : '') }); }
}
const lbLocal = ld.find(x => typesOf(x).some(y => y !== 'Service' && /(LocalBusiness|Store|Restaurant|AccountingService|LegalService|FinancialService|MedicalBusiness|RealEstateAgent|HomeAndConstructionBusiness|ProfessionalService|FoodEstablishment)$/.test(y)));
if (/local/.test(pageType) || lbLocal) {
  const L = lbLocal || {}; const ad = L.address || {}; const tel = String(L.telephone || '');
  const filled = (v) => !!String(v || '').trim() && !/^\[/.test(String(v).trim());
  extra.push({ name: 'LocalBusiness schema with address and phone', ok: !!lbLocal && filled(tel) && filled(ad.streetAddress) && filled(ad.addressLocality), detail: lbLocal ? typesOf(L).join('/') + ' · phone ' + (filled(tel) ? tel : 'missing') + ' · address ' + (filled(ad.streetAddress) ? [ad.streetAddress, ad.addressLocality].filter(Boolean).join(', ') : 'missing') : 'no LocalBusiness schema' });
  const digits = tel.replace(/\D/g, '').slice(-8); const pageDigits = text.replace(/\D/g, '');
  extra.push({ name: 'Phone number visible on the page', ok: digits.length >= 7 && pageDigits.includes(digits), detail: digits.length >= 7 ? (pageDigits.includes(digits) ? 'the schema phone appears in the text' : 'the schema phone ' + tel + ' is not in the page text (NAP must match)') : 'no phone in the schema to compare' });
}
const hasVideo = /<iframe[^>]+(youtube(-nocookie)?\.com|youtu\.be|player\.vimeo\.com)/i.test(body) || /<video\b/i.test(body);
if (hasVideo) {
  const vo = findLd(/^VideoObject$/) || {};
  const okV = !!vo.name && [].concat(vo.thumbnailUrl || []).some(u => /^https?:\/\//.test(String(u))) && /^\d{4}-\d{2}-\d{2}/.test(String(vo.uploadDate || ''));
  extra.push({ name: 'VideoObject schema (name, thumbnail, upload date)', ok: okV, detail: findLd(/^VideoObject$/) ? ('thumbnail ' + ([].concat(vo.thumbnailUrl || []).length ? 'yes' : 'missing') + ' · upload date ' + (vo.uploadDate || 'missing') + (vo.duration ? ' · duration ' + vo.duration : '')) : 'video embedded but no VideoObject schema' });
  extra.push({ name: 'Video transcript on the page', ok: /transcript/i.test(text) && text.length > 3000, detail: /transcript/i.test(text) ? 'transcript section found' : 'no transcript found (add it under the video)' });
}
checks.push(...extra);
// 2026-10-23 (techand.ai on production): a draft the quality check refused is finished by hand, published, then reported here. The
// author check above sees only author brackets, so a live page still showing "[Price]" or "[Confirm: ...]" passed. The page's own
// content (its <article>, else <main>, else the body) is read with the one placeholder detector that Content QA and the app use (PH).
/*__PLACEHOLDERS__*/
const mainHtml = (body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) || body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || [null, body])[1];
const mainText = mainHtml.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;|&#xa0;/gi, ' ').replace(/\s+/g, ' ');
const AUTHOR_TOK = /^\[(?:author insight:|author name|job title|two-sentence bio)/i;   // counted by the author check above
const NOT_A_GAP = /^\[email\s+protected\]$/i;   // Cloudflare's e-mail obfuscation, on many live sites
const leftover = PH.scan(mainText).items.filter(x => !NOT_A_GAP.test(x.token) && !(isArticle && AUTHOR_TOK.test(x.token)));
const leftoverN = leftover.reduce((n, x) => n + x.count, 0);
checks.push({ name: 'No brackets left to fill in', ok: leftoverN === 0, detail: leftoverN ? leftoverN + ' still on the page: ' + leftover.slice(0, 5).map(x => (x.token.length > 60 ? x.token.slice(0, 56) + '...]' : x.token)).join(', ') : 'none found' });
// section 191: the article's own words (one count a person can compare with the grade's), and its tables: how many and the text of each row
// (the live grade puts back as a table a row the page reader flattened into a line)
const articleWords = articleHtml.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').split(/\s+/).filter(Boolean).length;
{ const c0 = checks.find(c => c.name === 'Enough content on the page'); if (c0 && REG.from !== 'body') c0.detail = articleWords + ' words in the article (' + c0.detail + ')'; }
const tableHtml = [...REG.html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map(m => m[0]);
const tableRows = tableHtml.flatMap(t => [...t.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map(r => decodeEnt(r[0].replace(/<\/t[dh]>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()).filter(x => x.split(' ').length >= 3)).slice(0, 60).map(x => x.slice(0, 160));
const page_signals = { article: isArticle, hub: isHub, local: !!(/local/.test(pageType) || lbLocal), video: hasVideo, schema_types: [...new Set(ldTypes)].slice(0, 15), article_words: articleWords, tables: tableHtml.length, table_rows: tableRows };
const checksOut = checks.map((c, i) => ({ ...c, ok: live ? c.ok : (i === 0 ? false : null) }));
// ---- link suggestions ----
const kwTokens = new Set(kw.split(' ').filter(t => t.length > 2));
const sq = qh.filter(q => normD(q.domain) === domain && q.page); const latest = sq.reduce((m, q) => String(q.period_end) > m ? String(q.period_end) : m, '');
const pageScore = new Map();
for (const q of sq) { if (String(q.period_end) !== latest) continue; const p = String(q.page); if (same(p, url)) continue;
  const toks = norm(p.replace(/^https?:\/\/[^\/]+/, '')).split(' ').filter(Boolean); const overlap = toks.filter(t => kwTokens.has(t)).length;
  const s = pageScore.get(p) || { page: p, impressions: 0, overlap: 0 }; s.impressions += Number(q.impressions) || 0; s.overlap = Math.max(s.overlap, overlap); pageScore.set(p, s); }
const link_from = [...pageScore.values()].sort((a, b) => (b.overlap - a.overlap) || (b.impressions - a.impressions)).slice(0, 5).map(s => ({ page: s.page, impressions: s.impressions, related: s.overlap > 0, ladder: false }));
if (ladder) for (const l of ladders.filter(l => normD(l.domain) === domain && l.ladder_id === ladder.ladder_id && l.keyword !== ladder.keyword && l.target_url && (l.status === 'published' || l.page_exists)).slice(0, 3)) if (!link_from.some(x => same(x.page, l.target_url))) link_from.unshift({ page: l.target_url, impressions: 0, related: true, ladder: true });
// ---- rows (v4.8: the same builder as the Site Tracker's publish detection, so reported and detected pages are stored alike) ----
/*__PUBLISH_ROWS__*/
const keyword = (log || ladder || {}).keyword || String(d.keyword || '').trim() || kw;
// 2026-10-27 (techand.ai on production): HTTP 200 proves the address answers, not that the draft is on it. A new draft reported at an
// older, different page, and a refresh reported before it was applied, were both marked published, and one address became the page of
// two keywords. The live page must be shown to BE the draft (its keyword in the title / main heading, the draft's own title, or for a
// new page the keyword in its text) and the address must not be another keyword's published page (v5/code/_publish_verify.js).
/*__PUBLISH_VERIFY__*/
/*__LADDER_RULES__*/
const h1Words = (body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [null, ''])[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const verifyText = mainHtml.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<(h[1-6]|p|li|td|th|div|section|br|dt|dd)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ');
const confirmMismatch = d.confirm_mismatch === true || String(d.confirm_mismatch) === 'true';
// production 2026-11-10: how the page this draft updates answers now, read without following redirects (a permanent redirect to this address is
// the move done right). Not read (no planned update, the step did not run, or another address was read) is null: the rule is then as before.
const oldAddr = (() => { const want = String((log || {}).existing_page_url || '').trim(); if (!want) return null; let o0 = null;
  try { o0 = ($('Fetch Updated Address').first() || {}).json || null; } catch (e) { o0 = null; }
  if (!o0 || o0.error) return null; const st = Number(o0.statusCode != null ? o0.statusCode : o0.status) || 0; if (!st) return null;
  const H = o0.headers || {}; const loc = String(H.location || H.Location || '').trim(); return { status: st, location: loc }; })();
const V = live ? verifyPublished({ keyword, url, title, h1: h1Words, text: verifyText, draft: { title: String(d.draft_title || '').slice(0, 300), h1: String(d.draft_h1 || '').slice(0, 300) }, log, ladder, logs, ladders, domain, confirm: confirmMismatch, now, redirect: oldAddr })
  : { verified: false, verify: 'not_live', accepted: false, confirmed: false, confirmable: false, message: '', missing: [], note: '', evidence: null, publish_note: '' };
// INVARIANTS rule 4: the proof is HTTP 200 from this very URL in this run AND the page shown to be the draft (or the owner's confirmation
// after the warning, stored with its reason). Without it nothing here says the page exists.
const recorded_live = live && V.accepted === true;
// LADDER PACKAGE (2026-11-09, rule 1): the addresses other searches of this website already hold, so a rung is never moved onto one of them
const ownersPC = [...onSite.filter(l => l.target_url && String(l.status || '') !== 'merged' && (String(l.status || '') === 'published' || l.page_exists === true || l.page_exists === 'true')).map(l => ({ url: l.target_url, keyword: l.keyword, supporting: l.supporting, ladder_id: l.ladder_id })),
  ...logs.filter(l => normD(l.domain) === domain && String(l.published_url || '').trim() && !String(l.existing_page_url || '').trim()).map(l => ({ url: l.published_url, keyword: l.keyword, ladder_id: l.ladder_id || '' }))];   // review M2
const { log_row, ladder_row, url_conflict } = publishedRows({ site_id, domain, keyword, url, log, ladder, request_id: rid, now, live: recorded_live, owners: ownersPC });
if (url_conflict) checksOut.push({ name: 'One search, one page', ok: false, detail: url_conflict.text + '. Publish this page at its own address, or keep it as a section of that page.' });
if (recorded_live && (V.publish_note || (log && log.publish_note))) log_row.publish_note = V.publish_note;   // the reason a page was marked without a match, cleared by a verified report
const checksFinal = checksOut; const passed = checksFinal.filter(c => c.ok === true).length; const failed = checksFinal.filter(c => c.ok === false);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const path = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '') || '/';
const summary = (live && !recorded_live) ? ('Not marked published. ' + V.message) : live ? ((V.confirmed ? 'Marked published as you confirmed (the page did not match the draft). ' : 'Recorded. ') + passed + ' of ' + checksFinal.length + ' checks passed' + (failed.length ? '. Fix: ' + failed.map(c => c.name.toLowerCase()).join('; ') : '') + '.' + (V.note ? ' ' + V.note : '')) : ('Recorded, but the page could not be fetched (' + (fetchErr || 'HTTP ' + status) + '). Make sure it is public; the Site Tracker checks it again in this website\'s next weekly report.');
const mark = (c) => c.ok === true ? 'OK' : c.ok === false ? 'FIX' : '--';
const plain = summary + '\n\n' + checksFinal.map(c => '[' + mark(c) + '] ' + c.name + ': ' + c.detail).join('\n') + (live && !recorded_live ? '' : (link_from.length ? '\n\nAdd a link to the new page from: ' + link_from.map(l => path(l.page)).join(', ') : '') + '\n\nNext: the Site Tracker\'s next weekly report says whether Google indexed the page, with its first impressions and positions' + (ladder ? '; the Rank Tracker follows its ladder position' : '') + '.');
const html = '<p><b>' + esc(keyword) + '</b> → <a href="' + esc(url) + '">' + esc(url) + '</a></p><p>' + esc(summary) + '</p><ul>' + checksFinal.map(c => '<li>' + (c.ok === true ? '✅' : c.ok === false ? '❌' : '⏸') + ' ' + esc(c.name) + ' — ' + esc(c.detail) + '</li>').join('') + '</ul>' +
  (link_from.length && !(live && !recorded_live) ? '<p><b>Add a link to the new page from:</b> ' + link_from.map(l => '<a href="' + esc(l.page) + '">' + esc(path(l.page)) + '</a>' + (l.ladder ? ' (ladder page)' : l.related ? ' (related)' : ' (high traffic)')).join(', ') + '</p>' : '') +
  (live && !recorded_live ? '' : '<p>Next: the Site Tracker\'s next weekly report says whether Google indexed the page, with its first impressions and positions' + (ladder ? '; the Rank Tracker follows its ladder position' : '') + '.</p>');
return [{ json: { ...d, keyword, published_url: url, live, recorded_live, verified: V.verified, verify: V.verify, verify_message: V.message, verify_missing: V.missing, verify_note: V.note, verify_evidence: V.evidence, confirmable: V.confirmable, confirmed: V.confirmed, http_status: status, fetch_error: fetchErr, checks: checksFinal, images, page_signals, passed, failed: failed.map(c => c.name), link_from, log_row, ladder_row, ladder_found: !!ladder, log_found: !!log,
  page_title: title, page_h1: h1, page_meta_description: metaDesc, canonical, jsonld_blocks: jsonld, words, summary, plain, html, subject: (live && !recorded_live ? '[Not marked published] ' + keyword + ' on ' + domain + ': check the address' : '[Published] ' + keyword + ' on ' + domain + ' — ' + (live ? passed + '/' + checksFinal.length + ' checks passed' : 'page not reachable yet')), status: 'completed', stage: 'published' } }];
