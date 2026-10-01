// One item per priority keyword for the live SERP check ("Candidate SERP"). Always at least one item.
const s = $('Rank Keywords').first().json;
const ks = s.keyword_strategy || {};
const list = (ks.priority || []).slice(0, 8);
if (!list.length) list.push({ keyword: s.primary_seed || (s.seeds || [])[0] || 'services', fallback: true });
return list.map(k => ({ json: { keyword: k.keyword, location_code: s.location_code, language_code: s.language_code || 'en', fallback: !!k.fallback } }));
