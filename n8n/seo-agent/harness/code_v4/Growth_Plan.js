// AI Growth plan (v4.12, AI_GROWTH_SPEC.md; weekly, Monday 09:30 after the AI Visibility Tracker and the Site Tracker, and on demand): the work that
// gets a site named and cited in AI answers, not only measured. Per site with AI visibility and the growth loop on:
//   * key pages to check this week (can an assistant read and quote them: the AI Readiness step) — pages AI cited, the targets' pages, written and
//     ladder pages, the pages Search Console shows most, the homepage; each page about once a month, never-checked ones first;
//   * pages to send to Bing (ChatGPT search, Copilot) and IndexNow (Bing, Yandex, Naver, Seznam …): new or updated pages, and key pages Bing has not crawled;
//   * the questions to win (seo_ai_targets): every lost question of the latest AI visibility run becomes a target — a new answer page, or a
//     refresh of the page the site already has for it — which the Content Cadence writes (ai_pages_month, default 2);
//   * the earned-media list: the exact third-party pages AI cited in answers that did not name the business (articles, lists, reviews, threads),
//     fetched next to see whether they name the business or its competitors (the strongest lever on AI mentions: earned media);
//   * the monthly entity check (Wikidata).
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
const CONFIG = { audit_per_week: 12, recheck_days: 25, max_key_pages: 40, submit_max: 50, resubmit_days: 30, recent_days: 8, earned_fetch: 10, max_targets: 6, refresh_after_days: 90,
  stage_weight: { decision: 1, consideration: 0.8, awareness: 0.6 } };
const { list, on_demand, want, total } = monitorSites('ai');
const sites = on_demand ? list : list.filter(s => s.settings.ai_visibility && s.settings.growth);
if (!sites.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'no site matches "' + want + '"' : (total ? 'the AI growth loop is off for every site' : 'no sites yet') } }];
const vis = rowsOf('Load AI Visibility'), answers = rowsOf('Load AI Answers'), prompts = rowsOf('Load AI Prompts'), logs = rowsOf('Load Content Log'), qh = rowsOf('Load Query History'),
  pagesStored = rowsOf('Load AI Pages'), targetsStored = rowsOf('Load AI Targets'), growthRows = rowsOf('Load AI Growth'), cache = rowsOf('Load Cache (Growth)'), ladders = rowsOf('Load Ladders');
const now = new Date(); const iso = now.toISOString(); const month = iso.slice(0, 7);
const parse = (t, d) => { try { const v = JSON.parse(t || ''); return v == null ? d : v; } catch (e) { return d; } };
const days = (d) => d ? (now - new Date(d)) / 864e5 : Infinity;
const hostOf = (u) => { const m = String(u || '').match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
const keyOf = (u) => { const m = String(u || '').trim().match(/^https?:\/\/(?:www\.)?([^\/?#]+)([^?#]*)/i); if (!m) return ''; const path = (m[2] || '/').replace(/\/+$/, '') || '/'; return m[1].toLowerCase() + path; };   // host-agnostic (www or not)
const pathOfU = (u) => { const m = String(u || '').trim().match(/^https?:\/\/[^\/?#]+([^?#]*)/i); return m ? (m[1] || '/') : ''; };   // as the site writes it (trailing slash kept: Bing / IndexNow get the real address)
const toks = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'what', 'how', 'which', 'are', 'can', 'does', 'your', 'you', 'that', 'this', 'from', 'into', 'best'].includes(w));
const overlap = (a, b) => { const A = new Set(toks(a)), B = new Set(toks(b)); if (!A.size || !B.size) return 0; let k = 0; for (const x of A) if (B.has(x)) k++; return k / A.size; };   // share of the target keyword's words found in the other text
const hex = (len) => { let s = ''; while (s.length < len) s += Math.floor(Math.random() * 16).toString(16); return s; };
const qid = (q) => { let h = 5381; for (const ch of String(q || '').toLowerCase().replace(/\s+/g, ' ').trim()) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return 'q' + h.toString(36); };   // a stable id for a question stored without one (runs before v4.12)
const GOV = /(^|\.)(gov|gob|gouv|govt|mil)(\.[a-z]{2})?$|(^|\.)gov\.[a-z]{2}$|(^|\.)europa\.eu$|(^|\.)(un|who|oecd|worldbank|imf)\.org$/i;
const REVIEW = /(^|\.)(g2\.com|capterra\.[a-z.]+|clutch\.co|goodfirms\.co|trustpilot\.com|softwareadvice\.com|getapp\.com|trustradius\.com|sourceforge\.net|gartner\.com|yelp\.[a-z.]+|tripadvisor\.[a-z.]+|bayut\.com|designrush\.com|sortlist\.[a-z.]+|themanifest\.com|upcity\.com)$/i;
const FORUM = /(^|\.)(reddit\.com|quora\.com|stackexchange\.com|stackoverflow\.com|news\.ycombinator\.com)$|^(community|forum|forums|discuss)\./i;
const VIDEO = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com)$/i;
const SOCIAL = /(^|\.)(linkedin\.com|facebook\.com|x\.com|twitter\.com|instagram\.com|medium\.com)$/i;
const WIKI = /(^|\.)(wikipedia\.org|wikidata\.org)$/i;
const NEWS = /(^|\.)(reuters\.com|bloomberg\.com|forbes\.com|cnbc\.com|bbc\.co\.uk|ft\.com|wsj\.com|gulfnews\.com|khaleejtimes\.com|thenationalnews\.com|zawya\.com|arabianbusiness\.com|gulfbusiness\.com|techcrunch\.com|theverge\.com|businessinsider\.com|economictimes\.indiatimes\.com|livemint\.com)$/i;
const LISTY = /\b(best|top\s?\d+|\d+\s(best|top)|alternatives?|vs\.?|versus|compared?|comparison|leading|list of|providers? in|companies in|ranked|review(s|ed)?)\b/i;
const kindOf = (host, title, url, comps) => comps.some(c => host === c || host.endsWith('.' + c)) ? 'competitor' : WIKI.test(host) ? 'encyclopedia' : GOV.test(host) ? 'official' : FORUM.test(host) ? 'forum' : VIDEO.test(host) ? 'video'
  : SOCIAL.test(host) ? 'social' : REVIEW.test(host) ? 'review' : LISTY.test(title + ' ' + String(url).replace(/[-_\/]/g, ' ')) ? 'list' : (NEWS.test(host) || /\/(news|press)\//i.test(url)) ? 'news' : 'article';
const out = [];
for (const s of sites) {
  const dom = s.domain; const ours = (u) => { const h = hostOf(u); return h === dom || h.endsWith('.' + dom); };
  // D15: the host the site really serves (www or not) comes from the one site model (SITE_MODEL_SPEC.md), which resolved it from the homepage,
  // its canonical tag and the site's own live URLs. Bing and IndexNow refuse addresses on another host than the site's. With no model yet
  // (the weekly Site Tracker has not run for this site), the model is built here from the same live URLs the old vote used.
  const seen_hosts = [...qh.filter(q => q.site_id === s.site_id && q.page).map(q => q.page), ...logs.filter(l => normD(l.domain) === dom && l.published_url).map(l => l.published_url)].filter(u => ours(u));
  const site_model = SM.stored(s) || SM.from({ site_id: s.site_id, domain: dom }, { seen_hosts });
  const site_host = site_model.canonical_host || dom;
  const normU = (u) => { const k = keyOf(u); return k ? SM.siteUrl(site_model, pathOfU(u)) : ''; };
  const v = vis.filter(x => x.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0] || null;
  const gaps = v ? parse(v.gaps_json, []) : []; const cited = v ? parse(v.pages_json, []) : []; const compRows = v ? parse(v.competitors_json, []) : [];
  const comps = [...new Set([...s.settings.competitors, ...compRows.filter(c => c && /\./.test(c.domain || '')).map(c => c.domain)])];
  const myPrompts = prompts.filter(p => p.site_id === s.site_id); const promptOf = new Map(myPrompts.map(p => [p.prompt_id, p]));
  const slog = logs.filter(l => normD(l.domain) === dom); const lrows = ladders.filter(l => normD(l.domain) === dom);
  const sqAll = qh.filter(q => q.site_id === s.site_id && q.page); const lastPeriod = sqAll.reduce((m, q) => String(q.period_end || '') > m ? String(q.period_end || '') : m, '');
  const sq = sqAll.filter(q => String(q.period_end || '') === lastPeriod);   // the latest Search Console period only
  const stored = new Map(pagesStored.filter(p => p.site_id === s.site_id).map(p => [keyOf(p.url), p]));
  // ---- key pages ----
  const key = new Map();
  const addPage = (url, kind, why, extra = {}) => { if (!ours(url)) return; const k = keyOf(url), u = normU(url); if (!k) return; const x = key.get(k) || { url: u, kind, why, cited_by: [], questions: [] }; if (pathOfU(url) === '/' || pathOfU(url) === '') { x.kind = 'home'; x.why = 'homepage'; } if (extra.cited_by) x.cited_by = [...new Set([...x.cited_by, ...extra.cited_by])]; if (extra.question) x.questions = [...new Set([...x.questions, extra.question])].slice(0, 5); key.set(k, x); };
  for (const c of cited) addPage(c.url, 'cited', 'AI cites it', { cited_by: c.engines || [] });
  for (const l of slog.filter(l => l.published_url)) addPage(l.published_url, 'content', 'written by the agent: "' + l.keyword + '"');
  for (const l of lrows.filter(l => l.target_url && (l.status === 'published' || l.page_exists === true || l.page_exists === 'true'))) addPage(l.target_url, 'ladder', 'keyword ladder page: "' + l.keyword + '"');
  const byPage = new Map(); for (const q of sq) { const u = normU(q.page); if (!u) continue; const same = [...byPage.keys()].find(y => keyOf(y) === keyOf(u)) || u; byPage.set(same, (byPage.get(same) || 0) + (Number(q.impressions) || 0)); }
  [...byPage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([u, imp]) => addPage(u, 'search', imp.toLocaleString('en-GB') + ' Google impressions'));
  addPage(SM.siteUrl(site_model, '/'), 'home', 'homepage');
  // ---- the questions to win (targets) ----
  const pageFor = (keyword, question, pid) => {
    const fromAi = cited.find(c => answers.some(a => a.site_id === s.site_id && a.prompt_id === pid && String(a.our_urls || '').includes(String(c.url || '').replace(/^https?:\/\/(www\.)?/, ''))));
    if (fromAi) return { url: normU(fromAi.url), how: 'AI cited it for this question' };
    let best = null; for (const [u, imp] of byPage) { if (usedPages.has(keyOf(u))) continue; const qs = sq.filter(q => keyOf(q.page) === keyOf(u)); const o = Math.max(0, ...qs.map(q => wcover(keyword, q.query))); if (o >= 0.7 && (!best || o * Math.log10(10 + imp) > best.s)) best = { url: u, s: o * Math.log10(10 + imp), how: 'ranks on Google for related searches' }; }
    if (best) return best;
    const lr = lrows.find(l => l.target_url && !usedPages.has(keyOf(l.target_url)) && (l.status === 'published' || l.page_exists === true || l.page_exists === 'true') && wcover(keyword, l.keyword) >= 0.6); if (lr) return { url: normU(lr.target_url), how: 'keyword ladder page' };
    const lg = slog.find(l => l.published_url && !usedPages.has(keyOf(l.published_url)) && wcover(keyword, l.keyword) >= 0.6); if (lg) return { url: normU(lg.published_url), how: 'page written earlier' };
    return null;
  };
  // the site's own topic words appear in most of its queries: weight each word by how rare it is (IDF), so a page matches a question by its distinctive words
  const qn = Math.max(1, sq.length); const df = new Map(); for (const q of sq) for (const w of new Set(toks(q.query))) df.set(w, (df.get(w) || 0) + 1);
  const wgt = (w) => Math.log(1 + qn / (1 + (df.get(w) || 0)));
  const wcover = (kw, text) => { const K = [...new Set(toks(kw))], T = new Set(toks(text)); if (!K.length) return 0; const tot = K.reduce((t, w) => t + wgt(w), 0); return tot ? K.filter(w => T.has(w)).reduce((t, w) => t + wgt(w), 0) / tot : 0; };
  const usedPages = new Set();   // one refresh per page: a page matched to a question is not offered for the next one
  const existing = new Map(targetsStored.filter(t => t.site_id === s.site_id).map(t => [t.target_id, t]));
  const targets = [];
  for (const g of gaps.filter(g => g && g.prompt && g.kind !== 'brand').slice(0, 10)) {
    const p0 = promptOf.get(g.prompt_id || '') || myPrompts.find(x => String(x.prompt || '').trim() === String(g.prompt).trim()) || {}; const pid = g.prompt_id || p0.prompt_id || qid(g.prompt); const keyword = String(p0.keyword || g.topic || '').toLowerCase().trim() || toks(g.prompt).slice(0, 5).join(' ');
    const target_id = 'ait_' + s.site_id.replace(/^site_/, '') + '_' + pid; const old = existing.get(target_id) || {};
    const page = pageFor(keyword, g.prompt, pid); if (page) usedPages.add(keyOf(page.url)); const pr = page ? stored.get(keyOf(page.url)) : null;
    // a planned keyword-ladder page for the same search: the Content Cadence writes it with this AI target (one search, one page)
    const hw = new Set(lrows.flatMap(l => String(l.head_keyword || '').toLowerCase().split(/[^a-z0-9]+/)).filter(Boolean)); const kt = (k) => [...new Set(toks(k).filter(w => !hw.has(w)))];
    const same = (a, b) => { const A = kt(a), B = new Set(kt(b)); return A.length > 0 && A.filter(w => B.has(w)).length / A.length >= 0.6; };
    const ladderPage = !page ? lrows.find(l => !['published'].includes(String(l.status)) && (same(keyword, l.keyword) || same(l.keyword, keyword))) : null;
    const stale = !pr || !pr.updated_on || days(pr.updated_on) > CONFIG.refresh_after_days; const weak = !pr || (Number(pr.score) || 0) < 70;
    const kind = page ? 'refresh' : 'answer';
    const engines = Object.entries(g.engines || {}).filter(([, st]) => st === 'absent').map(([e]) => e);
    const vol = Number(g.volume) || 0; const value = Math.round(100 * (1 + Math.log10(1 + vol) / 2) * (CONFIG.stage_weight[g.stage] || 0.7) * (1 + Math.min(4, (g.competitors || []).length) / 4) * (1 + engines.length / 7)) / 100;
    const PT = { compare: 'Comparison Page', recommend: 'Guide', choose: 'Guide', cost: 'Guide', problem: 'Guide' };
    const status = ['writing', 'written', 'won'].includes(old.status) ? old.status : (kind === 'refresh' && !stale && !weak) ? 'skipped' : (old.status === 'skipped' && old.reason === 'kept by you') ? 'skipped' : 'queued';
    targets.push({ target_id, site_id: s.site_id, domain: dom, prompt_id: pid, question: g.prompt, keyword, kind, page_url: page ? page.url : '', page_type: kind === 'refresh' ? '' : (PT[g.kind] || 'Guide'),
      fanout: (g.fanout || []).slice(0, 8).join(' | '), sources_json: JSON.stringify((g.cited_urls || []).slice(0, 6).map(c => ({ u: c.u, t: c.t || '', n: c.n || 1 }))), competitors: (g.competitors || []).slice(0, 8).join(', '),
      engines: engines.join(', '), stage: g.stage || '', value, status,
      reason: ladderPage ? 'written as the keyword ladder page "' + ladderPage.keyword + '" (one search, one page)' : status === 'skipped' && kind === 'refresh' ? 'the page is fresh (updated ' + String(pr && pr.updated_on || '').slice(0, 10) + ') and AI-ready (' + (pr && pr.score) + '/100)' : page ? 'refresh ' + page.url + ' (' + page.how + (stale ? '; not updated in 90+ days' : '') + (weak ? '; AI-readiness ' + (pr ? pr.score + '/100' : 'not checked yet') : '') + ')' : 'no page answers it yet',
      created_at: old.created_at || iso, updated_at: iso, request_id: old.request_id || '', written_at: old.written_at || '', won_at: old.won_at || '' });
    if (page) addPage(page.url, 'target', 'answers "' + g.prompt.slice(0, 80) + '"', { question: g.prompt });
  }
  // targets no longer lost: won (if written) or no longer needed
  const lostIds = new Set(targets.map(t => t.target_id));
  for (const [id, t] of existing) if (!lostIds.has(id) && !['won', 'skipped'].includes(t.status) && v) { const won = ['writing', 'written'].includes(t.status);
    targets.push({ target_id: id, site_id: s.site_id, domain: dom, prompt_id: t.prompt_id || '', question: t.question || '', keyword: t.keyword || '', kind: t.kind || 'answer', page_url: t.page_url || '', page_type: t.page_type || '', fanout: t.fanout || '', sources_json: t.sources_json || '[]',
      competitors: t.competitors || '', engines: t.engines || '', stage: t.stage || '', value: Number(t.value) || 0, status: won ? 'won' : 'skipped', reason: won ? 'AI now names the business for this question' : 'no longer lost in the latest AI check',
      created_at: t.created_at || iso, updated_at: iso, request_id: t.request_id || '', written_at: t.written_at || '', won_at: won ? iso : (t.won_at || '') }); }
  const queued = targets.filter(t => t.status === 'queued').sort((a, b) => b.value - a.value);
  queued.slice(CONFIG.max_targets).forEach(t => { t.status = 'skipped'; t.reason = 'lower value than the ' + CONFIG.max_targets + ' queued questions (checked again next week)'; });
  // ---- pages to audit this week (rotating) ----
  const keyPages = [...key.values()].slice(0, CONFIG.max_key_pages);
  const rank = { cited: 0, target: 1, content: 2, ladder: 3, search: 4, home: 5 };
  const audit = keyPages.filter(p => { const st = stored.get(keyOf(p.url)); return !st || days(st.checked_at) >= CONFIG.recheck_days || on_demand; })
    .sort((a, b) => (stored.has(keyOf(a.url)) ? 1 : 0) - (stored.has(keyOf(b.url)) ? 1 : 0) || rank[a.kind] - rank[b.kind]).slice(0, CONFIG.audit_per_week);
  // ---- pages to submit (Bing / IndexNow): new or updated, and key pages Bing has not crawled ----
  const submit = new Map(); const addSub = (u, why) => { if (!ours(u)) return; const k = keyOf(u), x = normU(u); if (k && x && ![...submit.keys()].some(y => keyOf(y) === k)) submit.set(x, why); };   // one entry per page (www / slash variants)
  for (const l of slog.filter(l => l.published_url && days(l.published_at) <= CONFIG.recent_days)) addSub(l.published_url, 'published this week');
  for (const st of stored.values()) { if (st.updated_on && days(st.updated_on) <= CONFIG.recent_days && (!st.submitted_at || st.submitted_at < st.updated_on)) addSub(st.url, 'updated this week');
    else if (Number(st.bing_status) === 0 && st.checked_at && !st.bing_crawled_at && days(st.submitted_at) > CONFIG.resubmit_days) addSub(st.url, 'Bing has not crawled it'); }
  for (const p of keyPages) if (!stored.has(keyOf(p.url))) addSub(p.url, 'key page, first submission');
  // ---- the earned-media list: exact pages AI cited in answers that did not name the business (last 8 days, weekly + daily) ----
  const em = new Map();
  for (const a of answers.filter(a => a.site_id === s.site_id && (a.answered === true || a.answered === 'true') && !(a.mentioned === true || a.mentioned === 'true') && a.kind !== 'brand'))
    // G22 (2026-10-11 system review): a source chip sometimes carries only a fragment of the title ("E", "Best e" live). A title that
    // short is treated as missing, so Earned Media reads the page's own <title> from the copy it fetches anyway; a real title is kept whole.
    for (const c of parse(a.cited_urls, [])) { if (!c || !c.u || ours(c.u)) continue; const h = hostOf(c.u); const t0 = String(c.t || '').replace(/\s+/g, ' ').trim(); const t = t0.length >= 8 ? t0 : '';
      const x = em.get(c.u) || { url: c.u, title: t, host: h, n: 0, engines: new Set(), questions: new Set() }; x.n++; x.engines.add(a.engine); x.questions.add(a.prompt); if (!x.title && t) x.title = t; em.set(c.u, x); }
  const perHost = new Map();
  const earned = [...em.values()].map(x => ({ url: x.url, title: x.title, host: x.host, citations: x.n, engines: [...x.engines], questions: [...x.questions].slice(0, 3), kind: kindOf(x.host, x.title, x.url, comps) }))
    .sort((a, b) => b.citations * (1 + b.engines.length) - a.citations * (1 + a.engines.length))
    .filter((e, i, all) => !e.title || all.findIndex(x => x.host === e.host && x.title === e.title) === i)   // the same article under two addresses (tracking parameters) once
    .filter(e => { const k = perHost.get(e.host) || 0; perHost.set(e.host, k + 1); return k < 2; }).slice(0, 30);
  // ---- IndexNow key (stored once per site; the owner hosts https://<domain>/<key>.txt) and the monthly entity check ----
  const kRow = cache.find(c => c.key === 'indexnow:' + s.site_id); const kv = kRow ? parse(kRow.value, {}) : {};
  const indexnow_key = (kv && /^[a-f0-9]{32}$/.test(kv.key || '')) ? kv.key : hex(32);
  const prevG = growthRows.filter(g => g.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0] || null;
  const prevEntity = prevG ? parse(prevG.entity_json, null) : null;
  const entity_due = on_demand || !prevEntity || String(prevEntity.checked_at || '').slice(0, 7) !== month;
  const label = dom.split('.')[0];
  const brand_names = [...new Set([dom, ...(s.settings.brand_names || []), ...(label.length >= 5 ? [label] : []), s.profile.business_name].map(x => String(x || '').trim()).filter(x => x.length >= 3))];
  // D12: the name a draft signs with comes from the one site model (profile -> homepage Organization / og:site_name -> what the app sent),
  // never from the domain label — the earned-media drafts signed "techand" / "techand.ai" (live 2026-10-11). `link_builder` decides who
  // writes: with it on, these prospects go to the Link Builder's qualification and writer (one writer).
  const modelName = SM.name(site_model);
  const business_name = String(s.profile.business_name || '').trim() || (modelName && SM.helpers.bare(modelName) !== dom ? modelName : '');
  out.push({ json: { site_id: s.site_id, domain: dom, site_host, country: s.country || '', email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '', on_demand, business_name, profile: s.profile,
    link_builder: !!s.settings.link_builder, services: SM.services(site_model), accreditation: SM.facts(site_model).accreditation,
    brand_names, competitors: comps.slice(0, 12), ai_pages_month: s.settings.ai_pages_month, run_id: 'grow_' + iso.slice(0, 10).replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, ''), checked_at: iso,
    vis_checked_at: v ? v.checked_at : '', key_pages: keyPages, audit, submit: [...submit.entries()].slice(0, CONFIG.submit_max).map(([url, why]) => ({ url, why })), targets, earned, earned_fetch: earned.filter(e => e.kind !== 'competitor').slice(0, CONFIG.earned_fetch).map(e => e.url),
    indexnow_key, indexnow_new: !kRow, indexnow_verified_at: kv.verified_at || '', entity_due, previous_entity: prevEntity, previous: prevG ? { checked_at: prevG.checked_at, avg_score: Number(prevG.avg_score) || null, earned: parse(prevG.earned_json, []) } : null,
    stored_pages: [...stored.values()].map(p => ({ url: normU(p.url), key: keyOf(p.url), score: Number(p.score) || 0, checked_at: p.checked_at, updated_on: p.updated_on, submitted_at: p.submitted_at, submitted_via: p.submitted_via, bing_crawled_at: p.bing_crawled_at, bing_status: Number(p.bing_status) || 0, kind: p.kind })) } });
}
return out.length ? out : [{ json: { nothing_to_do: true, reason: 'no site to work on' } }];
