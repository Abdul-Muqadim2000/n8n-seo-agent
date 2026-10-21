/*__COMPETITORS__*/
// From the primary-seed SERP, pick the 3 closest competitors and fetch the keywords they rank for (top 20 positions).
// Always emits at least one request so the chain never stalls.
// A-24 (2026-10-17, re-rating exec 764): the three were "the top three domains of one results page", so for "erp consultants dubai" a job
// board (naukrigulf.com, "ERP Consultant Jobs in UAE - 67 Vacancies") was a competitor and its 300 ranked keywords (careers, hospitals,
// airlines) were 545 of the 1,168 researched; 224 of the 240 reviewed came back off-topic. Now: the competitors the owner declared come
// first (the site model / seo_monitors list), then the results page's businesses only - a job board, a directory or review marketplace, a
// list of companies, a government portal, a news site or a forum is skipped with its class (KWI.competitorClass) - and every request
// says how its domain was chosen (`competitor_basis`) and which results were passed over (`competitor_skipped`), so the report can say it.
const base = $('Seed List').first().json;
const reqs = $('Research Requests').all().map(i => i.json);
const res = $input.all().map(i => i.json);
const ours = String(base.domain || '').toLowerCase().replace(/^www\./, '');
const clean = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
// KW-COMP (2026-10-21, RV-6): every results page this run bought (kind 'serp'; one today) goes through the shared competitor kit (CMP):
// a domain is a competitor only if it is a business (no job board, directory, marketplace, review or media site, authority, search engine,
// social network, Q&A site, help / docs subdomain, course provider or list of companies) and it ranks on those pages, weighted by position;
// with three or more pages it must rank on at least two. The owner's declared competitors stay first. Nothing new is bought.
const serpReqs = reqs.map((r, i) => ({ r, i })).filter(x => x.r.kind === 'serp');
const serpKw = serpReqs.length ? String((((serpReqs[0].r || {}).body || [])[0] || {}).keyword || base.primary_seed || '') : '';
const serps = serpReqs.map(x => ({ keyword: String((((x.r || {}).body || [])[0] || {}).keyword || ''), items: (res[x.i]?.tasks?.[0]?.result?.[0]?.items || []) }));
// a domain that clearly serves the client's country (ccTLD or country / city words in the result) counts a quarter more
const iso = String(base.country_iso || '').toLowerCase();
const COUNTRY_WORDS = { ae: ['uae', 'dubai', 'abu dhabi', 'sharjah', 'emirates'], sa: ['saudi', 'riyadh', 'jeddah', 'ksa'], pk: ['pakistan', 'karachi', 'lahore', 'islamabad'], in: ['india', 'mumbai', 'delhi', 'bangalore', 'bengaluru'], gb: ['uk', 'united kingdom', 'london', 'british'], au: ['australia', 'sydney', 'melbourne'], ca: ['canada', 'toronto', 'vancouver'], sg: ['singapore'], za: ['south africa', 'johannesburg', 'cape town'], de: ['deutschland', 'germany', 'berlin', 'münchen'], fr: ['france', 'paris'], es: ['españa', 'spain', 'madrid'], it: ['italia', 'italy', 'milano'], nl: ['nederland', 'netherlands', 'amsterdam'], br: ['brasil', 'brazil', 'são paulo'], mx: ['méxico', 'mexico'], nz: ['new zealand', 'auckland'], ie: ['ireland', 'dublin'], us: [] };
const words = COUNTRY_WORDS[iso] || [];
const isLocal = (it, dm) => (iso && iso !== 'us' && dm.endsWith('.' + iso)) || words.some(w => ((it.title || '') + ' ' + (it.description || '') + ' ' + (it.url || '')).toLowerCase().includes(w));
// 1. the competitors the owner declared (Track my site / Site Admin `monitors`, carried by the site model), up to two, then the businesses
const declaredRaw = [...(Array.isArray(base.competitors) ? base.competitors : String(base.competitors || '').split(/[,;\n]+/)),
  ...(((base.site_model || {}).competitors) || [])].map(clean).filter(Boolean);
const sel = CMP.select({ serps, declared: [...new Set(declaredRaw)].slice(0, 2), own_domain: ours, n: 3, boost: (it, dm) => isLocal(it, dm) ? 1.25 : 1 });
const picked = sel.picked.slice(0, 3).map(p => ({ domain: p.domain, how: p.evidence, source: p.source, serps: p.serps, of: p.of, keywords: p.keywords }));
const skipped = sel.excluded.map(e => ({ domain: e.domain, title: e.example, why: e.label, kind: e.kind, seen_in: e.seen_in }));
const domains = picked.map(p => p.domain);
const competitor_basis = { picked, skipped: skipped.slice(0, 12), too_few: sel.too_few, serp_keyword: serpKw, serps_read: sel.serps_read, note: sel.note };
const L = 'https://api.dataforseo.com/v3/dataforseo_labs/google/';
const loc = base.location_code, lang = base.language_code || 'en';
const out = domains.map(dm => ({ kind: 'competitor', label: 'keywords ' + dm + ' ranks for', domain: dm, endpoint: L + 'ranked_keywords/live',
  body: [{ target: dm, location_code: loc, language_code: lang, limit: 300, order_by: ['keyword_data.keyword_info.search_volume,desc'],
    filters: [['ranked_serp_element.serp_item.rank_group', '<=', 20], 'and', ['keyword_data.keyword_info.search_volume', '>', 10]] }] }));
if (!out.length) out.push({ kind: 'ideas', label: 'keyword ideas (phrase match)', endpoint: L + 'keyword_ideas/live',
  body: [{ keywords: (base.seeds || []).slice(0, 20), location_code: loc, language_code: lang, limit: 300, include_serp_info: true, closely_variants: true }] });
return out.map(r => ({ json: { ...r, competitor_domains: domains, competitor_basis } }));
