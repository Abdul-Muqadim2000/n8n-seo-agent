// Queries used to discover competitors on Google and to seed the full report's keyword research: what this business sells.
// R60 (2026-10-16, re-rating of 2026-10-15): the seeds were the H1s of the crawled pages sorted by click depth, and a page no link reaches
// gets click_depth 0 from a crawler that also starts from the sitemap — so three orphan cards ("ai & automation", "assess & envision",
// "build & implement") sorted ahead of every real service page and became "Keyword research based on your services". The site's own words
// come first now: the keywords the owner configured for this site, then the services its site model holds (the ones the linked pages talk
// about most first), and only then page headings, with pages no link reaches last. Each query says where it came from (`source`).
const base = $('Schema Findings').first().json;
const pages = $('Get Crawled Pages Answers').first().json.tasks?.[0]?.result?.[0]?.items || [];
const brand = String(base.domain || '').split('.')[0].toLowerCase();
const isHome = (u) => /^https?:\/\/[^\/]+\/?$/.test(u || '');
const skip = (u) => /privacy|cookie|terms|security|legal|contact|about|insights|blog|news|careers|team|faq|login|cart|thank|404|sitemap|\/tag\/|\/category\/|\/author\//i.test(u || '');
const clean = (t) => String(t || '').split(/\s[|\-–—:]\s/)[0].replace(/[^\w\s&\-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const generic = /^(page|home|homepage|welcome|untitled|services?|products?|solutions?|our (services|work|products)|index|overview)\b/;
const ok = (q) => { const w = q ? q.split(' ').length : 0; return w >= 2 && w <= 7 && !generic.test(q) && !(brand.length > 3 && q.includes(brand)); };
const bareOf = (d) => String(d || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const listOf = (v) => { if (Array.isArray(v)) return v; const s = String(v == null ? '' : v).trim(); if (!s) return [];
  if (/^\[/.test(s)) { try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch (e) { return []; } } return s.split(/[,;\n]+/); };
// the stored site row and the site model of THIS site (another site's row never seeds this one)
let siteRow = {}; try { const r = $('Load Site Row (Model)').first().json || {}; if (r.domain && bareOf(r.domain) === bareOf(base.domain)) siteRow = r; } catch (e) {}
let model = null; try { const m = $('Restore Site Model').first().json.site_model || null; if (m && (!m.domain || bareOf(m.domain) === bareOf(base.domain))) model = m; } catch (e) {}
// a page with click depth 0 that is not the homepage was reached only through the sitemap (R117): no link leads a visitor to it
const unlinked = (p) => !!((p.checks || {}).is_orphan_page) || (p.click_depth === 0 && !isHome(p.url));
const live = pages.filter(p => p.url && !isHome(p.url) && !skip(p.url) && (p.status_code == null || p.status_code === 200));
const headOf = (p) => { const m = p.meta || {}; return [clean(((m.htags || {}).h1 || [])[0]), clean(m.title)].join(' '); };
const linkedText = live.filter(p => !unlinked(p)).map(headOf);
const toks = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2 && !['and', 'for', 'the', 'with', 'microsoft'].includes(t));
const out = []; const add = (q, source) => { if (q && ok(q) && !out.some(o => o.query === q) && out.length < 3) out.push({ query: q, source }); };
// 1. the keywords the owner configured for this site
for (const k of listOf(siteRow.keywords)) add(clean(k), 'your keywords');
// 2. the services the site model holds, the ones the linked pages talk about most first
const services = [...new Set([...listOf(model && model.services), ...listOf(siteRow.services_json)].map(clean).filter(Boolean))];
const svcScore = (s) => { const t = toks(s); if (!t.length) return 0; return linkedText.filter(h => t.every(w => h.includes(w))).length; };
services.map((s, i) => ({ s, i, n: svcScore(s) })).filter(x => x.n > 0).sort((a, b) => b.n - a.n || a.i - b.i).forEach(x => add(x.s, 'your services'));
// 3. page headings: linked pages first (shallow, then well linked), a page no link reaches last
const scored = [];
live.forEach(p => {
  const m = p.meta || {};
  const cands = [clean(((m.htags || {}).h1 || [])[0]), clean(m.title)].filter(ok);
  if (cands.length) scored.push({ q: cands[0], depth: unlinked(p) ? 99 : (p.click_depth ?? 9), links: m.inbound_links_count || 0 });
});
scored.sort((a, b) => a.depth - b.depth || b.links - a.links);
for (const s of scored) add(s.q, s.depth >= 99 ? 'a page no link reaches' : 'page heading');
if (!out.length) {
  const home = pages.find(p => isHome(p.url));
  add(clean(home && home.meta && ((((home.meta.htags || {}).h1 || [])[0]) || home.meta.title)), 'homepage heading');
}
if (!out.length) return [{ json: { query: brand + ' services', source: 'the domain name' } }];
return out.map(q => ({ json: q }));