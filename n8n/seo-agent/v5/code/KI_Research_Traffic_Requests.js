// Research Traffic Requests (E2, DESIGN.md §3.3 B5, R5 §13 #1 / C6): the traffic potential of each read search = the estimated visits of the
// page ranking #1 for it (Labs bulk_traffic_estimation, page URLs accepted, standard price, joined on `target` because the answer's order is
// not the request's). Only EXACT addresses are sent: a result whose address had to be recovered from its breadcrumb (google.com/goto) is not
// guessed at, and its traffic potential says "not measured". Kept 7 days.
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const sp = $('Research SERP Picture').first().json || {};
let cache = []; try { cache = $('Load KI Cache').all().map(i => i.json).filter(r => r && r.key); } catch (e) { cache = []; }
const m = { location_code: p.location_code, language_code: p.language_code };
const tp = KIW.cacheRead(cache, KIW.cacheKey(p.site_id, 'tp', p.market)) || {};
const fresh = (u) => { const e = (tp.map || {})[u]; return e && !p.ki_force && Date.parse(p.now) - Date.parse(e.at) < KIW.ttlOf('ranked') * 864e5; };
const urls = KIW.uniq(Object.values(sp.by || {}).map(r => (r.top10 || []).find(t => t.exact && t.url && /^https:\/\//.test(t.url))).filter(Boolean).map(t => t.url)).filter(u => !fresh(u)).slice(0, KIW.CAPS.tp_urls);
const reqs = urls.length ? [KIW.rq.trafficTargets(urls, m, 'tp')] : [];
// FX-L H2: the referring domains of the client and of every host read in these top 10s (Backlinks bulk, 7 days), so Win's Strength is
// measured against the results it has to beat instead of a constant
const fr = (k) => KIW.fresh(KIW.cacheRead(cache, k), 'backlinks', p.now, p.ki_force);
const hosts = KIW.uniq([KIW.host(p.domain), ...Object.values(sp.by || {}).flatMap(r => (r.top10 || []).map(t => KIW.host(t.host)))].filter(h => h && KIW.isBusinessHost(h, '__none__')));
const needRd = hosts.filter(h => !fr(KIW.cacheKey(p.site_id, 'rd', h))).slice(0, KIW.CAPS.rd_targets);
if (needRd.length) reqs.push(KIW.rq.refDomains(needRd));
return reqs.length ? reqs.map(j => ({ json: j })) : [{ json: { skip: true, reason: 'no exact #1 address to measure and every referring-domain count is fresh' } }];
