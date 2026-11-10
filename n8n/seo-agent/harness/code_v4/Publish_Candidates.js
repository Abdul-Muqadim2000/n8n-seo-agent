// Publish detection (v4.8, PIPELINE_FEATURE_SPEC §6.5), step 1: per tracked site, the pages written but not published yet — seo_content_log
// rows not yet published ("started" / "written", no publish link) from the last 120 days, plus seo_ladders rows "writing" (one candidate per keyword) — and the sitemap
// to read. A page that improves an EXISTING URL (striking-distance rewrite, ladder page
// that already existed) cannot be told apart by its URL, so it is matched only when the sitemap says that URL changed after the page was written.
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
// ---- LADDER PACKAGE (2026-11-09, docs/keyword-intel-2026-11-08/fixes/LADDER.md): the five ladder rules, ONE copy ----
// Production (2026-10-22 .. 11-08, R3_PROD_OUTPUTS.md F1 F6 F7 F9): three rungs of techand.ai's ERP ladder, the main page included, were written onto
// ONE blog address (/insights/is-microsoft-dynamics-365-an-erp-system); the CRM ladder's main page pointed at "/dynamics-365-crm-uae-2", a copy
// of the live CRM page; a rung the verdict called AVOID was written and published because ladder page runs carry force_content; a rung sat
// in "writing" for days after its run died; devaicon.com's "ai automation solutions gcc" was measured in Pakistan. The rules:
//   1. one search, one address: two rungs never share a target, a rung whose address already answers its search improves that page, and the
//      main page is never a blog / insights address or a "-2" / "-copy" variant of a live page (addresses compared without scheme / www);
//   2. the rungs step towards the main keyword (stage: problem, solution, compare, hire); a plan with no compare / hire rung before the main
//      page is re-planned from its own pool, and a pure definition ("what is a crm company") is a rung only when its results page is
//      informational (guides) and it links to the main page;
//   3. the market is the website's market, or the market the keyword names ("gcc", "uae", "dubai" -> AE); never another country;
//   4. an AVOID verdict, or a score clearly under the line (40), stops the rung: no page is written until the client says "Write it anyway";
//   5. a rung "writing" for longer than three times its expected time (at least 60 minutes) with nothing of its run still alive is closed as
//      failed with its reason, so the next rung can go.
// Inlined into Ladder Plan, Ladder Duplicate (Words), Parse Verdict's ladder stop (Ladder Row Written), Cadence Plan, Publish Candidates and
// Publish Check (through _publish_rows.js); the app runs the same source (app/shared/src/ladder-rules.generated.js, ladder_rules_app.py) for
// its warnings, its rung reasons and its stuck-rung watcher. Pure: no clock (pass `now`), no table, no network. Needs fitPlaces
// (_fit_gate.js) only for the market rule; everything else stands alone.
const LRU = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const low = (v) => S(v).toLowerCase();
  const CFG = {
    stuck_min_minutes: 60, stuck_eta_factor: 3, page_eta_minutes: 20,   // page runs take 15-19 minutes on production (2026-11-08)
    clear_score: 40,                                                    // Parse Verdict's "clearly low" line (HOLD CFG.clear)
    rank_keep_position: 30, rank_keep_impressions: 10,                  // review H5: a page that ranks for the main keyword keeps it
    blog_dirs: ['blog', 'blogs', 'insights', 'insight', 'articles', 'article', 'news', 'resources', 'resource', 'posts', 'post', 'learn', 'guides', 'guide', 'knowledge', 'academy', 'stories', 'magazine'],
    // the measurable markets (Normalize Input COUNTRIES): ISO-2 -> the country name the engine and the app use
    countries: { US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia', NZ: 'New Zealand', IE: 'Ireland', PK: 'Pakistan', IN: 'India',
      AE: 'United Arab Emirates', SA: 'Saudi Arabia', SG: 'Singapore', ZA: 'South Africa', DE: 'Germany', FR: 'France', ES: 'Spain', IT: 'Italy',
      NL: 'Netherlands', BR: 'Brazil', MX: 'Mexico' },
  };
  const STAGES = ['problem', 'solution', 'compare', 'hire', 'info'];
  const COMMERCIAL = ['compare', 'hire'];

  // ---- addresses (rule 1) ----
  /** the comparable form of an address: no scheme, no www., no query / fragment, no trailing slash, lower case ('' for nothing) */
  const urlKey = (u) => low(u).replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const pathOf = (u) => { const k = urlKey(u); const i = k.indexOf('/'); return i < 0 ? '' : k.slice(i); };
  const segs = (u) => pathOf(u).split('/').filter(Boolean);
  // a language prefix (/en/, /ar-ae/) is not the first folder that says what the page is
  const LOCALE = /^[a-z]{2}(?:-[a-z]{2})?$/;
  /** a blog / insights / news ... address: its first folder (after a language prefix) is one of CFG.blog_dirs */
  const isBlog = (u) => { let s = segs(u); if (s.length > 2 && LOCALE.test(s[0])) s = s.slice(1); return s.length > 1 && CFG.blog_dirs.includes(s[0]); };
  // review L1 (2026-11-10): only suffixes that mean "another copy of the same page"; -new, -v9, a bare word like /windows-11 are not copies
  const COPY_RE = /^(.+?)-(copy(?:-\d+)?|\d|old|draft|backup|bak)$/;
  const titleKey = (t) => low(t).replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();
  /** a "-2" / "-copy" / "-old" variant of another address of the site: -> the original's address, or ''. `known`: the site's pages, as
   *  addresses or { url, title }. A one-digit suffix counts only when the address without it is a page the site has AND, when both titles
   *  are known, they are the same page title (so /step-2 beside a different /step is not a copy); "-copy" always counts. */
  const copyOf = (u, known) => {
    const s = segs(u); if (!s.length) return '';
    const m = s[s.length - 1].match(COPY_RE); if (!m) return '';
    const base = urlKey(u).replace(/[^/]+$/, m[1]);
    const list = (Array.isArray(known) ? known : []).map(x => x && typeof x === 'object' ? { k: urlKey(x.url), url: S(x.url), title: titleKey(x.title) } : { k: urlKey(x), url: S(x), title: '' }).filter(x => x.k);
    const orig = list.find(x => x.k === base), self = list.find(x => x.k === urlKey(u));
    if (orig) { if (/^\d$/.test(m[2]) && orig.title && self && self.title && orig.title !== self.title) return ''; return orig.url || base; }
    return /^copy/.test(m[2]) ? base : '';
  };
  // the same search in other words: every word kept, joining words dropped, a plural folded (the H2 target_guard rule of Ladder_Plan.js)
  const JOIN = new Set(['in', 'the', 'a', 'an', 'of', 'for', 'to', 'on', 'at', 'and', 'with', 'by', 'from']);
  const wordsKey = (kw) => [...new Set(low(kw).split(/[^a-z0-9؀-ۿ]+/).filter(t => t && !JOIN.has(t)).map(t => t.length > 3 ? t.replace(/ies$/, 'y').replace(/([^s])s$/, '$1') : t))].sort().join(' ');
  const sameSearch = (a, b) => { const x = low(a), y = low(b); if (!x || !y) return false; if (x === y) return true; const wa = wordsKey(x); return !!wa && wa === wordsKey(y); };
  /** who already holds an address: owners [{ url, keyword, supporting?: [..], ladder_id?, by? }] -> the owner of `url` whose search is NOT
   *  `keyword` (nor one of its supporting keywords), or null. The same search may always improve its own page. */
  const ownerOf = (url, keyword, owners, mine) => {
    const k = urlKey(url); if (!k) return null;
    const kws = [keyword, ...(Array.isArray(mine) ? mine : [])].map(low).filter(Boolean);
    for (const o of (Array.isArray(owners) ? owners : [])) {
      if (!o || urlKey(o.url) !== k || !S(o.keyword)) continue;
      const theirs = [o.keyword, ...(Array.isArray(o.supporting) ? o.supporting : String(o.supporting || '').split(','))].map(low).filter(Boolean);
      if (kws.some(a => theirs.some(b => sameSearch(a, b)))) continue;   // the same search: its own page (another owner may still hold it)
      return o;
    }
    return null;
  };
  /** the address a new page gets on the site: home + slug(keyword), with the site's trailing-slash form */
  const plannedUrl = (home, keyword, slash) => { const h = S(home).replace(/\/+$/, ''); const sl = low(keyword).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return h && sl ? h + '/' + sl + (slash ? '/' : '') : ''; };
  /** review H5: does this address already rank for the main keyword? o: { rank: { position, url } (the rank check or the ranked pull),
   *  pages: [{ url, queries: [{ query, impressions, position }] }] (Search Console per page) } -> true when the rank reading puts this
   *  address at position <= 30, or Search Console shows it for a search holding every word of the keyword at position <= 30 or with
   *  10+ impressions. A page that ranks is improved, never left for a competing new page. */
  const ranksFor = (url, keyword, o) => {
    const x = o || {}; const k = urlKey(url); if (!k) return false;
    const r = x.rank || null; const rp = r ? Number(r.position) : NaN;
    if (r && Number.isFinite(rp) && rp >= 1 && rp <= CFG.rank_keep_position && (!S(r.url) || urlKey(r.url) === k)) return true;
    const want = wordsKey(keyword).split(' ').filter(Boolean); if (!want.length) return false;
    for (const p of (Array.isArray(x.pages) ? x.pages : [])) {
      if (!p || urlKey(p.url) !== k) continue;
      for (const q of (Array.isArray(p.queries) ? p.queries : [])) {
        const have = new Set(wordsKey((q || {}).query || (q || {}).keyword).split(' '));
        if (!want.every(w => have.has(w))) continue;
        const pos = Number((q || {}).position), imp = Number((q || {}).impressions) || 0;
        if ((Number.isFinite(pos) && pos >= 1 && pos <= CFG.rank_keep_position) || imp >= CFG.rank_keep_impressions) return true;
      }
    }
    return false;
  };
  /** rule 1 for the MAIN page: a blog address, or a copy of a live page, is never its target. -> null (fine) or { reason, was, to, exists }:
   *  a copy points back to the original page (improve it); a blog address gets the commercial page the site has (`commercial`, a URL
   *  found by the caller among non-blog pages), else a new page at `planned`. */
  const headTarget = (url, o) => {
    const opt = o || {}; const u = S(url); if (!u) return null;
    const orig = copyOf(u, opt.known || []);
    if (orig) return { reason: 'copy', was: u, to: S(orig).startsWith('http') ? S(orig) : (S(opt.home).replace(/\/+$/, '') + pathOf(orig)), exists: true,
      text: u.replace(/^https?:\/\/[^\/]+/i, '') + ' is a copy of ' + pathOf(orig) + ', a page your website already has: the main page improves that page instead of a second copy' };
    if (isBlog(u)) { const c = S(opt.commercial);
      return c ? { reason: 'blog', was: u, to: c, exists: true, text: 'the main page is a page people choose a provider on, not a blog post: ' + c.replace(/^https?:\/\/[^\/]+/i, '') + ' improves instead of ' + u.replace(/^https?:\/\/[^\/]+/i, '') }
        : { reason: 'blog', was: u, to: S(opt.planned), exists: false, text: 'the main page is a page people choose a provider on, not a blog post (' + u.replace(/^https?:\/\/[^\/]+/i, '') + '): it gets its own page at ' + S(opt.planned).replace(/^https?:\/\/[^\/]+/i, '') }; }
    return null;
  };
  /** rule 1 inside one plan: pages [{ keyword, target_url, exists, rung, supporting }] in plan order (the main page first) -> { pages, moved }.
   *  Two pages on one address: the first keeps it; a later page of the SAME search joins it as a supporting keyword, any other gets its own
   *  new address (`planned(keyword)`). */
  const oneUrl = (pages, planned) => {
    const seen = new Map(); const out = []; const moved = [];
    for (const p of (Array.isArray(pages) ? pages : [])) {
      const k = urlKey(p && p.target_url); if (!p || !k) { out.push(p); continue; }
      const o = seen.get(k);
      if (!o) { seen.set(k, p); out.push(p); continue; }
      if (sameSearch(o.keyword, p.keyword)) { o.supporting = [...new Set([...(o.supporting || []), p.keyword, ...(p.supporting || [])])]; moved.push({ keyword: p.keyword, to: o.keyword, url: o.target_url, how: 'joined', text: '"' + p.keyword + '" is the same search as "' + o.keyword + '", so it is a supporting keyword of that page' }); continue; }
      const nu = typeof planned === 'function' ? S(planned(p.keyword)) : '';
      if (!nu || seen.has(urlKey(nu))) { moved.push({ keyword: p.keyword, to: o.keyword, url: o.target_url, how: 'dropped', text: '"' + p.keyword + '" had the same address as "' + o.keyword + '" and no address of its own could be made, so it waits' }); continue; }
      moved.push({ keyword: p.keyword, from: p.target_url, url: nu, how: 'own address', text: '"' + p.keyword + '" had the same address as "' + o.keyword + '" (' + pathOf(p.target_url) + '): one search, one page, so it gets its own page at ' + pathOf(nu) });
      Object.assign(p, { target_url: nu, exists: false, status: 'new', existing_source: null, existing_confidence: null, existing_evidence: '' });
      seen.set(urlKey(nu), p); out.push(p);
    }
    return { pages: out, moved };
  };

  // ---- the buyer's stage (rule 2) ----
  const Q_START = /^(?:what|who|why|when|where|which|is|are|does|do|can|should|will|how)\b/;
  const W_COMPARE = /\b(?:best|top|vs|versus|alternatives?|compare|comparison|comparing|pricing|prices?|costs?|fees?|quotes?|reviews?|rated|cheapest|affordable|rankings?|list of)\b/;
  const W_HIRE = /\b(?:compan(?:y|ies)|agenc(?:y|ies)|firms?|providers?|partners?|consultants?|consultanc(?:y|ies)|contractors?|developers?|vendors?|integrators?|resellers?|specialists?|experts?|freelancers?|hire|hiring|near me|services|consulting)\b|\b(?:consulting|implementation|development|support|migration|integration|outsourcing) services?\b/;
  const W_PROBLEM = /\b(?:deadlines?|penalt(?:y|ies)|fines?|mandate|mandatory|requirements?|compliance|compliant|regulations?|law|laws|problems?|issues?|errors?|not working|fix|risks?|challenges?|obligations?)\b/;
  const W_SOLUTION = /\b(?:software|system|systems|platform|platforms|tools?|solutions?|apps?|applications?|modules?|features?|implementation|migration|integration|upgrade|automation|development|hosting|cloud|erp|crm|hrms|lms|setup|service)\b/;
  const W_DEFINE = /^(?:what (?:is|are|does)|what's|whats|define|definition of|meaning of)\b/;
  const W_SELLER_NOUN = /\b(?:compan(?:y|ies)|agenc(?:y|ies)|firms?|providers?|partners?|consultants?|consultanc(?:y|ies)|vendors?|integrators?|specialists?)\b/;
  /** the stage of a search: a stored KI stage when there is one, else the words, else the intent the research gave -> one of STAGES */
  const stageOf = (keyword, intent, stored) => {
    const st = low(stored); if (STAGES.includes(st)) return st;
    const k = low(keyword).replace(/[^a-z0-9؀-ۿ&]+/g, ' ').trim();
    if (!k) return 'info';
    if (W_COMPARE.test(k)) return 'compare';
    if (Q_START.test(k)) return W_PROBLEM.test(k) ? 'problem' : 'info';
    if (W_HIRE.test(k)) return 'hire';
    if (W_PROBLEM.test(k)) return 'problem';
    if (W_SOLUTION.test(k)) return 'solution';
    const i = low(intent);
    return i === 'commercial' || i === 'transactional' ? 'solution' : 'info';
  };
  const isCommercial = (stage) => COMMERCIAL.includes(low(stage));
  /** a pure definition of a seller ("what is a crm company", "meaning of erp partner"): a page for people learning a word, not buyers */
  const isDefinitional = (keyword) => { const k = low(keyword); return W_DEFINE.test(k) && W_SELLER_NOUN.test(k); };
  /** rule 2: may a definitional rung stay? only when its results page was read and is informational (guides lead) and it links to the main page */
  const definitionalOk = (o) => { const x = o || {}; return !!x.serp_informational && !!x.links_up; };
  const STAGE_WORDS = { problem: 'people with a problem to solve', solution: 'people looking for a solution', compare: 'people comparing providers or options', hire: 'people ready to choose a provider', info: 'people learning about the topic' };
  const stageText = (stage) => STAGE_WORDS[low(stage)] || STAGE_WORDS.info;

  // ---- the market (rule 3) ----
  const placesOf = (s) => { try { return typeof fitPlaces === 'function' ? fitPlaces(s) : []; } catch (e) { return []; } };
  const countryName = (iso) => CFG.countries[S(iso).toUpperCase()] || '';
  /** -> { iso, country, source: 'keyword' | 'site' | 'request', named: [place words], keyword_iso, ok (the request market is the lock), changed,
   *  measurable, note }. o: { keyword, site_iso (the website's market), request_iso (what the run was sent with) }.
   *  A keyword that names places stands for those places: the website's market when it is among them ("gcc" for a UAE website), else the
   *  first measurable country it names (a region: its first country, "gcc" -> AE); a keyword that names no place is the website's market.
   *  Never a third country: the request's market is used only when there is neither a place in the keyword nor a website market. */
  const market = (o) => {
    const x = o || {}; const site = S(x.site_iso).toUpperCase(), req = S(x.request_iso).toUpperCase();
    const places = placesOf(x.keyword); const named = places.map(p => p.word);
    let iso = '', source = '', keyword_iso = '';
    if (places.length) {
      const isos = [...new Set(places.flatMap(p => p.iso || []))];
      keyword_iso = site && isos.includes(site) ? site : (isos.find(i => CFG.countries[i]) || isos[0] || '');
      iso = keyword_iso; source = site && iso === site ? 'site' : 'keyword';
    } else if (site) { iso = site; source = 'site'; }
    else { iso = req; source = 'request'; }
    const unmeasured = !CFG.countries[iso] && !!site;
    if (unmeasured) { iso = site; source = 'site'; }   // a named market we cannot measure (Qatar): the website's own, said so
    // review M1: a request for a measurable country INSIDE the places the keyword names is that market ("erp software gcc" sent with Saudi Arabia)
    const namedIsos = [...new Set(places.flatMap(p => p.iso || []))];
    if (req && req !== iso && namedIsos.includes(req) && CFG.countries[req]) { iso = req; source = 'keyword'; }
    const ok = !req || req === iso;
    const nm = (i) => countryName(i) || i;
    const note = !iso ? '' : source === 'keyword'
      ? 'The keyword names ' + named.join(', ') + ', so this ladder is measured in ' + nm(iso) + (site ? ', not in your website\'s market (' + nm(site) + ')' : '') + '.'
      : places.length && keyword_iso && keyword_iso !== iso ? 'The keyword names ' + named.join(', ') + ', which we cannot measure, so this ladder is measured in your website\'s market (' + nm(iso) + ').'
      : places.length ? 'The keyword names ' + named.join(', ') + ', which includes your website\'s market (' + nm(iso) + '), so it is measured there.'
      : source === 'site' ? 'Measured in your website\'s market (' + nm(iso) + ').' : '';
    return { iso, country: nm(iso), source, named, keyword_iso, request_iso: req, ok, changed: !!req && req !== iso, measurable: !!CFG.countries[iso], note };
  };
  /** the sentence a refused run carries when its market contradicts the lock (Ladder Duplicate (Words), before anything is paid) */
  const marketRefusal = (m, keyword) => !m || m.ok ? '' : 'This ladder was sent to be measured in ' + (countryName(m.request_iso) || m.request_iso) + ', but "' + S(keyword) + '" '
    + (m.source === 'keyword' ? 'names ' + m.named.join(', ') + ' (' + m.country + ')' : 'names no place and your website\'s market is ' + m.country)
    + '. A ladder is measured in one market, so nothing was planned and nothing was charged: start it again in ' + m.country
    + (m.source === 'site' && !m.named.length ? ', or confirm that you want it measured in ' + (countryName(m.request_iso) || m.request_iso) + ' on purpose.' : '.');

  // ---- verdicts (rule 4) ----
  /** o: { verdict: 'GO' | 'GO_WITH_CHANGES' | 'AVOID' | ..., score: 0-100 | null, ack: the client said "Write it anyway" } -> { stop, reason, band } */
  const verdictStop = (o) => {
    const x = o || {}; const v = S(x.verdict).toUpperCase(); const sc = x.score === '' || x.score == null || !Number.isFinite(Number(x.score)) ? null : Math.round(Number(x.score));
    const band = v === 'AVOID' ? 'avoid' : sc != null && sc < CFG.clear_score ? 'clearly_low' : '';
    if (!band) return { stop: false, reason: '', band: '' };
    if (x.ack) return { stop: false, reason: 'you chose to write it anyway', band, overridden: true };
    return { stop: true, band, score: sc,
      reason: band === 'avoid' ? 'our check advised against this page (AVOID' + (sc != null ? ', score ' + sc : '') + ')' : 'our check scored it ' + sc + ' out of 100, clearly under the ' + CFG.clear_score + ' we write without asking' };
  };

  // ---- stuck rungs (rule 5) ----
  /** o: { status, since (ISO: when it went to writing / was started), eta_minutes, live: true | false | null (null = could not be asked), now (ISO or ms) }
   *  -> { stuck, minutes, limit, reason } */
  const stuck = (o) => {
    const x = o || {}; const st = low(x.status);
    const eta = Number.isFinite(Number(x.eta_minutes)) && Number(x.eta_minutes) > 0 ? Number(x.eta_minutes) : CFG.page_eta_minutes;
    const limit = Math.max(CFG.stuck_min_minutes, CFG.stuck_eta_factor * eta);
    const t = Date.parse(S(x.since)); const now = typeof x.now === 'number' ? x.now : Date.parse(S(x.now));
    if (!['writing', 'started'].includes(st) || !Number.isFinite(t) || !Number.isFinite(now)) return { stuck: false, minutes: null, limit, reason: '' };
    const minutes = Math.max(0, Math.round((now - t) / 60000));
    if (minutes < limit) return { stuck: false, minutes, limit, reason: '' };
    if (x.live !== false) return { stuck: false, minutes, limit, reason: x.live === true ? 'still running' : 'the engine could not be asked whether it is still running' };
    return { stuck: true, minutes, limit, reason: 'the page run stopped without a result: it was being written for ' + minutes + ' minutes (more than ' + limit + ') and nothing of it is still running' };
  };

  // ---- what a rung row tells the client (the app's ladder page) ----
  /** row: a seo_ladders row; o: { next: the keyword the ladder writes next, now } -> { state, label, why, url } */
  const rungState = (row, o) => {
    const r = row || {}; const st = low(r.status || 'planned'); const url = S(r.target_url); const note = S(r.status_note);
    const exists = r.page_exists === true || r.page_exists === 'true';
    const path = url.replace(/^https?:\/\/[^\/]+/i, '') || '/';
    const tw = S(r.target_why);
    if (st === 'stopped') return { state: 'stopped', label: 'Stopped', why: note.replace(/^stopped:\s*/i, '') || 'our check advised against this page', url };
    if (st === 'failed') return { state: 'failed', label: 'Stopped without a result', why: note.replace(/^failed:\s*/i, '') || 'the page run stopped without a result', url };
    if (st === 'merged') return { state: 'merged', label: 'Part of another page', why: note.replace(/^merged:\s*/i, '') || 'it is a section of another page of this ladder', url };
    if (st === 'set_aside') return { state: 'set_aside', label: 'Set aside', why: note || 'it is not a search for this website', url };
    if (st === 'published') return { state: 'published', label: 'Live', why: 'published at ' + path, url };
    if (st === 'written' || st === 'not_ready') return { state: st, label: st === 'written' ? 'Written, waiting to be published' : 'Written, needs a fix', why: note || (exists ? 'improves ' + path : 'a new page at ' + path), url };
    if (st === 'writing') return { state: 'writing', label: 'Being written', why: exists ? 'improves ' + path : 'a new page at ' + path, url };
    const nxt = (o || {}).next ? sameSearch((o || {}).next, r.keyword) : false;
    return { state: exists ? 'improve' : 'new', label: exists ? 'Improves an existing page' : 'New page', why: (tw || (exists ? 'your page ' + path + ' already answers this search, so it is improved, not written twice' : 'a page you do not have yet, at ' + path))
      + (nxt ? '' : note ? ' (' + note + ')' : ''), url, waiting: !nxt };
  };

  // ---- rule 6: keyword intelligence as the ladder's pool ----
  /** o: { mode (seo_monitors.ki_mode), killed (true | false | null = unread: counts as killed), rows (seo_ki_keywords of the site), runs
   *  (seo_ki_runs of the site), market ('AE-en'), min (default 3) } -> { used, reason, run_id, rows (one head per cluster, gate pass, not
   *  gated), avoid (keywords the client's checks advised against), note }. Read only when the site's mode is exactly 'on' and the kill
   *  switch reads off (fails closed, KI.readable's rule); only the rows of the latest finished keyword-research run of this market
   *  (CONTRACTS KI_ROW_CURRENT). Fewer than `min` usable heads: not used, and the ladder keeps its own research, said so. */
  const kiPool = (o) => {
    const x = o || {}; const mode = low(x.mode); const mk = S(x.market);
    const off = (reason, note) => ({ used: false, reason, run_id: '', rows: [], avoid: [], note: note || '' });
    if (mode !== 'on') return off(mode ? 'ki_' + mode : 'ki_off');
    if (x.killed !== false) return off('killed', 'Keyword intelligence is paused for every website, so this ladder used its own keyword research.');
    const runs = (Array.isArray(x.runs) ? x.runs : []).filter(r => r && low(r.kind) === 'keyword_research' && ['ok', 'partial'].includes(low(r.status)) && (!mk || S(r.market) === mk))
      .sort((a, b) => S(b.finished_at || b.started_at).localeCompare(S(a.finished_at || a.started_at)));
    const cur = runs[0] ? S(runs[0].run_id) : '';
    if (!cur) return off('no_run', 'Keyword intelligence is on, but no finished keyword research is on file for ' + (mk || 'this market') + ', so this ladder used its own keyword research.');
    const all = (Array.isArray(x.rows) ? x.rows : []).filter(r => r && S(r.keyword) && S(r.run_id) === cur && (!mk || S(r.market) === mk));
    const yes = (v) => v === true || v === 'true';
    const pass = all.filter(r => low(r.gate) === 'pass' && low(r.verdict) !== 'gated');
    const anyHead = pass.some(r => yes(r.is_head));
    const heads = pass.filter(r => !anyHead || yes(r.is_head));
    const avoid = all.filter(r => low(r.gate_reason) === 'avoid').map(r => S(r.keyword));
    const min = Number(x.min) > 0 ? Number(x.min) : 3;
    if (heads.length < min) return { ...off('too_few', 'Keyword intelligence holds only ' + heads.length + ' usable search' + (heads.length === 1 ? '' : 'es') + ' for ' + (mk || 'this market') + ' (at least ' + min + ' are needed), so this ladder used its own keyword research.'), run_id: cur, avoid };
    return { used: true, reason: '', run_id: cur, rows: heads, avoid,
      note: 'The supporting pages come from keyword intelligence: ' + heads.length + ' search groups of its last keyword research (' + cur + '), one search per group, with its verdict, page action and Search Console position.' };
  };

  return { CFG, STAGES, COMMERCIAL, kiPool, ranksFor, urlKey, pathOf, isBlog, copyOf, wordsKey, sameSearch, ownerOf, plannedUrl, headTarget, oneUrl,
    stageOf, isCommercial, isDefinitional, definitionalOk, stageText, countryName, market, marketRefusal, verdictStop, stuck, rungState };
})();
// 2026-10-12 (FIX_PLAN D11): the sitemap is now read for EVERY tracked site, not only for the ones with a page waiting — the same one plain GET
// also builds the week's page inventory (seo_pages), which is what stops the agent recommending a page the site already has. `detect` says
// whether this site has anything to match; a site without a waiting page still makes no page fetch (only the sitemap is read).
const CONFIG = { max_age_days: 120, max_candidates_per_site: 40 };
// D15: the sitemap is read on the site's canonical host (this run's models, *Site Model (Site)*); with no model the bare domain, as before.
const siteModels = (() => { try { return $('Site Model (Site)').all().map(i => i.json).filter(x => x && x.model); } catch (e) { return []; } })();
const modelFor = (site_id, dom) => (siteModels.find(x => x.site_id === site_id) || {}).model || { domain: dom };
const plan = $('Site Plan').all().map(i => i.json).filter(p => p && !p.nothing_to_do && p.domain);
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();   // the keyword key of Publish Check
const isTrue = (v) => v === true || v === 'true';
const logs = rowsOf('Load Content Log').filter(r => r.keyword && r.domain);
const ladders = rowsOf('Load Ladders').filter(r => r.ladder_id && r.domain && r.keyword);
const cutoff = Date.now() - CONFIG.max_age_days * 864e5;
const out = [];
plan.forEach((s, idx) => {
  const d = s.domain;
  const L = logs.filter(r => normD(r.domain) === d), LD = ladders.filter(r => normD(r.domain) === d);
  const published = new Set(L.filter(r => r.status === 'published' || String(r.published_url || '').trim()).map(r => norm(r.keyword)));
  const ladderOf = (kw) => LD.find(l => norm(l.keyword) === kw) || null;   // as Publish Check: the domain's ladder row for this keyword
  const cands = new Map();
  for (const r of L) {
    if (r.status === 'published' || String(r.published_url || '').trim()) continue;   // D5: 'started' (the run was spawned) and 'written' (the page exists) both wait
    if (r.status === 'failed') continue;   // W06-B (2026-10-30): a page run that failed wrote no page, so there is nothing to find live
    const t = Date.parse(r.started_at); if (!(t >= cutoff)) continue;
    const kw = norm(r.keyword); if (!kw || cands.has(kw) || published.has(kw)) continue;
    const ladder = ladderOf(kw); if (ladder && ladder.status === 'published') continue;   // already recorded through the ladder
    cands.set(kw, { key: kw, keyword: r.keyword, source: 'content_log', log: r, ladder, written_at: String(r.started_at || '') });
  }
  for (const l of LD) {
    if (!['writing', 'written', 'not_ready'].includes(l.status)) continue;   // A-20: a ladder row follows its content log (written / not_ready) once the page run ends
    const kw = norm(l.keyword); if (!kw || cands.has(kw) || published.has(kw)) continue;
    const log = L.filter(r => norm(r.keyword) === kw).sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0] || null;   // an older log row of the same page (kept in the rows)
    cands.set(kw, { key: kw, keyword: l.keyword, source: 'ladder', log, ladder: l, written_at: String((log && log.started_at) || l.start_date || '') });
  }
  // R111 (2026-10-16): a draft whose last quality round failed (`not_ready`) is still watched — an owner who publishes it anyway is
  // found — and carries the flag, so whatever records it can say the page went live without passing the quality check
  // LADDER PACKAGE (2026-11-09, rule 1 at publish time): the addresses other searches of this website hold (published / existing ladder pages,
  // published content-log pages). A waiting page whose "existing address" is ANOTHER search's page is not matched there: that is how three
  // rungs of techand.ai's ERP ladder were recorded live on one blog address (2026-10-29). It is looked for at its own planned address only.
  // review M2: never a row merged into the page; a content-log page only where it was FIRST published (not a one-off refresh)
  const owners = [...LD.filter(l => l.target_url && l.status !== 'merged' && (l.status === 'published' || isTrue(l.page_exists))).map(l => ({ url: l.target_url, keyword: l.keyword, supporting: l.supporting, ladder_id: l.ladder_id })),
    ...L.filter(r => String(r.published_url || '').trim() && !String(r.existing_page_url || '').trim()).map(r => ({ url: r.published_url, keyword: r.keyword, ladder_id: r.ladder_id || '' }))];
  const list = [...cands.values()].map(c => {
    let existing = String((c.log && c.log.existing_page_url) || '').trim() || (c.ladder && isTrue(c.ladder.page_exists) ? String(c.ladder.target_url || '').trim() : '');
    // review H2: only a LADDER page is kept off another search's address (a cadence / AI refresh of a page is matched on that page, as before)
    const takenBy = (existing && c.ladder) ? LRU.ownerOf(existing, c.keyword, owners, String((c.ladder || {}).supporting || '').split(',').map(x => x.trim()).filter(Boolean)) : null;
    if (takenBy) existing = '';
    const planned = c.ladder && !isTrue(c.ladder.page_exists) ? String(c.ladder.target_url || '').trim() : '';
    return { ...c, existing_url: /^https?:\/\//i.test(existing) ? existing : '', planned_url: /^https?:\/\//i.test(planned) ? planned : '', ladder_id: (c.log && c.log.ladder_id) || (c.ladder && c.ladder.ladder_id) || '',
      ...(takenBy ? { address_taken: { url: String(takenBy.url || ''), keyword: String(takenBy.keyword || '') } } : {}),
      qa_failed: !!(c.log && String(c.log.status || '') === 'not_ready') };
  }).sort((a, b) => String(b.written_at).localeCompare(String(a.written_at))).slice(0, CONFIG.max_candidates_per_site);
  // URLs that already belong to other pages of the site (published pages, pages that existed before) are never claimed by a new page
  const known = [...new Set([...L.flatMap(r => [r.published_url, r.existing_page_url]), ...LD.filter(l => l.status === 'published' || isTrue(l.page_exists)).map(l => l.target_url)].map(u => String(u || '').trim()).filter(u => /^https?:\/\//i.test(u)))];
  out.push({ json: { site_idx: idx, site_id: s.site_id, domain: d, sitemap_url: SM.siteUrl(modelFor(s.site_id, d), '/sitemap.xml'), candidates: list, known, owners, detect: list.length > 0 } });
});
return out.length ? out : [{ json: { skip: true, reason: 'no tracked site to read a sitemap for', sites: plan.length } }];
