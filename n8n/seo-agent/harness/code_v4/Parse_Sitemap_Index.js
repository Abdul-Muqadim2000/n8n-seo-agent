// Input: the fetched /sitemap.xml (text). Output: the sitemap files to read (max 5).
const ctx = $('Prepare Keyword Run').first().json;
const r = $input.first().json || {};
const status = r.statusCode || (r.error ? 0 : 200);
const body = String(r.sitemap_xml || r.body || r.data || '');
const base = 'https://' + ctx.domain;

const locs = (body.match(/<loc>\s*([^<\s]+)\s*<\/loc>/gi) || []).map(x => x.replace(/<\/?loc>/gi, '').trim());
const isIndex = /<sitemapindex/i.test(body);

let urls = [];
if (status === 200 && isIndex && locs.length) {
  // Prefer page/post/service sitemaps over image/video/tag sitemaps
  const score = (u) => (/page|post|service|product|blog|main/i.test(u) ? 0 : 1) + (/image|video|tag|author|category|news/i.test(u) ? 2 : 0);
  urls = [...locs].sort((a, b) => score(a) - score(b)).slice(0, 5);
} else if (status === 200 && locs.length) {
  urls = [base + '/sitemap.xml'];               // plain urlset: re-read the same file in the next node
} else {
  urls = [base + '/sitemap_index.xml', base + '/wp-sitemap.xml', base + '/sitemap-index.xml', base + '/page-sitemap.xml'];
}
return urls.map(u => ({ json: { url: u } }));
