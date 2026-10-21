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
    titleShare, titleGap, canonUrl, isListing, pageScore, pageStep, isGone, gonePages,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml, matchTerms, coreTerms } };
})();
// ---- claims kit (D14, 2026-10-11; inlined by build_monitors.py): statements about the business that only the owner can vouch for. With no
// facts on file the Reply Reader's suggested answer invented "we're not directly accredited by the Ministry, but we work with accredited
// providers" (live 2026-10-11). A sentence that claims an accreditation, certification, partnership, licence, registration, approval, award,
// membership, founding year, location, age, size, client count, percentage or price is kept only when the facts on file carry the same word
// stem (or the same number); otherwise it is wrapped in [Owner: confirm — …] and the answer needs the owner. One list for every draft
// (CL.CLAIM_RE; L2 reuses it for the outreach sequences). Regex only, no model.
const CL = (() => {
  const CLAIM_RE = /\b(?:accredit\w*|certif\w*|iso[ -]?\d{4,5}|partner\w*|authori[sz]ed|licen[cs]ed|registered|approved|award\w*|member(?:s|ship)? of|founded|since \d{4}|headquarter\w*|based in|offices? in|\d[\d,.]*\+? ?(?:years?|yrs|clients?|customers?|projects?|companies|countries|employees|staff|users|installations?|implementations?)|\d[\d,.]*\s?%|(?:aed|usd|eur|gbp|sar|inr|\$|€|£)\s?\d[\d,.]*|\d[\d,.]*\s?(?:aed|usd|eur|gbp|sar|dirhams?|dollars?)|pric(?:e|es|ed|ing)|fees?|free of charge|no charge|discount\w*)\b/gi;
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9%$€£]+/g, ' ').replace(/\s+/g, ' ').trim();
  // the piece of a claim that the facts must carry: its number, else the first word's stem (7 letters: "accredited" → "accredi", "authorised" / "authorized" → "authori")
  const keyOf = (m) => { const x = norm(m); const num = x.match(/\d[\d,.]*/); if (num) return num[0].replace(/[,.]+$/, '');
    const w = x.split(' ')[0]; const st = w.replace(/(ations?|ation|ings?|ed|es|s|ship|ships)$/, ''); return (st.length >= 5 ? st : w).slice(0, 7); };
  // L2 (2026-10-11): a claim is only ours when the sentence speaks about us -- "the date it was approved" on their own list says nothing
  // about our business. The outreach draft gate passes { ours: true, brand }, so a sentence about the prospect's page is left alone; the
  // Reply Reader checks every sentence (its whole answer is about us).
  const OURS_RE = /\b(we|we.?re|we.?ve|our|ours|us|i|i.?m|i.?ve|my)\b/i;
  // text: a draft; facts: what we know (any string); opts.skip: a string that is never a claim (the signature); opts.ours / opts.brand:
  // see above. Returns the text with every unsupported claim sentence wrapped and the list of what was wrapped.
  function check(text, facts, opts = {}) {
    const t = String(text || ''); if (!t.trim()) return { text: t, flags: [] };
    const F = norm(facts); const body = opts.skip ? t.split(String(opts.skip)).join(' ') : t;
    const flags = []; let out = t;
    for (const s0 of body.split(/(?<=[.!?])\s+|\n+/)) { const s = s0.trim(); if (s.length < 4 || /^\[[^\]]*\]$/.test(s)) continue;
      if (opts.ours && !(OURS_RE.test(s) || (opts.brand && s.toLowerCase().includes(String(opts.brand).toLowerCase())))) continue;
      let plain = s.replace(/\[[^\]]*\]/g, ' ').replace(/https?:\/\/\S+/g, ' ');   // a word in a URL is not a claim (our own slug says "accredited-service-providers")
      if (opts.ours) plain = plain.replace(/["\u201c\u201d][^"\u201c\u201d]{3,200}["\u201c\u201d]/g, ' ');   // L2: words inside quotation marks are THEIR words (a pitch quotes their page title), never our claim
      const bad = [...plain.matchAll(CLAIM_RE)].map(m => m[0]).filter(m => { const k = keyOf(m); return k && !F.includes(k); });
      if (!bad.length) continue;
      flags.push({ claim: bad[0], sentence: s.slice(0, 200) });
      if (out.includes(s)) out = out.replace(s, '[Owner: confirm — ' + s + ']'); }
    return { text: out, flags };
  }
  // ---- A-15 (2026-10-17, re-rating 2026-10-17): what a written PAGE says about the business's own terms and scope ----
  // Live (exec 771, business facts and profile empty) the page told buyers "We charge for advice and delivery. Licences sit on a separate
  // line of the quote, you can buy them through any channel …", "Some can, but Tech& does not [manage a complete office IT setup]" and
  // "Tech& does not handle company formation" — none of it on any of the site's 33 pages, and the quality check listed none of it.
  // CL.business(text, corpus, opts) reads every sentence that speaks about the business (we / our / us, or one of its names in
  // opts.names) and holds three kinds of statement against `corpus` (the business facts, the profile, the site model and the site's own
  // pages this run read):
  //   * its commercial terms — what it charges, quotes, bills, licenses, guarantees, refunds, discounts, how it contracts or resells;
  //   * its scope — what it does NOT do, NEVER or ONLY does ("Tech& does not handle company formation");
  //   * its credentials — accreditation, certification, partnership, awards, founding year, a count of years / clients / staff.
  // A statement is supported when ONE sentence of the corpus carries its trigger (the same number, the trigger's stem; for a scope
  // statement, a negation) and at least half of its own content words. Anything else is returned as unsupported, with the sentence; the
  // caller marks it [Confirm: …] for the owner. Sentences already holding a bracket are left alone (a note is never nested).
  // The subject must be the business: "we …", "<name> …", "our <team / prices / quotes …>" — "configuration does not meet your needs" and
  // "you can act on it with another partner" say nothing about it. Questions (a buyer's checklist) are never claims.
  const BIZ_TERMS = /\b(?:charg(?:e|es|ed|ing)|quot(?:e|es|ed|ing)|bill(?:s|ed|ing)?|invoice (?:you|clients|customers)|pricing|priced|fixed[- ]price|flat[- ](?:fee|rate)|fees?|retainers?|contracts?|lock[- ]?in|refund\w*|money[- ]back|guarantee[sd]?|warrant(?:y|ies)|discount\w*|commissions?|mark-?ups?|resell(?:er|ers|s|ing)?|sells?|payment terms|free of charge|at no (?:extra )?cost|no (?:hidden )?(?:fees|charges|costs))\b/i;
  const BIZ_CRED = /\b(?:accredit\w*|certified|certifications?|iso[ -]?\d{4,5}|(?:gold|silver|solutions|certified|official|premier|authori[sz]ed|preferred|cloud solution) partner(?:s|ship)?|partner of the year|award\w*|member(?:s|ship)? of|founded|since (?:19|20)\d\d|headquarter\w*|offices? in|\d[\d,.]*\+? ?(?:years?|yrs|clients?|customers?|projects?|employees|staff|consultants|engineers|implementations?))\b/i;
  const BIZ_ADVICE = /\b(?:do|does|did|will|would|can|could)(?:\s+not|n['’]t)\s+(?:need|have to|recommend|suggest|advise|expect|know|mean|matter|depend|apply|require you|replace|guarantee you)\b/i;   // advice to the reader, not a statement of our scope
  const OURS_PAGE = /\b(?:[Ww]e|[Ww]e['’](?:re|ve|ll|d)|[Oo]ur|[Oo]urs|us)\b/;
  const escR = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const STOPW = new Set('the a an and or of for to in on with by at from as is are was were be been it its this that these those you your they them their there here can could will would should may might must do does did not no never only also just than then so such some any all each other more most very into over under about through which who whom what when where why how our we us ours has have had'.split(' '));
  const stem = (w) => { let x = String(w).toLowerCase().replace(/licens/g, 'licenc'); if (x.length > 5) x = x.replace(/(?:ations?|ings?|ies|ed|es|s)$/, ''); else if (x.length > 3) x = x.replace(/s$/, ''); return x; };
  const words = (s, drop) => norm(s).split(' ').filter(w => w.length > 2 && !STOPW.has(w) && !(drop || []).includes(w)).map(stem);
  function business(text, corpus, opts = {}) {
    const t = String(text || ''); const out = { flags: [], checked: 0 };
    if (!t.trim()) return out;
    const names = (opts.names || []).map(n => String(n || '').trim()).filter(n => n.length >= 3);
    const nameWords = [...new Set(names.flatMap(n => norm(n).split(' ')).filter(Boolean))];
    const SUBJ = '(?:\\b[Ww]e|\\b[Oo]ur (?:team|consultants|engineers|people|firm|company|prices|fees|quotes|contracts|recommendations)' + names.map(n => '|' + (/^\w/.test(n) ? '\\b' : '') + escR(n)).join('') + ')';
    const SCOPE = new RegExp(SUBJ + '\\s+(?:(?:do|does|did|will|would|can|could)(?:\\s+not|n[\'’]t)\\b|(?:never|only)\\b)|(?:\\b[Ww]e[\'’]re|\\b[Ww]e are' + names.map(n => '|' + escR(n) + ' is').join('') + ')\\s+not\\s+an?\\b');
    const SUBJ_RE = new RegExp(SUBJ);
    const NEG_ANY = /\b(?:do|does|did|will|would|can|could)(?:\s+not|n['’]t)\b|\b(?:never|only)\b|\bnot an?\b/i;
    const cs = String(corpus || '').split(/(?<=[.!?])\s+|\n+/).map(s => ({ n: norm(s), w: new Set(words(s, nameWords)), neg: NEG_ANY.test(s) })).filter(x => x.n.length > 3);
    const lines = t.split('\n'); let prevLine = '';
    for (const line of lines) {
      const L = line.trim();
      if (!L || /^#{1,6}\s/.test(L) || /^\|/.test(L) || /^(?:Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):/i.test(L)) { if (L) prevLine = L.replace(/^#+\s*/, ''); continue; }
      const sents = L.replace(/\*\*/g, '').split(/(?<=[.!?])\s+(?=[A-Z"“(])/);
      for (let i = 0; i < sents.length; i++) {
        const s = sents[i].trim().replace(/^[-*]\s+/, '');
        if (s.length < 6 || /\?\s*$/.test(s) || /[\[\]]/.test(s.replace(/\[[^\[\]]*\]\([^)]*\)/g, ''))) continue;
        const plain = s.replace(/\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '');
        if (!(OURS_PAGE.test(plain) || SUBJ_RE.test(plain))) continue;
        let kind = null, trig = null, m;
        if ((m = plain.match(SCOPE)) && !BIZ_ADVICE.test(plain) && !/\b(?:what|whether|if)\s+$/i.test(plain.slice(0, m.index))) { kind = 'scope'; trig = m[0]; }
        else if (SUBJ_RE.test(plain) && (m = plain.match(BIZ_TERMS))) { kind = 'terms'; trig = m[0]; }
        else if (SUBJ_RE.test(plain) && (m = plain.match(BIZ_CRED)) && !(/^member/i.test(m[0]) && names.some(n => plain.slice(m.index + m[0].length).trim().toLowerCase().startsWith(n.toLowerCase())))) { kind = 'credential'; trig = m[0]; }   // CT-FIX: "membership of <the business>" is joining it, not a credential it holds
        if (!kind) continue;
        out.checked++;
        // an elliptical sentence ("Some can, but Tech& does not.") is read with the sentence or heading before it
        let W = words(plain, nameWords);
        if (W.length < 2) W = [...new Set(W.concat(words(i > 0 ? sents[i - 1] : prevLine, nameWords)))];
        const key = kind === 'credential' ? keyOf(trig) : stem((norm(trig).split(' ').filter(w => !STOPW.has(w) && !nameWords.includes(w))[0]) || norm(trig));
        const supported = cs.some(c => {
          if (kind === 'scope' ? !c.neg : !(key && c.n.includes(key))) return false;
          if (kind === 'credential' && /\d/.test(key)) return true;   // the same number on the site's own pages: "20+ Years"
          const hit = W.filter(w => c.w.has(w)).length; return W.length ? hit / W.length >= 0.5 : false;
        });
        if (!supported) out.flags.push({ kind, trigger: trig, sentence: s });   // CT-FIX: the whole sentence (Content QA finds and wraps it); a display cut is the reader's
      }
      prevLine = L;
    }
    return out;
  }
  // ---- E-CLAIM (2026-10-21, pre-launch run exec 42): what a page PROMISES in the business's name must be on file ----
  // Live (exec 42, techand.ai "ai consultant") the page promised "You receive a prioritised use-case backlog, data readiness findings and
  // an ROI case", "We test a proof of concept ... documented test results", "You receive a runbook and monitoring dashboards", a training
  // plan and "a self-study pack", "document each decision for your audit team" and "we stop there". The client states none of it.
  // CT-FIX (2026-10-22, labelled set harness/accuracy/claims.json): the first version listed commitment VERBS, so it missed every promise
  // phrased another way ("we have delivered 150 projects", "our fixed fee starts at USD 15,000", "training is included at no extra cost",
  // a verb-less deliverable under "What you get", every Arabic sentence) and flagged a page's own call to action and a guide's narration.
  // It now decides by SUBJECT, not by verb. A sentence is a commitment of the business when:
  //   * the business is its grammatical subject: "we / we'll / we're / we have", a sentence that opens with "our <anything>", the
  //     business's name in the first words ("Every Azdan implementation takes ...", "As a Microsoft partner, Tech& implements ..."), the
  //     name followed by a verb anywhere, or "with us / from us / by <name>";
  //   * in a section about the business (its H2 group names it, speaks as we / our in a subject, or is headed by a phase on file): an offer
  //     to the reader ("you will receive / your team gets ..."), a passive line ("is delivered / are included / are part of the service"),
  //     a cost or duration line ("Membership costs EUR 2,500"), a phase or training line;
  //   * a list item under a business lead-in ("Our engagement includes:", or a heading such as "What you get from Tech&"): each item
  //     inherits the lead-in, verb or not. Table rows, headings and the meta description are read the same way (subject rules only).
  // Never a commitment: a question; the page's call to action (an imperative in the closing / CTA section, "<imperative> and we will
  // ...", "our team will reply ..."), unless it names a price, quote, fee or guarantee; guide narration ("in this guide we cover ...",
  // "below we map ..."); words inside quotation marks; a worked example ("say we start with ..."); a sentence whose agent is a named third
  // party ("you receive a TRN from the FTA"); "we" inside a relative clause ("most distributors we work with ...").
  // Support: one corpus sentence (or two adjacent ones: a fact is often split over a line break) carries at least half of its content
  // words, every number it states is on file as a whole number (number words are digits, "two decades" = 20 years, "round-the-clock" =
  // 24/7), and every strong qualifier it uses (only, exclusive, platinum, gold, largest, leading, first ...) is on that same fact.
  // Arabic: normalised like the keyword gate (alef forms, ta marbuta, alef maqsura, diacritics, tatweel, Arabic-Indic digits); a sentence
  // in the first person plural ("نحن / نقدم / نضمن / لدينا / فريقنا ...") or an offer ("ستحصل") is a commitment; its business terms are
  // read through a small bilingual lexicon and held against the same facts with the same rule (fewer than two terms read = cannot be
  // checked = flagged for the owner).
  const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90, hundred: 100 };
  // the same meaning in the words a writer or a site uses: applied to the claim and to the facts before anything is compared
  // CT-FIX2 (live page 2026-10-22, D1): the long and the short name of a place are one name ("United Arab Emirates" = "UAE")
  const canon = (s) => String(s || '')
    .replace(/\bthe united arab emirates\b|\bunited arab emirates\b/gi, 'UAE').replace(/\bkingdom of saudi arabia\b|\bsaudi arabia\b/gi, 'KSA').replace(/\bgulf cooperation council\b/gi, 'GCC')
    .replace(/\b(?:a|one) decade\b/gi, '10 years').replace(/\b(two|three|four|five) decades\b/gi, (m, n) => (NUMW[n.toLowerCase()] * 10) + ' years')
    .replace(/\b(?:a|one) dozen\b/gi, '12').replace(/\b(?:around|round)[- ]the[- ]clock\b|\b24\s*x\s*7\b|\b24 hours a day,? 7 days a week\b|\b24 hours a day\b/gi, '24/7')
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|ninety|hundred)\b/gi, (m) => String(NUMW[m.toLowerCase()]))
    .replace(/(\d)\s*-\s*(day|week|month|year|hour|minute)s?\b/gi, '$1 $2s');
  // whole numbers only: "within 10 days" is not supported by "2010", "100" or "10x"; a single digit counts only with its unit ("8 weeks")
  const UNIT = '(?:days?|weeks?|months?|years?|hours?|minutes?|business days|working days)';
  const numsOf = (s) => {
    const t = canon(s); const out = [];
    for (const m of t.matchAll(/(?<![\w.,])(\d[\d,]*(?:\.\d+)?)(?![\w])/g)) { const n = m[1].replace(/,/g, '').replace(/\.0+$/, '');
      if (/^\d$/.test(n)) { const u = t.slice(m.index + m[0].length).match(new RegExp('^\\+?\\s+(?:to \\d+\\s+)?(' + UNIT + ')', 'i')); if (u) out.push(n + ' ' + stem(u[1].split(' ').pop())); }
      else out.push(n); }
    return out;
  };
  const STRONG = /\b(?:only|sole|exclusive\w*|platinum|gold|silver|diamond|elite|premier|largest|biggest|leading|first|#1|number one|best|official|award[- ]winning)\b/gi;
  const ARABIC = /[؀-ۿ]/;
  const arNorm = (s) => String(s || '').replace(/[ً-ْٰـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/٬/g, ',');
  // business terms in Arabic (normalised, without the article) -> the English word the facts use; phrases first
  const AR_LEX = [['على مدار الساعه', '24/7'], ['طوال ايام الاسبوع', '24/7'], ['المنطقه الحره', 'freezone'], ['دليل تشغيل', 'runbook'], ['لوحات متابعه', 'monitoring dashboards'],
    ['نموذج تجريبي', 'pilot'], ['النموذج التجريبي', 'pilot'], ['نت سويت', 'netsuite'], ['ذكاء اصطناعي', 'ai'], ['عامين', '2 years'], ['سنتين', '2 years'],
    ['دعم', 'support'], ['خبره', 'experience'], ['عام', 'years'], ['عاما', 'years'], ['اعوام', 'years'], ['سنه', 'years'], ['سنوات', 'years'], ['قطاع', 'industry'],
    ['مكتب', 'office'], ['مقر', 'based'], ['مطار', 'airport'], ['دبي', 'dubai'], ['امارات', 'uae'], ['خليج', 'gcc'], ['سعوديه', 'ksa'], ['مصر', 'egypt'], ['شريك', 'partner'],
    ['مايكروسوفت', 'microsoft'], ['اوراكل', 'oracle'], ['تنفيذ', 'implementation'], ['ضمان', 'guarantee'], ['نضمن', 'guarantee'], ['استرداد', 'refund'], ['اموال', 'money'],
    ['شهاده', 'certification'], ['معتمد', 'certified'], ['رسوم', 'fee'], ['تكلفه', 'cost'], ['سعر', 'price'], ['درهم', 'aed'], ['تقييم', 'assessment'], ['جاهزيه', 'readiness'],
    ['اطلاق', 'go-live'], ['تدريب', 'training'], ['اسبوع', 'weeks'], ['اسابيع', 'weeks'], ['شهر', 'months'], ['اشهر', 'months'], ['يوم', 'days'], ['ايام', 'days'], ['مجاني', 'free'],
    ['مجانا', 'free'], ['خصم', 'discount'], ['مستشار', 'consultant'], ['مستشارون', 'consultants'], ['عملاء', 'clients'], ['مشروع', 'project'], ['مشاريع', 'projects'], ['ترخيص', 'licence'],
    ['بيانات', 'data'], ['واحد', '1'], ['اثنان', '2'], ['ثلاثه', '3'], ['اربعه', '4'], ['خمسه', '5'], ['سته', '6'], ['سبعه', '7'], ['ثمانيه', '8'], ['تسعه', '9'], ['عشره', '10'], ['عشرين', '20']]
    .map(([a, e]) => [arNorm(a).split(' ').map(w => w.replace(/^ال(?=\S{3,})/, '')).join(' '), e]);
  const AR_WE = new Set(['نحن', 'لدينا', 'عندنا', 'نقدم', 'نوفر', 'نضمن', 'نلتزم', 'نتعهد', 'نعمل', 'نساعد', 'نبني', 'نصمم', 'ننفذ', 'نسلم', 'نتقاضى', 'نفرض', 'ندير', 'نخدم', 'نختبر', 'ندرب', 'نراجع', 'نرد', 'سنقوم', 'سنقدم', 'سنوفر', 'سنرسل', 'سنسلم'].map(arNorm));
  const AR_OFFER = new Set(['ستحصل', 'تحصل', 'ستتلقى', 'تتلقى', 'ستستلم'].map(arNorm));
  const AR_CTA = /^(?:احجز|تواصل|اتصل|اطلب|ابدا|سجل|راسلنا|ارسل|انضم|جرب|تحدث)/;
  const AR_NOT_OURS = new Set(['هنا', 'احيانا', 'لنا'].map(arNorm));
  const arTokens = (s) => arNorm(s).replace(/[^؀-ۿ0-9a-z%\s]/gi, ' ').split(/\s+/).filter(Boolean);
  const arStrip = (w) => w.replace(/^(?:وال|بال|لل|فال|كال|ال|و|ب|ل|ف)(?=\S{3,})/, '');
  const arOurs = (s) => { const T = arTokens(s); if (AR_CTA.test(T[0] || '')) return null;
    if (T.some(w => AR_WE.has(w) || AR_WE.has(arStrip(w)) || (w.length >= 5 && /نا$/.test(w) && !AR_NOT_OURS.has(w)))) return 'we';
    if (T.some(w => AR_OFFER.has(w))) return 'offer'; return null; };
  const arToEnglish = (s) => { let t = ' ' + arTokens(s).map(arStrip).join(' ') + ' '; const hits = [];
    for (const [a, e] of AR_LEX) { const re = new RegExp('(?:^|\\s)(?:ال)?' + a.replace(/\s+/g, '\\s+(?:ال)?') + '(?:نا|ها|كم|ك)?(?=\\s)', 'g'); if (re.test(t)) { hits.push(e); t = t.replace(re, ' '); } }
    const digits = (s.match(/\d[\d,]*/g) || []).concat((arNorm(s).match(/\d[\d,]*/g) || []));
    const lat = (String(s).match(/[A-Za-z][A-Za-z0-9&-]+/g) || []);
    return { text: [...new Set(digits)].join(' ') + ' ' + lat.join(' ') + ' ' + hits.join(' '), terms: hits.length + lat.length };
  };
  const SAY_RE = /\b(?:says?|said|states?|stated|notes?|noted|told|according to|writes?|wrote|explains?|explained)\b/i;
  const NARR_OPEN = /^(?:in this (?:guide|article|post|page|section|piece|checklist)|in the (?:next|following) sections?|in the sections? below|below|above|here|next|throughout this (?:guide|article|page)|as we (?:saw|said|noted|explained|mentioned)|later in this (?:guide|article))\b/i;
  const NARR_VERB = /^(?:we|we['’]ll)\s+(?:will\s+)?(?:cover|explain|walk (?:you )?through|look at|outline|list|compare|answer|explore|discuss|break down|summari[sz]e|unpack|examine|describe|go through|show you)\s+(?:the|these|this|what|how|why|when|which|each|every|\d+|both|all)\b/i;
  const EXAMPLE_RE = /^(?:say|suppose|imagine|assume|picture|let['’]?s say|for (?:example|instance), (?:say|suppose|imagine|if))\b/i;
  const ADVICE_WE = /^(?:we|we['’]d)\s+(?:would\s+|always\s+|strongly\s+)?(?:recommend|suggest|advise|encourage|urge)\b/i;
  const CTA_START = /^(?:book|call|contact|talk|email|e-mail|schedule|get in touch|arrange|request|get a|get your|get started|share|send|ask|tell us|reach|start|join|sign up|try|download|visit|speak|let['’]s|fill in|message|claim|see how|find out|learn more|ready to|read|see|explore|discover|check out|browse|compare)\b/i;
  // CT-FIX2 (live page 2026-10-22, D2): "To test one use case first, [book a discovery call]" is an invitation behind a purpose clause
  const PURPOSE_LEAD = /^(?:to|if you (?:want|need|would like) to|when you are ready to|for)\s+[^,]{3,80},\s+/i;
  const CTA_HEAD = /\b(?:next steps?|get started|getting started with us|contact|talk to|book|ready to|let['’]s talk|work with us|request|speak to|get in touch|start (?:your|a|with))\b/i;
  const CTA_FOLLOW = /\b(?:reply|replies|respond|responds|get back to you|call you back|be in touch|contact you|review (?:it|them|your|the details)|send (?:you )?(?:a |the )?(?:written )?(?:plan|proposal|summary|recommendation|outline|next steps)|prepare a (?:fixed-scope |short )?(?:proposal|plan)|set up a call|arrange a call)\b/i;
  const CTA_TERMS = /\b(?:quotes?|quoted|price[sd]?|pricing|fees?|cost|guarantee\w*|refund\w*|money[- ]back|warrant\w*|discount\w*)\b|(?:aed|usd|eur|gbp|sar|\$|€|£)\s?\d/i;
  const COMMIT_VERB = /\b(?:test|tests|build|builds|design|designs|deliver|delivers|provide|provides|offer|offers|document|documents|train|trains|run|runs|give|gives|hand|hands|include|includes|cover|covers|stop|stops|tell|tells|guarantee|guarantees|commit|commits|charge|charges|bill|bills|invoice|invoices|quote|quotes|set up|sets up|assign|assigns|monitor|monitors|support|supports|manage|manages|handle|handles|migrate|migrates|implement|implements|deploy|deploys|integrate|integrates|review|reviews|audit|audits|write|writes|create|creates|produce|produces|prepare|prepares|assess|assesses|track|tracks|measure|measures|refund|refunds|promise|promises|ensure|ensures|keep|keeps|work|works|serve|serves|start|starts|begin|begins|complete|completes|respond|responds|reply|replies|host|hosts|maintain|maintains|operate|operates|resell|resells|sell|sells|license|licenses|certif(?:y|ies)|has|have|had|is|are|was|were|holds?|employs?|costs?|takes?|lasts?|comes?|wins?|won)\b/;
  const OFFER_RE = /\b(?:you|your (?:team|teams|staff|people|users|admins|organisation|organization|business|company))\s+(?:will\s+|['’]ll\s+|also\s+|then\s+|always\s+)?(?:receive|receives|get|gets|keep|keeps|walk away with|leave with|are given|are handed|can expect|will have)\b|\b(?:business users|users|admins|makers)\s+(?:will\s+)?(?:get|gets|receive)\b/i;
  const TRAIN_RE = /^(?:admins|makers|(?:business )?users|staff|employees|your (?:team|staff|admins|users|people))\s+(?:learn|are trained|get trained|receive training)\b/i;
  const PHASE_RE = /^(?:this|each|every|the)\s+(?:phase|stage|step|engagement|service|workstream|programme|program|package|plan)\s+(?:covers|includes|ends|delivers|starts|runs|takes|comes with)\b/i;
  const PASSIVE_RE = /\b(?:is|are|will be|comes?|come)\s+(?:also\s+|always\s+)?(?:delivered|included|provided|offered|covered|handled|priced|billed|charged|backed|guaranteed|agreed|named|assigned|documented|defined|signed off|set up|tested|trained|reviewed|free of charge|at no (?:extra )?cost|part of (?:the|every|each|our|all)|available (?:to|for|with|at)|bundled|built in|supplied)\b/i;
  const COSTTIME_RE = /\b(?:costs?|starts? at|is priced at|takes|lasts|runs for)\s+(?:about\s+|around\s+|from\s+|just\s+|only\s+)?(?:(?:aed|usd|eur|gbp|sar|\$|€|£)\s?)?\d/i;
  const BILL_RE = /\b(?:quote|quotes|quoted|invoice\w*|billed|billing|line item|separate line|fees?|payment|deposit|retainer|hourly|day rate|licen[cs]es? (?:sit|are|is)|charged?)\b/i;
  const LEAD_HEAD = /\b(?:what you get|you get|you receive|deliverables?|includes?|included|what (?:we|\S+) (?:deliver|delivers|does|do|handles?|offers?|covers?|provides?)|our (?:services|engagement|approach|offer|packages?|scope))\b/i;
  // words that say nothing on their own about what is promised: they never count for or against support
  const GENERIC = new Set('you your receive get gets keep give gives offer provide include includes cover covers phase stage step engagement service then also each every well real live new own way part make makes work business client clients team teams solution solutions reason scope sometimes have has more than over typical typically'.split(' ').map(stem));
  // a name that is only part of a fuller name of the business names something else ("peppol" is the network, "OpenPeppol" the
  // organisation): only the full names are a subject
  const fullNames = (list) => { const ns = (list || []).map(n => String(n || '').trim()).filter(n => n.length >= 3); const k = (n) => norm(String(n).replace(/&/g, 'and')).replace(/ /g, '');
    return ns.filter(n => !ns.some(o => k(o) !== k(n) && k(o).includes(k(n)))); };
  function commitments(text, corpus, opts = {}) {
    const t = String(text || ''); const out = { flags: [], checked: 0 };
    if (!t.trim()) return out;
    const names = fullNames(opts.names);
    const nameWords = [...new Set(names.flatMap(n => norm(n).split(' ')).filter(Boolean))];
    const skip = new Set((opts.skip || []).map(s => norm(s)));
    const NAMES = names.map(n => (/^\w/.test(n) ? '\\b' : '') + escR(n) + (/\w$/.test(n) ? '\\b' : '')).join('|');
    const NAME_RE = NAMES ? new RegExp('(?:' + NAMES + ')', 'i') : null;
    const NAME_VERB = NAMES ? new RegExp('(?:' + NAMES + ')(?:[\'’]s)?(?:\\s+(?:also|then|now|always|typically|usually|will|can|has|have))*\\s+' + COMMIT_VERB.source.slice(2), 'i') : null;
    const NAME_BY = NAMES ? new RegExp('\\b(?:with|from|by|at)\\s+(?:' + NAMES + ')', 'i') : null;
    const WE_SUBJ = /(?:^|[,;:]\s*|\b(?:and|but|so|then|that|because|where|when|if|once|after|before|until|while|which|or)\s+)(?:we|we['’](?:ll|re|ve|d))\s+(?!recommend|suggest|advise|encourage|urge)\S/i;
    const OUR_SUBJ = /(?:^|\b(?:and|but|so|then|because|while)\s+|[;:]\s*)our\s+\S+(?:\s+\S+){0,5}?\s+(?:is|are|was|were|has|have|will|can|also|costs?|starts?|takes?|includes?|covers?|runs?|lets?|helps?|handles?|monitors?|provides?|delivers?|offers?|works?|holds?|builds?|designs?|comes?|begins?|ends?|means?|gives?|charges?|bills?|supports?|serves?|keeps?|treats?|does|did|consists?)\b/i;
    const WITH_US = /\b(?:with|from|by)\s+us\b/i;
    const lead = (s) => s.replace(/^(?:yes|no|in short|in practice|today|also|first|next|finally|then|so|and|but|instead|however|in addition|for that reason|as a result|on top of that|after go-live|unlike [^,]{3,60}|as an? [^,]{3,60}|for [^,]{3,40}|after [^,]{3,40}|once [^,]{3,40}|during [^,]{3,40}|in [^,]{3,40}|at [^,]{3,40}|with [^,]{3,40}|if [^,]{3,80}|when [^,]{3,60}|where [^,]{3,60}),\s+/i, '');
    const nameFirst = (s) => { if (!NAME_RE) return false; const w = s.split(/\s+/).slice(0, 4).join(' '); const m = w.match(NAME_RE); if (!m) return false;
      const before = w.slice(0, m.index).trim().toLowerCase(); return !/\b(?:of|for|to|with|from|about|by|at|than|like|on|in)$/.test(before); };
    const bizSubject = (p) => { const s = lead(p);
      if (WE_SUBJ.test(s) && !ADVICE_WE.test(s)) return 'we';
      if (OUR_SUBJ.test(s)) return 'our';
      if (nameFirst(s) || (NAME_VERB && NAME_VERB.test(s))) return 'name';
      if (WITH_US.test(s) || (NAME_BY && NAME_BY.test(s))) return 'with';
      return null; };
    const quoteless = (s) => s.replace(/["“][^"“”]{3,300}["”]/g, ' ').replace(/\s+/g, ' ').trim();
    // the third party who acts: "from the FTA", "issued by the Ministry", "<Org> says"
    const thirdParty = (s) => { const m = s.match(/\b(?:from|by|issued by|with)\s+(?:the\s+)?([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*)*)/); return !!(m && !(NAME_RE && NAME_RE.test(m[1])) && !/^(?:Us|Our|We)$/.test(m[1])); };
    const cnorm = norm(canon(corpus));
    const cnums = new Set(numsOf(corpus));
    const csents = String(corpus || '').split(/(?<=[.!?])\s+|\n+/).map(s => canon(s)).filter(s => s.trim());
    const cs = []; for (let i = 0; i < csents.length; i++) { const one = csents[i]; const two = i + 1 < csents.length ? one + ' ' + csents[i + 1] : one;
      for (const x of (two === one ? [one] : [one, two])) { const w = new Set(words(x, nameWords)); if (w.size) cs.push({ w, low: x.toLowerCase() }); } }
    const support = (plain, english) => {
      const c0 = canon(english || plain);
      const W = [...new Set(words(c0, nameWords))].filter(w => !GENERIC.has(w));
      const nums = numsOf(c0);
      const numsOk = nums.every(n => cnums.has(n) || (/ /.test(n) && cnorm.includes(n.split(' ')[0] + ' ' + n.split(' ')[1].slice(0, 4))));
      const strong = [...new Set((c0.match(STRONG) || []).map(x => x.toLowerCase()))];
      let best = 0;
      for (const c of cs) { const r = W.length ? W.filter(w => c.w.has(w)).length / W.length : 0; if (r > best && strong.every(q => c.low.includes(q))) best = r; }
      return { W, best, numsOk, ok: numsOk && W.length > 0 && best >= 0.5 };
    };
    // CT-FIX2 (live page 2026-10-22, D1): "We serve enterprises across the UAE and the GCC and bring 20+ years of industry experience" joins
    // two facts that sit in two places on file; each half is held against the facts on its own, and the sentence is supported when both are
    const JOIN_RE = /,?\s+and\s+(?=(?:we\s+|also\s+)?(?:bring|brings|have|has|hold|holds|serve|serves|offer|offers|deliver|delivers|run|runs|work|works|employ|employs|support|supports|operate|operates)\b)/i;
    const supportJoined = (plain, english) => { const sp = support(plain, english); if (sp.ok || english || !JOIN_RE.test(plain)) return sp;
      const parts = plain.split(JOIN_RE).map(x => x.trim()).filter(x => x.length >= 8); if (parts.length < 2) return sp;
      const subj = (plain.match(/^(\S+(?:\s+\S+)?)\s/) || [])[1] || '';
      const sps = parts.map((x, i) => support(i === 0 ? x : subj + ' ' + x));
      return sps.every(x => x.ok) ? { ...sp, best: Math.min(...sps.map(x => x.best)), ok: true, joined: true } : sp; };
    // the facts on file closest to a sentence (for the second reader): up to 3, the best word overlap first
    const topFacts = (plain) => { const W = [...new Set(words(canon(plain), nameWords))].filter(w => !GENERIC.has(w)); if (!W.length) return [];
      const sc = []; for (let i = 0; i < csents.length; i++) { const ws = new Set(words(csents[i], nameWords)); const r = W.filter(w => ws.has(w)).length / W.length; if (r > 0) sc.push([r, i]); }
      sc.sort((a, b) => b[0] - a[0]); return sc.slice(0, 3).map(([, i]) => csents[i].trim().slice(0, 400)); };
    // a phase or a service the business names on file, as the subject: "Run & Optimize covers ...", "Assess & Envision includes ..."
    const PHASE_SUBJ = /^([A-Z][\w-]*(?:\s+(?:&|and)\s+[A-Z][\w-]*)+)\s+(?:also\s+|then\s+)?(?:covers?|includes?|adds?|extends?|delivers?|provides?|ends?|starts?|runs?|takes?|gives?|keeps?|sets?|handles?|brings?|is|are)\b/;
    const phaseSubject = (s) => { const m = s.match(PHASE_SUBJ); return !!(m && norm(m[1]).length >= 6 && cnorm.includes(norm(m[1]))); };
    const TITLE_SUBJ = /^((?:[A-Z][\w&-]*\s+){0,3}[A-Z][\w&-]*)\s+(?:also\s+)?[a-z]+s\b/;
    const onFileSubject = (s) => { const m = s.match(TITLE_SUBJ); return !!(m && norm(m[1]).length >= 6 && cnorm.includes(norm(m[1]))); };
    const cands = []; const seenC = new Set();
    const addCand = (o) => { const k = norm(o.plain); if (!k || seenC.has(k)) return; seenC.add(k); cands.push(o); };
    // sections: one H2 group = the H2 and the H3s under it; a list item remembers its lead-in
    const groups = []; let g = null, para = [], lastLead = null, headLead = null;
    const flushPara = () => { if (para.length && g) { const p = para.join(' '); g.items.push({ p, kind: 'para' }); lastLead = /:\s*$/.test(p) ? p : null; } para = []; };
    for (const line of t.split('\n')) {
      const L = line.trim();
      const h = L.match(/^(#{1,6})\s+(.*)$/);
      if (h) { flushPara(); if (h[1].length <= 2 || !g) { g = { heads: [], items: [] }; groups.push(g); } g.heads.push(h[2]); headLead = h[2]; lastLead = null; g.items.push({ p: h[2], kind: 'head' }); continue; }
      if (!g) { g = { heads: [], items: [] }; groups.push(g); }
      const meta = L.match(/^Meta Description:\s*(.*)$/i);
      if (meta) { flushPara(); g.items.push({ p: meta[1], kind: 'meta' }); continue; }
      if (!L || /^\[[^\]]*\]$/.test(L) || /^(?:Title|Slug|Primary Keyword|Secondary Keywords):/i.test(L)) { flushPara(); if (!L) { /* a blank line keeps the lead-in for the list below it */ } continue; }
      if (/^\|/.test(L)) { flushPara(); if (/^\|[\s:|-]+\|?$/.test(L)) { const hd = g.items[g.items.length - 1]; if (hd && hd.kind === 'table') g.items.pop(); continue; }   // the header row is labels, not a statement
        g.items.push({ p: L.replace(/^\||\|$/g, '').split('|').map(x => x.trim()).filter(Boolean).join('; ') + '.', kind: 'table' }); continue; }
      if (/^(?:[-*]|\d+[.)])\s+/.test(L)) { const leadIn = para.length ? para.join(' ') : null; flushPara(); g.items.push({ p: L.replace(/^(?:[-*]|\d+[.)])\s+/, ''), kind: 'li', lead: leadIn && /:\s*$/.test(leadIn) ? leadIn : lastLead, head: headLead }); continue; }
      para.push(L);
    }
    flushPara();
    // CT-FIX2 (live page 2026-10-22, D3): an image caption is read as a statement on the page (card 3 repeated the go / no-go promise)
    for (const c of (opts.captions || [])) { const txt = String(c || '').trim(); if (txt) groups.push({ heads: [], items: [{ p: txt, kind: 'caption' }], captions: true }); }
    const headOnFile = (hd) => { const pre = norm(String(hd).split(':')[0]); return pre.length >= 6 && cnorm.includes(pre); };
    const clean = (s) => s.replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim();
    const sentsOf = (p) => p.replace(/\*\*/g, '').split(/(?<=[.!?])\s+(?=[A-Z"(\[“؀-ۿ])|(?<=[.!?؟])\s+/).map(s => s.trim()).filter(Boolean);
    const isLast = (G) => groups.filter(x => x.heads.length).slice(-1)[0] === G && groups.filter(x => x.heads.length).length >= 2;
    const ctaGroup = (G) => G.heads.some(hd => CTA_HEAD.test(hd) || /\?\s*$/.test(hd) && /\b(?:ready|want|need) to\b/i.test(hd)) || isLast(G);
    for (const G of groups) {
      const aboutBiz = !!G.captions || G.heads.some(hd => headOnFile(hd) || (NAME_RE && NAME_RE.test(hd)) || /\b(?:we|our|us)\b/i.test(hd))
        || G.items.some(it => it.kind === 'para' && sentsOf(it.p).some(s => bizSubject(quoteless(clean(s)))));
      const cta = ctaGroup(G);
      for (const it of G.items) {
        if (it.kind === 'head' && !(WE_SUBJ.test(lead(clean(it.p))) || (NAME_VERB && NAME_VERB.test(clean(it.p))))) continue;   // a heading is read only when it is a sentence with the business as subject ("Why Tech&" is a label)
        const sents = (it.kind === 'li' || it.kind === 'table' || it.kind === 'head' || it.kind === 'caption') ? [it.p] : sentsOf(it.p); let lastBill = false;
        for (const s of sents) {
          const plain0 = clean(s);
          const full = s.replace(/^[-*]\s+/, '');
          if (plain0.length < 12 || /[?؟]\s*$/.test(plain0) || /[\[\]]/.test(s.replace(/!?\[[^\[\]]*\]\([^)]*\)/g, '')) || skip.has(norm(s))) { lastBill = skip.has(norm(s)) && BILL_RE.test(plain0); continue; }
          if (ARABIC.test(plain0)) {   // Arabic: the first person plural or an offer; the same support rule through the lexicon
            const why = arOurs(plain0); if (!why || (why === 'offer' && !aboutBiz)) continue;
            out.checked++;
            const en = arToEnglish(plain0); const sp = support(plain0, en.text);
            if (opts.trace) out.trace = (out.trace || []).concat([{ s: plain0.slice(0, 90), why: 'ar-' + why, W: sp.W, best: Math.round(100 * sp.best), numsOk: sp.numsOk }]);
            if (sp.ok && en.terms >= 2) { if (opts.collect) addCand({ sentence: full, plain: plain0, why: 'ar-' + why, rule_flag: false, support: Math.round(100 * sp.best), kind: 'process', where: it.kind, facts: topFacts(en.text) }); continue; }
            const ek = en.text;
            const akind = /guarantee|refund/.test(ek) ? 'guarantee' : /fee|cost|price|aed|discount|free/.test(ek) ? 'pricing' : /certif/.test(ek) ? 'credential' : /weeks|days|months/.test(ek) ? 'timeline' : why === 'offer' ? 'deliverable' : 'process';
            out.flags.push({ kind: akind, sentence: full, support: Math.round(100 * sp.best), where: it.kind });
            if (opts.collect) addCand({ sentence: full, plain: plain0, why: 'ar-' + why, rule_flag: true, support: Math.round(100 * sp.best), kind: akind, where: it.kind, facts: topFacts(en.text) });
            continue;
          }
          if (it.kind === 'para' && /:\s*$/.test(plain0)) { lastBill = false; continue; }   // a lead-in ("Our engagement includes:") introduces the list; its items are read
          const hasQuote = /["“][^"“”]{3,300}["”]/.test(plain0);
          const plain = quoteless(plain0);
          if (hasQuote && SAY_RE.test(plain)) { lastBill = false; continue; }   // a quotation with its speaker: their words, not ours
          const L0 = lead(plain);
          if (ADVICE_WE.test(L0) && opts.collect && !NARR_OPEN.test(plain)) addCand({ sentence: full, plain, why: 'advice', rule_flag: false, support: 0, kind: 'process', where: it.kind, facts: topFacts(plain) });   // "we recommend a go / no-go review ...": the second reader decides
          if (NARR_OPEN.test(plain) || NARR_VERB.test(L0) || EXAMPLE_RE.test(plain) || ADVICE_WE.test(L0)) { lastBill = false; continue; }
          const pc = plain.replace(PURPOSE_LEAD, '');   // CT-FIX2 (D2): "To test one use case first, [book a call]" is the invitation itself
          if (cta && (CTA_START.test(pc) || CTA_FOLLOW.test(pc)) && !CTA_TERMS.test(pc)) { lastBill = false; continue; }   // the call to action invites a conversation; a price or a guarantee in it is still a term
          if (CTA_START.test(pc) && !/\b(?:and|then)\s+(?:we|our team)\b/i.test(pc) && !CTA_TERMS.test(pc)) { lastBill = false; continue; }   // an imperative on its own is advice or an invitation
          let why = null; const subj = bizSubject(plain);
          if (subj) why = subj;
          else if (phaseSubject(plain)) why = 'phase';   // CT-FIX2 (D3): a phase on file as the subject is the business speaking
          else if (it.kind === 'li' && ((it.lead && (bizSubject(clean(it.lead)) || (NAME_RE && NAME_RE.test(it.lead)) || LEAD_HEAD.test(it.lead) || /\b(?:we|our)\b/i.test(it.lead))) || (!it.lead && it.head && LEAD_HEAD.test(it.head) && (aboutBiz || (NAME_RE && NAME_RE.test(it.head)))))) why = 'list';
          else if (aboutBiz && it.kind !== 'head' && !thirdParty(plain)) {
            if (OFFER_RE.test(plain)) why = 'offer';
            else if (TRAIN_RE.test(plain) || PHASE_RE.test(plain)) why = 'phase';
            else if (PASSIVE_RE.test(plain) || COSTTIME_RE.test(plain)) why = 'passive';
            else if (lastBill && BILL_RE.test(plain)) why = 'billing';
          }
          if (why && (why === 'offer' || why === 'with') && thirdParty(plain)) why = null;
          lastBill = !!why && BILL_RE.test(plain);
          if (!why) {   // not a commitment to the rules; a wider net for the second reader: a section about the business, a name on file as the subject, the business named
            if (opts.collect && !thirdParty(plain) && ((aboutBiz && (COMMIT_VERB.test(plain.toLowerCase()) || OFFER_RE.test(plain) || PASSIVE_RE.test(plain))) || onFileSubject(plain) || (NAME_RE && NAME_RE.test(plain)) || /\b(?:we|our|us)\b/i.test(plain)))
              addCand({ sentence: full, plain, why: 'wide', rule_flag: false, support: 0, kind: 'process', where: it.kind, facts: topFacts(plain) });
            continue;
          }
          out.checked++;
          const lab = why === 'list' && s.match(/^\s*\*\*([^*]{3,60}?):?\*\*:?\s+\S/);   // "**AI strategy:** candidate use cases ...": the label is the service the lead-in commits to
          const sp0 = supportJoined(plain); const sp = (!sp0.ok && lab && support(lab[1]).ok) ? support(lab[1]) : sp0;
          if (opts.trace) out.trace = (out.trace || []).concat([{ s: plain.slice(0, 90), why, W: sp.W, best: Math.round(100 * sp.best), numsOk: sp.numsOk }]);
          if (sp.ok || !sp.W.length) { if (opts.collect) addCand({ sentence: full, plain, why, rule_flag: false, support: Math.round(100 * sp.best), kind: 'process', where: it.kind, facts: topFacts(plain) }); continue; }   // nothing but generic words: nothing to hold against the facts
          const kind = /\b(?:charg|bill|fee|price|pricing|quote|invoice|payment|licen[cs]es? (?:sit|are)|separate line|cost|free|discount)/i.test(plain) ? 'pricing'
            : /\b(?:guarantee|warrant|refund|promise)/i.test(plain) ? 'guarantee'
              : /\b(?:within|\d+\s*(?:days?|weeks?|months?|hours?|minutes?))\b|\b(?:days|weeks|months)\b/i.test(canon(plain)) ? 'timeline'
                : /\b(?:certified|certif|accredit|partner|iso)/i.test(plain) ? 'credential'
                  : /\b(?:stop|only|not|never|scope|covers|includes)\b/i.test(plain) ? 'scope'
                    : (why === 'offer' || why === 'phase' || why === 'list' || why === 'passive' || /\b(?:deliver|provide|runbook|pack|report|dashboard|document)/i.test(plain)) ? 'deliverable' : 'process';
          // E-CLAIM / CT-FIX: the WHOLE sentence is returned (Content QA finds and wraps it in the copy); a display cut belongs to the reader
          out.flags.push({ kind, sentence: full, support: Math.round(100 * sp.best), where: it.kind });
          if (opts.collect) addCand({ sentence: full, plain, why, rule_flag: true, support: Math.round(100 * sp.best), kind, where: it.kind, facts: topFacts(plain) });
        }
      }
    }
    if (opts.collect) out.candidates = cands;
    return out;
  }
  // CT-FIX2 (2026-10-22): does ONE fact carry a sentence? Every number of the sentence is on that fact and at least 40% of its content
  // words. The second reader's "supported by F3" is accepted only when this holds (evaluation run 2: Haiku named a fact for "Our
  // fixed-price readiness assessment costs AED 25,000" that carries no price).
  const backs = (sent, fact) => { const c0 = canon(sent); const nums = numsOf(c0); const fn = new Set(numsOf(fact));
    if (!nums.every(n => fn.has(n))) return false;
    const W = [...new Set(words(c0, []))].filter(w => !GENERIC.has(w)); if (!W.length) return true;
    const F = new Set(words(canon(fact), [])); return W.filter(w => F.has(w)).length / W.length >= 0.4; };
  return { CLAIM_RE, keyOf, check, business, commitments, canon, numsOf, arNorm, backs };
})();
// ---- promise judge kit (CT-FIX2, 2026-10-22; inlined by build_v4.py section 148): the second reader of the promise check ----
// The rule-based check (CL.commitments, _claims.js) scored 100% / 88% recall offline and then, on the first fresh live page (exec 159),
// flagged three true or harmless sentences (a true fact said in other words, a mid-page invitation, a "Read [link]" line) and missed three
// promises (a phase named as the subject, a passive list item, an image caption). More patterns had stopped helping. So the check has two
// stages: the rules find CANDIDATES with a wide net (every sentence they would judge, plus the sentences a section about the business, a
// name on file or "we / our" puts near a commitment, captions included), and one Claude Haiku call per page judges each candidate against
// the closest facts on file: is it a commitment of the business, and which fact (if any) carries it. The model never adds a sentence: a
// verdict for anything that is not a candidate is ignored. When the call fails, is skipped or answers for another candidate list, the
// rules decide alone and the report says "checked by rules only".
const PJ = (() => {
  const MODEL = 'claude-haiku-4-5-20251001';
  const MAX_CANDS = 40;
  // OFF by default (2026-10-22): one real evaluation on the 180 labelled sentences (harness/accuracy/CLAIMS_MODEL_EVAL.md) showed the
  // second reader decides exactly as the rules under the safe policy, for about $0.02 and 10-13 s a QA round, and lowers recall when trusted.
  // A run turns it on with promise_judge: true in its brief (Parse Brief); switch the default on only after a model beats the rules there.
  const ENABLED_DEFAULT = false;
  const enabled = (prev) => (prev && typeof prev.promise_judge === 'boolean') ? prev.promise_judge : ENABLED_DEFAULT;
  const k = (s) => String(s || '').replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/^\[(?:Confirm|Owner)[^:]*:\s*/i, '').replace(/\]$/, '')
    .replace(/[*_`]+/g, '').replace(/^[-*]\s+/, '').toLowerCase().replace(/[^\p{L}\p{N}%$€£]+/gu, ' ').replace(/\s+/g, ' ').trim();
  // a short, stable fingerprint of the candidate list: the judge's answer is used only for the list it was asked about
  const keyOf = (cands) => { let h = 5381; const t = (cands || []).map(c => k(c.sentence)).join('|'); for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return 'pj' + h.toString(36) + '.' + (cands || []).length; };
  // what the business says about itself, from every place a content run reads it (Content QA §2b OWN_TEXT; one definition for both nodes)
  const ownText = (prev, siteModel) => {
    const P = prev || {}; const SMx = siteModel || (P.site_model && typeof P.site_model === 'object' ? P.site_model : null) || {};
    const vals = (o) => (o && typeof o === 'object') ? Object.values(o).map(v => (v && typeof v === 'object') ? vals(v) : String(v == null ? '' : v)).join(' ') : String(o || '');
    return [P.business, P.business_facts, P.case_facts_text, SMx.business_facts, SMx.accreditation, vals(SMx.services), vals(SMx.nap),
      vals(P.site_profile), vals(P.author), vals(P.reviewer), ...(P.client_pages || []).map(p => p && p.text), P.existing_page_text,
      P.existing_page_facts_text, vals(P.client_signals), P.proof_context, vals(P.proof_library), P.cta, SMx.cta].filter(Boolean).map(String).join('\n');
  };
  // the captions and alt texts the brief planned for the page's images: shown on the page next to the copy
  const captionsOf = (brief) => ((brief || {}).image_suggestions || []).flatMap(im => [im && im.caption]).map(x => String(x || '').trim()).filter(x => x.length >= 12);
  // Run 1 of the evaluation (CLAIMS_MODEL_EVAL.md) showed the two questions mixed up when asked as two booleans: "commitment: false,
  // because no fact states the price", or "supported_by: F13" beside "runbook and dashboards not stated". The answer now names what the
  // sentence IS first (one of seven kinds), then the detail the facts do not carry, then the fact; a commitment is supported only when
  // nothing is missing AND a fact is named.
  const KINDS = ['commitment', 'call_to_action', 'pointer_to_page', 'page_narration', 'advice_to_reader', 'about_others', 'quotation'];
  const TOOL = { name: 'record_verdicts', description: 'Record one verdict per candidate sentence.',
    input_schema: { type: 'object', properties: { key: { type: 'string' }, verdicts: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, kind: { type: 'string', enum: KINDS }, missing: { type: 'string' }, supported_by: { type: ['string', 'null'] },
      is_business_commitment: { type: 'boolean' }, reason: { type: 'string' } },
      required: ['id', 'kind', 'missing', 'supported_by', 'is_business_commitment', 'reason'] } } }, required: ['key', 'verdicts'] } };
  const SYSTEM = 'You check sentences of a web page draft written in the name of a business, before it is published. For each candidate:\n'
    + 'kind: what the sentence IS, whether or not it is true. "commitment" = it states something the business itself does, offers, delivers, includes, charges, guarantees, has, holds or has achieved (service, scope, process step, deliverable, price, term, timeline, credential, experience, location, client count); a sentence in the business\'s own voice (we, our, the business name, one of its phases or services as the subject, a passive line about its work, a list item under a lead-in in its voice, an image caption about how it works) is a commitment even when nothing supports it. Otherwise: call_to_action (an invitation: book, call, contact, start, including "to test X first, book a call"), pointer_to_page (only points to another page: "Read how X approaches security"), page_narration (about the page itself), advice_to_reader, about_others (the market, the law, a vendor product, a third party), quotation.\n'
    + 'missing: for a commitment, the specific details the facts below do NOT state (a number, a deliverable, a step, a price, a duration, a scope); empty string only when every detail is stated. Same meaning in other words counts as stated; "UAE" = "United Arab Emirates"; a sentence joining two facts is stated when both are.\n'
    + 'supported_by: the id of the fact that states it (the main one if two are needed), or null.\n'
    + 'is_business_commitment: true exactly when kind is "commitment".\n'
    + 'reason: at most 10 words.\n'
    + 'Judge only the candidates given, one verdict each, with its id. Copy the key you are given. Never assume a fact that is not listed.';
  // the facts sent with a page, each once, with its id (F1, F2 ...): the two closest to each candidate, in candidate order
  const factIds = (list) => { const fid = new Map(); const per = list.map(c => (c.facts || []).slice(0, 2).map(f => { const t = String(f || '').trim().slice(0, 220); if (!t) return null;
    if (!fid.has(t)) fid.set(t, 'F' + (fid.size + 1)); return fid.get(t); }).filter(Boolean)); return { fid, per, text: new Map([...fid].map(([t, id]) => [id, t])) }; };
  // one request per page: the candidates, each with the ids of its closest facts, and every such fact once
  const request = (cands, opts) => {
    const o = opts || {}; const list = (cands || []).slice(0, MAX_CANDS);
    const FI = factIds(list); const facts = [...FI.fid].map(([t, id]) => id + ': ' + t);
    const lines = list.map((c, i) => { const ids = FI.per[i];
      return 'C' + (i + 1) + (c.where === 'caption' ? ' (image caption)' : c.where === 'li' ? ' (list item' + (c.lead ? ' under "' + c.lead + '"' : '') + ')' : '') + ': ' + String(c.plain || c.sentence).slice(0, 500) + (ids.length ? '  [closest facts: ' + ids.join(', ') + ']' : '  [no close fact]'); });
    const user = 'Business: ' + (o.business || 'the business') + (o.domain ? ' (' + o.domain + ')' : '') + '\nKey: ' + keyOf(list) + '\n\nFacts on file (what the business says about itself):\n'
      + (facts.length ? facts.join('\n') : '(none close to these sentences)') + '\n\nCandidate sentences from the draft:\n' + lines.join('\n');
    return { model: MODEL, max_tokens: Math.min(4000, 300 + 80 * list.length), temperature: 0, system: SYSTEM, tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name }, messages: [{ role: 'user', content: user }] };
  };
  // the answer, read only for the candidate list it was asked about. { ok, by: Map(k(sentence) -> verdict), usage, why }
  const read = (resp, cands) => {
    const list = (cands || []).slice(0, MAX_CANDS); const key = keyOf(list); const out = { ok: false, by: new Map(), usage: null, why: '', key };
    const r = resp || {};
    if (r.error || !Array.isArray(r.content)) { out.why = 'the second reader could not be reached' + (r.error ? ' (' + String((r.error && (r.error.message || r.error.type)) || r.error).slice(0, 80) + ')' : ''); return out; }
    if (r.usage) out.usage = { input_tokens: Number(r.usage.input_tokens) || 0, output_tokens: Number(r.usage.output_tokens) || 0 };
    const tu = r.content.find(c => c && c.type === 'tool_use' && c.input);
    if (!tu) { out.why = 'the second reader gave no verdicts'; return out; }
    if (String(tu.input.key || '') !== key) { out.why = 'the second reader answered for another list of sentences'; return out; }
    const FI = factIds(list);
    for (const v of (tu.input.verdicts || [])) { const m = String((v || {}).id || '').match(/^C(\d+)$/); const c = m ? list[Number(m[1]) - 1] : null; if (!c) continue;   // never a sentence that was not a candidate
      const kind = KINDS.includes(v.kind) ? v.kind : (v.is_business_commitment === true ? 'commitment' : 'unknown');
      const sup = v.supported_by && !/^(?:null|none|n\/a)$/i.test(String(v.supported_by).trim()) ? String(v.supported_by) : null;
      const missing = String(v.missing || '').trim(); const gap = !!missing && !/^(?:none|nothing|n\/a|-)$/i.test(missing);
      out.by.set(k(c.sentence), { commit: kind === 'commitment' || v.is_business_commitment === true, kind, supported_by: gap ? null : sup, fact: sup ? (FI.text.get(sup) || '') : '', missing: gap ? missing.slice(0, 160) : '', reason: String(v.reason || '').slice(0, 200) }); }
    out.ok = out.by.size > 0; if (!out.ok) out.why = 'the second reader gave no verdicts';
    return out;
  };
  // the final decision for one candidate. Both evaluation runs (CLAIMS_MODEL_EVAL.md) showed the reader is right where the rules are
  // blind and wrong where they are sure: it named facts for prices and counts no fact carries, and called true, rule-supported lines
  // unsupported. So it may (1) lift a rule flag from an invitation, a pointer to another page, the page's own narration or a quotation;
  // (2) lift one as supported only when the fact it names carries the sentence by the rules' own test (`backs`: every number, 40% of
  // the words); (3) add a flag only to a sentence the rules did not judge as a commitment at all (the wide net, "we recommend ...").
  // Otherwise the rules stand.
  const LIFT = new Set(['call_to_action', 'pointer_to_page', 'page_narration', 'quotation']);
  const decide = (cand, J, backs) => { const v = J && J.ok ? J.by.get(k(cand.sentence)) : null;
    if (!v) return { flagged: !!cand.rule_flag, by: 'rules' };
    const m = (flagged, why) => ({ flagged, by: 'model', reason: v.reason + (v.missing ? ' (not on file: ' + v.missing + ')' : ''), supported_by: v.supported_by, commit: v.commit, kind: v.kind, rule: why });
    if (cand.rule_flag) {
      if (!v.commit && LIFT.has(v.kind)) return m(false, 'lifted: ' + v.kind);
      if (v.commit && v.supported_by && v.fact && typeof backs === 'function' && backs(cand.plain || cand.sentence, v.fact)) return m(false, 'lifted: supported by ' + v.supported_by);
      return { flagged: true, by: 'rules', reason: v.reason, kind: v.kind };
    }
    if (v.commit && !v.supported_by && (cand.why === 'wide' || cand.why === 'advice')) return m(true, 'added');
    return { flagged: false, by: 'rules' };
  };
  return { MODEL, MAX_CANDS, ENABLED_DEFAULT, enabled, KINDS, LIFT, factIds, k, keyOf, ownText, captionsOf, request, read, decide, SYSTEM, TOOL };
})();
// CT-FIX2 (2026-10-22, live page exec 159): stage 1 of the promise check. The draft of this QA round (the Copywriter's, then each Editor
// round's) is read by the claims kit with its wide net: every sentence the rules judge, plus the ones near a commitment (a section about
// the business, a phase or service on file as the subject, "we / our", image captions), each with the closest facts on file. The request
// for the second reader (Claude Haiku, *Promise Judge*) is built here; Content QA applies the verdicts. The draft passes through untouched
// (Content QA reads it from this node).
const inItem = $input.first().json || {};
const prev = $('Parse Brief').first().json || {};
let SITE_MODEL = null; try { SITE_MODEL = $('Site Model').first().json.site_model || null; } catch (e) {}
const raw = typeof inItem.output === 'string' ? inItem.output : JSON.stringify(inItem.output || '');
// QA's own [Confirm: <sentence>] marks of the round before are sentences again here, so the judge reads them like any other
const md = raw.replace(/\[Confirm: ([^\[\]]{20,}?[.!])\]/g, '$1');
const OWN = PJ.ownText(prev, SITE_MODEL);
const domain = String(prev.domain || '');
const names = [...new Set([(prev.site_profile || {}).business_name, SITE_MODEL ? SM.name(SITE_MODEL) : '', ...((SITE_MODEL && Array.isArray(SITE_MODEL.brand_names)) ? SITE_MODEL.brand_names : []),
  (prev.site_description || {}).business_name, domain ? domain.split('.')[0] : ''].map(x => String(x || '').trim()).filter(x => x.length >= 3))];
let cands = [];
// at most PJ.MAX_CANDS a call: the rules' own flags first, then the sentences they judged as commitments, then the wide net (captions and
// "we recommend ..." with the latter); a candidate left out is decided by the rules in Content QA
const rank = (c) => (c.rule_flag ? 0 : (c.why === 'wide' || c.why === 'advice') ? (c.where === 'caption' || c.why === 'advice' ? 2 : 3) : 1);
try { cands = (CL.commitments(md, OWN, { names, collect: true, captions: PJ.captionsOf(prev.content_brief) }).candidates || []).map((c, i) => ({ c, i }))
  .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i).slice(0, PJ.MAX_CANDS).map(x => x.c); } catch (e) { cands = []; }
const on = PJ.enabled(prev);
const skip = !on || !cands.length || !OWN.trim();
const promise_judge = { key: PJ.keyOf(cands), candidates: cands.map(c => ({ sentence: c.sentence, why: c.why, rule_flag: c.rule_flag, where: c.where, facts: c.facts })), n: cands.length, skip, off: !on,
  skip_reason: !on ? 'the second reader is switched off; the rules decide' : !OWN.trim() ? 'nothing on file to hold the sentences against' : !cands.length ? 'no sentence in the business\'s name to judge' : '',
  body: skip ? '' : JSON.stringify(PJ.request(cands, { business: names[0] || domain, domain })) };
return [{ json: { ...inItem, promise_judge } }];
