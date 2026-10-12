// Joins everything per site: Search Console, GA4, index status, trends and the live SERP checks -> KPIs, alerts, ranked actions (with
// ready-to-send API bodies), and the exact rows for the Data Tables seo_site_metrics / seo_query_history / seo_sites.
// v4.8: pages the publish detection found live this week (`detected_published`, `publish_detection`) count as published pages here.
// G19 (2026-10-12, SITE_MODEL_SPEC.md): the site model resolved earlier in this run - the canonical host every URL uses, the business
// name / NAP / logo, the services and the nav pages. SM.toRow(model) goes back into the seo_sites row, so the next run and every other
// workflow read the same facts; the brief is given the host and the name (never the bare domain).
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
// ---- site-tracking statistics (2026-10-12, FIX_PLAN G28): an alert must mean "this really changed", not "a number moved by 30%".
// Clicks, impressions and sessions are counts over two periods of the same length, so the honest test is the two-sample Poisson test
// (normal approximation, the same idea as the z-tests the AI Pulse uses in v5/code/_ai_stats.js):
//     z = (cur - prev) / sqrt(cur + prev),  |z| >= 1.96  =  outside 95% sampling noise.
// 28 clicks against 20 is a 40% "fall" that any week could produce by chance (z = -1.18); 1,400 against 1,600 is a 13% fall that is real
// (z = -3.65). A change therefore needs three things: enough volume to measure, statistical significance, and a size worth telling the owner.
// Anything large but not significant is reported as "watch", never as a fall — and Google's update dates are named when one ran in the period.
const ST = (() => {
  const num = (v) => Number(v) || 0;
  const z = (cur, prev) => { const s = num(cur) + num(prev); return s > 0 ? (num(cur) - num(prev)) / Math.sqrt(s) : 0; };
  // 95% interval for the relative change (log-ratio, Poisson counts); null when either side is zero
  const band = (cur, prev) => { const c = num(cur), p = num(prev); if (c <= 0 || p <= 0) return null;
    const se = Math.sqrt(1 / c + 1 / p), lo = Math.log(c / p) - 1.96 * se, hi = Math.log(c / p) + 1.96 * se;
    return [Math.round((Math.exp(lo) - 1) * 100), Math.round((Math.exp(hi) - 1) * 100)]; };
  // cur vs prev over equal periods. opts: { min_events, min_pct } — the events both periods must carry together before anything is claimed,
  // and the size of change worth telling the owner about
  const change = (cur, prev, opts) => {
    const o = opts || {}; const c = num(cur), p = num(prev);
    const minEvents = o.min_events == null ? 0 : o.min_events, minPct = o.min_pct == null ? 0 : o.min_pct;
    const pct = p > 0 ? Math.round((c - p) / p * 100) : (c > 0 ? null : 0);
    const zz = Math.round(z(c, p) * 100) / 100;
    const measurable = (c + p) >= minEvents;                     // both periods together carry enough events to say anything
    const significant = measurable && Math.abs(zz) >= 1.96;
    const big = pct != null && Math.abs(pct) >= minPct;
    return { cur: c, prev: p, pct, z: zz, ci: band(c, p), measurable, significant, big,
      real: significant && big, watch: !significant && big && p > 0,   // large but inside sampling noise: something to watch, not a fall
      direction: pct == null ? 'new' : pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
      text: (pct == null ? 'new' : (pct > 0 ? 'up ' : 'down ') + Math.abs(pct) + '%') + ' (' + p + ' → ' + c + (band(c, p) ? ', 95% range ' + band(c, p)[0] + '% to ' + band(c, p)[1] + '%' : '') + ')' };
  };
  // Google's confirmed ranking updates: context for a real fall, never a cause ("correlation, not proof"). Add new ones here.
  const UPDATES = [
    { name: 'March 2025 core update', start: '2025-03-13', end: '2025-03-27' },
    { name: 'June 2025 core update', start: '2025-06-30', end: '2025-07-17' },
    { name: 'August 2025 spam update', start: '2025-08-26', end: '2025-09-22' },
    { name: 'December 2025 core update', start: '2025-12-02', end: '2025-12-18' },
    { name: 'March 2026 core update', start: '2026-03-10', end: '2026-03-26' },
    { name: 'June 2026 core update', start: '2026-06-23', end: '2026-07-08' },
    { name: 'September 2026 core update', start: '2026-09-15', end: '2026-09-30' }
  ];
  const updatesIn = (range) => { const r = range || {}; const a = String(r.start || ''), b = String(r.end || '');
    if (!a || !b) return []; return UPDATES.filter(u => u.start <= b && u.end >= a); };
  const updateNote = (range) => { const hits = updatesIn(range); return hits.length ? ' A Google ' + hits.map(u => u.name + ' (' + u.start + ' to ' + u.end + ')').join(' and ') + ' ran inside this period — it may be part of the cause, which cannot be proven from these numbers.' : ''; };
  return { z, band, change, updatesIn, updateNote, UPDATES };
})();
// G28 (2026-10-12, FIX_PLAN): a traffic alert fires on a STATISTICAL change, not on a fixed 30%. ST.change (two-sample Poisson z, 95% range)
// decides; a large move that is still inside sampling noise is reported as "watch". Google's own update dates are added as context.
const FORM_URL = 'http://localhost:5678/form/54f85234-172e-43e6-a84d-b5ecaa140e7d', API_URL = 'http://localhost:5678/webhook/seo-keyword-check';
const sites = $('Resolve Properties').all().map(i => i.json);
const siteModels = (() => { try { return $('Site Model (Site)').all().map(i => i.json).filter(m => m && m.site_id); } catch (e) { return []; } })();
const grab = (name) => { try { return $(name).all().map(i => i.json).filter(j => j && !j.skip && !j.error); } catch (e) { return []; } };
const gscAll = grab('Parse GSC'), ga4All = grab('Parse GA4'), inspAll = grab('Parse Inspection'), trendAll = grab('Parse Trends'), serpAll = grab('Parse Site SERP');
let ga4Reason = ''; try { const r = ($('GA4 Requests').first() || {}).json; if (r && r.skip) ga4Reason = r.reason || ''; } catch (e) {}
const gErr = (r) => { if (!r) return 'no response'; const e = r.error; if (!e) return null; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return String((inner && inner.message) || (ctx.error_description ? String(ctx.error || 'error') + ': ' + ctx.error_description : '') || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200); };   // Google errors: the useful text sits in context.data (invalid_grant: account not found) or in error.message (PERMISSION_DENIED)
let acctErr = ''; try { const a = ($('GA4 Accounts').first() || {}).json || {}; if (a.error) acctErr = gErr(a); } catch (e) {}
const metricsHist = (() => { try { return $('Load Site Metrics').all().map(i => i.json).filter(r => r && r.site_id && !r.error); } catch (e) { return []; } })();
const queryHist = (() => { try { return $('Load Query History').all().map(i => i.json).filter(r => r && r.site_id && r.tracked && !r.error); } catch (e) { return []; } })();
const now = new Date().toISOString();
const pct = (cur, prev) => prev > 0 ? Math.round((cur - prev) / prev * 100) : (cur > 0 ? null : 0);
const r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
const normD = (x) => String(x || '').toLowerCase().replace(/^www\./, '');
// v4.8 publish detection (Detect Published): pages found live this week, and whether storing them worked (onError nodes: read their output)
const detAll = (() => { try { return $('Detect Published').all().map(i => i.json).filter(x => x && x.site_id && Array.isArray(x.detected)); } catch (e) { return []; } })();
// D11 (2026-10-12): the week's page inventory (Page Inventory (Site)) rides in the site model, so the advice knows what the site already has
const invAll = (() => { try { return $('Page Inventory (Site)').all().map(i => i.json).filter(x => x && x.site_id && Array.isArray(x.pages)); } catch (e) { return []; } })();
const detErrors = (() => { const out = []; for (const nm of ['Save Detected (Log)', 'Mark Case Study Published (Detect)', 'Mark Ladder Published (Detect)']) { try { for (const i of $(nm).all()) if (i.json && i.json.error) out.push(nm + ': ' + gErr(i.json)); } catch (e) {} } return out; })();
const detFail = (() => { for (const nm of ['Publish Candidates', 'Sitemap Children (Detect)', 'Match Slugs (Detect)', 'Detect Published']) { try { const e = $(nm).all().find(i => i.json && i.json.error); if (e) return nm + ': ' + gErr(e.json); } catch (x) {} } return ''; })();   // a failed detection step never stops the report
const ukey = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '');   // host-agnostic
const kwKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
return sites.map((s, idx) => {
  const cfg = s.config || {}; const R = s.ranges;
  const baseModel = (siteModels.find(m => m.site_id === s.site_id) || {}).model || SM.from({ site_id: s.site_id, domain: s.domain }, {});
  const inv = invAll.find(x => x.site_id === s.site_id) || null;
  const model = inv ? SM.withPages(baseModel, inv.pages) : baseModel;
  // a live page that already answers this keyword: never "publish a new page", always "refresh that page" (D11)
  const covered = (kw, notUrl) => { const m = SM.matchPage(model, kw); return (m && ukey(m.url) !== ukey(notUrl)) ? m : null; };
  // P2-3 (2026-10-12, Phase 2 live check; D15): a ladder row stores the target URL with the host it was written with — 17 of techand.ai's 18
  // rows are bare-host — so the report and the brief told the owner to publish at a URL that 308-redirects. Every URL we PROMISE (a page that
  // is not live yet) goes onto the canonical host; a URL we OBSERVED (a published or already existing page, Search Console, the sitemap) keeps
  // the host it really has. The stored rows themselves are rewritten once by fix_ladder_hosts.py.
  const onHost = (u) => { const raw = String(u || '').trim(); if (!raw) return raw; const h = SM.helpers.hostOf(raw);
    return (h && SM.helpers.bare(h) === SM.helpers.bare(s.domain)) ? SM.siteUrl(model, SM.helpers.pathOf(raw)) : raw; };
  const promised = (p) => (p && !(p.page_exists || p.status === 'published')) ? { ...p, url: onHost(p.url) } : p;
  const gsc = gscAll.find(g => g.site_idx === idx) || null;
  const ga4 = ga4All.find(g => g.site_idx === idx) || null;
  const insp = inspAll.filter(x => x.site_idx === idx);
  const trends = trendAll.filter(x => x.site_idx === idx);
  const serpRows = serpAll.filter(x => normD(x.domain) === s.domain);
  const serpNow = { ...(s.serp_positions || {}) }; for (const r of serpRows) serpNow[r.keyword] = { position: Number(r.position), url: r.url, checked_at: r.checked_at };
  const gscKw = new Map(((gsc && gsc.tracked) || []).map(t => [t.keyword, t]));
  const tracked = (s.tracked || []).map(t => { const g = gscKw.get(t.keyword); const sp = serpNow[t.keyword];
    const hist = queryHist.filter(h => h.site_id === s.site_id && h.query === t.keyword).sort((a, b) => String(a.period_end).localeCompare(String(b.period_end))).map(h => r1(h.position)).slice(-12);
    return { ...t, gsc_position: g ? g.position : null, gsc_prev_position: g ? g.prev_position : null, clicks: g ? g.clicks : 0, impressions: g ? g.impressions : 0, prev_clicks: g ? g.prev_clicks : 0, page: g ? g.page : '',
      serp_position: sp ? sp.position : null, serp_url: sp ? sp.url : '', serp_checked_at: sp ? sp.checked_at : '', history: hist }; });
  // pages found live this week replace their planned entry (live URL, published) or are added; they were inspected in this run
  const det = detAll.find(x => x.site_id === s.site_id) || null; const found = det ? det.detected : [];
  const basePages = (s.ladder_pages || []).map(p => { const f = found.find(f => kwKey(f.keyword) === kwKey(p.keyword) && (!f.ladder_id || !p.ladder_id || f.ladder_id === p.ladder_id)); return f ? { ...p, url: f.url, status: 'published', page_exists: true, detected: true } : promised(p); });
  for (const f of found) if (!basePages.some(p => ukey(p.url) === ukey(f.url))) basePages.push({ url: f.url, keyword: f.keyword, rung: 0, status: 'published', ladder_id: f.ladder_id || '', page_exists: true, detected: true });
  const pages = basePages.map(p => { const i = insp.find(x => x.url === p.url); return { ...p, inspected: !!i && !i.error, indexed: (i && !i.error) ? !!i.indexed : null, verdict: i ? i.verdict : '', coverage: i ? i.coverage : '', last_crawl: i ? i.last_crawl : '', canonical_ok: i ? i.canonical_ok : null, inspect_error: i ? i.error : (s.gsc_connected ? 'not inspected' : 'Search Console not connected') }; });
  // pages not live yet are reported as such, never as 'not indexed'
  for (const p of pages) if (!(p.page_exists || p.status === 'published')) { p.inspect_error = p.status === 'writing' ? 'written, not published yet' : 'planned, not written yet'; p.indexed = null; }
  // ---- alerts ----
  // G28: `drop` is no longer the test, it is the line between a medium and a high alert. The test is ST.change: enough events in the two
  // periods together (min_events), a change beyond 95% sampling noise (|z| >= 1.96) and a size worth reporting (min_pct). A big move that is
  // not significant becomes an 'info' alert worded as "watch", so a small site still hears about it without being told it fell.
  const alerts = []; const drop = cfg.alert_drop_pct || 30; const minPct = cfg.alert_min_pct || 10;
  const upd = ST.updateNote(R.current);
  const stat = { clicks: null, impressions: null, sessions: null };
  const countAlert = (key, label, cur, prev, minEvents, level) => {
    const ch = ST.change(cur, prev, { min_events: minEvents, min_pct: minPct }); stat[key] = ch;
    if (ch.direction !== 'down' || !ch.big) return ch;
    if (ch.real) alerts.push({ level: Math.abs(ch.pct) >= drop ? 'high' : level, text: label + ' fell ' + Math.abs(ch.pct) + '% (' + prev + ' → ' + cur + ' in 28 days' + (ch.ci ? '; 95% range ' + ch.ci[0] + '% to ' + ch.ci[1] + '%' : '') + ', z ' + ch.z + ')' + upd, stat: key });   // no range when one period is zero (the log-ratio is undefined)
    else if (ch.watch) alerts.push({ level: 'info', text: 'Watch: ' + label.toLowerCase() + ' are ' + Math.abs(ch.pct) + '% lower (' + prev + ' → ' + cur + '), but at this volume that is still within normal week-to-week variation (z ' + ch.z + ') — not a confirmed fall' + upd, stat: key });
    return ch;
  };
  if (!s.gsc_connected) alerts.push({ level: 'setup', text: 'Search Console is not connected: ' + (s.gsc_error || 'no property found') });
  if (gsc && gsc.errors.length) alerts.push({ level: 'medium', text: 'Some Search Console requests failed: ' + gsc.errors.slice(0, 3).join('; ') });
  if (gsc) countAlert('clicks', 'Search clicks', gsc.totals.cur.clicks, gsc.totals.prev.clicks, cfg.alert_min_click_events || 40, 'medium');
  if (gsc) countAlert('impressions', 'Impressions', gsc.totals.cur.impressions, gsc.totals.prev.impressions, cfg.alert_min_impression_events || 400, 'medium');
  if (ga4) countAlert('sessions', 'Organic sessions', ga4.organic.cur.sessions, ga4.organic.prev.sessions, cfg.alert_min_session_events || 40, 'medium');
  if (ga4 && ga4.errors.length) alerts.push({ level: 'medium', text: 'Some GA4 requests failed: ' + ga4.errors.slice(0, 3).join('; ') });
  for (const p of pages) if (p.inspected && p.indexed === false && (p.page_exists || p.status === 'published')) alerts.push({ level: p.detected ? 'info' : 'high', text: 'Page not indexed: ' + p.url + ' (' + (p.coverage || p.verdict || 'not indexed') + ')' + (p.detected ? ' — found live this week; request indexing to speed it up' : '') });   // a page that just went live is not alarming yet
  for (const p of pages) if (p.inspected && p.indexed && p.canonical_ok === false) alerts.push({ level: 'medium', text: 'Google picked another canonical for ' + p.url });
  for (const t of tracked) if (t.gsc_position && t.gsc_prev_position && t.gsc_prev_position <= 10 && t.gsc_position - t.gsc_prev_position >= 5) alerts.push({ level: 'medium', text: '"' + t.keyword + '" slipped from #' + r1(t.gsc_prev_position) + ' to #' + r1(t.gsc_position) + ' (Search Console average)' });
  for (const t of tracked) if (t.serp_position > 0 && t.gsc_position && Math.abs(t.serp_position - t.gsc_position) >= 10) alerts.push({ level: 'info', text: '"' + t.keyword + '": live check #' + t.serp_position + ' vs Search Console average #' + r1(t.gsc_position) + ' — positions vary by location and device' });
  if (!ga4) alerts.push({ level: 'setup', text: 'Google Analytics 4 is not connected: ' + (acctErr || ga4Reason || 'no property id given or detected') });
  const notices = s.console_alerts || []; const ck = s.last_checkin || null;
  for (const n of notices) alerts.push({ level: n.severity === 'critical' ? 'high' : n.severity === 'high' ? 'high' : 'medium', text: 'Search Console notice (' + String(n.received_at).slice(0, 10) + '): ' + n.subject });
  if (ck && ck.manual_action && !notices.some(n => n.kind === 'manual_action')) alerts.push({ level: 'high', text: 'Manual action reported in the ' + ck.month + ' check-in' });
  if (ck && ck.security_issue && !notices.some(n => n.kind === 'security')) alerts.push({ level: 'high', text: 'Security issue reported in the ' + ck.month + ' check-in' });
  if (found.length && detErrors.length) alerts.push({ level: 'medium', text: 'Pages found live on the site could not be recorded (' + detErrors[0] + '); report them with "I published a page"' });
  if (detFail) alerts.push({ level: 'info', text: 'Publish detection failed this week (' + detFail.slice(0, 160) + '); report published pages with "I published a page"' });
  if (det && det.candidates && !(det.sitemap || {}).ok) alerts.push({ level: 'info', text: 'Publish detection could not read the sitemap (' + ((det.sitemap || {}).error || 'no sitemap') + '); report published pages with "I published a page"' });
  // ---- actions (deterministic; the AI brief words them for the owner) ----
  const actions = []; const apiBase = { country: s.country || '', domain: s.domain, email: s.email || '' };
  const pageBody = (keyword, url, page_type) => ({ mode: 'keyword', keyword, page_type: page_type || 'Service Page', ...apiBase, existing_page_url: url || '', receive: ['Keyword Report', 'Page Content'] });
  const sa = cfg.service_account_email || '(the service-account e-mail: ask your administrator)';
  for (const n of notices.filter(n => n.kind === 'manual_action' || n.kind === 'security').slice(0, 2)) actions.push({ priority: 1, type: n.kind, action: (n.kind === 'manual_action' ? 'Resolve the manual action: open Search Console → Security & Manual Actions → Manual actions, fix every page it names, then request a review.' : 'Resolve the security issue: clean the site, update CMS and plugins, change passwords, then request a review under Search Console → Security issues.'), why: n.subject + ' (' + String(n.received_at).slice(0, 10) + ').', keyword: '', url: '' });
  for (const n of notices.filter(n => n.kind === 'coverage' || n.kind === 'cwv' || n.kind === 'rich_results' || n.kind === 'sitemap' || n.kind === 'crawl').slice(0, 2)) actions.push({ priority: 2, type: 'console_' + n.kind, action: 'Open the Search Console report named in "' + n.subject + '" and fix the listed pages, then click Validate fix.', why: 'Google sent this notice on ' + String(n.received_at).slice(0, 10) + '.', keyword: '', url: '' });
  if (ck && ck.csv_kind === 'reasons' && (ck.coverage.reasons || []).length) actions.push({ priority: 2, type: 'coverage_report', action: 'Work through the Pages report from your ' + ck.month + ' check-in: ' + ck.coverage.reasons.slice(0, 3).map(r => r.reason + ' (' + r.pages + ' pages)').join(', ') + '.', why: ck.not_indexed_total + ' pages are not indexed site-wide according to Search Console.', keyword: '', url: '' });
  if (s.checkin_due) actions.push({ priority: 3, type: 'checkin', action: 'Monthly Search Console check-in: open the form, answer two questions (manual action? security issue?) and upload the Pages report export.', why: 'Google offers no API for manual actions, security issues and the site-wide Pages report; the check-in covers them' + (cfg.console_mail_watcher ? ' alongside the notification watcher' : '') + '.', keyword: '', url: '' });
  if (!s.gsc_connected) actions.push({ priority: 1, type: 'connect_gsc', action: 'Add ' + sa + ' as a user (Full) of ' + s.domain + ' in Search Console → Settings → Users and permissions.', why: 'Without it the report has no real query, click or index data.', keyword: '', url: '' });
  for (const p of pages.filter(p => p.inspected && p.indexed === false && (p.page_exists || p.status === 'published')).slice(0, 3)) actions.push({ priority: 1, type: 'index', action: 'Request indexing for ' + p.url + ' in Search Console (URL inspection → Request indexing) and link to it from 2-3 existing pages.', why: (p.rung ? 'Ladder rung ' + p.rung + ' for "' + p.keyword + '"' : 'The page for "' + p.keyword + '"') + ' cannot rank until Google indexes it (' + (p.coverage || p.verdict || 'not indexed') + ').', keyword: p.keyword, url: p.url });
  // D11: a page written for a keyword a LIVE page already answers must not go up as a second page — it is folded into the page that exists
  for (const p of pages.filter(p => p.status === 'writing' && !p.page_exists).slice(0, 3)) { const c = covered(p.keyword, p.url);
    if (c) actions.push({ priority: 1, type: 'refresh_existing', action: 'Do not publish the new page for "' + p.keyword + '" as a second URL: ' + c.url + ' already answers this search. Use the new text to refresh that page instead.', why: 'Two pages for one search split the signals and neither ranks (the live page was found ' + (c.matched_by === 'query' ? 'in Search Console with ' + c.impressions + ' impressions for this query' : 'in the site\'s page list') + ').', keyword: p.keyword, url: c.url });
    else actions.push({ priority: 1, type: 'publish', action: 'Publish the written page for "' + p.keyword + '" (planned URL ' + p.url + ') and report the link with "I published a page".', why: 'It is written but not live yet; nothing can be indexed or ranked before it is published.', keyword: p.keyword, url: p.url }); }
  for (const q of ((gsc && gsc.striking) || []).slice(0, 3)) actions.push({ priority: 2, type: 'striking', action: 'Push "' + q.query + '" from #' + r1(q.position) + ' into the top 3: expand ' + (q.page || 'the ranking page') + ' with the missing sub-topics, add an FAQ and 2-3 internal links to it.', why: q.impressions + ' impressions in 28 days at position ' + r1(q.position) + ' (' + q.clicks + ' clicks); a top-3 spot typically triples the clicks.', keyword: q.query, url: q.page || '', api_body: pageBody(q.query, q.page, 'Service Page') });
  for (const q of ((gsc && gsc.ctr_gaps) || []).slice(0, 2)) actions.push({ priority: 2, type: 'ctr', action: 'Rewrite the title and meta description of ' + (q.page || 'the ranking page') + ' for "' + q.query + '" (lead with the outcome and a number).', why: 'Position ' + r1(q.position) + ' with ' + q.impressions + ' impressions but CTR ' + (q.ctr * 100).toFixed(1) + '% vs about ' + Math.round(q.expected_ctr * 100) + '% expected.', keyword: q.query, url: q.page || '' });
  for (const p of ((gsc && gsc.decaying_pages) || []).slice(0, 2)) actions.push({ priority: 3, type: 'decay', action: 'Refresh ' + p.page + ': update facts and dates, add what the top results cover now, re-promote it.', why: 'Clicks fell from ' + p.prev_clicks + ' to ' + p.clicks + ' in 28 days.', keyword: '', url: p.page });
  for (const t of trends.filter(t => t.direction === 'rising' && (t.rising || []).length).slice(0, 1)) actions.push({ priority: 3, type: 'trend', action: 'Interest in "' + t.keyword + '" is rising (' + (t.change_pct > 0 ? '+' : '') + t.change_pct + '% vs the 12-month average); cover the rising searches: ' + t.rising.slice(0, 3).map(r => r.query).join(', ') + '.', why: 'Google Trends, past 12 months.', keyword: t.rising[0].query, url: '', api_body: { mode: 'verdict', keyword: t.rising[0].query, ...apiBase } });
  for (const t of trends.filter(t => t.direction === 'falling').slice(0, 1)) actions.push({ priority: 4, type: 'trend', action: 'Interest in "' + t.keyword + '" is falling (' + t.change_pct + '% vs the 12-month average)' + (t.peak_date ? '; it peaked around ' + String(t.peak_date).slice(0, 7) : '') + '. Keep the page current but do not over-invest; watch the related rising searches.', why: 'Google Trends, past 12 months.', keyword: t.keyword, url: '' });
  if (!ga4) actions.push({ priority: 4, type: 'connect_ga4', action: 'Add the same service account as a Viewer of the GA4 property (Admin → Property access management), or register the site with its GA4 property ID.', why: 'Connects search visibility to visits and key events (conversions).', keyword: '', url: '' });
  actions.sort((a, b) => a.priority - b.priority); const acts = actions.slice(0, 12);   // the brief picks the top 5-6; the full list stays in the callback
  // ---- rows for the Data Tables ----
  const T = gsc ? gsc.totals : null; const G = ga4;
  const prevRuns = metricsHist.filter(m => m.site_id === s.site_id).sort((a, b) => String(a.period_end).localeCompare(String(b.period_end))).slice(-12).map(m => ({ period_end: m.period_end, clicks: Number(m.clicks) || 0, impressions: Number(m.impressions) || 0, position: r1(m.position), sessions: Number(m.sessions) || 0 }));
  const metrics_row = { site_id: s.site_id, domain: s.domain, period_start: R.current.start, period_end: R.current.end, checked_at: now, gsc_connected: !!gsc, ga4_connected: !!ga4,
    clicks: T ? T.cur.clicks : 0, impressions: T ? T.cur.impressions : 0, ctr: T ? T.cur.ctr : 0, position: T ? T.cur.position : 0, prev_clicks: T ? T.prev.clicks : 0, prev_impressions: T ? T.prev.impressions : 0, prev_ctr: T ? T.prev.ctr : 0, prev_position: T ? T.prev.position : 0,
    yoy_clicks: T && T.yoy ? T.yoy.clicks : 0, yoy_impressions: T && T.yoy ? T.yoy.impressions : 0, sessions: G ? G.organic.cur.sessions : 0, engaged_sessions: G ? G.organic.cur.engaged : 0, key_events: G ? G.organic.cur.key_events : 0,
    prev_sessions: G ? G.organic.prev.sessions : 0, prev_engaged_sessions: G ? G.organic.prev.engaged : 0, prev_key_events: G ? G.organic.prev.key_events : 0, organic_share: G ? G.organic_share : 0, queries: gsc ? gsc.query_count : 0, striking: gsc ? gsc.striking.length : 0,
    alerts: alerts.filter(a => a.level === 'high' || a.level === 'medium').map(a => a.text).join(' | ').slice(0, 500) };
  const qrow = (q, trackedFlag, serpPos) => ({ site_id: s.site_id, domain: s.domain, period_end: R.current.end, checked_at: now, query: q.query, clicks: q.clicks || 0, impressions: q.impressions || 0, ctr: r1((q.ctr || 0) * 1000) / 1000, position: r1(q.position), prev_clicks: q.prev_clicks || 0, prev_impressions: q.prev_impressions || 0, prev_position: r1(q.prev_position), page: q.page || '', tracked: trackedFlag, serp_position: (serpPos == null) ? -1 : Number(serpPos) });
  const trackedSet = new Set(tracked.map(t => t.keyword));
  const query_rows = [...tracked.map(t => qrow({ query: t.keyword, clicks: t.clicks, impressions: t.impressions, ctr: t.impressions ? t.clicks / t.impressions : 0, position: t.gsc_position || 0, prev_clicks: t.prev_clicks, prev_position: t.gsc_prev_position || 0, page: t.page }, true, t.serp_position)),
    ...((gsc && gsc.queries) || []).filter(q => !trackedSet.has(q.query)).slice(0, 100).map(q => qrow(q, false, null))];
  const site_row = { ...SM.toRow(model), site_id: s.site_id, domain: s.domain, gsc_property: s.gsc_property || s.gsc_property_hint || '', ga4_property_id: ga4 ? String(ga4.ga4_property_id) : (s.ga4_property_id || ''), country: s.country || '', location_code: Number(s.location_code) || 0, language_code: s.language_code || 'en', email: s.email || '', callback_url: s.callback_url || '',
    keywords: (s.keywords || []).join(', '), status: s.status || 'active', source: s.source || 'form', created_at: s.created_at || now, last_run_at: now, last_status: (gsc ? 'gsc:ok' : 'gsc:off') + ' ' + (ga4 ? 'ga4:ok' : 'ga4:off') + (alerts.some(a => a.level === 'high') ? ' alerts' : ''), request_id: s.request_id || '' };
  return { json: { site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '', period: R, checked_at: now, first_run: !!s.first_run, on_demand: !!s.on_demand, source: s.source, country: s.country || '',
    site: { canonical_host: model.canonical_host, home_url: SM.siteUrl(model, '/'), business_name: SM.name(model), name_source: model.name_source || '', services: SM.services(model).slice(0, 12), nav_pages: (model.nav_pages || []).slice(0, 8), nap: SM.nap(model), pages_known: SM.pages(model).length, model_updated_at: model.model_updated_at || '' },
    page_inventory: inv ? { pages: inv.total, with_queries: inv.with_queries, changed: inv.changed, by_source: inv.by_source, sitemap_read: inv.sitemap_read } : null,
    gsc: { connected: !!gsc, property: s.gsc_property || '', permission: s.gsc_permission || '', error: s.gsc_error || null, ...(gsc ? { totals: gsc.totals, deltas: gsc.deltas, daily: gsc.daily, query_count: gsc.query_count, page_count: gsc.page_count ?? null, anonymised: gsc.anonymised || null, brand_split: gsc.brand_split || null, scraper_queries: gsc.scraper_queries || null, rows_read: gsc.rows_read ?? null, paging: gsc.paging || [], truncated: gsc.truncated || [], winners: gsc.winners, losers: gsc.losers, new_queries: gsc.new_queries, lost_queries: gsc.lost_queries, striking: gsc.striking, ctr_gaps: gsc.ctr_gaps, top_pages: gsc.pages.slice(0, 10), decaying_pages: gsc.decaying_pages, rising_pages: gsc.rising_pages, errors: gsc.errors } : {}) },
    ga4: ga4 ? { connected: true, property_id: ga4.ga4_property_id, detected: ga4.ga4_detected, property_name: ga4.ga4_property_name, organic: ga4.organic, total: ga4.total, organic_share: ga4.organic_share, channels: ga4.channels, landing: ga4.landing, daily: ga4.daily, errors: ga4.errors } : { connected: false, error: acctErr || ga4Reason || 'no property id given or detected' },
    console: { notices, last_checkin: ck, checkin_due: !!s.checkin_due },
    significance: stat,   // G28: the Poisson z-test behind every traffic alert (clicks / impressions / sessions)
    tracked, ladder_pages: pages, pending_publish: (s.pending_publish || []).filter(p => !found.some(f => kwKey(f.keyword) === kwKey(p.keyword))), ladder_heads: s.ladder_heads || [], trends, alerts, actions: acts, prev_runs: prevRuns, weeks_tracked: prevRuns.length + 1, service_account_email: cfg.service_account_email || '', form_url: FORM_URL, api_url: API_URL,
    detected_published: found.map(f => ({ keyword: f.keyword, url: f.url, ladder_id: f.ladder_id || '', matched_by: f.matched_by, source: f.source })),
    publish_detection: det ? { checked: true, candidates: det.candidates, sitemap_ok: !!(det.sitemap || {}).ok, sitemap_urls: (det.sitemap || {}).urls || 0, sitemap_error: (det.sitemap || {}).error || '', pages_fetched: det.pages_fetched || 0, found: found.length,
      still_waiting: (det.unmatched || []).length, recorded: found.length ? !detErrors.length : null, error: found.length && detErrors.length ? detErrors.slice(0, 3).join('; ').slice(0, 300) : '' } : { checked: false, candidates: 0, found: 0, reason: detFail ? 'detection failed: ' + detFail.slice(0, 200) : 'no written page waiting for publication' },
    metrics_row, query_rows, site_row } };
});
