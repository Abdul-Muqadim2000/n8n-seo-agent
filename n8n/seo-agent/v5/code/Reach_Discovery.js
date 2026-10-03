/*__REACH__*/
// The site's reach for discovery (v4.8): stored (30 days, same market) or measured by "Run Reach Requests"; null without a domain.
// A newly measured reach is saved to seo_cache ('reach:<site_id>') next, so the ladder and the keyword check reuse it.
const d = $('Seed List').first().json;
const domain = reachDomain(d.domain);
if (!domain) return [{ json: { reach: null, domain: '', save: false } }];
let rows = []; try { rows = $('Load Site Cache').all().map(i => i.json); } catch (e) { rows = []; }
const stored = reachCached(rows, domain, d.location_code);
if (stored) return [{ json: { ...stored, domain, save: false } }];
let reqs = [], res = [];
try { reqs = $('Reach Requests (Discovery)').all().map(i => i.json).filter(r => r && !r.skip); res = $('Run Reach Requests').all().map(i => i.json); } catch (e) { reqs = []; res = []; }
const parsed = reachParse(reqs, res);
const info = reachFrom(parsed.ranked, parsed.authority);
const save = info.method !== 'default';
return [{ json: { ...info, domain, errors: parsed.errors, save, cache_row: save ? reachCacheRow(domain, info, d.location_code) : null } }];
