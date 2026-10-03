/*__REACH__*/
// Discovery with a website (v4.8, PIPELINE_FEATURE_SPEC §9.1-4): the site's reach labels every recommended keyword ("Easy for your site · Direct
// plan · 2-4 months") and sets the Now / Next / Later tiers. A reach stored in the last 30 days for this market is used as it is (no call); otherwise
// two DataForSEO Labs calls measure it (~$0.03). Without a domain nothing is asked and discovery works as before.
const d = $('Seed List').first().json;
const domain = reachDomain(d.domain);
if (!domain) return [{ json: { skip: true, reason: 'no domain' } }];
let rows = []; try { rows = $('Load Site Cache').all().map(i => i.json); } catch (e) { rows = []; }
if (reachCached(rows, domain, d.location_code)) return [{ json: { skip: true, reason: 'stored' } }];
return reachRequests(domain, d.location_code, d.language_code).map(r => ({ json: r }));
