// Comp Labs Requests (E2, DESIGN.md §2.3 / §2.6, R5 §13.3): what the stored SERPs know about these searches and these businesses.
//   * serp_competitors on the seeds (Labs' own results-page store: coverage for long B2B seeds is poor, so many seeds come back empty);
//   * the size of the client and of the top hosts (bulk traffic estimation: keywords + estimated visits; Backlinks bulk referring domains);
//   * competitors_domain on the most frequent business host of these pages (it has Labs data; the client often has none, R5 §13 L-2),
//     with exclude_top_domains false (platforms are tagged, not hidden) and its own row skipped when read.
// Every answer younger than its lifetime (KI.CONFIG ttl_days: ranked 7 d, backlinks 7 d) is reused and not asked again.
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const pic = $('Comp SERP Picture').first().json || {};
let cache = []; try { cache = $('Load KI Cache').all().map(i => i.json).filter(r => r && r.key); } catch (e) { cache = []; }
const m = { location_code: p.location_code, language_code: p.language_code };
const ck = (what, ...x) => KIW.cacheKey(p.site_id, what, ...x);
const fresh = (k, kind) => KIW.fresh(KIW.cacheRead(cache, k), kind, p.now, p.ki_force);
const seeds = (p.seeds || []).map(s => s.keyword);
const hosts = Object.values(pic.hosts || {}).sort((a, b) => b.positions.length - a.positions.length || Math.min(...a.positions.map(x => x.position)) - Math.min(...b.positions.map(x => x.position)) || a.domain.localeCompare(b.domain));
const client = KIW.host(p.domain);
const top = KIW.uniq([client, ...p.declared, ...p.chosen, ...hosts.map(h => h.domain)]).slice(0, KIW.CAPS.size_targets + 1);
const reqs = [];
if (seeds.length && !fresh(ck('sc', p.market, KIW.hash(seeds.join('|'))), 'ranked')) reqs.push(KIW.rq.serpCompetitors(seeds, m));
const needSize = top.filter(d => !fresh(ck('size', p.market, d), 'ranked'));
if (needSize.length) reqs.push(KIW.rq.trafficTargets(needSize, m));
const needRd = top.filter(d => !fresh(ck('rd', d), 'backlinks'));
if (needRd.length) reqs.push(KIW.rq.refDomains(needRd));
const rival = hosts.map(h => ({ h, c: KIW.classify(p, h, null) })).find(x => x.c.class === 'direct' || x.c.class === 'adjacent');
const rivals = KIW.uniq([...(p.chosen || []).slice(0, KIW.CAPS.cd_rivals), rival ? rival.h.domain : '']).slice(0, KIW.CAPS.cd_rivals);
for (const d of rivals) if (!fresh(ck('cd', p.market, d), 'ranked')) reqs.push(KIW.rq.competitorsDomain(d, m));
return reqs.length ? reqs.map(j => ({ json: j })) : [{ json: { skip: true, reason: 'every stored answer is fresh: nothing is bought again' } }];
