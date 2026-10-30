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
    // keyword-first (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §5.2 / §14.1): what the client SAID they sell ("What do you sell?" on Track my site,
    // seo_sites.declared_services) comes first and is never dropped by what a crawl read; it is kept apart as well, so SM.toRow writes it back
    // unchanged and the weekly Site Tracker can never overwrite it
    const declListOf = (v) => { if (Array.isArray(v)) return v; const j = jparse(v, null); return Array.isArray(j) ? j : listOf(v); };
    const declared_services = uniq([...declListOf(x.declared_services), ...declListOf(row.declared_services)].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
    const services = uniq([...declared_services, ...listOf(x.services), ...listOf(desc0.products_or_services), ...listOf(desc0.services), ...listOf(desc0.main_services), ...(jparse(row.services_json, []) || [])].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
    const navStored = jparse(row.nav_pages_json, []) || [];
    const navFresh = x.nav_pages || (html && canonical_host ? navFromHtml(html, canonical_host) : []);
    const nav_pages = (navFresh.length ? navFresh : navStored).map(p => ({ url: S(p.url), title: S(p.title), path: S(p.path) || pathOf(p.url) })).filter(p => p.url).slice(0, 12);

    const pages = (Array.isArray(x.pages) ? x.pages : []).map(p => ({ url: S(p.url), title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod),
      queries: Array.isArray(p.queries) ? p.queries : (jparse(p.queries_json, []) || []), http_status: Number(p.http_status) || 0, status_at: S(p.status_at) })).filter(p => p.url);

    const business_facts = S(req.business_facts || x.business_facts || row.business_facts).slice(0, 2000);
    const cta = S(req.cta || x.cta || row.cta).slice(0, 200);
    const mon = x.monitors || {};
    const brand_names = uniq([...listOf(mon.brand_names), ...listOf(x.brand_names), ...listOf(row.brand_names), nameHit.value].filter(Boolean));
    const competitors = uniq([...listOf(mon.competitors), ...listOf(x.competitors), ...listOf(row.competitors)].map(bare).filter(d => d && d !== domain)).slice(0, 8);
    const accreditation = S(x.accreditation || row.accreditation);
    const updated_at = S(x.updated_at) || S(row.model_updated_at) || new Date().toISOString();

    return { site_id, domain, canonical_host, host_source, home_url: 'https://' + canonical_host + '/',
      business_name: nameHit.value, name_source: nameHit.source, logo_url: logoHit.value, logo_source: logoHit.source,
      nap, services, declared_services, nav_pages, pages, business_facts, cta, brand_names, competitors, accreditation,
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
  // R35 (2026-10-16, re-rating 2026-10-15): the words were compared literally, so "d365 finance dubai" did not match a page titled
  // "Dynamics 365 Finance & Operations UAE" and the report told the owner that page "does not target" the search. Three rules, applied
  // to BOTH sides before anything is compared: the product's own short names are written out (d365 = dynamics 365, f&o = finance and
  // operations), a word is compared on a light stem (invoice / invoices / invoicing), and an emirate in the SEARCH is covered by a page
  // about the UAE ("emirate ⊂ uae" — never the other way round: a Dubai page does not answer every UAE search).
  const SYN = [[/\bd\s?365\b/g, 'dynamics 365'], [/\bdynamics365\b/g, 'dynamics 365'], [/\bf\s?&\s?o\b|\bfno\b/g, 'finance operations'], [/\bunited arab emirates\b/g, 'uae'],
    [/\babu dhabi\b/g, 'abudhabi'], [/\bras al khaimah\b/g, 'rasalkhaimah'], [/\bumm al quwain\b/g, 'ummalquwain'], [/\bal ain\b/g, 'alain']];
  const EMIRATES = new Set(['dubai', 'abudhabi', 'sharjah', 'ajman', 'fujairah', 'rasalkhaimah', 'rak', 'ummalquwain', 'alain']);
  const norm = (s) => { let t = S(s).toLowerCase().replace(/&amp;/g, '&'); for (const [re, to] of SYN) t = t.replace(re, to); return t; };
  const stem = (t) => t.length >= 5 ? t.replace(/(ings?|ed|es|(?<!s)s)$/, '').replace(/e$/, '') : t;   // business = businesses, invoice = invoicing
  const matchTerms = (s) => uniq(termsOf(norm(s)).map(stem));
  // a keyword term is covered by a page's terms: the same stem, or an emirate in the search against a page about the UAE
  const covers = (set, t) => set.includes(t) || (EMIRATES.has(t) && (set.includes('uae') || set.includes('emirat')));
  const shareIn = (want, set) => want.length ? want.filter(t => covers(set, t)).length / want.length : 0;
  // R56: a listing page (the blog / insights index, a category, a tag) gets impressions for every article it lists; when a dedicated
  // page matches the same search by its own slug or title, the dedicated page is the one that answers it
  const LISTING = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:insights|blog|blogs|news|articles|resources|posts|updates|knowledge|learn|library|stories|press|media|case-studies)\/?$|\/(?:category|categories|tag|tags|page|author|topics?)\/[^/]+\/?$/i;
  const isListing = (u) => { const p = pathOf(u).replace(/[?#].*$/, ''); return LISTING.test(p); };
  const untitled = (model) => pages(model).filter(p => !S(p.title) && !S(p.h1));
  // RV-1 (2026-10-21): a page whose address answered 404 / 410 when it was last read (redirects followed: the bare host 308s to www, which
  // 404s) is GONE. It is still in the inventory (Google keeps showing it), but no advice may point at it: matchPage never returns it as
  // "the page that answers this search", and the readers list it as a redirect to make (v5/code/_gone.js). Unknown (0) is not gone.
  const isGone = (p) => { const n = Number((p || {}).http_status) || 0; return n === 404 || n === 410; };
  const gonePages = (model) => pages(model).filter(isGone);
  // ---- K8 (2026-10-21, KW-MATCH): the page that is ABOUT the search, not only the page that repeats its words ----
  // The 75% word rule missed techand.ai's live "AI & Automation | What We Do | Tech&" (/whatwedo/ai-automation) for "ai consulting dubai"
  // (1 of 3 words) and the ladder planned a new top page beside it; it also let "it consulting services dubai" claim an AI consulting page
  // on "consulting services dubai" alone. Now: brand, place and generic service words ("consulting", "services", "company", "dubai") never
  // decide a match; what is left (the search's core words) must be on the page, weighted by how rare each word is on this site (IDF: a word
  // on every page proves nothing); the page's title / H1, address and Search Console searches are the evidence, in that order; a page whose
  // own words belong to another service of the client is never the answer; an article is not the answer to a buying search; a gone page
  // answers nothing. Every hit carries `confidence` (0-1), `confidence_label` and `evidence` in plain words; a weaker one is `may_overlap`
  // (pageMatch), which callers report as "may overlap" and never as the page.
  const GENERIC = new Set(['consulting', 'consultant', 'consultants', 'consultancy', 'consultancies', 'service', 'services', 'company', 'companies', 'agency', 'agencies',
    'firm', 'firms', 'provider', 'providers', 'solution', 'solutions', 'expert', 'experts', 'specialist', 'specialists', 'partner', 'partners', 'professional', 'professionals',
    'team', 'teams', 'best', 'top', 'near', 'me', 'leading', 'trusted', 'certified', 'official', 'online', 'local', 'affordable', 'cheap', 'home', 'page', 'website', 'site']);
  const COMMERCIAL = new Set(['consulting', 'consultant', 'consultants', 'consultancy', 'service', 'services', 'company', 'companies', 'agency', 'agencies', 'firm', 'firms',
    'provider', 'providers', 'solution', 'solutions', 'expert', 'experts', 'specialist', 'specialists', 'partner', 'partners', 'hire', 'price', 'pricing', 'cost', 'quote']);
  const PLACES = new Set(['uae', 'gcc', 'mena', 'emirates', 'emirate', 'middle', 'east', 'saudi', 'arabia', 'ksa', 'riyadh', 'jeddah', 'dammam', 'qatar', 'doha', 'oman', 'muscat',
    'bahrain', 'manama', 'kuwait', 'egypt', 'cairo', 'uk', 'london', 'usa', 'india', 'pakistan', 'karachi', 'lahore', 'singapore', 'europe', 'gulf', 'dxb', 'difc', 'dafza']);
  // the kind of service a search or a page is about: "crm consulting" is not answered by a "CRM implementation" page (the words left are the same)
  const KIND = { consulting: 'consulting', consultant: 'consulting', consultants: 'consulting', consultancy: 'consulting', advisory: 'consulting', implementation: 'implementation', implement: 'implementation',
    migration: 'migration', integration: 'integration', support: 'support', training: 'training', course: 'training', courses: 'training', pricing: 'pricing', price: 'pricing', cost: 'pricing',
    audit: 'audit', development: 'development', licensing: 'licensing', license: 'licensing', licence: 'licensing', jobs: 'jobs', careers: 'jobs', career: 'jobs', hosting: 'hosting', outsourcing: 'outsourcing' };
  const kindsOf = (s) => uniq(tokensOf(norm(s)).map(t => KIND[t]).filter(Boolean));
  const ARTICLE = /\/(?:insights|blog|blogs|news|articles|resources|posts|updates|knowledge|learn|library|stories|press|media|guides?)\/[^/]+/i;
  const svcList = (model) => (model && Array.isArray(model.declared_services) && model.declared_services.length) ? model.declared_services : services(model);
  // the client's own name ("Tech&", "techand"): never a topic word, unless the word also names one of its services ("ERP Partners" sells ERP)
  const brandWords = (model) => { const m = model || {}; const label = bare(m.domain || m.canonical_host || '').split('.')[0].replace(/[^a-z0-9]/g, '');
    const svc = new Set(svcList(m).flatMap(sv => tokensOf(norm(sv))));
    return new Set([...(m.brand_names || []), m.business_name].flatMap(b => tokensOf(norm(b))).concat(label ? [label] : []).filter(t => t.length > 2 && !svc.has(t))); };
  // the words that say WHAT a text is about: no stop / filler / generic / place / brand word, light stem, synonyms written out
  const coreTerms = (s, brands) => uniq(tokensOf(norm(s)).filter(t => t.length > 1 && !STOP.has(t) && !FILLER.has(t) && !GENERIC.has(t) && !PLACES.has(t) && !EMIRATES.has(t) && !(brands && brands.has(t))).map(stem));
  const slugText = (u) => pathOf(u).replace(/[?#].*$/, '').replace(/\.[a-z]{2,5}$/i, '').replace(/[\/_-]+/g, ' ');
  const fieldsOf = (p, brands) => ({ title: coreTerms(S(p.title) + ' ' + S(p.h1), brands), own: coreTerms(S(p.title) + ' ' + S(p.h1) + ' ' + slugText(p.url), brands),
    slug: coreTerms(slugText(p.url), brands), desc: coreTerms(S(p.description), brands),
    queries: (p.queries || []).filter(q => (Number((q || {}).impressions) || 0) > 0).map(q => coreTerms(S((q || {}).query || (q || {}).keyword), brands)) });
  // the client's services a set of core words belongs to (declared first): a service is hit when at least half its own core words are there
  const serviceHits = (model, terms, brands) => { const set = new Set(terms); const out = [];
    for (const sv of svcList(model)) { const st = coreTerms(sv, brands); if (!st.length) continue; const have = st.filter(t => set.has(t)).length; if (have >= Math.max(1, Math.ceil(st.length / 2))) out.push(S(sv)); }
    return out; };
  const MATCH_CONF = { page: 0.75, overlap: 0.4, article_cap: 0.6, high: 0.85 };
  const confLabel = (c) => c >= MATCH_CONF.high ? 'high' : c >= MATCH_CONF.page ? 'medium' : 'low';
  const topicMatch = (model, keyword, inv, opts) => {
    const o = opts || {}; const brands = brandWords(model); const core = coreTerms(keyword, brands); if (!core.length) return { best: null, overlap: null, core };
    const commercial = tokensOf(norm(keyword)).some(t => COMMERCIAL.has(t)); const kKinds = kindsOf(keyword);
    const docs = inv.map(p => ({ p, f: fieldsOf(p, brands) }));
    const N = docs.length || 1; const df = (t) => docs.filter(d => covers(d.f.own, t)).length;
    const w = new Map(core.map(t => [t, Math.log((N + 1) / (df(t) + 1)) + 1]));   // IDF: a word on every page of the site weighs least
    const W = core.reduce((a, t) => a + w.get(t), 0);
    const kSvc = serviceHits(model, core, brands);
    const kSvcTerms = new Set(kSvc.flatMap(sv => coreTerms(sv, brands)));
    const ignored = uniq(tokensOf(norm(keyword)).filter(t => GENERIC.has(t) || PLACES.has(t) || EMIRATES.has(t) || brands.has(t)));
    let best = null, overlap = null;
    const better = (a, b) => !b || a.confidence > b.confidence + 1e-9 || (Math.abs(a.confidence - b.confidence) < 1e-9 && (a.search_queries_about > b.search_queries_about || (o.isPref && o.isPref(a.url) && !o.isPref(b.url))));
    for (const { p, f } of docs) {
      if (o.skip && o.skip(p)) continue;
      const qAbout = f.queries.filter(q => core.every(t => covers(q, t)));   // its Search Console searches that carry every core word of this one
      const field = (t) => covers(f.title, t) ? 1 : covers(f.slug, t) ? 0.9 : qAbout.length >= 2 ? 1 : f.queries.filter(q => covers(q, t)).length >= 2 ? 0.85 : qAbout.length === 1 ? 0.7 : covers(f.desc, t) ? 0.6 : 0;
      const cov = core.reduce((a, t) => a + w.get(t) * field(t), 0) / W;
      if (cov <= 0) continue;
      const pSvc = serviceHits(model, f.own, brands);
      if (kSvc.length && pSvc.length && !pSvc.some(sv => kSvc.includes(sv))) continue;   // another service of the client: never the answer, not even "may overlap"
      // focus: how much of the page's own title is this search (or the client service it belongs to); a page about five things is a weaker answer
      const own = f.title.length ? f.title : f.slug;
      const focus = own.length ? own.filter(t => core.includes(t) || kSvcTerms.has(t)).length / own.length : 0;
      let conf = cov * (0.8 + 0.2 * focus);
      const article = ARTICLE.test(pathOf(p.url)) || isListing(p.url);
      if (commercial && article) conf = Math.min(conf, MATCH_CONF.article_cap);   // an article about the subject is not the page that sells it
      const pKinds = kindsOf(S(p.title) + ' ' + S(p.h1) + ' ' + slugText(p.url)); const kindClash = kKinds.length && pKinds.length && !pKinds.some(k => kKinds.includes(k));
      if (kindClash) conf = Math.min(conf, MATCH_CONF.article_cap);   // "crm consulting" vs a "CRM implementation" page: another kind of service
      const untitled = !S(p.title) && !S(p.h1);
      if (untitled && qAbout.length < 2) conf = Math.min(conf, MATCH_CONF.article_cap);   // an address alone is not enough to call it the page (R34: titles not read yet)
      conf = Math.round(conf * 100) / 100;
      const inTitle = core.filter(t => covers(f.title, t)), inSlug = core.filter(t => !covers(f.title, t) && covers(f.slug, t));
      const ev = [];
      if (inTitle.length) ev.push('its title' + (S(p.title) ? ' "' + S(p.title).replace(/&amp;/g, '&') + '"' : '') + ' is about ' + inTitle.map(t => '"' + t + '"').join(' and '));
      if (inSlug.length) ev.push('its address ' + pathOf(p.url) + ' carries ' + inSlug.map(t => '"' + t + '"').join(' and '));
      if (qAbout.length) ev.push(qAbout.length + ' of its Search Console searches ' + (qAbout.length === 1 ? 'is' : 'are') + ' about it');
      const shared = pSvc.find(sv => kSvc.includes(sv));
      if (shared) ev.push('both are about your service "' + shared + '"');
      if (commercial && article) ev.push('it is an article, not the page that sells this service');
      if (kindClash) ev.push('it is about ' + pKinds.join(' / ') + ', the search asks for ' + kKinds.join(' / '));
      if (untitled && qAbout.length < 2) ev.push('its title was not read yet');
      if (!ev.length) ev.push('some of its words are about this search');
      const hit = { url: p.url, title: p.title, source: p.source, matched_by: inTitle.length ? 'title' : inSlug.length ? 'slug' : qAbout.length ? 'query' : 'topic', score: conf, impressions: 0,
        confidence: conf, confidence_label: confLabel(conf), search_queries_about: qAbout.length, article, pass: 'topic',
        evidence: ev.join(', ') + (ignored.length ? ' (' + ignored.map(t => '"' + t + '"').join(', ') + ' left out as too general)' : '') };
      if (conf + 1e-9 >= MATCH_CONF.page) { if (better(hit, best)) best = hit; }
      else if (conf + 1e-9 >= MATCH_CONF.overlap && better(hit, overlap)) overlap = hit;
    }
    return { best, overlap, core };
  };
  // { match, may_overlap }: `match` is the page that answers the search (or null), `may_overlap` a weaker candidate to mention, never to act on
  const pageMatch = (model, keyword, prefer) => {   // `prefer`: a URL that wins a tie (the page Search Console itself credits for the search)
    const prefKey = prefer ? bare(hostOf(prefer)) + pathOf(prefer).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase() : "";
    const isPref = (u) => !!prefKey && (bare(hostOf(u)) + pathOf(u).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase()) === prefKey;
    const want = matchTerms(keyword); if (!want.length) return { match: null, may_overlap: null };
    const key = tokensOf(keyword).join(' ');
    const inv = pages(model).filter(p => !isGone(p));   // RV-1: a gone page answers nothing
    const brands = brandWords(model); const core = coreTerms(keyword, brands);
    const kSvc = core.length ? serviceHits(model, core, brands) : [];
    const otherService = (p) => { if (!kSvc.length) return false; const ps = serviceHits(model, fieldsOf(p, brands).own, brands); return ps.length > 0 && !ps.some(sv => kSvc.includes(sv)); };
    const byQuery = [];
    for (const p of inv) {
      const q = (p.queries || []).find(x => tokensOf(x.query || x.keyword || x).join(' ') === key && (Number((x || {}).impressions) || 0) > 0);
      if (q) byQuery.push({ url: p.url, title: p.title, source: p.source, matched_by: 'query', score: 1, impressions: Number(q.impressions) || 0,
        confidence: 1, confidence_label: 'high', pass: 'query', evidence: 'Google already shows it for this exact search (' + (Number(q.impressions) || 0) + ' impressions in Search Console)' });
    }
    byQuery.sort((a, b) => Number(isListing(a.url)) - Number(isListing(b.url)) || b.impressions - a.impressions);
    const qHit = byQuery[0] || null;
    const listingOf = (lst, best) => ({ url: lst.url, impressions: lst.impressions,
      note: 'Google currently shows ' + pathOf(lst.url) + ' (a listing page) for this search; the page that is about it is ' + pathOf(best.url) });
    if (qHit && !isListing(qHit.url)) { const lst = byQuery.find(x => isListing(x.url)); return { match: lst ? { ...qHit, listing: listingOf(lst, qHit) } : qHit, may_overlap: null }; }
    let best = null;
    for (const p of inv) {
      if (qHit && isListing(p.url)) continue;   // R56: looking for the dedicated page behind a listing's impressions
      const slug = matchTerms(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''));
      const title = matchTerms(S(p.title) + ' ' + S(p.h1));
      const inSlug = shareIn(want, slug);
      const inTitle = shareIn(want, title);
      const score = Math.max(inSlug, inTitle);
      if (score + 1e-9 < MATCH_MIN) continue;
      // K8: the 75% may be made of generic and place words only when the search's core words are on the page too ("it consulting services
      // dubai" is not an AI consulting page), and never on a page of another service of the client
      if (core.length && !core.every(t => covers(slug, t) || covers(title, t))) continue;
      if (otherService(p)) continue;
      if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && isPref(p.url) && !isPref(best.url))) { const sc = Math.round(score * 100) / 100;
        best = { url: p.url, title: p.title, source: p.source, matched_by: inSlug >= inTitle ? 'slug' : 'title', score: sc, impressions: 0, confidence: sc, confidence_label: confLabel(sc), pass: 'words',
          evidence: (inSlug >= inTitle ? 'its address ' + pathOf(p.url) : 'its title "' + S(p.title).replace(/&amp;/g, '&') + '"') + ' carries ' + Math.round(score * 100) + '% of the words of the search' }; }
    }
    let overlap = null;
    if (!best) { const t = topicMatch(model, keyword, inv, { skip: (p) => !!qHit && isListing(p.url), isPref }); best = t.best; overlap = t.overlap; }
    if (qHit && best) return { match: { ...best, listing: listingOf(qHit, best) }, may_overlap: null };
    const match = qHit || best;
    return { match, may_overlap: match || !overlap ? null : { ...overlap, note: 'may overlap: ' + pathOf(overlap.url) + ' touches this search (' + overlap.evidence + '), but not closely enough to call it the page for it' } };
  };
  const matchPage = (model, keyword, prefer) => pageMatch(model, keyword, prefer).match;
  // A-22 (2026-10-17): how well ONE page of the inventory targets a search by its own words (slug or title / H1, the matchPage rule), so a
  // caller that already knows the page Google ranks can ask whether another page targets the search more closely - never to replace it
  const pageScore = (page, keyword) => { const p = page || {}; const want = matchTerms(keyword); if (!want.length || !S(p.url)) return null;
    return Math.round(Math.max(shareIn(want, matchTerms(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''))), shareIn(want, matchTerms(S(p.title) + ' ' + S(p.h1)))) * 100) / 100; };
  // R35: how much of a search a page's OWN title / H1 holds (null when the page's title was never read) - the only evidence that may call
  // a page "about something else"
  // the words of a spoken / long-tail search that say nothing about the subject ("which ... can help ... in the uae")
  const FILLER = new Set(['which', 'what', 'how', 'why', 'when', 'where', 'who', 'can', 'could', 'help', 'helps', 'best', 'top', 'near', 'me', 'is', 'are', 'do', 'does', 'should', 'will', 'would', 'get', 'need', 'i', 'we', 'you']);
  const titleShare = (page, keyword) => { const p = page || {}; if (!S(p.title) && !S(p.h1)) return null;
    const want = uniq(termsOf(norm(keyword)).filter(t => !FILLER.has(t)).map(stem)); if (!want.length) return null; const set = matchTerms(S(p.title) + ' ' + S(p.h1));
    return { share: Math.round(shareIn(want, set) * 100) / 100, have: want.filter(t => covers(set, t)).length, of: want.length, missing: want.filter(t => !covers(set, t)) }; };
  // ---- W05-B (2026-10-30, page-quality BEFORE_AFTER K4): is this page really THE page for the search, before a run rewrites its address? ----
  // The content run took /dynamics-365-project-operations-uae (title not on file, matched by its address only: "dynamics", "365", "uae") as the
  // page to improve for "dynamics 365 partner dubai", wrote the partner page onto that address, and the hold waved it through as a refresh.
  // An address is not evidence of what a page is about. A page is confirmed only by its OWN words: its title or main heading (from the
  // inventory or read in this run, `more.texts`), or a Search Console search it earns impressions for, where that text (1) carries every core
  // word of the search, (2) carries 75% of all its words, and (3) is ABOUT the search: its rarest word on this site is one of the search's own,
  // or the words it adds (not the brand, a place, the kind of service or the form of the page) weigh under a third of the whole. "Dynamics 365
  // Project Operations Implementation UAE" adds "project" and "operations" (rare) to "dynamics 365" (on every page): about something else.
  // Returns { ok, by, text, evidence, why }; never throws; with nothing to read, ok is false (the caller writes a new page and says so).
  const confirmPage = (model, page, keyword, more) => {
    const p = page || {}; const o = more || {};
    const m = model || {}; const brands = brandWords(m);
    const core = coreTerms(keyword, brands);
    const want = uniq(termsOf(norm(keyword)).filter(t => !FILLER.has(t)).map(stem));
    const shortUrl = pathOf(p.url);
    if (!core.length || !want.length) return { ok: false, by: '', text: '', evidence: '', why: 'the search has no word that says what it is about, so no page can be confirmed as its page' };
    // the kind of service ("implementation", "support") and the form of the page ("guide", "checklist", a year) say how a page answers, not what about
    const FORM = ['guide', 'guides', 'buyer', 'buyers', 'complete', 'ultimate', 'definitive', 'explained', 'explain', 'overview', 'introduction', 'intro', 'checklist', 'faq', 'faqs',
      'tip', 'tips', 'everything', 'know', 'need', 'basic', 'basics', 'beginner', 'beginners', 'step', 'steps', 'updated', 'latest'];
    const kindStems = new Set([...Object.keys(KIND), ...FORM].map(stem));
    const inv = pages(m); const N = inv.length || 1;
    const docs = inv.map(x => fieldsOf(x, brands).own);
    const wOf = (t) => { const df = docs.filter(d => covers(d, t)).length; return Math.log((N + 1) / (df + 1)) + 1; };
    const cands = [];
    const add = (text, by) => { const t = S(text).replace(/&amp;/g, '&'); if (t) cands.push({ text: t, by }); };
    add(p.title, 'its title'); add(p.h1, 'its main heading');
    for (const t of (Array.isArray(o.texts) ? o.texts : [])) if (t && S(t.text)) add(t.text, S(t.by) || 'its title as read now');
    for (const q of (Array.isArray(p.queries) ? p.queries : queriesOf(p))) if ((Number((q || {}).impressions) || 0) > 0) add((q || {}).query || (q || {}).keyword, 'a search it earns impressions for in Search Console');
    if (!cands.length) return { ok: false, by: '', text: '', evidence: '', why: shortUrl + ' has no title, main heading or Search Console search on file, and an address alone does not say what a page is about' };
    let best = null;
    for (const c of cands) {
      const tt = coreTerms(c.text, brands); if (!tt.length) continue;
      const allCore = core.every(t => covers(tt, t));
      const share = shareIn(want, matchTerms(c.text));
      const extra = uniq(tt.filter(t => !core.includes(t) && !kindStems.has(t) && !/^(?:19|20)\d\d$/.test(t)));
      const own = core.filter(t => covers(tt, t)).reduce((a, t) => a + wOf(t), 0);
      const add2 = extra.reduce((a, t) => a + wOf(t), 0);
      const focus = own + add2 > 0 ? own / (own + add2) : 0;
      // about the search: its rarest word is one of the search's own (an article title that only describes more, "the cost of non-compliance:
      // UAE e-invoicing penalties and mitigation costs", keeps it), or what it adds weighs under a third ("d365 operations uae", 0.58 on
      // client A's site, adds the rarer "operations" to "dynamics 365": not the page for "dynamics 365 partner dubai")
      const ws = tt.filter(t => !kindStems.has(t) && !/^(?:19|20)\d\d$/.test(t)).map(t => [t, wOf(t)]);
      const maxW = ws.reduce((mx, x) => Math.max(mx, x[1]), 0);
      const rarestOwn = ws.some(([t, w]) => core.includes(t) && w + 1e-9 >= maxW);
      const ok = allCore && share + 1e-9 >= MATCH_MIN && (rarestOwn || focus > 0.67 + 1e-9);
      const said = uniq(tokensOf(norm(c.text)).filter(w => extra.includes(stem(w))));   // the page's own words, not their stems, for the reason
      const r = { ok, by: c.by, text: c.text, focus: Math.round(focus * 100) / 100, share: Math.round(share * 100) / 100, extra: said.length ? said : extra };
      if (!best || (r.ok && !best.ok)) best = r;   // the first text read (the title before the searches) explains a refusal
      if (ok) break;
    }
    if (!best) return { ok: false, by: '', text: '', evidence: '', why: 'the title and searches of ' + shortUrl + ' say nothing about this search' };
    if (best.ok) return { ok: true, by: best.by, text: best.text, evidence: best.by + ' "' + best.text + '" is about this search', why: '' };
    return { ok: false, by: best.by, text: best.text, evidence: '',
      why: best.by + ' "' + best.text + '" is about ' + (best.extra.length ? best.extra.map(t => '"' + t + '"').join(' and ') : 'something else') + ', not this search, so ' + shortUrl + ' is not the page for it' };
  };
  // R34: the pages whose title was never read, so a caller can say what it judged on the address alone instead of reading nothing silently
  const titleGap = (model) => { const all = pages(model); const u = untitled(model);
    return { pages: all.length, untitled: u.length, urls: u.slice(0, 12).map(p => p.url),
      note: u.length ? u.length + ' of the ' + all.length + ' pages of the site have no title on file yet (the weekly site check reads them a batch at a time), so they were judged by their address only' : '' }; };
  // R55: a URL of the site as the site serves it (canonical host); another site's URL is returned as it is
  const canonUrl = (model, u) => { const h = hostOf(u); if (!h || bare(h) !== bare((model || {}).domain || (model || {}).canonical_host || '')) return S(u); return siteUrl(model, pathOf(u)); };
  // D11: a stored seo_pages row carries its queries as the JSON string `queries_json`, so both shapes are accepted here
  const queriesOf = (p) => Array.isArray(p.queries) ? p.queries : (jparse(p.queries_json, []) || []);
  const withPages = (model, more) => ({ ...model, pages: (() => { const seen = new Set(); const out = [];
    for (const p of [...pages(model), ...(Array.isArray(more) ? more : [])]) { const u = S(p.url); if (!u) continue; const k = pathOf(u).replace(/\/$/, '').toLowerCase();
      if (seen.has(k)) { const old = out.find(o => pathOf(o.url).replace(/\/$/, '').toLowerCase() === k); if (old) { old.title = old.title || S(p.title); old.h1 = old.h1 || S(p.h1); old.lastmod = old.lastmod || S(p.lastmod); const q = queriesOf(p); if (q.length) old.queries = q;
        // RV-1: the newest reading of the address wins (a page that came back after a redirect was added is live again)
        if ((Number(p.http_status) || 0) && S(p.status_at) >= S(old.status_at)) { old.http_status = Number(p.http_status) || 0; old.status_at = S(p.status_at); } } continue; }
      seen.add(k); out.push({ url: u, title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries: queriesOf(p), http_status: Number(p.http_status) || 0, status_at: S(p.status_at) }); }
    return out; })() });
  // the model exactly as it was stored (seo_sites row or a seo_cache value), with its own timestamp -- never "now", so isFresh() is honest
  const stored = (row) => { const r = (row && typeof row === 'object') ? row : {}; return (S(r.canonical_host) || S(r.model_updated_at)) ? from(r, {}) : null; };
  const FRESH_DAYS = 7;
  const ageDays = (model) => { const t = Date.parse(S((model || {}).model_updated_at)); return Number.isFinite(t) ? (Date.now() - t) / 864e5 : Infinity; };
  const isFresh = (model, days) => !!(model && S(model.canonical_host) && ageDays(model) < (Number(days) > 0 ? Number(days) : FRESH_DAYS));
  // exactly the seo_sites columns the model owns (plus the two keys), ready to merge into a site row or a cache value
  const COLUMNS = ['site_id', 'domain', 'canonical_host', 'business_name', 'logo_url', 'nap_json', 'services_json', 'nav_pages_json', 'business_facts', 'cta', 'brand_names', 'competitors', 'accreditation', 'model_updated_at', 'declared_services'];
  const toRow = (model) => { const m = model || {};
    return { site_id: S(m.site_id), domain: S(m.domain), canonical_host: S(m.canonical_host), business_name: S(m.business_name), logo_url: S(m.logo_url),
      nap_json: JSON.stringify(nap(m)), services_json: JSON.stringify(services(m)), nav_pages_json: JSON.stringify((m.nav_pages || []).map(p => ({ url: p.url, title: p.title }))),
      business_facts: S(m.business_facts).slice(0, 2000), cta: S(m.cta).slice(0, 200), brand_names: (m.brand_names || []).join(', ').slice(0, 500),
      competitors: (m.competitors || []).join(', ').slice(0, 500), accreditation: S(m.accreditation).slice(0, 200), model_updated_at: S(m.model_updated_at),
      declared_services: JSON.stringify(Array.isArray(m.declared_services) ? m.declared_services : []) };
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
    decay_basis: S(p.decay_basis).slice(0, 900), measured_at: S(p.measured_at),
    http_status: num0(p.http_status), status_at: S(p.status_at) }));   // RV-1: what the address answered when it was last read (0 = not read)
  // ---- C-7 (re-rating 2026-10-17): ONE page state per keyword, read by the Rank Tracker AND the Site Tracker (and so by the cadence) ----
  // In one morning the Rank Tracker said of "ai consulting" "…/ai-copilot-advisory-uae already answers this search - refresh that page"
  // while the Site Tracker said "fix the four drafts that failed the quality check and run them again", and of "it consulting dubai"
  // "write the main page" while the Site Tracker and the cadence said "written today, failed QA, fix it". The order of evidence is one:
  // a LIVE page of the site that answers the search wins (refresh it; a draft written for the search is retired, never a second page);
  // then a written draft (publish it); then a draft that failed its quality check (fix it and run it again); then a run that wrote nothing.
  // in: { keyword, covered_url, written, not_ready, reasons (array or '; ' text), started } -> { state, text } (text: the parenthesis a list uses)
  const pageStep = (o) => {
    const c = o || {}, kw = S(c.keyword), why = (Array.isArray(c.reasons) ? c.reasons : S(c.reasons).split(/;\s+/)).map(S).filter(Boolean).slice(0, 2).join('; ').slice(0, 220);
    if (S(c.covered_url)) return { state: 'covered', text: S(c.covered_url) + ' already answers this search — refresh that page, do not publish a second one'
      + (c.not_ready || c.written ? '; the draft written for "' + kw + '" is not needed (use its text to refresh that page)' : '') };
    if (c.written) return { state: 'written', text: 'already written — publish it' };
    if (c.not_ready) return { state: 'not_ready', text: 'written, but the draft did not pass the quality check' + (why ? ' (' + why + ')' : '') + ' — fix it and run it again; do not publish it as it is' };
    if (c.started) return { state: 'started', text: 'a page run was started for it but no page was written — it is written again' };
    return { state: 'planned', text: '' };
  };
  return { from, stored, siteUrl, apiTarget, name, nap, services, pages, facts, matchPage, pageMatch, MATCH_CONF, withPages, toRow, pageRows, COLUMNS, isFresh, ageDays, FRESH_DAYS, MATCH_MIN,
    titleShare, titleGap, canonUrl, isListing, pageScore, pageStep, isGone, gonePages, confirmPage,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml, matchTerms, coreTerms } };
})();
// ---- site-tracking statistics (2026-10-12, FIX_PLAN G28): an alert must mean "this really changed", not "a number moved by 30%".
// Clicks, impressions and sessions are counts over two periods of the same length, so the honest test is the two-sample Poisson test
// (normal approximation, the same idea as the z-tests the AI Pulse uses in v5/code/_ai_stats.js):
//     z = (cur - prev) / sqrt(cur + prev),  |z| >= 1.96  =  outside 95% sampling noise.
// 28 clicks against 20 is a 40% "fall" that any week could produce by chance (z = -1.18); 1,400 against 1,600 is a 13% fall that is real
// (z = -3.65). A change therefore needs three things: enough volume to measure, statistical significance, and a size worth telling the owner.
// Anything large but not significant is reported as "watch", never as a fall — and Google's update dates are named when one ran in the period.
// 2026-10-13 (G28 follow-up): `tested()` puts the source, the period, the test and the confidence into every alert's own words, and
// `position()` replaces the last fixed threshold in the site tracking — "5 places" on a keyword with 12 impressions is not a drop.
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
  // Google's confirmed ranking updates: context for a real fall, never a cause ("correlation, not proof").
  // G12 (2026-10-13): the list is no longer written here. It is inlined from `v5/data/seo_events.json` — the one dated place to add
  // an update, shared with the chart annotations (`_annotations.js`) and with the app (`app/shared/src/seo-events.generated.ts`).
  const UPDATES = [].concat([{"name": "March 2025 core update", "start": "2025-03-13", "end": "2025-03-26"}, {"name": "June 2025 core update", "start": "2025-06-30", "end": "2025-07-16"}, {"name": "August 2025 spam update", "start": "2025-08-26", "end": "2025-09-21"}, {"name": "December 2025 core update", "start": "2025-12-11", "end": "2025-12-29"}, {"name": "February 2026 Discover update", "start": "2026-02-05", "end": "2026-02-26"}, {"name": "March 2026 spam update", "start": "2026-03-24", "end": "2026-03-24"}, {"name": "March 2026 core update", "start": "2026-03-27", "end": "2026-04-08"}, {"name": "May 2026 core update", "start": "2026-05-21", "end": "2026-06-01"}, {"name": "June 2026 spam update", "start": "2026-06-24", "end": "2026-06-26"}, {"name": "August 2026 spam update", "start": "2026-08-18", "end": "2026-08-20"}, {"name": "September 2026 spam update", "start": "2026-09-24", "end": "2026-10-07"}]);
  const updatesIn = (range) => { const r = range || {}; const a = String(r.start || ''), b = String(r.end || '');
    if (!a || !b) return []; return UPDATES.filter(u => u.start <= b && u.end >= a); };
  const updateNote = (range) => { const hits = updatesIn(range); return hits.length ? ' A Google ' + hits.map(u => u.name + ' (' + u.start + ' to ' + u.end + ')').join(' and ') + ' ran inside this period — it may be part of the cause, which cannot be proven from these numbers.' : ''; };
  // ---- G28 follow-up (2026-10-13): an alert must say WHAT was tested, over WHAT period, and HOW SURE it is ----
  // One sentence, from the test itself, so no caller can print a number without its basis. `o`: { source, period, test }.
  // `stats: false` leaves the z value and the range out of this sentence, for a text that already prints them.
  const tested = (ch, o) => { const x = o || {}; const c = ch || {};
    const src = String(x.source || 'Search Console'), per = String(x.period || 'the last 28 days against the 28 days before'),
      test = String(x.test || 'two-sample Poisson z-test (counts over two equal periods)');
    const zz = x.stats === false ? '' : ' (z ' + c.z + ')';
    const sure = c.significant === true ? 'outside 95% sampling noise' + zz
      : c.measurable === false ? 'not enough events to test (' + ((Number(c.cur) || 0) + (Number(c.prev) || 0)) + ' over both periods together)'
      : 'inside 95% sampling noise' + zz + ', so it may be chance';
    return ' Tested: ' + src + ', ' + per + ', ' + test + '; ' + sure + (x.stats === false || !c.ci ? '' : '; 95% range ' + c.ci[0] + '% to ' + c.ci[1] + '%') + '.'; };
  // ---- a MOVE IN AVERAGE POSITION, which is not a count and must not be tested like one ----
  // Search Console's position is the impression-weighted average of the best position per impression over 28 days. With a handful of
  // impressions one search moves it several places, so the old rule ("5 places and the keyword was in the top 10") fired on noise for a
  // small site. There is no published variance for that average, so nothing is claimed about significance: the move is reported only when
  // BOTH periods carry min_impressions, and the clicks of the same two periods are tested (Poisson) so the alert can say how sure it is.
  // o: { impressions, prev_impressions, clicks, prev_clicks, min_impressions, min_places, min_click_events }
  const position = (cur, prev, o) => {
    const x = o || {}; const c = num(cur), p = num(prev);
    const minImp = x.min_impressions == null ? 50 : num(x.min_impressions), minPlaces = x.min_places == null ? 5 : num(x.min_places);
    const imp = num(x.impressions), impPrev = num(x.prev_impressions);
    const places = Math.round((c - p) * 10) / 10;                       // positive = slipped down the page
    const clicks = change(x.clicks, x.prev_clicks, { min_events: x.min_click_events == null ? 20 : num(x.min_click_events), min_pct: 0 });
    const measurable = c > 0 && p > 0 && imp >= minImp && impPrev >= minImp;
    const big = c > 0 && p > 0 && Math.abs(places) >= minPlaces;
    return { cur: c, prev: p, places, impressions: imp, prev_impressions: impPrev, clicks, measurable, big,
      real: measurable && big, watch: big && !measurable,               // a big move on too few impressions: worth a look, never a fact
      direction: places > 0 ? 'down' : places < 0 ? 'up' : 'flat',
      basis: 'Search Console average position, the last 28 days against the 28 days before, on ' + impPrev + ' then ' + imp + ' impressions'
        + (measurable ? '' : ' (under ' + minImp + ' impressions in a period one search can move the average several places)') };
  };
  // ---- B4-1 (2026-10-15, benchmark area 4 — docs/system-review-2026-10-14/BENCH_AREA4_cadence.md): IS THIS PAGE REALLY LOSING
  // TRAFFIC, OR ARE THESE WEEKS QUIET EVERY YEAR? Clearscope's Content Decay view compares a page's clicks over 90 days against
  // THE SAME 90 DAYS A YEAR EARLIER and names the two figures "seasonal difference" and "seasonal growth"
  // (https://www.clearscope.io/support/content-decay); Ahrefs tells you to flag pages down more than 20% YEAR OVER YEAR
  // (https://ahrefs.com/blog/content-decay/). Ours compared 28 days with the 28 before and called any 25% fall on 10 earlier
  // clicks a "decaying page" — the one window that cannot tell a decay from a seasonal dip, at a volume this file's own test
  // rejects (10 -> 7 clicks is z = -0.73, well inside chance). decay() tests the fall first and then, when the year-ago figure
  // was read, refuses to call a fall "decay" that the same page also had a year ago.
  // Two falls are NOT the same thing and need different work, so they are told apart here and nowhere else: clicks down while
  // impressions held is a click-through loss (title and snippet), clicks down WITH impressions is lost visibility (the page).
  // o: { clicks, prev_clicks, yoy_clicks, impressions, prev_impressions, min_events, min_pct, period, yoy_period }
  const decay = (o) => {
    const x = o || {}; const cur = num(x.clicks), prev = num(x.prev_clicks);
    const yoy = (x.yoy_clicks === '' || x.yoy_clicks == null) ? null : num(x.yoy_clicks);
    const minEvents = x.min_events == null ? 40 : num(x.min_events), minPct = x.min_pct == null ? 20 : num(x.min_pct);
    const per = String(x.period || 'the last 28 days against the 28 days before');
    const yper = String(x.yoy_period || 'the same 28 days a year earlier');
    const ch = change(cur, prev, { min_events: minEvents, min_pct: minPct });
    const imps = change(num(x.impressions), num(x.prev_impressions), { min_events: minEvents * 10, min_pct: minPct });
    const yc = yoy == null ? null : change(cur, yoy, { min_events: minEvents, min_pct: minPct });
    const lost = Math.max(0, prev - cur);
    const kind = ch.direction === 'down' ? ((imps.direction === 'down' && imps.significant) ? 'visibility' : 'clickthrough') : null;
    const kindNote = kind === 'visibility' ? ' Impressions fell with the clicks (' + imps.text + '), so the page is being shown less often: this is lost visibility, not a snippet problem.'
      : kind === 'clickthrough' ? ' Impressions held (' + imps.text + '), so the page is still being shown and fewer people click it: look at the title and the description before rewriting the page.' : '';
    const base = (state, note) => ({ state, lost, pct: ch.pct, kind: (state === 'decaying' || state === 'watch') ? kind : null,
      clicks: cur, prev_clicks: prev, yoy_clicks: yoy, change: ch, yoy_change: yc, impressions: imps,
      basis: 'Search Console clicks for this page, ' + per + ' (' + prev + ' → ' + cur + ')'
        + (yoy == null ? '; ' + yper + ' was not read, so a seasonal dip cannot be ruled out' : '; ' + yper + ': ' + yoy + ' clicks')
        + '.' + note });
    if (!ch.measurable) return base('too_small', ' Not enough clicks to test: ' + (cur + prev) + ' over both periods together, against the ' + minEvents + ' this test needs. No fall is claimed.');
    if (ch.direction !== 'down') return base('steady', ' No fall to explain (' + ch.text + ').');
    if (ch.real) {
      if (yc && yc.measurable && yc.direction !== 'down')
        return base('seasonal', ' But against ' + yper + ' the page is ' + yc.text + ', so these weeks are simply quieter than the ones before them every year. Not decay.'
          + tested(yc, { source: 'Search Console', period: 'the last 28 days against ' + yper }));
      return base('decaying', kindNote + tested(ch, { source: 'Search Console', period: per })
        + (yc ? ' Against ' + yper + ' it is ' + yc.text + '.' : ''));
    }
    if (ch.watch) return base('watch', ' Large but inside 95% sampling noise (z ' + ch.z + '), so it is something to watch, not a fall.' + kindNote);
    return base('steady', ' The fall is smaller than the ' + minPct + '% worth acting on (' + ch.text + ').');
  };
  // ---- B7-1 (2026-10-15, benchmark area 7 — docs/system-review-2026-10-14/BENCH_AREA7_site_tracking.md): DID THE CHANGE WORK,
  // OR DID THE WHOLE SITE MOVE? "We published the page and its clicks are up 40%" is not a result on a site that is up 45%.
  // SEOTesting's split test is exactly this comparison — a test group against a control group of similar pages, so that
  // "algorithm updates or seasonal shifts" hit both sides (https://seotesting.com/features/); its group builder balances the two
  // groups on 90 days of Search Console clicks and throws out pages more than 2 standard deviations from the mean and pages with
  // no clicks on more than half the days (https://support.seotesting.com/en/article/split-test-group-configuration-tool-1reabjb/).
  // The arithmetic here is CausalImpact's idea in plain form (P1, Brodersen et al. 2015, https://arxiv.org/abs/1506.00356): what
  // the page WOULD have done had it followed the rest of the site, against what it did.
  //     expected = prev_clicks x (control_clicks / control_prev_clicks)        <- MODELLED, never measured
  //     d = ln(cur/prev) - ln(control_cur/control_prev),  SE = sqrt(1/cur + 1/prev + 1/cc + 1/cp)
  //     lift = exp(d) - 1,  95% range = exp(d +- 1.96 SE) - 1,  z = d / SE
  // The rate-ratio form carries the CONTROL group's own sampling error into the range; a ratio of two percentages does not, and
  // that is how a quiet control group turns into a confident claim. A Google update inside the window is NOT a reason to refuse:
  // it moves the control group too, which is the whole point of having one. Nothing here ever says a change CAUSED anything —
  // a control group narrows the alternatives (the shared wording is CT, v5/code/_change_test.js).
  // Five refusals, because a lift computed on nothing reads as "no effect": no clicks before, no clicks after, too few events over
  // both periods together, fewer control pages than min_control_pages, and a control group with too little traffic to be a baseline.
  const LIFT_LABEL = { helped: 'Likely helped', hurt: 'Likely hurt', watch: 'Possibly moved', no_difference: 'No measurable difference',
    too_small: 'Can\'t tell yet', no_before: 'Can\'t tell', no_after: 'Can\'t tell', no_control: 'Can\'t tell' };
  const liftMethod = 'Every change is dated and read against a control group: the page\'s own clicks before and after, divided by what '
    + 'the site\'s OTHER pages did over the same two periods. The expected figure is modelled from that control group, not measured, and '
    + 'the 95% range carries the control group\'s own sampling error. A Google update inside the window moves the control group too — '
    + 'that is what the control group is for. A control group narrows the alternatives; it never proves a cause.';
  const lift = (o) => {
    const x = o || {};
    const cur = num(x.clicks), prev = num(x.prev_clicks), cc = num(x.control_clicks), cp = num(x.control_prev_clicks);
    const pagesN = Math.max(0, Math.round(num(x.control_pages)));
    const minEvents = x.min_events == null ? 20 : num(x.min_events);
    const minControl = x.min_control_events == null ? 40 : num(x.min_control_events);
    const minPages = x.min_control_pages == null ? 3 : num(x.min_control_pages);
    const minPct = x.min_pct == null ? 20 : num(x.min_pct);
    const per = String(x.period || 'the last 28 days against the 28 days before');
    const what = String(x.label || 'clicks');
    const ch = change(cur, prev, { min_events: minEvents, min_pct: 0 });
    const ctrl = change(cc, cp, { min_events: minControl, min_pct: 0 });
    const out = (state, note, extra) => Object.assign({ state, verdict: LIFT_LABEL[state] || state,
      clicks: cur, prev_clicks: prev, control_clicks: cc, control_prev_clicks: cp, control_pages: pagesN,
      expected: null, lift: null, lift_pct: null, ci: null, z: null, significant: false, change: ch, control_change: ctrl,
      basis: 'Search Console ' + what + ' for this page, ' + per + ' (' + prev + ' → ' + cur + '), against the site\'s other '
        + pagesN + ' page' + (pagesN === 1 ? '' : 's') + ' over the same two periods (' + cp + ' → ' + cc + '). ' + note }, extra || {});
    if (pagesN < minPages) return out('no_control', 'Fewer than ' + minPages + ' other pages of this site carried Search Console clicks, so there is no control group and no lift is claimed.');
    if (cp < minControl) return out('no_control', 'The rest of the site carried ' + cp + ' clicks in the earlier period, under the ' + minControl + ' this comparison needs for a baseline, so no lift is claimed.');
    if (prev <= 0) return out('no_before', 'The page had no clicks in the earlier period, so there is nothing to compare it with: this is a page new to Search Console, not an improved one.');
    if (cur <= 0) return out('no_after', 'The page has no clicks in the current period (it had ' + prev + '), so the ratio cannot be computed. That fall is reported on its own, never as a lift.');
    if ((cur + prev) < minEvents) return out('too_small', 'Only ' + (cur + prev) + ' clicks over both periods together, against the ' + minEvents + ' this comparison needs. No lift is claimed.');
    const ratio = cc / cp;
    const expected = Math.round(prev * ratio * 10) / 10;
    const d = Math.log(cur / prev) - Math.log(ratio);
    const se = Math.sqrt(1 / cur + 1 / prev + 1 / cc + 1 / cp);
    const zz = Math.round((d / se) * 100) / 100;
    const pctOf = (v) => Math.round((Math.exp(v) - 1) * 100);
    const liftPct = pctOf(d), ci = [pctOf(d - 1.96 * se), pctOf(d + 1.96 * se)];
    const sig = Math.abs(zz) >= 1.96;
    const state = sig ? (d > 0 ? 'helped' : 'hurt') : (Math.abs(liftPct) >= minPct ? 'watch' : 'no_difference');
    const rest = 'The rest of the site went ' + ctrl.text + ', so a page that had simply followed it would have about ' + expected
      + ' clicks; this page has ' + cur + '.';
    const size = (liftPct >= 0 ? 'up ' : 'down ') + Math.abs(liftPct) + '% against that expectation (95% range ' + ci[0] + '% to ' + ci[1] + '%, z ' + zz + ')';
    const note = rest + ' That is ' + size + '. '
      + (sig ? 'Outside 95% sampling noise.' : Math.abs(liftPct) >= minPct ? 'Inside 95% sampling noise, so it is something to watch and not yet a result.' : 'Inside 95% sampling noise and smaller than the ' + minPct + '% worth acting on.')
      + ' The expected figure is modelled from the control group, not measured.';
    return out(state, note, { expected, lift: Math.round((cur - expected) * 10) / 10, lift_pct: liftPct, ci, z: zz, significant: sig });
  };
  return { z, band, change, position, decay, tested, updatesIn, updateNote, UPDATES, lift, LIFT_LABEL, liftMethod };
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
  // the shared entity decoder, inlined (v5/code/_entities.js; build section 122 asserts the two stay identical): named, decimal and hex, one pass
  const entDecode = /*__ENT_BEGIN__*/(() => {
  const N = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·', laquo: '«', raquo: '»', euro: '€', pound: '£', deg: '°' };
  return (s) => String(s == null ? '' : s).replace(/&(?:#[xX]([0-9a-fA-F]+)|#(\d+)|([a-zA-Z][a-zA-Z0-9]*));/g, (m, h, d, n) => {
    if (h !== undefined || d !== undefined) { const cp = h !== undefined ? parseInt(h, 16) : Number(d); if (cp === 160) return ' '; try { return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m; } catch (e) { return m; } }
    const k = n.toLowerCase(); return Object.prototype.hasOwnProperty.call(N, k) ? N[k] : m;
  });
})()/*__ENT_END__*/;
  const strip = (s) => entDecode(S(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

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

  // ---- B5-8 (2026-10-15, benchmark area 5): what we already know changed, and what that orders ----
  // Ahrefs' Always-On Audit picks the next URL to re-crawl partly from IndexNow pings (ahrefs.com/blog/always-on-audit). We OPERATE
  // IndexNow for the customer (v4.12) and we write their pages ourselves, so we hold the same signal and used it for nothing: the
  // queues were ordered "oldest reading first", which puts the page we changed on Monday behind a page nobody has touched in a year.
  // Three free signals, all already stored:
  //   * seo_ai_pages.submitted_at / submitted_via  - the IndexNow and Bing submissions AI Growth makes every week
  //   * seo_content_log.published_at / started_at  - the published-page log (what the Content Cadence wrote, and when it went live)
  //   * seo_ai_targets.written_at                  - the AI answer / refresh pages
  // INVARIANTS rule 1 lives in the return value: a table that could NOT be read is `not_read` with its reason, which is not the same
  // answer as "nothing changed this week", and every consumer prints whichever of the two it got.
  const FRESH_DAYS = 7;
  const CHANGE_LABEL = { indexnow: 'submitted to IndexNow', bing: 'submitted to Bing', published: 'published', written: 'written' };
  const changedPages = (sources, o) => {
    const opts = o || {};
    const days = Math.max(1, n0(opts.days) || FRESH_DAYS);
    const nowMs = Date.parse(S(opts.now)) || Date.now();
    const cutoff = nowMs - days * 864e5;
    const map = new Map(); const sources_read = []; const not_read = [];
    for (const src of (sources || [])) {
      const name = S(src && src.name) || 'a stored table';
      if (!src || src.read === false) { not_read.push({ source: name, reason: S(src && src.reason) || 'the table could not be read in this run' }); continue; }
      let used = 0;
      for (const r of (src.rows || [])) {
        const url = S(src.url ? src.url(r) : r.url);
        const ts = Date.parse(S(src.at ? src.at(r) : r.updated_at));
        if (!/^https?:\/\//i.test(url) || !Number.isFinite(ts) || ts < cutoff || ts > nowMs + 864e5) continue;
        const kind = S(src.kind ? src.kind(r) : src.default_kind) || 'written';
        const k = ukey(url); const prev = map.get(k);
        if (!prev || ts > prev.ts) map.set(k, { url, ts, at: new Date(ts).toISOString().slice(0, 10), kind, label: CHANGE_LABEL[kind] || kind, source: name });
        used += 1;
      }
      sources_read.push({ source: name, rows: (src.rows || []).length, within_window: used });
    }
    const read = sources_read.length > 0;
    const count = map.size;
    const basis = !read
      ? 'not available: none of the recent-change signals could be read in this run (' + (not_read.map(x => x.source + ' - ' + x.reason).join('; ') || 'no source was offered') + ')'
      : count
        ? 'measured: ' + count + ' page(s) we submitted or wrote in the last ' + days + ' days, from ' + sources_read.map(x => x.source).join(' + ')
          + (not_read.length ? ' (' + not_read.map(x => x.source + ' could not be read: ' + x.reason).join('; ') + ')' : '')
        : 'measured: no page was submitted or written in the last ' + days + ' days by the signals we hold (' + sources_read.map(x => x.source).join(' + ') + ')'
          + (not_read.length ? '; ' + not_read.map(x => x.source + ' could not be read: ' + x.reason).join('; ') : '');
    return { map, read, count, window_days: days, as_of: new Date(nowMs).toISOString().slice(0, 10), sources_read, not_read, basis,
      pages: [...map.values()].sort((a, b) => b.ts - a.ts).slice(0, 25).map(p => ({ url: p.url, at: p.at, kind: p.kind, label: p.label, source: p.source })) };
  };
  /** The freshness of one URL against a changedPages() result, or null when nothing is known about it. */
  const changeOf = (changed, url) => (changed && changed.map && changed.map.get(ukey(url))) || null;
  /**
   * B5-8: puts the pages we know changed at the front of a queue and leaves the rest in the order they arrived.
   * `then` is the queue's own comparator, so the existing order survives underneath. Returns the sentence a report prints:
   * a signal that could not be read NEVER reads as "nothing changed".
   */
  const freshFirst = (list, changed, o) => {
    const opts = o || {};
    const then = typeof opts.then === 'function' ? opts.then : () => 0;
    const ts = (p) => { const c = changeOf(changed, p && p.url); return c ? c.ts : 0; };
    const ordered = (list || []).slice().sort((a, b) => (ts(b) - ts(a)) || then(a, b));
    const first = ordered.filter(p => ts(p) > 0);
    const days = (changed && changed.window_days) || FRESH_DAYS;
    const order = S(opts.order) || 'oldest reading first';
    const note = !changed ? ''
      : !changed.read ? 'The pages we know changed could not be read in this run, so the order is the usual one: ' + order + '.'
        : first.length ? first.length + ' page(s) we submitted or wrote in the last ' + days + ' days are checked first ('
            + first.slice(0, 3).map(p => { const c = changeOf(changed, p.url); return pathOf(p.url) + ' ' + c.label + ' ' + c.at; }).join(', ')
            + (first.length > 3 ? ', ...' : '') + '), because a page that has just changed is the page most likely to have changed again.'
          : 'No page was submitted or written in the last ' + days + ' days, so the order is the usual one: ' + order + '.';
    return { ordered, first, note, changed_known: !!(changed && changed.read), changed_count: first.length };
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
    // B5-8 (2026-10-15): a page we submitted to IndexNow or wrote this week goes in front of the rotation - it is the one most likely
    // to have changed since Google last looked. Without that signal (or when it could not be read) the order is exactly what it was.
    const fresh = freshFirst(list, opts.changed || null,
      { then: (a, b) => ts(a) - ts(b) || n0(b.weight) - n0(a.weight) || S(a.url).localeCompare(S(b.url)), order: 'oldest inspection first' });
    const ordered = fresh.ordered;
    const take = ordered.slice(0, limit), skipped = ordered.slice(limit);
    return { take, skipped, limit, quota: QUOTA_PER_DAY, changed_first: fresh.changed_count, changed_known: fresh.changed_known, order_note: fresh.note,
      note: 'URL Inspection is capped at ' + QUOTA_PER_DAY + ' pages a day per Search Console property (Google\'s quota); this run asked about '
        + take.length + ' of ' + ordered.length + ' key pages, oldest inspection first'
        + (skipped.length ? ', so ' + skipped.length + ' are reported as "not checked" until the next run.' : '.')
        + (fresh.note ? ' ' + fresh.note : '') };
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
      robots: '', last_crawl: '', google_canonical: '', user_canonical: '', canonical_ok: null, canonical_host_only: false, mobile_usable: null, mobile_issues: [], mobile_verdict: '', mobile_note: '', rich_results: [], rich_verdict: '',
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
      // R59 (2026-10-16): Google choosing the SAME page on the OTHER host (https://techand.ai/x for our https://www.techand.ai/x) is a
      // canonical Google did not take — `same` is host-agnostic on purpose (crawls and sitemaps disagree about www), so it called this "same
      // as ours" and the daily watch could never see the split. The host is compared here, and a host-only difference is named.
      canonical_ok: (!S(idx.googleCanonical) || !S(idx.userCanonical)) ? null : (same(idx.googleCanonical, idx.userCanonical) && hostOf(idx.googleCanonical) === hostOf(idx.userCanonical)),
      canonical_host_only: !!S(idx.googleCanonical) && !!S(idx.userCanonical) && same(idx.googleCanonical, idx.userCanonical) && hostOf(idx.googleCanonical) !== hostOf(idx.userCanonical),
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
    changedPages, changeOf, freshFirst,
    CODES, RULES, QUOTA_PER_DAY, QUOTA_PER_MINUTE, PER_RUN, PER_AUDIT, FRESH_DAYS,
    helpers: { hostOf, bare, pathOf, ukey, same, strip, S, n0 } };
})();
// G12 / G29 (2026-10-13, FIX_PLAN): the events of the period are marked for every chart (pages published, audit fixes, Google
// updates, data breaks — AN, from v5/data/seo_events.json and the stored rows), and every figure group carries its source, period
// and sample (LN). A figure whose source nobody recorded says "source not recorded" instead of borrowing one.
// ---- chart annotations (G12, 2026-10-13, system review FIX_PLAN.md; CRITERIA_technical_tracking_reporting_ai_links.md 3.5 / 2.12) ----
// A line that falls in mid-September 2025 is not a ranking problem: that is the week Google stopped serving 100 results on one page.
// A line that climbs two weeks after a page went live is the page. Rank Ranger and Search Console both mark such events on their
// charts; we marked nothing, so every chart had to be read without its context. These marks are computed from data already stored -
// published pages (`seo_content_log.published_at`), the technical audits (`seo_audits`), and the dated registry in
// `v5/data/seo_events.json` (Google updates and data breaks) - and never from a guess. A date with no event produces no mark.
// The registry is THE one place to add a new Google update: the build inlines the same file here, into _site_stats.js and into the
// app (app/shared/src/seo-events.generated.ts), so the engine and the dashboards mark the same dates.
const AN = (() => {
  const EVENTS = Object.assign({ updated: '', google_updates: [], data_breaks: [] }, {"updated": "2026-10-15", "google_updates": [{"name": "March 2025 core update", "start": "2025-03-13", "end": "2025-03-26"}, {"name": "June 2025 core update", "start": "2025-06-30", "end": "2025-07-16"}, {"name": "August 2025 spam update", "start": "2025-08-26", "end": "2025-09-21"}, {"name": "December 2025 core update", "start": "2025-12-11", "end": "2025-12-29"}, {"name": "February 2026 Discover update", "start": "2026-02-05", "end": "2026-02-26"}, {"name": "March 2026 spam update", "start": "2026-03-24", "end": "2026-03-24"}, {"name": "March 2026 core update", "start": "2026-03-27", "end": "2026-04-08"}, {"name": "May 2026 core update", "start": "2026-05-21", "end": "2026-06-01"}, {"name": "June 2026 spam update", "start": "2026-06-24", "end": "2026-06-26"}, {"name": "August 2026 spam update", "start": "2026-08-18", "end": "2026-08-20"}, {"name": "September 2026 spam update", "start": "2026-09-24", "end": "2026-10-07"}], "data_breaks": [{"name": "num=100 stopped working", "start": "2025-09-10", "end": "2025-09-19", "affects": ["impressions", "position"], "detail": "Google stopped serving 100 results on one page in mid-September 2025, so the SEO tools that read 100 results at a time disappeared from the counts. Impressions fell and average position improved on most sites without anything changing on the site: figures from before and after this break are not comparable."}]});
  const KINDS = {
    publish: { label: 'Page published', tone: 'good' },
    fix: { label: 'Audit fixes', tone: 'good' },
    google_update: { label: 'Google update', tone: 'warning' },
    data_break: { label: 'Data break', tone: 'warning' },
    link: { label: 'Link won', tone: 'good' },
    note: { label: 'Your note', tone: 'neutral' },
  };
  const S = (v) => String(v == null ? '' : v);
  const day = (v) => S(v).slice(0, 10);
  const esc1 = (s) => S(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // a point event is in the window when its day is inside it; a dated range is in when it overlaps it. An open end means "no limit".
  const inRange = (from, to, start, end) => { const a = day(from), b = day(to), s0 = day(start), e0 = day(end) || day(start);
    if (!s0) return false;
    if (a && e0 < a) return false;
    if (b && s0 > b) return false;
    return true; };
  const mark = (kind, date, label, o) => { const x = o || {};
    return { kind, date: day(date), date_end: day(x.date_end) || day(date), label: S(label), detail: S(x.detail), url: S(x.url), source: S(x.source),
      tone: (KINDS[kind] || {}).tone || 'neutral', kind_label: (KINDS[kind] || {}).label || kind,
      ...(x.report_type ? { report_type: S(x.report_type) } : {}) }; };   // R20: which kind of audit a `fix` mark came from
  // every event inside [from, to]. `published`: seo_content_log rows; `audits`: seo_audits rows (oldest first or any order);
  // `links`: won links with their first sighting. Everything optional - what is missing simply produces no marks.
  const marks = (o) => {
    const x = o || {}; const from = day(x.from), to = day(x.to); const out = [];
    for (const p of (x.published || [])) {
      const d = day(p.published_at || p.publishedAt || p.date);
      if (!d || !inRange(from, to, d, d)) continue;
      const kw = S(p.keyword).trim();
      out.push(mark('publish', d, kw ? 'Published: "' + kw + '"' : 'Page published', { url: S(p.published_url || p.publishedUrl || p.url), source: 'seo_content_log',
        detail: S(p.source) === 'ladder' ? 'a keyword-ladder page' : S(p.source) === 'cadence' ? 'a page of the weekly cadence' : S(p.source) ? 'source: ' + S(p.source) : '' }));
    }
    // R20 (2026-10-14, the second re-rating): the feed chained every audit to the one before it, whatever kind of report it was. With a
    // full SEO report (health 68) sitting between two technical audits (health 80) the same day, the owner read "Technical audit health
    // 80 → 68 · 24 more findings", "Audit fixes: 24 findings gone — health 68 → 80" and "Technical audit health 80 → 80" as three events
    // — three invented moves. The two reports check different things and score differently (D2 / R2 fixed exactly this inside the audit's
    // own diff). A delta is now computed only against the previous report OF THE SAME KIND, and a change of kind is said, never scored.
    const kindOfAudit = (a) => { const t = S(a.report_type || a.reportType || a.type).toLowerCase().trim();
      return /^(full|full_report|full_seo|seo_report)$/.test(t) ? 'full' : /^(site_audit|audit|technical|tech_audit|site)$/.test(t) ? 'site_audit' : (t || 'site_audit'); };
    const AUDIT_LABEL = { site_audit: 'Technical audit', full: 'Full SEO report' };
    const auditName = (k) => (AUDIT_LABEL[k] || 'Audit (' + k + ')');
    const audits = (x.audits || []).filter(a => day(a.audited_at || a.auditedAt)).slice()
      .sort((a, b) => day(a.audited_at || a.auditedAt).localeCompare(day(b.audited_at || b.auditedAt)));
    const lastOf = new Map(); let lastAny = null;
    for (let i = 0; i < audits.length; i++) {
      const a = audits[i]; const kind = kindOfAudit(a);
      const prev = lastOf.get(kind) || null; const prevAny = lastAny;
      lastOf.set(kind, a); lastAny = a;
      const d = day(a.audited_at || a.auditedAt);
      if (!inRange(from, to, d, d)) continue;
      const nFind = Number(a.findings == null ? a.findingsCount : a.findings), pFind = prev ? Number(prev.findings == null ? prev.findingsCount : prev.findings) : NaN;
      const hs = Number(a.health_score == null ? a.healthScore : a.health_score), ps = prev ? Number(prev.health_score == null ? prev.healthScore : prev.health_score) : NaN;
      const fixed = (Number.isFinite(nFind) && Number.isFinite(pFind)) ? pFind - nFind : null;
      const name = auditName(kind); const lower = name.toLowerCase();
      const switched = !prev && prevAny && kindOfAudit(prevAny) !== kind
        ? 'the report before it was a ' + auditName(kindOfAudit(prevAny)).toLowerCase() + (Number.isFinite(Number(prevAny.health_score)) ? ' (' + Number(prevAny.health_score) + '/100)' : '')
          + ': different checks, so the two scores are not comparable' : '';
      const detail = [Number.isFinite(hs) ? (Number.isFinite(ps) ? 'health ' + ps + ' → ' + hs : 'health ' + hs + '/100') : '',
        fixed == null ? '' : fixed > 0 ? fixed + ' fewer finding' + (fixed === 1 ? '' : 's') + ' than the audit before'
          : fixed < 0 ? Math.abs(fixed) + ' more finding' + (fixed === -1 ? '' : 's') + ' than the audit before' : 'the same findings as the audit before',
        switched || (!prev ? 'the first ' + lower + ' on record: nothing to compare it with' : '')].filter(Boolean).join(' · ');
      out.push(mark('fix', d, fixed != null && fixed > 0 ? 'Audit fixes: ' + fixed + ' finding' + (fixed === 1 ? '' : 's') + ' gone' + (kind === 'site_audit' ? '' : ' (' + lower + ')') : name,
        { detail, source: 'seo_audits', report_type: kind }));
    }
    // B7-7 (W3-D): the owner's own dated notes (monthly check-in notes) are marks too; the text is theirs, shown as written
    for (const nt of (x.notes || [])) {
      const d = day(nt.date);
      if (!d || !inRange(from, to, d, d) || !S(nt.text).trim()) continue;
      out.push(mark('note', d, 'Your note', { detail: S(nt.text).trim().slice(0, 300), source: S(nt.source) || 'seo_console_checkins' }));
    }
    for (const l of (x.links || [])) {
      const d = day(l.t0 || l.first_seen || l.date);
      if (!d || !inRange(from, to, d, d)) continue;
      out.push(mark('link', d, 'Link won: ' + S(l.ref_domain || l.refDomain), { url: S(l.target_url || l.targetUrl), source: 'seo_backlinks' }));
    }
    for (const u of (EVENTS.google_updates || [])) {
      if (!inRange(from, to, u.start, u.end)) continue;
      out.push(mark('google_update', u.start, 'Google: ' + S(u.name), { date_end: u.end, source: 'v5/data/seo_events.json',
        detail: 'Google changed its ranking systems between ' + day(u.start) + ' and ' + day(u.end) + '. A move in this window may be part of the cause, which cannot be proven from these numbers.' }));
    }
    for (const b of (EVENTS.data_breaks || [])) {
      if (!inRange(from, to, b.start, b.end)) continue;
      out.push(mark('data_break', b.start, 'Data break: ' + S(b.name), { date_end: b.end, source: 'v5/data/seo_events.json', detail: S(b.detail) }));
    }
    out.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
    return out;
  };
  // does a before / after comparison straddle a data break? Then the two sides are not comparable and the report says so.
  const breakBetween = (from, to) => (EVENTS.data_breaks || []).filter(b => inRange(from, to, b.start, b.end))
    .map(b => ({ name: S(b.name), start: day(b.start), end: day(b.end), detail: S(b.detail), affects: (b.affects || []).map(S) }));
  const html = (list, o) => { const rows = (list || []); const x = o || {};
    if (!rows.length) return x.empty === false ? '' : '<p style="color:#64748b;font-size:13px">Nothing happened in this period that would explain a move in the charts.</p>';
    const td = 'style="padding:4px 8px;border:1px solid #cbd5e1;font-size:12px;vertical-align:top"';
    const th = 'style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left;font-size:11px"';
    return '<table style="border-collapse:collapse;margin:6px 0;max-width:100%"><tr><th ' + th + '>Date</th><th ' + th + '>Event</th><th ' + th + '>What it was</th></tr>'
      + rows.map(m => '<tr><td ' + td + '>' + esc1(m.date + (m.date_end && m.date_end !== m.date ? ' to ' + m.date_end : '')) + '</td><td ' + td + '>'
        + esc1(m.label) + '</td><td ' + td + '>' + esc1(m.detail || m.kind_label) + '</td></tr>').join('') + '</table>';
  };
  // B7-7: said once in the report. Search Console's own annotations live only in Search Console (the API has no annotations resource).
  const OWN_NOTES_LINE = "Search Console's own chart annotations stay in Search Console: Google offers no API that returns them. The marks above are your published pages, your audits, your dated notes and the Google updates we track.";
  return { OWN_NOTES_LINE, marks, html, inRange, breakBetween, EVENTS, KINDS, UPDATES: EVENTS.google_updates || [], BREAKS: EVENTS.data_breaks || [] };
})();
// ---- lineage (G29, 2026-10-13, system review FIX_PLAN.md; CRITERIA_technical_tracking_reporting_ai_links.md 3.11) ----
// Every number a customer reads has to say where it came from, over what period, and how big the sample was. Before this, the AI
// visibility report said it (sample sizes, Wilson ranges) and the others did not: the weekly report printed "1,240 impressions" and
// "#8" side by side without saying that one is a 28-day Search Console count and the other one live sample of one results page.
// LN.of() carries that as structured fields next to the value (`source`, `period`, `sample`, `basis`), LN.note() turns them into one
// short line for a tooltip or a footnote, and LN.block() prints the whole list under a report as "Where these numbers come from".
// Rules: the vocabulary is the one the rest of the system already uses (G6 "modelled, not measured clicks", G8 `calibrated` /
// `modelled` / `unknown`, G28 statistical ranges, G26 `impact_basis`) - this kit makes it universal, it does not invent a second
// scheme. A modelled or uncalibrated number must say so. Where lineage is genuinely unknown the note reads "source not recorded":
// never a guessed source.
const LN = (() => {
  const MISSING = 'source not recorded';
  // where numbers come from. `label` is what a customer reads, `how` the one sentence about what that source can and cannot see.
  const SOURCES = {
    gsc: { label: 'Google Search Console', how: 'Google\'s own count of the impressions and clicks it served; the last 3 days are not final, and figures are averages across devices and locations' },
    gsc_history: { label: 'your stored Search Console history', how: 'the weekly Search Console readings we have kept for this site' },
    inspection: { label: 'Search Console URL Inspection', how: 'Google\'s own answer about one URL at the moment it was asked' },
    gsc_links: { label: 'your Search Console link export', how: 'the sample of links Google shows you; it is a sample, not the whole list' },
    ga4: { label: 'Google Analytics 4', how: 'visits measured on your site by your own GA4 property' },
    serp: { label: 'a live Google results page', how: 'one results page read through DataForSEO at that moment, from one country and one device' },
    kwdata: { label: 'Google Ads keyword data (through DataForSEO)', how: 'the provider\'s monthly search volume and cost per click; a provider estimate for a single keyword, not a measurement of your site' },
    backlink_index: { label: 'the DataForSEO backlink index', how: 'one crawler\'s index of the web: it finds much of the web, never all of it' },
    bing: { label: 'Bing Webmaster Tools', how: 'Bing\'s own figures for the site it has verified' },
    link_graph: { label: 'the Common Crawl web graph', how: 'a public crawl of the web, released every few months' },
    ahrefs: { label: 'the Ahrefs Domain Rating API', how: 'Ahrefs\' own 0-100 rating of a domain' },
    trends: { label: 'Google Trends', how: 'a relative index of search interest (100 = the peak of the period), not a count of searches' },
    ai_engines: { label: 'the AI assistants themselves', how: 'the answers ChatGPT, Gemini, Google AI Mode and the others gave to the questions in your panel' },
    ai_db: { label: 'the DataForSEO AI-answer database', how: 'a database of AI answers and the brands they name' },
    own_check: { label: 'our own fetch of the page', how: 'we requested the page ourselves and read what came back' },
    draft: { label: 'the finished draft itself', how: 'counted in the text this run wrote, before anybody published it' },
    crawl: { label: 'our crawl of your website', how: 'the pages we could reach and read on your site' },
    crux: { label: 'the Chrome User Experience Report', how: 'speed as real Chrome visitors experienced it over 28 days' },
    pagespeed: { label: 'Google PageSpeed Insights (Lighthouse)', how: 'one simulated mobile load in a lab, not what your visitors felt' },
    rdap: { label: 'the domain registry (RDAP, else WHOIS)', how: 'the registry\'s own record of when a domain was registered' },
    gbp: { label: 'Google Business Profile', how: 'the public listing Google holds for the business' },
    wikidata: { label: 'Wikidata', how: 'the public knowledge base search engines read' },
    web: { label: 'public web pages we read', how: 'pages we fetched and quoted; nothing behind a login' },
    you: { label: 'what you told us', how: 'the business profile, the monthly check-in or the forms you filled in' },
    model: { label: 'a model on top of measured data', how: 'computed from measured numbers with a published formula, not measured itself' },
    none: { label: MISSING, how: 'this figure reached the report without its source: treat it as unverified' },
  };
  // how the figure was arrived at. The words are the ones G6 / G8 / G28 already use.
  const BASIS = {
    measured: 'measured',
    calibrated: 'calibrated against your own measured data',
    modelled: 'modelled, not measured',
    one_sample: 'one sample, not an average',
    estimated: 'estimated',
    reported: 'reported by the source',
    unknown: MISSING,
  };
  const S = (v) => String(v == null ? '' : v);
  const fmt = (v) => (Number(v) || 0).toLocaleString('en-GB');
  const esc1 = (s) => S(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const src = (k) => SOURCES[k] || SOURCES.none;
  // "2026-09-15 to 2026-10-12 (28 days)" - the period a figure covers, never an empty string
  const range = (r, label) => { const o = r || {}; const a = S(o.start), b = S(o.end);
    if (!a && !b) return label ? S(label) : 'period not recorded';
    if (a && b) { const d = Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 864e5) + 1;
      return a + ' to ' + b + (Number.isFinite(d) && d > 0 ? ' (' + d + ' day' + (d === 1 ? '' : 's') + ')' : ''); }
    return 'to ' + (b || a); };
  const asOf = (at) => { const d = S(at).slice(0, 10); return d ? 'as of ' + d : 'date not recorded'; };
  const days = (n, end) => (Number(n) || 0) + ' days' + (S(end).slice(0, 10) ? ' to ' + S(end).slice(0, 10) : '');
  const sample = (n, unit) => (n == null || n === '' || !Number.isFinite(Number(n))) ? 'sample not recorded' : fmt(n) + (unit ? ' ' + S(unit) : '');
  // one figure's lineage, as structured fields beside the value
  const of = (figure, source, o) => { const x = o || {}; const key = SOURCES[source] ? source : 'none';
    const basis = BASIS[x.basis] ? x.basis : (key === 'none' ? 'unknown' : 'measured');
    return { figure: S(figure), source: key, source_label: src(key).label, source_how: src(key).how,
      period: S(x.period) || 'period not recorded', sample: x.sample == null ? 'sample not recorded' : S(x.sample),
      basis, basis_label: BASIS[basis], note: S(x.note) };
  };
  // a figure whose source nobody recorded: say exactly that instead of inventing one
  const unknown = (figure, why) => ({ figure: S(figure), source: 'none', source_label: MISSING, source_how: src('none').how,
    period: '', sample: '', basis: 'unknown', basis_label: MISSING, note: S(why) });
  // "Google Search Console · 2026-09-15 to 2026-10-12 (28 days) · 1,240 impressions · measured"
  const note = (l) => { const x = l || {}; const lbl = x.source_label || MISSING;
    return [lbl, x.period, x.sample, x.basis_label === lbl ? '' : x.basis_label, x.note].filter(Boolean).join(' · '); };
  const isHonest = (l) => !!l && (l.basis !== 'unknown' || note(l).indexOf(MISSING) >= 0);
  // ---- the evidence half of the same rule (R10, promoted to the class by lineage_lint.py, 2026-10-15) ----
  // A finding is a figure like any other: it may not be shown without the thing that shows it. R10 was exactly this - Google
  // retired the Mobile Usability report, the API answered VERDICT_UNSPECIFIED for every page, and the audit raised a HIGH finding
  // on 45 of 47 pages whose evidence string was "/:  | /whatwedo/ai-automation: " - punctuation and nothing else. So the test is
  // not `evidence !== ''`: a string that is only separators, brackets or a bare "0" carries no evidence either.
  const hasEvidence = (f) => {
    const ev = S((f || {}).evidence).replace(/<[^>]*>/g, ' ');     // markup is not evidence
    return /[A-Za-z]|[1-9]/.test(ev.replace(/[\s;|,.:·\-–—()\[\]\/]+/g, ' '));
  };
  // the findings that may be shown, and the titles of the ones held back. `allow` names a title that is evidence in itself
  // (a count in the title, a note about data that could not be collected); everything else has to carry its own.
  const unevidenced = (list, o) => { const x = o || {}; const allow = (x.allow || []).map(S);
    return (list || []).filter(f => f && !hasEvidence(f) && allow.indexOf(S(f.title)) < 0).map(f => S(f.title || f.id || 'untitled')); };
  const evidenced = (list, o) => { const x = o || {}; const allow = (x.allow || []).map(S);
    const keep = (list || []).filter(f => f && (hasEvidence(f) || allow.indexOf(S(f.title)) >= 0));
    if (typeof x.onDrop === 'function') { const d = unevidenced(list, o); if (d.length) x.onDrop(d); }
    return keep; };
  const evidenceNote = (dropped) => (dropped || []).length
    ? (dropped.length + ' finding(s) were left out because nothing was measured to show them: ' + dropped.slice(0, 5).join(', ')) : '';
  const html = (l) => '<span style="color:#64748b;font-size:11px">' + esc1(note(l)) + '</span>';
  const line = (l) => '<div style="color:#64748b;font-size:11px;margin-top:2px">' + esc1(note(l)) + '</div>';
  // the block under a report: one row per figure, so no number is left without a source, a period and a sample
  const block = (list, o) => { const rows = (list || []).filter(Boolean); const x = o || {};
    const td = 'style="padding:3px 8px;border:1px solid #cbd5e1;font-size:11px;vertical-align:top;color:#334155"';
    const th = 'style="padding:3px 8px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left;font-size:11px"';
    if (!rows.length) return '';
    return '<h3 style="margin:18px 0 4px;font-size:13px;color:#0f172a">' + esc1(x.title || 'Where these numbers come from') + '</h3>'
      + '<table style="border-collapse:collapse;margin:4px 0;max-width:100%">'
      + '<tr><th ' + th + '>Figure</th><th ' + th + '>Source</th><th ' + th + '>Period</th><th ' + th + '>Sample</th><th ' + th + '>How it was arrived at</th></tr>'
      + rows.map(l => '<tr><td ' + td + '>' + esc1(l.figure) + '</td><td ' + td + '>' + esc1(l.source_label) + '</td><td ' + td + '>' + esc1(l.period || '-')
        + '</td><td ' + td + '>' + esc1(l.sample || '-') + '</td><td ' + td + '>' + esc1([l.basis_label, l.note].filter(Boolean).join(': ')) + '</td></tr>').join('')
      + '</table><p style="color:#64748b;font-size:11px;margin:4px 0">' + esc1(x.footer || 'A figure marked "' + BASIS.modelled + '" is computed, not counted; "' + MISSING + '" means the figure reached this report without its source and should be treated as unverified.') + '</p>';
  };
  return { of, unknown, note, html, line, block, range, asOf, days, sample, isHonest, hasEvidence, evidenced, unevidenced,
    evidenceNote, SOURCES, BASIS, MISSING };
})();
// ---- change test (G12, 2026-10-13, system review FIX_PLAN.md; CRITERIA_technical_tracking_reporting_ai_links.md 3.4) ----
// "We changed the page and clicks went up" is not a result: seasonality and Google's own updates move every page on a site at once
// (P1: CausalImpact, Brodersen et al. 2015 - measuring a change needs a control or a counterfactual; P2: even the most reliable test
// type SearchPilot publishes wins only about 2 times in 3). The Link Builder already measured a won link against a control group of
// the site's OTHER pages over the same weeks; this kit is that same comparison, lifted out so a PAGE CHANGE can be read the same way.
// The verdicts are graded and deliberately weak: "likely helped" / "possibly helped" / "no clear effect yet" / "too early to tell" /
// "can't tell". Nothing here ever says a change CAUSED anything - a control group narrows the alternatives, it does not prove a cause.
const CT = (() => {
  const LABELS = { likely_helped: 'Likely helped', possibly_helped: 'Possibly helped', no_effect_yet: 'No clear effect yet', too_early: 'Too early to tell', cant_tell: 'Can\'t tell' };
  const MIN_WEEKS = 6;          // a change read before 6 weeks says "too early": Google needs weeks to settle (P2: ~10 weeks per position for a link)
  const MIN_OTHERS = 3;         // fewer than 3 other pages to compare with = no usable control group, so the verdict can only be "possibly"
  const r1 = (n) => Math.round(10 * n) / 10;
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
  const S = (v) => String(v == null ? '' : v);
  const NOTES = {
    link: { early: 'read at 6, 10 and 16 weeks after the link went live', no_data: 'the page had no search impressions before or after the link' },
    page: { early: 'read at 6, 10 and 16 weeks after the change', no_data: 'the page had no search impressions before or after the change' },
  };
  const label = (v) => LABELS[v] || S(v);
  /**
   * One change, against the control group of the site's other pages over the same window. Positions: lower is better, so a positive
   * `page_change` means the page moved UP. `others` are the control pages' own moves (before - after), unrounded.
   * o: { weeks, base, now, others, joint, kind, min_weeks, min_others, no_data, early }
   */
  const compare = (o) => {
    const x = o || {}; const kind = NOTES[x.kind] ? x.kind : 'page';
    const minWeeks = x.min_weeks == null ? MIN_WEEKS : x.min_weeks, minOthers = x.min_others == null ? MIN_OTHERS : x.min_others;
    const weeks = Math.max(0, Math.floor(Number(x.weeks) || 0));
    const out = { weeks, base_position: 0, position: 0, page_change: 0, control_change: 0, control_spread: 0, control_pages: 0, effect: 0, verdict: '', verdict_label: '', note: '' };
    if (weeks < minWeeks) { out.verdict = 'too_early'; out.note = S(x.early) || NOTES[kind].early; out.verdict_label = label(out.verdict); return out; }
    const base = x.base == null || x.base === '' ? null : Number(x.base), now = x.now == null || x.now === '' ? null : Number(x.now);
    if (!Number.isFinite(base) || !Number.isFinite(now) || base <= 0 || now <= 0) {
      out.verdict = 'cant_tell'; out.note = S(x.no_data) || NOTES[kind].no_data; out.verdict_label = label(out.verdict); return out; }
    const others = (x.others || []).map(Number).filter(Number.isFinite);
    out.base_position = r1(base); out.position = r1(now); out.page_change = r1(out.base_position - out.position);
    const mid = median(others);
    out.control_change = r1(mid); out.control_spread = r1(median(others.map(d => Math.abs(d - mid)))); out.control_pages = others.length;
    out.effect = r1(out.page_change - out.control_change);
    const joint = Number(x.joint) || 0;
    out.verdict = others.length < minOthers ? (out.effect > 1 ? 'possibly_helped' : 'no_effect_yet')
      : out.effect > Math.max(1, 2 * out.control_spread) && !joint ? 'likely_helped'
      : out.effect > Math.max(0.5, out.control_spread) ? 'possibly_helped' : 'no_effect_yet';
    out.verdict_label = label(out.verdict);
    out.note = (joint ? (kind === 'link' ? 'another link to this page within 4 weeks (credit shared); ' : 'another change to this page within 4 weeks (credit shared); ') : '')
      + (others.length < minOthers ? 'few other pages to compare with; ' : '')
      + 'position ' + out.base_position + ' → ' + out.position + ' vs the site\'s other pages ' + (out.control_change >= 0 ? '+' : '') + out.control_change;
    return out;
  };
  const method = 'Each change is dated and read against a control group: the same page\'s average Google position before and after, minus what the site\'s OTHER pages did over the same weeks. That removes the part of the move that was the season, the market or a Google update. "Likely helped" means the page beat its control group by more than twice the spread of the control group itself and nothing else changed on that page in the same four weeks; "possibly helped" means it beat the control group by less than that; "no clear effect yet" means it did not. A control group narrows the alternatives: it is never proof of cause.';
  const summary = (rows) => { const list = (rows || []); const by = (v) => list.filter(r => r.verdict === v).length;
    return { total: list.length, likely_helped: by('likely_helped'), possibly_helped: by('possibly_helped'), no_effect_yet: by('no_effect_yet'), too_early: by('too_early'), cant_tell: by('cant_tell'),
      read: list.filter(r => !['too_early', 'cant_tell'].includes(r.verdict)).length }; };
  return { compare, label, summary, method, LABELS, NOTES, MIN_WEEKS, MIN_OTHERS, r1, median };
})();
// RV-1 (2026-10-21, pre-launch run on techand.ai): the pages that no longer answer. The report told the owner to make a 404 page "the single
// page" for a search, to link to it from another 404 page and to watch a third; the first thing to say was "redirect the old addresses".
// The inventory now carries what each address answered (Status Targets / Fetch Page Status, SM.isGone): the gone ones are ONE priority-1
// action with the page each should redirect to (_gone.js), and no other action, list or brief fact may point at them.
// ---- RV-1 (2026-10-21, pre-launch run on techand.ai): PAGES THAT ARE GONE, ONE MESSAGE EVERYWHERE (inlined where a node asks for the GONE kit marker) ----
// The site was rebuilt: Search Console still showed ~34 old addresses (2-3k of 5.7k impressions) that answer 404 (the bare host 308s to
// www, which 404s) and nothing redirects them. The audit filed some as "redirect somewhere else" (Low), the weekly site report told the
// owner to make one of them "the single page" for a search, the AI visibility brief said "build on your existing D365 pages" and AI
// Growth sent them to Bing. The first thing the owner has to hear is one sentence: these addresses are gone, redirect each to this page.
// This kit holds that sentence, the suggested target of each redirect and the redirect files, so every report says the same thing:
//   GONE.isGone(status)            404 / 410 after following redirects (a bot wall, a timeout or a 5xx is NOT gone: not known)
//   GONE.plan(dead, live, home)    [{ from_url, from, to, to_url, status, impressions, clicks, match }] most impressions first
//   GONE.finding(plan, o)          the audit finding (one title, one fix) with the full list in `redirects`
//   GONE.action(plan)              the weekly / AI report action (priority 1)
//   GONE.files(plan, today)        { csv, nginx, htaccess } for the fix pack
//   GONE.keyOf(u) / GONE.drop(list, set, pick)   host-agnostic address key, and "leave the gone addresses out of this list"
// Customer text: plain words, no dashes used as punctuation, no ellipsis.
const GONE = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const isGone = (st) => { const n = n0(st); return n === 404 || n === 410; };
  const keyOf = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const pathOf = (u) => S(u).replace(/^https?:\/\/[^\/]+/i, '').replace(/[?#].*$/, '').replace(/(.)\/+$/, '$1') || '/';
  const fmt = (v) => n0(v).toLocaleString('en-GB');
  // words that say nothing about which page an old address was about (places, filler, the generic page words of every site)
  const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'your', 'our', 'what', 'how', 'why', 'who', 'are', 'you', 'its', 'into', 'about', 'uae', 'dubai', 'abu', 'dhabi',
    'sharjah', 'emirates', 'united', 'arab', 'html', 'htm', 'php', 'aspx', 'page', 'pages', 'index', 'www', 'com', 'new', 'best', 'top', 'guide', 'complete', 'every', 'must']);
  const stem = (t) => t.length >= 5 ? t.replace(/(ations?|ings?|ants?|ers?)$/, '').replace(/s$/, '').replace(/e$/, '') : t;   // services = service, operations = operation
  const words = (s) => [...new Set(S(s).toLowerCase().replace(/&/g, ' and ').split(/[^a-z0-9]+/).filter(t => t.length > 2 && !STOP.has(t)).map(stem))];
  // the closest live page: the one sharing the most specific words with the old address (a word most live pages carry counts for little);
  // without one, the section page the old address sat under when that page is live, else the home page, and the match says which it was
  const plan = (dead, live, home) => {
    const deadKeys = new Set((Array.isArray(dead) ? dead : []).map(d => keyOf(d.url || d.from_url)));
    const L = (Array.isArray(live) ? live : []).map(p => ({ url: S(p.url), path: pathOf(p.url), title: S(p.title || p.h1), status: p.status != null ? p.status : p.http_status }))
      .filter(p => p.url && !isGone(p.status) && !deadKeys.has(keyOf(p.url)));
    const homeUrl = S(home) || (L.find(p => p.path === '/') || {}).url || '/';
    const docs = L.filter(p => p.path !== '/').map(p => ({ p, w: new Set([...words(p.path.replace(/[\/_-]+/g, ' ')), ...words(p.title)]) }));
    const df = new Map(); for (const d of docs) for (const w of d.w) df.set(w, (df.get(w) || 0) + 1);
    const idf = (w) => Math.log(1 + (docs.length + 1) / (1 + (df.get(w) || 0)));
    const seen = new Set(); const out = [];
    for (const d0 of (Array.isArray(dead) ? dead : [])) {
      const url = S(d0.url || d0.from_url); const k = keyOf(url); if (!url || seen.has(k)) continue; seen.add(k);
      const path = pathOf(url); const want = words(path.replace(/[\/_-]+/g, ' '));
      let best = null;
      for (const d of docs) { const shared = want.filter(w => d.w.has(w)); if (!shared.length) continue;
        const score = shared.reduce((s, w) => s + idf(w), 0);
        if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && d.p.path.length < best.p.path.length)) best = { p: d.p, score, shared }; }
      const strong = best && (best.shared.length >= 2 || best.score >= 1.2);
      const parent = path.split('/').filter(Boolean).slice(0, -1).join('/');
      const section = parent ? L.find(p => p.path === '/' + parent) : null;
      const to = strong ? best.p : section || null;
      out.push({ from_url: url, from: path, to_url: to ? to.url : homeUrl, to: to ? to.path : '/', status: n0(d0.status || d0.http_status), impressions: n0(d0.impressions), clicks: n0(d0.clicks),
        match: strong ? 'same topic (shares "' + best.shared.slice(0, 3).join('", "') + '")' : section ? 'its section page' : 'home page (no live page matches it by name: use a better page if you have one)' });
    }
    return out.sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks || a.from.localeCompare(b.from));
  };
  const totals = (pl) => (pl || []).reduce((t, r) => ({ impressions: t.impressions + n0(r.impressions), clicks: t.clicks + n0(r.clicks) }), { impressions: 0, clicks: 0 });
  const line = (r) => r.from + (r.impressions ? ' (' + fmt(r.impressions) + ' impressions)' : '') + ' to ' + r.to;
  const TITLE = 'Pages Google still shows no longer answer: redirect them';
  const TITLE_UNSEEN = 'Known URLs outside the crawl no longer answer';
  const FIX = 'Add a permanent (301) redirect from each old address to the page suggested for it (redirects.csv in the fix pack lists every one, with nginx and Apache versions; use a better page where you have one), then take the old addresses out of the sitemap and the internal links.';
  // the audit finding: one title and one fix wherever a gone page is found; `o.note` is the sample the reading came from
  const finding = (pl, o) => {
    const x = o || {}; const t = totals(pl); const seen = (pl || []).filter(r => r.impressions > 0 || r.clicks > 0);
    const codes = [...new Set((pl || []).map(r => r.status).filter(Boolean))].map(c => 'HTTP ' + c).join(' / ') || 'HTTP 404';
    return { category: 'Crawlability & Indexing', severity: seen.length ? 'High' : 'Medium', title: seen.length ? TITLE : TITLE_UNSEEN,
      evidence: (pl || []).length + ' address(es) answer ' + codes + (x.via_redirect ? ' (' + x.via_redirect + ' of them only after a redirect to the main host)' : '') + ': '
        + (pl || []).slice(0, 5).map(r => r.from + ': HTTP ' + (r.status || 404) + (r.impressions ? ', ' + fmt(r.impressions) + ' impressions' : '')).join('; ')
        + ((pl || []).length > 5 ? '; and ' + ((pl || []).length - 5) + ' more' : '') + (x.note ? '. ' + x.note : '')
        + (seen.length ? '; ' + seen.length + ' of them still earn impressions in Search Console (' + fmt(t.impressions) + ' impressions and ' + fmt(t.clicks) + ' clicks in the last 28 days)' : ''),
      why: seen.length ? 'Google still shows these addresses in search, and every visitor who clicks them, and every link that points at them, lands on an error page. Until they redirect, the visibility they earned is lost, and Google drops them one by one.'
        : 'These addresses are in your sitemap or were known before, but they return an error. Visitors and crawlers that follow them hit a dead end, and the link value pointing at them is lost.',
      fix: FIX, sample_urls: (pl || []).slice(0, 5).map(r => r.from_url), affected_urls: (pl || []).slice(0, 200).map(r => r.from_url), affected_count: (pl || []).length || null,
      scope: 'page', scoring: true, source: x.source || 'gone', figure: '', redirects: (pl || []).slice(0, 200) };
  };
  const action = (pl) => { const t = totals(pl); if (!(pl || []).length) return null;
    return { priority: 1, type: 'redirect_gone', keyword: '', url: (pl[0] || {}).from_url || '',
      action: 'Redirect the ' + pl.length + ' old address(es) that now answer 404 (301 to the closest live page): ' + pl.slice(0, 4).map(line).join('; ') + (pl.length > 4 ? '; and ' + (pl.length - 4) + ' more' : '') + '.',
      why: 'Google still shows them (' + fmt(t.impressions) + ' impressions and ' + fmt(t.clicks) + ' clicks in the last 28 days), and every visit and every link to them ends on an error page. Do not work on these pages: they no longer exist.',
      redirects: pl.slice(0, 60) }; };
  const q = (v) => '"' + S(v).replace(/"/g, '""') + '"';
  const files = (pl, today) => { const L = (pl || []).filter(r => r.from && r.to && r.from !== r.to); if (!L.length) return null; const d = S(today) || new Date().toISOString().slice(0, 10);
    return { count: L.length,
      csv: 'from,to,http_status_now,impressions_28d,match\n' + L.map(r => [r.from, r.to, r.status || 404, r.impressions, r.match].map(q).join(',')).join('\n') + '\n',
      nginx: '# 301 redirects for addresses that no longer answer, found by the SEO audit on ' + d + '\n' + L.map(r => 'location = ' + r.from + ' { return 301 ' + r.to + '; }').join('\n') + '\n',
      htaccess: '# 301 redirects for addresses that no longer answer, found by the SEO audit on ' + d + '\n' + L.map(r => 'Redirect 301 ' + r.from + ' ' + r.to).join('\n') + '\n' }; };
  // leave the gone addresses out of a list (pick reads the address from an entry); returns { kept, dropped }
  const drop = (list, set, pick) => { const kept = [], dropped = []; const get = pick || ((x) => (x && typeof x === 'object') ? (x.url || x.page || x.u) : x);
    for (const x of (Array.isArray(list) ? list : [])) (set && set.has(keyOf(get(x))) ? dropped : kept).push(x); return { kept, dropped }; };
  return { isGone, keyOf, pathOf, plan, finding, action, files, drop, totals, TITLE, TITLE_UNSEEN, FIX };
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
// G11 / G25 (2026-10-13): the daily key-page watch's rows and its site fingerprint, so the weekly report and the app's technical page show
// the same picture (the watch runs in its own workflow, SEO Agent — Page Watch, every morning)
const watchRows = grab('Load Page Watch (Site)').filter(r => r.site_id && r.url);
const watchCacheRows = grab('Load Watch Cache (Site)').filter(r => String(r.key || '').indexOf('watch:') === 0);
// G12: the stored rows the chart marks are computed from — pages that went live (seo_content_log) and the technical audits (seo_audits)
const logRowsAll = (() => { try { return $('Load Content Log').all().map(i => i.json).filter(r => r && r.site_id && !r.error); } catch (e) { return []; } })();
const auditRowsAll = (() => { try { return $('Load Audits (Site)').all().map(i => i.json).filter(r => r && r.site_id && !r.error); } catch (e) { return []; } })();
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
    return { ...t, gsc_position: g ? g.position : null, gsc_prev_position: g ? g.prev_position : null, clicks: g ? g.clicks : 0, impressions: g ? g.impressions : 0, prev_clicks: g ? g.prev_clicks : 0, prev_impressions: g ? g.prev_impressions : 0, page: g ? g.page : '',
      serp_position: sp ? sp.position : null, serp_url: sp ? sp.url : '', serp_checked_at: sp ? sp.checked_at : '', history: hist }; });
  // pages found live this week replace their planned entry (live URL, published) or are added; they were inspected in this run
  const det = detAll.find(x => x.site_id === s.site_id) || null; const found = det ? det.detected : [];
  // R92 part 4 (2026-10-16, re-rating 2026-10-15): ONE rule with the Rank Tracker (Tracker_Report.js `coveredBy`): a ladder target that
  // a live page of the site already answers (SM.matchPage over this week's inventory) is reported AS that page. Before, this table read
  // only the ladder row ("/peppol-uae/ | writing | no page was written yet") while the Rank Tracker of the same morning said "the main
  // page is live: improve …/top-peppol-e-invoicing-software-features…". The planned URL and the ladder row's own state travel with it, so
  // a page written for that target is still told "do not publish it as a second URL" (D11) below.
  const coverLive = (p) => { if (!p || p.page_exists || p.status === 'published') return p; const c = covered(p.keyword, p.url); if (!c) return promised(p);
    return { ...p, url: c.url, planned_url: onHost(p.url), ladder_status: p.status, status: 'live (existing page)', page_exists: true, covered_by: c.url, covered_match: c.matched_by || '' }; };
  const basePages = (s.ladder_pages || []).map(p => { const f = found.find(f => kwKey(f.keyword) === kwKey(p.keyword) && (!f.ladder_id || !p.ladder_id || f.ladder_id === p.ladder_id)); return f ? { ...p, url: f.url, status: 'published', page_exists: true, detected: true } : coverLive(p); });
  for (const f of found) if (!basePages.some(p => ukey(p.url) === ukey(f.url))) basePages.push({ url: f.url, keyword: f.keyword, rung: 0, status: 'published', ladder_id: f.ladder_id || '', page_exists: true, detected: true });
  // G25 (2026-10-13): an inspection the quota did not reach, or one that failed, is "not checked" — never "not indexed" (`skipped` / `not_checked`)
  const pages = basePages.map(p => { const i = insp.find(x => ukey(x.url) === ukey(p.url) && !x.skipped && !x.inspect_error) || insp.find(x => ukey(x.url) === ukey(p.url)); /* C-15: host-agnostic (a promised www URL, an inspected bare-host one) */ const asked = !!i && !i.skipped && !i.inspect_error;
    return { ...p, inspected: asked, indexed: asked ? !!i.indexed : null, verdict: asked ? i.verdict : '', coverage: asked ? i.coverage : '', last_crawl: asked ? i.last_crawl : '', canonical_ok: asked ? i.canonical_ok : null,
      google_canonical: asked ? i.google_canonical : '', mobile_usable: asked ? i.mobile_usable : null, rich_results: asked ? i.rich_results : [],
      inspect_error: asked ? null : (i ? (i.not_checked || i.inspect_error) : (s.gsc_connected ? 'not inspected' : 'Search Console not connected')) }; });
  // C-15 (re-rating 2026-10-17): ONE row per page. Several ladder rows answered by one existing page, a planned URL on the bare host and the
  // same page on www, or a page found live beside its ladder row all became the same URL after the rewrites above, so exec 787 listed two
  // pages twice in the index table and raised each "Page not indexed" alert twice. Rows are merged by host-agnostic URL (the live / inspected
  // one kept, the other keywords carried as `also_keywords`), before any alert or action is made from them.
  { const byU = new Map(), rank = (x) => ((x.page_exists || x.status === 'published') ? 2 : 0) + (x.inspected ? 1 : 0);
    for (const p of pages) { const k = ukey(p.url); const o = byU.get(k);
      if (!o) { byU.set(k, p); continue; }
      const [keep, drop] = rank(p) > rank(o) ? [p, o] : [o, p];
      keep.also_keywords = [...new Set([...(keep.also_keywords || []), ...(drop.also_keywords || []), drop.keyword].filter(x => x && x !== keep.keyword))]; byU.set(k, keep); }
    pages.splice(0, pages.length, ...byU.values()); }
  // C-15: a planned page Google itself reports "Submitted and indexed" IS live (/dynamics-365-crm-uae was shown "planned" beside that
  // verdict): the inspection is the evidence, the ladder row's word is not
  for (const p of pages) if (!(p.page_exists || p.status === 'published') && p.inspected && p.indexed === true) { p.ladder_status = p.ladder_status || p.status; p.status = 'live (indexed by Google)'; p.page_exists = true; }
  // pages not live yet are reported as such, never as 'not indexed'
  // R1 (2026-10-13): "written, not published yet" only when seo_content_log says the page was written (Site Plan's `written`); a ladder row
  // that merely says `writing` is a promise — a refused page run leaves exactly that, and the note says what happened.
  // R111 (2026-10-16): a draft whose last quality round failed is neither "written, not published yet" nor "no page was written yet"
  for (const p of pages) if (!(p.page_exists || p.status === 'published')) { p.inspect_error = (['writing', 'written', 'not_ready'].includes(p.status) && p.written) ? 'written, not published yet' : (['writing', 'written', 'not_ready'].includes(p.status) && p.not_ready) ? ('written, but the draft did not pass the quality check — fix it and run it again' + ((p.qa_reasons || []).length ? ': ' + String(p.qa_reasons[0]).slice(0, 160) : '')) : p.status === 'writing' ? ('no page was written yet' + (p.status_note ? ': ' + String(p.status_note).slice(0, 160) : '')) : 'planned, not written yet'; p.indexed = null; }
  for (const p of pages) if (p.covered_by && !p.inspected) p.inspect_error = 'not inspected this week; this existing page answers the search the ladder planned ' + (p.planned_url || 'a new page') + ' for';
  // ---- alerts ----
  // G28: `drop` is no longer the test, it is the line between a medium and a high alert. The test is ST.change: enough events in the two
  // periods together (min_events), a change beyond 95% sampling noise (|z| >= 1.96) and a size worth reporting (min_pct).
  // G28 follow-up (2026-10-12, FIX_PLAN section 3.8): a big move that is not significant is a **medium** alert worded as "Watch", with the
  // counts of both periods named as "small numbers" — a site with 20 clicks a month still hears that it halved (and the line reaches
  // seo_site_metrics.alerts and the app, which keep medium and high), while never being told as a fact that its traffic fell. It can never
  // reach the high band, however large the percentage: only a statistically real fall does.
  const alerts = []; const drop = cfg.alert_drop_pct || 30; const minPct = cfg.alert_min_pct || 10;
  const upd = ST.updateNote(R.current);
  const stat = { clicks: null, impressions: null, sessions: null };
  const countAlert = (key, label, cur, prev, minEvents, level) => {
    const ch = ST.change(cur, prev, { min_events: minEvents, min_pct: minPct }); stat[key] = ch;
    if (ch.direction !== 'down' || !ch.big) return ch;
    // G28 follow-up (2026-10-13): the figures were already there; the alert now also says WHAT was tested and with WHICH test (ST.tested,
    // without repeating the z and the range the sentence already prints)
    const basis = ST.tested(ch, { stats: false, source: key === 'sessions' ? 'Google Analytics 4 organic sessions' : 'Search Console ' + label.toLowerCase() });
    if (ch.real) alerts.push({ level: Math.abs(ch.pct) >= drop ? 'high' : level, text: label + ' fell ' + Math.abs(ch.pct) + '% (' + prev + ' → ' + cur + ' in 28 days' + (ch.ci ? '; 95% range ' + ch.ci[0] + '% to ' + ch.ci[1] + '%' : '') + ', z ' + ch.z + ')' + basis + upd, stat: key, tested: basis });   // no range when one period is zero (the log-ratio is undefined)
    else if (ch.watch) alerts.push({ level: 'medium', text: 'Watch: ' + label.toLowerCase() + ' are ' + Math.abs(ch.pct) + '% lower (' + prev + ' → ' + cur + ' in 28 days). Small numbers: ' + (prev + cur) + ' ' + label.toLowerCase() + ' over both periods together, so a swing this size happens by chance (z ' + ch.z + ') — worth a look, not a confirmed fall' + basis + upd, stat: key, small_numbers: true, tested: basis });
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
  // R59 (2026-10-16, re-rating 2026-10-15; the Site Tracker's path of the audit's defect): the canonical alert above looks only at INDEXED
  // pages, and the inspection's `canonical_ok` is host-AGNOSTIC (_page_watch.js) — so a page Google keeps under the bare host while the
  // site redirects to and names www (exec 634: three pages "Duplicate, Google chose different canonical than user", Google's canonical
  // https://techand.ai/…) could never raise anything here. Every inspected page of this run is read, not only the ladder pages, and the
  // split is named for what it is: Google chose the other host, so the fix is the sitemap and the internal links, not "request indexing".
  const hostSplit = (() => { const own = SM.helpers.bare(model.canonical_host || s.domain); const want = String(model.canonical_host || '').toLowerCase();
    const rows = insp.filter(x => x && x.url && x.google_canonical && !x.skipped && !x.inspect_error).filter(x => {
      const hu = String(SM.helpers.hostOf(x.url) || '').toLowerCase(), hg = String(SM.helpers.hostOf(x.google_canonical) || '').toLowerCase();
      return hu && hg && hu !== hg && SM.helpers.bare(hu) === own && SM.helpers.bare(hg) === own && ukey(x.url) === ukey(x.google_canonical); });
    const hosts = [...new Set(rows.map(x => String(SM.helpers.hostOf(x.google_canonical)).toLowerCase()))];
    const origin = (u) => (String(u || '').match(/^https?:\/\/[^\/?#]+/i) || [''])[0];   // an observed URL's own scheme and host, never rebuilt by hand (D15)
    return rows.length ? { pages: rows.map(x => ({ url: x.url, google_canonical: x.google_canonical, indexed: !!x.indexed, coverage: x.coverage || '' })), google_host: hosts[0], site_host: want || String(SM.helpers.hostOf(rows[0].url)).toLowerCase(),
      google_home: origin(rows[0].google_canonical), site_home: SM.siteUrl(model, '/').replace(/\/$/, ''), checked: insp.filter(x => !x.skipped && !x.inspect_error).length } : null; })();
  if (hostSplit) alerts.push({ level: 'medium', stat: 'host_split', text: 'Google keeps ' + hostSplit.pages.length + ' of the ' + hostSplit.checked + ' pages it was asked about under ' + hostSplit.google_home + ' — the other host — although your site serves and names ' + hostSplit.site_home + ' as canonical (Google chose a different canonical than yours): '
    + hostSplit.pages.slice(0, 3).map(x => x.google_canonical).join(', ') + (hostSplit.pages.length > 3 ? ' and ' + (hostSplit.pages.length - 3) + ' more' : '') + '. Those pages are shown under the other host, not missing from Google.' });
  // G28 follow-up (2026-10-13): the last fixed threshold in the site tracking. Search Console's position is an impression-weighted 28-day
  // average, so "5 places" on 12 impressions is one search, not a drop. ST.position needs min_impressions in BOTH periods before it calls a
  // move real, tests the same keyword's clicks over the same two periods, and the alert says what was tested and how sure it is.
  for (const t of tracked) {
    if (!(t.gsc_position > 0 && t.gsc_prev_position > 0 && t.gsc_prev_position <= 20)) continue;
    const pc = ST.position(t.gsc_position, t.gsc_prev_position, { impressions: t.impressions, prev_impressions: t.prev_impressions, clicks: t.clicks, prev_clicks: t.prev_clicks,
      min_impressions: cfg.alert_min_position_impressions || 50, min_places: cfg.alert_min_places || 5 });
    if (pc.direction !== 'down' || !pc.big) continue;
    const moved = '"' + t.keyword + '" slipped from #' + r1(pc.prev) + ' to #' + r1(pc.cur) + ' (' + pc.places + ' places)';
    if (pc.real) alerts.push({ level: t.gsc_prev_position <= 10 ? 'medium' : 'info', text: moved + '. ' + pc.basis + '.' + ST.tested(pc.clicks, { source: 'Search Console clicks for this search' }) + upd, stat: 'position', keyword: t.keyword, tested: pc.basis });
    else alerts.push({ level: 'info', text: 'Watch: ' + moved + ', measured on too little data to call it a drop. ' + pc.basis + '.' + upd, stat: 'position', keyword: t.keyword, small_numbers: true, tested: pc.basis });
  }
  for (const t of tracked) if (t.serp_position > 0 && t.gsc_position && Math.abs(t.serp_position - t.gsc_position) >= 10) alerts.push({ level: 'info', text: '"' + t.keyword + '": live check #' + t.serp_position + ' vs Search Console average #' + r1(t.gsc_position) + ' — positions vary by location and device' });
  if (!ga4) alerts.push({ level: 'setup', text: 'Google Analytics 4 is not connected: ' + (acctErr || ga4Reason || 'no property id given or detected') });
  const notices = s.console_alerts || []; const ck = s.last_checkin || null;
  for (const n of notices) alerts.push({ level: n.severity === 'critical' ? 'high' : n.severity === 'high' ? 'high' : 'medium', text: 'Search Console notice (' + String(n.received_at).slice(0, 10) + '): ' + n.subject });
  if (ck && ck.manual_action && !notices.some(n => n.kind === 'manual_action')) alerts.push({ level: 'high', text: 'Manual action reported in the ' + ck.month + ' check-in' });
  if (ck && ck.security_issue && !notices.some(n => n.kind === 'security')) alerts.push({ level: 'high', text: 'Security issue reported in the ' + ck.month + ' check-in' });
  if (found.length && detErrors.length) alerts.push({ level: 'medium', text: 'Pages found live on the site could not be recorded (' + detErrors[0] + '); report them with "I published a page"' });
  // B7-2 (2026-10-15, benchmark area 7): a device or a country falling on its own disappears inside a site-wide total. The split is
  // free and first-party (Search Analytics `device` / `country`), the same statistical bar as every other alert applies (ST.change),
  // and a split Google did not answer says so instead of showing an empty table that would read as "no phone traffic".
  const DEVICE_LABEL = { DESKTOP: 'desktop', MOBILE: 'phones', TABLET: 'tablets' };
  for (const d of (((gsc && gsc.devices) || {}).rows || []).filter(d => d.change && d.change.real && d.change.direction === 'down').slice(0, 2))
    alerts.push({ level: d.share >= 25 ? 'medium' : 'info', stat: 'device', key: d.key,
      text: 'Search clicks from ' + (DEVICE_LABEL[d.key] || String(d.key).toLowerCase()) + ' fell ' + Math.abs(d.change.pct) + '% (' + d.prev_clicks + ' \u2192 ' + d.clicks
        + ' in 28 days; ' + d.share + '% of your clicks).' + ST.tested(d.change, { source: 'Search Console clicks on ' + (DEVICE_LABEL[d.key] || String(d.key).toLowerCase()) }),
      tested: ST.tested(d.change, { source: 'Search Console clicks on ' + (DEVICE_LABEL[d.key] || String(d.key).toLowerCase())}) });
  for (const c of (((gsc && gsc.countries) || {}).rows || []).filter(c => c.change && c.change.real && c.change.direction === 'down' && c.share >= 10).slice(0, 1))
    alerts.push({ level: 'info', stat: 'country', key: c.key,
      text: 'Search clicks from ' + String(c.key).toUpperCase() + ' fell ' + Math.abs(c.change.pct) + '% (' + c.prev_clicks + ' \u2192 ' + c.clicks + ' in 28 days; ' + c.share + '% of your clicks).'
        + ST.tested(c.change, { source: 'Search Console clicks from ' + String(c.key).toUpperCase() }) });
  if (detFail) alerts.push({ level: 'info', text: 'Publish detection failed this week (' + detFail.slice(0, 160) + '); report published pages with "I published a page"' });
  if (det && det.candidates && !(det.sitemap || {}).ok) alerts.push({ level: 'info', text: 'Publish detection could not read the sitemap (' + ((det.sitemap || {}).error || 'no sitemap') + '); report published pages with "I published a page"' });
  // ---- actions (deterministic; the AI brief words them for the owner) ----
  const actions = []; const apiBase = { country: s.country || '', domain: s.domain, email: s.email || '' };
  // ---- RV-1: the gone pages, with their Search Console traffic, and the one action that names them ----
  const cannibalLive = (() => { const keysG = new Set(SM.gonePages(model).map(p => GONE.keyOf(p.url)));
    return ((gsc && gsc.cannibal) || []).map(c => ({ ...c, pages: (c.pages || []).filter(p => !keysG.has(GONE.keyOf(p.page))) })).filter(c => c.pages.length >= 2); })();
  const goneRows = SM.gonePages(model); const goneKeys = new Set(goneRows.map(p => GONE.keyOf(p.url)));
  const isGoneUrl = (u) => !!u && goneKeys.has(GONE.keyOf(u));
  const trafficBy = new Map(); for (const p0 of ((gsc && gsc.pages) || [])) { const k = GONE.keyOf(p0.page); const t = trafficBy.get(k) || { impressions: 0, clicks: 0 }; t.impressions += Number(p0.impressions) || 0; t.clicks += Number(p0.clicks) || 0; trafficBy.set(k, t); }
  const liveForRedirect = SM.pages(model).filter(p => !SM.isGone(p) && (p.source === 'sitemap' || (Number(p.http_status) >= 200 && Number(p.http_status) < 300)));
  const gone_pages = GONE.plan(goneRows.map(p => ({ url: p.url, status: p.http_status, ...(trafficBy.get(GONE.keyOf(p.url)) || {}) })), liveForRedirect, SM.siteUrl(model, '/'));
  { const ga = GONE.action(gone_pages); if (ga) actions.push(ga); }
  const pageBody = (keyword, url, page_type) => ({ mode: 'keyword', keyword, page_type: page_type || 'Service Page', ...apiBase, existing_page_url: url || '', receive: ['Keyword Report', 'Page Content'] });
  // B4-3: the search a page is really refreshed FOR — the query that brings it the most impressions, from this run's own
  // Search Console rows. A refresh with no search behind it is a rewrite nobody asked for.
  const ukeyQ = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '');
  const topQueryOf = (url) => ((gsc && gsc.queries) || []).filter(q => q.page && ukeyQ(q.page) === ukeyQ(url) && q.query)
    .sort((a, b) => (Number(b.impressions) || 0) - (Number(a.impressions) || 0))[0] || null;
  const sa = cfg.service_account_email || '(the service-account e-mail: ask your administrator)';
  for (const n of notices.filter(n => n.kind === 'manual_action' || n.kind === 'security').slice(0, 2)) actions.push({ priority: 1, type: n.kind, action: (n.kind === 'manual_action' ? 'Resolve the manual action: open Search Console → Security & Manual Actions → Manual actions, fix every page it names, then request a review.' : 'Resolve the security issue: clean the site, update CMS and plugins, change passwords, then request a review under Search Console → Security issues.'), why: n.subject + ' (' + String(n.received_at).slice(0, 10) + ').', keyword: '', url: '' });
  for (const n of notices.filter(n => n.kind === 'coverage' || n.kind === 'cwv' || n.kind === 'rich_results' || n.kind === 'sitemap' || n.kind === 'crawl').slice(0, 2)) actions.push({ priority: 2, type: 'console_' + n.kind, action: 'Open the Search Console report named in "' + n.subject + '" and fix the listed pages, then click Validate fix.', why: 'Google sent this notice on ' + String(n.received_at).slice(0, 10) + '.', keyword: '', url: '' });
  if (ck && ck.csv_kind === 'reasons' && (ck.coverage.reasons || []).length) actions.push({ priority: 2, type: 'coverage_report', action: 'Work through the Pages report from your ' + ck.month + ' check-in: ' + ck.coverage.reasons.slice(0, 3).map(r => r.reason + ' (' + r.pages + ' pages)').join(', ') + '.', why: ck.not_indexed_total + ' pages are not indexed site-wide according to Search Console.', keyword: '', url: '' });
  if (s.checkin_due) actions.push({ priority: 3, type: 'checkin', action: 'Monthly Search Console check-in: open the form, answer two questions (manual action? security issue?) and upload the Pages report export.', why: 'Google offers no API for manual actions, security issues and the site-wide Pages report; the check-in covers them' + (cfg.console_mail_watcher ? ' alongside the notification watcher' : '') + '.', keyword: '', url: '' });
  if (!s.gsc_connected) actions.push({ priority: 1, type: 'connect_gsc', action: 'Add ' + sa + ' as a user (Full) of ' + s.domain + ' in Search Console → Settings → Users and permissions.', why: 'Without it the report has no real query, click or index data.', keyword: '', url: '' });
  for (const p of pages.filter(p => p.inspected && p.indexed === false && (p.page_exists || p.status === 'published')).slice(0, 3)) actions.push({ priority: 1, type: 'index', action: 'Request indexing for ' + p.url + ' in Search Console (URL inspection → Request indexing) and link to it from 2-3 existing pages.', why: (p.rung ? 'Ladder rung ' + p.rung + ' for "' + p.keyword + '"' : 'The page for "' + p.keyword + '"') + ' cannot rank until Google indexes it (' + (p.coverage || p.verdict || 'not indexed') + ').', keyword: p.keyword, url: p.url });
  // D11: a page written for a keyword a LIVE page already answers must not go up as a second page — it is folded into the page that exists
  // R111 (2026-10-16): a draft whose last quality round failed gets `fix_draft` — the reasons, and the body that writes it again —
  // never `publish` (exec 634 put "P1 Publish the written page for \"ai consulting\"" on top with an "I published it" button)
  const fixed = new Set();
  const fixDraft = (keyword, url, reasons, page_type) => { const k = kwKey(keyword); if (!k || fixed.has(k)) return; fixed.add(k);
    actions.push({ priority: 1, type: 'fix_draft', keyword, url: url || '', reasons: (reasons || []).slice(0, 6),
      action: 'Fix the draft for "' + keyword + '" and run it again — it did not pass the quality check' + ((reasons || []).length ? ' (' + reasons.slice(0, 2).join('; ').slice(0, 300) + ')' : '') + '. Do not publish it as it is.',
      why: 'The last quality round found what is listed; a page that fails it is a draft to finish, not a page to put live.', api_body: pageBody(keyword, '', page_type || 'Service Page') }); };
  for (const p of pages.filter(p => ['writing', 'written', 'not_ready'].includes(p.ladder_status || p.status) && p.not_ready && !p.written && !p.covered_by).slice(0, 3)) fixDraft(p.keyword, p.url, p.qa_reasons, '');
  // C-7 (re-rating 2026-10-17): the same page state the Rank Tracker reads (SM.pageStep) - a failed draft for a search a LIVE page of the
  // site already answers is not "fix it and run it again" (exec 787 said so of "ai consulting" while the Rank Tracker said "…/ai-copilot-
  // advisory-uae already answers this search - refresh that page"): the draft is retired and the live page refreshed
  for (const f of (s.needs_fix || []).filter(f => !found.some(x => kwKey(x.keyword) === kwKey(f.keyword))).slice(0, 3)) {
    const c = covered(f.keyword, ''); const st = SM.pageStep({ keyword: f.keyword, covered_url: c ? c.url : '', not_ready: true, reasons: f.reasons });
    if (st.state === 'covered') { if (fixed.has(kwKey(f.keyword))) continue; fixed.add(kwKey(f.keyword));
      actions.push({ priority: 1, type: 'refresh_existing', keyword: f.keyword, url: c.url, action: 'Do not fix or publish the draft for "' + f.keyword + '": ' + st.text + '.',
        why: 'Two pages for one search split the signals and neither ranks; the live page was found by ' + (c.matched_by === 'query' ? 'Search Console' : 'its address and title') + '.', api_body: pageBody(f.keyword, c.url, 'Guide') }); }
    else fixDraft(f.keyword, '', f.reasons, f.page_type); }
  for (const p of pages.filter(p => ['writing', 'written', 'not_ready'].includes(p.ladder_status || p.status) && p.written && (p.covered_by || !p.page_exists)).slice(0, 3)) { const c = p.covered_by ? { url: p.covered_by, matched_by: p.covered_match || 'slug' } : covered(p.keyword, p.url);   // R1: only a page the content log says was written
    if (c) actions.push({ priority: 1, type: 'refresh_existing', action: 'Do not publish the new page for "' + p.keyword + '" as a second URL: ' + c.url + ' already answers this search. Use the new text to refresh that page instead.', why: 'Two pages for one search split the signals and neither ranks (the live page was found ' + (c.matched_by === 'query' ? 'in Search Console with ' + c.impressions + ' impressions for this query' : 'in the site\'s page list') + ').', keyword: p.keyword, url: c.url });
    else actions.push({ priority: 1, type: 'publish', action: 'Publish the written page for "' + p.keyword + '" (planned URL ' + p.url + ') and report the link with "I published a page".', why: 'It is written but not live yet; nothing can be indexed or ranked before it is published.', keyword: p.keyword, url: p.url }); }
  // R59: the host split, as one piece of work — the sitemap Google reads and the internal links, never "request indexing" page by page
  if (hostSplit) actions.push({ priority: 2, type: 'host_split', keyword: '', url: SM.siteUrl(model, '/'),
    action: 'Make Google use ' + hostSplit.site_home + ': submit the sitemap on ' + hostSplit.site_home + ' in Search Console (in place of one on ' + hostSplit.google_home + '), change the internal links that still point at ' + hostSplit.google_home + ', keep the redirects, and watch these pages move over.',
    why: hostSplit.pages.length + ' inspected page(s) are shown by Google under ' + hostSplit.google_home + ' (its chosen canonical), e.g. ' + hostSplit.pages[0].google_canonical + '.' });
  for (const q of ((gsc && gsc.striking) || []).filter(q => !isGoneUrl(q.page)).slice(0, 3)) actions.push({ priority: 2, type: 'striking', action: 'Push "' + q.query + '" from #' + r1(q.position) + ' into the top 3: expand ' + (q.page || 'the ranking page') + ' with the missing sub-topics, add an FAQ and 2-3 internal links to it.', why: q.impressions + ' impressions in 28 days at position ' + r1(q.position) + ' (' + q.clicks + ' clicks); a top-3 spot typically triples the clicks.', keyword: q.query, url: q.page || '', api_body: pageBody(q.query, q.page, 'Service Page') });
  for (const q of ((gsc && gsc.ctr_gaps) || []).filter(q => !isGoneUrl(q.page)).slice(0, 2)) actions.push({ priority: 2, type: 'ctr', action: 'Rewrite the title and meta description of ' + (q.page || 'the ranking page') + ' for "' + q.query + '" (lead with the outcome and a number).', why: 'Position ' + r1(q.position) + ' with ' + q.impressions + ' impressions but CTR ' + (q.ctr * 100).toFixed(1) + '% vs about ' + Math.round(q.expected_ctr * 100) + '% expected.', keyword: q.query, url: q.page || '' });
  // B4-1 / B4-3 (2026-10-15, benchmark area 4): a decaying page is a TESTED, SEASONALLY CHECKED judgement, it is ranked by the
  // clicks actually lost, it says which KIND of fall it is (the work differs), and — unlike before — it ships the body that
  // writes the refresh, so the owner can act on it the way they can act on a striking-distance query.
  for (const p of ((gsc && gsc.decaying_pages) || []).filter(p => !isGoneUrl(p.page)).slice(0, 2)) { const q = topQueryOf(p.page);
    actions.push({ priority: 2, type: 'decay',
      action: p.kind === 'clickthrough'
        ? 'Rewrite the title and description of ' + p.page + ' first: it is still shown as often, and fewer people click it. Refresh the page itself only if that does not bring the clicks back.'
        : 'Refresh ' + p.page + ': update the facts and the date, add what the top results cover now, and re-promote it.',
      why: p.lost + ' clicks lost in 28 days (' + p.prev_clicks + ' → ' + p.clicks + ', ' + p.pct + '%). ' + p.basis,
      keyword: q ? q.query : '', url: p.page, ...(q ? { api_body: pageBody(q.query, p.page, 'Guide') } : {}) }); }
  // what the old 25% rule would have called decay, and the evidence says is not: reported, never acted on
  for (const p of ((gsc && gsc.not_decay) || []).filter(p => !isGoneUrl(p.page)).slice(0, 2)) actions.push({ priority: 4, type: 'decay_watch',
    action: p.state === 'seasonal' ? 'Leave ' + p.page + ' alone for now: it is down on the last 28 days but not on the same weeks a year ago.' : 'Watch ' + p.page + ': the fall is large but could still be chance at this traffic.',
    why: p.basis, keyword: '', url: p.page });
  for (const t of trends.filter(t => t.direction === 'rising' && (t.rising || []).length).slice(0, 1)) actions.push({ priority: 3, type: 'trend', action: 'Interest in "' + t.keyword + '" is rising (' + (t.change_pct > 0 ? '+' : '') + t.change_pct + '% vs the 12-month average); cover the rising searches: ' + t.rising.slice(0, 3).map(r => r.query).join(', ') + '.', why: 'Google Trends, past 12 months.', keyword: t.rising[0].query, url: '', api_body: { mode: 'verdict', keyword: t.rising[0].query, ...apiBase } });
  for (const t of trends.filter(t => t.direction === 'falling').slice(0, 1)) actions.push({ priority: 4, type: 'trend', action: 'Interest in "' + t.keyword + '" is falling (' + t.change_pct + '% vs the 12-month average)' + (t.peak_date ? '; it peaked around ' + String(t.peak_date).slice(0, 7) : '') + '. Keep the page current but do not over-invest; watch the related rising searches.', why: 'Google Trends, past 12 months.', keyword: t.keyword, url: '' });
  if (!ga4) actions.push({ priority: 4, type: 'connect_ga4', action: 'Add the same service account as a Viewer of the GA4 property (Admin → Property access management), or register the site with its GA4 property ID.', why: 'Connects search visibility to visits and key events (conversions).', keyword: '', url: '' });
  // B7-3 (2026-10-15, benchmark area 7): two of the site's own pages shown for one search, measured by Google. Never "publish
  // another page" — the opposite of D11, and the same rule: one search, one page.
  // RV-1 / RV-15 (2026-10-21): a gone page competes for nothing (it is in the redirect action), and the count says how many pages it is
  for (const c of cannibalLive.slice(0, 2)) { const n = c.pages.length;
    actions.push({ priority: 2, type: 'cannibalisation',
      action: (n === 2 ? 'Two of your pages compete for "' : n + ' of your pages compete for "') + c.query + '": ' + c.pages.map(p => p.page).slice(0, 4).join(', ')
        + '. Decide which one answers this search, point ' + (n === 2 ? 'the other one' : 'the others') + ' at it with a link (or merge them into it and redirect), and give ' + (n === 2 ? 'the second page' : 'each of the others') + ' its own search.',
      why: c.basis + (c.split && !isGoneUrl(c.preferred) && !isGoneUrl((c.best || {}).page) ? ' Google shows ' + c.preferred + ' most often, but ' + c.best.page + ' ranks better when it is shown, so the two are splitting the signals for this search.' : ''),
      keyword: c.query, url: isGoneUrl(c.preferred) ? c.pages[0].page : c.preferred }); }
  actions.sort((a, b) => a.priority - b.priority); const acts = actions.slice(0, 12);   // the brief picks the top 5-6; the full list stays in the callback
  // ---- rows for the Data Tables ----
  const T = gsc ? gsc.totals : null; const G = ga4;
  const prevRuns = metricsHist.filter(m => m.site_id === s.site_id).sort((a, b) => String(a.period_end).localeCompare(String(b.period_end))).slice(-12).map(m => ({ period_end: m.period_end, clicks: Number(m.clicks) || 0, impressions: Number(m.impressions) || 0, position: r1(m.position), sessions: Number(m.sessions) || 0 }));
  // ---- G12 (2026-10-13): the events of the two periods this report compares, marked on every chart ----
  const myLogs = logRowsAll.filter(r => r.site_id === s.site_id || normD(r.domain) === s.domain);
  const publishedLogs = myLogs.filter(r => String(r.published_at || '').slice(0, 10));
  const loggedKw = new Set(publishedLogs.map(r => kwKey(r.keyword)));
  const annotations = AN.marks({ from: R.previous.start, to: R.current.end,
    published: [...publishedLogs.map(r => ({ published_at: r.published_at, keyword: r.keyword, published_url: r.published_url, source: r.source })),
      ...found.filter(f => !loggedKw.has(kwKey(f.keyword))).map(f => ({ published_at: (det && det.checked_at) || now, keyword: f.keyword, published_url: f.url, source: f.ladder_id ? 'ladder' : 'detected' }))],
    notes: s.owner_notes || [],   // B7-7: the owner's dated notes
    // R20 (2026-10-14): the report type travels with every audit row, so a full SEO report between two technical audits is marked as a
    // report of another kind instead of chaining its health score to theirs (three invented moves in one day, live on 2026-10-11)
    audits: auditRowsAll.filter(r => r.site_id === s.site_id || normD(r.domain) === s.domain)
      .map(r => ({ audited_at: r.audited_at, report_type: r.report_type || 'site_audit', health_score: r.health_score, findings: r.findings })) });
  const data_breaks = AN.breakBetween(R.previous.start, R.current.end);
  // ---- B7-6 (W3-D, 2026-10-17): BRAND IN ONE PLACE. Branded Search Console clicks, GA4 direct sessions and AI-assistant referral sessions as
  // one series set, each line with its own source and basis (SEOTesting's Brand Signals draws the same three on one chart). The lines
  // are NOT added together: they count different things (searches for the name, visits typed or untracked, visits from AI answers).
  const brand_series = (() => {
    const opts = { min_events: Number(cfg.alert_min_click_events) || 40, min_pct: Number(cfg.alert_min_pct) || 10 };
    const line = (key, label, source, cur, prev, basis, unit) => ({ key, label, source, unit, read: true, cur, prev, change: ST.change(cur, prev, opts), basis });
    const miss = (key, label, source, reason) => ({ key, label, source, read: false, reason });
    const L = [];
    const bs = gsc && gsc.brand_split;
    L.push(bs && bs.names && bs.names.length ? line('gsc_brand', 'Branded Search Console clicks', 'Search Console', bs.brand.clicks, bs.previous.brand.clicks, 'clicks on searches containing ' + bs.names.slice(0, 4).join(' / ') + '; searches Google withholds are not counted', 'clicks')
      : miss('gsc_brand', 'Branded Search Console clicks', 'Search Console', gsc ? 'no brand name is known for this site, so branded searches cannot be told apart' : 'Search Console is not connected'));
    L.push(ga4 && ga4.direct ? line('ga4_direct', 'GA4 direct sessions', 'Google Analytics 4', ga4.direct.cur.sessions, ga4.direct.prev.sessions, "sessions in GA4's Direct channel: people who typed the address or came from a source GA4 could not name, so it is an upper bound on brand demand", 'sessions')
      : miss('ga4_direct', 'GA4 direct sessions', 'Google Analytics 4', 'Google Analytics is not connected'));
    L.push(ga4 && ga4.ai_referrals ? line('ga4_ai', 'AI-assistant referral sessions', 'Google Analytics 4', ga4.ai_referrals.cur.sessions, ga4.ai_referrals.prev.sessions, 'sessions whose source is an AI assistant (ChatGPT, Perplexity, Gemini, Copilot, Claude and others) or GA4 medium ai-assistant', 'sessions')
      : miss('ga4_ai', 'AI-assistant referral sessions', 'Google Analytics 4', ga4 ? 'Google Analytics did not answer the AI-referral request' : 'Google Analytics is not connected'));
    return { period: 'the last 28 days against the 28 days before', lines: L, note: 'Three measurements of how much people look for the brand, each from its own source. They are shown side by side and never added together.' };
  })();
  // ---- B7-1 (2026-10-15, benchmark area 7 — docs/system-review-2026-10-14/BENCH_AREA7_site_tracking.md): DID THE CHANGE WORK? ----
  // Since G12 this node has inlined the change-test kit (CT) and shipped its METHOD SENTENCE in every weekly callback
  // (`change_method`) while running no test at all: CT.compare was called by the Link Builder and by nobody else. A published
  // method with no measurement behind it is INVARIANTS rule 4 in the one place the rubric scores impact measurement (criterion 3.4,
  // "control group or counterfactual", capped at 3 for links only). This runs it. Each change has its own two windows, bought by
  // GSC Requests: the clicks are read with ST.lift (rate ratio, 95% range, the control group's own noise inside it) and the
  // position with CT.compare (the Link Builder's comparison, "too early" under 6 weeks). Either can refuse without silencing the
  // other, and a change too new to read keeps its row with the date it can first be read — never a quiet absence.
  const change_tests = (() => {
    const method = ST.liftMethod + ' ' + CT.method;
    const planned = (s.changes || []);
    const rows = ((gsc && gsc.change_tests) || []).map(t => {
      const upd = t.window_before && t.window_after ? ST.updatesIn({ start: t.window_before.start, end: t.window_after.end }) : [];
      const brk = t.window_before && t.window_after ? AN.breakBetween(t.window_before.start, t.window_after.end) : [];
      const common = { url: t.url, date: t.date, what: t.what, keyword: t.keyword, joint: !!t.joint,
        window: t.window_before && t.window_after ? (t.window_before.start + ' to ' + t.window_before.end + ' vs ' + t.window_after.start + ' to ' + t.window_after.end) : '',
        google_updates: upd.map(u => u.name + ' (' + u.start + ' to ' + u.end + ')'), data_breaks: brk.map(b => b.name) };
      if (!t.read || !t.page || !t.control) return { ...common, read: false, state: 'unavailable', verdict: 'Not measured', basis: t.reason || 'this change was not measured this week' };
      const lift = ST.lift({ clicks: t.page.clicks, prev_clicks: t.page.prev_clicks, control_clicks: t.control.clicks,
        control_prev_clicks: t.control.prev_clicks, control_pages: t.control.pages,
        period: 'the 28 days after the change against the 28 days before it' });
      const weeks = Math.floor(Math.max(0, Math.round((Date.parse(R.current.end + 'T00:00:00Z') - Date.parse(t.date + 'T00:00:00Z')) / 864e5)) / 7);
      const pos = CT.compare({ kind: 'page', weeks, joint: t.joint ? 1 : 0,
        base: t.page.prev_impressions ? t.page.prev_position : null, now: t.page.impressions ? t.page.position : null, others: t.control.moves || [] });
      return { ...common, read: true, state: lift.state, verdict: lift.verdict, clicks: t.page.clicks, prev_clicks: t.page.prev_clicks,
        expected: lift.expected, lift_pct: lift.lift_pct, ci: lift.ci, z: lift.z, control_pages: t.control.pages,
        position: pos.position, prev_position: pos.base_position, position_verdict: pos.verdict_label, position_effect: pos.effect, position_note: pos.note,
        basis: lift.basis + (upd.length ? ' A Google ' + upd.map(u => u.name).join(' and ') + ' ran inside these windows; it moved the control group too, which is what the control group is for.' : '')
          + (t.joint ? ' Another change to this page within 8 weeks, so the credit is shared.' : '') };
    });
    const pending = planned.filter(c => !c.readable).map(c => ({ url: c.url, date: c.date, what: c.what, keyword: c.keyword, read: false,
      state: 'too_early', verdict: 'Too early to tell', basis: 'Not measured yet: ' + c.not_yet + '.' }));
    const tested = rows.filter(r => r.read);
    return { method, tests: rows.concat(pending).slice(0, 12), measured: tested.length, planned: planned.length,
      helped: tested.filter(r => r.state === 'helped').length, hurt: tested.filter(r => r.state === 'hurt').length,
      no_difference: tested.filter(r => r.state === 'no_difference').length,
      refused: rows.filter(r => !r.read).length + pending.length,
      read: !!(gsc && s.gsc_connected),
      reason: !s.gsc_connected ? 'Search Console is not connected for this site, so no change can be measured.'
        : !planned.length ? 'No page of this site has a published date on record yet, so there is no dated change to measure. Report a page with "I published a page" and the next run reads it.'
        : !rows.length ? 'Every dated change is still too new to read: a change needs 28 complete days of final Search Console data after it.' : '' };
  })();
  // ---- G29 (2026-10-13): where every figure in this report came from, over what period, from how big a sample ----
  const lineage = [];
  const curRange = LN.range(R.current), prevRange = LN.range(R.previous);
  if (gsc) {
    lineage.push(LN.of('Clicks, impressions, CTR and average position', 'gsc', { period: curRange, basis: 'measured',
      sample: LN.sample(gsc.totals.cur.impressions, 'impressions across ' + (gsc.query_count || 0) + ' named queries'), note: 'compared with ' + prevRange }));
    if (gsc.totals.yoy) lineage.push(LN.of('Year-on-year clicks', 'gsc', { period: LN.range(R.yoy), sample: LN.sample(gsc.totals.yoy.impressions, 'impressions'), basis: 'measured' }));
    lineage.push(LN.of('Queries, quick wins, click-through gaps and page lists', 'gsc', { period: curRange, basis: 'measured',
      sample: LN.sample(gsc.rows_read, 'rows read') + ((gsc.truncated || []).length ? ' — Search Console held more rows than this run read (' + gsc.truncated.join(', ') + ')' : ''),
      note: 'the queries Google withholds are reported apart, never spread over the named ones' }));
    lineage.push(LN.of('Expected click-through rate for a position', 'model', { period: 'industry averages, not dated', sample: 'positions 1-10', basis: 'modelled',
      note: 'a published industry curve, not your own measured click-through rate' }));
    // B7-2: the device and country splits say what they are, and say when they are not there at all
    // B7-2: a split Google ANSWERED with nothing is a measured zero; only a request it did not answer has no source at all
    const splitLineage = (blk, figure, unit) => { if (!blk) return;
      lineage.push(blk.failed ? LN.unknown(figure, blk.reason || 'the ' + unit + ' split was not read this week')
        : LN.of(figure, 'gsc', { period: curRange, basis: 'measured',
          sample: LN.sample(blk.total || 0, 'clicks across ' + (blk.rows || []).length + ' ' + ((blk.rows || []).length === 1 ? unit : (unit === 'country' ? 'countries' : unit + 's'))),   // R92 part 3: never "countrys"
          ...(blk.read ? {} : { note: blk.reason }) })); };
    splitLineage(gsc.devices, 'Clicks by device', 'device');
    splitLineage(gsc.countries, 'Clicks by country', 'country');
    // B7-3: observed by Google, not inferred from a ranking check
    if ((gsc.cannibal || []).length) lineage.push(LN.of('Searches two of your pages compete for', 'gsc', { period: curRange, basis: 'measured',
      sample: LN.sample((gsc.cannibal_summary || {}).queries_checked || 0, 'non-brand searches checked'),
      note: 'both pages really were shown for that search; brand searches are left out' }));
    // B7-4 / B7-5 / B7-8 (W3-D)
    const stp = gsc.search_types || {};
    for (const [k, lab] of [['discover', 'Discover clicks'], ['google_news', 'Google News clicks']]) if (stp[k] && stp[k].has_data) lineage.push(LN.of(lab, 'gsc', { period: curRange, basis: 'measured', sample: LN.sample(stp[k].cur.clicks, 'clicks'), note: 'search type ' + (k === 'discover' ? 'discover' : 'googleNews') + ', separate from web search' }));
    const cgp = gsc.content_groups || {};
    if (cgp.configured) lineage.push(LN.of('Clicks by content group', 'gsc', { period: curRange, basis: 'measured', sample: LN.sample((cgp.groups || []).filter(g => g.valid).length, 'content groups'), note: 'a regular expression over page paths; a page can sit in more than one group' }));
    if (gsc.recent && gsc.recent.read) lineage.push(LN.of('Search clicks since the report window', 'gsc', { period: LN.asOf(now), basis: 'reported', sample: LN.sample(gsc.recent.days, 'days'), note: 'preliminary data (dataState all): still being collected and might change; not part of any tested figure' }));
  } else lineage.push(LN.unknown('Search clicks, impressions and positions', 'Search Console is not connected for this site, so this report carries no measured search data'));
  lineage.push(LN.of('Brand series (branded clicks, direct sessions, AI referral sessions)', 'ga4', { period: curRange, basis: 'measured', sample: LN.sample(brand_series.lines.filter(l => l.read).length, 'of 3 lines read'), note: 'three sources side by side, never added together' }));
  if (ga4) lineage.push(LN.of('Organic sessions, engaged sessions and key events', 'ga4', { period: curRange, basis: 'measured',
    sample: LN.sample(ga4.organic.cur.sessions, 'organic sessions of ' + (ga4.total && ga4.total.cur ? ga4.total.cur.sessions : 0) + ' from all channels'), note: 'property ' + ga4.ga4_property_id }));
  else lineage.push(LN.unknown('Visits, engagement and key events', 'Google Analytics is not connected for this site'));
  if (tracked.some(t => t.serp_position != null)) lineage.push(LN.of('Live Google check per tracked keyword', 'serp', { basis: 'one_sample',
    period: LN.asOf((tracked.find(t => t.serp_checked_at) || {}).serp_checked_at), sample: LN.sample(tracked.filter(t => t.serp_position != null).length, 'keywords, one results page each'),
    note: 'one country and one device, so it will differ from the Search Console average' }));
  if (pages.some(p => p.inspected)) lineage.push(LN.of('Index status of your pages', 'inspection', { basis: 'measured',
    period: LN.asOf(now), sample: LN.sample(pages.filter(p => p.inspected).length, 'pages inspected') }));
  if (trends.length) lineage.push(LN.of('Search interest', 'trends', { period: 'the last 12 months', basis: 'reported',
    sample: LN.sample(trends.length, 'keywords'), note: 'a relative index (100 = the peak of the period), not a count of searches' }));
  if (notices.length) lineage.push(LN.of('Search Console notices', 'gsc', { period: 'the last 35 days', sample: LN.sample(notices.length, 'notification e-mails'), basis: 'reported' }));
  if (ck) lineage.push(LN.of('Manual actions, security issues and site-wide index coverage', 'you', { period: 'check-in of ' + String(ck.month || ''), sample: 'one check-in', basis: 'reported',
    note: 'Google offers no API for these, so they come from your monthly check-in' }));
  // B7-1: the counts are measured, the expectation is modelled from the control group, and a change nobody could read says so
  if (change_tests.measured) lineage.push(LN.of('Whether a change helped, against the rest of the site', 'gsc', { basis: 'modelled',
    period: 'each change\'s own 28 days after against the 28 days before', sample: LN.sample(change_tests.measured, 'dated changes measured'),
    note: 'the clicks of both windows are measured; what the page "would have done" is modelled from the site\'s other pages' }));
  else if (change_tests.reason) lineage.push(LN.unknown('Whether a change helped, against the rest of the site', change_tests.reason));
  const metrics_row = { site_id: s.site_id, domain: s.domain, period_start: R.current.start, period_end: R.current.end, checked_at: now, gsc_connected: !!gsc, ga4_connected: !!ga4,
    clicks: T ? T.cur.clicks : 0, impressions: T ? T.cur.impressions : 0, ctr: T ? T.cur.ctr : 0, position: T ? T.cur.position : 0, prev_clicks: T ? T.prev.clicks : 0, prev_impressions: T ? T.prev.impressions : 0, prev_ctr: T ? T.prev.ctr : 0, prev_position: T ? T.prev.position : 0,
    yoy_clicks: T && T.yoy ? T.yoy.clicks : 0, yoy_impressions: T && T.yoy ? T.yoy.impressions : 0, sessions: G ? G.organic.cur.sessions : 0, engaged_sessions: G ? G.organic.cur.engaged : 0, key_events: G ? G.organic.cur.key_events : 0,
    prev_sessions: G ? G.organic.prev.sessions : 0, prev_engaged_sessions: G ? G.organic.prev.engaged : 0, prev_key_events: G ? G.organic.prev.key_events : 0, organic_share: G ? G.organic_share : 0, queries: gsc ? gsc.query_count : 0, striking: gsc ? gsc.striking.length : 0,
    alerts: alerts.filter(a => a.level === 'high' || a.level === 'medium').map(a => a.text).join(' | ').slice(0, 500) };
  const qrow = (q, trackedFlag, serpPos) => ({ site_id: s.site_id, domain: s.domain, period_end: R.current.end, checked_at: now, query: q.query, clicks: q.clicks || 0, impressions: q.impressions || 0, ctr: r1((q.ctr || 0) * 1000) / 1000, position: r1(q.position), prev_clicks: q.prev_clicks || 0, prev_impressions: q.prev_impressions || 0, prev_position: r1(q.prev_position), page: q.page || '', tracked: trackedFlag, serp_position: (serpPos == null) ? -1 : Number(serpPos) });
  const trackedSet = new Set(tracked.map(t => t.keyword));
  const query_rows = [...tracked.map(t => qrow({ query: t.keyword, clicks: t.clicks, impressions: t.impressions, ctr: t.impressions ? t.clicks / t.impressions : 0, position: t.gsc_position || 0, prev_clicks: t.prev_clicks, prev_position: t.gsc_prev_position || 0, page: t.page }, true, t.serp_position)),
    ...((gsc && gsc.queries) || []).filter(q => !trackedSet.has(q.query)).slice(0, 100).map(q => qrow(q, false, null))];
  const site_row = { ...SM.toRow(model), content_groups_json: s.content_groups_json || '', fact_answers_json: s.fact_answers_json || '', site_id: s.site_id, domain: s.domain, gsc_property: s.gsc_property || s.gsc_property_hint || '', ga4_property_id: ga4 ? String(ga4.ga4_property_id) : (s.ga4_property_id || ''), country: s.country || '', location_code: Number(s.location_code) || 0, language_code: s.language_code || 'en', email: s.email || '', callback_url: s.callback_url || '',
    keywords: (s.keywords || []).join(', '), status: s.status || 'active', source: s.source || 'form', created_at: s.created_at || now, last_run_at: now, last_status: (gsc ? 'gsc:ok' : 'gsc:off') + ' ' + (ga4 ? 'ga4:ok' : 'ga4:off') + (alerts.some(a => a.level === 'high') ? ' alerts' : ''), request_id: s.request_id || '' };
  // ---- G25: what Google thinks of the key pages, with what was not checked said out loud ----
  const mine = insp.filter(x => x.site_id === s.site_id || x.site_idx === idx);
  const askedIns = mine.filter(x => !x.skipped);
  const budget = (mine.find(x => x.budget) || {}).budget || null;
  const index_coverage = s.gsc_connected
    ? { ...PW.coverage(askedIns.map(x => ({ ok: !x.inspect_error, error: x.inspect_error || '', indexed: x.indexed, verdict: x.verdict, coverage: x.coverage, canonical_ok: x.canonical_ok, mobile_usable: x.mobile_usable, rich_results: x.rich_results, not_checked: x.not_checked || '' })),
        { not_checked: mine.filter(x => x.skipped).length, not_checked_reason: mine.filter(x => x.skipped).length ? 'the run\'s share of Google\'s daily quota was used up; they are inspected in the next run, oldest first' : '', quota_note: budget ? budget.note : '' }),
        connected: true, candidates: budget ? budget.candidates : askedIns.length, cap: budget ? budget.cap : null,
        pages: askedIns.filter(x => !x.inspect_error).slice(0, 50).map(x => ({ url: x.url, indexed: x.indexed, verdict: x.verdict, coverage: x.coverage, last_crawl: x.last_crawl, canonical_ok: x.canonical_ok, google_canonical: x.google_canonical, mobile_usable: x.mobile_usable, rich_results: x.rich_results, kind: x.kind })),
        not_checked_pages: mine.filter(x => x.skipped || x.inspect_error).slice(0, 25).map(x => ({ url: x.url, reason: x.not_checked || x.inspect_error || 'not checked' })) }
    : { connected: false, checked: 0, indexed: 0, not_indexed: 0, not_checked: 0, pages: [], not_checked_pages: [], text: 'Search Console is not connected, so Google\'s index view could not be read (not checked).' };
  // ---- G11: the daily key-page watch, as the weekly report sees it ----
  const wmine = watchRows.filter(r => r.site_id === s.site_id);
  const wcache = (() => { try { return JSON.parse(String((watchCacheRows.find(c => String(c.key) === 'watch:' + s.site_id) || {}).value || '') || 'null') || null; } catch (e) { return null; } })();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const watch = wmine.length || wcache
    ? { running: !!wcache, last_checked_at: wcache ? String(wcache.checked_at || '') : wmine.map(r => String(r.checked_at || '')).sort().slice(-1)[0] || '',
        pages_watched: wcache ? Number(wcache.pages_watched) || wmine.length : wmine.length, pages_not_checked: wcache ? Number(wcache.pages_not_checked) || 0 : 0,
        robots_hash: wcache ? String(wcache.robots_hash || '') : '', changed_this_week: wmine.filter(r => String(r.last_change_at || '') >= weekAgo).length,
        changes: wmine.filter(r => String(r.last_change_at || '') >= weekAgo).slice(0, 10).map(r => ({ url: r.url, changes: String(r.changes || ''), at: String(r.last_change_at || '') })),
        noindex: wmine.filter(r => r.noindex === true).map(r => r.url).slice(0, 10), broken: wmine.filter(r => Number(r.status) >= 400).map(r => r.url).slice(0, 10),
        cost_usd: 0 }
    : { running: false, pages_watched: 0, last_checked_at: '', changed_this_week: 0, changes: [], noindex: [], broken: [], pages_not_checked: 0, cost_usd: 0 };
  return { json: { site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '', period: R, checked_at: now, first_run: !!s.first_run, on_demand: !!s.on_demand, source: s.source, country: s.country || '',
    site: { canonical_host: model.canonical_host, home_url: SM.siteUrl(model, '/'), business_name: SM.name(model), name_source: model.name_source || '', services: SM.services(model).slice(0, 12), nav_pages: (model.nav_pages || []).slice(0, 8), nap: SM.nap(model), pages_known: SM.pages(model).length, model_updated_at: model.model_updated_at || '' },
    page_inventory: inv ? { pages: inv.total, with_queries: inv.with_queries, changed: inv.changed, by_source: inv.by_source, sitemap_read: inv.sitemap_read } : null,
    gsc: { connected: !!gsc, property: s.gsc_property || '', permission: s.gsc_permission || '', error: s.gsc_error || null, ...(gsc ? { totals: gsc.totals, deltas: gsc.deltas, daily: gsc.daily, query_count: gsc.query_count, page_count: gsc.page_count ?? null, anonymised: gsc.anonymised || null, brand_split: gsc.brand_split || null, scraper_queries: gsc.scraper_queries || null, other_site_queries: gsc.other_site_queries || null, rows_read: gsc.rows_read ?? null, paging: gsc.paging || [], truncated: gsc.truncated || [], winners: gsc.winners, losers: gsc.losers, new_queries: gsc.new_queries, lost_queries: gsc.lost_queries, striking: gsc.striking, ctr_gaps: gsc.ctr_gaps, top_pages: gsc.pages.slice(0, 10), decaying_pages: gsc.decaying_pages, not_decay: gsc.not_decay || [], decay_summary: gsc.decay_summary || null, rising_pages: gsc.rising_pages, errors: gsc.errors, cannibal: gsc.cannibal || [], cannibal_summary: gsc.cannibal_summary || null, devices: gsc.devices || null, countries: gsc.countries || null, search_types: gsc.search_types || null, recent: gsc.recent || null, content_groups: gsc.content_groups || null } : {}) },
    ga4: ga4 ? { connected: true, property_id: ga4.ga4_property_id, detected: ga4.ga4_detected, property_name: ga4.ga4_property_name, organic: ga4.organic, total: ga4.total, organic_share: ga4.organic_share, channels: ga4.channels, landing: ga4.landing, daily: ga4.daily, errors: ga4.errors } : { connected: false, error: acctErr || ga4Reason || 'no property id given or detected' },
    console: { notices, last_checkin: ck, checkin_due: !!s.checkin_due },
    significance: stat,   // G28: the Poisson z-test behind every traffic alert (clicks / impressions / sessions)
    index_coverage,       // G25: Google's own view of every key page (URL Inspection within the 2,000-a-day quota, oldest first)
    page_watch: watch,    // G11: the daily key-page watch — what it checks, what changed this week, what it could not read
    annotations, annotation_note: AN.OWN_NOTES_LINE, brand_series, data_breaks, lineage,   // G12 / G29: the events of the period for every chart, and where each figure came from
    // B7-1 (2026-10-15, benchmark area 7): the method sentence used to travel alone — the Site Tracker shipped it and ran no test.
    change_method: change_tests.method, change_tests,
    cannibal: cannibalLive, cannibal_summary: (gsc && gsc.cannibal_summary) || null,   // B7-3; RV-1: without the pages that no longer answer
    gone_pages, page_status: inv ? (inv.status_check || null) : null,   // RV-1: the old addresses that answer 404 / 410 and the page each should redirect to
    devices: (gsc && gsc.devices) || { read: false, rows: [], reason: 'Search Console is not connected for this site' },   // B7-2
    countries: (gsc && gsc.countries) || { read: false, rows: [], reason: 'Search Console is not connected for this site' },
    // B-G3 (2026-10-15): the rungs the read-path fit gate set aside, with the reason, so the report can say why the list is shorter
    set_aside: s.set_aside || [], set_aside_note: s.set_aside_note || '',
    tracked, ladder_pages: pages, pending_publish: (s.pending_publish || []).filter(p => !found.some(f => kwKey(f.keyword) === kwKey(p.keyword))),
    needs_fix: (s.needs_fix || []).filter(p => !found.some(f => kwKey(f.keyword) === kwKey(p.keyword)) && !covered(p.keyword, '')),   // C-7: a draft a live page makes unnecessary is retired, not fixed
    drafts_retired: (s.needs_fix || []).filter(p => !found.some(f => kwKey(f.keyword) === kwKey(p.keyword)) && covered(p.keyword, '')).map(p => ({ keyword: p.keyword, live_url: covered(p.keyword, '').url })),   // R111 drafts that failed their last quality round; R59 host_split below: pages Google keeps under the other host
    host_split: hostSplit, ladder_heads: s.ladder_heads || [], trends, alerts, actions: acts, prev_runs: prevRuns, weeks_tracked: prevRuns.length + 1, service_account_email: cfg.service_account_email || '', form_url: FORM_URL, api_url: API_URL,
    detected_published: found.map(f => ({ keyword: f.keyword, url: f.url, ladder_id: f.ladder_id || '', matched_by: f.matched_by, source: f.source })),
    publish_detection: det ? { checked: true, candidates: det.candidates, sitemap_ok: !!(det.sitemap || {}).ok, sitemap_urls: (det.sitemap || {}).urls || 0, sitemap_error: (det.sitemap || {}).error || '', pages_fetched: det.pages_fetched || 0, found: found.length,
      still_waiting: (det.unmatched || []).length, recorded: found.length ? !detErrors.length : null, error: found.length && detErrors.length ? detErrors.slice(0, 3).join('; ').slice(0, 300) : '' } : { checked: false, candidates: 0, found: 0, reason: detFail ? 'detection failed: ' + detFail.slice(0, 200) : 'no written page waiting for publication' },
    metrics_row, query_rows, site_row } };
});
