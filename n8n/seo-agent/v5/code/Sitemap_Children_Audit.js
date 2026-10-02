// The site's /sitemap.xml: if it is an index, read up to 3 child sitemaps (the rest is counted); otherwise nothing more to fetch.
const r = ($input.first() || {}).json || {};
const status = Number(r.statusCode) || (r.error ? 0 : 200);
const bodyOf = (r) => { const b = r && (r.body != null ? r.body : r.data); return typeof b === 'string' ? b : (b ? JSON.stringify(b) : ''); };   // the HTTP node puts text responses under `data` (live finding 2026-10-02)
const body = bodyOf(r);
const locs = (body.match(/<loc>\s*([^<\s]+)\s*<\/loc>/gi) || []).map(x => x.replace(/<\/?loc>/gi, '').trim());
const isIndex = /<sitemapindex/i.test(body);
if (status === 200 && isIndex && locs.length) return locs.slice(0, 3).map(u => ({ json: { url: u, total_children: locs.length } }));
return [{ json: { skip: true, reason: status !== 200 ? 'no sitemap.xml (HTTP ' + status + ')' : (isIndex ? 'empty sitemap index' : 'single sitemap') } }];
