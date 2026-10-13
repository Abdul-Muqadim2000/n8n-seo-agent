/*__KW_INPUTS__*/
// One item per priority keyword for the live SERP check ("Candidate SERP"). Always at least one item.
// 2026-10-13 (FIX_PLAN G8, criterion K4): the live intent / page-type check was fixed at 8 keywords; the limit is now
// CONFIG.live_serp_checks (Normalize Input: 16 by default, hard cap 25, about $0.002 a check), the same number Rank Keywords
// used when it chose the list.
const s = $('Rank Keywords').first().json;
const ks = s.keyword_strategy || {};
const list = (ks.priority || []).slice(0, KWI.liveChecks(s.live_serp_checks));
if (!list.length) list.push({ keyword: s.primary_seed || (s.seeds || [])[0] || 'services', fallback: true });
return list.map(k => ({ json: { keyword: k.keyword, location_code: s.location_code, language_code: s.language_code || 'en', fallback: !!k.fallback } }));
