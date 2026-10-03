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
const ladder = kw ? (ladders.find(l => normD(l.domain) === domain && norm(l.keyword) === kw) || null) : null;
// ---- live checks ----
const bodyOf = (r) => { const b = r && (r.body != null ? r.body : r.data); return typeof b === 'string' ? b : (b ? JSON.stringify(b) : ''); };   // the HTTP node puts text responses under `data` (live finding 2026-10-02)
const status = Number(r.statusCode) || 0; const body = bodyOf(r);
const fetchErr = r.error ? String(r.error.message || r.error.description || r.error).slice(0, 160) : null;
const pick1 = (re) => { const x = body.match(re); return x ? x[1].replace(/\s+/g, ' ').trim() : ''; };
const title = pick1(/<title[^>]*>([\s\S]*?)<\/title>/i);
const h1 = pick1(/<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '').trim();
const metaDesc = pick1(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || pick1(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
const canonical = pick1(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || pick1(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
const robotsMeta = pick1(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["']/i); const hdrs = r.headers || {}; const xRobots = String(hdrs['x-robots-tag'] || '');
const noindex = /noindex/i.test(robotsMeta) || /noindex/i.test(xRobots);
const jsonld = (body.match(/application\/ld\+json/gi) || []).length;
const text = body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
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
  { name: 'Enough content on the page', ok: words >= 600, detail: words + ' words (navigation included)' }
];
// ---- images on the live page (content images only: no icons, logos, pixels, SVG) ----
const attrOf = (tag, a) => { const m = tag.match(new RegExp('\\s' + a + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? (m[2] != null ? m[2] : (m[3] != null ? m[3] : (m[4] || ''))) : null; };
const imgs = [...body.matchAll(/<img\b[^>]*>/gi)].map(m => { const t = m[0]; return { src: attrOf(t, 'src') || attrOf(t, 'data-src') || '', alt: attrOf(t, 'alt'), w: attrOf(t, 'width'), h: attrOf(t, 'height'), loading: attrOf(t, 'loading') }; })
  .filter(i => i.src && !/^data:/i.test(i.src) && !/\.svg(\?|$)/i.test(i.src) && !/logo|icon|avatar|sprite|pixel|tracking|badge|flag|emoji|author|headshot|gravatar/i.test(i.src + ' ' + (i.alt || '')) && !(i.w && Number(i.w) <= 64) && !(i.h && Number(i.h) <= 64));
const kwTok = new Set(kw.split(' ').filter(t => t.length > 2));
const noAlt = imgs.filter(i => !i.alt || !String(i.alt).trim());
const topicAlt = imgs.some(i => i.alt && (norm(i.alt).includes(kw) || norm(i.alt).split(' ').filter(t => kwTok.has(t)).length >= Math.min(2, kwTok.size)));
const generic = imgs.filter(i => /(^|\/)(img|dsc|dcim|image|photo|screenshot|screen shot|untitled|unnamed|download|[0-9a-f]{16,})[-_ ]?[0-9a-z]*\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(i.src));
const noDims = imgs.filter(i => !i.w || !i.h);
const modern = imgs.filter(i => /\.(webp|avif)(\?|$)/i.test(i.src));
const ogImage = pick1(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || pick1(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
const images = { count: imgs.length, without_alt: noAlt.length, topic_in_alt: topicAlt, generic_names: generic.map(i => i.src.split('/').pop()).slice(0, 5), without_dimensions: noDims.length, modern_format: modern.length, og_image: ogImage || '' };
checks.push(
  { name: 'At least 2 content images', ok: imgs.length >= 2, detail: imgs.length + ' content image(s) found' },
  { name: 'Every image has alt text', ok: imgs.length > 0 && !noAlt.length, detail: imgs.length ? (noAlt.length ? noAlt.length + ' image(s) without alt text' : 'all ' + imgs.length + ' have alt text') : 'no images' },
  { name: 'An image alt text names the topic', ok: topicAlt, detail: topicAlt ? 'yes' : 'none of the alt texts mentions "' + kw + '"' },
  { name: 'Descriptive image file names', ok: imgs.length > 0 && !generic.length, detail: generic.length ? generic.map(i => i.src.split('/').pop()).slice(0, 3).join(', ') : (imgs.length ? 'ok' : 'no images') },
  { name: 'Images carry width and height', ok: imgs.length > 0 && !noDims.length, detail: noDims.length ? noDims.length + ' image(s) without width/height (layout shift)' : (imgs.length ? 'ok' : 'no images') },
  { name: 'Modern image format (WebP / AVIF)', ok: imgs.length > 0 && modern.length >= Math.ceil(imgs.length / 2), detail: modern.length + ' of ' + imgs.length + ' in WebP/AVIF' },
  { name: 'Open Graph image for sharing', ok: /^https?:\/\//i.test(ogImage), detail: ogImage ? ogImage.slice(0, 100) : 'no og:image tag' }
);
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
const page_signals = { article: isArticle, hub: isHub, local: !!(/local/.test(pageType) || lbLocal), video: hasVideo, schema_types: [...new Set(ldTypes)].slice(0, 15) };
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
// ---- the rows a published page leaves (v4.8, PIPELINE_FEATURE_SPEC §6.5). ONE copy, inlined by the build into Publish Check ("I published a
// page", main workflow) and Detect Published (Site Tracker, publish detection), so a reported page and a detected page are stored identically.
//   log_row    seo_content_log, upsert by site_id + keyword, exactly the table columns: the written page's row (source, page type, rung, ladder,
//              request id and start date kept) with status published, the live URL and now; without a written row, a new one (source ladder / manual)
//   ladder_row seo_ladders, update by ladder_id + keyword: status published, target_url = the live URL, page_exists true (null when no ladder row)
// o: { site_id, domain, keyword, url, log (content-log row or null), ladder (ladder row or null), request_id, now (ISO) }
function publishedRows(o) {
  const log = o.log || null, ladder = o.ladder || null, now = o.now;
  const log_row = { site_id: o.site_id, domain: o.domain, keyword: o.keyword, source: (log || {}).source || (ladder ? 'ladder' : 'manual'), page_type: (log || {}).page_type || (ladder ? (ladder.page_type || '') : ''), existing_page_url: (log || {}).existing_page_url || '', rung: Number((log || ladder || {}).rung) || 0,
    ladder_id: (log || ladder || {}).ladder_id || '', request_id: (log || {}).request_id || o.request_id || '', started_at: (log || {}).started_at || now, status: 'published', published_url: o.url, published_at: now, week: now.slice(0, 10) };
  const ladder_row = ladder ? { ladder_id: ladder.ladder_id, keyword: ladder.keyword, status: 'published', target_url: o.url, page_exists: true } : null;
  return { log_row, ladder_row };
}
const keyword = (log || ladder || {}).keyword || String(d.keyword || '').trim() || kw;
const { log_row, ladder_row } = publishedRows({ site_id, domain, keyword, url, log, ladder, request_id: rid, now });
const checksFinal = checksOut; const passed = checksFinal.filter(c => c.ok === true).length; const failed = checksFinal.filter(c => c.ok === false);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const path = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '') || '/';
const summary = live ? ('Recorded. ' + passed + ' of ' + checksFinal.length + ' checks passed' + (failed.length ? '. Fix: ' + failed.map(c => c.name.toLowerCase()).join('; ') : '') + '.') : ('Recorded, but the page could not be fetched (' + (fetchErr || 'HTTP ' + status) + '). Make sure it is public; the Site Tracker checks it again on Monday.');
const mark = (c) => c.ok === true ? 'OK' : c.ok === false ? 'FIX' : '--';
const plain = summary + '\n\n' + checksFinal.map(c => '[' + mark(c) + '] ' + c.name + ': ' + c.detail).join('\n') + (link_from.length ? '\n\nAdd a link to the new page from: ' + link_from.map(l => path(l.page)).join(', ') : '') + '\n\nNext: the Site Tracker reports on Monday whether Google indexed the page, with its first impressions and positions' + (ladder ? '; the Rank Tracker follows its ladder position' : '') + '.';
const html = '<p><b>' + esc(keyword) + '</b> → <a href="' + esc(url) + '">' + esc(url) + '</a></p><p>' + esc(summary) + '</p><ul>' + checksFinal.map(c => '<li>' + (c.ok === true ? '✅' : c.ok === false ? '❌' : '⏸') + ' ' + esc(c.name) + ' — ' + esc(c.detail) + '</li>').join('') + '</ul>' +
  (link_from.length ? '<p><b>Add a link to the new page from:</b> ' + link_from.map(l => '<a href="' + esc(l.page) + '">' + esc(path(l.page)) + '</a>' + (l.ladder ? ' (ladder page)' : l.related ? ' (related)' : ' (high traffic)')).join(', ') + '</p>' : '') +
  '<p>Next: the Site Tracker reports on Monday whether Google indexed the page, with its first impressions and positions' + (ladder ? '; the Rank Tracker follows its ladder position' : '') + '.</p>';
return [{ json: { ...d, keyword, published_url: url, live, http_status: status, fetch_error: fetchErr, checks: checksFinal, images, page_signals, passed, failed: failed.map(c => c.name), link_from, log_row, ladder_row, ladder_found: !!ladder, log_found: !!log,
  page_title: title, page_h1: h1, page_meta_description: metaDesc, canonical, jsonld_blocks: jsonld, words, summary, plain, html, subject: '[Published] ' + keyword + ' on ' + domain + ' — ' + (live ? passed + '/' + checksFinal.length + ' checks passed' : 'page not reachable yet'), status: 'completed', stage: 'published' } }];
