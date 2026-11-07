// Research SERP Keys (E2, DESIGN.md §3.4): the top M candidates, one item each, keyed for the results-page day cache.
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const pic = $('Research Picture').first().json || {};
const m = { location_code: p.location_code, language_code: p.language_code };
const items = (pic.top_m || []).map(k => { const body = KIW.serpBody(k, m); return { json: { keyword: body.keyword, serp_cache_key: SC.key(body) } }; });
return items.length ? items : [{ json: { skip: true, serp_cache_key: 'serp:none' } }];
