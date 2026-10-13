// G14 (2026-10-13, system review FIX_PLAN.md; CRITERIA_technical… 1.4): what exists only after JavaScript.
// The audit crawl can run with JavaScript on (DataForSEO on-page, `enable_javascript`), so a page whose heading, text, canonical or links
// are written by a script looks perfectly healthy to us — while the crawlers that do NOT run JavaScript (every AI crawler today, and
// Google's own second pass only when it gets round to it) see an empty shell. Nobody ever compared the two readings.
// This node picks the site's key pages and asks for two readings of each: the **raw** first response (a plain GET, exactly what a
// non-rendering crawler receives) and the **rendered** page (the Jina Reader render path of v5/code/Render_Requests.js, `X-Return-Format:
// html` = the HTML after the scripts ran). *Render Diff* then compares title, H1, canonical, robots meta, link count and text length and
// says which of the two each figure came from. Both fetches are free; the cap is CONFIG.render_diff_pages (5) pages per audit.
/*__SITE_MODEL__*/
const base = $('Check Crawl').first().json;
let prev = {};
try { prev = $input.first().json || {}; } catch (e) {}

let crawled = [];
try { crawled = ($('Get Crawled Pages').first().json.tasks?.[0]?.result?.[0]?.items || []).filter(p => p && p.url); } catch (e) {}
let SITE_MODEL = null;
try { SITE_MODEL = $('Site Model').first().json.site_model || null; } catch (e) {}
const model = SITE_MODEL && SITE_MODEL.domain && SITE_MODEL.domain === SM.helpers.bare(base.domain) ? SITE_MODEL : { domain: base.domain };
const home = SM.siteUrl(model, '/');

const CAP = Math.max(1, Math.min(10, Number(base.render_diff_pages) || 5));
const pathOf = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '') || '/';
const LEGAL = /privacy|cookie|terms|legal|disclaimer|sitemap\.xml/i;
const live = (p) => {
  const c = p.checks || {};
  if (c.is_broken || c.is_4xx_code || c.is_5xx_code || c.is_redirect) return false;
  if (p.status_code && Number(p.status_code) >= 300) return false;
  return String(p.resource_type || 'html') === 'html' && !LEGAL.test(pathOf(p.url));
};
// the pages that matter: Search Console clicks first (the audit has them by now), then how much the site links to them
const clicksBy = new Map();
for (const row of (((prev.search_console || {}).top_pages) || [])) {
  const u = pathOf(row.page || row.url);
  if (u) clicksBy.set(u, (clicksBy.get(u) || 0) + (Number(row.clicks) || 0) * 100 + (Number(row.impressions) || 0));
}
const score = (p) => (clicksBy.get(pathOf(p.url)) || 0) * 1000 + (Number((p.meta || {}).internal_links_count) || 0) + Math.max(0, 120 - pathOf(p.url).length);
const kindOf = (u) => pathOf(u) === '/' ? 'home'
  : /\/(blog|insights|news|articles?|posts?|guides?|resources?)(\/|$)/i.test(pathOf(u)) ? 'article'
    : /\/(services?|solutions?|products?|software|platform|industries)(\/|$)/i.test(pathOf(u)) ? 'service' : 'page';

const picked = [];
const add = (url, title) => { const u = String(url || ''); if (!u || picked.some(x => x.url === u)) return; picked.push({ url: u, kind: kindOf(u), title: String(title || '') }); };
const homeItem = crawled.find(p => pathOf(p.url) === '/' && live(p));
add(homeItem ? homeItem.url : home, homeItem ? ((homeItem.meta || {}).title || '') : '');
for (const p of crawled.filter(p => live(p) && pathOf(p.url) !== '/').sort((a, b) => score(b) - score(a))) {
  if (picked.length >= CAP) break;
  add(p.url, (p.meta || {}).title || '');
}

// The rendered side: the render service for every page, with the JavaScript crawl as the fallback where the service cannot answer.
// A crawl run WITHOUT JavaScript is not a rendered reading and never stands in for one — *Render Diff* then says "not checked".
const crawl_js = !!base.crawl_js;
const plan = { pages: picked.length, cap: CAP, crawl_js, fallback: crawl_js ? 'the JavaScript crawl' : 'none (the crawl did not render JavaScript)',
  figures: ['Title', 'Main heading (H1)', 'Canonical link', 'Robots meta', 'Links on the page', 'Text length'] };
if (!picked.length) return [{ json: { ...prev, skip: true, render_plan: { ...plan, reason: 'the crawl returned no live HTML page to compare' } } }];
return picked.map((p, i) => ({ json: { ...p, index: i, render_url: 'https://r.jina.ai/' + p.url, render_plan: plan } }));
