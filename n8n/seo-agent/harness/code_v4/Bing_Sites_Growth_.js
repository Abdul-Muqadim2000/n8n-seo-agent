// Bing Webmaster Tools (free key SEO_BING_WEBMASTER_API_KEY, the v4.10 credential): the sites the account can manage — only those can be submitted.
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const BING = true;
return BING && plans.length ? [{ json: { url: 'https://ssl.bing.com/webmaster/api.svc/json/GetUserSites' } }] : [{ json: { skip: true } }];
