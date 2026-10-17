/*__KW_INPUTS__*/
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
const BIG = ['microsoft.com', 'google.com', 'youtube.com', 'linkedin.com', 'facebook.com', 'wikipedia.org', 'amazon.com', 'apple.com', 'reddit.com', 'quora.com',
  'medium.com', 'instagram.com', 'twitter.com', 'x.com', 'pinterest.com', 'tiktok.com', 'github.com', 'indeed.com', 'glassdoor.com', 'forbes.com', 'clutch.co', 'g2.com',
  'goodfirms.co', 'capterra.com', 'trustpilot.com', 'crunchbase.com', 'yelp.com', 'upwork.com', 'fiverr.com', 'sortlist.com', 'designrush.com', 'gartner.com', 'techtarget.com',
  'investopedia.com', 'hubspot.com', 'salesforce.com', 'oracle.com', 'sap.com', 'shopify.com', 'coursera.org', 'udemy.com'];
const ours = String(base.domain || '').toLowerCase().replace(/^www\./, '');
const clean = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const isBig = (x) => BIG.some(b => x === b || x.endsWith('.' + b)) || /\.(gov|edu)(\.|$)/.test(x);
const isOurs = (dm) => !dm || dm === ours || (ours && dm.endsWith('.' + ours));
const serpIdx = reqs.findIndex(r => r.kind === 'serp');
const serpKw = serpIdx >= 0 ? String((((reqs[serpIdx] || {}).body || [])[0] || {}).keyword || base.primary_seed || '') : '';
const items = serpIdx >= 0 ? (res[serpIdx]?.tasks?.[0]?.result?.[0]?.items || []) : [];
// prefer domains that clearly serve the client's country (ccTLD or country/city words in the result), then fill with the rest
const iso = String(base.country_iso || '').toLowerCase();
const COUNTRY_WORDS = { ae: ['uae', 'dubai', 'abu dhabi', 'sharjah', 'emirates'], sa: ['saudi', 'riyadh', 'jeddah', 'ksa'], pk: ['pakistan', 'karachi', 'lahore', 'islamabad'], in: ['india', 'mumbai', 'delhi', 'bangalore', 'bengaluru'], gb: ['uk', 'united kingdom', 'london', 'british'], au: ['australia', 'sydney', 'melbourne'], ca: ['canada', 'toronto', 'vancouver'], sg: ['singapore'], za: ['south africa', 'johannesburg', 'cape town'], de: ['deutschland', 'germany', 'berlin', 'münchen'], fr: ['france', 'paris'], es: ['españa', 'spain', 'madrid'], it: ['italia', 'italy', 'milano'], nl: ['nederland', 'netherlands', 'amsterdam'], br: ['brasil', 'brazil', 'são paulo'], mx: ['méxico', 'mexico'], nz: ['new zealand', 'auckland'], ie: ['ireland', 'dublin'], us: [] };
const words = COUNTRY_WORDS[iso] || [];
const isLocal = (it, dm) => (iso && iso !== 'us' && dm.endsWith('.' + iso)) || words.some(w => ((it.title || '') + ' ' + (it.description || '') + ' ' + (it.url || '')).toLowerCase().includes(w));
// 1. the competitors the owner declared (Track my site / Site Admin `monitors`, carried by the site model)
const declaredRaw = [...(Array.isArray(base.competitors) ? base.competitors : String(base.competitors || '').split(/[,;\n]+/)),
  ...(((base.site_model || {}).competitors) || [])].map(clean).filter(Boolean);
const declared = [...new Set(declaredRaw)].filter(dm => !isOurs(dm) && !isBig(dm) && !KWI.competitorClass(dm, 'https://' + dm + '/', '')).slice(0, 2);
// 2. the businesses of the results page, the rest passed over with their class
const seen = new Set(declared); const local = [], other = []; const skipped = [];
for (const it of items) {
  if (it.type !== 'organic') continue;
  const dm = clean(it.domain);
  if (isOurs(dm) || seen.has(dm)) continue;
  seen.add(dm);
  const cls = KWI.competitorClass(dm, it.url, it.title) || (isBig(dm) ? 'a household name / platform' : '');
  if (cls) { skipped.push({ domain: dm, position: it.rank_group || it.rank_absolute || null, title: String(it.title || '').slice(0, 90), why: cls }); continue; }
  (isLocal(it, dm) ? local : other).push({ domain: dm, position: it.rank_group || it.rank_absolute || null });
}
const fromSerp = [...local, ...other].slice(0, Math.max(0, 3 - declared.length));
const picked = [...declared.map(dm => ({ domain: dm, how: 'declared by you as a competitor' })),
  ...fromSerp.map(x => ({ domain: x.domain, how: 'ranks' + (x.position ? ' #' + x.position : '') + ' for "' + serpKw + '" and sells, not lists, jobs or news' }))];
const domains = picked.map(p => p.domain);
const competitor_basis = { picked, skipped: skipped.slice(0, 12), serp_keyword: serpKw,
  note: (declared.length ? declared.length + ' competitor(s) you declared' + (fromSerp.length ? ', then ' : '') : '') + (fromSerp.length ? 'the first business' + (fromSerp.length > 1 ? 'es' : '') + ' on Google\'s results for "' + serpKw + '"' : '')
    + (skipped.length ? ' (passed over on that page: ' + skipped.slice(0, 5).map(s => s.domain + ' — ' + s.why).join(', ') + ')' : '') };
const L = 'https://api.dataforseo.com/v3/dataforseo_labs/google/';
const loc = base.location_code, lang = base.language_code || 'en';
const out = domains.map(dm => ({ kind: 'competitor', label: 'keywords ' + dm + ' ranks for', domain: dm, endpoint: L + 'ranked_keywords/live',
  body: [{ target: dm, location_code: loc, language_code: lang, limit: 300, order_by: ['keyword_data.keyword_info.search_volume,desc'],
    filters: [['ranked_serp_element.serp_item.rank_group', '<=', 20], 'and', ['keyword_data.keyword_info.search_volume', '>', 10]] }] }));
if (!out.length) out.push({ kind: 'ideas', label: 'keyword ideas (phrase match)', endpoint: L + 'keyword_ideas/live',
  body: [{ keywords: (base.seeds || []).slice(0, 20), location_code: loc, language_code: lang, limit: 300, include_serp_info: true, closely_variants: true }] });
return out.map(r => ({ json: { ...r, competitor_domains: domains, competitor_basis } }));
