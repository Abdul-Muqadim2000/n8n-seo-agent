// IndexNow (Bing, Yandex, Naver, Seznam, Yep …; Google does not take part): a site can submit once it hosts its key file https://<host>/<key>.txt.
// The key is made once per site (seo_cache indexnow:<site_id>); the report tells the owner which file to put on the site.
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const out = plans.map(p => ({ json: { site_id: p.site_id, key: p.indexnow_key, url: 'https://' + p.site_host + '/' + p.indexnow_key + '.txt' } }));
return out.length ? out : [{ json: { skip: true } }];
