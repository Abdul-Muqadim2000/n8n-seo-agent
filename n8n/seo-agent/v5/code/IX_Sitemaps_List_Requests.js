// Index coverage: the sitemaps the website submitted in Search Console (sitemaps.list, read-only scope; nothing is ever submitted). One GET per
// connected website. Their paths join the sitemap roots (Sitemap Requests 1) and a site with no submitted sitemap, or one with errors, is said
// in the run's note for the app's "Steps on your website".
const S = (v) => String(v == null ? '' : v).trim();
const sites = $('Index Sites').all().map(i => i.json).filter(s => s && s.site_id && s.gsc_connected);
const API = 'https://www.googleapis.com/webmasters/v3/sites/';
const out = sites.map(s => ({ json: { site_id: s.site_id, url: API + encodeURIComponent(s.gsc_property) + '/sitemaps' } }));
return out.length ? out : [{ json: { skip: true, reason: 'no website with Search Console access' } }];
