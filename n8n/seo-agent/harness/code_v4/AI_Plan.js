// AI visibility plan (weekly, Monday 07:00, and on demand): one job per site — the brand names to look for, the competitors (configured, detected,
// and the brand names AI uses for them, learned by the Answer Analyst), the topics, the stored question panel (seo_ai_prompts: stable week to week
// so the trend means something; up to 50 questions with buyer stage, topic cluster and monthly AI search volume), the engines, the AI Pulse samples
// of the past days (seo_ai_daily) that join this week's figures, last week's numbers, and what is due this run: the monthly full run (Claude and the
// brand question), question discovery (Search Console questions + real questions from the AI-answer database), search volumes, the market-wide
// index (the DataForSEO AI-answer database: your share against the competitors across every answer, not only the panel), AI referral traffic from
// GA4 (visits, key events and revenue from ChatGPT, Perplexity, Gemini, Copilot, Claude …) and the AI-crawler access check. (v4.9)
// ---- shared by the monitors (AI Visibility Tracker, Backlink Monitor, Audit Scheduler; inlined by the build): which sites, with which settings ----
// Sites = the Data Table seo_sites ("Track my site") + every domain with a keyword ladder; settings per site from seo_monitors (defaults: everything on).
// On demand (Manual Run with { domain | site_id }) one site runs even when its weekly / monthly monitor is off; an untracked domain is checked ad hoc
// with the trigger's country, e-mail and callback.
let trigger = {}; try { const t = $('Manual Run').first(); trigger = (t && t.json) || {}; } catch (e) {}
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const siteIdFor = (d) => 'site_' + d.replace(/[^a-z0-9]+/g, '-');
const listOf = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\n,;]+/)).map(x => String(x).trim()).filter(Boolean);
const flag = (v, dflt) => (v === undefined || v === null || v === '') ? dflt : !(v === false || /^(false|0|no|off)$/i.test(String(v)));
const DEFAULT_ENGINES = ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode'];
const ALL_ENGINES = [...DEFAULT_ENGINES, 'copilot'];   // v4.12: Copilot (Bing's Copilot Search summary) only when chosen: Bing shows it for few searches (0 of 10 live, 2026-10-10)
function monitorSites(kind) {   // kind: 'ai' | 'backlinks' | 'audit' | 'links' (v4.13 Link Builder)
  const sites = rowsOf('Load Sites').filter(r => r.site_id && r.domain), ladders = rowsOf('Load Ladders').filter(r => r.domain), mons = rowsOf('Load Monitors'), profiles = rowsOf('Load Profiles');
  const byDomain = new Map();
  for (const s of sites) { const d = normD(s.domain); if (d && !byDomain.has(d)) byDomain.set(d, { ...s, domain: d, keywords: listOf(s.keywords).map(k => k.toLowerCase()), virtual: false }); }
  for (const l of ladders) { const d = normD(l.domain); if (d && !byDomain.has(d)) byDomain.set(d, { site_id: siteIdFor(d), domain: d, country: l.country || '', location_code: Number(l.location_code) || 0, language_code: l.language_code || 'en', email: l.email || '', callback_url: l.callback_url || '', keywords: [], status: 'active', source: 'ladder', virtual: true }); }
  for (const s of byDomain.values()) { if (s.email && s.callback_url) continue; const l = ladders.find(l => normD(l.domain) === s.domain && (l.email || l.callback_url)); if (l) { s.email = s.email || l.email || ''; s.callback_url = s.callback_url || l.callback_url || ''; } }
  const want = normD(trigger.domain) || String(trigger.site_id || '').trim();
  let list = [...byDomain.values()];
  if (want) {
    list = list.filter(s => s.domain === want || s.site_id === want);
    if (!list.length && normD(trigger.domain)) list = [{ site_id: siteIdFor(normD(trigger.domain)), domain: normD(trigger.domain), country: trigger.country || '', location_code: Number(trigger.location_code) || 0, language_code: trigger.language_code || 'en', email: '', callback_url: '', keywords: [], status: 'active', source: 'adhoc', virtual: true, adhoc: true }];
  } else list = list.filter(s => String(s.status || 'active') !== 'paused');
  const out = list.map(s => {
    const m = mons.find(x => x.site_id === s.site_id) || {};
    const p = profiles.find(x => x.site_id === s.site_id) || {};
    const engines = [...new Set(listOf(m.ai_engines).map(e => e.toLowerCase()).filter(e => ALL_ENGINES.includes(e)))];
    const settings = { ai_visibility: flag(m.ai_visibility, true), backlinks: flag(m.backlinks, true), audit_monthly: flag(m.audit_monthly, true), engines: engines.length ? engines : DEFAULT_ENGINES,
      prompts_max: Math.min(50, Math.max(3, Number(m.ai_prompts_max) || 20)), pulse: flag(m.ai_pulse, true), growth: flag(m.ai_growth, true), link_builder: flag(m.link_builder, true),
      ai_pages_month: m.ai_pages_month === '' || m.ai_pages_month == null || !Number.isFinite(Number(m.ai_pages_month)) ? 2 : Math.min(8, Math.max(0, Math.round(Number(m.ai_pages_month)))), audit_pages: Math.min(1000, Math.max(50, Number(m.audit_pages) || 200)), audit_js: flag(m.audit_js, false),
      competitors: [...new Set([...listOf(m.competitors), ...listOf(trigger.competitors)].map(normD).filter(d => d && d !== s.domain))].slice(0, 5),
      brand_names: [...new Set([...listOf(m.brand_names), ...listOf(trigger.brand_names), p.business_name || ''].map(x => String(x).trim()).filter(Boolean))], stored: !!m.site_id };
    const o = { ...s, settings, profile: { business_name: p.business_name || '', business_type: p.business_type || '', city: p.city || '', phone: p.phone || '', street_address: p.street_address || '', author_name: p.author_name || '',
      region: p.region || '', country_code: p.country_code || '', public_email: p.public_email || '', price_range: p.price_range || '', service_areas: p.service_areas || '', opening_hours: p.opening_hours || '' } };
    if (want) { if (trigger.email) o.email = trigger.email; if (trigger.callback_url) o.callback_url = trigger.callback_url; if (trigger.country) o.country = trigger.country; if (Number(trigger.location_code)) o.location_code = Number(trigger.location_code); if (trigger.language_code) o.language_code = trigger.language_code; }
    o.request_id = String(trigger.request_id || s.request_id || '');
    return o;
  });
  const flagOf = { ai: 'ai_visibility', backlinks: 'backlinks', audit: 'audit_monthly', links: 'link_builder' }[kind];
  return { list: want ? out : out.filter(s => s.settings[flagOf]), on_demand: !!want, want, trigger, total: byDomain.size };
}

// ---- countries: copied from the main workflow's Normalize Input by build_monitors.py (DataForSEO location code = 2000 + ISO numeric) ----
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
// ---- the one site model (G19, 2026-10-12; see SITE_MODEL_SPEC.md; the builders inline this file where a node asks for the SITE_MODEL kit) ----
// Every workflow reads the same facts about a site through SM: the canonical host, the business name / logo / NAP (seo_profiles ->
// the homepage Organization / LocalBusiness schema -> Google Business Profile -> the fields the web app sent), the services and nav
// pages, the page inventory (seo_pages), the business facts, the call to action, the brand names, the competitors and the
// accreditation status. SM.from() builds the model, SM.toRow() writes it back to the seo_sites columns.
const SM = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const normHost = (v) => S(v).toLowerCase().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '');
  const bare = (v) => normHost(v).replace(/^www\./, '');
  const hostOf = (u) => normHost((S(u).match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '');   // the n8n Code sandbox has no URL constructor
  const siteIdFor = (d) => 'site_' + bare(d).replace(/[^a-z0-9]+/g, '-');
  const listOf = (v) => (Array.isArray(v) ? v : S(v).split(/[\n,;|]+/)).map(x => S(x)).filter(Boolean);
  const uniq = (a) => [...new Set(a)];
  const jparse = (v, dflt) => { if (v && typeof v === 'object') return v; try { const o = JSON.parse(S(v) || 'null'); return o == null ? dflt : o; } catch (e) { return dflt; } };
  const STOP = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'vs', 'with', 'your', 'our', 'my']);
  const tokensOf = (s) => S(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  // one-letter parts ("e" of "e invoicing") and stop words never decide a page match: with them "e invoicing uae penalties" would
  // score 3 of 4 against /uae-e-invoicing-fta-rules/ and claim the FTA page (the S26 false-match pair).
  const termsOf = (s) => uniq(tokensOf(s).filter(t => t.length > 1 && !STOP.has(t)));
  const pathOf = (u) => { const p = S(u).replace(/^https?:\/\/[^\/]*/i, ''); return p || '/'; };
  const strip = (s) => S(s).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ').replace(/\s+/g, ' ').trim();

  // ---- the homepage HTML: canonical host, Organization / LocalBusiness schema, nav pages ----
  const ldNodes = (html) => {
    const out = []; const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi; let m;
    const push = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(push); return; } out.push(o); if (Array.isArray(o['@graph'])) o['@graph'].forEach(push); };
    while ((m = re.exec(S(html)))) push(jparse(m[1], null));
    return out;
  };
  const ORG_TYPE = /(organization|corporation|localbusiness|professionalservice|store|ngo|educationalorganization|governmentorganization|onlinebusiness|softwarecompany|company|consultant|accountingservice)/i;
  const typesOf = (o) => [].concat((o && o['@type']) || []).map(t => S(t).toLowerCase());
  const orgFromHtml = (html) => {
    const nodes = ldNodes(html).filter(o => typesOf(o).some(t => ORG_TYPE.test(t)));
    const node = nodes.find(o => typesOf(o).some(t => /localbusiness|professionalservice|store/.test(t))) || nodes[0];
    if (!node) return null;
    const logo = typeof node.logo === 'string' ? node.logo : ((node.logo || {}).url || '');
    return { name: S(node.name), type: typesOf(node).join('/'), telephone: S(node.telephone), email: S(node.email), logo: S(logo),
      sameAs: listOf(node.sameAs), address: (node.address && typeof node.address === 'object') ? node.address : null };
  };
  const navFromHtml = (html, host) => {
    const h = S(html); const zones = [];
    for (const re of [/<nav\b[\s\S]*?<\/nav>/gi, /<header\b[\s\S]*?<\/header>/gi]) { const f = h.match(re); if (f) zones.push(...f); }
    const out = []; const seen = new Set();
    for (const zone of zones) {
      for (const a of (zone.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || [])) {
        const href = S((a.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1]);
        if (!href || /^(#|javascript:|mailto:|tel:)/i.test(href)) continue;
        const abs = /^https?:\/\//i.test(href) ? href : (href.charAt(0) === '/' ? 'https://' + host + href : '');
        if (!abs || bare(hostOf(abs)) !== bare(host)) continue;
        const p = pathOf(abs); if (p === '/' || seen.has(p)) continue;
        seen.add(p); out.push({ url: abs, title: strip(a).slice(0, 80), path: p });
        if (out.length >= 12) return out;
      }
    }
    return out;
  };

  // ---- precedence: seo_profiles -> homepage schema -> Google Business Profile -> what the app sent ----
  const pick = (sources, read) => { for (const s of sources) { const v = S(read(s.value) || ''); if (v) return { value: v, source: s.name }; } return { value: '', source: '' }; };

  const from = (siteRow, extras) => {
    const row = (siteRow && typeof siteRow === 'object') ? siteRow : {};
    const x = (extras && typeof extras === 'object') ? extras : {};
    const req = x.request || {};
    const prof = x.profile || {};
    const gbp = x.gbp || {};
    const html = S(x.html || (x.home || {}).html);
    const domain = bare(row.domain || x.domain || req.domain || (x.home || {}).url || '');
    const site_id = S(row.site_id) || S(x.site_id) || (domain ? siteIdFor(domain) : '');
    const org = x.homepage_org || (html ? orgFromHtml(html) : null) || null;

    // canonical host: this run's probe, else the homepage's own canonical tag, else where the homepage request landed, else the stored
    // value, else the bare domain. A canonical tag on another domain is ignored.
    const canonTag = (S(html).match(/<link\b[^>]*>/gi) || []).find(t => /\brel\s*=\s*["']?canonical\b/i.test(t)) || '';
    const canonHost = hostOf((canonTag.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1] || '');
    const landed = hostOf(x.final_url || (x.home || {}).url || '');
    const fromProbe = normHost(x.canonical_host || (x.probe || {}).canonical_host || '');
    // the site's own live URLs (ladder pages, published pages, sitemap) are evidence too: the host most of them use
    const voted = (() => { const c = {}; for (const u of (x.seen_hosts || [])) { const h = normHost(u.indexOf('/') >= 0 ? hostOf(u) || u : u); if (h && bare(h) === domain) c[h] = (c[h] || 0) + 1; }
      return Object.keys(c).sort((a, b) => c[b] - c[a] || a.length - b.length)[0] || ''; })();
    const candidates = [[fromProbe, 'probe'], [bare(canonHost) === domain ? canonHost : '', 'canonical tag'], [bare(landed) === domain ? landed : '', 'redirect'], [voted, 'live urls'], [normHost(row.canonical_host), 'stored'], [domain, 'domain']];
    const hit = candidates.find(c => c[0]) || [domain, 'domain'];
    const canonical_host = hit[0], host_source = hit[1];

    const SRC = [{ name: 'profile', value: prof }, { name: 'homepage_schema', value: org || {} }, { name: 'gbp', value: gbp }, { name: 'app', value: req }, { name: 'stored', value: { business_name: row.business_name, logo_url: row.logo_url } }];
    const nameHit = pick(SRC, (s) => s.business_name || s.name || s.title);
    const logoHit = pick(SRC, (s) => s.logo_url || s.logo || s.photo_url);
    const addr = (org && org.address && typeof org.address === 'object') ? org.address : {};
    const NAP_SRC = [{ name: 'profile', value: prof }, { name: 'homepage_schema', value: { street_address: addr.streetAddress, city: addr.addressLocality, region: addr.addressRegion, postal_code: addr.postalCode, country_code: addr.addressCountry, phone: (org || {}).telephone, public_email: (org || {}).email } },
      { name: 'gbp', value: { street_address: gbp.address, city: gbp.city, phone: gbp.phone } }, { name: 'app', value: req }];
    const street = pick(NAP_SRC, (s) => s.street_address), phone = pick(NAP_SRC, (s) => s.phone);
    const nap = { business_name: nameHit.value, street_address: street.value, city: pick(NAP_SRC, (s) => s.city).value, region: pick(NAP_SRC, (s) => s.region).value,
      postal_code: pick(NAP_SRC, (s) => s.postal_code).value, country_code: pick(NAP_SRC, (s) => s.country_code || s.country).value,
      phone: phone.value, public_email: pick(NAP_SRC, (s) => s.public_email || s.email).value, price_range: S(prof.price_range), source: street.source || phone.source || '' };
    const stored = jparse(row.nap_json, null);
    if (stored && !nap.street_address && !nap.phone) { Object.assign(nap, stored); nap.source = S(stored.source) || 'stored'; }

    // P2-2 (2026-10-12): the Site Describer answers with `products_or_services` — reading only `services` left services_json empty on every
    // site, so the brief's facts said `services: []` although the describer had found nine.
    const desc0 = x.description || {};
    const services = uniq([...listOf(x.services), ...listOf(desc0.products_or_services), ...listOf(desc0.services), ...listOf(desc0.main_services), ...(jparse(row.services_json, []) || [])].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
    const navStored = jparse(row.nav_pages_json, []) || [];
    const navFresh = x.nav_pages || (html && canonical_host ? navFromHtml(html, canonical_host) : []);
    const nav_pages = (navFresh.length ? navFresh : navStored).map(p => ({ url: S(p.url), title: S(p.title), path: S(p.path) || pathOf(p.url) })).filter(p => p.url).slice(0, 12);

    const pages = (Array.isArray(x.pages) ? x.pages : []).map(p => ({ url: S(p.url), title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod),
      queries: Array.isArray(p.queries) ? p.queries : (jparse(p.queries_json, []) || []) })).filter(p => p.url);

    const business_facts = S(req.business_facts || x.business_facts || row.business_facts).slice(0, 2000);
    const cta = S(req.cta || x.cta || row.cta).slice(0, 200);
    const mon = x.monitors || {};
    const brand_names = uniq([...listOf(mon.brand_names), ...listOf(x.brand_names), ...listOf(row.brand_names), nameHit.value].filter(Boolean));
    const competitors = uniq([...listOf(mon.competitors), ...listOf(x.competitors), ...listOf(row.competitors)].map(bare).filter(d => d && d !== domain)).slice(0, 8);
    const accreditation = S(x.accreditation || row.accreditation);
    const updated_at = S(x.updated_at) || S(row.model_updated_at) || new Date().toISOString();

    return { site_id, domain, canonical_host, host_source, home_url: 'https://' + canonical_host + '/',
      business_name: nameHit.value, name_source: nameHit.source, logo_url: logoHit.value, logo_source: logoHit.source,
      nap, services, nav_pages, pages, business_facts, cta, brand_names, competitors, accreditation,
      model_updated_at: updated_at, sources: { profile: !!prof.site_id || !!prof.business_name, homepage_schema: !!org, gbp: !!(gbp.name || gbp.phone), app: !!(req.business_facts || req.cta || req.business_name), html: !!html } };
  };

  // every URL the agent emits for a site goes through here: https, the canonical host, no double slash
  const siteUrl = (model, path) => {
    const p = S(path);
    if (/^https?:\/\//i.test(p)) return p;
    const host = normHost((model || {}).canonical_host || (model || {}).domain || '');
    const tail = p ? ('/' + p).replace(/\/{2,}/g, '/') : '/';
    return 'https://' + host + tail;
  };
  const apiTarget = (model) => bare((model || {}).domain || (model || {}).canonical_host || '');   // DataForSEO and the other APIs keep the bare domain
  const name = (model) => S((model || {}).business_name) || bare((model || {}).domain || '');
  const nap = (model) => ((model || {}).nap && typeof model.nap === 'object') ? model.nap : { business_name: '', street_address: '', city: '', region: '', postal_code: '', country_code: '', phone: '', public_email: '', price_range: '', source: '' };
  const services = (model) => Array.isArray((model || {}).services) ? model.services : [];
  const pages = (model) => Array.isArray((model || {}).pages) ? model.pages : [];
  const facts = (model) => {
    const t = S((model || {}).business_facts) + ' ' + S(((model || {}).nap || {}).price_range);
    return { business_facts: S((model || {}).business_facts), cta: S((model || {}).cta), accreditation: S((model || {}).accreditation),
      pricing: /(aed|usd|\$|€|£|price|pricing|cost|fee|per month|per user|from \d)/i.test(t),
      timeline: /(\d+\s*(day|week|month|year)|timeline|go.?live|turnaround|within \d)/i.test(t) };
  };
  // a page of the inventory answers a keyword when it already gets impressions for it, or when at least 75% of the keyword's
  // meaningful words are in its slug or title (D11; keep it even while the inventory is empty).
  const MATCH_MIN = 0.75;
  const matchPage = (model, keyword) => {
    const want = termsOf(keyword); if (!want.length) return null;
    const key = tokensOf(keyword).join(' ');
    const inv = pages(model);
    for (const p of inv) {
      const q = (p.queries || []).find(x => tokensOf(x.query || x.keyword || x).join(' ') === key && (Number((x || {}).impressions) || 0) > 0);
      if (q) return { url: p.url, title: p.title, source: p.source, matched_by: 'query', score: 1, impressions: Number(q.impressions) || 0 };
    }
    let best = null;
    for (const p of inv) {
      const slug = termsOf(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''));
      const title = termsOf(S(p.title) + ' ' + S(p.h1));
      const inSlug = want.filter(t => slug.includes(t)).length / want.length;
      const inTitle = want.filter(t => title.includes(t)).length / want.length;
      const score = Math.max(inSlug, inTitle);
      if (score + 1e-9 >= MATCH_MIN && (!best || score > best.score)) best = { url: p.url, title: p.title, source: p.source, matched_by: inSlug >= inTitle ? 'slug' : 'title', score: Math.round(score * 100) / 100, impressions: 0 };
    }
    return best;
  };
  // D11: a stored seo_pages row carries its queries as the JSON string `queries_json`, so both shapes are accepted here
  const queriesOf = (p) => Array.isArray(p.queries) ? p.queries : (jparse(p.queries_json, []) || []);
  const withPages = (model, more) => ({ ...model, pages: (() => { const seen = new Set(); const out = [];
    for (const p of [...pages(model), ...(Array.isArray(more) ? more : [])]) { const u = S(p.url); if (!u) continue; const k = pathOf(u).replace(/\/$/, '').toLowerCase();
      if (seen.has(k)) { const old = out.find(o => pathOf(o.url).replace(/\/$/, '').toLowerCase() === k); if (old) { old.title = old.title || S(p.title); old.h1 = old.h1 || S(p.h1); old.lastmod = old.lastmod || S(p.lastmod); const q = queriesOf(p); if (q.length) old.queries = q; } continue; }
      seen.add(k); out.push({ url: u, title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries: queriesOf(p) }); }
    return out; })() });
  // the model exactly as it was stored (seo_sites row or a seo_cache value), with its own timestamp -- never "now", so isFresh() is honest
  const stored = (row) => { const r = (row && typeof row === 'object') ? row : {}; return (S(r.canonical_host) || S(r.model_updated_at)) ? from(r, {}) : null; };
  const FRESH_DAYS = 7;
  const ageDays = (model) => { const t = Date.parse(S((model || {}).model_updated_at)); return Number.isFinite(t) ? (Date.now() - t) / 864e5 : Infinity; };
  const isFresh = (model, days) => !!(model && S(model.canonical_host) && ageDays(model) < (Number(days) > 0 ? Number(days) : FRESH_DAYS));
  // exactly the seo_sites columns the model owns (plus the two keys), ready to merge into a site row or a cache value
  const COLUMNS = ['site_id', 'domain', 'canonical_host', 'business_name', 'logo_url', 'nap_json', 'services_json', 'nav_pages_json', 'business_facts', 'cta', 'brand_names', 'competitors', 'accreditation', 'model_updated_at'];
  const toRow = (model) => { const m = model || {};
    return { site_id: S(m.site_id), domain: S(m.domain), canonical_host: S(m.canonical_host), business_name: S(m.business_name), logo_url: S(m.logo_url),
      nap_json: JSON.stringify(nap(m)), services_json: JSON.stringify(services(m)), nav_pages_json: JSON.stringify((m.nav_pages || []).map(p => ({ url: p.url, title: p.title }))),
      business_facts: S(m.business_facts).slice(0, 2000), cta: S(m.cta).slice(0, 200), brand_names: (m.brand_names || []).join(', ').slice(0, 500),
      competitors: (m.competitors || []).join(', ').slice(0, 500), accreditation: S(m.accreditation).slice(0, 200), model_updated_at: S(m.model_updated_at) };
  };
  const pageRows = (model) => pages(model).map(p => ({ site_id: S((model || {}).site_id), url: S(p.url), title: S(p.title).slice(0, 300), h1: S(p.h1).slice(0, 300),
    source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries_json: JSON.stringify(p.queries || []), updated_at: S((model || {}).model_updated_at) || new Date().toISOString() }));
  return { from, stored, siteUrl, apiTarget, name, nap, services, pages, facts, matchPage, withPages, toRow, pageRows, COLUMNS, isFresh, ageDays, FRESH_DAYS, MATCH_MIN,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml } };
})();
const CONFIG = { max_sites_per_run: 15, max_topics: 8, monthly_engines: ['claude'],   // v4.9: Gemini moved to the weekly set (the real gemini.google.com answer costs $0.004 through the scraper)
  gsc_questions: 15, pulse_days: 7 };
const { list, on_demand, want, total } = monitorSites('ai');
if (!list.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'no site matches "' + want + '"' : (total ? 'AI visibility is switched off for every site' : 'no sites yet (register one through "Track my site" or plan a keyword ladder)') } }];
const promptRows = rowsOf('Load AI Prompts'), visRows = rowsOf('Load AI Visibility'), ladders = rowsOf('Load Ladders'), daily = rowsOf('Load AI Daily'), cache = rowsOf('Load Cache (AI)'), queries = rowsOf('Load Query History');
const now = new Date(); const iso = now.toISOString(); const month = iso.slice(0, 7);
const parse = (t, d) => { try { const v = JSON.parse(t || ''); return v == null ? d : v; } catch (e) { return d; } };
const isoOf = (code) => { const c = Object.values(typeof COUNTRIES === 'object' ? COUNTRIES : {}).find(x => Number(x.code) === Number(code)); return c ? String(c.iso || '').toUpperCase() : ''; };
const QUESTION = /^(how|what|which|who|why|when|where|is|are|can|does|do|should|best|top|cost|price|vs|compare)\b|\?|\b(vs|versus|best|cost|price|how to|which)\b/i;
return list.slice(0, CONFIG.max_sites_per_run).map(s => {
  const label = s.domain.split('.')[0];
  const brand_names = [...new Set([s.domain, ...(s.settings.brand_names || []), ...(label.length >= 5 ? [label] : [])].map(x => String(x).trim()).filter(x => x.length >= 3))];
  const lrows = ladders.filter(l => normD(l.domain) === s.domain).sort((a, b) => (Number(a.rung) || 0) - (Number(b.rung) || 0));
  const asked = on_demand ? listOf(trigger.topics).map(x => x.toLowerCase()) : [];   // "Main services or products" on the on-demand form / API `topics`
  const topics = [...new Set([...asked, ...lrows.map(l => String(l.head_keyword || '').toLowerCase().trim()), ...(s.keywords || []), ...lrows.filter(l => Number(l.rung) !== 4).map(l => String(l.keyword || '').toLowerCase().trim())].filter(Boolean))].slice(0, CONFIG.max_topics);
  const mine = promptRows.filter(p => p.site_id === s.site_id && String(p.status || 'active') !== 'off' && p.prompt);
  const custom = mine.filter(p => p.source === 'custom'), auto = mine.filter(p => p.source !== 'custom');
  const mineVis = visRows.filter(v => v.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
  const prev = mineVis[0] || null;
  // brand names AI uses for competitors (learned by the Answer Analyst: "ClearTax" -> cleartax.in), so a competitor named without its website still counts
  const aliasRow = cache.find(c => c.key === 'ai_brands:' + s.site_id); const aliases = aliasRow ? parse(aliasRow.value, {}) : {};
  const autoRivals = prev ? (parse(prev.competitors_json, []) || []).filter(c => c && c.domain && c.auto && (c.mentions || 0) >= 2 && /\./.test(c.domain)).map(c => c.domain) : [];
  const competitors = [...new Set([...s.settings.competitors, ...autoRivals])].slice(0, 8);
  // full run = the first run of the month (or any on-demand run): every engine + the brand question + discovery + the market-wide index
  const isFull = (v) => String(v.run_kind || '') === 'full' || String(v.run_kind || '') === 'on_demand' || (!v.run_kind && (() => { const e = parse(v.engines_json, {}); return ['gemini', 'claude'].some(k => e[k] && Number(e[k].asked) > 0 && !e[k].carried); })());
  const lastFull = mineVis.find(isFull) || null;
  const full_due = on_demand || !mineVis.some(v => String(v.checked_at).slice(0, 7) === month && isFull(v));
  const carried = lastFull ? { checked_at: lastFull.checked_at, engines: parse(lastFull.engines_json, {}) } : null;
  const room = Math.max(0, s.settings.prompts_max - custom.length);
  const deficit = Math.max(0, room - auto.length);
  const need = (!auto.length || deficit >= 2) ? deficit : 0;   // top up only when 2+ questions are missing (not every week for one)
  const prompts = [...custom, ...auto].slice(0, s.settings.prompts_max).map(p => ({ prompt_id: p.prompt_id, prompt: p.prompt, kind: p.kind || 'custom', topic: p.topic || '', keyword: p.keyword || '', source: p.source || 'auto',
    stage: p.stage || '', cluster: p.cluster || p.topic || '', volume: p.volume === '' || p.volume == null ? null : Number(p.volume), origin: p.origin || (p.source === 'custom' ? 'custom' : 'writer'), created_at: p.created_at || '' }));
  // search volumes: questions without one (new) every week; all of them on the month's full run (AI Keyword Data, $0.0001 a keyword)
  const volume_keywords = [...new Set(prompts.filter(p => p.kind !== 'brand' && p.keyword && (full_due || p.volume === null || Number.isNaN(p.volume))).map(p => String(p.keyword).toLowerCase().trim()).filter(k => k.length >= 3 && k.length <= 120))].slice(0, 100);
  // real questions people search (Search Console, last weeks): long or question-shaped queries are the closest thing to an AI prompt
  const gsc_questions = [...new Map(queries.filter(q => q.site_id === s.site_id && q.query && (String(q.query).split(/\s+/).length >= 5 || QUESTION.test(String(q.query))))
    .sort((a, b) => (Number(b.impressions) || 0) - (Number(a.impressions) || 0)).map(q => [String(q.query).toLowerCase().trim(), { query: String(q.query).trim(), impressions: Number(q.impressions) || 0, clicks: Number(q.clicks) || 0, position: Number(q.position) || 0 }])).values()].slice(0, CONFIG.gsc_questions);
  // AI Pulse samples since the last weekly run (or the past week): they join this week's figures (more samples = a steadier, honest rate)
  const since = prev ? String(prev.checked_at) : new Date(now.getTime() - CONFIG.pulse_days * 864e5).toISOString();
  const pulse_rows = daily.filter(d => d.site_id === s.site_id && String(d.checked_at) > since).map(d => ({ date: d.date, checked_at: d.checked_at, samples: Number(d.samples) || 0, mentioned: Number(d.mentioned) || 0, cited: Number(d.cited) || 0,
    mention_rate: Number(d.mention_rate) || 0, visibility_score: Number(d.visibility_score) || 0, engines: parse(d.engines_json, {}), prompts: parse(d.prompts_json, {}), competitors: parse(d.competitors_json, {}), sources: parse(d.sources_json, {}) }));
  const prevMention = prev ? Number(prev.mention_rate) || 0 : 0, prevSamples = prev ? Number(prev.samples) || Number(prev.answers) || 0 : 0;
  const location_code = Number(s.location_code) || 2840;
  // pages that must stay fetchable for AI: the ones AI cited last time and the keyword-ladder pages (checked against robots.txt per AI bot)
  const pathOf = (u) => { const m = String(u || '').match(/^https?:\/\/[^\/?#]+(\/[^?#]*)?/i); return m ? (m[1] || '/') : (String(u || '').startsWith('/') ? String(u) : ''); };
  const key_paths = [...new Set([...(prev ? (parse(prev.pages_json, []) || []).map(x => pathOf(x && x.url)) : []), ...lrows.map(l => pathOf(l.target_url))].filter(x => x && x !== '/'))].slice(0, 8);
// D15 (system review 2026-10-11): the plan carries the site's canonical host (the site model, SITE_MODEL_SPEC.md §6), so every URL the run
// emits is on the host the site really serves; with no model yet the bare domain keeps today's behaviour.
  const site_model = SM.stored(s) || { domain: s.domain, canonical_host: s.domain };
  return { json: { site_id: s.site_id, domain: s.domain, canonical_host: site_model.canonical_host || s.domain, country: s.country || '', location_code, language_code: s.language_code || 'en', country_iso: isoOf(location_code), email: s.email || '', callback_url: s.callback_url || '',
    request_id: s.request_id || '', on_demand, adhoc: !!s.adhoc, business_name: s.profile.business_name || '', business_type: s.profile.business_type || '', city: s.profile.city || '', profile: s.profile,
    // G10 (2026-10-11 system review): the Answer Analyst can only call a claim wrong against facts on file, so the site model's
    // services, business facts and accreditation status travel with the profile (SITE_MODEL_SPEC.md; with no sheet the analyst
    // reports "not checked", never "no wrong claims")
    services: SM.services(site_model).slice(0, 20), business_facts: SM.facts(site_model).business_facts, accreditation: SM.facts(site_model).accreditation,
    brand_names, competitors, configured_competitors: s.settings.competitors, aliases, topics, engines: s.settings.engines, prompts_max: s.settings.prompts_max, pulse: s.settings.pulse,
    prompts, full_due, run_kind: on_demand ? 'on_demand' : full_due ? 'full' : 'weekly', monthly_engines: CONFIG.monthly_engines.filter(e => s.settings.engines.includes(e)), carried,
    need_prompts: need > 0, prompts_needed: need, need_site_text: need > 0 && !topics.length && !s.profile.business_name, gsc_questions,
    discovery_due: !!topics.length && (full_due || need > 0), volume_keywords, index_due: full_due, market_due: !!topics.length && (!prev || String(prev.market_month || '') !== month), market_keyword: topics[0] || '',
    ga4_property_id: String(s.ga4_property_id || '').replace(/^properties\//, '').trim(), pulse_rows, key_paths,
    previous: prev ? { checked_at: prev.checked_at, mention_rate: prevMention, samples: prevSamples, mentioned_k: Math.round(prevMention * prevSamples / 100), citation_rate: Number(prev.citation_rate), share_of_voice: Number(prev.share_of_voice), avg_rank: Number(prev.avg_rank),
      visibility_score: prev.visibility_score === '' || prev.visibility_score == null ? null : Number(prev.visibility_score), sentiment_score: prev.sentiment_score === '' || prev.sentiment_score == null ? null : Number(prev.sentiment_score),
      engines: parse(prev.engines_json, {}), market_month: prev.market_month || '', market: parse(prev.market_json, null), index: parse(prev.index_json, null), perception: parse(prev.perception_json, null), traffic: parse(prev.traffic_json, null), access: parse(prev.access_json, null),
      competitors: parse(prev.competitors_json, []) } : null,
    run_id: 'ai_' + iso.slice(0, 10).replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, ''), checked_at: iso } };
});
