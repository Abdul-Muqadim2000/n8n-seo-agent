// Comp Profile Requests (E2, DESIGN.md §2.3 / §2.8): what the CHOSEN competitors rank for (Labs ranked_keywords, limit 300 by estimated visits,
// positions 1-20), kept 7 days and shared with the Keyword research run; and Labs competitors_domain on the client only when it has at least
// 50 ranked keywords (R4 6.1 #3: it fails for small sites - techand.ai returned items: null live, R5 §13 L-2). Profiles that would take the run
// over the price quoted wait for the next run (KI Plan: profile_cap), and the callback says so.
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const c = $('Comp Candidates').first().json || {};
let cache = []; try { cache = $('Load KI Cache').all().map(i => i.json).filter(r => r && r.key); } catch (e) { cache = []; }
const m = { location_code: p.location_code, language_code: p.language_code };
const ck = (what, ...x) => KIW.cacheKey(p.site_id, what, ...x);
const fresh = (k, kind) => KIW.fresh(KIW.cacheRead(cache, k), kind, p.now, p.ki_force);
const reqs = [];
const need = (p.chosen || []).filter(d => !fresh(ck('rk', p.market, d), 'ranked')).slice(0, Math.max(0, KIW.N(p.profile_cap) || 0));
for (const d of need) reqs.push(KIW.rq.ranked(d, m));
const client = KIW.host(p.domain);
const ckw = KIW.N(((c.sizes || {})[client] || {}).keywords);
if (ckw != null && ckw >= KIW.CAPS.cd_min_ranked && !fresh(ck('cd', p.market, client), 'ranked')) reqs.push(KIW.rq.competitorsDomain(client, m));
return reqs.length ? reqs.map(j => ({ json: j })) : [{ json: { skip: true, reason: 'no chosen competitor needs a new profile, and the client has fewer than 50 ranked keywords for a domain-overlap read' } }];
