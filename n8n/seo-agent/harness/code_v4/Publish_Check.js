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
// 2026-10-23 (techand.ai on production): a draft the quality check refused is finished by hand, published, then reported here. The
// author check above sees only author brackets, so a live page still showing "[Price]" or "[Confirm: ...]" passed. The page's own
// content (its <article>, else <main>, else the body) is read with the one placeholder detector that Content QA and the app use (PH).
// ---- placeholder kit (A-13, 2026-10-17; inlined through the PLACEHOLDERS marker) ----
// ONE answer to "what in this page is still a bracket somebody has to fill in or confirm?", shared by Content QA (the count, the gate,
// the reasons), the app's article view and its delivery rule (app/shared/src/placeholders.ts carries the same two patterns, and the
// build asserts they are byte-identical). Live (exec 771) the delivered body said "a fixed [Price band: typical Assess & Envision fee in
// AED]" while QA reported `placeholder_count 0`, `open_brackets []`: the pattern counted a bracket only when it held no colon, and the
// colon form was assumed to be one of OUR review notes — but a writer invents its own labels. Now:
//   * a bracket that is a Markdown link or image (`[text](url)`, `![alt](src)`), a checkbox (`[ ]`, `[x]`), a footnote (`[^1]`) or a
//     number (`[1]`) is not a gap;
//   * a review note is one of the CLOSED list of labels the prompts and QA themselves emit — `[Confirm: …]`, `[Owner: …]`,
//     `[Author insight: …]`, `[Image: …]` — and is reported as a note;
//   * every other bracket that starts with a letter is a placeholder, whatever its case or punctuation: `[Price]`, `[name, role]`,
//     `[date]`, `[Price band: typical … fee in AED]`, `[Insert client logo]`.
// Regex only (the n8n Code sandbox has no URL constructor).
const PH = (() => {
  const BRACKET_SRC = "(?<![!\\\\])\\[(\\p{L}[^\\[\\]\\n]{0,399})\\](?![(:])";
  const NOTE_SRC = "^(?:confirm|owner|author insight|image)\\s*:";
  // CT-FIX (review item 11, 2026-10-22): code is read as code ("`labels[sensitivity]`" is an index, not a gap); a bracket starts with a
  // letter of any script ("[السعر]" is a placeholder, it passed before); an edit or date label and an editor's "[sic]" are not gaps.
  const CODE_SRC = "```[\\s\\S]*?```|~~~[\\s\\S]*?~~~|`[^`\\n]+`";
  const NOT_GAP_SRC = "^(?:sic!?|emphasis (?:added|mine|ours)|(?:last )?(?:updated|revised|edited|reviewed|published)\\b[^\\]]*\\d{4}|(?:19|20)\\d\\d)$";
  const bracketRe = () => new RegExp(BRACKET_SRC, 'gu');
  const NOTE_RE = new RegExp(NOTE_SRC, 'i');
  const NOT_GAP_RE = new RegExp(NOT_GAP_SRC, 'i');
  const noCode = (t) => t.replace(new RegExp(CODE_SRC, 'g'), ' ');
  // one pass over the text: { placeholders: [{token, count}], notes: [{token, count}], placeholder_count, note_count, items: [...] }
  const scan = (text) => {
    const t = noCode(String(text == null ? '' : text));
    const ph = new Map(), nt = new Map();
    for (const m of t.matchAll(bracketRe())) {
      const inner = m[1].trim(); if (!inner) continue;
      if (/^x$/i.test(inner) || NOT_GAP_RE.test(inner)) continue;   // a ticked checkbox, [sic], [Updated 2026]
      const tok = '[' + m[1] + ']';
      const into = NOTE_RE.test(inner) ? nt : ph;
      into.set(tok, (into.get(tok) || 0) + 1);
    }
    const list = (mp) => [...mp.entries()].map(x => ({ token: x[0], count: x[1] })).sort((a, b) => b.count - a.count);
    const placeholders = list(ph), notes = list(nt);
    return { placeholders, notes, placeholder_count: placeholders.reduce((s, x) => s + x.count, 0), note_count: notes.reduce((s, x) => s + x.count, 0),
      items: placeholders.map(p => ({ ...p, kind: 'placeholder' })).concat(notes.map(n => ({ ...n, kind: 'review_note' }))) };
  };
  return { BRACKET_SRC, NOTE_SRC, CODE_SRC, NOT_GAP_SRC, bracketRe, NOTE_RE, scan };
})();
const mainHtml = (body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) || body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || [null, body])[1];
const mainText = mainHtml.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;|&#xa0;/gi, ' ').replace(/\s+/g, ' ');
const AUTHOR_TOK = /^\[(?:author insight:|author name|job title|two-sentence bio)/i;   // counted by the author check above
const NOT_A_GAP = /^\[email\s+protected\]$/i;   // Cloudflare's e-mail obfuscation, on many live sites
const leftover = PH.scan(mainText).items.filter(x => !NOT_A_GAP.test(x.token) && !(isArticle && AUTHOR_TOK.test(x.token)));
const leftoverN = leftover.reduce((n, x) => n + x.count, 0);
checks.push({ name: 'No brackets left to fill in', ok: leftoverN === 0, detail: leftoverN ? leftoverN + ' still on the page: ' + leftover.slice(0, 5).map(x => (x.token.length > 60 ? x.token.slice(0, 56) + '...]' : x.token)).join(', ') : 'none found' });
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
// INVARIANTS rule 4 (2026-10-15, state_lint.py): `o.live` is what PROVED the page is there, and the builder refuses to advance the state
// without it. *Detect Published* only ever called this for a page that had answered 200 (or that the site's own sitemap declares), but
// *Publish Check* called it unconditionally: an owner clicking "I published a page" for a URL that answered 404 still got
// `status: 'published'`, a `published_url` and `page_exists: true` written into seo_content_log and seo_ladders -- while the very same run
// told them, in words, that the page could not be fetched. Every reader of those two tables (the ladder plan, the Rank Tracker, the Content
// Cadence's pile-up guard, the Site Tracker, the app) then treated a page nobody could reach as live. A record says a thing exists only
// when the thing exists.
// Without the proof the row keeps the state it already had, records no URL and no date -- there is nothing to claim -- and the ladder row is
// left alone entirely rather than being moved backwards. The run still answers the owner (the page could not be fetched; the Site Tracker
// looks again on Monday), and Monday's publish detection, which does prove it, is what closes the row.
// o: { site_id, domain, keyword, url, live (what proved the page is there), log (content-log row or null), ladder (ladder row or null), request_id, now (ISO),
//      owners (optional: [{ url, keyword, supporting?, ladder_id? }], the addresses other searches of the site hold; needs LRU inlined) }
function publishedRows(o) {
  const log = o.log || null, ladder = o.ladder || null, now = o.now;
  const live = o.live === true;
  const log_row = { site_id: o.site_id, domain: o.domain, keyword: o.keyword, source: (log || {}).source || (ladder ? 'ladder' : 'manual'), page_type: (log || {}).page_type || (ladder ? (ladder.page_type || '') : ''), existing_page_url: (log || {}).existing_page_url || '', rung: Number((log || ladder || {}).rung) || 0,
    ladder_id: (log || ladder || {}).ladder_id || '', request_id: (log || {}).request_id || o.request_id || '', started_at: (log || {}).started_at || now,
    status: live ? 'published' : ((log || {}).status || 'reported'),
    published_url: live ? o.url : ((log || {}).published_url || ''),
    published_at: live ? now : ((log || {}).published_at || ''),
    week: live ? now.slice(0, 10) : ((log || {}).week || now.slice(0, 10)) };
  // LADDER PACKAGE (2026-11-09, rule 1 at publish time, v5/code/_ladder_rules.js): a rung row is never moved onto an address that another search
  // of this website already holds (o.owners: the published / existing ladder pages and the published content-log pages). Production
  // 2026-10-29: three rungs of techand.ai's ERP ladder came to point at one blog address; every later write and check then treated three
  // searches as one page. The content-log row still records where the page went live (that is what happened); the ladder row keeps its own
  // address and the conflict is said (`url_conflict`), so the ladder and the Rank Tracker never call two searches one page.
  const conflict = (ladder && live && Array.isArray(o.owners) && typeof LRU !== 'undefined')
    ? LRU.ownerOf(o.url, ladder.keyword, o.owners, String(ladder.supporting || '').split(',').map(x => x.trim()).filter(Boolean)) : null;
  const url_conflict = conflict ? { url: o.url, keyword: String(conflict.keyword || ''), ladder_id: String(conflict.ladder_id || ''),
    text: o.url.replace(/^https?:\/\/[^\/]+/i, '') + ' is already the page for "' + String(conflict.keyword || '') + '": one search, one page, so the ladder page for "' + String(ladder.keyword || '') + '" was not moved to it' } : null;
  const ladder_row = ((ladder && live) && !conflict) ? { ladder_id: ladder.ladder_id, keyword: ladder.keyword, status: 'published', target_url: o.url, page_exists: true } : null;
  return { log_row, ladder_row, live, url_conflict, not_live_reason: live ? '' : 'nothing confirmed the page is there, so no row says it is' };
}
const keyword = (log || ladder || {}).keyword || String(d.keyword || '').trim() || kw;
// 2026-10-27 (techand.ai on production): HTTP 200 proves the address answers, not that the draft is on it. A new draft reported at an
// older, different page, and a refresh reported before it was applied, were both marked published, and one address became the page of
// two keywords. The live page must be shown to BE the draft (its keyword in the title / main heading, the draft's own title, or for a
// new page the keyword in its text) and the address must not be another keyword's published page (v5/code/_publish_verify.js).
// ---- is the live page the draft? (2026-10-27, techand.ai and devaicon.com on production) ----
// "I published it" marked a draft published whenever the address answered HTTP 200: a NEW page for "ms 365 erp" reported at an older,
// different page (/dynamics-365-business-central-uae, "Business Central ERP Solutions in UAE"); a REFRESH of
// /insights/is-microsoft-dynamics-365-an-erp-system reported before the refresh was applied (the old title, no "erp systems in uae");
// and so one address became the published page of two keywords from two ladders. HTTP 200 proves an address answers, not that the
// draft is on it. INVARIANTS rule 4: a record says a thing exists only when the thing exists, so the draft's page must be shown to BE
// the draft before any state moves. One copy, inlined by the build into Publish Check (no model call, deterministic).
//
// Evidence that the live page is the draft, any one of:
//   a) the keyword in the live title or main heading: the keyword's words (stop words dropped, simple plurals folded) as a phrase in
//      one part of the title / heading (parts split at ? ! : | and spaced dashes, so "ERP System? UAE Buyers Guide" is two parts), or
//      all of them inside one short part ("Accounting Software Pricing in Dubai" for "dubai accounting software pricing");
//   b) the live title / heading matches the draft's own title / heading (sent by the app from the draft's report): 80% of the
//      draft's words there and half of all words shared;
//   c) a NEW page only: the keyword phrase in 3 or more sentences of the page's own content. A planned REFRESH never passes on the
//      text alone: the old page was already about the topic, so only (a) or (b) shows that the update is live.
// Outcomes (verify): 'ok' | 'not_the_draft' | 'refresh_not_live' | 'refresh_other_address' | 'address_used_by_other_keyword'.
// A refused outcome writes nothing: the row keeps its state (Publish Check passes `live: recorded_live` to publishedRows). The owner
// may re-send with confirm_mismatch: true after reading the evidence; the page is then recorded with verified false and the reason
// kept (publish_note). An address that is already the published page of ANOTHER keyword is never accepted on a confirmation: it is
// only accepted for a draft planned as a refresh of exactly that page, which then carries both keywords.
// o: { keyword, url, title, h1, text (the page's own content), draft: { title, h1 }, log (content-log row or null), ladder (ladder
//      row or null), logs, ladders (all rows), domain, confirm }
function verifyPublished(o) {
  const STOP = new Set(['a', 'an', 'the', 'in', 'of', 'for', 'to', 'and', 'on', 'at', 'by', 'with', 'is', 'are', 'vs', 'versus', 'or', 'from', 'into', 'about', 'your', 'our', 'its']);
  const ent = (s) => String(s == null ? '' : s).replace(/&amp;/gi, '&').replace(/&#0?39;|&apos;|&#8217;|&rsquo;/gi, "'").replace(/&nbsp;|&#160;|&#xa0;/gi, ' ').replace(/&quot;|&#34;/gi, '"').replace(/&[a-z]+;|&#\d+;/gi, ' ');
  const stem = (t) => (t.length > 4 && /ies$/.test(t)) ? t.slice(0, -3) + 'y'
    : (t.length > 4 && /(sses|shes|ches|xes|zes)$/.test(t)) ? t.slice(0, -2)
    : (t.length > 3 && /s$/.test(t) && !/(ss|us|is)$/.test(t)) ? t.slice(0, -1) : t;
  const toks = (s) => ent(s).toLowerCase().replace(/'s\b/g, '').replace(/[^a-z0-9؀-ۿ]+/g, ' ').split(' ').filter(t => t && !STOP.has(t)).map(stem);
  const parts = (s) => ent(s).split(/[?!|:;·•–—]|\.(?=\s|$)|\s-\s/).map(toks).filter(p => p.length);
  const phraseIn = (k, p) => { if (!k.length || p.length < k.length) return false; for (let i = 0; i + k.length <= p.length; i++) { let ok = true; for (let j = 0; j < k.length; j++) if (p[i + j] !== k[j]) { ok = false; break; } if (ok) return true; } return false; };
  const bagIn = (k, p) => k.length > 0 && p.length <= k.length + 6 && k.every(t => p.includes(t));
  const hostless = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const normK = (s) => toks(s).join(' ');
  const clip = (s, n) => { const x = ent(s).replace(/\s+/g, ' ').trim(); return x.length > n ? x.slice(0, n - 3).trim() + '...' : x; };
  const kwT = toks(o.keyword);
  const title = clip(o.title, 160), h1 = clip(o.h1, 160);
  // a) the keyword in the title or the main heading
  const inTitle = parts(o.title).some(p => phraseIn(kwT, p) || bagIn(kwT, p));
  const inH1 = parts(o.h1).some(p => phraseIn(kwT, p) || bagIn(kwT, p));
  // c) the keyword phrase in the page's own sentences
  const textHits = ent(o.text).split(/[.?!]\s+|\n+/).reduce((n, s) => n + (phraseIn(kwT, toks(s)) ? 1 : 0), 0);
  // b) the draft's own title / heading
  const head = (s) => toks(String(s || '').split(/\s[|–—-]\s(?=[^|–—-]*$)/)[0]);   // the part before a trailing " | Brand"
  const sim = (a, b) => { const A = head(a), B = head(b); if (A.length < 3 || !B.length) return 0; const SB = new Set(B), SA = new Set(A); const inB = A.filter(t => SB.has(t)).length / A.length; const uni = new Set([...SA, ...SB]).size; const shared = [...SA].filter(t => SB.has(t)).length / (uni || 1); return inB >= 0.8 && shared >= 0.5 ? Math.min(inB, 1) : 0; };
  const draft = o.draft || {};
  const draftMatch = [draft.title, draft.h1].filter(Boolean).some(dt => sim(dt, o.title) > 0 || sim(dt, o.h1) > 0);
  const log = o.log || null, ladder = o.ladder || null;
  const refreshOf = String((log || {}).existing_page_url || '').trim();
  const refresh = !!refreshOf;
  const here = hostless(o.url);
  const kwKey = normK(o.keyword);
  // the address already recorded as the published page of ANOTHER keyword of this site (content log or ladder)
  const onSite = (r) => hostless(r.domain) === hostless(o.domain);
  const sameRow = (r) => (log && r === log) || (log && log.request_id && String(r.request_id || '') === String(log.request_id) && normK(r.keyword) === normK(log.keyword));
  const owners = [];
  for (const r of (o.logs || [])) if (r && onSite(r) && !sameRow(r) && String(r.status) === 'published' && hostless(r.published_url) === here && normK(r.keyword) && normK(r.keyword) !== kwKey) owners.push(String(r.keyword));
  for (const r of (o.ladders || [])) if (r && onSite(r) && !(ladder && r.ladder_id === ladder.ladder_id && r.keyword === ladder.keyword) && (String(r.status) === 'published' || r.page_exists === true || r.page_exists === 'true') && hostless(r.target_url) === here && normK(r.keyword) && normK(r.keyword) !== kwKey) owners.push(String(r.keyword));
  const others = [...new Set(owners.map(k => String(k).trim()))];
  const refreshHere = refresh && hostless(refreshOf) === here;
  const byWords = inTitle || inH1 || draftMatch;
  const matched = byWords || (!refresh && textHits >= 3);
  const evidence = { title, h1, keyword_in_title: inTitle, keyword_in_heading: inH1, keyword_in_text: textHits, draft_title: clip(draft.title, 160), draft_heading: clip(draft.h1, 160), draft_match: draftMatch,
    refresh_of: refreshOf, used_by: others.slice(0, 3) };
  const kwq = '"' + String(o.keyword || '').trim() + '"';
  const seen = 'Its title is "' + (title || 'none') + '" and its main heading is "' + (h1 || 'none') + '".';
  let verify = 'ok', message = '', missing = [], note = '';
  if (others.length && !refreshHere) {
    verify = 'address_used_by_other_keyword';
    message = 'This address is already the published page for "' + others[0] + '"' + (others.length > 1 ? ' (and ' + (others.length - 1) + ' more)' : '') + '. One page can only be recorded for one keyword here, so nothing was marked published. Send the address of the page written for ' + kwq + '. If one page should now cover both searches, write this draft as an update of that page first.';
    missing = ['an address that is not already recorded for another keyword'];
  } else if (refresh && !refreshHere) {
    verify = 'refresh_other_address';
    message = 'This draft was planned as an update of ' + refreshOf + ', but you sent ' + o.url + '. Nothing was marked published. Send the address of the page it updates, or confirm that you published it at this new address. '
      + 'If you confirm, redirect the old address to the new one with a permanent (301) redirect: while both open, the two pages compete for the same search.';
    missing = ['the address of the page this draft updates'];
  } else if (!matched) {
    verify = refresh ? 'refresh_not_live' : 'not_the_draft';
    missing = [refresh ? 'the keyword ' + kwq + ' in the title or main heading' : 'the keyword ' + kwq + ' in the title, the main heading or the text']
      .concat((draft.title || draft.h1) ? ['the title of the page that was written ("' + clip(draft.title || draft.h1, 120) + '")'] : []);
    message = refresh
      ? 'This draft is an update of this page, but the update does not look live yet. ' + seen + ' Neither uses ' + kwq + (draft.title ? ' or the new title "' + clip(draft.title, 120) + '"' : '') + '. Nothing was marked published. Put the update on the page, then check again. If the update is live, confirm it.'
      : 'This page does not look like the page written for ' + kwq + '. ' + seen + ' Neither uses the keyword' + (draft.title ? ' or the written title "' + clip(draft.title, 120) + '"' : '') + ', and the text uses it ' + (textHits === 1 ? 'once' : textHits ? textHits + ' times' : 'nowhere') + '. Nothing was marked published. Check the address and send it again. If this is the right page, confirm it.';
  }
  if (verify === 'ok' && refreshHere && others.length) note = 'This page was already the published page for "' + others[0] + '". This draft is its planned update, so the page now carries both keywords.';
  const confirmable = verify !== 'ok' && verify !== 'address_used_by_other_keyword';
  const confirmed = confirmable && o.confirm === true;
  // production 2026-11-05 (devaicon.com): an update confirmed at ANOTHER address leaves two pages for one search; the step is a redirect,
  // which the app's Steps on your website checks every day (site task indexing:merge, from this content-log row)
  if (confirmed && verify === 'refresh_other_address') note = 'The page this draft updates, ' + refreshOf + ', still opens. Redirect it to ' + o.url + ' with a permanent (301) redirect, '
    + 'or put this text back on that address and remove this one, so Google treats them as one page; until then the two compete for the same search. We check the redirect every day under Steps on your website.';
  const accepted = verify === 'ok' || confirmed;
  const reasonShort = verify === 'ok' ? '' : verify === 'refresh_not_live' ? 'the update was not seen on the page' : verify === 'refresh_other_address' ? 'sent at another address than the page it updates' : verify === 'not_the_draft' ? 'the page did not match the draft (keyword not in the title, heading or text)' : 'the address is the published page of another keyword';
  return { verified: verify === 'ok', verify, accepted, confirmed, confirmable, message, missing, note, evidence,
    publish_note: confirmed ? 'Marked published by you after a warning: ' + reasonShort + ' (checked ' + String(o.now || '').slice(0, 10) + ')' : '' };
}
// ---- LADDER PACKAGE (2026-11-09, docs/keyword-intel-2026-11-08/fixes/LADDER.md): the five ladder rules, ONE copy ----
// Production (2026-10-22 .. 11-08, R3_PROD_OUTPUTS.md F1 F6 F7 F9): three rungs of techand.ai's ERP ladder, the main page included, were written onto
// ONE blog address (/insights/is-microsoft-dynamics-365-an-erp-system); the CRM ladder's main page pointed at "/dynamics-365-crm-uae-2", a copy
// of the live CRM page; a rung the verdict called AVOID was written and published because ladder page runs carry force_content; a rung sat
// in "writing" for days after its run died; devaicon.com's "ai automation solutions gcc" was measured in Pakistan. The rules:
//   1. one search, one address: two rungs never share a target, a rung whose address already answers its search improves that page, and the
//      main page is never a blog / insights address or a "-2" / "-copy" variant of a live page (addresses compared without scheme / www);
//   2. the rungs step towards the main keyword (stage: problem, solution, compare, hire); a plan with no compare / hire rung before the main
//      page is re-planned from its own pool, and a pure definition ("what is a crm company") is a rung only when its results page is
//      informational (guides) and it links to the main page;
//   3. the market is the website's market, or the market the keyword names ("gcc", "uae", "dubai" -> AE); never another country;
//   4. an AVOID verdict, or a score clearly under the line (40), stops the rung: no page is written until the client says "Write it anyway";
//   5. a rung "writing" for longer than three times its expected time (at least 60 minutes) with nothing of its run still alive is closed as
//      failed with its reason, so the next rung can go.
// Inlined into Ladder Plan, Ladder Duplicate (Words), Parse Verdict's ladder stop (Ladder Row Written), Cadence Plan, Publish Candidates and
// Publish Check (through _publish_rows.js); the app runs the same source (app/shared/src/ladder-rules.generated.js, ladder_rules_app.py) for
// its warnings, its rung reasons and its stuck-rung watcher. Pure: no clock (pass `now`), no table, no network. Needs fitPlaces
// (_fit_gate.js) only for the market rule; everything else stands alone.
const LRU = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const low = (v) => S(v).toLowerCase();
  const CFG = {
    stuck_min_minutes: 60, stuck_eta_factor: 3, page_eta_minutes: 20,   // page runs take 15-19 minutes on production (2026-11-08)
    clear_score: 40,                                                    // Parse Verdict's "clearly low" line (HOLD CFG.clear)
    blog_dirs: ['blog', 'blogs', 'insights', 'insight', 'articles', 'article', 'news', 'resources', 'resource', 'posts', 'post', 'learn', 'guides', 'guide', 'knowledge', 'academy', 'stories', 'magazine'],
    // the measurable markets (Normalize Input COUNTRIES): ISO-2 -> the country name the engine and the app use
    countries: { US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia', NZ: 'New Zealand', IE: 'Ireland', PK: 'Pakistan', IN: 'India',
      AE: 'United Arab Emirates', SA: 'Saudi Arabia', SG: 'Singapore', ZA: 'South Africa', DE: 'Germany', FR: 'France', ES: 'Spain', IT: 'Italy',
      NL: 'Netherlands', BR: 'Brazil', MX: 'Mexico' },
  };
  const STAGES = ['problem', 'solution', 'compare', 'hire', 'info'];
  const COMMERCIAL = ['compare', 'hire'];

  // ---- addresses (rule 1) ----
  /** the comparable form of an address: no scheme, no www., no query / fragment, no trailing slash, lower case ('' for nothing) */
  const urlKey = (u) => low(u).replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const pathOf = (u) => { const k = urlKey(u); const i = k.indexOf('/'); return i < 0 ? '' : k.slice(i); };
  const segs = (u) => pathOf(u).split('/').filter(Boolean);
  /** a blog / insights / news ... address: its first folder is one of CFG.blog_dirs */
  const isBlog = (u) => { const s = segs(u); return s.length > 1 && CFG.blog_dirs.includes(s[0]); };
  const COPY_RE = /^(.+?)-(?:copy(?:-\d+)?|\d{1,2}|old|new|draft|backup|bak|v\d)$/;
  /** a "-2" / "-copy" / "-old" variant of another address of the site: -> the original's address, or ''. A numbered or dated suffix counts
   *  only when the address without it is a page the site has (so /step-2 is not a copy unless /step exists); "-copy" always counts. */
  const copyOf = (u, known) => {
    const s = segs(u); if (!s.length) return '';
    const m = s[s.length - 1].match(COPY_RE); if (!m) return '';
    const base = urlKey(u).replace(/[^/]+$/, m[1]);
    const ks = new Map((Array.isArray(known) ? known : []).map(x => [urlKey(x && typeof x === 'object' ? x.url : x), x && typeof x === 'object' ? S(x.url) : S(x)]).filter(([k]) => k));
    if (ks.has(base)) return ks.get(base) || base;
    return /-copy(?:-\d+)?$/.test(s[s.length - 1]) ? base : '';
  };
  // the same search in other words: every word kept, joining words dropped, a plural folded (the H2 target_guard rule of Ladder_Plan.js)
  const JOIN = new Set(['in', 'the', 'a', 'an', 'of', 'for', 'to', 'on', 'at', 'and', 'with', 'by', 'from']);
  const wordsKey = (kw) => [...new Set(low(kw).split(/[^a-z0-9؀-ۿ]+/).filter(t => t && !JOIN.has(t)).map(t => t.length > 3 ? t.replace(/ies$/, 'y').replace(/([^s])s$/, '$1') : t))].sort().join(' ');
  const sameSearch = (a, b) => { const x = low(a), y = low(b); if (!x || !y) return false; if (x === y) return true; const wa = wordsKey(x); return !!wa && wa === wordsKey(y); };
  /** who already holds an address: owners [{ url, keyword, supporting?: [..], ladder_id?, by? }] -> the owner of `url` whose search is NOT
   *  `keyword` (nor one of its supporting keywords), or null. The same search may always improve its own page. */
  const ownerOf = (url, keyword, owners, mine) => {
    const k = urlKey(url); if (!k) return null;
    const kws = [keyword, ...(Array.isArray(mine) ? mine : [])].map(low).filter(Boolean);
    for (const o of (Array.isArray(owners) ? owners : [])) {
      if (!o || urlKey(o.url) !== k || !S(o.keyword)) continue;
      const theirs = [o.keyword, ...(Array.isArray(o.supporting) ? o.supporting : String(o.supporting || '').split(','))].map(low).filter(Boolean);
      if (kws.some(a => theirs.some(b => sameSearch(a, b)))) continue;   // the same search: its own page (another owner may still hold it)
      return o;
    }
    return null;
  };
  /** the address a new page gets on the site: home + slug(keyword), with the site's trailing-slash form */
  const plannedUrl = (home, keyword, slash) => { const h = S(home).replace(/\/+$/, ''); const sl = low(keyword).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return h && sl ? h + '/' + sl + (slash ? '/' : '') : ''; };
  /** rule 1 for the MAIN page: a blog address, or a copy of a live page, is never its target. -> null (fine) or { reason, was, to, exists }:
   *  a copy points back to the original page (improve it); a blog address gets the commercial page the site has (`commercial`, a URL
   *  found by the caller among non-blog pages), else a new page at `planned`. */
  const headTarget = (url, o) => {
    const opt = o || {}; const u = S(url); if (!u) return null;
    const orig = copyOf(u, opt.known || []);
    if (orig) return { reason: 'copy', was: u, to: S(orig).startsWith('http') ? S(orig) : (S(opt.home).replace(/\/+$/, '') + pathOf(orig)), exists: true,
      text: u.replace(/^https?:\/\/[^\/]+/i, '') + ' is a copy of ' + pathOf(orig) + ', a page your website already has: the main page improves that page instead of a second copy' };
    if (isBlog(u)) { const c = S(opt.commercial);
      return c ? { reason: 'blog', was: u, to: c, exists: true, text: 'the main page is a page people choose a provider on, not a blog post: ' + c.replace(/^https?:\/\/[^\/]+/i, '') + ' improves instead of ' + u.replace(/^https?:\/\/[^\/]+/i, '') }
        : { reason: 'blog', was: u, to: S(opt.planned), exists: false, text: 'the main page is a page people choose a provider on, not a blog post (' + u.replace(/^https?:\/\/[^\/]+/i, '') + '): it gets its own page at ' + S(opt.planned).replace(/^https?:\/\/[^\/]+/i, '') }; }
    return null;
  };
  /** rule 1 inside one plan: pages [{ keyword, target_url, exists, rung, supporting }] in plan order (the main page first) -> { pages, moved }.
   *  Two pages on one address: the first keeps it; a later page of the SAME search joins it as a supporting keyword, any other gets its own
   *  new address (`planned(keyword)`). */
  const oneUrl = (pages, planned) => {
    const seen = new Map(); const out = []; const moved = [];
    for (const p of (Array.isArray(pages) ? pages : [])) {
      const k = urlKey(p && p.target_url); if (!p || !k) { out.push(p); continue; }
      const o = seen.get(k);
      if (!o) { seen.set(k, p); out.push(p); continue; }
      if (sameSearch(o.keyword, p.keyword)) { o.supporting = [...new Set([...(o.supporting || []), p.keyword, ...(p.supporting || [])])]; moved.push({ keyword: p.keyword, to: o.keyword, url: o.target_url, how: 'joined', text: '"' + p.keyword + '" is the same search as "' + o.keyword + '", so it is a supporting keyword of that page' }); continue; }
      const nu = typeof planned === 'function' ? S(planned(p.keyword)) : '';
      if (!nu || seen.has(urlKey(nu))) { moved.push({ keyword: p.keyword, to: o.keyword, url: o.target_url, how: 'dropped', text: '"' + p.keyword + '" had the same address as "' + o.keyword + '" and no address of its own could be made, so it waits' }); continue; }
      moved.push({ keyword: p.keyword, from: p.target_url, url: nu, how: 'own address', text: '"' + p.keyword + '" had the same address as "' + o.keyword + '" (' + pathOf(p.target_url) + '): one search, one page, so it gets its own page at ' + pathOf(nu) });
      Object.assign(p, { target_url: nu, exists: false, status: 'new', existing_source: null, existing_confidence: null, existing_evidence: '' });
      seen.set(urlKey(nu), p); out.push(p);
    }
    return { pages: out, moved };
  };

  // ---- the buyer's stage (rule 2) ----
  const Q_START = /^(?:what|who|why|when|where|which|is|are|does|do|can|should|will|how)\b/;
  const W_COMPARE = /\b(?:best|top|vs|versus|alternatives?|compare|comparison|comparing|pricing|prices?|costs?|fees?|quotes?|reviews?|rated|cheapest|affordable|rankings?|list of)\b/;
  const W_HIRE = /\b(?:compan(?:y|ies)|agenc(?:y|ies)|firms?|providers?|partners?|consultants?|consultanc(?:y|ies)|contractors?|developers?|vendors?|integrators?|resellers?|specialists?|experts?|freelancers?|hire|hiring|near me|services)\b|\b(?:consulting|implementation|development|support|migration|integration|outsourcing) services?\b/;
  const W_PROBLEM = /\b(?:deadlines?|penalt(?:y|ies)|fines?|mandate|mandatory|requirements?|compliance|compliant|regulations?|law|laws|problems?|issues?|errors?|not working|fix|risks?|challenges?|obligations?)\b/;
  const W_SOLUTION = /\b(?:software|system|systems|platform|platforms|tools?|solutions?|apps?|applications?|modules?|features?|implementation|migration|integration|upgrade|automation|development|hosting|cloud|erp|crm|hrms|lms|setup|service)\b/;
  const W_DEFINE = /^(?:what (?:is|are|does)|what's|whats|define|definition of|meaning of)\b/;
  const W_SELLER_NOUN = /\b(?:compan(?:y|ies)|agenc(?:y|ies)|firms?|providers?|partners?|consultants?|consultanc(?:y|ies)|vendors?|integrators?|specialists?)\b/;
  /** the stage of a search: a stored KI stage when there is one, else the words, else the intent the research gave -> one of STAGES */
  const stageOf = (keyword, intent, stored) => {
    const st = low(stored); if (STAGES.includes(st)) return st;
    const k = low(keyword).replace(/[^a-z0-9؀-ۿ&]+/g, ' ').trim();
    if (!k) return 'info';
    if (W_COMPARE.test(k)) return 'compare';
    if (Q_START.test(k)) return W_PROBLEM.test(k) ? 'problem' : 'info';
    if (W_HIRE.test(k)) return 'hire';
    if (W_PROBLEM.test(k)) return 'problem';
    if (W_SOLUTION.test(k)) return 'solution';
    const i = low(intent);
    return i === 'commercial' || i === 'transactional' ? 'solution' : 'info';
  };
  const isCommercial = (stage) => COMMERCIAL.includes(low(stage));
  /** a pure definition of a seller ("what is a crm company", "meaning of erp partner"): a page for people learning a word, not buyers */
  const isDefinitional = (keyword) => { const k = low(keyword); return W_DEFINE.test(k) && W_SELLER_NOUN.test(k); };
  /** rule 2: may a definitional rung stay? only when its results page was read and is informational (guides lead) and it links to the main page */
  const definitionalOk = (o) => { const x = o || {}; return !!x.serp_informational && !!x.links_up; };
  const STAGE_WORDS = { problem: 'people with a problem to solve', solution: 'people looking for a solution', compare: 'people comparing providers or options', hire: 'people ready to choose a provider', info: 'people learning about the topic' };
  const stageText = (stage) => STAGE_WORDS[low(stage)] || STAGE_WORDS.info;

  // ---- the market (rule 3) ----
  const placesOf = (s) => { try { return typeof fitPlaces === 'function' ? fitPlaces(s) : []; } catch (e) { return []; } };
  const countryName = (iso) => CFG.countries[S(iso).toUpperCase()] || '';
  /** -> { iso, country, source: 'keyword' | 'site' | 'request', named: [place words], keyword_iso, ok (the request market is the lock), changed,
   *  measurable, note }. o: { keyword, site_iso (the website's market), request_iso (what the run was sent with) }.
   *  A keyword that names places stands for those places: the website's market when it is among them ("gcc" for a UAE website), else the
   *  first measurable country it names (a region: its first country, "gcc" -> AE); a keyword that names no place is the website's market.
   *  Never a third country: the request's market is used only when there is neither a place in the keyword nor a website market. */
  const market = (o) => {
    const x = o || {}; const site = S(x.site_iso).toUpperCase(), req = S(x.request_iso).toUpperCase();
    const places = placesOf(x.keyword); const named = places.map(p => p.word);
    let iso = '', source = '', keyword_iso = '';
    if (places.length) {
      const isos = [...new Set(places.flatMap(p => p.iso || []))];
      keyword_iso = site && isos.includes(site) ? site : (isos.find(i => CFG.countries[i]) || isos[0] || '');
      iso = keyword_iso; source = site && iso === site ? 'site' : 'keyword';
    } else if (site) { iso = site; source = 'site'; }
    else { iso = req; source = 'request'; }
    const measurable = !!CFG.countries[iso];
    if (!measurable && site) { iso = site; source = 'site'; }   // a named market we cannot measure (Qatar): the website's own, said so
    const ok = !req || req === iso;
    const nm = (i) => countryName(i) || i;
    const note = !iso ? '' : source === 'keyword'
      ? 'The keyword names ' + named.join(', ') + ', so this ladder is measured in ' + nm(iso) + (site ? ', not in your website\'s market (' + nm(site) + ')' : '') + '.'
      : !measurable ? ''
      : places.length && keyword_iso && keyword_iso !== iso ? 'The keyword names ' + named.join(', ') + ', which we cannot measure, so this ladder is measured in your website\'s market (' + nm(iso) + ').'
      : places.length ? 'The keyword names ' + named.join(', ') + ', which includes your website\'s market (' + nm(iso) + '), so it is measured there.'
      : source === 'site' ? 'Measured in your website\'s market (' + nm(iso) + ').' : '';
    return { iso, country: nm(iso), source, named, keyword_iso, request_iso: req, ok, changed: !!req && req !== iso, measurable: !!CFG.countries[iso], note };
  };
  /** the sentence a refused run carries when its market contradicts the lock (Ladder Duplicate (Words), before anything is paid) */
  const marketRefusal = (m, keyword) => !m || m.ok ? '' : 'This ladder was sent to be measured in ' + (countryName(m.request_iso) || m.request_iso) + ', but "' + S(keyword) + '" '
    + (m.source === 'keyword' ? 'names ' + m.named.join(', ') + ' (' + m.country + ')' : 'names no place and your website\'s market is ' + m.country)
    + '. A ladder is measured in one market, so nothing was planned and nothing was charged: start it again in ' + m.country
    + (m.source === 'site' && !m.named.length ? ', or confirm that you want it measured in ' + (countryName(m.request_iso) || m.request_iso) + ' on purpose.' : '.');

  // ---- verdicts (rule 4) ----
  /** o: { verdict: 'GO' | 'GO_WITH_CHANGES' | 'AVOID' | ..., score: 0-100 | null, ack: the client said "Write it anyway" } -> { stop, reason, band } */
  const verdictStop = (o) => {
    const x = o || {}; const v = S(x.verdict).toUpperCase(); const sc = x.score === '' || x.score == null || !Number.isFinite(Number(x.score)) ? null : Math.round(Number(x.score));
    const band = v === 'AVOID' ? 'avoid' : sc != null && sc < CFG.clear_score ? 'clearly_low' : '';
    if (!band) return { stop: false, reason: '', band: '' };
    if (x.ack) return { stop: false, reason: 'you chose to write it anyway', band, overridden: true };
    return { stop: true, band, score: sc,
      reason: band === 'avoid' ? 'our check advised against this page (AVOID' + (sc != null ? ', score ' + sc : '') + ')' : 'our check scored it ' + sc + ' out of 100, clearly under the ' + CFG.clear_score + ' we write without asking' };
  };

  // ---- stuck rungs (rule 5) ----
  /** o: { status, since (ISO: when it went to writing / was started), eta_minutes, live: true | false | null (null = could not be asked), now (ISO or ms) }
   *  -> { stuck, minutes, limit, reason } */
  const stuck = (o) => {
    const x = o || {}; const st = low(x.status);
    const eta = Number.isFinite(Number(x.eta_minutes)) && Number(x.eta_minutes) > 0 ? Number(x.eta_minutes) : CFG.page_eta_minutes;
    const limit = Math.max(CFG.stuck_min_minutes, CFG.stuck_eta_factor * eta);
    const t = Date.parse(S(x.since)); const now = typeof x.now === 'number' ? x.now : Date.parse(S(x.now));
    if (!['writing', 'started'].includes(st) || !Number.isFinite(t) || !Number.isFinite(now)) return { stuck: false, minutes: null, limit, reason: '' };
    const minutes = Math.max(0, Math.round((now - t) / 60000));
    if (minutes < limit) return { stuck: false, minutes, limit, reason: '' };
    if (x.live !== false) return { stuck: false, minutes, limit, reason: x.live === true ? 'still running' : 'the engine could not be asked whether it is still running' };
    return { stuck: true, minutes, limit, reason: 'the page run stopped without a result: it was being written for ' + minutes + ' minutes (more than ' + limit + ') and nothing of it is still running' };
  };

  // ---- what a rung row tells the client (the app's ladder page) ----
  /** row: a seo_ladders row; o: { next: the keyword the ladder writes next, now } -> { state, label, why, url } */
  const rungState = (row, o) => {
    const r = row || {}; const st = low(r.status || 'planned'); const url = S(r.target_url); const note = S(r.status_note);
    const exists = r.page_exists === true || r.page_exists === 'true';
    const path = url.replace(/^https?:\/\/[^\/]+/i, '') || '/';
    const tw = S(r.target_why);
    if (st === 'stopped') return { state: 'stopped', label: 'Stopped', why: note.replace(/^stopped:\s*/i, '') || 'our check advised against this page', url };
    if (st === 'failed') return { state: 'failed', label: 'Stopped without a result', why: note.replace(/^failed:\s*/i, '') || 'the page run stopped without a result', url };
    if (st === 'merged') return { state: 'merged', label: 'Part of another page', why: note.replace(/^merged:\s*/i, '') || 'it is a section of another page of this ladder', url };
    if (st === 'set_aside') return { state: 'set_aside', label: 'Set aside', why: note || 'it is not a search for this website', url };
    if (st === 'published') return { state: 'published', label: 'Live', why: 'published at ' + path, url };
    if (st === 'written' || st === 'not_ready') return { state: st, label: st === 'written' ? 'Written, waiting to be published' : 'Written, needs a fix', why: note || (exists ? 'improves ' + path : 'a new page at ' + path), url };
    if (st === 'writing') return { state: 'writing', label: 'Being written', why: exists ? 'improves ' + path : 'a new page at ' + path, url };
    const nxt = (o || {}).next ? sameSearch((o || {}).next, r.keyword) : false;
    return { state: exists ? 'improve' : 'new', label: exists ? 'Improves an existing page' : 'New page', why: (tw || (exists ? 'your page ' + path + ' already answers this search, so it is improved, not written twice' : 'a page you do not have yet, at ' + path))
      + (nxt ? '' : note ? ' (' + note + ')' : ''), url, waiting: !nxt };
  };

  // ---- rule 6: keyword intelligence as the ladder's pool ----
  /** o: { mode (seo_monitors.ki_mode), killed (true | false | null = unread: counts as killed), rows (seo_ki_keywords of the site), runs
   *  (seo_ki_runs of the site), market ('AE-en'), min (default 3) } -> { used, reason, run_id, rows (one head per cluster, gate pass, not
   *  gated), avoid (keywords the client's checks advised against), note }. Read only when the site's mode is exactly 'on' and the kill
   *  switch reads off (fails closed, KI.readable's rule); only the rows of the latest finished keyword-research run of this market
   *  (CONTRACTS KI_ROW_CURRENT). Fewer than `min` usable heads: not used, and the ladder keeps its own research, said so. */
  const kiPool = (o) => {
    const x = o || {}; const mode = low(x.mode); const mk = S(x.market);
    const off = (reason, note) => ({ used: false, reason, run_id: '', rows: [], avoid: [], note: note || '' });
    if (mode !== 'on') return off(mode ? 'ki_' + mode : 'ki_off');
    if (x.killed !== false) return off('killed', 'Keyword intelligence is paused for every website, so this ladder used its own keyword research.');
    const runs = (Array.isArray(x.runs) ? x.runs : []).filter(r => r && low(r.kind) === 'keyword_research' && ['ok', 'partial'].includes(low(r.status)) && (!mk || S(r.market) === mk))
      .sort((a, b) => S(b.finished_at || b.started_at).localeCompare(S(a.finished_at || a.started_at)));
    const cur = runs[0] ? S(runs[0].run_id) : '';
    if (!cur) return off('no_run', 'Keyword intelligence is on, but no finished keyword research is on file for ' + (mk || 'this market') + ', so this ladder used its own keyword research.');
    const all = (Array.isArray(x.rows) ? x.rows : []).filter(r => r && S(r.keyword) && S(r.run_id) === cur && (!mk || S(r.market) === mk));
    const yes = (v) => v === true || v === 'true';
    const pass = all.filter(r => low(r.gate) === 'pass' && low(r.verdict) !== 'gated');
    const anyHead = pass.some(r => yes(r.is_head));
    const heads = pass.filter(r => !anyHead || yes(r.is_head));
    const avoid = all.filter(r => low(r.gate_reason) === 'avoid').map(r => S(r.keyword));
    const min = Number(x.min) > 0 ? Number(x.min) : 3;
    if (heads.length < min) return { ...off('too_few', 'Keyword intelligence holds only ' + heads.length + ' usable search' + (heads.length === 1 ? '' : 'es') + ' for ' + (mk || 'this market') + ' (at least ' + min + ' are needed), so this ladder used its own keyword research.'), run_id: cur, avoid };
    return { used: true, reason: '', run_id: cur, rows: heads, avoid,
      note: 'The supporting pages come from keyword intelligence: ' + heads.length + ' search groups of its last keyword research (' + cur + '), one search per group, with its verdict, page action and Search Console position.' };
  };

  return { CFG, STAGES, COMMERCIAL, kiPool, urlKey, pathOf, isBlog, copyOf, wordsKey, sameSearch, ownerOf, plannedUrl, headTarget, oneUrl,
    stageOf, isCommercial, isDefinitional, definitionalOk, stageText, countryName, market, marketRefusal, verdictStop, stuck, rungState };
})();
const h1Words = (body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [null, ''])[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const verifyText = mainHtml.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<(h[1-6]|p|li|td|th|div|section|br|dt|dd)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ');
const confirmMismatch = d.confirm_mismatch === true || String(d.confirm_mismatch) === 'true';
const V = live ? verifyPublished({ keyword, url, title, h1: h1Words, text: verifyText, draft: { title: String(d.draft_title || '').slice(0, 300), h1: String(d.draft_h1 || '').slice(0, 300) }, log, ladder, logs, ladders, domain, confirm: confirmMismatch, now })
  : { verified: false, verify: 'not_live', accepted: false, confirmed: false, confirmable: false, message: '', missing: [], note: '', evidence: null, publish_note: '' };
// INVARIANTS rule 4: the proof is HTTP 200 from this very URL in this run AND the page shown to be the draft (or the owner's confirmation
// after the warning, stored with its reason). Without it nothing here says the page exists.
const recorded_live = live && V.accepted === true;
// LADDER PACKAGE (2026-11-09, rule 1): the addresses other searches of this website already hold, so a rung is never moved onto one of them
const ownersPC = [...onSite.filter(l => l.target_url && (String(l.status || '') === 'published' || l.page_exists === true || l.page_exists === 'true')).map(l => ({ url: l.target_url, keyword: l.keyword, supporting: l.supporting, ladder_id: l.ladder_id })),
  ...logs.filter(l => normD(l.domain) === domain && String(l.published_url || '').trim()).map(l => ({ url: l.published_url, keyword: l.keyword, ladder_id: l.ladder_id || '' }))];
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
