/*__REACH__*/
/*__COUNTRIES__*/
/*__DOMAIN_RULES__*/
// Keyword Check (v4.8, PIPELINE_FEATURE_SPEC §5.2): validates POST /webhook/seo-keyword-assess { keyword, country, domain, business?, services?,
// existing_keywords? } with the main workflow's own country list and domain rules (copied in by build_api.py). Invalid -> 400 with one message per
// field; a daily limit per caller (the web app sends X-Forwarded-For app:<company>, 40 a day each; 400 a day in total) -> 429.
const raw = $input.first().json || {};
const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : {};
const hdr = raw.headers || {};
const LIMITS = { per_key_per_day: 40, global_per_day: 400 };
const errors = {};
const keyword = String(b.keyword == null ? '' : b.keyword).toLowerCase().replace(/\s+/g, ' ').trim();
if (typeof b.keyword !== 'string' || keyword.length < 2 || keyword.length > 100) errors.keyword = 'keyword must be 2-100 characters';
const domain = cleanDomain(typeof b.domain === 'string' ? b.domain : '');
if (!domain || !domainOk(domain)) errors.domain = 'domain must be a public website address like example.com';
const countryRaw = String(typeof b.country === 'string' ? b.country : '').trim();
const countryName = Object.keys(COUNTRIES).find(n => n.toLowerCase() === countryRaw.toLowerCase()) || Object.keys(COUNTRIES).find(n => COUNTRIES[n].iso === countryRaw.toUpperCase()) || '';
if (!countryName) errors.country = 'country must be one of ' + Object.keys(COUNTRIES).join(', ') + ' (name or ISO-2 code)';
if (b.business != null && typeof b.business !== 'string') errors.business = 'business must be a string';
if (b.services != null && !Array.isArray(b.services) && typeof b.services !== 'string') errors.services = 'services must be an array of strings or a comma-separated string';
if (b.existing_keywords != null && !Array.isArray(b.existing_keywords)) errors.existing_keywords = 'existing_keywords must be an array of strings';
const listOf = (v) => (Array.isArray(v) ? v : (typeof v === 'string' ? v.split(/[\n,;]+/) : [])).map(x => String(x == null ? '' : x).trim()).filter(Boolean);
const bad = Object.keys(errors).length > 0;
// daily limit (counted only for valid requests; static data persists for production webhook runs)
const client = String(hdr['x-forwarded-for'] || hdr['x-real-ip'] || '').split(',')[0].trim().toLowerCase();
const key = /^app:[a-z0-9-]{6,64}$/.test(client) ? client : (client || 'anon');
let limited = '';
if (!bad) {
  const store = $getWorkflowStaticData('global'); const today = new Date().toISOString().slice(0, 10);
  if (!store.assess || store.assess.day !== today) store.assess = { day: today, total: 0, keys: {} };
  const used = store.assess.keys[key] || 0;
  if (used >= LIMITS.per_key_per_day) limited = 'The daily limit of ' + LIMITS.per_key_per_day + ' keyword checks is reached. Please try again tomorrow.';
  else if (store.assess.total >= LIMITS.global_per_day) limited = 'The daily limit of ' + LIMITS.global_per_day + ' keyword checks for all callers is reached. Please try again tomorrow.';
  else { store.assess.keys[key] = used + 1; store.assess.total += 1; }
}
const c = COUNTRIES[countryName] || {};
return [{ json: { ok: !bad && !limited, status: bad ? 400 : limited ? 429 : 200, errors, error: bad ? Object.values(errors).join('; ') : limited,
  keyword, domain, site_id: domain ? reachSiteId(domain) : '', country: countryName, country_iso: c.iso || '', location_code: c.code || null, language_code: c.lang || 'en',
  business: typeof b.business === 'string' ? b.business.trim().slice(0, 1500) : '', services: listOf(b.services).slice(0, 20).map(s => s.slice(0, 120)),
  existing_keywords: listOf(b.existing_keywords).slice(0, 300).map(s => s.toLowerCase().slice(0, 120)), caller: key, request_id: String(b.request_id || ('assess-' + $execution.id)) } }];
