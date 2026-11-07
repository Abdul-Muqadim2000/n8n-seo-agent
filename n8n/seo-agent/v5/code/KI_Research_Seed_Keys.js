// Research Seed Keys (E2, DESIGN.md §3.1): the seeds' results pages already read today (by any path) are a free source of what people
// ask - People also ask, related searches, forum threads (R1 #2: bought and thrown away until now). One cache lookup per seed; nothing is bought here.
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const m = { location_code: p.location_code, language_code: p.language_code };
const items = (p.seeds || []).map(s => { const body = KIW.serpBody(s.keyword, m); return { json: { keyword: body.keyword, serp_cache_key: SC.key(body) } }; });
return items.length ? items : [{ json: { skip: true, serp_cache_key: 'serp:none' } }];
