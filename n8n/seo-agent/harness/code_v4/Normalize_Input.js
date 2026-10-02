// v4: validation errors no longer crash the run. They are returned as { validation_error } and shown to the
// user (form completion page) or returned as HTTP 400 (API). See "Input OK?" right after Rate Limit.
let __via_webhook = false;
try { $('Start Form').first(); } catch (e) { __via_webhook = true; }
const __main = () => {
// ===================== CONFIG (edit here only) =====================
const CONFIG = {
  brand: "Dev SEO",   // from n8n/.env (SEO_BRAND) at build time; shown on reports and e-mails
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
else if (choice.includes('track')) mode = 'track';
else if (choice.includes('published')) mode = 'published';
else if (choice.includes('check-in') || choice.includes('checkin')) mode = 'checkin';
else if (choice.includes('case study')) mode = 'case_study';
else if (choice.includes('business profile')) mode = 'profile';
else if (choice.includes('ai visibility')) mode = 'ai_visibility';
else if (choice.includes('backlink')) mode = 'backlinks';
if (via_webhook) {
  const m = String(p2.mode || '').toLowerCase();
  if (m === 'verdict' || m === 'check') { mode = 'keyword'; verdict_only = true; }
  else if (m === 'audit') mode = 'audit';
  else if (m === 'discover') mode = 'discover';
  else if (m === 'describe') mode = 'site_description';
  else if (m === 'ladder') mode = 'ladder';
  else if (m === 'track') mode = 'track';
  else if (m === 'published') mode = 'published';
  else if (m === 'checkin' || m === 'check-in') mode = 'checkin';
  else if (m === 'case_study' || m === 'case-study' || m === 'casestudy') mode = 'case_study';
  else if (m === 'profile') mode = 'profile';
  else if (m === 'ai_visibility' || m === 'ai-visibility' || m === 'ai') mode = 'ai_visibility';
  else if (m === 'backlinks' || m === 'links') mode = 'backlinks';
}

// ---------- Country (name or ISO-2 code) ----------
const countryRaw = String(pick(p2, 'country') || '').trim();
let countryName = Object.keys(COUNTRIES).find(n => n.toLowerCase() === countryRaw.toLowerCase())
  || Object.keys(COUNTRIES).find(n => COUNTRIES[n].iso === countryRaw.toUpperCase())
  || (mode === 'site_description' ? CONFIG.default_country : '');
const c = COUNTRIES[countryName] || null;
if (!['site_description', 'published', 'checkin', 'profile'].includes(mode) && !c) throw new Error('Please select a Target Country.');   // published-page reports and check-ins need no market

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
let keyword  = (mode === 'track' || mode === 'profile' ? '' : String(pick(p2, 'keyword') || '')).trim().toLowerCase().replace(/\s+/g, ' ');
const business = String(pick(p2, 'business') || '').trim();
const audience = String(pick(p2, 'customer') || pick(p2, 'audience') || '').trim();
const pageType0 = String(pick(p2, 'page', 'type') || '').trim();
const pageType = (mode === 'case_study' || /case stud/i.test(pageType0)) ? 'Case Study' : /pillar|hub/i.test(pageType0) ? 'Pillar Page' : /^local/i.test(pageType0) ? 'Local Page' : (pageType0 || 'Service Page');
const business_facts = String(pick(p2, 'facts') || p2.business_facts || '').trim().slice(0, 2000);
const cta = String(pick(p2, 'call', 'action') || p2.cta || '').trim().slice(0, 200);
const tone = String(pick(p2, 'tone') || '').trim();
const goalRaw = String(pick(p2, 'goal') || '').toLowerCase();
const goal = /sell|sales/.test(goalRaw) ? 'sales' : /traffic|educat|rank/.test(goalRaw) ? 'traffic' : /brand/.test(goalRaw) ? 'brand' : 'leads';
const track_keywords = asArray(pick(p2, 'terms to track') || p2.keywords || p2.track_keywords).flatMap(k => String(k).split(/[\n,;]+/)).map(k => k.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean).filter((k, i, a) => a.indexOf(k) === i).slice(0, 20);
const ga4_property_id = String(pick(p2, 'ga4') || '').replace(/^properties\//, '').replace(/[^0-9]/g, '').slice(0, 16);
const published_url = String(pick(p2, 'published', 'url') || p2.published_url || p2.url || '').trim();
const content_request_id = String(p2.content_request_id || '').trim();
const blogs_per_week = Math.min(3, Math.max(0, parseInt(String(pick(p2, 'posts per week') || p2.blogs_per_week || '0'), 10) || 0));
const yes = (v) => /^(y|true|1)/i.test(String(v == null ? '' : v).trim());
const checkin_manual_action = yes(pick(p2, 'manual action') || p2.manual_action);
const checkin_security_issue = yes(pick(p2, 'security issue') || p2.security_issue);
const checkin_notes = String(pick(p2, 'notes') || p2.notes || '').trim().slice(0, 1000);
const checkin_csv_text = String(p2.pages_csv_text || p2.pages_csv || '').slice(0, 400000);
// ---- v4.4: business profile (author, reviewer, address), case-study intake, local pages, video ----
const lab = (label) => { const v = p2[label]; return v == null ? '' : String(v).trim(); };   // exact form labels: several new labels share words with older ones
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
const s0 = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 400);
const urlOk = (u) => /^https?:\/\/\S+$/i.test(String(u || ''));
const A = obj(p2.author), R = obj(p2.reviewer), AD = obj(p2.address), CS = obj(p2.case_study), VI = obj(p2.video);
const authorLinks = (Array.isArray(A.same_as) ? A.same_as : String(A.same_as || A.links || lab('Author profile links (one per line)')).split(/[\s,]+/)).map(x => String(x).trim()).filter(urlOk).slice(0, 8);
const authorUrl = s0(A.url, 400) || authorLinks.find(u => cleanDomain(u) === domain) || '';   // the author page on the site; LinkedIn & co. go to sameAs (an update without a page link keeps the stored one)
const revText = lab('Expert reviewer (optional)'); const revUrl = (revText.match(/https?:\/\/\S+/) || [''])[0]; const revParts = revText.replace(/https?:\/\/\S+/, '').split(',').map(x => x.trim()).filter(Boolean);
const profile_input = {
  business_name: s0(p2.business_name || lab('Company name'), 160), business_type: s0(p2.business_type || lab('Category (for local search)'), 80), logo_url: s0(p2.logo_url || lab('Logo URL (optional)'), 400),
  street_address: s0(AD.street || AD.street_address || p2.street_address || lab('Street address'), 200), city: s0(AD.city || (mode === 'profile' ? p2.city : '') || lab('City'), 100),
  region: s0(AD.region || p2.region || lab('Region / state / emirate'), 100), postal_code: s0(AD.postal_code || p2.postal_code || lab('Postal code'), 30),
  country_code: mode === 'profile' ? (c ? c.iso : s0(AD.country, 2).toUpperCase()) : '', phone: s0(p2.phone || lab('Phone'), 40), public_email: s0(p2.public_email || lab('Public e-mail on the website'), 120),
  opening_hours: s0(p2.opening_hours || lab('Opening hours'), 200), price_range: s0(p2.price_range, 20),
  service_areas: asArray(p2.service_areas || lab('Areas you serve')).map(x => s0(x, 80)).filter(Boolean).slice(0, 20).join(', '), map_url: s0(p2.map_url || lab('Google Maps link (optional)'), 400),
  author_name: s0(A.name || p2.author_name || lab('Author name'), 120), author_job_title: s0(A.job_title || A.title || lab('Author job title'), 160), author_credentials: s0(A.credentials || lab('Author credentials and experience'), 600),
  author_bio: s0(A.bio || lab('Author bio'), 1200), author_url: authorUrl, author_image_url: s0(A.image_url || A.image || lab('Author photo URL (optional)'), 400),
  author_same_as: authorLinks.filter(u => u !== authorUrl).join(' '), author_knows_about: asArray(A.knows_about || lab('Topics the author knows best')).map(x => s0(x, 80)).filter(Boolean).slice(0, 12).join(', '),
  reviewer_name: s0(R.name || revParts[0], 120), reviewer_job_title: s0(R.job_title || R.title || revParts.slice(1).join(', '), 160), reviewer_url: s0(R.url || revUrl, 400)
};
for (const k of ['logo_url', 'author_url', 'author_image_url', 'reviewer_url', 'map_url']) if (profile_input[k] && profile_input[k] !== '-' && !urlOk(profile_input[k])) throw new Error('Please enter full links (https://...) for the logo, author page, photo, reviewer and map.');
const csIn = mode === 'case_study' || Object.keys(CS).length > 0;
const pubRaw = CS.client_public != null ? String(CS.client_public) : lab('May we name the client?');
const case_study = csIn ? { client_name: s0(CS.client_name || CS.client || lab('Client name or description'), 160), client_public: !/^(no|false|0|anonymous)/i.test(pubRaw.trim() || 'yes'),
  industry: s0(CS.industry || lab('Client industry'), 100), location: s0(CS.location || lab('Client location'), 100), service: s0(CS.service || lab('Service you delivered'), 160),
  challenge: s0(CS.challenge || lab('The challenge'), 2000), solution: s0(CS.solution || CS.what_we_did || lab('What you did'), 3000), timeline: s0(CS.timeline || lab('Timeline'), 200),
  results: s0(CS.results || lab('Results (with numbers)'), 2000), quote: s0(CS.quote || lab('Client quote (optional)'), 600), quote_by: s0(CS.quote_by || lab('Quote by (name, role)'), 160) } : null;
if (mode === 'case_study' && !keyword && case_study && case_study.service) keyword = (case_study.service + ' case study').toLowerCase().replace(/\s+/g, ' ').trim();
const case_id = String(p2.case_id || (mode === 'case_study' ? 'cs_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : ''));
let local_area = s0(p2.local_area || lab('City or area (local pages only)'), 80);
if (pageType === 'Local Page' && !local_area) { const g = keyword.match(/\b(?:in|near|around)\s+([a-z][a-z .'-]{2,40})$/i); if (g) local_area = g[1].trim().replace(/\b\w/g, ch => ch.toUpperCase()); }
const video_url = s0(VI.url || p2.video_url || lab('Video URL for this page (optional)'), 400);
if (video_url && !urlOk(video_url)) throw new Error('The video URL must be a full link (https://...).');
const ytm = video_url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i); const vim = video_url.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/i);
const video = video_url ? { url: video_url, provider: ytm ? 'youtube' : vim ? 'vimeo' : 'file', id: ytm ? ytm[1] : vim ? vim[1] : '',
  embed_url: ytm ? 'https://www.youtube.com/embed/' + ytm[1] : vim ? 'https://player.vimeo.com/video/' + vim[1] : '',
  fetch_url: ytm ? 'https://www.youtube.com/watch?v=' + ytm[1] : vim ? 'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent('https://vimeo.com/' + vim[1]) : '',
  thumbnail_url: s0(VI.thumbnail_url, 400) || (ytm ? 'https://i.ytimg.com/vi/' + ytm[1] + '/hqdefault.jpg' : ''), title: s0(VI.title || p2.video_title, 200), description: s0(VI.description || p2.video_description, 2000),
  transcript: String(VI.transcript || p2.video_transcript || lab('Video transcript (optional)') || '').trim().slice(0, 60000), upload_date: s0(VI.upload_date || p2.video_upload_date, 40), duration: s0(VI.duration || p2.video_duration, 20), placement: s0(VI.placement, 160) } : null;
// ---- v4.5: monitor settings (Track my site / API `monitors`), audit crawl options, scheduled audits ----
const MI = obj(p2.monitors);
const monitor_input = {}; for (const k of ['ai_visibility', 'backlinks', 'audit_monthly', 'audit_js']) if (MI[k] !== undefined) monitor_input[k] = !!MI[k] && !/^(false|0|no|off)$/i.test(String(MI[k]));
if (MI.ai_engines !== undefined) monitor_input.ai_engines = asArray(MI.ai_engines).map(e => String(e).toLowerCase().trim()).filter(e => ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode'].includes(e)).join(', ');
if (MI.ai_prompts_max !== undefined) monitor_input.ai_prompts_max = Math.min(15, Math.max(3, parseInt(MI.ai_prompts_max, 10) || 8));
if (MI.audit_pages !== undefined) monitor_input.audit_pages = Math.min(1000, Math.max(50, parseInt(MI.audit_pages, 10) || 200));
if (MI.brand_names !== undefined) monitor_input.brand_names = asArray(MI.brand_names).join(', ');
const topics = asArray(p2.topics || lab('Main services or products (optional)')).map(x => String(x).trim().toLowerCase()).filter(x => x.length >= 3).slice(0, 6);
const crawlRaw = String(p2.crawl_pages || pick(p2, 'pages to crawl') || '').match(/\d+/);
const crawl_pages = crawlRaw ? Math.min(1000, Math.max(50, parseInt(crawlRaw[0], 10))) : CONFIG.crawl_max_pages;
const crawl_js_req = p2.crawl_js !== undefined ? (!!p2.crawl_js && !/^(false|0|no)$/i.test(String(p2.crawl_js))) : /^yes/i.test(String(pick(p2, 'javascript') || ''));
if (crawl_js_req && crawl_pages > 500) throw new Error('JavaScript rendering is limited to 500 pages per audit (it is about 10x slower); choose 500 or fewer pages.');
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
if (mode === 'track' && !domain) throw new Error('Website Domain is required: tracking is set up for your site.');
if (mode === 'track' && !deliverable) throw new Error('Please add your email — the weekly tracking report is sent by email.');
if (mode === 'checkin' && !domain) throw new Error('Website Domain is required.');
if (mode === 'profile' && !domain) throw new Error('Website Domain is required: the profile belongs to your site.');
if (mode === 'profile' && !['author_name', 'business_name', 'street_address', 'phone', 'reviewer_name'].some(k => profile_input[k])) throw new Error('Please fill in at least the author name or the business details.');
if (mode === 'case_study' && !domain) throw new Error('Website Domain is required: the case study is written for your site.');
if ((mode === 'ai_visibility' || mode === 'backlinks') && !domain) throw new Error('Website Domain is required.');
if ((mode === 'ai_visibility' || mode === 'backlinks') && !deliverable) throw new Error('Please add your email — the report is sent by email.');
if (mode === 'case_study' && !keyword) throw new Error('Please enter the service you delivered (or a keyword for the page).');
if (mode === 'case_study' && !(case_study.challenge && case_study.solution && case_study.results)) throw new Error('Please describe the challenge, what you did and the results: the case study states only these facts.');
if (mode === 'case_study' && !deliverable) throw new Error('Please add your email — the case study is sent by email.');
if (mode === 'keyword' && !verdict_only && pageType === 'Local Page' && !local_area) throw new Error('Please enter the city or area for a local page (or put it in the keyword, e.g. "accountant in dubai marina").');
if (mode === 'published' && !domain) throw new Error('Website Domain is required.');
if (mode === 'published' && !/^https?:\/\/\S+$/i.test(published_url)) throw new Error('Please enter the full URL of the published page (https://...).');
if (mode === 'published') { const __m = published_url.match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); const __h = __m ? __m[1].toLowerCase().replace(/^www\./, '') : ''; if (!(__h === domain || __h.endsWith('.' + domain))) throw new Error('The published URL must be on ' + domain + '.'); }
if (mode === 'published' && !keyword && !content_request_id) throw new Error('Please enter the keyword of the page (as in the e-mail) or the content request id.');
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
    track_keywords,
    ga4_property_id,
    blogs_per_week,
    published_url,
    content_request_id,
    checkin_manual_action,
    checkin_security_issue,
    checkin_notes,
    checkin_csv_text,
    profile_input: (mode === 'profile' || profile_input.author_name || profile_input.reviewer_name) ? profile_input : null,
    case_study,
    case_id,
    local_area,
    video,
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
    crawl_max_pages: crawl_pages,
    crawl_js: crawl_js_req || CONFIG.crawl_js,
    scheduled: !!p2.scheduled,
    monitor_input,
    topics,
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
