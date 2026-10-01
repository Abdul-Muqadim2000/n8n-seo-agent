// Live Google queries for the AI-visibility and brand checks. Each item becomes one SERP request.
const base = $input.first().json;
const __brandMatch = String((base.content_review || {}).business_context || '').match(/^([A-Z][\w&.-]+(?:\s[A-Z][\w&.-]+){0,2})/);
const brandName = (__brandMatch && __brandMatch[1]) || base.domain.split('.')[0];

const sk = base.site_keywords || {};
const pool = [
  ...(sk.keyword_gap || []),
  ...Object.values(sk.opportunities_by_intent || {}).flat(),
  ...Object.values(sk.your_top_by_intent || {}).flat()
].filter(k => ['commercial', 'transactional'].includes(k.intent))
 .sort((a, b) => (b.volume || 0) - (a.volume || 0));

// Category query: what a buyer types to find this type of business in the target country
let category = '';
const seeds = (sk.seeds || []).filter(Boolean);
if (pool[0]) category = pool[0].keyword;
else if (seeds[0]) category = seeds[0];
if (category && !/\b(company|companies|agency|agencies|services?|providers?|firms?|best|top)\b/i.test(category)) category = 'best ' + category + ' company';
if (category && base.country && !category.toLowerCase().includes(String(base.country).toLowerCase())) category = category + ' ' + base.country;

const queries = [
  { query: brandName.toLowerCase(), type: 'brand' },
  { query: 'site:' + base.domain, type: 'index' }
];
if (category) queries.push({ query: category.toLowerCase(), type: 'category' });
if (pool[0] && pool[0].keyword !== category) queries.push({ query: pool[0].keyword, type: 'top keyword' });

const seen = new Set();
return queries.filter(q => q.query && !seen.has(q.query) && seen.add(q.query))
  .map(q => ({ json: { ...q, brand_name: brandName, category_query: category } }));
