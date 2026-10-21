/*__REACH__*/
/*__SERP_CACHE__*/
/*__COUNTRIES__*/
/*__DOMAIN_RULES__*/
// Keyword Check (v4.8, PIPELINE_FEATURE_SPEC §5.2): validates POST /webhook/seo-keyword-assess { keyword, country, domain, business?, services?,
// existing_keywords? } with the main workflow's own country list and domain rules (copied in by build_api.py). Invalid -> 400 with one message per
// field. The daily limit per caller (the web app sends X-Forwarded-For app:<company>, 40 a day each; 400 a day in total -> 429) is checked by
// Assess Limit from the run ledger after this request reserved its row (v4.14, D1).
const raw = $input.first().json || {};
const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : {};
const hdr = raw.headers || {};
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
// the caller's key for the daily limit (v4.14, D1: counted by Assess Limit from the run ledger once this valid request has reserved its row)
const client = String(hdr['x-forwarded-for'] || hdr['x-real-ip'] || '').split(',')[0].trim().toLowerCase();
const key = /^app:[a-z0-9-]{6,64}$/.test(client) ? client : (client || 'anon');
const c = COUNTRIES[countryName] || {};
// KWL-LAD D7 (live run 2026-10-21, exec 120): an Arabic keyword's results page was asked for in English. The results page of a keyword written in
// Arabic script is read in Arabic (language_code ar, the site's own location); the keyword data keeps the market's language as before.
const arabicScript = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(keyword);
const serpLang = arabicScript ? 'ar' : (c.lang || 'en');
return [{ json: { ok: !bad, status: bad ? 400 : 200, errors, error: bad ? Object.values(errors).join('; ') : '',
  keyword, domain, site_id: domain ? reachSiteId(domain) : '', country: countryName, country_iso: c.iso || '', location_code: c.code || null, language_code: c.lang || 'en',
  business: typeof b.business === 'string' ? b.business.trim().slice(0, 1500) : '', services: listOf(b.services).slice(0, 20).map(s => s.slice(0, 120)),
  existing_keywords: listOf(b.existing_keywords).slice(0, 300).map(s => s.toLowerCase().slice(0, 120)), caller: key, serp_language_code: serpLang, arabic_script: arabicScript, serp_cache_key: SC.key({ keyword, location_code: c.code || 0, language_code: serpLang }), request_id: String(b.request_id || ('assess-' + $execution.id)) } }];
