// Fixtures for the publish detection (scenario S26, pipeline phase 4): sitemaps (index + urlsets with lastmod) and live pages, shaped as the
// HTTP node returns them with fullResponse + text (body under `data`, live finding 2026-10-02).
const ok = (data, type) => ({ statusCode: 200, statusMessage: 'OK', headers: { 'content-type': type || 'application/xml' }, data });
// entries: [loc, lastmod?, { cdata }?]
const urlset = (entries) => ok('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + entries.map(([loc, lastmod, o]) =>
  '<url><loc>' + ((o || {}).cdata ? '<![CDATA[' + loc + ']]>' : loc.replace(/&/g, '&amp;')) + '</loc>' + (lastmod ? '<lastmod>' + lastmod + '</lastmod>' : '') + '<changefreq>weekly</changefreq></url>').join('\n') + '</urlset>');
const index = (entries) => ok('<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + entries.map(([loc, lastmod]) =>
  '<sitemap><loc>' + loc + '</loc>' + (lastmod ? '<lastmod>' + lastmod + 'T08:00:00+00:00</lastmod>' : '') + '</sitemap>').join('\n') + '</sitemapindex>');
const page = (title, h1) => ok('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>' + title + '</title><meta name="description" content="x"></head><body><header><a href="/">Home</a></header>' +
  (h1 ? '<h1 class="entry-title"><span>' + h1 + '</span></h1>' : '') + '<p>' + 'Body text. '.repeat(60) + '</p><h1>A second heading that is ignored</h1></body></html>', 'text/html; charset=utf-8');
const missing = () => ({ statusCode: 404, statusMessage: 'Not Found', headers: { 'content-type': 'text/html' }, data: '<html><head><title>Page not found</title></head></html>' });
module.exports = { urlset, index, page, missing };
