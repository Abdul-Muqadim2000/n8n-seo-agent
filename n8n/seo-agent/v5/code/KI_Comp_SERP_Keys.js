// Comp SERP Keys (E2, DESIGN.md §2.2): one item per seed, keyed for the results-page day cache (seo_cache serp:<keyword>|<location>|<language>|
// <device>), so *Load SERP Cache (KI Comp)* finds what any path already read today. Depth 10, no AI Overview content (R5 §13 C1: loading it
// doubles the price, and who ranks is all this run needs).
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const m = { location_code: p.location_code, language_code: p.language_code };
const items = (p.seeds || []).map(s => { const body = KIW.serpBody(s.keyword, m); return { json: { keyword: body.keyword, serp_cache_key: SC.key(body), body } }; });
return items.length ? items : [{ json: { skip: true, serp_cache_key: 'serp:none', reason: 'no seed passed the fit gate' } }];
