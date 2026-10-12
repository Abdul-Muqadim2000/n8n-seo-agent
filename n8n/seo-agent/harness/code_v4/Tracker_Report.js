// ---- anchor kit (D9, 2026-10-11; inlined through the __ANCHOR__ marker): the words a link to one of our own pages is written with.
// Live, "Guides in this series" linked to "Facts erp" and "Erp software dubai" — a raw keyword string with one capital letter (exec 365).
// anchorText() uses the page's own title when we have one, else title-cases the keyword and keeps acronyms: a token that is already
// all-caps and at most 4 letters is left alone, a known acronym (erp, uae, vat, crm, …) is upper-cased, mixed-case names keep their shape,
// and the small joining words stay lower-case unless they start the anchor. Regex only (no URL constructor in the n8n Code sandbox).
const ACRONYMS = new Set(['erp', 'uae', 'vat', 'crm', 'seo', 'sem', 'ppc', 'api', 'ai', 'bi', 'hr', 'it', 'ui', 'ux', 'qa', 'b2b', 'b2c', 'd2c', 'ksa', 'gcc', 'eu', 'uk', 'us', 'usa', 'uae', 'pos', 'edi', 'gst', 'trn', 'asp', 'sme', 'smb', 'cms', 'roi', 'kpi', 'sla', 'ocr', 'cfo', 'ceo', 'cto', 'coo', 'cio', 'rfp', 'rfq', 'kyc', 'aml', 'iso', 'xml', 'json', 'csv', 'pdf', 'url', 'sap', 'wps', 'fta', 'llm', 'rpa', 'mrp', 'scm', 'plm', 'eam', 'etl', 'pim', 'epm', 'ocr', 'vpn', 'sso', 'mfa', 'cpa', 'cfa', 'ifrs', 'gaap', 'nda', 'tco', 'sku', 'erp']);
const ANCHOR_MIXED = { saas: 'SaaS', paas: 'PaaS', iaas: 'IaaS', ecommerce: 'eCommerce', zatca: 'ZATCA', peppol: 'Peppol', emaratax: 'EmaraTax', iphone: 'iPhone', ipad: 'iPad', javascript: 'JavaScript', wordpress: 'WordPress', youtube: 'YouTube', linkedin: 'LinkedIn', chatgpt: 'ChatGPT', openai: 'OpenAI', netsuite: 'NetSuite', quickbooks: 'QuickBooks', powerbi: 'PowerBI' };
const ANCHOR_SMALL = new Set(['a', 'an', 'and', 'the', 'of', 'for', 'in', 'on', 'to', 'at', 'by', 'or', 'vs', 'via', 'with', 'from', 'into', 'per']);
function titleCaseKeyword(s) {
  const words = String(s == null ? '' : s).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return words.map((w, i) => {
    const bare = w.replace(/[^A-Za-z0-9&]/g, '');
    if (!bare) return w;
    if (bare === bare.toUpperCase() && bare.length <= 4 && /[A-Z]/.test(bare)) return w;   // already an acronym, e.g. "ERP"
    const low = bare.toLowerCase();
    const sub = (rep) => w.replace(bare, rep);
    if (ACRONYMS.has(low)) return sub(low.toUpperCase());
    if (ANCHOR_MIXED[low]) return sub(ANCHOR_MIXED[low]);
    if (i > 0 && ANCHOR_SMALL.has(low)) return sub(low);
    if (bare !== low && /[A-Z]/.test(bare.slice(1))) return w;   // a name the caller already cased ("McKinsey", "eInvoicing")
    return sub(low.charAt(0).toUpperCase() + low.slice(1));
  }).join(' ');
}
// a page = { title?, keyword?, url } -> the words to link it with (never an empty string, never a bare URL path in lower case)
function anchorText(p) {
  const o = p && typeof p === 'object' ? p : { keyword: p };
  const t = String(o.title || '').trim();
  if (t) return t.replace(/\s*\|\s*[^|]{1,40}$/, '').trim() || t;   // "ERP Software UAE | Tech&" -> "ERP Software UAE"
  const kw = String(o.keyword || '').trim();
  if (kw) return titleCaseKeyword(kw);
  const path = String(o.url || '').replace(/^https?:\/\/[^\/]+/i, '').replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '').split('/').pop().replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').trim();
  return titleCaseKeyword(path) || String(o.url || '');
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

    const services = uniq([...listOf(x.services), ...listOf((x.description || {}).services), ...(jparse(row.services_json, []) || [])].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
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
// ---- results-page observations (2026-10-11, FIX_PLAN D26): an AI Overview (and every other SERP feature) is what ONE Google query showed at
// ONE moment — live, the ladder plan said "no AI Overview" and the page run minutes later "cites 11 domains". Inlined by the build
// (the SERP_OBS placeholder) into Analyze Competitor Pages (the digest the verdict reads), Build Keyword Strategy (stored vs live checks) and Build
// Ladder Report; the keyword report's row is patched by build_v4.py. Every text says WHEN it was seen ("seen in the check at 15:58 UTC on
// 2026-10-11") or "seen in N of M checks", and that AI Overviews vary between searches — never "there is no AI Overview".
// the time of a DataForSEO SERP answer (result datetime "2026-10-11 15:58:12 +00:00", else the task time, else now) as ISO
const serpSeenAt = (res) => {
  try {
    const t0 = ((res || {}).tasks || [])[0] || {}; const r0 = (t0.result || [])[0] || {};
    const raw = String(r0.datetime || t0.time || r0.check_url_time || '');
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(?:Z|([+-]\d{2}):?(\d{2}))?/);
    if (m) { const d = new Date(m[1] + 'T' + m[2] + ':' + (m[3] || '00') + (m[4] ? m[4] + ':' + m[5] : 'Z')); if (!isNaN(d.getTime())) return d.toISOString(); }
  } catch (e) {}
  return new Date().toISOString();
};
// "15:58 UTC on 2026-10-11"
const obsClock = (iso) => { const d = iso ? new Date(iso) : null; if (!d || isNaN(d.getTime())) return 'an unknown time'; const z = d.toISOString(); return z.slice(11, 16) + ' UTC on ' + z.slice(0, 10); };
// obs: [{ seen: true | false | null, at: iso, source }] -> { count, seen, text }; null = that check could not read the results page (not counted)
const aioObserved = (obs) => {
  const known = (obs || []).filter(o => o && o.seen != null);
  if (!known.length) return { count: 0, seen: 0, text: 'unknown — the results page could not be read' };
  const seen = known.filter(o => o.seen);
  const one = (o) => (o.seen ? 'seen' : 'not seen') + ' in the check at ' + obsClock(o.at) + (o.source ? ' (' + o.source + ')' : '');
  if (known.length === 1) return { count: 1, seen: seen.length, text: one(known[0]) + ' — AI Overviews vary between searches, so this is one observation, not a fixed feature of the query' };
  return { count: known.length, seen: seen.length, text: 'seen in ' + seen.length + ' of ' + known.length + ' checks (' + known.map(one).join('; ') + ') — AI Overviews vary between searches' };
};
// ---- what one rank check's results page showed (G6, 2026-10-12, system review FIX_PLAN) ----
// Every rank check already pays for one SERP call. Until now we kept three things from it: our position, our ranking URL and a
// comma-joined list of item types. The leaders (Semrush Position Tracking, Ahrefs Rank Tracker, AccuRanker, SE Ranking) keep the
// whole page: the AI Overview (shown, and whether it cites us), the featured snippet, People Also Ask, the local pack, video and
// shopping blocks, the other domains on page 1 with their positions, a share of voice, and a stored snapshot as proof of the reading
// (criteria 2.2, 2.5, 2.6, 2.13 of CRITERIA_technical_tracking_reporting_ai_links.md). This kit reads all of it from the answer we
// already have, so the depth-50 check costs exactly what it cost before.
// Rules it keeps:
//   * a call that failed is never turned into a fact: `unavailable` is set and every flag is null — "check again", like position -1,
//     never "no AI Overview" / "does not rank" (the live lesson of 2026-10-09 and D26);
//   * an AI Overview Google loads asynchronously comes back without its sources unless we pay extra for them, so "cites us" is then
//     null (unknown), never false;
//   * the share of voice is a MODEL built on a published CTR curve, not measured clicks, and says so in `method`.
// Needs serpSeenAt / aioObserved from _serp_obs.js, which the build inlines above it.
const RS = (() => {
  // the same CTR-by-position curve the Search Console report uses (v5/code/Parse_GSC.js EXPECTED_CTR): industry averages, a model
  const CTR = [0.28, 0.15, 0.11, 0.08, 0.07, 0.05, 0.04, 0.035, 0.03, 0.025];
  const SUM_CTR = CTR.reduce((s, x) => s + x, 0);
  // Ahrefs (300k keywords, Mar 2025): position-1 CTR is 34.5% lower when an AI Overview is on the page. The clicks it keeps are
  // shared between the pages it cites. Both numbers are the model, not a measurement of this site.
  const ORGANIC_LEFT_WITH_AIO = 0.65;
  const SNIPPET_BONUS = 0.10;
  const METHOD = 'modelled: clicks by position from a published CTR curve (28/15/11/8/7/5/4/3.5/3/2.5%), the organic share cut to 65% when an AI Overview is shown (Ahrefs 2025) with the rest shared between the pages it cites, +0.10 for the featured snippet. Not measured clicks.';
  const S = (v) => String(v == null ? '' : v).trim();
  const bare = (v) => S(v).toLowerCase().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^www\./, '');
  const hostOf = (u) => bare((S(u).match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '');   // the n8n Code sandbox has no URL constructor
  const isOurs = (d, our) => !!d && !!our && (d === our || d.endsWith('.' + our));
  const listOf = (v) => [...new Set((Array.isArray(v) ? v : S(v).split(/[\n,;|]+/)).map(x => bare(x)).filter(Boolean))];
  const weight = (p) => (p >= 1 && p <= CTR.length) ? CTR[p - 1] : 0;
  const r1 = (x) => Math.round(x * 10) / 10;

  // one SERP answer -> { ok, error, seen_at, items, results_count }. A DataForSEO task error inside an HTTP 200 counts as failed.
  const read = (res) => {
    const r = res || {}; const t0 = (Array.isArray(r.tasks) ? r.tasks[0] : null) || {};
    let error = '';
    if (r.error || Number(r.status_code) >= 40000 || !Array.isArray(r.tasks) || Number(t0.status_code) >= 40000)
      error = S((r.error && (r.error.message || r.error)) || t0.status_message || r.status_message || 'no answer').slice(0, 120);
    const result = (t0.result || [])[0] || {};
    return { ok: !error, error, seen_at: serpSeenAt(r), items: Array.isArray(result.items) ? result.items : [],
      results_count: result.se_results_count == null ? null : Number(result.se_results_count) };
  };

  const unknownFeatures = (a) => ({ unavailable: true, error: (a && a.error) || 'no answer', checked_at: null, types: [], results_count: null,
    ai_overview: { shown: null, cites_us: null, content_loaded: false, cited_domains: [], seen_at: null },
    featured_snippet: { shown: null, ours: null, domain: '' }, people_also_ask: { shown: null, count: 0, questions: [] },
    local_pack: { shown: null, ours: null }, video: { shown: null }, shopping: { shown: null } });

  // the features the page showed, from the same answer
  const features = (a, ourDomain) => {
    if (!a || !a.ok) return unknownFeatures(a);
    const our = bare(ourDomain);
    const types = [...new Set(a.items.map(x => S(x && x.type)))].filter(Boolean);
    const has = (...t) => t.some(x => types.includes(x));
    const aioItem = a.items.find(x => x && x.type === 'ai_overview') || null;
    let refs = []; let texts = 0;
    if (aioItem) {
      ((aioItem.references) || []).forEach(r => refs.push(bare(r && r.domain) || hostOf(r && r.url)));
      ((aioItem.items) || []).forEach(x => {
        if (x && (x.text || x.title || x.markdown)) texts++;
        (((x || {}).references) || []).forEach(r => refs.push(bare(r && r.domain) || hostOf(r && r.url)));
        (((x || {}).links) || []).forEach(l => refs.push(hostOf(l && l.url)));
      });
      refs = [...new Set(refs.filter(Boolean))];
    }
    // Google loads some AI Overviews asynchronously: the item is there, its sources are not (loading them costs extra, so we do not).
    const sourcesUnknown = !!aioItem && (aioItem.asynchronous_ai_overview === true || (!refs.length && !texts));
    const fs = a.items.find(x => x && x.type === 'featured_snippet') || null;
    const fsDom = fs ? (bare(fs.domain) || hostOf(fs.url)) : '';
    const paaItem = a.items.find(x => x && x.type === 'people_also_ask') || null;
    const paa = paaItem ? ((paaItem.items) || []).map(q => S(q && (q.title || q.question))).filter(Boolean) : [];
    const lp = a.items.find(x => x && (x.type === 'local_pack' || x.type === 'map')) || null;
    const lpOurs = lp ? [...((lp.items) || []), lp].some(x => isOurs(bare(x && x.domain) || hostOf(x && x.url), our)) : null;
    return { unavailable: false, error: '', checked_at: a.seen_at, types, results_count: a.results_count,
      ai_overview: { shown: !!aioItem, content_loaded: !!aioItem && !sourcesUnknown,
        cites_us: !aioItem ? false : (sourcesUnknown ? null : refs.some(d => isOurs(d, our))),
        cited_domains: refs.slice(0, 12), seen_at: a.seen_at },
      featured_snippet: { shown: !!fs, ours: fs ? isOurs(fsDom, our) : false, domain: fsDom },
      people_also_ask: { shown: !!paaItem, count: paa.length, questions: paa.slice(0, 6) },
      local_pack: { shown: !!lp, ours: lpOurs }, video: { shown: has('video', 'short_videos') },
      shopping: { shown: has('shopping', 'popular_products') } };
  };

  // the comma list the serp_features column has always held (kept so nothing that reads it changes)
  const typeList = (a) => (!a || !a.ok) ? '' : [...new Set(a.items.map(x => S(x && x.type)))].filter(t => t && t !== 'organic').join(',');

  // our position over the whole depth that was bought (0 = not in it, so the caller can tell it from "the check failed")
  const ourRank = (a, ourDomain) => {
    if (!a || !a.ok) return { position: -1, url: '' };
    const our = bare(ourDomain);
    const mine = a.items.filter(x => x && x.type === 'organic').find(o => isOurs(bare(o.domain) || hostOf(o.url), our));
    return mine ? { position: Number(mine.rank_group) || 0, url: S(mine.url) } : { position: 0, url: '' };
  };

  // page 1: one row per domain (the best position it holds), plus every tracked competitor's best position over the whole answer
  const landscape = (a, ourDomain, competitorList, ourPosition) => {
    const our = bare(ourDomain);
    const comps = listOf(competitorList).filter(d => d && !isOurs(d, our));
    if (!a || !a.ok) return { unavailable: true, top: [], above: [], competitors: comps.map(domain => ({ domain, position: null, tracked: true })), tracked: comps };
    const organic = a.items.filter(x => x && x.type === 'organic').map((o, i) => ({
      position: Number(o.rank_group) || i + 1, domain: bare(o.domain) || hostOf(o.url), url: S(o.url), title: S(o.title).slice(0, 110) }))
      .filter(o => o.domain);
    const best = new Map();
    for (const o of organic) { const prev = best.get(o.domain); if (!prev || o.position < prev.position) best.set(o.domain, o); }
    const top = [...best.values()].filter(o => o.position >= 1 && o.position <= 10).sort((x, y) => x.position - y.position)
      .map(o => ({ ...o, ours: isOurs(o.domain, our) }));
    const mine = Number(ourPosition) > 0 ? Number(ourPosition) : null;
    const above = top.filter(t => !t.ours && (mine == null || t.position < mine)).map(t => ({ domain: t.domain, position: t.position, url: t.url, tracked: comps.includes(t.domain) }));
    const competitors = comps.map(domain => { const hit = best.get(domain) || [...best.entries()].filter(([d]) => d.endsWith('.' + domain)).map(([, v]) => v)[0];
      return { domain, position: hit ? hit.position : null, url: hit ? hit.url : '', tracked: true }; });
    // domains on page 1 that nobody named as a competitor but outrank us every week are worth naming too
    for (const t of top) if (!t.ours && !comps.includes(t.domain) && competitors.length < 20) competitors.push({ domain: t.domain, position: t.position, url: t.url, tracked: false });
    return { unavailable: false, top, above, competitors, tracked: comps };
  };

  // CTR- and feature-weighted share of voice over page 1 (a model: see METHOD)
  const voice = (land, feats, ourDomain, ourPosition) => {
    const our = bare(ourDomain);
    if (!land || land.unavailable || !feats || feats.unavailable) return { ours: null, shares: [], method: METHOD, unavailable: true, aio_sources_unknown: false };
    const aio = feats.ai_overview.shown === true;
    const sourcesUnknown = aio && !feats.ai_overview.content_loaded;
    const cited = aio && !sourcesUnknown ? (feats.ai_overview.cited_domains || []) : [];
    const organicLeft = aio ? ORGANIC_LEFT_WITH_AIO : 1;
    const snipDom = feats.featured_snippet.shown ? feats.featured_snippet.domain : '';
    const w = new Map();
    const add = (d, v) => { if (!d || !(v > 0)) return; w.set(d, (w.get(d) || 0) + v); };
    for (const t of land.top) add(t.domain, weight(t.position) * organicLeft);
    if (snipDom) add(snipDom, SNIPPET_BONUS * organicLeft);
    if (cited.length) { const each = (1 - organicLeft) * SUM_CTR / cited.length; for (const d of cited) add(d, each); }
    // the clicks the AI Overview keeps when we do not know which pages it cites belong to nobody on the page: they stay in the
    // denominator, so everyone's share drops (without this the 0.65 factor would cancel out and an AI Overview would cost nothing)
    const unattributed = (aio && !cited.length) ? (1 - organicLeft) * SUM_CTR : 0;
    const total = [...w.values()].reduce((s, x) => s + x, 0) + unattributed;
    if (!(total > 0)) return { ours: 0, shares: [], method: METHOD, unavailable: false, aio_sources_unknown: sourcesUnknown };
    const shares = [...w.entries()].map(([domain, v]) => ({ domain, pct: r1(v / total * 100), ours: isOurs(domain, our) })).sort((x, y) => y.pct - x.pct);
    const mineRow = shares.find(x => x.ours);
    return { ours: mineRow ? mineRow.pct : 0, shares: shares.slice(0, 12), method: METHOD, unavailable: false,
      aio_sources_unknown: sourcesUnknown, our_position: Number(ourPosition) > 0 ? Number(ourPosition) : null };
  };

  // the proof we keep of the reading: the top 10 with their URLs and trimmed titles, the features seen, and when
  const snapshot = (a, land, feats, device) => ({ at: (a && a.seen_at) || null, device: device || 'desktop',
    results: (a && a.results_count) || null, unavailable: !a || !a.ok, error: a && a.ok ? '' : ((a && a.error) || 'no answer'),
    features: feats && !feats.unavailable ? (feats.types || []).filter(t => t !== 'organic').slice(0, 12) : [],
    top: ((land && land.top) || []).map(t => ({ p: t.position, u: S(t.url).slice(0, 180), t: S(t.title).slice(0, 80) })) });

  // a JSON string that stays small: titles go first, then the tail of the list (a snapshot is proof, not an archive)
  const pack = (obj, max) => {
    const limit = Number(max) || 1800;
    let s = JSON.stringify(obj || null);
    if (s.length <= limit) return s;
    const o = JSON.parse(s);
    if (Array.isArray(o.top)) { o.top = o.top.map(t => ({ p: t.p, u: t.u })); o.trimmed = 'titles'; }
    s = JSON.stringify(o);
    while (s.length > limit && Array.isArray(o.top) && o.top.length > 1) { o.top.pop(); o.trimmed = 'titles+tail'; s = JSON.stringify(o); }
    return s.length <= limit ? s : s.slice(0, limit);
  };
  const unpack = (v, dflt) => { if (v && typeof v === 'object') return v; try { const o = JSON.parse(S(v) || 'null'); return o == null ? dflt : o; } catch (e) { return dflt; } };

  // one line a person can read, in the observation form D26 asks for (an AI Overview is what one search showed at one moment)
  const featureLine = (feats, obs) => {
    if (!feats || feats.unavailable) return 'Results page: could not be read in this check (' + ((feats && feats.error) || 'no answer') + ') — nothing about the page is claimed.';
    const parts = ['AI Overview ' + aioObserved(obs && obs.length ? obs : [{ seen: feats.ai_overview.shown, at: feats.ai_overview.seen_at, source: 'rank check' }]).text];
    if (feats.ai_overview.shown) parts.push(feats.ai_overview.cites_us === null ? 'whether it cites you was not loaded (loading an AI Overview\'s sources costs extra, so we do not buy it)'
      : feats.ai_overview.cites_us ? 'it cited your site in that check' : 'it did not cite your site in that check'
        + (feats.ai_overview.cited_domains.length ? ' (it cited ' + feats.ai_overview.cited_domains.slice(0, 5).join(', ') + ')' : ''));
    if (feats.featured_snippet.shown) parts.push(feats.featured_snippet.ours ? 'you hold the featured snippet' : 'featured snippet held by ' + (feats.featured_snippet.domain || 'another site'));
    if (feats.people_also_ask.shown) parts.push('People Also Ask with ' + feats.people_also_ask.count + ' question' + (feats.people_also_ask.count === 1 ? '' : 's'));
    if (feats.local_pack.shown) parts.push(feats.local_pack.ours ? 'local pack, your listing in it' : 'local pack');
    if (feats.video.shown) parts.push('video results');
    if (feats.shopping.shown) parts.push('shopping results');
    return parts.join('; ') + '.';
  };
  // the short labels the e-mail and the app show
  const featureChips = (feats) => {
    if (!feats || feats.unavailable) return ['not read'];
    const c = [];
    if (feats.ai_overview.shown) c.push('AI Overview' + (feats.ai_overview.cites_us === true ? ' (cites you)' : feats.ai_overview.cites_us === null ? ' (sources not loaded)' : ''));
    if (feats.featured_snippet.shown) c.push('Snippet' + (feats.featured_snippet.ours ? ' (yours)' : ''));
    if (feats.people_also_ask.shown) c.push('PAA');
    if (feats.local_pack.shown) c.push('Local pack' + (feats.local_pack.ours ? ' (yours)' : ''));
    if (feats.video.shown) c.push('Video');
    if (feats.shopping.shown) c.push('Shopping');
    return c;
  };

  return { CTR, SUM_CTR, METHOD, ORGANIC_LEFT_WITH_AIO, read, features, typeList, ourRank, landscape, voice, snapshot, pack, unpack,
    featureLine, featureChips, bare, hostOf, isOurs, listOf, weight };
})();
// Rank tracker report: per ladder, positions vs the previous check, rungs reached, drops and the recommended next step.
// v4.16 (G6, 2026-10-12 system review): also the results page itself — the features it showed (AI Overview, snippet, People Also Ask,
// local pack, video), who is above us with their positions, our modelled share of voice, and the mobile position of the main keywords.
// Anything volatile is worded as an observation of one search at one moment (_serp_obs.js, D26), never as a fact about the query.
const FORM_URL = 'http://localhost:5678/form/54f85234-172e-43e6-a84d-b5ecaa140e7d', API_URL = 'http://localhost:5678/webhook/seo-keyword-check';
const plan = $('Tracker Plan').all().map(i => i.json).filter(p => p && !p.nothing_to_do);
const pos = $('Parse Positions').all().map(i => i.json);
let history = []; try { history = $('Load History').all().map(i => i.json).filter(r => r && r.ladder_id); } catch (e) {}
// v4.8 display-only flags for the app (nothing in the e-mail changes): won / stuck per ladder; published dates from the content log, page facts from the ladder rows
let pubLog = []; try { pubLog = $('Load Content Log (Tracker)').all().map(i => i.json).filter(r => r && r.keyword && r.published_url && !r.error); } catch (e) {}
let ladderRows = []; try { ladderRows = $('Load Ladders').all().map(i => i.json).filter(r => r && r.ladder_id && r.keyword); } catch (e) {}
// 2026-10-12 (FIX_PLAN D11): the site's page inventory (seo_pages, filled weekly by the Site Tracker). A ladder keyword that a live page
// already answers is never "write it" or "publish it": the next step names that page and asks for a refresh, because a second page for the
// same search splits the signals. With no inventory stored nothing changes.
let pageRows = []; try { pageRows = $('Load Pages (Tracker)').all().map(i => i.json).filter(r => r && r.site_id && r.url && !r.error); } catch (e) {}
const modelFor = (domain) => SM.from({ site_id: 'site_' + normD(domain).replace(/[^a-z0-9]+/g, '-'), domain: normD(domain) },
  { pages: pageRows.filter(r => r.site_id === 'site_' + normD(domain).replace(/[^a-z0-9]+/g, '-')) });
const FLAGS = { won_checks: 4, won_position: 3, stuck_weeks: 8 };
const normK = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const validPos = (v) => v !== '' && v != null && Number.isFinite(Number(v)) && Number(v) >= 0;   // -1 = failed check: "check again", never a position
const nowCheck = pos[0] ? pos[0].checked_at : new Date().toISOString();
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const posText = (v) => v == null || v === 0 ? 'not in top 50' : v < 0 ? 'check failed' : '#' + v;
const td = 'style="padding:4px 8px;border:1px solid #cbd5e1"';
// G6: a mobile check is a second reading of the same keyword, so it never becomes a row of the ladder table — it is kept beside the
// desktop row (the series, the rungs, won / stuck and the next step all stay desktop, as they were before G6).
const isMob = (x) => String((x || {}).device || '') === 'mobile';
const deskHist = history.filter(h => !isMob(h));
const mobileNow = new Map();   // keyword -> this run's mobile reading
plan.forEach((p, i) => { if (isMob(p)) mobileNow.set(p.keyword, { position: Number((pos[i] || {}).position), checked_at: (pos[i] || {}).checked_at || nowCheck, fresh: true }); });
for (const d of ((plan[0] || {}).deferred_pages || [])) if (isMob(d) && !mobileNow.has(d.keyword)) mobileNow.set(d.keyword, { position: Number(d.last_position), checked_at: d.last_checked, fresh: false });
const mobileOf = (kw) => { const n = mobileNow.get(kw); if (n) return n;
  const h = history.filter(x => isMob(x) && x.keyword === kw && validPos(x.position)).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0];
  return h ? { position: Number(h.position), checked_at: h.checked_at, fresh: false } : null; };
const byLadder = new Map();
plan.forEach((p, i) => { if (isMob(p)) return; if (!byLadder.has(p.ladder_id)) byLadder.set(p.ladder_id, []); byLadder.get(p.ladder_id).push({ ...p, result: pos[i] || {} }); });
// pages not checked this week (not live yet; checked monthly) keep their last known position, so the ladder picture stays complete
for (const d of ((plan[0] || {}).deferred_pages || [])) { if (isMob(d) || !byLadder.has(d.ladder_id)) continue; const src = byLadder.get(d.ladder_id)[0]; byLadder.get(d.ladder_id).push({ ...src, ...d, deferred: true, result: { position: d.last_position, url: d.last_url, checked_at: d.last_checked } }); }
const out = [];
for (const [id, items] of byLadder) {
  const prevOf = (kw) => { const h = deskHist.filter(x => x.ladder_id === id && x.keyword === kw && String(x.checked_at) < nowCheck && Number(x.position) >= 0).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0]; return h ? Number(h.position) : null; };
  const rowsK = items.map(it => { const cur = Number(it.result.position); const prev = it.deferred ? cur : prevOf(it.keyword);
    const delta = (cur > 0 && prev > 0) ? prev - cur : (cur > 0 && prev === 0) ? 100 : (cur === 0 && prev > 0) ? -100 : null;
    return { ...it, current: cur, previous: prev, delta, url: it.result.url || '' }; }).sort((a, b) => a.rung - b.rung || a.page_no - b.page_no);
  const head = rowsK.find(r => r.rung === 4) || rowsK[0];
  // ---- G6: the results page of each keyword, read back from the row that was just stored ----
  const serpOf = (r) => {
    if (r.deferred) return null;
    const f = RS.unpack(r.result.features_json, null), c = RS.unpack(r.result.competitors_json, null);
    if (!f) return null;
    // the AI Overview across this check and the stored ones for the same keyword: "seen in N of M checks" (never "there is no AI Overview")
    const obs = [{ seen: f.unavailable ? null : f.ai_overview.shown, at: f.checked_at || nowCheck, source: 'rank check' }];
    for (const h of deskHist.filter(x => x.ladder_id === id && x.keyword === r.keyword && String(x.checked_at) < nowCheck).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at))).slice(0, 3)) {
      const hf = RS.unpack(h.features_json, null);
      if (hf) obs.push({ seen: hf.unavailable ? null : hf.ai_overview.shown, at: hf.checked_at || h.checked_at, source: 'rank check' });
    }
    const sov = r.result.share_of_voice == null || Number(r.result.share_of_voice) < 0 ? null : Number(r.result.share_of_voice);
    const above = ((c || {}).above || []).map(x => ({ domain: x.d, position: x.p, tracked: !!x.t }));
    return { features: f, chips: RS.featureChips(f), line: RS.featureLine(f, obs), observations: obs.filter(o => o.seen != null).length,
      share_of_voice: sov, above, competitors: ((c || {}).competitors || []).map(x => ({ domain: x.d, position: x.p, tracked: !!x.t })),
      shares: (c || {}).shares || [], method: (c || {}).method || RS.METHOD, snapshot_at: (RS.unpack(r.result.snapshot_json, {}) || {}).at || null };
  };
  const serps = new Map(rowsK.map(r => [r.keyword, serpOf(r)]));
  const mobiles = new Map(rowsK.map(r => [r.keyword, mobileOf(r.keyword)]));
  const rungs = [1, 2, 3].map(r => { const ps = rowsK.filter(x => x.rung === r); return { rung: r, pages: ps.length, top10: ps.filter(x => x.current > 0 && x.current <= 10).length, top3: ps.filter(x => x.current > 0 && x.current <= 3).length, reached: ps.length > 0 && ps.every(x => x.current > 0 && x.current <= 10) }; }).filter(r => r.pages);
  const drops = rowsK.filter(r => r.delta != null && r.delta <= -5).map(r => r.keyword + ' (' + posText(r.previous) + ' → ' + posText(r.current) + ')');
  const gains = rowsK.filter(r => r.delta != null && r.delta >= 5).map(r => r.keyword + ' (' + posText(r.previous) + ' → ' + posText(r.current) + ')');
  const topTop3Before = deskHist.filter(x => x.ladder_id === id && x.keyword === head.keyword && String(x.checked_at) < nowCheck && Number(x.position) > 0 && Number(x.position) <= 3).length;
  const done = head.current > 0 && head.current <= 3 && topTop3Before >= 3;
  const rowOf = (kw) => ladderRows.find(l => l.ladder_id === id && l.keyword === kw) || {};
  const logOf = (kw) => pubLog.filter(l => normK(l.keyword) === normK(kw) && (!l.ladder_id || l.ladder_id === id) && (!l.domain || normD(l.domain) === normD(head.domain))).sort((a, b) => String(a.published_at || '').localeCompare(String(b.published_at || '')))[0] || null;
  // 2026-10-11 (FIX_PLAN D16): the next step follows the ladder's state, not only the rungs — live, a main-page-only ladder read "every rung is in
  // the top 10" and a Direct plan was told to work on rung 1 while its main page waited to be published.
  //   main page: planned -> write it; written ('writing') but not live -> publish it (with the page's URL); live = row 'published', a content-log
  //   row, an existing page, or ranking. Direct plan (the main page is page 1) and main-page-only ladders: the main page comes first, the rungs
  //   only once it is live (the Content Cadence's gate). Short / full plans: rungs first; "every rung is in the top 10" only when rungs exist
  //   and are all in — then the main page is written, published or improved by its state.
  const isTop = (r) => r.rung === 4;
  const topRow = rowsK.find(isTop) || null;
  const invModel = pageRows.length ? modelFor(head.domain) : null;
  const ukeyT = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '');
  // D11: the live page that already answers this keyword (never the ladder's own planned URL)
  const coveredBy = (r) => { if (!invModel) return null; const m = SM.matchPage(invModel, r.keyword); return (m && ukeyT(m.url) !== ukeyT(r.target_url)) ? m : null; };
  const liveOf = (r) => { const lr = rowOf(r.keyword); return r.status === 'published' || !!logOf(r.keyword) || lr.page_exists === true || lr.page_exists === 'true' || r.current > 0 || !!coveredBy(r); };
  const mainLive = !!topRow && liveOf(topRow), mainWritten = !!topRow && (mainLive || topRow.status === 'writing');
  const mainFirst = !!topRow && (Number(topRow.page_no) === 1 || !rungs.length);
  const allIn = rungs.length > 0 && rungs.every(r => r.reached);
  const pending = rungs.find(r => !r.reached) || null;
  const pageOf = (t) => ({ keyword: t.keyword, page_type: t.page_type, target_url: t.target_url, status: t.status });
  let next;
  if (done) next = { action: 'complete', rung: 4, text: 'The top rung "' + head.keyword + '" has held the top 3 for 4 checks. From now on it is checked once a month with the published pages, so a drop is noticed; keep the pages fresh and the links growing.', pages: [] };
  else if (topRow && !mainWritten && (mainFirst || allIn)) next = { action: 'write_top', rung: 4, main_page: 'planned',
    text: (mainFirst ? (rungs.length ? 'This plan writes the main page first: ' : 'The main page is the whole ladder for now: ') : 'Every rung is in the top 10: ') + 'write the main page "' + head.keyword + '"' + (rungs.length && mainFirst ? '; its supporting pages follow once it is live' : '') + '.', pages: [pageOf(topRow)] };
  else if (topRow && mainWritten && !mainLive && (mainFirst || allIn)) next = { action: 'publish_top', rung: 4, main_page: 'written', publish_url: topRow.target_url || '',
    text: 'The main page "' + head.keyword + '" is written but not live yet: publish it' + (topRow.target_url ? ' at ' + topRow.target_url : '') + '. Nothing climbs until it is published' + (rungs.length && mainFirst ? ', and its supporting pages wait for it' : '') + '.', pages: [] };
  else if (pending) {
    const target = rowsK.filter(x => x.rung === pending.rung);
    next = { action: 'write_rung_' + pending.rung, rung: pending.rung, main_page: mainLive ? 'live' : mainWritten ? 'written' : 'planned',
      text: 'Work on rung ' + pending.rung + ': ' + (pending.top10 ? pending.top10 + ' of ' + pending.pages + ' pages are in the top 10. ' : 'none of its pages is in the top 10 yet. ') + 'Write or improve: ' + target.map(t => { const c = coveredBy(t);
        return '"' + t.keyword + '"' + (c ? ' (' + c.url + ' already answers this search — refresh that page, do not publish a second one)' : t.status === 'writing' ? ' (already written — publish it)' : ''); }).join(', ') + '.',
      pages: target.map(t => { const c = coveredBy(t); return c ? { ...pageOf(t), status: 'improve', target_url: c.url, covered_by: c.url } : pageOf(t); }) };
  } else { const cTop = topRow ? coveredBy(topRow) : null;   // D11: the page that answers the main keyword may be one the site already had
    next = { action: 'improve_top', rung: 4, main_page: 'live',
      text: (allIn ? 'Every rung is in the top 10 and the main page is live' : 'The main page is live') + ': improve the main page "' + head.keyword + '"' + (cTop ? ' — it is ' + cTop.url + ', the page the site already has for this search' : '') + ' (depth, internal links from the rung pages, links from other sites) and keep it fresh.',
      pages: topRow ? [cTop ? { ...pageOf(topRow), status: 'improve', target_url: cTop.url, covered_by: cTop.url } : pageOf(topRow)] : [] }; }
  // won: the main keyword in the top 3 in each of the last 4 checks, this one included (failed checks skipped)
  const histOf = (kw) => deskHist.filter(x => x.ladder_id === id && x.keyword === kw && String(x.checked_at) < nowCheck && validPos(x.position)).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
  const headChecks = [...(!head.deferred && validPos(head.result.position) ? [{ position: Number(head.result.position), checked_at: nowCheck }] : []), ...histOf(head.keyword)].slice(0, FLAGS.won_checks);
  const won = rowsK.some(r => r.rung === 4) && headChecks.length >= FLAGS.won_checks && headChecks.every(h => Number(h.position) >= 1 && Number(h.position) <= FLAGS.won_position);
  // stuck: pages published, the first one 8+ weeks ago, and none of them improved its position over the last 8 weeks
  const nowMs = new Date(nowCheck).getTime(), cutoff = nowMs - FLAGS.stuck_weeks * 7 * 864e5;
  const pubRows = rowsK.filter(r => r.status === 'published' || !!logOf(r.keyword));
  const pubDates = pubRows.map(r => { const l = logOf(r.keyword), lr = rowOf(r.keyword); const d = (l && (l.published_at || l.started_at)) || ((lr.page_exists === true || lr.page_exists === 'true') ? lr.start_date : ''); const t = d ? new Date(d).getTime() : NaN; return Number.isFinite(t) ? t : null; }).filter(t => t != null);
  const firstPub = pubDates.length ? Math.min(...pubDates) : null;
  const improved = pubRows.some(r => { const hs = histOf(r.keyword); const cur = (!r.deferred && validPos(r.result.position)) ? Number(r.result.position) : (hs[0] ? Number(hs[0].position) : null); if (cur == null) return false;
    const base = hs.find(h => new Date(h.checked_at).getTime() <= cutoff) || hs[hs.length - 1]; if (!base) return false; const b = Number(base.position);
    return cur > 0 && (b === 0 || cur < b); });
  const stuck = !won && pubRows.length > 0 && firstPub != null && firstPub <= cutoff && !improved;
  // 2026-10-11 (FIX_PLAN D9): pages are written without links to their unpublished siblings, so when one goes live the owner has to add the
  // link. One reminder line per ladder, only for the pages that went live since the previous check, with the anchor words to use.
  const lastCheck = deskHist.filter(x => x.ladder_id === id && String(x.checked_at) < nowCheck).map(x => String(x.checked_at)).sort().pop() || '';
  const links_to_add = lastCheck ? rowsK.map(r => { const l = logOf(r.keyword); const at = l ? String(l.published_at || l.started_at || '') : ''; return (at && at > lastCheck && l.published_url) ? { keyword: r.keyword, url: l.published_url, anchor: anchorText({ title: l.title, keyword: r.keyword, url: l.published_url }), rung: r.rung } : null; }).filter(Boolean) : [];
  const remindHtml = links_to_add.length ? '<p><b>Now live — add the links:</b> ' + links_to_add.map(x => '"' + esc(x.anchor) + '" (' + esc(x.url) + ')').join(', ') + '. ' +
    'Each of these pages was published since the last check, so the other ladder pages do not link to it yet: add one link from ' + (links_to_add.some(x => x.rung !== 4) ? 'the main page "' + esc(head.head_keyword) + '"' : 'the pages that cover the same topic') + ' using the anchor shown.</p>' : '';
  const firstPending = (next.pages || []).find(p => p.status !== 'writing') || (next.pages || [])[0];
  const apiBody = firstPending ? { mode: 'keyword', keyword: firstPending.keyword, page_type: firstPending.page_type || 'Service Page', country: head.country || '', domain: head.domain, existing_page_url: (next.action === 'improve_top' || firstPending.covered_by) ? (firstPending.target_url || '') : '', email: head.email, ladder_id: id, ladder_rung: next.rung, ladder_head: head.head_keyword, force_content: true } : null;   // D11: a covered keyword is written as a refresh of the page that exists
  const formLink = FORM_URL + '?' + encodeURIComponent('What do you want?') + '=' + encodeURIComponent('I know my keyword');
  const table = '<table style="border-collapse:collapse;font-size:13px"><tr><th align="left" ' + td + '>Rung</th><th align="left" ' + td + '>Keyword</th><th ' + td + '>Now</th><th ' + td + '>Before</th><th align="left" ' + td + '>Ranking URL</th></tr>' +
    rowsK.map(r => '<tr><td ' + td + '>' + (r.rung === 4 ? 'Top' : r.rung) + '</td><td ' + td + '>' + esc(r.keyword) + (r.deferred ? ' <span style="color:#64748b;font-size:11px">(not published yet: checked monthly, last ' + esc(String(r.last_checked || '').slice(0, 10)) + ')</span>' : '') + '</td><td align="center" ' + td + '>' + esc(posText(r.current)) + '</td><td align="center" ' + td + '>' + (r.previous == null ? 'first check' : esc(posText(r.previous))) + '</td><td ' + td + '>' + esc(r.url || '—') + '</td></tr>').join('') + '</table>';
  // ---- G6: what the results pages looked like, who is above us and the share of voice ----
  const mobText = (m) => !m ? '—' : posText(m.position) + (m.fresh ? '' : ' <span style="color:#64748b;font-size:11px">(' + esc(String(m.checked_at || '').slice(0, 10)) + ')</span>');
  const serpRows = rowsK.filter(r => serps.get(r.keyword) || mobiles.get(r.keyword));
  const serpTable = serpRows.length ? '<table style="border-collapse:collapse;font-size:13px"><tr><th align="left" ' + td + '>Keyword</th><th align="left" ' + td + '>What the page showed</th><th ' + td + '>Share of voice</th><th ' + td + '>Mobile</th><th align="left" ' + td + '>Above you</th></tr>' +
    serpRows.map(r => { const s = serps.get(r.keyword), m = mobiles.get(r.keyword);
      const ab = s && s.above.length ? s.above.slice(0, 3).map(a => esc(a.domain) + ' (#' + a.position + ')' + (a.tracked ? ' *' : '')).join(', ') + (s.above.length > 3 ? ' +' + (s.above.length - 3) + ' more' : '') : (s && r.current > 0 && r.current <= 10 ? 'nobody on page 1' : '—');
      return '<tr><td ' + td + '>' + esc(r.keyword) + '</td><td ' + td + '>' + esc(s ? (s.chips.join(' · ') || 'plain results, no features') : 'not checked this week') + '</td><td align="center" ' + td + '>' + (s && s.share_of_voice != null ? s.share_of_voice + '%' : '—') + '</td><td align="center" ' + td + '>' + mobText(m) + '</td><td ' + td + '>' + ab + '</td></tr>'; }).join('') + '</table>' : '';
  const headSerp = serps.get(head.keyword) || null;
  const serpHtml = serpTable ? '<p style="margin-top:14px"><b>The results page itself</b> (the same check, no extra cost):</p>' + serpTable +
    (headSerp ? '<p style="font-size:12px;color:#334155">' + esc(headSerp.line) + '</p>' : '') +
    '<p style="color:#64748b;font-size:12px">Share of voice is an estimate of the clicks page 1 offers, not measured clicks: ' + esc(RS.METHOD) + ' Domains marked * are the competitors on your list. Mobile is checked weekly for the main keywords (only about 13% of sites hold the same position on both devices).</p>' : '';
  const subject = '[Keyword ladder] ' + head.head_keyword + ' — ' + head.domain + ': ' + (head.current > 0 ? 'top page at #' + head.current : 'top page not yet in the top 100') + (drops.length ? ' · ' + drops.length + ' drop(s)' : '');
  const html = '<p>Hi,</p><p>Position check for your keyword ladder towards <b>' + esc(head.head_keyword) + '</b> on <b>' + esc(head.domain) + '</b> (' + rowsK.length + ' keywords, Google top 50).</p>' + table +
    '<p><b>Rungs:</b> ' + (rungs.map(r => 'Rung ' + r.rung + ': ' + r.top10 + '/' + r.pages + ' in top 10, ' + r.top3 + ' in top 3' + (r.reached ? ' ✓ reached' : '')).join(' · ') || 'no rung pages tracked') + '</p>' +
    (gains.length ? '<p style="color:#15803d"><b>Gains:</b> ' + esc(gains.join('; ')) + '</p>' : '') + (drops.length ? '<p style="color:#b91c1c"><b>Drops to look at:</b> ' + esc(drops.join('; ')) + '</p>' : '') +
    serpHtml + remindHtml + '<p><b>Next step:</b> ' + esc(next.text) + '</p>' + (next.publish_url ? '<p>Page to publish: <a href="' + esc(next.publish_url) + '">' + esc(next.publish_url) + '</a></p>' : '') +
    (apiBody ? '<p>Start the next page: open the <a href="' + formLink + '">SEO Assistant form</a> ("I know my keyword", keyword <b>' + esc(apiBody.keyword) + '</b>, domain ' + esc(head.domain) + '), or send this to the API (' + esc(API_URL) + '):</p><pre style="background:#f1f5f9;padding:8px;font-size:12px">' + esc(JSON.stringify(apiBody, null, 2)) + '</pre>' : '') +
    '<p style="color:#64748b;font-size:12px">Checks run weekly; once the top page holds the top 3 for four checks, the main keyword and the published pages are checked monthly. Positions come from DataForSEO live SERPs.</p>';
  // G6: the ladder's own picture of the results pages — our share of voice (the main keyword, and the average over the keywords that
  // were checked), the competitors above us anywhere on the ladder with how many keywords they beat us for, and what the pages showed.
  const sovs = rowsK.map(r => serps.get(r.keyword)).filter(s => s && s.share_of_voice != null).map(s => s.share_of_voice);
  const fcount = (pick) => rowsK.filter(r => { const s = serps.get(r.keyword); return s && !s.features.unavailable && pick(s.features) === true; }).length;
  const aboveCount = new Map();
  for (const r of rowsK) for (const a of ((serps.get(r.keyword) || {}).above || [])) { const e = aboveCount.get(a.domain) || { domain: a.domain, keywords: 0, best_position: a.position, tracked: a.tracked };
    e.keywords++; e.best_position = Math.min(e.best_position, a.position); e.tracked = e.tracked || a.tracked; aboveCount.set(a.domain, e); }
  const serp_summary = { checked: sovs.length, share_of_voice: sovs.length ? Math.round(sovs.reduce((s, x) => s + x, 0) / sovs.length * 10) / 10 : null,
    head_share_of_voice: headSerp ? headSerp.share_of_voice : null, method: RS.METHOD,
    competitors_above: [...aboveCount.values()].sort((a, b) => b.keywords - a.keywords || a.best_position - b.best_position).slice(0, 10),
    tracked_competitors: (headSerp && headSerp.competitors.filter(c => c.tracked)) || [],
    features: { ai_overview: fcount(f => f.ai_overview.shown), ai_overview_cites_us: fcount(f => f.ai_overview.cites_us),
      ai_overview_sources_unknown: fcount(f => f.ai_overview.shown === true && f.ai_overview.cites_us === null),
      featured_snippet: fcount(f => f.featured_snippet.shown), snippet_ours: fcount(f => f.featured_snippet.ours),
      people_also_ask: fcount(f => f.people_also_ask.shown), local_pack: fcount(f => f.local_pack.shown),
      video: fcount(f => f.video.shown), shopping: fcount(f => f.shopping.shown), not_read: rowsK.filter(r => (serps.get(r.keyword) || {}).features && serps.get(r.keyword).features.unavailable).length },
    head_line: headSerp ? headSerp.line : '', mobile_checked: rowsK.filter(r => (mobiles.get(r.keyword) || {}).fresh).length };
  out.push({ json: { ladder_id: id, domain: head.domain, head_keyword: head.head_keyword, email: head.email || '', callback_url: head.callback_url || '', request_id: head.request_id || '',
    subject, html, status: 'progress', stage: 'rank_tracker', checked_at: nowCheck,
    positions: rowsK.map(r => { const s = serps.get(r.keyword), m = mobiles.get(r.keyword);
      return { rung: r.rung, keyword: r.keyword, position: r.current, previous: r.previous, delta: r.delta, url: r.url, device: 'desktop',
        mobile_position: m ? m.position : null, mobile_checked_at: m ? m.checked_at : null,
        features: s ? s.features : null, feature_labels: s ? s.chips : [], results_page: s ? s.line : '',
        share_of_voice: s ? s.share_of_voice : null, above: s ? s.above : [], competitors: s ? s.competitors : [], snapshot_at: s ? s.snapshot_at : null }; }),
    rungs, gains, drops, serp_summary, next_step: next, links_to_add, api_body: apiBody, done, won, stuck } });
}
return out.length ? out : [{ json: { nothing_to_do: true } }];
