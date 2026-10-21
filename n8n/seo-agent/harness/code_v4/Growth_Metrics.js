// AI Growth per site (v4.12): what was done automatically this week (pages sent to Bing / IndexNow, key pages checked), the page readiness, the
// questions queued for an answer page or a refresh (the Content Cadence writes them), the earned-media list with drafts, the entity check, the
// actions ranked by value, alerts; plus the rows for seo_ai_pages, seo_ai_targets, seo_link_prospects, seo_ai_growth and seo_cache.
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
// ---- which stored outreach draft may still be offered (P34-1, live 2026-10-12; inlined by build_monitors.py) ----
// AI Growth's report said "8 outreach draft(s) written" and printed a pitch to tax.gov.ae opening "I work at techand.ai" — a draft
// written on 2026-10-02, before the D12 / D13 gates (no government portals, no competitors, no bare homepages, the business name from
// the site model, a quote from their own page). Nothing had written it this week: the counter read the stored prospect row.
// Every writer now stamps `drafted_at` on the row it drafts for. A stored draft with no stamp, or one from before the gates, is
// **superseded**: the row is cleared, the draft is never counted as this week's work and never offered to the owner. The same is true
// when a site hands drafting over to the Link Builder (one writer). The web app applies the identical rule to the rows already in the
// table (`app/shared/src/outreach.ts`: DRAFT_GATES_AT / prospectDraft).
const DRAFTS = (() => {
  const GATES_AT = '2026-10-12';   // the day the D12 / D13 gates were deployed; a draft written before them is not offered again
  const S = (v) => String(v == null ? '' : v).trim();
  const reason = 'the draft written for them earlier was withdrawn: it was written before the current outreach rules (no government portals, no competitors, no bare homepages, the business name from the site model)';
  const handedOver = 'the Link Builder writes to them (one writer): approve the pitch on the Link building page';
  // a draft that was sent is part of the record (and the follow-ups quote it): it is never withdrawn, whenever it was written
  const sent = (row) => { const r = row || {}; return !!S(r.contacted_at) || ['contacted', 'won'].includes(S(r.status).toLowerCase()); };
  const superseded = (row) => { const r = row || {}; if (!S(r.outreach_body) || sent(r)) return false; const at = S(r.drafted_at).slice(0, 10); return !at || at < GATES_AT; };
  // what this run keeps of a stored row's draft: the draft while it is still valid, else nothing (and `superseded` says why the note changes)
  const carry = (row, o) => { const r = row || {}; const x = o || {}; const had = !!S(r.outreach_body);
    if (x.handover && !sent(r)) return { outreach_subject: '', outreach_body: '', drafted_at: '', superseded: had, reason: handedOver };
    if (superseded(r)) return { outreach_subject: '', outreach_body: '', drafted_at: '', superseded: true, reason };
    return { outreach_subject: S(r.outreach_subject), outreach_body: S(r.outreach_body), drafted_at: S(r.drafted_at), superseded: false, reason: '' }; };
  // a draft this run wrote: stamped, so the next run knows it is current
  const fresh = (d, at) => ({ outreach_subject: S((d || {}).subject).slice(0, 200), outreach_body: S((d || {}).body).slice(0, 3000), drafted_at: S(at), superseded: false, reason: '' });
  return { GATES_AT, superseded, sent, carry, fresh, reason, handedOver };
})();
// RV-1 / RV-16 (2026-10-21): key pages that answer 404 (old addresses AI still cites) are ONE redirect action with the page each should go to,
// not "fix X (answers 404)" one by one, and they have no readiness score (the average was 25 with them at 0, 52-70 without)
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
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const all = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const ready = all('AI Readiness').filter(x => !x.skip), earnedAll = all('Earned Media').filter(x => !x.skip);
const oIn = all('AI Outreach Input').filter(x => !x.skip), oOut = all('AI Outreach Writer');
const bSub = all('Bing Submit Requests').filter(x => !x.skip), bRes = all('Submit to Bing'), bReq = all('Bing Growth Requests').filter(x => !x.skip);
// B9-2 / B9-3 (2026-10-15, benchmark area 9): the answers Bing gave about the pages we submitted in earlier runs, the pages a
// submission was refused for, and what the AI search fetchers are allowed to read at all.
const bReqAll = all('Bing Growth Requests'), bInfo = all('Fetch Bing Growth'), bSubAll = all('Bing Submit Requests'), iReqAll = all('IndexNow Requests');
const robots = all('Robots Verdicts (Growth)').filter(x => !x.skip);
const kReq = all('IndexNow Key Requests').filter(x => !x.skip), kRes = all('Fetch IndexNow Key'), iReq = all('IndexNow Requests').filter(x => !x.skip), iRes = all('Submit IndexNow');
const eReq = all('Entity Requests').filter(x => !x.skip), eRes = all('Fetch Wikidata');
const BING = true;
const jsonOf = (r) => { if (!r) return {}; if (r.d !== undefined || r.ErrorCode !== undefined || r.search || r.query) return r; const b = r.body ?? r.data; if (b && typeof b === 'object') return b; try { return JSON.parse(b || '{}'); } catch (e) { return {}; } };
const parseJ = (raw) => { if (raw && typeof raw === 'object') return raw; try { return JSON.parse(String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')); } catch (e) { return {}; } };
const keyOf = (u) => { const m = String(u || '').trim().match(/^https?:\/\/(?:www\.)?([^\/?#]+)([^?#]*)/i); if (!m) return ''; return m[1].toLowerCase() + ((m[2] || '/').replace(/\/+$/, '') || '/'); };
const dateOfMs = (v) => { const m = String(v || '').match(/Date\((-?\d+)/); if (!m) return ''; const t = Number(m[1]); return t > 946684800000 ? new Date(t).toISOString() : ''; };   // "/Date(…)/"; year 1 = never crawled
const J = (o) => JSON.stringify(o);
const out = [];
for (const p of plans) {
  const now = p.checked_at;
  // ---- submissions ----
  const bi = bSub.findIndex(x => x.site_id === p.site_id); const br = bi >= 0 ? jsonOf(bRes[bi]) : null;
  const bingOk = bi >= 0 && br && !br.ErrorCode && !br.Message && !(br.error);
  const inAccount = bReq.some(x => x.site_id === p.site_id);
  const bing = { enabled: BING, in_account: inAccount, submitted: bingOk ? bSub[bi].urls.length : 0, urls: bi >= 0 ? bSub[bi].urls : [], quota: bi >= 0 ? bSub[bi].quota : null, error: bi >= 0 && !bingOk ? String((br && (br.Message || (br.error && (br.error.message || br.error)))) || 'no answer').slice(0, 200) : '' };
  const ki = kReq.findIndex(x => x.site_id === p.site_id); const kr = ki >= 0 ? (kRes[ki] || {}) : {};
  const verified = Number(kr.statusCode) === 200 && String(kr.body ?? kr.data ?? '').trim() === p.indexnow_key;
  const ii = iReq.findIndex(x => x.site_id === p.site_id); const ir = ii >= 0 ? (iRes[ii] || {}) : null;
  const inStatus = ir ? (Number(ir.statusCode) || (ir.error ? 0 : 200)) : 0; const inOk = ir && [200, 202].includes(inStatus);
  const indexnow = { key: p.indexnow_key, key_url: SM.siteUrl({ canonical_host: p.site_host, domain: p.domain }, '/' + p.indexnow_key + '.txt'), verified, submitted: inOk ? iReq[ii].urls.length : 0, status: inStatus || null, error: ir && !inOk ? 'IndexNow answered ' + (inStatus || 'nothing') : '' };
  const subVia = new Map(); for (const u of (bingOk ? bing.urls : [])) subVia.set(keyOf(u), 'bing'); if (inOk) for (const u of iReq[ii].urls) subVia.set(keyOf(u), subVia.has(keyOf(u)) ? 'bing+indexnow' : 'indexnow');
  // ---- pages ----
  const pages = ready.filter(r => r.site_id === p.site_id).map(r => ({ ...r, submitted_now: subVia.get(keyOf(r.url)) || '' }));
  const keyInfo = new Map(p.key_pages.map(k => [keyOf(k.url), k]));
  const page_rows = pages.map(r => { const k = keyInfo.get(keyOf(r.url)) || {}; const st = (p.stored_pages || []).find(x => x.key === keyOf(r.url)) || {};
    return { site_id: p.site_id, domain: p.domain, url: r.url, kind: r.kind, checked_at: r.checked_at, status: r.status, score: r.score, checks_json: J(r.checks.map(c => ({ key: c.key, ok: c.ok, weight: c.weight, label: c.label, detail: c.detail }))),
      issues: r.issues.slice(0, 4).join(' | ').slice(0, 1000), words_raw: r.words_raw, title: r.title, updated_on: r.updated_on, bing_crawled_at: r.bing_crawled_at, bing_status: r.bing_status,
      submitted_at: r.submitted_now ? now : (st.submitted_at || ''), submitted_via: r.submitted_now || st.submitted_via || '', cited_by: (k.cited_by || []).join(', '), questions: (k.questions || []).join(' | ').slice(0, 600) }; });
  // submitted pages not checked this week and never stored: a first row so the next run knows they were sent
  for (const [k, via] of subVia) if (!pages.some(r => keyOf(r.url) === k) && !(p.stored_pages || []).some(x => x.key === k)) { const kp = keyInfo.get(k); const url = (kp && kp.url) || 'https://' + k;
    page_rows.push({ site_id: p.site_id, domain: p.domain, url, kind: (kp && kp.kind) || 'page', checked_at: '', status: 0, score: null, checks_json: '', issues: '', words_raw: 0, title: '', updated_on: '', bing_crawled_at: '', bing_status: 0, submitted_at: now, submitted_via: via, cited_by: '', questions: '' }); }
  // B9-3: a page no AI search fetcher may read has NO readiness score, so it is not in the average either — a withheld score is
  // not a zero and not a silent omission: it is reported as "not scored" with the rule that withheld it.
  const scored = pages.filter(r => r.status && r.score != null);
  const withheld = pages.filter(r => r.score == null && r.score_withheld);
  const avg_score = scored.length ? Math.round(scored.reduce((t, r) => t + r.score, 0) / scored.length) : null;
  const robots_site = robots.find(x => x.site_id === p.site_id) || null;
  // ---- B9-2 (INVARIANTS rule 4): what became of the pages we submitted. A submission is a notification; Bing's own answer
  // (GetUrlInfo: LastCrawledDate) is the only evidence that one became a crawl, and when it cannot be asked the figure is not
  // estimated — it says it is not available, and why.
  const daysAgo = (d) => d ? (new Date(now) - new Date(d)) / 864e5 : Infinity;
  const infoByKey = new Map();
  bReqAll.forEach((q, i) => { if (q && q.kind === 'info' && q.site_id === p.site_id) { const d = (jsonOf(bInfo[i]) || {}).d; infoByKey.set(keyOf(q.page), d || null); } });
  const crawlOf = (st) => { const d = infoByKey.get(keyOf(st.url)); const fresh = d ? dateOfMs(d.LastCrawledDate) : ''; return fresh || st.bing_crawled_at || ''; };
  const subWindow = Number(p.follow_up_days) || 45;
  const outcome = (() => {
    if (!BING) return { basis: 'not available', reason: 'Bing submission is off for this installation (no Bing Webmaster key)' };
    if (!inAccount) return { basis: 'not available', reason: 'the site is not in the Bing Webmaster account, so Bing cannot be asked what it has crawled' };
    const rows = (p.stored_pages || []).filter(st => st.submitted_at && daysAgo(st.submitted_at) <= subWindow)
      .map(st => ({ url: st.url, submitted_at: st.submitted_at, via: st.submitted_via || '', crawled_at: crawlOf(st), asked: infoByKey.has(keyOf(st.url)) }));
    for (const [k, via] of subVia) if (!rows.some(r => keyOf(r.url) === k)) rows.push({ url: (keyInfo.get(k) || {}).url || k, submitted_at: now, via, crawled_at: '', asked: false, sent_now: true });
    const earlier = rows.filter(r => !r.sent_now); const crawled = earlier.filter(r => r.crawled_at);
    const waiting = earlier.filter(r => !r.crawled_at);
    return { basis: earlier.length ? 'measured' : 'none', source: 'Bing Webmaster Tools (GetUrlInfo)', window_days: subWindow, submitted: earlier.length, crawled: crawled.length,
      sent_now: rows.length - earlier.length, checked_now: earlier.filter(r => r.asked).length, not_checked: waiting.filter(r => !r.asked).length,
      waiting: waiting.map(r => ({ url: r.url, days: Math.round(daysAgo(r.submitted_at)), asked: r.asked })).sort((a, b) => b.days - a.days).slice(0, 8),
      reason: earlier.length ? '' : 'nothing had been submitted in the last ' + subWindow + ' days before this run' };
  })();
  const refusedSub = [...((bSubAll.find(x => x.site_id === p.site_id) || {}).refused || []), ...((iReqAll.find(x => x.site_id === p.site_id) || {}).refused || [])]
    .filter((r, i, a) => a.findIndex(x => x.url === r.url) === i);
  // ---- earned media (+ drafts) ----
  const em = earnedAll.find(x => x.site_id === p.site_id) || { earned: [], prospect_rows: [], outreach_jobs: [] };
  const oi = oIn.findIndex(x => x.site_id === p.site_id); const drafts = oi >= 0 && oOut[oi] && !oOut[oi].error ? ((parseJ(oOut[oi].output).drafts) || []) : [];
  const draftFor = (job) => drafts.find(d => Number(d.n) === job.n) || null;
  // P34-1 (live 2026-10-12): the drafts the report counts and prints are the ones THIS run's writer produced. Reading them off the
  // stored prospect row brought back the pitches of 2026-10-02 — written before the D12 / D13 gates — as "8 outreach draft(s) written",
  // including one to tax.gov.ae. A draft written now is stamped (drafted_at); Earned Media has already withdrawn the superseded ones.
  const wroteNow = new Map();
  const prospect_rows = em.prospect_rows.map(r => { const job = em.outreach_jobs.find(j => j.prospect_domain === r.prospect_domain && j.kind !== 'correction'); const d = job ? draftFor(job) : null;
    if (!(d && d.body)) return r;
    const fresh = DRAFTS.fresh(d, now); wroteNow.set(r.prospect_domain, { subject: fresh.outreach_subject, body: fresh.outreach_body });
    return { ...r, outreach_subject: fresh.outreach_subject, outreach_body: fresh.outreach_body, drafted_at: fresh.drafted_at }; });   // status stays new (the app's prospect statuses: new / contacted / won / rejected / ignored); a stored draft = ready to send
  const earned = em.earned.slice(0, 15).map(e => { const row = prospect_rows.find(r => r.prospect_domain === e.host && r.source_url === e.url); return { ...e, status: row ? row.status : '', contact_email: (row && row.contact_email) || e.contact_email || '', draft: wroteNow.get(e.host) || null }; });
  // B9-7: the wrong claims AI makes, each with the fact on file and the pages that carry it; a draft only where the one writer wrote one
  const corrections = (em.corrections || []).map(c => { const job = c.job_n ? em.outreach_jobs.find(j => j.n === c.job_n && j.kind === 'correction') : null; const d = job ? draftFor(job) : null;
    return { ...c, draft: d && d.body ? { subject: String(d.subject || ''), body: String(d.body) } : null, status: c.status === 'draft_requested' ? (d && d.body ? 'drafted' : 'draft_failed') : c.status }; });
  const drafts_written = wroteNow.size, handed_over = p.link_builder ? em.prospect_rows.filter(r => /Link Builder/.test(String(r.note || ''))).length : 0;
  const newlyWon = prospect_rows.filter(r => r.status === 'won' && r.won_at === now);
  // ---- targets ----
  const targets = p.targets; const queued = targets.filter(t => t.status === 'queued').sort((a, b) => b.value - a.value); const wonT = targets.filter(t => t.status === 'won' && t.won_at === now);
  // ---- entity (Wikidata) ----
  let entity = p.previous_entity || null;
  const er = eReq.map((q, i) => ({ q, r: jsonOf(eRes[i]) })).filter(x => x.q.site_id === p.site_id);
  if (er.length) { const byName = ((er.find(x => x.q.kind === 'name') || {}).r || {}).search || []; const bySite = er.filter(x => x.q.kind === 'site').flatMap(x => ((x.r.query || {}).search || []).map(s => s.title)).filter(Boolean);
    const qid = bySite[0] || ''; entity = { checked_at: now, found: !!qid, qid, by_site: [...new Set(bySite)], by_name: byName.slice(0, 5).map(s => ({ id: s.id, label: s.label, description: s.description || '' })),
      errors: er.filter(x => !x.r || (!x.r.search && !x.r.query)).length }; }
  // ---- actions (most valuable first) and alerts ----
  const actions = []; const alerts = [];
  const goneP = pages.filter(r => r.gone || GONE.isGone(r.status));
  const gone_pages = GONE.plan(goneP.map(r => ({ url: r.url, status: r.status })), [...pages.filter(r => r.status >= 200 && r.status < 300), ...(p.key_pages || [])].filter(k => !goneP.some(g => keyOf(g.url) === keyOf(k.url))),
    SM.siteUrl({ canonical_host: p.site_host, domain: p.domain }, '/'));
  { const ga = GONE.action(gone_pages); if (ga) { actions.push({ ...ga, why: gone_pages.length + ' key page(s) AI cites or that we track answer ' + [...new Set(gone_pages.map(r => r.status || 404))].join(' / ') + ': every assistant and every searcher who follows them lands on an error page. Do not improve or submit these pages: they no longer exist.' });
    alerts.push({ level: 'high', text: gone_pages.length + ' key page(s) no longer answer (' + gone_pages.slice(0, 3).map(r => r.from).join(', ') + (gone_pages.length > 3 ? ' and more' : '') + '): redirect them to the closest live page.' }); } }
  for (const r of pages.filter(r => !(r.gone || GONE.isGone(r.status)) && (!r.status || r.status >= 400 || r.checks.some(c => c.key === 'indexable' && c.ok === false && r.status >= 200 && r.status < 300)))) {
    actions.push({ priority: 1, type: 'access', action: 'Fix ' + r.url + (r.status >= 400 || !r.status ? ' (answers ' + (r.status || 'nothing') + ')' : ' (not indexable)'), why: r.issues[0] || 'Assistants cannot use a page they cannot fetch or index.' });
    if (['cited', 'target', 'ladder', 'content', 'home'].includes(r.kind)) alerts.push({ level: 'high', text: 'Key page ' + r.url + ' cannot be used by AI: ' + (r.issues[0] || 'error ' + r.status) });
  }
  for (const r of pages.filter(r => r.checks.some(c => c.key === 'raw_text' && c.ok === false))) actions.push({ priority: 1, type: 'render', action: 'Serve the text of ' + r.url + ' in the HTML', why: 'Only ' + r.words_raw + ' words without JavaScript; ChatGPT, Claude, Perplexity and Gemini do not run JavaScript.' });
  // B9-3: robots.txt decides this before anything on the page does — a blocked page is the first thing to fix, and a key page
  // no assistant may read at all is an alert, not a low score.
  for (const r of pages.filter(r => (r.robots_blocked || []).length)) {
    actions.push({ priority: 1, type: 'robots', action: 'Let the AI search fetchers read ' + r.url + ' (robots.txt)', why: r.issues[0] || ('robots.txt blocks ' + r.robots_blocked.join(', ') + ' (' + r.robots_rule + ').') });
    if (r.score_withheld && ['cited', 'target', 'ladder', 'content', 'home'].includes(r.kind)) alerts.push({ level: 'high', text: 'No AI search fetcher may read ' + r.url + ': ' + r.robots_rule + ' in robots.txt. It cannot be quoted whatever is on it.' });
  }
  // B9-8: a page that answers a browser and refuses the AI answer fetchers is a high finding (its score is withheld, never printed)
  for (const r of pages.filter(r => (r.findings || []).some(f => f.key === 'ai_fetchers_refused'))) {
    const f = r.findings.find(f => f.key === 'ai_fetchers_refused');
    actions.push({ priority: 1, type: 'fetchers', action: 'Let the AI answer fetchers read ' + r.url + ' (' + f.bots.join(', ') + ' refused)', why: f.text });
    alerts.push({ level: 'high', text: f.text.slice(0, 300) + ' ' + r.url });
  }
  // B9-7: a wrong claim is either waiting for the owner's fact, or has a correction to review - never sent from here
  for (const c of corrections) {
    if (c.status === 'needs_fact') actions.push({ priority: 2, type: 'fact', action: 'Tell us the true answer to a wrong claim AI makes: "' + c.claim.slice(0, 100) + '"', why: c.note });
    else if (c.status === 'drafted') actions.push({ priority: 2, type: 'correction', action: 'Review the correction drafted for ' + ((c.pages.find(pg => pg.carries_claim) || {}).host || 'the publisher') + ' (it is not sent)', why: 'AI says "' + c.claim.slice(0, 100) + '"; the fact on file: ' + c.true_fact });
    else if (c.status === 'handed_over') actions.push({ priority: 2, type: 'correction', action: 'Approve the Link Builder\'s correction pitch for "' + c.claim.slice(0, 80) + '"', why: c.note });
  }
  // B9-5: a page AI used to cite and has stopped citing — measured from our own stored weekly checks, and the best refresh there is
  for (const kp of (p.key_pages || []).filter(k => k.decay).slice(0, 2)) actions.push({ priority: 2, type: 'decay', action: 'Refresh ' + kp.url + ' — AI has stopped citing it',
    why: 'It was cited in ' + kp.decay.cited_in + ' of the last ' + kp.decay.runs + ' weekly AI checks and in neither of the last two (last cited ' + (kp.decay.last_cited || 'earlier') + '). Update it with new facts and show the new date.', url: kp.url });
  for (const e of earned.filter(e => e.draft || e.action_type === 'reply').slice(0, 3)) actions.push({ priority: 1, type: 'earned', action: e.action, why: 'AI cited "' + (e.title || e.url) + '" ' + e.citations + 'x (' + e.engines.join(', ') + ') for "' + (e.questions[0] || '') + '"' + (e.competitors_named.length ? '; it names ' + e.competitors_named.join(', ') + ' and not you' : '') + (e.draft ? '. A draft is ready.' : ''), url: e.url, draft: e.draft });
  if (!verified) actions.push({ priority: 2, type: 'indexnow', action: 'Put one file on the website: ' + indexnow.key_url, why: 'The file contains just ' + p.indexnow_key + '. Then every new or updated page is notified the same day to the IndexNow engines — Bing (which Microsoft Copilot answers from), Yandex, Naver, Seznam, Yep and Amazon; Google does not take part, and a notification is not an indexing.', key: p.indexnow_key, key_url: indexnow.key_url });
  if (BING && !inAccount) actions.push({ priority: 2, type: 'bing', action: 'Add ' + p.site_host + ' to Bing Webmaster Tools', why: 'Import it from Google Search Console (one click) in the account the agent reads: new pages are then submitted to Bing every week and Bing\'s crawl of each key page is checked.' });
  for (const t of queued.filter(t => !(t.kind === 'refresh' && gone_pages.some(g => keyOf(g.from_url) === keyOf(t.page_url)))).slice(0, 2)) actions.push({ priority: 2, type: t.kind === 'refresh' ? 'refresh' : 'content', action: (t.kind === 'refresh' ? 'Refresh ' + t.page_url + ' to answer "' : 'Write an answer page for "') + t.question + '"', why: t.reason + (p.ai_pages_month > 0 ? '. Queued: the Monday content run writes it (' + p.ai_pages_month + ' AI pages a month).' : '. AI pages are off for this site: write it from the AI visibility page.'), target_id: t.target_id,
    api_body: { mode: 'keyword', keyword: t.keyword, country: p.country, domain: p.domain, page_type: t.page_type || 'Guide', existing_page_url: t.kind === 'refresh' ? t.page_url : '', receive: ['Keyword Report', 'Page Content'], ai_target: { question: t.question, kind: t.kind, fanout: t.fanout.split(' | ').filter(Boolean), sources: JSON.parse(t.sources_json || '[]'), competitors: t.competitors.split(', ').filter(Boolean), target_id: t.target_id } } });
  for (const r of pages.filter(r => ['cited', 'target', 'ladder', 'content'].includes(r.kind) && r.score != null && r.checks.some(c => (c.key === 'fresh' || c.key === 'answer_first') && c.ok !== true)).slice(0, 3)) actions.push({ priority: 3, type: 'page', action: 'Improve ' + r.url + ' (AI-readiness ' + r.score + '/100)', why: r.issues.slice(0, 2).join(' ') });
  if (entity && !entity.found) actions.push({ priority: 3, type: 'entity', action: 'Become a recognised entity', why: 'No Wikidata item has ' + p.domain + ' as its official website. Wikidata accepts organisations with independent sources (press, registries): once covered, create the item with the website (P856), the founding date and the location — knowledge graphs feed AI answers.' });
  for (const w of newlyWon) alerts.push({ level: 'good', text: 'You are now named on ' + w.source_url + ', a page AI cites for your topic.' });
  // B9-4: a win carries the evidence it was called on, and a win that has gone is said out loud instead of standing for ever
  for (const t of wonT) alerts.push({ level: 'good', text: 'AI now names you for "' + t.question + '" — ' + (((p.won_now || []).find(w => w.target_id === t.target_id) || {}).observed || 'measured on the answers of the last 8 days') + ' (an AI target written for it).' });
  for (const w of (p.won_lost || [])) alerts.push({ level: 'medium', text: 'AI has stopped naming you for "' + w.question + '" (won ' + (w.won_at || 'earlier') + ', lost again ' + w.lost_at + '; ' + w.observed + '). It is back in the queue.' });
  // B9-6: a question whose page run was started and never produced a page would otherwise sit "being written" for ever
  for (const st of (p.stalled_targets || [])) alerts.push({ level: 'medium', text: 'The page for "' + st.question + '" was started on ' + st.since + ' and never arrived (' + st.detail + '): the question is back in the queue.' });
  const growth_row = { site_id: p.site_id, domain: p.domain, run_id: p.run_id, checked_at: now, submitted: bing.submitted + indexnow.submitted,
    // B9-2: the run row keeps what became of the submissions, so next week can compare like with like
    submitted_json: J({ bing, indexnow: { ...indexnow, key: undefined }, outcome, refused: refusedSub.slice(0, 10), robots: robots_site ? { found: robots_site.found, unavailable: robots_site.unavailable, reason: robots_site.reason, blocked_pages: (robots_site.blocked_pages || []).length } : null }),
    indexnow: verified ? 'verified' : 'key_missing',
    pages_checked: scored.length, avg_score, pages_json: J(pages.map(r => ({ url: r.url, kind: r.kind, score: r.score, status: r.status, issues: r.issues.slice(0, 3), updated_on: r.updated_on, words_raw: r.words_raw, bing_crawled_at: r.bing_crawled_at, submitted: r.submitted_now }))),
    // 2026-10-19 (agent E4): the questions the fit gate refused (stored `set_aside`, never written) are counted beside the others, so the
    // summary of 6 targets never reads as 4 because two were quietly left out
    targets_json: J({ queued: queued.length, writing: targets.filter(t => t.status === 'writing').length, written: targets.filter(t => t.status === 'written').length, won: targets.filter(t => t.status === 'won').length,
      set_aside: targets.filter(t => t.status === 'set_aside').length, top: queued.slice(0, 5).map(t => ({ target_id: t.target_id, question: t.question, kind: t.kind, page_url: t.page_url, value: t.value })) }),
    earned_json: J(earned.slice(0, 12).map(e => ({ url: e.url, title: e.title, host: e.host, kind: e.kind, citations: e.citations, engines: e.engines, questions: e.questions, mentions_us: e.mentions_us, competitors_named: e.competitors_named, action: e.action, status: e.status, drafted: !!e.draft }))),
    entity_json: entity ? J(entity) : '', actions_json: J(actions.map(({ api_body, draft, ...a }) => a).slice(0, 12)), alerts: alerts.map(a => a.level + ': ' + a.text).join(' | ').slice(0, 2000), cost_usd: oi >= 0 ? 0.03 : 0 };
  const cache_rows = (p.indexnow_new || (verified && !p.indexnow_verified_at)) ? [{ key: 'indexnow:' + p.site_id, kind: 'ai', site_id: p.site_id, value: J({ key: p.indexnow_key, verified_at: verified ? now : '', created_at: now }), updated_at: now }] : [];
  out.push({ json: { site_id: p.site_id, domain: p.domain, site_host: p.site_host, business_name: p.business_name, email: p.email, callback_url: p.callback_url, request_id: p.request_id, on_demand: p.on_demand, run_id: p.run_id, checked_at: now, ai_pages_month: p.ai_pages_month,
    submitted: { bing, indexnow }, outcome, refused_submissions: refusedSub, robots: robots_site, withheld_scores: withheld.length, key_pages: p.key_pages || [], won_lost: p.won_lost || [], win_min_answers: p.win_min_answers || 2,
    pages: pages.map(({ checks, ...r }) => ({ ...r, checks: checks.map(c => ({ key: c.key, ok: c.ok, label: c.label })) })), avg_score, previous_avg_score: p.previous ? p.previous.avg_score : null,
    targets: targets.map(t => ({ target_id: t.target_id, question: t.question, kind: t.kind, page_url: t.page_url, status: t.status, value: t.value, reason: t.reason, engines: t.engines, competitors: t.competitors })),
    // B-G2 (2026-10-15): the rungs the read-path fit gate set aside, with the reason, so the report says why the list is shorter
    set_aside: p.set_aside || [], set_aside_note: p.set_aside_note || '',
    earned, earned_basis: p.earned_basis || null, corrections, entity, actions: actions.slice(0, 12), alerts, drafts_written, handed_over, page_rows, target_rows: targets, prospect_rows, growth_row, cache_rows,
    gone_pages } });   // RV-1: the key pages that no longer answer, with the redirect each needs
}
return out.length ? out : [{ json: { skip: true } }];
