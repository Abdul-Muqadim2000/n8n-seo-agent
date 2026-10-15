// G11 (2026-10-13, system review FIX_PLAN.md): what the daily key-page watch fetches today. Per tracked site: the key pages of the one site
// model (home page, the pages in the menu, the pages Search Console brings impressions for, the pages the keyword ladders and the AI growth
// loop own — all of them already in `seo_pages`, never a fresh crawl) plus `/robots.txt`. One plain GET each, no paid API, nothing rendered.
// A site with nothing to watch makes no request. The re-check queue ("I fixed this" in the app: seo_audit_findings.recheck_state = requested)
// is carried on every item of its site, so the same fetches answer it (G11's second half).
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
  // B4-1 / B4-2 (2026-10-15, benchmark area 4): the measurement columns belong to the row, so the kit emits them — a Data Table
  // node auto-maps every field it is given, and a row that is short of a column is as wrong as one that carries a stray field.
  // The model itself measures nothing: these are the defaults the Site Tracker's own judgement is written over
  // (v5/code/Page_Inventory_Site.js), and `''` for decay_state means "never measured", never "steady".
  const num0 = (v) => (Number(v) || 0);
  const pageRows = (model) => pages(model).map(p => ({ site_id: S((model || {}).site_id), url: S(p.url), title: S(p.title).slice(0, 300), h1: S(p.h1).slice(0, 300),
    source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries_json: JSON.stringify(p.queries || []), updated_at: S((model || {}).model_updated_at) || new Date().toISOString(),
    clicks: num0(p.clicks), impressions: num0(p.impressions), position: num0(p.position), prev_clicks: num0(p.prev_clicks), yoy_clicks: num0(p.yoy_clicks),
    decay_state: S(p.decay_state), decay_pct: num0(p.decay_pct), decay_lost: num0(p.decay_lost), decay_kind: S(p.decay_kind),
    decay_basis: S(p.decay_basis).slice(0, 900), measured_at: S(p.measured_at) }));
  return { from, stored, siteUrl, apiTarget, name, nap, services, pages, facts, matchPage, withPages, toRow, pageRows, COLUMNS, isFresh, ageDays, FRESH_DAYS, MATCH_MIN,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml } };
})();
// ---- the daily key-page watch and Google's view of those pages (G11 + G25, 2026-10-13; system review FIX_PLAN.md) ----
// G11: a monthly audit cannot see a page that went noindex on the 3rd. Every day the key pages are fetched raw and cheaply (one plain GET
// each, no JavaScript, no paid API) and compared with what we stored: HTTP status, a redirect that appeared, `noindex`, the canonical, the
// title - plus a hash of robots.txt per site. A change that matters raises an alert the same day; an unchanged page raises none.
// G11's second half: when somebody presses "I fixed this" in the app on an audit finding, that one finding is re-checked on these pages
// within a day instead of waiting for the next monthly audit (PW.recheck).
// G25: Search Console's URL Inspection API says what *Google* thinks of a page - indexed or not, which canonical it chose, when it last
// crawled it, mobile usability and rich results. Its quota is 2,000 queries a day and 600 a minute per property, so the pages rotate
// (never inspected first, then the oldest inspection) and whatever the budget does not reach is reported as "not checked", never as fine.
const PW = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  // the n8n Code sandbox has no URL constructor (live finding 2026-10-02), so hosts and paths are read with regexes
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase() : ''; };
  const bare = (h) => S(h).toLowerCase().replace(/^www\./, '');
  const pathOf = (u) => { const p = S(u).replace(/^https?:\/\/[^\/]*/i, '').replace(/#.*$/, ''); return p || '/'; };
  // host-agnostic identity of a URL: crawls, sitemaps and canonicals disagree about www and the trailing slash
  const ukey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '') || S(u).toLowerCase();
  const same = (a, b) => !!a && !!b && ukey(a) === ukey(b);
  const strip = (s) => S(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();

  // ---- a small, stable fingerprint (FNV-1a, 32 bit): no crypto module is available in the sandbox ----
  const hash = (text) => {
    const t = S(text); let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  };

  // ---- what one raw fetch tells us about a page ----
  // `res` is an n8n HTTP Request answer with fullResponse + responseFormat text (so the body is under `data`, not `body`) and redirects NOT
  // followed: a key page that starts redirecting is itself a change worth knowing about.
  const signals = (res) => {
    const r = res || {};
    const status = n0(r.statusCode ?? r.status);
    const headers = r.headers || {};
    const hdr = (name) => { const k = Object.keys(headers).find(x => x.toLowerCase() === name); return k ? S(Array.isArray(headers[k]) ? headers[k].join(', ') : headers[k]) : ''; };
    const body = S(r.body ?? r.data);
    const failed = !status && (r.error || !body);
    if (failed) return { ok: false, error: S((r.error && (r.error.message || r.error.description)) || r.error || 'no answer').slice(0, 200), status: 0 };
    const xrobots = hdr('x-robots-tag');
    const head = body.slice(0, 200000);
    const metas = head.match(/<meta\b[^>]*>/gi) || [];
    const metaOf = (name) => {
      for (const m of metas) {
        if (!new RegExp('\\b(?:name|property)\\s*=\\s*["\']?' + name + '["\']?', 'i').test(m)) continue;
        const c = m.match(/\bcontent\s*=\s*"([^"]*)"/i) || m.match(/\bcontent\s*=\s*'([^']*)'/i) || m.match(/\bcontent\s*=\s*([^\s>]+)/i);
        if (c) return S(c[1]);
      }
      return '';
    };
    const robotsMeta = metaOf('robots') || metaOf('googlebot');
    const noindex = /\bnone\b|\bnoindex\b/i.test(robotsMeta) || /\bnone\b|\bnoindex\b/i.test(xrobots);
    const titles = (head.match(/<title[^>]*>[\s\S]*?<\/title>/gi) || []).map(t => strip(t.replace(/<\/?title[^>]*>/gi, '')));
    const canonRe = /<link\b[^>]*\brel\s*=\s*["']?canonical["']?[^>]*>/gi;
    const canons = (head.match(canonRe) || []).map(l => { const h = l.match(/\bhref\s*=\s*"([^"]*)"/i) || l.match(/\bhref\s*=\s*'([^']*)'/i); return h ? S(h[1]) : ''; }).filter(Boolean);
    const h1s = (body.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || []).map(x => strip(x).slice(0, 200)).filter(Boolean);
    return {
      ok: true, status,
      location: status >= 300 && status < 400 ? S(hdr('location')).slice(0, 500) : '',
      noindex, noindex_source: noindex ? (/\bnone\b|\bnoindex\b/i.test(robotsMeta) ? 'meta robots' : 'X-Robots-Tag header') : '',
      robots_meta: robotsMeta.slice(0, 120), canonical: (canons[0] || '').slice(0, 500), canonicals: canons.length,
      title: (titles[0] || '').slice(0, 300), titles: titles.length, description: metaOf('description').slice(0, 400),
      h1: (h1s[0] || ''), h1s: h1s.length, bytes: body.length, error: '',
    };
  };

  // ---- robots.txt: the fingerprint (seo_cache) plus the rules that decide whether a key page is crawlable ----
  const robotsRead = (res) => {
    const r = res || {}; const status = n0(r.statusCode ?? r.status); const text = S(r.body ?? r.data);
    if (!status) return { ok: false, status: 0, error: S((r.error && (r.error.message || r.error.description)) || r.error || 'no answer').slice(0, 200), hash: '', rules: [] };
    const clean = text.replace(/\r/g, '').split('\n').map(l => l.replace(/#.*$/, '').trim()).filter(Boolean).join('\n');
    const rules = []; let groups = [];
    for (const line of clean.split('\n')) {
      const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue;
      const field = m[1].toLowerCase(), value = S(m[2]);
      if (field === 'user-agent') { if (rules.length && rules[rules.length - 1].touched) { groups = []; } groups.push(value.toLowerCase()); rules.push({ agents: groups.slice(), touched: false }); continue; }
      if (field !== 'disallow' && field !== 'allow') continue;
      if (!rules.length) { groups = ['*']; rules.push({ agents: ['*'], touched: false }); }
      const g = rules[rules.length - 1]; g.touched = true; g.agents = groups.slice();
      (g.lines = g.lines || []).push({ allow: field === 'allow', path: value });
    }
    // which groups apply to Googlebot (its own group wins over `*`, as Google's parser does)
    const forGoogle = rules.filter(g => g.agents.some(a => a === 'googlebot'));
    const applies = (forGoogle.length ? forGoogle : rules.filter(g => g.agents.includes('*'))).flatMap(g => g.lines || []);
    const blocks = (url) => {
      if (status === 404 || status >= 500 || !applies.length) return null;   // no file, or nothing that applies: nothing is blocked by it
      const p = pathOf(url);
      let best = null;
      for (const l of applies) {
        if (!l.path) continue;                                              // `Disallow:` with no path allows everything
        const pat = l.path.replace(/\*+/g, '*');
        const rx = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
        if (!rx.test(p)) continue;
        if (!best || l.path.length > best.path.length) best = l;
      }
      return best ? !best.allow : false;
    };
    return { ok: true, status, hash: hash(clean), length: clean.length, rules: applies, blocks, error: '' };
  };

  // ---- what changed since the stored reading, and how loudly to say it ----
  // `prev` is the stored seo_page_watch row (or null for a page nobody has watched yet), `now` the signals of this run.
  const CODES = {
    page_gone: { severity: 'critical', label: 'page gone' },
    page_error: { severity: 'critical', label: 'server error' },
    noindex_added: { severity: 'critical', label: 'noindex added' },
    robots_blocked: { severity: 'critical', label: 'blocked by robots.txt' },
    page_redirects: { severity: 'high', label: 'page now redirects' },
    canonical_moved: { severity: 'high', label: 'canonical moved' },
    canonical_removed: { severity: 'high', label: 'canonical removed' },
    robots_changed: { severity: 'high', label: 'robots.txt changed' },
    title_changed: { severity: 'medium', label: 'title changed' },
    page_back: { severity: 'info', label: 'page answers again' },
    noindex_removed: { severity: 'info', label: 'noindex gone' },
  };
  const compare = (prev, now, o) => {
    const opts = o || {}; const out = [];
    const add = (code, text, from, to) => out.push({ code, severity: CODES[code].severity, label: CODES[code].label, text, from: S(from), to: S(to) });
    if (!now || now.ok === false) return out;                                 // a failed fetch is "not checked", never a change
    const first = !prev || !S(prev.checked_at);
    const was = prev || {};
    const wasStatus = n0(was.status), nowStatus = n0(now.status);
    const url = S(opts.url);
    if (!first) {
      if (wasStatus >= 200 && wasStatus < 400 && nowStatus >= 500) add('page_error', 'The page answers ' + nowStatus + ' (it answered ' + wasStatus + ' before)', wasStatus, nowStatus);
      else if (wasStatus >= 200 && wasStatus < 400 && nowStatus >= 400) add('page_gone', 'The page is gone: it answers ' + nowStatus + ' (it answered ' + wasStatus + ' before)', wasStatus, nowStatus);
      else if (wasStatus >= 400 && nowStatus >= 200 && nowStatus < 300) add('page_back', 'The page answers ' + nowStatus + ' again (it answered ' + wasStatus + ' before)', wasStatus, nowStatus);
      if (nowStatus >= 300 && nowStatus < 400 && !(wasStatus >= 300 && wasStatus < 400)) add('page_redirects', 'The page now redirects (' + nowStatus + ' to ' + (S(now.location) || 'an address it does not name') + ')', wasStatus, nowStatus + ' ' + S(now.location));
      if (now.noindex && !was.noindex) add('noindex_added', 'The page tells search engines not to index it (' + S(now.noindex_source) + ': "' + S(now.robots_meta || 'noindex') + '")', '', S(now.noindex_source));
      if (!now.noindex && was.noindex) add('noindex_removed', 'The page no longer tells search engines to leave it out', S(was.noindex_source), '');
      // the title and the canonical are only compared between two readings of a page that was answering: the title of yesterday's 404
      // ("Not found") is not a baseline, so a page that comes back is "answers again", never "the title changed".
      const wasOk = wasStatus >= 200 && wasStatus < 300;
      if (wasOk && nowStatus >= 200 && nowStatus < 300) {
        if (S(was.canonical) && !S(now.canonical)) add('canonical_removed', 'The canonical tag is gone (it pointed at ' + S(was.canonical) + ')', S(was.canonical), '');
        else if (S(now.canonical) && S(was.canonical) && !same(now.canonical, was.canonical)) add('canonical_moved', 'The canonical now points at ' + S(now.canonical) + ' (it pointed at ' + S(was.canonical) + ')', S(was.canonical), S(now.canonical));
        if (S(was.title) && S(now.title) && S(was.title) !== S(now.title)) add('title_changed', 'The title changed to "' + S(now.title) + '" (it was "' + S(was.title) + '")', S(was.title), S(now.title));
      }
    }
    // a page we are seeing for the first time is a baseline, never a change — that includes one robots.txt already blocked before we looked
    if (!first && opts.robots_blocked === true && opts.robots_blocked_before !== true) add('robots_blocked', 'robots.txt now stops Google crawling ' + (url || 'this page'), '', 'disallowed');
    return out;
  };
  // the site's robots.txt as a change of its own (one per site, compared with the stored seo_cache fingerprint)
  const robotsChange = (prevHash, robots) => {
    if (!robots || robots.ok === false) return null;
    const before = S(prevHash);
    if (!before || before === S(robots.hash)) return null;
    return { code: 'robots_changed', severity: CODES.robots_changed.severity, label: CODES.robots_changed.label,
      text: 'robots.txt changed (' + robots.status + ', ' + n0(robots.length) + ' characters of rules). Read it before the next crawl: one wrong Disallow line can take the whole site out of Google.',
      from: before, to: S(robots.hash) };
  };
  const state = (changes, now) => (!now || now.ok === false) ? 'not_checked' : ((changes || []).some(c => c.severity !== 'info') ? 'changed' : 'ok');
  const worst = (changes) => { const order = ['critical', 'high', 'medium', 'info']; return (changes || []).map(c => c.severity).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] || ''; };

  // ---- "I fixed this": one audit finding, re-checked on the key pages we just fetched ----
  // Only what a raw fetch of the key pages can honestly answer is answered. Anything else (a crawl of the whole site, Search Console,
  // speed data) says so and waits for the audit - it never comes back "fixed" on a guess.
  const RULES = [
    { rule: 'broken_pages', re: /broken pages|do not return 200|not return 200|4xx|5xx/i, label: 'a key page that does not answer 200',
      test: (p) => n0(p.status) >= 400 },
    { rule: 'redirecting_pages', re: /internal urls that redirect|meta refresh/i, label: 'a key page that redirects',
      test: (p) => n0(p.status) >= 300 && n0(p.status) < 400 },
    { rule: 'noindex', re: /noindex|not indexable/i, label: 'a key page that asks not to be indexed', test: (p) => !!p.noindex },
    { rule: 'robots_blocked', re: /blocked by robots\.txt/i, label: 'a key page robots.txt blocks', test: (p) => p.robots_blocked === true },
    { rule: 'missing_title', re: /missing title tag/i, label: 'a key page with no title', test: (p) => n0(p.status) < 300 && !S(p.title) },
    { rule: 'multiple_titles', re: /more than one title tag/i, label: 'a key page with more than one title tag', test: (p) => n0(p.titles) > 1 },
    { rule: 'title_short', re: /title shorter than/i, label: 'a key page title under 30 characters', test: (p) => n0(p.status) < 300 && S(p.title) && S(p.title).length < 30 },
    { rule: 'title_long', re: /title longer than/i, label: 'a key page title over 60 characters', test: (p) => S(p.title).length > 60 },
    { rule: 'missing_description', re: /missing meta description/i, label: 'a key page with no meta description', test: (p) => n0(p.status) < 300 && !S(p.description) },
    { rule: 'description_short', re: /meta description shorter than/i, label: 'a key page description under 70 characters', test: (p) => n0(p.status) < 300 && S(p.description) && S(p.description).length < 70 },
    { rule: 'description_long', re: /meta description longer than/i, label: 'a key page description over 160 characters', test: (p) => S(p.description).length > 160 },
    { rule: 'missing_h1', re: /missing h1/i, label: 'a key page with no H1', test: (p) => n0(p.status) < 300 && !S(p.h1) },
    { rule: 'multiple_h1', re: /more than one h1/i, label: 'a key page with more than one H1', test: (p) => n0(p.h1s) > 1 },
    { rule: 'missing_canonical', re: /missing canonical tag/i, label: 'a key page with no canonical tag', test: (p) => n0(p.status) < 300 && !S(p.canonical) },
    { rule: 'canonical_other', re: /canonical points to a different page/i, label: 'a key page whose canonical points elsewhere',
      test: (p) => n0(p.status) < 300 && S(p.canonical) && !same(p.canonical, p.url) },
    { rule: 'http_pages', re: /served over http\b|link to http urls/i, label: 'a key page on http', test: (p) => /^http:\/\//i.test(S(p.url)) },
  ];
  const recheckRule = (finding) => {
    const text = S((finding || {}).title) || S((finding || {}).finding_key).split('|').slice(1).join('|');
    if (!text) return null;
    return RULES.find(r => r.re.test(text)) || null;
  };
  /** finding + the pages this run read -> { state: 'fixed' | 'still_open' | 'not_checked', note, checked, hits } */
  const recheck = (finding, pages) => {
    const list = (pages || []).filter(p => p && p.ok !== false && S(p.url) && S(p.kind) !== 'robots');
    const r = recheckRule(finding);
    const title = S((finding || {}).title) || S((finding || {}).finding_key);
    if (!r) return { state: 'not_checked', rule: '', checked: list.length, hits: [],
      note: 'The daily key-page watch cannot judge "' + title + '" on its own (it needs the full crawl, Search Console or speed data). The next audit decides it.' };
    if (!list.length) return { state: 'not_checked', rule: r.rule, checked: 0, hits: [],
      note: 'No key page could be read in this check, so nothing was judged. It is tried again with the next daily watch.' };
    const hits = list.filter(p => { try { return !!r.test(p); } catch (e) { return false; } }).map(p => S(p.url));
    return hits.length
      ? { state: 'still_open', rule: r.rule, checked: list.length, hits: hits.slice(0, 10),
          note: 'Still open on ' + hits.length + ' of the ' + list.length + ' key pages checked (' + r.label + '): ' + hits.slice(0, 3).join(', ') + (hits.length > 3 ? ' …' : '') + '.' }
      : { state: 'fixed', rule: r.rule, checked: list.length, hits: [],
          note: 'Fixed on the ' + list.length + ' key pages checked (no ' + r.label + ' left). The next full audit checks the rest of the site.' };
  };

  // ---- G25: URL Inspection within the quota ----
  const QUOTA_PER_DAY = 2000;        // Search Console URL Inspection API, per property (developers.google.com/webmaster-tools/limits)
  const QUOTA_PER_MINUTE = 600;      // the same page, per property
  const PER_RUN = 150;               // what one weekly Site Tracker run spends per property: 7.5% of the day's quota
  const PER_AUDIT = 100;             // what one audit spends (it also runs on demand, several times a day on a bad day)
  /**
   * Chooses which pages to inspect now: never inspected first, then the oldest inspection, importance breaking ties. Everything the
   * budget does not reach comes back under `skipped` so the report can say "not checked" instead of implying the page is fine.
   * pages: [{ url, weight, inspect_at }]; cap: how many this run may spend.
   */
  const inspectBudget = (pages, cap, o) => {
    const opts = o || {};
    const limit = Math.max(0, Math.min(n0(cap) || PER_RUN, QUOTA_PER_DAY - n0(opts.used)));
    const seen = new Set(); const list = [];
    for (const p of (pages || [])) { const k = ukey(p.url); if (!S(p.url) || seen.has(k)) continue; seen.add(k); list.push(p); }
    const ts = (p) => { const t = Date.parse(S(p.inspect_at)); return Number.isFinite(t) ? t : 0; };   // 0 = never inspected, so it goes first
    const ordered = list.slice().sort((a, b) => ts(a) - ts(b) || n0(b.weight) - n0(a.weight) || S(a.url).localeCompare(S(b.url)));
    const take = ordered.slice(0, limit), skipped = ordered.slice(limit);
    return { take, skipped, limit, quota: QUOTA_PER_DAY,
      note: 'URL Inspection is capped at ' + QUOTA_PER_DAY + ' pages a day per Search Console property (Google\'s quota); this run asked about '
        + take.length + ' of ' + ordered.length + ' key pages, oldest inspection first'
        + (skipped.length ? ', so ' + skipped.length + ' are reported as "not checked" until the next run.' : '.') };
  };
  /** One URL Inspection answer -> what Google thinks. A permission or quota error is an error, never "not indexed". */
  const inspection = (res) => {
    const r = res || {};
    const ir = (r.inspectionResult || {});
    const idx = ir.indexStatusResult || null;
    const mob = ir.mobileUsabilityResult || null;
    const rich = ir.richResultsResult || null;
    const gErr = () => { const e = r.error; if (!e) return ''; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return S((inner && inner.message) || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200); };
    const err = r.error ? gErr() : (idx ? '' : 'no inspection result');
    const quota = /quota|rate limit|RESOURCE_EXHAUSTED|429/i.test(err);
    const denied = /permission|forbidden|403|unauthor|invalid_grant/i.test(err);
    if (err) return { ok: false, error: err, error_kind: quota ? 'quota' : denied ? 'access' : 'error', indexed: null, verdict: '', coverage: '',
      robots: '', last_crawl: '', google_canonical: '', user_canonical: '', canonical_ok: null, mobile_usable: null, mobile_issues: [], mobile_verdict: '', mobile_note: '', rich_results: [], rich_verdict: '',
      not_checked: quota ? 'Google\'s daily URL Inspection quota for this property is used up: not checked today.' : denied ? 'Search Console access is missing for this property: not checked.' : 'The inspection failed: not checked (' + err + ').' };
    // R10 (2026-10-13, re-rating §3.11): Google retired the Mobile Usability report and the API now answers `VERDICT_UNSPECIFIED` with no
    // issue list for every page (45 of 45 live on 2026-10-13). That is NOT CHECKED. The live run read it as "not mobile-friendly" and raised
    // a High finding on 45 of 47 pages with empty evidence, ranked second of 60. Only a FAIL that names at least one issue is a real problem;
    // every other answer (unspecified, neutral, missing, a FAIL with nothing behind it) is unknown, with the reason said out loud.
    const mobVerdict = S(mob && mob.verdict).toUpperCase();
    const mobIssues = mob && Array.isArray(mob.issues) ? mob.issues.map(i => S(i.message) || S(i.issueType)).filter(Boolean).slice(0, 5) : [];
    const mobUsable = mobVerdict === 'PASS' ? true : (mobVerdict === 'FAIL' && mobIssues.length) ? false : null;
    const mobNote = mobUsable !== null ? ''
      : (mobVerdict === 'FAIL' ? 'Search Console reports a mobile problem without naming an issue, so mobile usability was not checked.'
        : mobVerdict === 'NEUTRAL' ? 'Search Console gave no mobile verdict for this page, so mobile usability was not checked.'
          : 'Search Console no longer answers mobile usability (Google retired the Mobile Usability report), so it was not checked.');
    return {
      ok: true, error: '', error_kind: '', verdict: S(idx.verdict), indexed: S(idx.verdict) === 'PASS', coverage: S(idx.coverageState),
      indexing_state: S(idx.indexingState), robots: S(idx.robotsTxtState), last_crawl: S(idx.lastCrawlTime),
      google_canonical: S(idx.googleCanonical), user_canonical: S(idx.userCanonical),
      canonical_ok: (!S(idx.googleCanonical) || !S(idx.userCanonical)) ? null : same(idx.googleCanonical, idx.userCanonical),
      mobile_usable: mobUsable, mobile_issues: mobIssues, mobile_verdict: mobVerdict, mobile_note: mobNote,
      rich_verdict: rich ? S(rich.verdict) : '',
      rich_results: rich && rich.detectedItems ? rich.detectedItems.map(d => S(d.richResultType)).filter(Boolean) : [],
      not_checked: '',
    };
  };
  /** The index picture over a set of inspections, with what was not checked said out loud (G25). */
  const coverage = (inspections, o) => {
    const opts = o || {};
    const list = (inspections || []).filter(Boolean);
    const ok = list.filter(i => i.ok !== false && !i.error);
    const by = {}; for (const i of ok) { const k = S(i.coverage) || S(i.verdict) || 'unknown'; by[k] = (by[k] || 0) + 1; }
    const failed = list.filter(i => i.ok === false || i.error);
    const indexed = ok.filter(i => i.indexed === true).length;
    const notIndexed = ok.filter(i => i.indexed === false);
    const canonMismatch = ok.filter(i => i.canonical_ok === false);
    const mobileBad = ok.filter(i => i.mobile_usable === false);
    const richTypes = [...new Set(ok.flatMap(i => i.rich_results || []))];
    const notChecked = n0(opts.not_checked) + failed.length;
    // R10: mobile usability is reported on its own terms — how many pages Google really answered about, and the reason when it answered about none
    const mobileChecked = ok.filter(i => i.mobile_usable !== null).length;
    const mobileNote = (ok.length && !mobileChecked)
      ? (S((ok.find(i => S(i.mobile_note)) || {}).mobile_note) || 'Search Console no longer answers mobile usability (Google retired the Mobile Usability report), so it was not checked.')
      : '';
    return { checked: ok.length, indexed, not_indexed: notIndexed.length, by_state: by, failed: failed.length, not_checked: notChecked,
      not_checked_reason: notChecked ? (S(opts.not_checked_reason) || (failed[0] && failed[0].not_checked) || 'not checked in this run') : '',
      canonical_mismatch: canonMismatch.length, mobile_bad: mobileBad.length, mobile_checked: mobileChecked,
      mobile_not_checked: ok.length - mobileChecked, mobile_note: mobileNote,
      rich_results: richTypes, quota: QUOTA_PER_DAY, quota_note: S(opts.quota_note),
      // never "fine": a page nobody inspected is counted apart from the ones Google answered about
      text: ok.length
        ? indexed + ' of ' + ok.length + ' key pages are indexed' + (notIndexed.length ? ', ' + notIndexed.length + ' are not' : '')
          + (notChecked ? ', ' + notChecked + ' were not checked' : '') + ' (Search Console URL Inspection; quota ' + QUOTA_PER_DAY + ' pages a day per property)'
        : 'No page could be inspected in Search Console' + (notChecked ? ' (' + notChecked + ' not checked: ' + (S(opts.not_checked_reason) || (failed[0] && failed[0].not_checked) || 'no access') + ')' : '') };
  };

  return { signals, robotsRead, compare, robotsChange, state, worst, recheck, recheckRule, inspectBudget, inspection, coverage, hash,
    CODES, RULES, QUOTA_PER_DAY, QUOTA_PER_MINUTE, PER_RUN, PER_AUDIT,
    helpers: { hostOf, bare, pathOf, ukey, same, strip, S, n0 } };
})();
const CONFIG = { max_sites_per_run: 40, max_watch_pages: 25, max_rechecks_per_site: 10, queries_min_impressions: 1 };
let trigger = {}; try { const t = $('Watch Run').first(); trigger = (t && t.json) || {}; } catch (e) {}
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const S = (v) => String(v == null ? '' : v).trim();
const normD = (x) => S(x).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const ukey = PW.helpers.ukey;
const sites = rowsOf('Load Sites (Watch)').filter(r => r.site_id && r.domain);
const ladders = rowsOf('Load Ladders (Watch)').filter(r => r.ladder_id && r.domain);
const pageRows = rowsOf('Load Pages (Watch)').filter(r => r.site_id && r.url);
const watchRows = rowsOf('Load Page Watch').filter(r => r.site_id && r.url);
const cacheRows = rowsOf('Load Watch Cache').filter(r => S(r.key).indexOf('watch:') === 0);
const findingRows = rowsOf('Load Recheck Requests').filter(r => r.site_id && r.finding_key);

// ---- the sites: registered ones plus every domain that has a keyword ladder (as the weekly Site Tracker counts them) ----
const byDomain = new Map();
for (const s of sites) { const d = normD(s.domain); if (d && !byDomain.has(d)) byDomain.set(d, { ...s, domain: d }); }
for (const l of ladders) { const d = normD(l.domain); if (d && !byDomain.has(d)) byDomain.set(d, { site_id: SM.helpers.siteIdFor(d), domain: d, email: S(l.email), callback_url: S(l.callback_url), status: 'active', source: 'ladder' }); }
const want = normD(trigger.domain) || S(trigger.site_id);
const on_demand = !!want || !!S(trigger.finding_key);
let list = [...byDomain.values()];
if (want) list = list.filter(s => s.domain === want || s.site_id === want);
else list = list.filter(s => S(s.status || 'active') !== 'paused');
list = list.slice(0, CONFIG.max_sites_per_run);
if (!list.length) return [{ json: { skip: true, reason: want ? 'no tracked site matches "' + want + '"' : 'no tracked site to watch yet', sites: byDomain.size } }];

const out = [];
list.forEach((s, site_idx) => {
  const row = sites.find(r => r.site_id === s.site_id) || {};
  const model = SM.withPages(SM.stored(row) || SM.from({ site_id: s.site_id, domain: s.domain }, {}), pageRows.filter(p => p.site_id === s.site_id));
  const home = SM.siteUrl(model, '/');
  // what makes a page a key page, strongest first: the home page, the menu, the searches it already earns impressions for, a ladder or
  // AI page we promised, then the newest pages of the inventory.
  const cand = [{ url: home, kind: 'home', weight: 100 }];
  for (const p of (model.nav_pages || [])) cand.push({ url: S(p.url), kind: 'nav', weight: 70 });
  for (const l of ladders.filter(l => normD(l.domain) === s.domain && S(l.target_url) && (l.page_exists === true || S(l.status) === 'published'))) cand.push({ url: S(l.target_url), kind: 'ladder', weight: 80 });
  for (const p of SM.pages(model)) {
    const imp = (p.queries || []).reduce((m, q) => m + (Number((q || {}).impressions) || 0), 0);
    const kind = /^ai/.test(S(p.source)) ? 'ai' : imp >= CONFIG.queries_min_impressions ? 'search' : 'page';
    cand.push({ url: S(p.url), kind, weight: kind === 'search' ? Math.min(60, 20 + Math.round(Math.log10(1 + imp) * 10)) : kind === 'ai' ? 50 : 10, lastmod: S(p.lastmod) });
  }
  const seen = new Set(); const pages = [];
  for (const c of cand.sort((a, b) => b.weight - a.weight || S(b.lastmod).localeCompare(S(a.lastmod)))) {
    const u = S(c.url); if (!/^https?:\/\//i.test(u)) continue;
    if (SM.helpers.bare(PW.helpers.hostOf(u)) !== SM.helpers.bare(s.domain)) continue;   // only the site's own pages are watched
    const k = ukey(u); if (seen.has(k)) continue; seen.add(k);
    pages.push({ url: u, kind: c.kind, weight: c.weight });
    if (pages.length >= CONFIG.max_watch_pages) break;
  }
  const cache = (() => { try { return JSON.parse(S((cacheRows.find(c => S(c.key) === 'watch:' + s.site_id) || {}).value) || 'null') || {}; } catch (e) { return {}; } })();
  const rechecks = findingRows.filter(f => f.site_id === s.site_id && (!S(trigger.finding_key) || S(f.finding_key) === S(trigger.finding_key)))
    .slice(0, CONFIG.max_rechecks_per_site)
    .map(f => ({ audit_id: S(f.audit_id), finding_key: S(f.finding_key), title: S(f.title), category: S(f.category), severity: S(f.severity), requested_at: S(f.recheck_requested_at) }));
  const site = { site_id: s.site_id, domain: s.domain, canonical_host: S(model.canonical_host) || s.domain, email: S(s.email), callback_url: S(s.callback_url),
    on_demand, pages_watched: pages.length, pages_known: SM.pages(model).length, rechecks, robots_hash_prev: S(cache.robots_hash), robots_status_prev: Number(cache.robots_status) || 0,
    last_checked_at: S(cache.checked_at), max_watch_pages: CONFIG.max_watch_pages };
  const prevOf = (u) => watchRows.find(r => r.site_id === s.site_id && ukey(r.url) === ukey(u)) || null;
  out.push({ json: { site_idx, site_id: s.site_id, domain: s.domain, url: SM.siteUrl(model, '/robots.txt'), kind: 'robots', weight: 0, site, prev: null } });
  for (const p of pages) out.push({ json: { site_idx, site_id: s.site_id, domain: s.domain, url: p.url, kind: p.kind, weight: p.weight, site, prev: prevOf(p.url) } });
});
return out.length ? out : [{ json: { skip: true, reason: 'no key page to watch (the page inventory is empty and no site model is stored yet)' } }];
