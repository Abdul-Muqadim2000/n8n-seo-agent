// Comp Sitemap Requests (E2, DESIGN.md §2.8): how often each chosen competitor publishes, from its own sitemap.xml (free: one plain GET,
// public hosts only), kept 14 days. A sitemap that is missing, blocked or an index of sitemaps gives "pace not measured", never "0 pages".
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
let cache = []; try { cache = $('Load KI Cache').all().map(i => i.json).filter(r => r && r.key); } catch (e) { cache = []; }
const fresh = (k) => KIW.fresh(KIW.cacheRead(cache, k), 'homepage', p.now, p.ki_force);
// FX-L perf H2: a sitemap is read only for a chosen competitor seen on a results page (this run, or as stored evidence): never a host the
// request alone names
const pic = (() => { try { return $('Comp SERP Picture').first().json || {}; } catch (e) { return {}; } })();
let stored = []; try { stored = $('Load KI Competitors').all().map(i => i.json).filter(r => r && r.comp_domain); } catch (e) { stored = []; }
const seen = new Set([...Object.keys(pic.hosts || {}).map(KIW.host), ...stored.filter(r => (KIW.N(r.seeds_seen) || 0) > 0).map(r => KIW.host(r.comp_domain))]);
const items = (p.chosen || []).filter(KIW.publicHost).filter(h => seen.has(KIW.host(h)) || [...seen].some(x => KIW.regOf(x) === KIW.regOf(h))).filter(h => !fresh(KIW.cacheKey(p.site_id, 'pace', h))).slice(0, KIW.CAPS.sitemaps).map(h => ({ domain: h, url: 'https://' + h + '/sitemap.xml' }));
return items.length ? items.map(j => ({ json: j })) : [{ json: { skip: true, reason: 'no chosen competitor, or every pace was read in the last 14 days' } }];
