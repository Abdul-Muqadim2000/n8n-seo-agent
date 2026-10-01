// Builds the list of REAL pages on the user's site (from sitemap files) so the brief and the
// copywriter only link to URLs that exist, and detects whether a page for this keyword already exists.
const ctx = $('Prepare Keyword Run').first().json;
const bodies = ctx.domain ? $input.all().map(i => String((i.json || {}).sitemap_xml || (i.json || {}).body || '')) : [];

const STOP = new Set(['the','a','an','and','or','of','for','to','in','on','with','by','at','from','your','our','best','top','services','service','company','how','what','is','are','near','me','vs','page','pages','html','php','index','home']);
const tokens = (s) => String(s || '').toLowerCase().replace(/\.(html?|php|aspx?)$/g, '').split(/[^a-z0-9]+/).filter(t => t.length > 1 && !STOP.has(t));

const seen = new Set();
const pages = [];
for (const body of bodies) {
  if (/<sitemapindex/i.test(body) && !/<urlset/i.test(body)) continue;      // nested index, not pages
  const urlBlocks = body.match(/<url>[\s\S]*?<\/url>/gi) || [];
  const locs = urlBlocks.length
    ? urlBlocks.map(b => (b.match(/<loc>\s*([^<\s]+)\s*<\/loc>/i) || [])[1]).filter(Boolean)
    : (body.match(/<loc>\s*([^<\s]+)\s*<\/loc>/gi) || []).map(x => x.replace(/<\/?loc>/gi, '').trim());
  for (let u of locs) {
    u = u.replace(/&amp;/g, '&').trim();
    if (!/^https?:\/\//i.test(u)) continue;
    const host = u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[\/?#]/)[0].toLowerCase();
    if (host !== ctx.domain && !host.endsWith('.' + ctx.domain)) continue;
    if (/\.(jpe?g|png|gif|webp|svg|pdf|xml|css|js|mp4|zip)(\?|$)/i.test(u)) continue;
    const key = u.replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    const path = u.replace(/^https?:\/\/[^\/]+/i, '') || '/';
    pages.push({ url: u, path, tokens: tokens(path) });
    if (pages.length >= 400) break;
  }
  if (pages.length >= 400) break;
}

const kwTokens = new Set(tokens(ctx.keyword));
const overlap = (p) => p.tokens.filter(t => kwTokens.has(t)).length;
const jaccard = (p) => { const u = new Set([...p.tokens, ...kwTokens]); return u.size ? overlap(p) / u.size : 0; };

// Existing page for this keyword: explicit URL from the form, else best sitemap match
let existing_page = null;
if (ctx.existing_page_url) {
  existing_page = { url: ctx.existing_page_url, match: 1, source: 'provided' };
} else if (ctx.run_page_check || pages.length) {
  const best = pages.map(p => ({ p, j: jaccard(p), o: overlap(p) }))
    .filter(x => x.o >= Math.min(2, kwTokens.size) && x.j >= 0.5)
    .sort((a, b) => b.j - a.j)[0];
  if (best) existing_page = { url: best.p.url, match: +best.j.toFixed(2), source: 'sitemap' };
}

// Internal-link candidates: related pages first, then short hub pages
const candidates = pages
  .filter(p => p.path !== '/' && !/privacy|terms|cookie|legal|login|cart|checkout|account|search|feed|wp-|\/tag\/|\/author\//i.test(p.path))
  .map(p => ({ url: p.url, path: p.path, score: overlap(p) * 10 - p.path.split('/').filter(Boolean).length }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 40)
  .map(p => ({ url: p.url, path: p.path }));

const home = ctx.domain ? 'https://' + ctx.domain + '/' : '';
// Ladder page runs: the other ladder pages (top page, sibling) are link targets even when they are planned and not live yet
const ladderLinks = (ctx.ladder_links || []).filter(l => l && l.url).map(l => ({ url: l.url, path: l.path || (String(l.url).replace(/^https?:\/\/[^\/]+/i, '') || '/'), ladder: l.role || 'ladder', about: l.keyword || '', planned: !!l.planned }));
const ladderUrls = new Set(ladderLinks.map(l => String(l.url).replace(/\/$/, '')));
const candidates2 = candidates.filter(c => !ladderUrls.has(String(c.url).replace(/\/$/, '')));

return [{
  json: {
    ...ctx,
    sitemap_ok: pages.length > 0,
    site_urls_count: pages.length,
    site_urls: pages.slice(0, 300).map(p => p.url),
    internal_link_candidates: [...(home ? [{ url: home, path: '/' }] : []), ...ladderLinks.filter(l => String(l.url).replace(/\/$/, '') !== home.replace(/\/$/, '')), ...candidates2],
    existing_page
  }
}];
