// Queries used to discover competitors on Google: what this site's key pages are about, taken from H1s/titles of shallow pages.
const base = $('Schema Findings').first().json;
const pages = $('Get Crawled Pages').first().json.tasks?.[0]?.result?.[0]?.items || [];
const brand = String(base.domain || '').split('.')[0].toLowerCase();
const isHome = (u) => /^https?:\/\/[^\/]+\/?$/.test(u || '');
const skip = (u) => /privacy|cookie|terms|security|legal|contact|about|insights|blog|news|careers|team|faq|login|cart|thank|404|sitemap|\/tag\/|\/category\/|\/author\//i.test(u || '');
const clean = (t) => String(t || '').split(/\s[|\-–—:]\s/)[0].replace(/[^\w\s&\-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const generic = /^(page|home|homepage|welcome|untitled|services?|products?|solutions?|our (services|work|products)|index|overview)\b/;
const ok = (q) => { const w = q ? q.split(' ').length : 0; return w >= 2 && w <= 7 && !generic.test(q) && !(brand.length > 3 && q.includes(brand)); };
const scored = [];
pages.filter(p => p.url && !isHome(p.url) && !skip(p.url) && (p.status_code == null || p.status_code === 200)).forEach(p => {
  const m = p.meta || {};
  const cands = [clean(((m.htags || {}).h1 || [])[0]), clean(m.title)].filter(ok);
  if (cands.length) scored.push({ q: cands[0], depth: p.click_depth ?? 9, links: m.inbound_links_count || 0 });
});
scored.sort((a, b) => a.depth - b.depth || b.links - a.links);
const queries = [];
for (const s of scored) { if (!queries.includes(s.q)) queries.push(s.q); if (queries.length >= 3) break; }
if (!queries.length) {
  const home = pages.find(p => isHome(p.url));
  const q = clean(home && home.meta && ((((home.meta.htags || {}).h1 || [])[0]) || home.meta.title));
  if (ok(q)) queries.push(q);
}
if (!queries.length) return [{ json: { query: brand + ' services' } }];
return queries.map(q => ({ json: { query: q } }));