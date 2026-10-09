// Bing Webmaster Tools (v4.10, free; only when SEO_BING_WEBMASTER_API_KEY is in n8n/.env): Bing's own crawl of the links to your site. The key
// belongs to one Bing account and reads every site verified in it — add a site there (Search Console import: one click, verified at once)
// or have its owner add that account under Settings → Users (read-only). First the account's sites, to use each site's exact URL.
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do && p.bing);
return plans.length ? [{ json: { kind: 'bing_sites', url: 'https://ssl.bing.com/webmaster/api.svc/json/GetUserSites' } }] : [{ json: { skip: true } }];
