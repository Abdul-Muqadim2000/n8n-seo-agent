// From the primary-seed SERP, pick the 3 closest competitors and fetch the keywords they rank for (top 20 positions).
// Always emits at least one request so the chain never stalls.
const base = $('Seed List').first().json;
const reqs = $('Research Requests').all().map(i => i.json);
const res = $input.all().map(i => i.json);
const BIG = ['microsoft.com', 'google.com', 'youtube.com', 'linkedin.com', 'facebook.com', 'wikipedia.org', 'amazon.com', 'apple.com', 'reddit.com', 'quora.com',
  'medium.com', 'instagram.com', 'twitter.com', 'x.com', 'pinterest.com', 'tiktok.com', 'github.com', 'indeed.com', 'glassdoor.com', 'forbes.com', 'clutch.co', 'g2.com',
  'goodfirms.co', 'capterra.com', 'trustpilot.com', 'crunchbase.com', 'yelp.com', 'upwork.com', 'fiverr.com', 'sortlist.com', 'designrush.com', 'gartner.com', 'techtarget.com',
  'investopedia.com', 'hubspot.com', 'salesforce.com', 'oracle.com', 'sap.com', 'shopify.com', 'coursera.org', 'udemy.com'];
const ours = String(base.domain || '').toLowerCase();
const clean = (x) => String(x || '').toLowerCase().replace(/^www\./, '');
const isBig = (x) => BIG.some(b => x === b || x.endsWith('.' + b)) || /\.(gov|edu)(\.|$)/.test(x);
const serpIdx = reqs.findIndex(r => r.kind === 'serp');
const items = serpIdx >= 0 ? (res[serpIdx]?.tasks?.[0]?.result?.[0]?.items || []) : [];
// prefer domains that clearly serve the client's country (ccTLD or country/city words in the result), then fill with the rest
const iso = String(base.country_iso || '').toLowerCase();
const COUNTRY_WORDS = { ae: ['uae', 'dubai', 'abu dhabi', 'sharjah', 'emirates'], sa: ['saudi', 'riyadh', 'jeddah', 'ksa'], pk: ['pakistan', 'karachi', 'lahore', 'islamabad'], in: ['india', 'mumbai', 'delhi', 'bangalore', 'bengaluru'], gb: ['uk', 'united kingdom', 'london', 'british'], au: ['australia', 'sydney', 'melbourne'], ca: ['canada', 'toronto', 'vancouver'], sg: ['singapore'], za: ['south africa', 'johannesburg', 'cape town'], de: ['deutschland', 'germany', 'berlin', 'münchen'], fr: ['france', 'paris'], es: ['españa', 'spain', 'madrid'], it: ['italia', 'italy', 'milano'], nl: ['nederland', 'netherlands', 'amsterdam'], br: ['brasil', 'brazil', 'são paulo'], mx: ['méxico', 'mexico'], nz: ['new zealand', 'auckland'], ie: ['ireland', 'dublin'], us: [] };
const words = COUNTRY_WORDS[iso] || [];
const isLocal = (it, dm) => (iso && iso !== 'us' && dm.endsWith('.' + iso)) || words.some(w => ((it.title || '') + ' ' + (it.description || '') + ' ' + (it.url || '')).toLowerCase().includes(w));
const seen = new Set(); const local = [], other = [];
for (const it of items) {
  if (it.type !== 'organic') continue;
  const dm = clean(it.domain);
  if (!dm || dm === ours || (ours && dm.endsWith('.' + ours)) || isBig(dm) || seen.has(dm)) continue;
  seen.add(dm); (isLocal(it, dm) ? local : other).push(dm);
}
const domains = [...local, ...other].slice(0, 3);
const L = 'https://api.dataforseo.com/v3/dataforseo_labs/google/';
const loc = base.location_code, lang = base.language_code || 'en';
const out = domains.map(dm => ({ kind: 'competitor', label: 'keywords ' + dm + ' ranks for', domain: dm, endpoint: L + 'ranked_keywords/live',
  body: [{ target: dm, location_code: loc, language_code: lang, limit: 300, order_by: ['keyword_data.keyword_info.search_volume,desc'],
    filters: [['ranked_serp_element.serp_item.rank_group', '<=', 20], 'and', ['keyword_data.keyword_info.search_volume', '>', 10]] }] }));
if (!out.length) out.push({ kind: 'ideas', label: 'keyword ideas (phrase match)', endpoint: L + 'keyword_ideas/live',
  body: [{ keywords: (base.seeds || []).slice(0, 20), location_code: loc, language_code: lang, limit: 300, include_serp_info: true, closely_variants: true }] });
return out.map(r => ({ json: { ...r, competitor_domains: domains } }));
