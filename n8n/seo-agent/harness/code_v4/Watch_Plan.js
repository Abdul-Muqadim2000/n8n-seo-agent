// G11 (2026-10-13, system review FIX_PLAN.md): what the daily key-page watch fetches today. Per tracked site: the key pages of the one site
// model (home page, the pages in the menu, the pages Search Console brings impressions for, the pages the keyword ladders and the AI growth
// loop own — all of them already in `seo_pages`, never a fresh crawl) plus `/robots.txt`. One plain GET each, no paid API, nothing rendered.
// A site with nothing to watch makes no request. The re-check queue ("I fixed this" in the app: seo_audit_findings.recheck_state = requested)
// is carried on every item of its site, so the same fetches answer it (G11's second half).
// Build section 194 (client report 2026-11-17, devaicon.com F5 / F10): a key page whose stored row says it MOVED (seo_page_watch.moved_to, a
// permanent redirect to a working page seen on two reads) is watched at its new address, and the old address is listed in `moved` so its open
// alerts close with the move; the stored robots.txt reading (state, parsed rules, last good copy) rides on the site for the state machine; the
// moves Steps on your website asked for (seo_index_pages improved_to / merge_into) mark a redirect "as asked"; the pages we published in the
// last 14 days make a title change Info ("your new title is live"); and the site's open Page Watch alerts come along so the alert lifecycle
// updates or resolves them instead of writing a new row a day.
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
    const declared_services = uniq([...declListOf(x.declared_services), ...declListOf(row.declared_services)].map(s => S(s).slice(0, 120))).filter(Boolean).slice(0, 30);
    const services = uniq([...declared_services, ...listOf(x.services), ...listOf(desc0.products_or_services), ...listOf(desc0.services), ...listOf(desc0.main_services), ...(jparse(row.services_json, []) || [])].map(s => S(s).slice(0, 120))).filter(Boolean).slice(0, 30);
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
  // section 189 (production review 2026-11-12): an address that answers a redirect (3xx to another path, read by the daily page watch) is not a
  // page: no search is matched to it and no rule names it as the page for a search
  const isMoved = (p) => { const n = Number((p || {}).http_status) || 0; return n >= 300 && n < 400; };
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
    const inv = pages(model).filter(p => !isGone(p) && !isMoved(p));   // RV-1: a gone page answers nothing; section 189: nor does an address that redirects
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
    titleShare, titleGap, canonUrl, isListing, pageScore, pageStep, isGone, isMoved, gonePages, confirmPage,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml, matchTerms, coreTerms } };
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

  // ---- robots.txt: a state machine that follows what Google does (client report 2026-11-17, devaicon.com F5; build section 194) ----
  // Google's robots.txt rules (developers.google.com/search/docs/crawling-indexing/robots/robots_txt): 2xx is read as served; 3xx is followed
  // up to five hops and an unresolved chain counts as a 404; 4xx (except 429) means "no robots.txt": Google crawls everything; 5xx and 429
  // mean Google stops crawling for 12 hours, then uses its last copy for up to 30 days; an HTML page served as robots.txt is parsed for rules
  // and the rest ignored. The watch used to hash whatever came back: devaicon's 404 page (20 KB of Next.js HTML) became "2,085 characters of
  // rules" and a High alert, and every new deploy id in that page raised it again. Now: a state (ok / missing / unreachable / html), the
  // PARSED rules (groups, allow / disallow lines, sitemap lines) compared as rules, and a severity that says what Google will do.
  const ROBOTS_V = 2;   // the fingerprint below is of the parsed rules; a stored fingerprint of another version is a baseline, never a change
  const robotsParse = (text) => {
    const groups = []; const sitemaps = []; let cur = null; let lastUA = false;
    for (const raw of S(text).replace(/\r/g, '').split('\n')) {
      const line = raw.replace(/#.*$/, '').trim(); if (!line) continue;
      const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) { lastUA = false; continue; }
      const field = m[1].toLowerCase(), value = S(m[2]);
      if (field === 'user-agent') { if (!cur || !lastUA) { cur = { agents: [], lines: [] }; groups.push(cur); } cur.agents.push(value.toLowerCase()); lastUA = true; continue; }
      lastUA = false;
      if (field === 'sitemap') { if (value) sitemaps.push(value); continue; }
      if (field !== 'disallow' && field !== 'allow') continue;
      if (!cur) { cur = { agents: ['*'], lines: [] }; groups.push(cur); }
      cur.lines.push({ allow: field === 'allow', path: value });
    }
    // which groups apply to Googlebot: its own group wins over `*`, and groups naming the same agent are merged (as Google's parser does)
    const forGoogle = groups.filter(g => g.agents.includes('googlebot'));
    const applies = (forGoogle.length ? forGoogle : groups.filter(g => g.agents.includes('*'))).flatMap(g => g.lines);
    const text2 = groups.map(g => 'user-agent: ' + g.agents.join(', ') + (g.lines.length ? '\n' + g.lines.map(l => (l.allow ? 'allow: ' : 'disallow: ') + l.path).join('\n') : '')).join('\n')
      + (sitemaps.length ? (groups.length ? '\n' : '') + sitemaps.map(x => 'sitemap: ' + x).join('\n') : '');
    // one line per rule, with the agents it is for: what a diff compares (a reordered file or a comment changes nothing)
    const facts = [...new Set(groups.flatMap(g => g.lines.map(l => (l.allow ? 'Allow: ' : 'Disallow: ') + (l.path || '(empty)') + ' for ' + g.agents.map(a => a === '*' ? 'every crawler' : a === 'googlebot' ? 'Googlebot' : a).join(', ')))
      .concat(sitemaps.map(x => 'Sitemap: ' + x)))];
    return { groups, sitemaps, applies, text: text2, facts, google_group: forGoogle.length ? 'googlebot' : '*' };
  };
  const isHtml = (ctype, text) => /text\/html|application\/xhtml/i.test(S(ctype)) || /^\s*(?:<!doctype html|<html[\s>]|<head[\s>])/i.test(S(text).slice(0, 400));
  const robotsRead = (res) => {
    const r = res || {}; const status = n0(r.statusCode ?? r.status); const text = S(r.body ?? r.data);
    const headers = r.headers || {};
    const ctype = S((Object.keys(headers).find(k => k.toLowerCase() === 'content-type') && headers[Object.keys(headers).find(k => k.toLowerCase() === 'content-type')]) || '');
    const errText = S((r.error && (r.error.message || r.error.description)) || r.error || '');
    const none = { groups: [], sitemaps: [], applies: [], text: '', facts: [] };
    const out = (state, p, extra) => ({ ok: true, state, status, hash: state === 'ok' || state === 'html' ? hash(p.text) : '', v: ROBOTS_V, length: p.text.length,
      rules: p.applies, groups: p.groups.slice(0, 30), sitemaps: p.sitemaps.slice(0, 20), text: p.text.slice(0, 1500), facts: p.facts.slice(0, 60), content_type: ctype.slice(0, 80),
      blocks: (url) => {
        if ((state !== 'ok' && state !== 'html') || !p.applies.length) return null;   // no file, or nothing that applies: nothing is blocked by it
        const path = pathOf(url);
        let best = null;
        for (const l of p.applies) {
          if (!l.path) continue;                                              // `Disallow:` with no path allows everything
          const pat = l.path.replace(/\*+/g, '*');
          const rx = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
          if (!rx.test(path)) continue;
          if (!best || l.path.length > best.path.length || (l.path.length === best.path.length && l.allow)) best = l;   // longest rule wins, Allow wins a tie
        }
        return best ? !best.allow : false;
      }, error: '', ...(extra || {}) });
    if (!status) {
      // a chain longer than Google's five hops is treated as a 404 by Google: "missing", not "could not be read"
      if (/redirect/i.test(errText)) return out('missing', none, { reason: 'redirect_chain', status: 0 });
      return { ok: false, state: 'not_read', status: 0, error: (errText || 'no answer').slice(0, 200), hash: '', rules: [], groups: [], sitemaps: [], text: '', facts: [], v: ROBOTS_V };
    }
    if (status >= 300 && status < 400) return { ...out('unresolved', none), ok: false, location: S((Object.keys(headers).find(k => k.toLowerCase() === 'location') && headers[Object.keys(headers).find(k => k.toLowerCase() === 'location')]) || ''), error: 'robots.txt redirects (' + status + ')' };
    if (status === 429 || status >= 500) return out('unreachable', none);
    if (status >= 400) return out('missing', none);
    if (isHtml(ctype, text)) return out('html', robotsParse(text));
    return out('ok', robotsParse(text));
  };
  const BAD_ROBOTS = ['missing', 'unreachable', 'html'];
  const prevRobots = (prev) => {
    if (typeof prev === 'string') return prev ? { v: ROBOTS_V, hash: prev, state: 'ok', text: '', facts: null } : {};
    const p = prev || {};
    const st = S(p.state) || (n0(p.status) >= 200 && n0(p.status) < 300 ? 'ok' : n0(p.status) === 429 || n0(p.status) >= 500 ? 'unreachable' : n0(p.status) >= 400 ? 'missing' : '');
    return { v: n0(p.v), hash: S(p.hash), state: st, text: S(p.text), facts: Array.isArray(p.facts) ? p.facts : null, last_good_hash: S(p.last_good_hash), last_good_at: S(p.last_good_at),
      last_good_text: S(p.last_good_text), bad_runs: n0(p.bad_runs) };
  };
  const disallowsOf = (text) => [...new Set(S(text).split('\n').filter(l => /^disallow: \S/.test(l)).map(l => l.slice(10).trim()))];
  // the whole site closed to Google, or to every crawler (`*` covers Bing and the AI search fetchers too)
  const rootBlock = (robots) => (robots.groups || []).some(g => (g.agents || []).some(a => a === '*' || a === 'googlebot') && (g.lines || []).some(l => !l.allow && l.path === '/'))
    || (robots.rules || []).some(l => !l.allow && l.path === '/');
  /**
   * The site's robots.txt as a change of its own. prev: the stored reading (seo_cache `watch:<site>`: v, hash, state, text, facts, last good
   * copy, bad_runs) or, in the older form, only a fingerprint string; robots: robotsRead() of today; o.newly_blocked: key pages the new rules
   * block that were crawlable before. -> null (nothing to say) or { code, severity, label, text, from, to, state }
   */
  const robotsChange = (prev, robots, o) => {
    const opts = o || {};
    if (!robots || robots.ok === false) return null;                       // not read, or a redirect we could not follow: no claim at all
    const P = prevRobots(prev); const now = S(robots.state) || 'ok';
    const mk = (code, severity, text) => ({ code, severity, label: CODES[code].label, text, from: P.hash || P.state, to: S(robots.hash) || now, state: now });
    if (!P.state && !P.hash) return null;                                   // the first reading is a baseline
    const legacy = P.v !== ROBOTS_V;                                          // a fingerprint of the old kind: the state compares, the rules do not
    const rulesLine = (txt) => { const d = disallowsOf(txt); return d.length ? ' (' + d.slice(0, 4).map(x => 'Disallow ' + x).join(', ') + (d.length > 4 ? ', and ' + (d.length - 4) + ' more' : '') + ')' : ''; };
    const prevText = P.text || P.last_good_text;
    if (now === 'missing') {
      if (P.state === 'missing') return null;
      const blockedNothing = !legacy && P.state === 'ok' && !disallowsOf(prevText).length;
      return mk('robots_missing', blockedNothing ? 'low' : 'medium', 'robots.txt is missing' + (robots.reason === 'redirect_chain' ? ' (it redirects more than five times, which Google treats as missing)' : ' (it answers ' + robots.status + ')')
        + '. Google then crawls everything: nothing is blocked, but your rules' + rulesLine(prevText) + ' and the Sitemap line no longer apply. Put the file back if this was not on purpose.');
    }
    if (now === 'unreachable') {
      if (P.state === 'unreachable') return P.bad_runs === 1
        ? mk('robots_unreachable', 'critical', 'robots.txt still answers ' + robots.status + ' (second check in a row). Google has paused crawling your site and uses its last copy of the file; fix the server so robots.txt answers again.')
        : null;
      return mk('robots_unreachable', 'high', 'robots.txt answers ' + robots.status + ' (a server error). While this lasts Google stops crawling your site for up to 12 hours, then uses its last copy of the file for up to 30 days. Check the server or the CDN in front of it.');
    }
    if (now === 'html') {
      if (P.state === 'html') return null;
      return mk('robots_html', 'medium', 'robots.txt answers a web page instead of a rules file. Google tries to read rules from it and ignores the rest, so your rules' + rulesLine(prevText) + ' may no longer apply. Serve the plain text file at /robots.txt.');
    }
    // now === 'ok'
    if (BAD_ROBOTS.includes(P.state)) {
      const same = P.last_good_hash && P.last_good_hash === S(robots.hash);
      if (!same && P.last_good_hash && rootBlock(robots)) return mk('robots_changed', 'high', 'robots.txt is back, but it now closes the whole site to crawlers (Disallow: /). Remove that line unless you mean to leave search.');
      return mk('robots_back', 'info', 'robots.txt is back' + (same ? ' with the same rules as on ' + (S(P.last_good_at).slice(0, 10) || 'the last good check') + '.' : P.last_good_hash ? ' with rules that differ from the last good copy: read it once.' : '.'));
    }
    if (legacy || !P.hash || P.hash === S(robots.hash)) return null;
    // a real change of the rules: say which rules, and how much it matters for Google
    const was = P.facts ? new Set(P.facts) : null; const isNow = new Set(robots.facts || []);
    const added = was ? [...isNow].filter(x => !was.has(x)) : []; const removed = was ? [...was].filter(x => !isNow.has(x)) : [];
    const blocked = (opts.newly_blocked || []).filter(Boolean);
    const severity = (blocked.length || rootBlock(robots)) ? 'high' : 'medium';
    const diff = (added.length ? ' Added: ' + added.slice(0, 5).join('; ') + (added.length > 5 ? '; and ' + (added.length - 5) + ' more' : '') + '.' : '')
      + (removed.length ? ' Removed: ' + removed.slice(0, 5).join('; ') + (removed.length > 5 ? '; and ' + (removed.length - 5) + ' more' : '') + '.' : '');
    return mk('robots_changed', severity, 'robots.txt changed.' + (diff || ' Its rules are different from the last check.')
      + (blocked.length ? ' It now stops Google crawling ' + blocked.length + ' of your key pages: ' + blocked.slice(0, 3).map(pathOf).join(', ') + (blocked.length > 3 ? ', and more' : '') + '.' : '')
      + (rootBlock(robots) && !blocked.length ? ' It closes the whole site to crawlers (Disallow: /), so Google and the AI search tools stop reading it.' : ''));
  };

  // ---- a page that started redirecting: where does it land? (build section 194) ----
  // Google: a 301 / 308 tells the indexing pipeline the target should be canonical (the old address's place moves to the new one); a 302 / 307
  // does not, and keeps the old address in search (developers.google.com/search/docs/crawling-indexing/301-redirects). So a permanent move to
  // a working page of the same site is good news (Info), a temporary one is Medium, and a redirect to a broken, unindexable or foreign page,
  // or a deep page sent to the home page (a soft 404 for Google), is High or Critical. `hop` is the target read with the redirect followed.
  const absUrl = (location, base) => {
    const l = S(location); if (!l) return '';
    if (/^https?:\/\//i.test(l)) return l;
    const origin = (S(base).match(/^(https?:\/\/[^\/?#]+)/i) || [])[1] || ''; if (!origin) return '';
    if (/^\/\//.test(l)) return (S(base).match(/^(https?:)/i) || ['', 'https:'])[1] + l;
    if (l.charAt(0) === '/') return origin + l;
    return origin + (pathOf(base).replace(/[^\/]*$/, '') || '/') + l;
  };
  const redirectVerdict = (x) => {
    const o = x || {}; const status = n0(o.status); const from = S(o.url); const to = absUrl(o.location, from);
    const hop = o.hop || null; const permanent = status === 301 || status === 308;
    const where = to ? pathOf(to) : '';
    const v = (verdict, code, severity, text) => ({ verdict, code, severity, label: CODES[code].label, text, to });
    if (!to) return v('broken', 'page_redirect_bad', 'high', 'The page now redirects (' + status + ') but does not say where to, so visitors and Google land nowhere.');
    if (bare(hostOf(to)) !== bare(hostOf(from))) return v('offsite', 'page_redirect_bad', 'high', 'The page now sends visitors to another website (' + to + '). Google drops it from your site\'s results; if this is not on purpose, remove the redirect.');
    if (pathOf(from).replace(/\/+$/, '') !== '' && where.replace(/\/+$/, '') === '') return v('home', 'page_redirect_bad', 'high', 'The page now sends visitors to your home page. Google treats a page sent to the home page like a page that is gone, so its place in search is lost. Redirect it to the page that replaced it, or keep it.');
    const hostOnly = ukey(to) === ukey(from);
    if (!hop || hop.ok === false) {
      if (hop && /redirect/i.test(S(hop.error))) return v('loop', 'page_redirect_bad', 'high', 'The page now redirects (' + status + ' to ' + where + ') and the redirects never end in a page (more than five hops or a loop).');
      return v('unread', 'page_redirects', 'medium', 'The page now redirects (' + status + ' to ' + where + '). The new address could not be read today; we check it again with the next watch.');
    }
    const hs = n0(hop.status);
    if (hs >= 400 && hs < 500) return v('gone', 'page_redirect_bad', 'critical', 'The page now redirects to ' + where + ', which is gone (' + hs + '): visitors and Google land on an error page.');
    if (hs >= 500) return v('error', 'page_redirect_bad', 'high', 'The page now redirects to ' + where + ', which answers a server error (' + hs + ').');
    if (hs >= 300) return v('loop', 'page_redirect_bad', 'high', 'The page now redirects to ' + where + ', which redirects again too many times.');
    if (hop.noindex) return v('noindex', 'page_redirect_bad', 'high', 'The page now redirects to ' + where + ', which asks search engines not to index it, so neither address can be found in Google.');
    const canonOk = !S(hop.canonical) || ukey(hop.canonical) === ukey(to);
    if (!permanent) return v('temporary', 'page_redirects', 'medium', 'The page now redirects temporarily (' + status + ') to ' + where + '. Google keeps the old address in search while a redirect is temporary; use a permanent (301) redirect if the move is final.');
    if (!canonOk) return v('canonical_elsewhere', 'page_redirects', 'medium', 'The page moved permanently to ' + where + ', but that page names ' + S(hop.canonical) + ' as its main version, so Google may show neither. Point the redirect at the main version.');
    if (hostOnly) return v('moved', 'page_moved', 'info', 'The page now opens at ' + to + ', the same page on your main address. Nothing to do.');
    return v('moved', 'page_moved', 'info', 'The page moved permanently to ' + where + ', which works' + (o.expected ? '. This is the redirect your Steps on your website asked for' : '')
      + '. Google moves the old address\'s place in search to the new one. We watch the new address from now on.');
  };

  // ---- what changed since the stored reading, and how loudly to say it ----
  // `prev` is the stored seo_page_watch row (or null for a page nobody has watched yet), `now` the signals of this run.
  // Build section 194: the severity is what Google does with the change, not the fact that something changed - a permanent move to a working
  // page and a canonical that now names the page itself are fixes (Info), a changed title is Low (Info when it is a page we just published).
  const CODES = {
    page_gone: { severity: 'critical', label: 'page gone' },
    page_error: { severity: 'critical', label: 'server error' },
    noindex_added: { severity: 'critical', label: 'noindex added' },
    robots_blocked: { severity: 'critical', label: 'blocked by robots.txt' },
    page_redirects: { severity: 'medium', label: 'page now redirects' },
    page_redirect_bad: { severity: 'high', label: 'redirects to a page that does not work' },
    page_moved: { severity: 'info', label: 'page moved' },
    canonical_moved: { severity: 'high', label: 'canonical moved' },
    canonical_removed: { severity: 'low', label: 'canonical removed' },
    canonical_fixed: { severity: 'info', label: 'canonical points at the page itself' },
    robots_changed: { severity: 'medium', label: 'robots.txt changed' },
    robots_missing: { severity: 'medium', label: 'robots.txt missing' },
    robots_unreachable: { severity: 'high', label: 'robots.txt unreachable' },
    robots_html: { severity: 'medium', label: 'robots.txt is a web page' },
    robots_back: { severity: 'info', label: 'robots.txt is back' },
    title_changed: { severity: 'low', label: 'title changed' },
    page_back: { severity: 'info', label: 'page answers again' },
    noindex_removed: { severity: 'info', label: 'noindex gone' },
  };
  const compare = (prev, now, o) => {
    const opts = o || {}; const out = [];
    const add = (code, text, from, to, sev) => out.push({ code, severity: sev || CODES[code].severity, label: CODES[code].label, text, from: S(from), to: S(to) });
    if (!now || now.ok === false) return out;                                 // a failed fetch is "not checked", never a change
    const first = !prev || !S(prev.checked_at);
    const was = prev || {};
    const wasStatus = n0(was.status), nowStatus = n0(now.status);
    const url = S(opts.url);
    if (!first) {
      if (wasStatus >= 200 && wasStatus < 400 && nowStatus >= 500) add('page_error', 'The page answers ' + nowStatus + ' (it answered ' + wasStatus + ' before)', wasStatus, nowStatus);
      else if (wasStatus >= 200 && wasStatus < 400 && nowStatus >= 400) add('page_gone', 'The page is gone: it answers ' + nowStatus + ' (it answered ' + wasStatus + ' before)', wasStatus, nowStatus);
      else if (wasStatus >= 400 && nowStatus >= 200 && nowStatus < 300) add('page_back', 'The page answers ' + nowStatus + ' again (it answered ' + wasStatus + ' before)', wasStatus, nowStatus);
      if (nowStatus >= 300 && nowStatus < 400 && !(wasStatus >= 300 && wasStatus < 400)) {
        const rv = opts.redirect || null;   // the verdict on where it lands (Watch Compare reads the target); without it: Medium, said as such
        if (rv) add(rv.code, rv.text, wasStatus, nowStatus + ' ' + S(now.location), rv.severity);
        else add('page_redirects', 'The page now redirects (' + nowStatus + ' to ' + (S(now.location) || 'an address it does not name') + '). Where it lands was not checked in this run.', wasStatus, nowStatus + ' ' + S(now.location));
      }
      if (now.noindex && !was.noindex) add('noindex_added', 'The page tells search engines not to index it (' + S(now.noindex_source) + ': "' + S(now.robots_meta || 'noindex') + '")', '', S(now.noindex_source));
      if (!now.noindex && was.noindex) add('noindex_removed', 'The page no longer tells search engines to leave it out', S(was.noindex_source), '');
      // the title and the canonical are only compared between two readings of a page that was answering: the title of yesterday's 404
      // ("Not found") is not a baseline, so a page that comes back is "answers again", never "the title changed".
      const wasOk = wasStatus >= 200 && wasStatus < 300;
      if (wasOk && nowStatus >= 200 && nowStatus < 300) {
        const selfNow = S(now.canonical) && same(now.canonical, url || now.url || '');
        const selfWas = S(was.canonical) && same(was.canonical, url || was.url || '');
        if (S(was.canonical) && !S(now.canonical)) {
          if (selfWas) add('canonical_removed', 'The canonical tag is gone (it pointed at the page itself). Google usually still treats the page as its own main version; put the tag back to be sure.', S(was.canonical), '');
          else add('canonical_fixed', 'The canonical tag that pointed at ' + S(was.canonical) + ' is gone, so Google can index this page under its own address again.', S(was.canonical), '');
        } else if (S(now.canonical) && S(was.canonical) && !same(now.canonical, was.canonical)) {
          if (selfNow) add('canonical_fixed', 'The canonical now points at the page itself (it pointed at ' + S(was.canonical) + '). That is right: Google can index this page under its own address.', S(was.canonical), S(now.canonical));
          else add('canonical_moved', 'The canonical now points at ' + S(now.canonical) + ' (it pointed at ' + S(was.canonical) + '), so Google is asked to show that page instead of this one.', S(was.canonical), S(now.canonical));
        }
        if (S(was.title) && S(now.title) && S(was.title) !== S(now.title)) {
          if (opts.own_title) add('title_changed', 'Your new title is live: "' + S(now.title) + '" (it was "' + S(was.title) + '").', S(was.title), S(now.title), 'info');
          else add('title_changed', 'The title changed to "' + S(now.title) + '" (it was "' + S(was.title) + '").', S(was.title), S(now.title));
        }
      }
    }
    // a page we are seeing for the first time is a baseline, never a change — that includes one robots.txt already blocked before we looked
    if (!first && opts.robots_blocked === true && opts.robots_blocked_before !== true) add('robots_blocked', 'robots.txt now stops Google crawling ' + (url || 'this page'), '', 'disallowed');
    return out;
  };
  const state = (changes, now) => (!now || now.ok === false) ? 'not_checked' : ((changes || []).some(c => c.severity !== 'info') ? 'changed' : 'ok');
  const worst = (changes) => { const order = ['critical', 'high', 'medium', 'low', 'info']; return (changes || []).map(c => c.severity).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] || ''; };

  // ---- the alert lifecycle (build section 194; Conductor's model: one incident per condition, closed when the condition is gone) ----
  // Every alert names its condition: the site, the page (or robots.txt) and the family of the change. While the condition lasts there is ONE
  // open alert (last_seen_at, count), never a new row a day; when the watch reads the page and the condition is gone the alert is resolved
  // with the sentence that says why (resolved_at, resolution). A change that is good news (a page moved to a working address, a canonical
  // that now names the page) is recorded resolved at once: nothing is left for the client to do. Rows written before section 194 carry no
  // condition key; it is read back from their message id (watch:<site>:<code>:<page hash>:<day>).
  const FAMILY = { page_gone: 'status', page_error: 'status', page_back: 'status', noindex_added: 'noindex', noindex_removed: 'noindex', robots_blocked: 'robots_blocked',
    page_redirects: 'redirect', page_redirect_bad: 'redirect', page_moved: 'redirect', canonical_moved: 'canonical', canonical_removed: 'canonical', canonical_fixed: 'canonical',
    title_changed: 'title', robots_missing: 'robots_state', robots_unreachable: 'robots_state', robots_html: 'robots_state', robots_back: 'robots_state', robots_changed: 'robots_rules' };
  // the codes that close their family's open alert instead of opening one
  const CLOSES = { page_back: true, noindex_removed: true, page_moved: true, canonical_fixed: true, robots_back: true };
  const conditionKey = (site_id, code, page) => 'watch:' + S(site_id) + ':' + (FAMILY[code] || code) + ':' + hash(ukey(page));
  /** The condition of a stored alert row: its own key, or read back from a message id written before section 194. */
  const conditionOf = (row) => {
    const r = row || {};
    if (S(r.condition_key)) { const m = S(r.condition_key).match(/^watch:(.+):([a-z_]+):([0-9a-f]{8})$/); return m ? { key: S(r.condition_key), site_id: m[1], family: m[2], page_hash: m[3] } : null; }
    const m = S(r.message_id).match(/^watch:(.+):([a-z_]+):([0-9a-f]{8}):\d{4}-\d\d-\d\d$/);
    if (!m || m[2] === 'recheck') return null;
    const family = FAMILY[m[2]] || m[2];
    return { key: 'watch:' + m[1] + ':' + family + ':' + m[3], site_id: m[1], family, page_hash: m[3], legacy: true, code: m[2] };
  };
  const isOpenRow = (r) => S((r || {}).status || 'new') !== 'resolved' && !S((r || {}).resolved_at);
  /** Is the condition of `family` still true of a page read today? null = this family cannot be judged from one reading (an event). */
  const present = (family, p, ctx) => {
    if (!p || p.ok === false) return null;
    const st = n0(p.status);
    if (family === 'status') return st >= 400;
    if (family === 'noindex') return !!p.noindex;
    if (family === 'robots_blocked') return p.robots_blocked === true;
    if (family === 'redirect') return st >= 300 && st < 400 && S((ctx || {}).verdict) !== 'moved';
    if (family === 'canonical') return st >= 200 && st < 300 && !!S(p.canonical) && !same(p.canonical, p.url);
    return null;   // title / robots rules: events, open until somebody marks them seen
  };
  const RESOLVED_TEXT = {
    status: (p) => n0(p.status) >= 300 && n0(p.status) < 400 ? 'The address no longer answers with an error: it now redirects (' + n0(p.status) + ').' : 'The page answers ' + n0(p.status) + ' again.',
    noindex: () => 'The page no longer asks search engines to leave it out.',
    robots_blocked: () => 'robots.txt no longer blocks this page.',
    redirect: (p, ctx) => n0(p.status) >= 200 && n0(p.status) < 300 ? 'The page answers at its own address again.' : 'The page now moves permanently to ' + pathOf((ctx || {}).to || p.location) + ', which works.',
    canonical: () => 'The canonical now points at the page itself.',
  };
  /**
   * One run's alert rows for one site. o: { site_id, domain, now, changes, pages (Watch Compare page states with `verdict` / `moved_to`),
   * robots (today's robots state), open (stored alert rows of this site), moved ([{ from, to }] addresses the watch stopped reading because
   * they moved), ran_late (sentence or '') }. -> { rows (exact seo_console_alerts columns), resolved, updated, opened }
   */
  const lifecycle = (o) => {
    const x = o || {}; const nowIso = S(x.now) || new Date().toISOString(); const day = nowIso.slice(0, 10);
    const site_id = S(x.site_id), domain = S(x.domain);
    const openRows = (x.open || []).filter(r => r && isOpenRow(r) && S(r.source || 'page_watch') === 'page_watch');
    const byKey = new Map();
    for (const r of openRows) { const c = conditionOf(r); if (!c || c.site_id !== site_id) continue; if (!byKey.has(c.key)) byKey.set(c.key, { row: r, c }); }
    const pageByHash = new Map((x.pages || []).filter(p => p && p.ok !== false && S(p.url)).map(p => [hash(ukey(p.url)), p]));
    const movedByHash = new Map((x.moved || []).filter(m => m && S(m.from)).map(m => [hash(ukey(m.from)), m]));
    const rows = []; const out = { rows, resolved: 0, updated: 0, opened: 0 };
    const late = S(x.ran_late) ? ' Ran late: ' + S(x.ran_late) : '';
    const base = (r) => ({ site_id, domain, kind: 'page_watch', source: 'page_watch', severity: S(r.severity), subject: S(r.subject).slice(0, 200), summary: S(r.summary).slice(0, 1000),
      received_at: S(r.received_at) || nowIso, message_id: S(r.message_id).slice(0, 200), status: S(r.status) || 'new', condition_key: S(r.condition_key), last_seen_at: S(r.last_seen_at) || S(r.received_at) || nowIso,
      count: n0(r.count) || 1, resolved_at: S(r.resolved_at), resolution: S(r.resolution).slice(0, 500), ack_by: S(r.ack_by), ack_at: S(r.ack_at) });
    const done = new Set();
    const resolve = (k, sentence) => { const e = byKey.get(k); if (!e || done.has(k)) return; done.add(k);
      rows.push({ ...base(e.row), condition_key: k, status: 'resolved', resolved_at: nowIso, resolution: S(sentence).slice(0, 500), last_seen_at: S(e.row.last_seen_at) || S(e.row.received_at) || nowIso });
      out.resolved += 1; };
    const subjectOf = (c, page) => (S(c.label).charAt(0).toUpperCase() + S(c.label).slice(1) + ': ' + (S(page).replace(/^https?:\/\//, '') || domain)).slice(0, 200);
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    // 1. today's changes: open, update or resolve
    for (const c of (x.changes || [])) {
      const page = S(c.url); const k = conditionKey(site_id, c.code, page);
      if (done.has(k)) continue;   // one condition, one row per run
      const text = (S(c.text) + (/^robots_/.test(c.code) ? '' : ' Checked ' + nowIso.slice(0, 16).replace('T', ' ') + ' UTC by the daily key-page watch.') + late).slice(0, 1000);
      if (CLOSES[c.code] || c.severity === 'info') {
        if (byKey.has(k)) { resolve(k, S(c.text)); continue; }
        // good news with nothing open: recorded as a resolved notice, so the history shows it and nobody has to act on it
        rows.push({ ...base({}), severity: 'info', subject: subjectOf(c, page), summary: text, received_at: nowIso, message_id: ('watch:' + site_id + ':' + S(c.code) + ':' + hash(ukey(page)) + ':' + day).slice(0, 200),
          status: 'resolved', condition_key: k, last_seen_at: nowIso, count: 1, resolved_at: nowIso, resolution: 'Nothing to do.' });
        out.opened += 1; continue;
      }
      if (byKey.has(k) && !done.has(k)) {
        const e = byKey.get(k); done.add(k);
        // a condition only grows louder in place; robots.txt's state is replaced by its new state (missing after unreachable is Medium again)
        const sev = FAMILY[c.code] === 'robots_state' || (order[c.severity] ?? 5) < (order[S(e.row.severity)] ?? 5) ? c.severity : S(e.row.severity);
        rows.push({ ...base(e.row), condition_key: k, severity: sev, subject: subjectOf(c, page), summary: text, last_seen_at: nowIso, count: (n0(e.row.count) || 1) + 1, status: 'new' });
        out.updated += 1; continue;
      }
      rows.push({ ...base({}), severity: S(c.severity), subject: subjectOf(c, page), summary: text, received_at: nowIso,
        message_id: ('watch:' + site_id + ':' + S(c.code) + ':' + hash(ukey(page)) + ':' + day).slice(0, 200), status: 'new', condition_key: k, last_seen_at: nowIso, count: 1 });
      done.add(k); byKey.set(k, { row: rows[rows.length - 1], c: { key: k } }); out.opened += 1;
    }
    // 2. the open alerts nobody touched today: still true (seen again) or gone (resolved)
    for (const [k, e] of byKey) {
      if (done.has(k)) continue;
      const fam = e.c.family;
      if (fam === 'robots_state') {
        const rs = x.robots || null; if (!rs || rs.ok === false) continue;
        if (S(rs.state) === 'ok') { resolve(k, 'robots.txt answers again.'); continue; }
        done.add(k); rows.push({ ...base(e.row), condition_key: k, last_seen_at: nowIso, count: (n0(e.row.count) || 1) + 1, status: 'new' }); out.updated += 1; continue;
      }
      const p = pageByHash.get(e.c.page_hash);
      if (!p) {
        const mv = movedByHash.get(e.c.page_hash);
        if (mv && ['status', 'redirect', 'canonical', 'noindex', 'robots_blocked', 'title'].includes(fam)) resolve(k, 'This address now moves permanently to ' + pathOf(mv.to) + ', which works. We watch the new address.');
        continue;   // not read today: nothing is claimed
      }
      const st3 = n0(p.status) >= 300 && n0(p.status) < 400;
      if (st3 && S(p.verdict) === 'moved' && fam !== 'redirect') { resolve(k, 'This address now moves permanently to ' + pathOf(p.moved_to || p.redirect_to) + ', which works. We watch the new address.'); continue; }
      const isNow = present(fam, p, { verdict: p.verdict, to: p.moved_to || p.redirect_to });
      if (isNow === null) {
        // an event (title, robots rules) that started before section 194: it stays open until marked seen, but a title alert on a page that
        // moved away is closed with the move
        if (fam === 'title' && n0(p.status) >= 300 && n0(p.status) < 400 && S(p.verdict) === 'moved') resolve(k, 'This address now moves permanently to ' + pathOf(p.moved_to || p.redirect_to) + ', which works.');
        continue;
      }
      if (!isNow) resolve(k, (RESOLVED_TEXT[fam] || (() => 'The condition is gone.'))(p, { to: p.moved_to || p.redirect_to }));
      else { done.add(k); rows.push({ ...base(e.row), condition_key: k, last_seen_at: nowIso, count: (n0(e.row.count) || 1) + 1, status: 'new' }); out.updated += 1; }
    }
    return out;
  };

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

  return { signals, robotsRead, robotsParse, compare, robotsChange, redirectVerdict, state, worst, recheck, recheckRule, inspectBudget, inspection, coverage, hash,
    changedPages, changeOf, freshFirst, conditionKey, conditionOf, lifecycle, present,
    CODES, FAMILY, RULES, QUOTA_PER_DAY, QUOTA_PER_MINUTE, PER_RUN, PER_AUDIT, FRESH_DAYS, ROBOTS_V,
    helpers: { hostOf, bare, pathOf, ukey, same, strip, S, n0, absUrl } };
})();
// ---- a page that moved permanently: our own rows follow it (client report 2026-11-17, devaicon.com F10; build section 194) ----
// The client moved its service pages to /services/... with permanent (301) redirects. Page Watch, Index coverage and the page inventory all
// saw the move, and nothing followed it: the ladder row, the content log, the AI question and the AI readiness row kept the old address, so
// every screen showed a page that redirects as the page that answers its search, and the Rank Tracker would have called the moved page "a
// different page of yours" once Google ranked it. One rule, used by the daily Page Watch (which writes the follow) and the Rank Tracker
// (which compares addresses):
//   * a move is a 301 or 308 seen on TWO reads (the stored reading and today's), to an address on the same site that answers 200, asks to be
//     indexed and names itself as its main version (the watch's redirect verdict says `moved`);
//   * never to the home page (Google treats a deep page sent to the home page like a page that is gone), never to another site;
//   * a move only of the host (bare -> www) changes no stored row: addresses are compared host-agnostically everywhere already;
//   * a ladder or content-log row never follows onto an address another search already owns (one search, one page): it is refused and named.
// The address is kept exactly as the server serves it (capital letters included). The n8n Code sandbox has no URL constructor: regexes only.
const MV = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase() : ''; };
  const bare = (h) => S(h).toLowerCase().replace(/^www\./, '');
  const pathOf = (u) => { const p = S(u).replace(/^https?:\/\/[^\/]*/i, '').replace(/[?#].*$/, ''); return p || '/'; };
  const ukey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '') || S(u).toLowerCase();
  const norm = (k) => S(k).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const PERMANENT = [301, 308];
  /** A Location header made absolute against the address that sent it ('' when there is none). */
  const abs = (location, base) => {
    const l = S(location); if (!l) return '';
    if (/^https?:\/\//i.test(l)) return l;
    const origin = (S(base).match(/^(https?:\/\/[^\/?#]+)/i) || [])[1] || '';
    if (!origin) return '';
    if (/^\/\//.test(l)) return (S(base).match(/^(https?:)/i) || ['', 'https:'])[1] + l;
    if (l.charAt(0) === '/') return origin + l;
    const dir = pathOf(base).replace(/[^\/]*$/, '');
    return origin + (dir || '/') + l;
  };
  const sameSite = (a, b) => !!hostOf(a) && bare(hostOf(a)) === bare(hostOf(b));
  const isHome = (u) => pathOf(u).replace(/\/+$/, '') === '';
  /**
   * Is this redirect a confirmed move? `now` / `prev`: { url, status, location } (prev = the stored reading), `verdict`: the watch's redirect
   * verdict of today's target ('moved' = answers 200, indexable, its own main version). -> { ok, to, host_only, reason }
   */
  const confirm = (now, prev, verdict) => {
    const n = now || {}, p = prev || {};
    const st = Number(n.status) || 0, pst = Number(p.status) || 0;
    const to = abs(n.location, n.url);
    const no = (reason) => ({ ok: false, to, host_only: false, reason });
    if (!PERMANENT.includes(st)) return no('not a permanent redirect (' + (st || 'no answer') + ')');
    if (!to) return no('the redirect names no address');
    if (!sameSite(to, n.url)) return no('the redirect leaves the site');
    if (isHome(to) && !isHome(n.url)) return no('a deep page sent to the home page is not a move');
    if (S(verdict) !== 'moved') return no('the new address does not work as a page of its own yet');
    if (!PERMANENT.includes(pst) || ukey(abs(p.location, p.url || n.url)) !== ukey(to)) return no('seen once so far; a move is confirmed on the second read');
    return { ok: true, to, host_only: ukey(to) === ukey(n.url), reason: '' };
  };
  /**
   * The moves known from the watch's stored rows: a confirmed `moved_to`, or a permanent redirect with its target (enough to say two
   * addresses are one page). -> Map ukey(from) -> { from, to, confirmed }
   */
  const fromWatch = (rows) => {
    const m = new Map();
    for (const r of (rows || [])) {
      const from = S(r && r.url); if (!from) continue;
      const confirmed = S(r.moved_to);
      const to = confirmed || (PERMANENT.includes(Number(r.status) || 0) ? abs(r.location, from) : '');
      if (!to || !sameSite(to, from) || ukey(to) === ukey(from)) continue;
      if (isHome(to) && !isHome(from)) continue;
      m.set(ukey(from), { from, to, confirmed: !!confirmed });
    }
    return m;
  };
  /** Where an address ends after the known moves (up to 5 hops, as Google follows them); '' when it did not move. */
  const finalOf = (url, moves) => {
    let cur = S(url), seen = new Set(), hops = 0;
    while (moves && moves.get(ukey(cur)) && hops < 5) {
      const k = ukey(cur); if (seen.has(k)) return ''; seen.add(k);
      cur = moves.get(k).to; hops += 1;
    }
    return hops ? cur : '';
  };
  /** Two addresses are one page when they are the same address or one moved (permanently) to the other. */
  const samePage = (a, b, moves) => {
    if (!S(a) || !S(b)) return false;
    if (ukey(a) === ukey(b)) return true;
    const fa = finalOf(a, moves) || S(a), fb = finalOf(b, moves) || S(b);
    return ukey(fa) === ukey(fb);
  };
  /**
   * The stored rows that follow a set of confirmed moves on one site. `moves`: [{ from, to }] (confirmed, not host-only).
   * rows: { ladders, logs, targets, aiPages } (n8n Data Table rows). -> { ladders, logs, targets, ai_pages_update, ai_pages_delete, refused }
   * Ownership (one search, one page): the address a row moves to must not already be the page of ANOTHER search in the ladders or the content
   * log; an AI question and an AI readiness row follow the page whatever it answers (they describe the page, they do not claim it).
   */
  const plan = (moves, rows, o) => {
    const opts = o || {};
    const R = rows || {};
    const domain = bare(S(opts.domain));
    const onSite = (r) => !domain || bare(S(r.domain).replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '')) === domain || S(r.site_id) === S(opts.site_id);
    const ladders = (R.ladders || []).filter(r => r && onSite(r));
    const logs = (R.logs || []).filter(r => r && onSite(r));
    const out = { ladders: [], logs: [], targets: [], ai_pages_update: [], ai_pages_delete: [], refused: [] };
    // who owns an address today: the keyword of every ladder page and published content-log page there
    const owners = (url) => {
      const k = ukey(url); const set = new Set();
      for (const l of ladders) if (S(l.target_url) && ukey(l.target_url) === k) set.add(norm(l.keyword));
      for (const l of logs) if (S(l.published_url) && ukey(l.published_url) === k) set.add(norm(l.keyword));
      return set;
    };
    for (const mv of (moves || [])) {
      const from = S(mv.from), to = S(mv.to);
      if (!from || !to || ukey(from) === ukey(to)) continue;
      if (!sameSite(to, from) || (isHome(to) && !isHome(from))) { out.refused.push({ table: 'all', key: from, from, to, reason: 'not a move we follow' }); continue; }
      const there = owners(to);
      const otherOwner = (kw) => [...there].find(x => x && x !== norm(kw)) || '';
      for (const l of ladders) {
        if (!S(l.target_url) || ukey(l.target_url) !== ukey(from)) continue;
        if (!(S(l.status) === 'published' || l.page_exists === true || l.page_exists === 'true')) continue;
        const other = otherOwner(l.keyword);
        if (other) { out.refused.push({ table: 'seo_ladders', key: S(l.ladder_id) + ' / ' + S(l.keyword), from, to, reason: 'the new address is already the page of "' + other + '"' }); continue; }
        out.ladders.push({ ladder_id: S(l.ladder_id), keyword: S(l.keyword), from: S(l.target_url), target_url: to });
      }
      for (const l of logs) {
        if (!S(l.published_url) || ukey(l.published_url) !== ukey(from)) continue;
        const other = otherOwner(l.keyword);
        if (other) { out.refused.push({ table: 'seo_content_log', key: S(l.site_id) + ' / ' + S(l.keyword), from, to, reason: 'the new address is already the page of "' + other + '"' }); continue; }
        out.logs.push({ site_id: S(l.site_id), keyword: S(l.keyword), from: S(l.published_url), published_url: to });
      }
      for (const t of (R.targets || [])) {
        if (!t || !onSite(t) || !S(t.page_url) || ukey(t.page_url) !== ukey(from)) continue;
        out.targets.push({ target_id: S(t.target_id), from: S(t.page_url), page_url: to });
      }
      const pages = (R.aiPages || []).filter(p => p && onSite(p));
      const old = pages.filter(p => ukey(p.url) === ukey(from));
      const hasNew = pages.some(p => ukey(p.url) === ukey(to));
      for (const p of old) {
        if (hasNew) out.ai_pages_delete.push({ site_id: S(p.site_id), url: S(p.url), to });
        else out.ai_pages_update.push({ site_id: S(p.site_id), from: S(p.url), url: to });
      }
    }
    return out;
  };
  return { abs, confirm, fromWatch, finalOf, samePage, plan, helpers: { ukey, hostOf, bare, pathOf, sameSite, isHome, norm }, PERMANENT };
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
const indexRows = rowsOf('Load Index Pages (Watch)').filter(r => r.site_id && r.url);
const logRows = rowsOf('Load Content Log (Watch)').filter(r => r.keyword);
const alertRows = rowsOf('Load Console Alerts (Watch)').filter(r => r.message_id && S(r.source || 'page_watch') === 'page_watch' && S(r.status) !== 'resolved' && !S(r.resolved_at));
const OWN_TITLE_DAYS = 14;

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
  // section 194: the confirmed moves of this site (old address -> new); a candidate that moved is watched at its new address
  const movedRows = watchRows.filter(r => r.site_id === s.site_id && S(r.moved_to));
  const moves = MV.fromWatch(movedRows);
  const moved = [];
  for (const c of cand.sort((a, b) => b.weight - a.weight || S(b.lastmod).localeCompare(S(a.lastmod)))) {
    // R92 part 5 (2026-10-16, re-rating defect C-16): menu links point at sections ("/industries#bfsi", "/capabilities#ai"); a fragment is
    // never sent to a server, so it is no page of its own — those two took 2 of the 25 slots and were inspected as "URL is unknown to
    // Google". The fragment is dropped and the page counted once with the page it belongs to.
    let u = S(c.url).replace(/#.*$/, ''); if (!/^https?:\/\//i.test(u)) continue;
    const fin = MV.finalOf(u, moves);
    if (fin) { if (!moved.some(m => ukey(m.from) === ukey(u))) moved.push({ from: u, to: fin }); u = fin; }
    if (SM.helpers.bare(PW.helpers.hostOf(u)) !== SM.helpers.bare(s.domain)) continue;   // only the site's own pages are watched
    const k = ukey(u); if (seen.has(k)) continue; seen.add(k);
    pages.push({ url: u, kind: c.kind, weight: c.weight });
    if (pages.length >= CONFIG.max_watch_pages) break;
  }
  const cache = (() => { try { return JSON.parse(S((cacheRows.find(c => S(c.key) === 'watch:' + s.site_id) || {}).value) || 'null') || {}; } catch (e) { return {}; } })();
  const rechecks = findingRows.filter(f => f.site_id === s.site_id && (!S(trigger.finding_key) || S(f.finding_key) === S(trigger.finding_key)))
    .slice(0, CONFIG.max_rechecks_per_site)
    .map(f => ({ audit_id: S(f.audit_id), finding_key: S(f.finding_key), title: S(f.title), category: S(f.category), severity: S(f.severity), requested_at: S(f.recheck_requested_at) }));
  // section 194: what robots.txt was at the last check, as the state machine reads it (an older fingerprint has no `robots_v` and is a baseline)
  const robots_prev = { v: Number(cache.robots_v) || 0, hash: S(cache.robots_hash), state: S(cache.robots_state), status: Number(cache.robots_status) || 0,
    text: S(cache.robots_text), facts: Array.isArray(cache.robots_facts) ? cache.robots_facts : null, last_good_hash: S(cache.robots_last_good_hash),
    last_good_at: S(cache.robots_last_good_at), last_good_text: S(cache.robots_last_good_text), bad_runs: Number(cache.robots_bad_runs) || 0 };
  // the moves Steps on your website asked for: the Index coverage row of the old address names where the improved page lives
  const expected_moves = indexRows.filter(r => r.site_id === s.site_id && (S(r.improved_to) || S(r.merge_into)))
    .map(r => ({ from: S(r.url), to: S(r.improved_to) || S(r.merge_into) })).slice(0, 100);
  const nowMs = Date.now();
  const own_titles = logRows.filter(l => (S(l.site_id) === s.site_id || normD(l.domain) === s.domain) && S(l.published_url) && Date.parse(S(l.published_at)) > nowMs - OWN_TITLE_DAYS * 864e5)
    .map(l => ukey(l.published_url)).slice(0, 100);
  const open_alerts = alertRows.filter(a => S(a.site_id) === s.site_id || normD(a.domain) === s.domain).slice(0, 200)
    .map(a => ({ message_id: S(a.message_id), condition_key: S(a.condition_key), severity: S(a.severity), subject: S(a.subject), summary: S(a.summary), received_at: S(a.received_at),
      status: S(a.status), source: S(a.source), kind: S(a.kind), last_seen_at: S(a.last_seen_at), count: Number(a.count) || 0, ack_by: S(a.ack_by), ack_at: S(a.ack_at) }));
  const site = { site_id: s.site_id, domain: s.domain, canonical_host: S(model.canonical_host) || s.domain, email: S(s.email), callback_url: S(s.callback_url),
    on_demand, pages_watched: pages.length, pages_known: SM.pages(model).length, rechecks, robots_hash_prev: S(cache.robots_hash), robots_status_prev: Number(cache.robots_status) || 0,
    robots_prev, expected_moves, own_titles, open_alerts, moved,
    last_checked_at: S(cache.checked_at), max_watch_pages: CONFIG.max_watch_pages };
  const prevOf = (u) => watchRows.find(r => r.site_id === s.site_id && ukey(r.url) === ukey(u)) || null;
  out.push({ json: { site_idx, site_id: s.site_id, domain: s.domain, url: SM.siteUrl(model, '/robots.txt'), kind: 'robots', weight: 0, site, prev: null } });
  for (const p of pages) out.push({ json: { site_idx, site_id: s.site_id, domain: s.domain, url: p.url, kind: p.kind, weight: p.weight, site, prev: prevOf(p.url) } });
});
return out.length ? out : [{ json: { skip: true, reason: 'no key page to watch (the page inventory is empty and no site model is stored yet)' } }];
