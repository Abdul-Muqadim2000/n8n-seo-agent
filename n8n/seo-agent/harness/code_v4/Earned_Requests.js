// The third-party pages AI cited in answers that did not name the business: fetched to see who they name (the business? its competitors?).
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const out = plans.flatMap(p => p.earned_fetch.map(url => ({ json: { site_id: p.site_id, url } })));
return out.length ? out : [{ json: { skip: true } }];
