/*__SITE_MODEL__*/
/*__INBOUND__*/
// C12 (2026-10-22): which of the site's own live pages should link to the page this run wrote. The candidates come from the site model's
// page inventory (sitemap, Search Console, menu: titles, H1s, paths), ranked by the new page's topic words (v5/code/_inbound.js); each is
// then fetched once (Fetch Inbound Pages, the site's own pages, free) so only a page that answers 200 and does not link to the new page
// yet is proposed. A run without a written page passes one `skip` item and nothing is fetched.
const src = $('Attach PDF Report').first(); const d = (src && src.json) || {};
const md = String(d.page_markdown || '');
const skip = (why) => [{ json: { skip: true, why } }];
if (!md.trim()) return skip('no page was written in this run');
let MODEL = null; try { MODEL = $('Site Model').first().json.site_model || null; } catch (e) {}
if (!MODEL && d.site_model && typeof d.site_model === 'object') MODEL = d.site_model;
const dom = SM.helpers.bare(String(d.domain || (MODEL && MODEL.domain) || ''));
if (!dom) return skip('the run has no website, so there is no page of yours to link from');
const model = (MODEL && MODEL.domain && SM.helpers.bare(MODEL.domain) === dom) ? MODEL : { domain: dom };
const own = (u) => { const raw = String(u || '').trim(); if (!raw) return ''; const h = SM.helpers.hostOf(raw); if (h && SM.helpers.bare(h) !== dom) return raw;
  return SM.siteUrl(model, raw.replace(/^https?:\/\/[^\/?#]*/i, '') || '/'); };
const metaLine = (k) => ((md.match(new RegExp('^' + k + ':\\s*(.+)$', 'im')) || [])[1] || '').trim();
const title = metaLine('Title') || d.keyword || '';
const slug = (String(d.content_brief_slug || metaLine('Slug') || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)) || 'page';
// the same URL the blog package suggests: the ladder's planned URL, the URL the quality check settled, the page being improved, else the slug
const existingUrl = d.existing_page && typeof d.existing_page === 'object' ? String(d.existing_page.url || '') : String(d.existing_page || '');
const targetUrl = (d.ladder_id && String(d.ladder_target_url || '').trim()) ? own(d.qa_page_url || d.ladder_target_url)
  : (d.qa_page_url ? own(d.qa_page_url) : (/^https?:\/\//i.test(existingUrl) ? own(existingUrl) : SM.siteUrl(model, '/' + slug + '/')));
const secondary = metaLine('Secondary Keywords') ? metaLine('Secondary Keywords').split(/,\s*/) : (Array.isArray(d.secondary_keywords) ? d.secondary_keywords : []);
const kind = /blog|guide|article|pillar|hub|case stud|post/i.test(String(d.page_type || d.recommended_page || '')) ? 'guide' : 'service';
// CT-FIX2 (D4): the other planned pages of the ladder keep their own searches; no anchor here may use one
const avoid = [].concat(Array.isArray(d.content_links_to_add) ? d.content_links_to_add : [], Array.isArray(d.ladder_links) ? d.ladder_links : [],
  ((d.content_qa || {}).links_to_add_when_published || [])).map(p => p && p.keyword).filter(Boolean);
const target_in = { url: targetUrl, keyword: String(d.keyword || ''), md, title, secondary, kind, avoid };
const T = INB.target(target_in);
const pages = [].concat(Array.isArray(model.pages) ? model.pages : [], Array.isArray(model.nav_pages) ? model.nav_pages : []);
const cands = INB.candidates(pages, T, { domain: dom, gone: Array.isArray(d.gone_pages) ? d.gone_pages.map(g => g && (g.url || g.from_url || g)) : [], max: 10 });
if (!cands.length) return [{ json: { skip: true, why: 'no page of the site shares the new page\'s topic', target_in } }];
return cands.map((c, i) => ({ json: { url: own(c.url), cand: c, ...(i === 0 ? { target_in } : {}) } }));
