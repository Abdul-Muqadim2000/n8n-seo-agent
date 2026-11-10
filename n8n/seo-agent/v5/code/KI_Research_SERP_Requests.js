// Research SERP Requests (E2, DESIGN.md §3.3-§3.4; QUEUE 2026-11-11): the top M results pages nobody read today with exact addresses (depth 10, no AI Overview content: who ranks,
// the page types, People also ask, whether an AI Overview and a local pack are shown is all this needs), and one Google Ads search-volume task
// ($0.09, up to 1,000 keywords; 12 requests a minute per account, one per run) for the candidates Labs knows no volume for. Ads volumes are
// Keyword Planner's rounded steps for groups of close variants: shown as an estimate, never as an exact count (R5 §5).
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const pic = $('Research Picture').first().json || {};
let cacheRows = []; try { cacheRows = $('Load SERP Cache (KI Research)').all().map(i => i.json).filter(r => r && r.key); } catch (e) { cacheRows = []; }
const m = { location_code: p.location_code, language_code: p.language_code };
// QUEUE (2026-11-11): the pages go to the normal-priority queue (exact page addresses, $0.0006), collected after a minute; a stored reading
// counts only when it carries exact addresses (one read live since Google's redirect change has none, and searches cannot be grouped on it)
const reqs = (pic.top_m || []).filter(k => { const lk = SC.lookup(cacheRows, KIW.serpBody(k, m), { now: p.now }); return !(lk.hit && KIW.exactEnough(lk.response)); }).map(k => KIW.rq.serpPost(k, m));
const vm = pic.vol_map || {};
const unknown = (pic.rows || []).filter(r => r.volume == null && !(vm[r.kw_key] && vm[r.kw_key].ads_at && !p.ki_force)).map(r => r.keyword).filter(k => k.length <= 80 && k.split(' ').length <= 10).slice(0, KIW.CAPS.ads_max);
if (unknown.length) reqs.push(KIW.rq.adsVolume(unknown, m));
return reqs.length ? reqs.map(j => ({ json: j })) : [{ json: { skip: true, reason: 'every results page was read today and every volume is known' } }];
