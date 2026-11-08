// Research Discover Requests (E2, DESIGN.md §3.1, R5 §4 / §6 / §13): what people search, from every source that is not Search Console:
//   * Google autocomplete (client gws-wiz-serp, $0.002 each) on the services with buyer modifiers; suggestions naming another country or city
//     are dropped when read (they are not localised, R5 §13 C9);
//   * Labs keyword ideas on the seeds, keyword suggestions and related keywords on the top services (provider estimates of volume / CPC / KD);
//   * the chosen competitors' ranked keywords (positions 1-20, by estimated visits; shared with the Competitors run, 7 days);
//   * the gap: Labs page_intersection, the chosen competitors' sites as `https://host/*` (the live-confirmed wildcard) in union mode, the client
//     excluded; cut to the top 10 when read; the provider's total_count is kept so a capped sample says "sample of N of M".
// Lifetimes (KI.CONFIG ttl_days): discovery lists 30 d, ranked keywords and intersections 7 d. With everything fresh nothing is asked.
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
let cache = []; try { cache = $('Load KI Cache').all().map(i => i.json).filter(r => r && r.key); } catch (e) { cache = []; }
const m = { location_code: p.location_code, language_code: p.language_code };
const ck = (what, ...x) => KIW.cacheKey(p.site_id, what, ...x);
const fresh = (k, kind) => KIW.fresh(KIW.cacheRead(cache, k), kind, p.now, p.ki_force);
const seeds = (p.seeds || []).map(s => s.keyword);
const svc = (p.seed_services || []).slice(0, 5);
const reqs = [];
if (seeds.length && !fresh(ck('disc', p.market, p.seed_key || KIW.seedHash(p.seeds)), 'discovery')) {
  const ac = []; for (const s of svc) { ac.push(s); ac.push(s + ' company'); }
  for (const k of KIW.uniq(ac).slice(0, KIW.CAPS.autocomplete)) reqs.push(KIW.rq.autocomplete(k, m));
  reqs.push(KIW.rq.ideas(seeds, m));
  for (const s of svc.slice(0, KIW.CAPS.sugg_n)) reqs.push(KIW.rq.suggestions(s, m));
  for (const s of seeds.slice(0, KIW.CAPS.related_n)) reqs.push(KIW.rq.related(s, m));
}
const chosen = (p.chosen || []);
for (const d of chosen.filter(d => !fresh(ck('rk', p.market, d), 'ranked')).slice(0, Math.max(0, KIW.N(p.comp_rk_cap) || 0))) reqs.push(KIW.rq.ranked(d, m));
if (chosen.length && !fresh(ck('pi', p.market, KIW.hash(chosen.slice().sort().join('|'))), 'ranked')) {
  const r = KIW.rq.intersection(chosen.map(h => 'https://' + h + '/*'), ['https://' + KIW.host(p.domain) + '/*'], m); r.body[0].include_subdomains = true; reqs.push(r); }
return reqs.length ? reqs.map(j => ({ json: j })) : [{ json: { skip: true, reason: 'every discovery list is fresh: nothing is bought again' } }];
