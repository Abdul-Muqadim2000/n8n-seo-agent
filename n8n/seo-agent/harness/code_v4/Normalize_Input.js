// v4: validation errors no longer crash the run. They are returned as { validation_error } and shown to the
// user (form completion page) or returned as HTTP 400 (API). See "Input OK?" right after Rate Limit.
let __via_webhook = false;
try { $('Start Form').first(); } catch (e) { __via_webhook = true; }
const __main = () => {
// ===================== CONFIG (edit here only) =====================
const CONFIG = {
  brand: 'Dev SEO',                 // shown on reports and emails
  crawl_max_pages: 200,             // DataForSEO on-page crawl size (also used when reading crawled pages)
  crawl_js: false,                  // true = render JavaScript during the crawl (slower, costs more)
  qa_max_rounds: 2,   // one editor pass: live tests showed a second pass inflates length without raising the score                 // how many times the Editor may revise content that fails QA
  default_country: 'United States',
  ai_budget_usd: 10,                // estimated Claude spend allowed per budget period (see Rate Limit); raised from 3 on 2026-10-01 at the user's request to finish the system test — the Anthropic Console workspace limit is the hard cap
  ai_budget_period: 'day',          // 'day' | 'month' — daily window while testing; the Anthropic Console workspace limit is the hard cap
  ladder_pages_default: 1,          // ladder mode: pages written immediately (1-3; each page is its own content run)
  ladder_tracker_cadence: 'weekly', // the Rank Tracker workflow runs weekly; 'monthly' is documentation only until its schedule is changed
  ladder_auto_next_rung: false,     // false = the tracker recommends the next rung (one-click form link + API body); true is not wired
  wordpress_publish: false          // true + wordpress_url in the request = every generated page is also created as a WordPress DRAFT
};

// DataForSEO location codes are 2000 + ISO-3166 numeric code
const COUNTRIES = {
  'United States':        { code: 2840, iso: 'US', lang: 'en', language: 'English', spelling: 'American English',   currency: 'USD' },
  'United Kingdom':       { code: 2826, iso: 'GB', lang: 'en', language: 'English', spelling: 'British English',    currency: 'GBP' },
  'Canada':               { code: 2124, iso: 'CA', lang: 'en', language: 'English', spelling: 'Canadian English',   currency: 'CAD' },
  'Australia':            { code: 2036, iso: 'AU', lang: 'en', language: 'English', spelling: 'Australian English', currency: 'AUD' },
  'New Zealand':          { code: 2554, iso: 'NZ', lang: 'en', language: 'English', spelling: 'British English',    currency: 'NZD' },
  'Ireland':              { code: 2372, iso: 'IE', lang: 'en', language: 'English', spelling: 'British English',    currency: 'EUR' },
  'Pakistan':             { code: 2586, iso: 'PK', lang: 'en', language: 'English', spelling: 'British English',    currency: 'PKR' },
  'India':                { code: 2356, iso: 'IN', lang: 'en', language: 'English', spelling: 'British English',    currency: 'INR' },
  'United Arab Emirates': { code: 2784, iso: 'AE', lang: 'en', language: 'English', spelling: 'British English',    currency: 'AED' },
  'Saudi Arabia':         { code: 2682, iso: 'SA', lang: 'en', language: 'English', spelling: 'British English',    currency: 'SAR' },
  'Singapore':            { code: 2702, iso: 'SG', lang: 'en', language: 'English', spelling: 'British English',    currency: 'SGD' },
  'South Africa':         { code: 2710, iso: 'ZA', lang: 'en', language: 'English', spelling: 'British English',    currency: 'ZAR' },
  'Germany':              { code: 2276, iso: 'DE', lang: 'de', language: 'German',  spelling: 'German',             currency: 'EUR' },
  'France':               { code: 2250, iso: 'FR', lang: 'fr', language: 'French',  spelling: 'French',             currency: 'EUR' },
  'Spain':                { code: 2724, iso: 'ES', lang: 'es', language: 'Spanish', spelling: 'European Spanish',   currency: 'EUR' },
  'Italy':                { code: 2380, iso: 'IT', lang: 'it', language: 'Italian', spelling: 'Italian',            currency: 'EUR' },
  'Netherlands':          { code: 2528, iso: 'NL', lang: 'nl', language: 'Dutch',   spelling: 'Dutch',              currency: 'EUR' },
  'Brazil':               { code: 2076, iso: 'BR', lang: 'pt', language: 'Portuguese', spelling: 'Brazilian Portuguese', currency: 'BRL' },
  'Mexico':               { code: 2484, iso: 'MX', lang: 'es', language: 'Spanish', spelling: 'Mexican Spanish',    currency: 'MXN' }
};
// ===================================================================

let p1, raw, via_webhook;
try {
  p1 = $('Start Form').first().json;
  raw = $input.first().json;
  via_webhook = false;
} catch (e) {
  // No Start Form in this execution -> triggered by the Webhook
  p1 = { 'What do you want?': 'I know my keyword' };
  raw = $input.first().json || {};
  via_webhook = true;
}
// n8n's Webhook node wraps the payload as { headers, params, query, body }
const p2 = (raw && raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : (raw || {});

function pick(obj, ...words) {
  const key = Object.keys(obj || {}).find(k =>
    words.every(w => k.toLowerCase().replace(/[\s_-]+/g, ' ').includes(w))
  );
  return key ? obj[key] : '';
}
function asArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v) return v.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  return [];
}
function cleanDomain(v) {
  return String(v || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '');
}
// Public hostnames only: no IP literals, no localhost/internal names (SSRF guard)
const domainOk = (d) => {
  if (!d || d.length > 253) return false;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(d)) return false;
  if (/^\[?[0-9a-f:]+\]?$/.test(d) && d.includes(':')) return false;
  if (/(^|\.)(localhost|local|internal|localdomain|home|lan|corp|intranet|test|example|invalid)$/.test(d)) return false;
  return /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(xn--[a-z0-9-]+|[a-z]{2,24})$/.test(d);
};

// ---------- Mode ----------
const choice = String(pick(p1, 'what', 'want') || '').toLowerCase();
let mode = 'discover';
let verdict_only = false;
if (choice.includes('check') && choice.includes('keyword')) { mode = 'keyword'; verdict_only = true; }
else if (choice.includes('know')) mode = 'keyword';
else if (choice.includes('describe')) mode = 'site_description';
else if (choice.includes('audit')) mode = 'audit';
else if (choice.includes('rank my site') || choice.includes('ladder')) mode = 'ladder';
if (via_webhook) {
  const m = String(p2.mode || '').toLowerCase();
  if (m === 'verdict' || m === 'check') { mode = 'keyword'; verdict_only = true; }
  else if (m === 'audit') mode = 'audit';
  else if (m === 'discover') mode = 'discover';
  else if (m === 'describe') mode = 'site_description';
  else if (m === 'ladder') mode = 'ladder';
}

// ---------- Country (name or ISO-2 code) ----------
const countryRaw = String(pick(p2, 'country') || '').trim();
let countryName = Object.keys(COUNTRIES).find(n => n.toLowerCase() === countryRaw.toLowerCase())
  || Object.keys(COUNTRIES).find(n => COUNTRIES[n].iso === countryRaw.toUpperCase())
  || (mode === 'site_description' ? CONFIG.default_country : '');
const c = COUNTRIES[countryName] || null;
if (mode !== 'site_description' && !c) throw new Error('Please select a Target Country.');

// ---------- Domain / email ----------
const domain = cleanDomain(pick(p2, 'domain') || pick(p2, 'website'));
if (domain && !domainOk(domain)) throw new Error('Please enter a public website address like example.com');

const email = String(pick(p2, 'email') || '').trim().toLowerCase();
if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');

const callback_url = String(pick(p2, 'callback') || '').trim();
if (callback_url && !/^(https:\/\/[^\s]+|http:\/\/(localhost|127\.0\.0\.1|host\.docker\.internal|n8n)(:\d+)?\/[^\s]*)$/.test(callback_url)) throw new Error('callback_url must be an https URL (plain http is allowed only for localhost while testing).');

const competitors = asArray(pick(p2, 'competitor')).map(cleanDomain).filter(domainOk).filter(d => d !== domain).slice(0, 3);

// ---------- Other fields ----------
const features = asArray(pick(p2, 'feature')).map(f => String(f).toLowerCase());
const wants = asArray(pick(p2, 'receive')).map(w => String(w).toLowerCase());
const reportType = String(pick(p2, 'report type') || pick(p2, 'report_type') || '').toLowerCase();
const keyword  = String(pick(p2, 'keyword') || '').trim().toLowerCase().replace(/\s+/g, ' ');
const business = String(pick(p2, 'business') || '').trim();
const audience = String(pick(p2, 'customer') || pick(p2, 'audience') || '').trim();
const pageType = String(pick(p2, 'page', 'type') || '').trim() || 'Service Page';
const business_facts = String(pick(p2, 'facts') || p2.business_facts || '').trim().slice(0, 2000);
const cta = String(pick(p2, 'call', 'action') || p2.cta || '').trim().slice(0, 200);
const tone = String(pick(p2, 'tone') || '').trim();
const goalRaw = String(pick(p2, 'goal') || '').toLowerCase();
const goal = /sell|sales/.test(goalRaw) ? 'sales' : /traffic|educat|rank/.test(goalRaw) ? 'traffic' : /brand/.test(goalRaw) ? 'brand' : 'leads';
const pagesRaw = parseInt(String(pick(p2, 'pages to write') || p2.pages_now || CONFIG.ladder_pages_default), 10);
const pages_now = Math.min(3, Math.max(1, isNaN(pagesRaw) ? CONFIG.ladder_pages_default : pagesRaw));
const ladder_links = Array.isArray(p2.ladder_links) ? p2.ladder_links.filter(l => l && l.url).slice(0, 20) : [];
const wordpress_url = String(p2.wordpress_url || '').trim();
let existing_page_url = String(pick(p2, 'existing') || '').trim();
if (existing_page_url && !/^https?:\/\//i.test(existing_page_url)) existing_page_url = 'https://' + existing_page_url.replace(/^\/+/, '');
if (existing_page_url && domain && cleanDomain(existing_page_url) !== domain) throw new Error('The existing page URL must be on ' + domain);

// ---------- What to produce ----------
let include_seo_report = false, include_content = false, include_audit = false, include_full_report = false;

if (mode === 'audit') {
  if (reportType.includes('full')) include_full_report = true; else include_audit = true;
} else if (mode === 'ladder') {
  include_seo_report = true; include_content = true;   // used by the page runs the ladder spawns (mode keyword)
} else if (mode === 'keyword' || mode === 'discover') {
  include_seo_report  = wants.some(w => w.includes('keyword report') || w.includes('seo report') || w === 'report');
  include_content     = wants.some(w => w.includes('content'));
  include_audit       = features.some(f => f.includes('site audit')) || wants.some(w => w.includes('site audit'));
  include_full_report = features.some(f => f.includes('full seo')) || wants.some(w => w.includes('full seo'));
  if (mode === 'keyword' && !verdict_only && !wants.length) {
    // Nothing ticked under "What do you want to receive?" -> default to both deliverables
    include_content = true;
    include_seo_report = true;
  }
}
if (include_full_report) include_audit = true;
if (verdict_only) { include_seo_report = false; include_content = false; include_audit = false; include_full_report = false; }

// ---------- Validation ----------
if (mode === 'keyword' && !keyword) throw new Error('Please enter a Target Keyword.');
if (mode === 'discover' && !business && !domain) throw new Error('Please describe your business OR enter your website domain.');
if ((mode === 'site_description' || mode === 'audit') && !domain) throw new Error('Website Domain is required.');
if (include_audit && !domain) throw new Error('Site Audit and Full SEO Report need your website domain.');
const deliverable = !!email || (via_webhook && !!callback_url);   // a callback is a valid delivery channel for API callers
if (mode === 'audit' && !deliverable) throw new Error('Email is required — the audit report is sent by email.');
if (mode === 'ladder' && !keyword) throw new Error('Please enter the keyword you want to rank for.');
if (mode === 'ladder' && !domain) throw new Error('Website Domain is required: the ladder is planned for your site.');
if (mode === 'ladder' && !deliverable) throw new Error('Please add your email — the ladder plan and the pages are sent by email.');
if (mode === 'discover' && (include_content || include_seo_report || include_audit) && !deliverable) {
  throw new Error('Please add your email — the extra reports you selected are sent by email.');
}

if (via_webhook && !callback_url && !email) throw new Error('API requests need a callback_url (https) or an email address so the result can be delivered.');

const need_site_description =
  mode === 'site_description' ||
  (mode === 'discover' && !business) ||
  (mode === 'keyword' && !!domain && !business) ||
  (mode === 'ladder' && !business);

return [{
  json: {
    mode,
    keyword,
    business,
    audience,
    domain,
    email,
    competitors,
    page_type: pageType,
    business_facts,
    cta,
    tone,
    goal,
    existing_page_url,
    country: c ? countryName : null,
    country_iso: c ? c.iso : null,
    location_code: c ? c.code : null,
    language_code: c ? c.lang : 'en',
    language_name: c ? c.language : 'English',
    spelling: c ? c.spelling : 'American English',
    currency: c ? c.currency : null,
    include_seo_report,
    include_content,
    include_audit,
    include_full_report,
    verdict_only,
    audit_level: include_full_report ? 'full' : (include_audit ? 'site_audit' : null),
    need_site_description,
    via_webhook,
    callback_url,
    request_id: String(p2.request_id || ''),
    client_ip: String(p2.client_ip || ''),
    run_page_check: domain !== '' && (features.some(f => f.includes('page exists')) || !!existing_page_url || mode === 'ladder'),
    pages_now,
    pipeline_source: String(p2.pipeline_source || ''),
    chosen_keyword_reason: String(p2.chosen_keyword_reason || '').slice(0, 300),
    ladder_id: String(p2.ladder_id || (mode === 'ladder' ? 'lad_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : '')),
    ladder_rung: (p2.ladder_rung != null && p2.ladder_rung !== '') ? Number(p2.ladder_rung) : null,
    ladder_head: String(p2.ladder_head || ''),
    ladder_links,
    force_content: !!p2.force_content,
    publish_wordpress: !!CONFIG.wordpress_publish && !!wordpress_url,
    wordpress_url,
    tracker_cadence: CONFIG.ladder_tracker_cadence,
    auto_next_rung: !!CONFIG.ladder_auto_next_rung,
    run_site_audit: include_audit,
    brand: CONFIG.brand,
    crawl_max_pages: CONFIG.crawl_max_pages,
    crawl_js: CONFIG.crawl_js,
    qa_max_rounds: CONFIG.qa_max_rounds,
    ai_budget_usd: CONFIG.ai_budget_usd,
    ai_budget_period: CONFIG.ai_budget_period,
    started_at: new Date().toISOString(),
    validation_error: ''
  }
}];

};
try { return __main(); }
catch (e) {
  // keep the delivery fields so the rejection can still be reported to the caller
  let __raw = {}; try { const r = $input.first().json || {}; __raw = (r.body && typeof r.body === 'object' && !Array.isArray(r.body)) ? r.body : r; } catch (e2) {}
  const __cb = String(__raw.callback_url || '').trim();
  const __cbOk = /^(https:\/\/[^\s]+|http:\/\/(localhost|127\.0\.0\.1|host\.docker\.internal|n8n)(:\d+)?\/[^\s]*)$/.test(__cb) ? __cb : '';
  return [{ json: { validation_error: String(e && e.message || e).replace(/^Error:\s*/, ''), via_webhook: __via_webhook, mode: null, brand: 'Dev SEO', callback_url: __cbOk, request_id: String(__raw.request_id || ''), email: String(__raw.email || '').trim().toLowerCase() } }];
}
