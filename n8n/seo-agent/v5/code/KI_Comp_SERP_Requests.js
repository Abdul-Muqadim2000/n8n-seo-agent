// Comp SERP Requests (E2, DESIGN.md §2.2): the seeds whose results page nobody read today (deep enough), as live advanced SERP requests.
// A cache hit is never asked again and costs 0 (SC: the rebuilt answer carries cost 0 and the paid task's id).
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
let cacheRows = []; try { cacheRows = $('Load SERP Cache (KI Comp)').all().map(i => i.json).filter(r => r && r.key); } catch (e) { cacheRows = []; }
const m = { location_code: p.location_code, language_code: p.language_code };
const reqs = (p.seeds || []).filter(s => !SC.lookup(cacheRows, KIW.serpBody(s.keyword, m), { now: p.now }).hit).map(s => KIW.rq.serp(s.keyword, m));
return reqs.length ? reqs.map(j => ({ json: j })) : [{ json: { skip: true, reason: 'every seed was read today: no results page is bought again' } }];
