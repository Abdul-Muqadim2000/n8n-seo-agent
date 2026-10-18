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
// R60 (2026-10-16): the category question came from the highest-volume commercial keyword of the research pool ("ai in cloud", seeded
// from orphan headings), so ChatGPT and Perplexity were asked about "the best ai in cloud company" and the report raised three findings
// on the answer. The site's own words come first: the keywords the owner configured, then the research pool, then the seeds.
let own91 = [];
try { const r = $('Load Site Row (Model)').first().json || {}; const bare = (x) => String(x || '').toLowerCase().replace(/^www\./, '');
  if (r.domain && bare(r.domain) === bare(base.domain)) own91 = String(r.keywords || '').split(/[,;\n]+/).map(s => s.trim().toLowerCase()).filter(s => s && !s.includes(String(base.domain).split('.')[0].toLowerCase())); } catch (e) {}
if (own91[0]) category = own91[0];
else if (pool[0]) category = pool[0].keyword;
else if (seeds[0]) category = seeds[0];
const place91 = /\b(uae|u\.a\.e|dubai|abu dhabi|sharjah|ajman|ksa|saudi|riyadh|jeddah|qatar|doha|oman|muscat|bahrain|kuwait|gcc|egypt|india|pakistan|uk|usa)\b/i;
if (category && !/\b(company|companies|agency|agencies|services?|providers?|firms?|partners?|best|top)\b/i.test(category)) category = /\b(software|platforms?|tools?|apps?|systems?|solutions?)\b/i.test(category) ? 'best ' + category : 'best ' + category + ' company';
if (category && base.country && !category.toLowerCase().includes(String(base.country).toLowerCase()) && !place91.test(category)) category = category + ' ' + base.country;

// ---- B-2 (2026-10-17, re-rating 2026-10-17, exec 767, High): the brand was judged from ONE results page for "tech&" — a form a search
// engine reads as "tech" — while Search Console in the same run had "techand" #4.5 and "tech & ai" #2.7. Every brand form is listed (the
// domain's label, the configured brand names, the business name); a form that a search engine reads as another search is not searched and
// says why; at most two are searched. GSC Audit Findings then judges the brand from Search Console's own brand queries.
const __sq128 = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const __bare128 = (x) => String(x || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const __names128 = [];
try { const r = $('Load Site Row (Model)').first().json || {}; if (r.domain && __bare128(r.domain) === __bare128(base.domain)) __names128.push(...String(r.brand_names || '').split(/[,;\n]+/), r.business_name); } catch (e) {}
try { const m = $('Restore Site Model').first().json.site_model || {}; if (!m.domain || __bare128(m.domain) === __bare128(base.domain)) __names128.push(...(Array.isArray(m.brand_names) ? m.brand_names : String(m.brand_names || '').split(/[,;\n]+/)), m.business_name); } catch (e) {}
__names128.push(brandName);
const brand_forms = [];
const __addForm128 = (form, source) => {
  const f = String(form || '').trim(); if (!f) return; const low = f.toLowerCase(); if (brand_forms.some(b => b.form === low)) return;
  const letters = __sq128(f); let searched = true, why = '';
  if (!/^[a-z0-9 .-]+$/i.test(f)) { searched = false; why = 'a search engine drops its symbols and reads it as "' + low.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() + '", another search'; }
  else if (letters.length < 4) { searched = false; why = 'too short to name only this business'; }
  else { const twin = brand_forms.find(b => b.searched && __sq128(b.form) === letters); if (twin) { searched = false; why = 'the same search as "' + twin.form + '"'; } }
  brand_forms.push({ form: low, source, searched, why });
};
__addForm128(String(base.domain || '').split('.')[0], 'the domain name');
for (const n of __names128) __addForm128(n, 'the business name');
const __brandQs128 = brand_forms.filter(b => b.searched).slice(0, 2);
for (const b of brand_forms.filter(b => b.searched).slice(2)) { b.searched = false; b.why = 'two brand searches are read per report'; }
const queries = [
  ...__brandQs128.map(b => ({ query: b.form, type: 'brand' })),
  { query: 'site:' + base.domain, type: 'index' }
];
if (category) queries.push({ query: category.toLowerCase(), type: 'category' });
if (pool[0] && pool[0].keyword !== category) queries.push({ query: pool[0].keyword, type: 'top keyword' });

const seen = new Set();
return queries.filter(q => q.query && !seen.has(q.query) && seen.add(q.query))
  .map(q => ({ json: { ...q, brand_name: brandName, category_query: category, brand_forms } }));
