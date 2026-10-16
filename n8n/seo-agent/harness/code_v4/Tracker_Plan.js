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
  const matchPage = (model, keyword, prefer) => {   // `prefer`: a URL that wins a tie (the page Search Console itself credits for the search)
    const prefKey = prefer ? bare(hostOf(prefer)) + pathOf(prefer).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase() : "";
    const isPref = (u) => !!prefKey && (bare(hostOf(u)) + pathOf(u).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase()) === prefKey;
    const want = matchTerms(keyword); if (!want.length) return null;
    const key = tokensOf(keyword).join(' ');
    const inv = pages(model);
    const byQuery = [];
    for (const p of inv) {
      const q = (p.queries || []).find(x => tokensOf(x.query || x.keyword || x).join(' ') === key && (Number((x || {}).impressions) || 0) > 0);
      if (q) byQuery.push({ url: p.url, title: p.title, source: p.source, matched_by: 'query', score: 1, impressions: Number(q.impressions) || 0 });
    }
    byQuery.sort((a, b) => Number(isListing(a.url)) - Number(isListing(b.url)) || b.impressions - a.impressions);
    const qHit = byQuery[0] || null;
    const listingOf = (lst, best) => ({ url: lst.url, impressions: lst.impressions,
      note: 'Google currently shows ' + pathOf(lst.url) + ' (a listing page) for this search; the page that is about it is ' + pathOf(best.url) });
    if (qHit && !isListing(qHit.url)) { const lst = byQuery.find(x => isListing(x.url)); return lst ? { ...qHit, listing: listingOf(lst, qHit) } : qHit; }
    let best = null;
    for (const p of inv) {
      if (qHit && isListing(p.url)) continue;   // R56: looking for the dedicated page behind a listing's impressions
      const slug = matchTerms(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''));
      const title = matchTerms(S(p.title) + ' ' + S(p.h1));
      const inSlug = shareIn(want, slug);
      const inTitle = shareIn(want, title);
      const score = Math.max(inSlug, inTitle);
      if (score + 1e-9 >= MATCH_MIN && (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && isPref(p.url) && !isPref(best.url)))) best = { url: p.url, title: p.title, source: p.source, matched_by: inSlug >= inTitle ? 'slug' : 'title', score: Math.round(score * 100) / 100, impressions: 0 };
    }
    if (qHit && best) return { ...best, listing: listingOf(qHit, best) };
    return qHit || best;
  };
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
    titleShare, titleGap, canonUrl, isListing,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml, matchTerms } };
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
  // B6-1 (2026-10-15, benchmark area 6 — docs/system-review-2026-10-14/BENCH_AREA6_rank_tracking.md): the AI Overview factor here
  // was 0.65, a flat 35% loss, taken from Ahrefs' MARCH 2025 study. The current study — same publisher, 300,000 keywords, December
  // 2025 data, published 2026-02-04 (https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/) — measures the loss POSITION BY
  // POSITION, and it is both larger and very uneven: 58.0% of the clicks gone at #1, 50.8% at #2, 46.4% at #3 … 19.4% at #10. A
  // flat factor is wrong twice over: it understated the loss by about half, and because it hit every position equally it almost
  // cancelled out of a share, so an AI Overview cost the top of page 1 nothing in our numbers. The same correction was made to the
  // keyword research's click-loss model on 2026-10-15 (B1-3, `_kw_inputs.js`) and this is the other place the old figure lived.
  // AIO_KEEP[p - 1] = the share of its clicks position p KEEPS when an AI Overview is on the page (1 - the measured loss).
  const AIO_KEEP = [0.420, 0.492, 0.536, 0.612, 0.674, 0.695, 0.703, 0.712, 0.703, 0.806];
  const AIO_SOURCE = 'Ahrefs, 300,000 keywords, December 2025 data (published 2026-02-04)';
  const keepAt = (p, aio) => { if (!aio) return 1; const i = Math.max(1, Number(p) || 1) - 1; return AIO_KEEP[i] == null ? AIO_KEEP[AIO_KEEP.length - 1] : AIO_KEEP[i]; };
  const SNIPPET_BONUS = 0.10;
  const METHOD = 'modelled: clicks by position from a published CTR curve (28/15/11/8/7/5/4/3.5/3/2.5%); when an AI Overview is shown each position keeps only what was measured for it (58.0% of the clicks gone at #1, 50.8% at #2, 46.4% at #3, 19.4% at #10 — ' + AIO_SOURCE + ', https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/) and what the overview takes is shared between the pages it cites; +0.10 for the featured snippet, which is a stated rule with no measurement behind it. Not measured clicks.';
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
    const snipDom = feats.featured_snippet.shown ? feats.featured_snippet.domain : '';
    const w = new Map();
    const add = (d, v) => { if (!d || !(v > 0)) return; w.set(d, (w.get(d) || 0) + v); };
    // B6-1: every position keeps what was measured FOR THAT POSITION, and what it loses is what the overview took
    for (const t of land.top) add(t.domain, weight(t.position) * keepAt(t.position, aio));
    let aioPool = 0;
    if (aio) for (let p = 1; p <= CTR.length; p++) aioPool += CTR[p - 1] * (1 - keepAt(p, true));
    if (snipDom) { const k = keepAt(1, aio); add(snipDom, SNIPPET_BONUS * k); aioPool += SNIPPET_BONUS * (1 - k); }
    if (cited.length) { const each = aioPool / cited.length; for (const d of cited) add(d, each); }
    // the clicks the AI Overview keeps when we do not know which pages it cites belong to nobody on the page: they stay in the
    // denominator, so everyone's share drops (without this the loss would cancel out and an AI Overview would cost nothing)
    const unattributed = (aio && !cited.length) ? aioPool : 0;
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
    // B6-7 (2026-10-15, benchmark area 6): found while giving the customer's own keywords the same depth a rung gets. A column with
    // no `top` to trim was cut mid-string — `competitors_json` on any results page with a full top ten and a long method sentence —
    // and a sliced JSON string is not JSON, so RS.unpack handed back the default and the WHOLE reading vanished: the "Above you"
    // column was empty, and nothing anywhere said a thing had been dropped (INVARIANTS rule 1). Nothing is sliced now. The method
    // sentence goes first (it is a constant every reader already falls back to), then the tails of the lists, longest first, and the
    // last resort is a small VALID object that says the reading was too long to store.
    const cut = new Set(String(o.trimmed || '').split('+').filter(Boolean));
    if (s.length > limit && typeof o.method === 'string') { delete o.method; cut.add('method'); o.trimmed = [...cut].join('+'); s = JSON.stringify(o); }
    const lists = Object.keys(o).filter(k => k !== 'top' && Array.isArray(o[k]));
    while (s.length > limit && lists.some(k => o[k].length)) {
      const k = lists.filter(x => o[x].length).sort((a, b) => o[b].length - o[a].length)[0];
      o[k].pop(); cut.add('lists'); o.trimmed = [...cut].join('+'); s = JSON.stringify(o);
    }
    return s.length <= limit ? s : JSON.stringify({ trimmed: 'overflow', note: 'this reading was too long to store in one column' });
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

  // ---- B6-2 (2026-10-15, benchmark area 6): HOW MUCH THE RESULTS PAGE ITSELF MOVED, AND WHAT A DROP THEREFORE MEANS ----
  // The question the rank trackers are judged on is what they do on a volatile day. The leaders answer it with a MARKET-WIDE index
  // computed on somebody else's keywords — Semrush's Sensor is "SERP volatility on a scale of 0-10" over a fixed keyword set
  // (https://www.semrush.com/kb/652-sensor), AccuRanker's Google Grump "calculates the average number of rank changes across the top
  // 30 results for ~1,000,000 high-volume keywords" (https://accuranker.com/grump). Neither tells the owner whether THEIR results
  // page moved, and ours said nothing at all: a fall of seven places read exactly the same whether our page had slipped or the whole
  // page had been rewritten under it.
  // We already store the proof we need: `snapshot_json` keeps the top 10 with their URLs for every reading (criterion 2.2). Comparing
  // this reading with the previous one for the SAME keyword and the SAME device is a measurement of the page's own movement, free,
  // and specific to the keyword instead of to a market. What is measured: how many places changed occupant, how many URLs left and
  // entered, and how far the URLs present in both readings moved. What is NOT measured is the three labels (still / some / high):
  // nobody publishes a per-keyword threshold, so they are a STATED RULE and say so.
  // Rules it keeps: a missing or unreadable snapshot gives `available: false` with the reason — never a quiet 0, which would read as
  // "the page did not move"; two readings on different devices are not comparable; `RS.pack` can trim a long snapshot's tail, so the
  // comparison only runs over the depth BOTH readings kept and reports that depth.
  const urlKey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const CHURN = { still_pct: 20, high_pct: 50, min_depth: 5, stale_days: 10,
    labels_basis: 'the still / some / high labels are a stated rule, not a measurement: no tool publishes a per-keyword threshold' };
  const churnNone = (reason) => ({ available: false, reason: S(reason) || 'not available', basis: 'not available', measured: false,
    depth: 0, changed: null, changed_pct: null, entered: null, gone: null, moved: null, mean_move: null, band: null,
    from: null, to: null, device: '', labels_basis: CHURN.labels_basis });
  const snapOf = (v) => { const x = (v && typeof v === 'object' && !Array.isArray(v)) ? v : unpack(v, null);
    if (!x || x.unavailable) return null;
    const top = (Array.isArray(x.top) ? x.top : []).map(e => ({ p: Number(e && e.p) || 0, k: urlKey(e && e.u) })).filter(e => e.p > 0 && e.k);
    return top.length ? { top, at: x.at || null, device: S(x.device) || 'desktop', trimmed: S(x.trimmed) } : null; };
  // prev / cur: a stored snapshot (the packed string or the object). o: { min_depth }
  const churn = (prev, cur, o) => {
    const c = { ...CHURN, ...(o || {}) };
    const A = snapOf(prev), B = snapOf(cur);
    if (!B) return churnNone('this check could not read the results page, so nothing can be compared');
    if (!A) return churnNone('no earlier reading of this results page is stored, so how much it moved cannot be told yet');
    if (A.device !== B.device) return churnNone('the two readings are of different devices (' + A.device + ' and ' + B.device + ')');
    const depth = Math.min(A.top.length, B.top.length, CTR.length);
    if (depth < c.min_depth) return churnNone('only ' + depth + ' result' + (depth === 1 ? '' : 's') + ' were kept in both readings, too few to compare');
    const a = A.top.filter(e => e.p <= depth), b = B.top.filter(e => e.p <= depth);
    const aAt = new Map(a.map(e => [e.p, e.k])), bAt = new Map(b.map(e => [e.p, e.k]));
    const aPos = new Map(a.map(e => [e.k, e.p]));
    let changed = 0;
    for (let p = 1; p <= depth; p++) if ((aAt.get(p) || '') !== (bAt.get(p) || '')) changed++;
    const gone = a.filter(e => !b.some(x => x.k === e.k)).length;
    const entered = b.filter(e => !aPos.has(e.k)).length;
    const moves = b.filter(e => aPos.has(e.k)).map(e => Math.abs(e.p - aPos.get(e.k)));
    const changed_pct = Math.round(changed / depth * 100);
    return { available: true, reason: '', basis: 'measured', measured: true, depth,
      changed, changed_pct, entered, gone, moved: moves.filter(m => m > 0).length,
      mean_move: moves.length ? r1(moves.reduce((s, x) => s + x, 0) / moves.length) : 0,
      band: changed_pct >= c.high_pct ? 'high' : changed_pct >= c.still_pct ? 'some' : 'still',
      from: A.at, to: B.at, device: B.device, trimmed: !!(A.trimmed || B.trimmed), labels_basis: c.labels_basis };
  };
  // "7 of 10 places on the results page changed since 2026-10-07" — the measured sentence, with its basis
  const churnText = (ch) => {
    if (!ch || !ch.available) return 'How much the results page itself moved: not available — ' + ((ch && ch.reason) || 'no comparison was possible') + '.';
    const when = ch.from ? ' since the reading of ' + String(ch.from).slice(0, 10) : ' since the previous reading';
    const band = ch.band === 'noise' ? 'the results page changed no more than two readings of the same moment do' : ch.band === 'high' ? 'the whole results page moved' : ch.band === 'some' ? 'part of the results page moved' : 'the results page barely moved';
    return band + ': ' + ch.changed + ' of the top ' + ch.depth + ' places changed' + when
      + (ch.entered ? ', ' + ch.entered + ' new page' + (ch.entered === 1 ? '' : 's') + ' came in' : '')
      + (ch.mean_move ? ', and the pages present in both readings moved ' + ch.mean_move + ' place' + (ch.mean_move === 1 ? '' : 's') + ' on average' : '')
      + ' (measured by comparing the two stored readings; ' + ch.labels_basis + (ch.noise ? '; ' + ch.noise.text : '') + ').';
  };
  // the clause that goes beside a gain or a drop, so a move is never reported without the context that decides what it means
  const moveNote = (delta, ch) => {
    if (delta == null) return '';
    if (!ch || !ch.available) return 'whether the results page itself moved cannot be told — ' + ((ch && ch.reason) || 'no earlier reading stored');
    if (ch.band === 'noise') return 'the results page changed no more than two readings of the same moment do (' + ch.changed + ' of the top ' + ch.depth + ' places; ' + ((ch.noise || {}).text || '') + '), so this is one reading against one reading, not movement';
    if (ch.band === 'high') return 'the whole results page moved that week (' + ch.changed + ' of the top ' + ch.depth + ' places changed), so this is not necessarily about your page';
    if (ch.band === 'some') return 'part of the results page moved too (' + ch.changed + ' of the top ' + ch.depth + ' places changed)';
    return 'the rest of the results page barely moved (' + ch.changed + ' of the top ' + ch.depth + ' places changed), so this move is your page';
  };
  // ---- R87 / R90 / R88 (2026-10-16, re-rating 2026-10-15): one reading of a stored results page, read the same way everywhere ----
  // serpHosts: the hosts of ONE stored reading in rank order, one entry per position — the snapshot's own top ten (a domain holding
  // three positions appears three times, which the fit gate's "holds 3 of the top 5" rule needs), else the `above` list. Never the
  // `above` list AND the competitor list of the same answer together: the Rank Tracker report did that, so tax.gov.ae (#1) and
  // mof.gov.ae (#2) were each counted twice and "e invoicing in uae" — two government sites in its top five, the rule asks for three —
  // was set aside as a government query (exec 632).
  const serpHosts = (row, depth) => {
    const r = row || {}; const n = depth || 10;
    const snap = unpack(r.snapshot_json, null);
    const top = (snap && !snap.unavailable && Array.isArray(snap.top) ? snap.top : []).map(e => ({ p: Number(e && e.p) || 0, h: bare(hostOf(S(e && e.u))) }))
      .filter(e => e.p > 0 && e.h).sort((a, b) => a.p - b.p);
    if (top.length) return top.filter(e => e.p <= n).map(e => e.h);
    const c = unpack(r.competitors_json, null);
    return ((c && Array.isArray(c.above)) ? c.above : []).map(x => ({ p: Number(x && x.p) || 0, h: bare(S(x && x.d)) })).filter(e => e.p > 0 && e.p <= n && e.h)
      .sort((a, b) => a.p - b.p).map(e => e.h);
  };
  const isDesk = (h) => S((h || {}).device || 'desktop') !== 'mobile';
  const kwKey = (k) => S(k).toLowerCase().replace(/\s+/g, ' ').trim();
  // the newest stored DESKTOP reading of one keyword for one site, taken before `before` — whichever workflow bought it (a ladder, the
  // weekly site check, the tracker's own list). R88: the ladder report used its own ladder's rows only and the tracked-keyword report
  // any reading of the site, so one keyword in one run got "3 of top 8 changed" and "5 of top 8 changed". o: { keyword, domain, before,
  // valid (default: a real position, 0 = not in the top 50; -1 = a failed check is never a baseline), withSnapshot (a stored page: snapshot or competitor list) }
  const prevReading = (rows, o) => {
    const q = o || {}; const kw = kwKey(q.keyword), dom = bare(q.domain); const before = S(q.before || '9999');
    return (rows || []).filter(h => h && isDesk(h) && kwKey(h.keyword) === kw && (!dom || bare(h.domain) === dom) && S(h.checked_at) && S(h.checked_at) < before
      && h.position !== '' && h.position != null && Number(h.position) >= 0 && (!q.withSnapshot || !!unpack(h.snapshot_json, null) || !!unpack(h.competitors_json, null)))
      .sort((a, b) => S(b.checked_at).localeCompare(S(a.checked_at)))[0] || null;
  };
  // how much two readings of the SAME results page differ when nothing can have changed: stored desktop readings of the keyword for the
  // site taken within `minutes` of each other (the Rank Tracker and the weekly site check often read the same page minutes apart). Exec
  // 632 / 634 read "erp implementation dubai" 32 seconds apart and led with different pages. The largest such difference is the noise a
  // single reading against a single reading carries; a change no larger than it is not called movement. null when no such pair exists.
  const noise = (rows, o) => {
    const q = o || {}; const kw = kwKey(q.keyword), dom = bare(q.domain); const win = (Number(q.minutes) || 15) * 60e3;
    const rs = (rows || []).filter(h => h && isDesk(h) && kwKey(h.keyword) === kw && (!dom || bare(h.domain) === dom) && unpack(h.snapshot_json, null))
      .sort((a, b) => S(a.checked_at).localeCompare(S(b.checked_at)));
    let best = null;
    for (let i = 1; i < rs.length; i++) {
      const gap = Date.parse(S(rs[i].checked_at)) - Date.parse(S(rs[i - 1].checked_at));
      if (!(gap >= 0 && gap <= win)) continue;
      const ch = churn(rs[i - 1].snapshot_json, rs[i].snapshot_json, {});
      if (!ch.available) continue;
      if (!best || ch.changed > best.changed) best = { changed: ch.changed, depth: ch.depth, minutes: Math.round(gap / 6e4 * 10) / 10, at: S(rs[i].checked_at) };
    }
    if (!best) return null;
    return { ...best, text: 'two readings of this results page taken ' + best.minutes + ' minutes apart (' + best.at.slice(0, 10) + ') already differed in ' + best.changed + ' of the top ' + best.depth + ' places' };
  };
  // a measured change, judged against that noise: no larger than it = 'noise', and every severity word is withheld
  const withNoise = (ch, nz) => {
    if (!ch || !ch.available || !nz) return ch;
    const out = { ...ch, noise: nz };
    if (ch.changed <= nz.changed) { out.band = 'noise'; out.within_noise = true; }
    return out;
  };
  return { CTR, SUM_CTR, METHOD, AIO_KEEP, AIO_SOURCE, keepAt, CHURN, read, features, typeList, ourRank, landscape, voice, snapshot, pack, unpack,
    featureLine, featureChips, churn, churnNone, churnText, moveNote, bare, hostOf, isOurs, listOf, weight, urlKey, serpHosts, prevReading, noise, withNoise };
})();
// R16 (2026-10-13, FIX_PLAN §3.11): the fit gate also reads the rows stored before it existed. A planned rung that names a competitor
// ("facts erp" -> facts.ae) or a government portal is set aside: no check is bought for it and the report names it with the reason
// instead of listing it as a page to write. A rung whose page is already written or published keeps its check (fitStored).
// ---- fit gate (2026-10-11, FIX_PLAN D4 / D8): ONE rule for keywords that no page of this website should target. Inlined by the build
// (the FIT_GATE placeholder) into Analyze Keywords (full report: keyword gap, easy wins, opportunities), Rank Keywords (discovery), Ladder Pool /
// Ladder Plan (ladder rungs and the main keyword), Relevance Chunks (the brands the AI screen is told about) and Brief Context (the hub
// page's cluster list); a copy goes to harness/code_v4/_fit_gate.js as a shim (S34). fitGate(keyword, ctx) -> { ok: true } or
// { ok: false, reason, detail } with reason one of:
//   'own brand'    — the keyword names the website itself (its domain label, 4+ letters);
//   'navigational' — DataForSEO Labs says the intent is navigational (ctx.intent);
//   'government'   — the keyword is a public body or an identity document and nothing else (FTA, EmaraTax, MoHRE, GDRFA, ICP, RTA, DEWA,
//                    ZATCA, GOSI, "ministry …", "… authority", Emirates ID, UAE Pass, visa / labour card status …), or a body with a portal /
//                    status word ("fta portal", "emirates id status"), or, with its results page in hand (ctx.serp), 3+ of the top 5 results
//                    are on government hosts (.gov / .gov.xx / .gouv.xx / u.ae …);
//   'portal'       — a login / portal / password / status check / renewal / verification / application task: people want the owner's own site;
//   'off topic'    — with topics on file (ctx.topics, R13): under a quarter of the keyword's own words have anything to do with what the
//                    site sells ("character ai", "mofa attestation dubai", "mh enterprises uae");
//   'too broad'    — with topics on file: nothing but generic or place words is left of it ("ai", "google ai", "microsoft ai");
//   'other brand'  — one of its words is the label of a declared competitor (cleartax.com ↔ "cleartax"), of a domain on the results page
//                    (facts.ae ↔ "facts"), or a brand name AI uses for another company (seo_cache ai_brands: name -> domain); with the
//                    keyword's own results page in hand also when one domain whose label is in the keyword holds 3+ of the top 5.
// Bounds, so that legitimate keywords survive:
//   * a public body with a topic word is a topic, not a destination: "zatca e invoicing", "fta vat registration", "mohre wps" are kept — only
//     the body alone (plus country words) or with a portal / status word is refused;
//   * a portal word with a content / buying word is kept ("best erp software with mobile login", "emaratax registration guide"); a plain
//     category noun is not enough ("erp software login" is still a login);
//   * a results-page or AI-named brand with a partner-type word ("sap implementation dubai", "microsoft dynamics 365 partner uae") or a
//     comparison word ("facts erp vs odoo") is kept; a declared competitor is kept only when compared ("cleartax vs zoho"); a results-page
//     label (often a dictionary word) counts only where a product name sits — first, or right before a category word ("facts erp", not
//     "erp facts and figures guide");
//   * a domain label shorter than 4 letters, a word of the keyword being researched (ctx.protect: head term / seeds / services) or a generic
//     word (erp, software, tax …) never counts as a brand; "www", "m", "app" prefixes are dropped before the label is taken.
// Relevance to the website's services is NOT judged here. ctx.relevance (FIX_PLAN G19) is the hook: a function (keyword) -> { ok, reason,
// detail } called last, so the first version of G19 plugs in without touching the callers.
const FIT_CFG = { min_label: 4, serp_top: 5, serp_hold: 3 };
const FIT_STOP = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'my', 'your', 'our', 'is', 'are', 'what', 'how', 'me']);
const FIT_GEO = new Set(['uae', 'u.a.e', 'dubai', 'abu', 'dhabi', 'sharjah', 'ajman', 'fujairah', 'ras', 'al', 'khaimah', 'umm', 'quwain', 'emirates', 'gcc', 'saudi', 'arabia', 'ksa', 'riyadh', 'jeddah', 'qatar', 'doha', 'oman', 'muscat', 'bahrain', 'kuwait', 'egypt', 'india', 'pakistan', 'uk', 'usa', 'us', 'online', 'portal']);
// R13 (2026-10-13): 'ai' joined this list — it is a category word, not a topic. With it in, "ai" (165,000/mo) and "google ai" are left with
// nothing of their own ("too broad") while "character ai", "humanize ai", "meta ai" and "blackbox ai" are judged on the word that is really
// theirs; a keyword that names a service of the site ("ai automation uae") still matches on that service's own words.
const FIT_GENERIC = new Set(['ai', 'software', 'softwares', 'services', 'service', 'erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'tax', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll', 'finance', 'financial', 'cloud', 'digital', 'online', 'web', 'data', 'tech', 'technology', 'technologies', 'solutions', 'solution', 'systems', 'system', 'business', 'company', 'group', 'global', 'international', 'gulf', 'arab', 'arabia', 'emirates', 'national', 'consulting', 'consultants', 'consultancy', 'partners', 'partner', 'network', 'news', 'blog', 'guide', 'guides', 'info', 'best', 'top', 'free', 'app', 'apps', 'shop', 'store', 'market', 'media', 'academy', 'institute', 'university', 'school', 'bank', 'pay', 'pro', 'plus', 'hub', 'one', 'first', 'smart', 'easy', 'get', 'go', 'ae', 'com', 'net', 'org', 'home', 'house', 'world', 'city', 'daily', 'times', 'post', 'review', 'reviews', 'compare', 'comparison', 'list', 'directory', 'jobs', 'careers', 'wiki', 'wikipedia', 'youtube', 'linkedin', 'facebook', 'instagram', 'twitter', 'reddit', 'quora', 'medium', 'google', 'microsoft', 'amazon', 'apple']);
const FIT_GOV_WORDS = /\b(ministry|ministries|authority|authorities|federal|government|govt|municipality|municipal|embassy|consulate|police|courts?|customs|immigration|department of|public prosecution|parliament|chamber of commerce|free zone authority)\b/;
const FIT_GOV_NAMES = /\b(fta|emaratax|emara ?tax|tax authority|mohre|mohap|mofa|moec|gdrfa|icp|ica|rta|dewa|sewa|fewa|addc|aadc|dha|doh|ded|tdra|adjd|ejari|dubai land department|dld|dubai economy|dubai courts|zatca|gazt|gosi|qiwa|absher|muqeem|mudad|hrsd|misa|nafath|tawtheeq|uae pass|smart pass|amer cent(er|re)|tasheel|tawjeeh|emirates id|emirates identity|national id|i ?d card|identity card|labou?r card|work permit status|visa status|visa check|passport status|establishment card|golden visa status|trn verification|trn check|trn lookup|tax registration number check)\b/;
const FIT_PORTAL = /\b(log ?in|logins|sign ?in|sign ?up|password|passwords|portal|portals|e ?services?|customer care|customer service number|helpline|toll ?free|contact number|phone number|status|status check|check status|status enquiry|application status|track(ing)? (status|application|order)|renewal|renew|verification|verify|apply online|online application|download (the )?app|app download|complaint|complaints|fine check|traffic fines?|balance check|otp)\b/;
// content / buying words that turn a portal or government query into a topic ("best erp software with mobile login", "emaratax registration guide");
// plain category nouns (software, system, services …) do not — "erp software login" is still a login
const FIT_CONTENT = /\b(best|top|vs|versus|compar(e|ison)|review|reviews|alternatives?|how to|guide|guides|checklist|requirements?|pricing|price|prices|cost|costs|quote|quotes|hire|consultan(t|ts|cy|cies)|consulting|partner|partners|provider|providers|vendor|vendors|agency|agencies|accredited|approved|certified|compliant|compliance|implementation|integration|integrations|training|course|courses|template|templates|examples?|explained|meaning|benefits|registration|register|filing|return|returns|refund|refunds|deadline|deadlines|penalt(y|ies)|rules?|regulations?|free trial|demo|tutorial|steps|process|procedure)\b/;
const FIT_PARTNER = /\b(partner|partners|partnership|reseller|resellers|implementation|implement|implementer|implementers|consultan(t|ts|cy|cies)|consulting|integration|integrations|integrate|migration|migrate|support|training|developer|developers|development|customi[sz]ation|customi[sz]e|add-?ons?|plugins?|specialist|specialists|expert|experts|agency|agencies|services?)\b/;
// R60: the words of a public body's own service to a person (with FIT_GOV_NAMES only): nothing a business sells is left once they are taken out
const FIT_GOV_SERVICE = /^(attestation|attestations|attest|attested|legali[sz]ation|legali[sz]e|apostille|notari[sz]ation|passport|passports|visa|visas|residency|iqama|renewal|renew|renewing|fines?|penalty|appointment|appointments|booking|stamp|stamping|medical|fitness|typing|cancellation|cancel|replacement|lost|reprint|fees?|charges?|timings?|working|hours|office|offices|centre|center|centres|centers|near|location|locations|track|tracking|apply|application|form|forms|download|print|copy|expiry|expired|validity|valid|enquiry|inquiry)$/;
const FIT_COMPARE = /\b(vs|versus|compare|comparison|alternatives?|instead of|better than|difference between|against)\b/;
const fitTokens = (s) => String(s || '').toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9.]+/).map(t => t.replace(/^\.+|\.+$/g, '')).filter(t => t.length > 1 && !FIT_STOP.has(t));
const fitHost = (d) => String(d || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^(www|m|app|en|ar)\./, '');
const fitGovHost = (d) => { const h = fitHost(d); return /(^|\.)gov(\.[a-z]{2,3})?$/.test(h) || /(^|\.)(gouv|gob|go|gv)\.[a-z]{2}$/.test(h) || /(^|\.)mil(\.[a-z]{2})?$/.test(h) || /(^|\.)(u\.ae|government\.ae|dubai\.ae|abudhabi\.ae|sharjah\.ae|ajman\.ae|rak\.ae|tax\.gov\.ae|europa\.eu)$/.test(h); };
// the brand label(s) of a domain: "facts.ae" -> ["facts"], "northwind-erp.com" -> ["northwind"] (generic / short parts dropped), "e-invoicing.ae" -> []
const fitLabels = (domain, protect) => { const h = fitHost(domain); if (!h) return []; const first = h.split('.')[0]; const parts = [...new Set([first, ...first.split(/[-_]/)])];
  return parts.map(p => p.replace(/[^a-z0-9]/g, '')).filter(p => p.length >= FIT_CFG.min_label && !FIT_GENERIC.has(p) && !FIT_GEO.has(p) && !(protect || []).includes(p)); };
// the learned "name -> domain" map from seo_cache rows (key ai_brands:<site_id>), any shape of row list
const fitLearnedBrands = (rows) => { const out = {}; for (const r of (rows || [])) { const j = r && r.json ? r.json : r; if (!j || typeof j !== 'object' || !/^ai_brands:/.test(String(j.key || ''))) continue; let v = j.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } if (v && typeof v === 'object') for (const [name, d] of Object.entries(v)) if (name && d) out[String(name)] = String(d); } return out; };
// the organic domains of a DataForSEO SERP answer, in rank order (for ctx.serp)
const fitSerpDomains = (res) => { try { return ((((res || {}).tasks || [])[0] || {}).result || [])[0].items.filter(x => x && x.type === 'organic').sort((a, b) => (a.rank_group || 99) - (b.rank_group || 99)).map(x => fitHost(x.domain || String(x.url || '').replace(/^https?:\/\//, '').split('/')[0])).filter(Boolean); } catch (e) { return []; } };
// ---- R13 (2026-10-13, re-rating §3.11): TOPIC DISTANCE, the same 25% bar the outreach gate uses (OK.OFF_TOPIC in _outreach_kit.js) ----
// The full report's §4a offered "ai" (165,000/mo), "character ai" (110,000), "google ai", "humanize ai", "meta ai", "blackbox ai",
// "mh enterprises uae" and "microsoft ai", and the gap kept "mofa attestation dubai" and "how to check emirates id status with passport
// number", under a High finding telling the owner to build pages for them: the gate only ever refused classes somebody had listed
// (navigational, a declared competitor, a results-page label), so a brand or a subject nobody listed walked straight through. fitTopic()
// measures what share of a keyword's OWN distinctive words the site's topics carry. Place names and generic category words are neutral —
// they count for neither side, so "best erp software dubai" is judged on "erp" — and a keyword left with nothing but generic or place
// words ("ai", "google ai", "microsoft ai") is too broad for any page of this site to win.
const FIT_TOPIC_BAR = 0.25;
const fitStem = (w) => w.length > 5 ? w.replace(/(ingly|ings|ing|ments|ment|ations|ation|ions|ion|ies|ers|er|ed|es|s|e)$/, '') : w;   // the outreach kit's stem: invoice / invoices / invoicing -> invoic
const fitTopicWords = (topics) => new Set((Array.isArray(topics) ? topics.filter(Boolean).join(' ') : String(topics || '')).toLowerCase()
  .split(/[^a-z0-9]+/).filter(t => t.length > 2 && !FIT_STOP.has(t) && !FIT_GEO.has(t)).map(fitStem));
function fitTopic(keyword, topics, ctx) {
  const o = ctx || {};
  const bar = typeof o.topic_bar === 'number' ? o.topic_bar : FIT_TOPIC_BAR;
  const label = String(o.topic_label || 'what this website sells');
  const T = fitTopicWords(topics);
  // With little on file the measure would refuse good keywords, so under topic_min_words (12) distinctive words it judges nothing: a site
  // whose services and description are a single line gets no topic refusals at all ("no evidence, no refusal").
  if (T.size < (typeof o.topic_min_words === 'number' ? o.topic_min_words : 12)) return { ok: true, reason: '', detail: T.size ? 'too few topic words on file (' + T.size + ') to judge topic distance' : 'no topics on file, so topic distance was not judged', share: null };
  const toks = fitTokens(keyword);
  const own = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t));
  const known = [...T];
  const matches = (t) => { const s = fitStem(t); return T.has(s) || known.some(x => x.length >= 5 && s.length >= 5 && (s.indexOf(x) === 0 || x.indexOf(s) === 0)); };
  // a keyword made only of category and place words is a head term: it is on topic when at least two of those categories are the site's own
  // ("erp software uae", "best erp software dubai"), and too broad when only one is and there is no market in it either ("ai", "google ai")
  if (!own.length) {
    const cats = toks.filter(t => FIT_GENERIC.has(t)).filter(matches);
    const hasPlace = toks.some(t => FIT_GEO.has(t));
    if (cats.length >= 2 || (cats.length >= 1 && hasPlace)) return { ok: true, reason: '', detail: 'a category you sell (' + cats.join(', ') + ')' + (hasPlace ? ' in your market' : ''), share: 1 };
    return { ok: false, reason: 'too broad', detail: 'only category or place words, so it says nothing about ' + label + ' ("' + String(keyword || '').trim() + '")', share: cats.length ? 0.5 : 0 };
  }
  const hits = own.filter(matches);
  const share = Math.round(100 * hits.length / own.length) / 100;
  if (share < bar) return { ok: false, reason: 'off topic', detail: Math.round(share * 100) + '% of its own words match ' + label + ' (' + Math.round(bar * 100) + '% is the bar): '
    + own.filter(t => hits.indexOf(t) < 0).slice(0, 4).join(', ') + ' — add it to your services if you do sell it', share };
  return { ok: true, reason: '', detail: Math.round(share * 100) + '% of its own words match ' + label, share };
}
// ctx: { intent, own_domain, competitors: [domains, declared], serp_domains: [domains on the results page / auto-detected rivals], brands: { name: domain } (learned),
//       serp: [this keyword's own top domains, in rank order] (optional), protect: [words of the head term / seeds / services], relevance: fn (G19 hook) }
function fitGate(keyword, ctx) {
  ctx = ctx || {};
  const kw = String(keyword || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const toks = fitTokens(kw); const squashed = toks.join('');
  if (!toks.length) return { ok: false, reason: 'empty', detail: 'no keyword' };
  const protect = [...new Set((ctx.protect || []).flatMap(p => fitTokens(p)))];
  const has = (re) => re.test(' ' + kw + ' ');
  const contentWord = has(FIT_CONTENT), partnerWord = has(FIT_PARTNER), compareWord = has(FIT_COMPARE), portalWord = has(FIT_PORTAL);
  // 1. the website itself
  for (const l of fitLabels(ctx.own_domain, [])) if (toks.includes(l) || squashed.includes(l)) return { ok: false, reason: 'own brand', detail: 'names the website itself (' + l + ')' };
  // 2. the search data says navigational
  if (String(ctx.intent || '').toLowerCase() === 'navigational') return { ok: false, reason: 'navigational', detail: 'the search data classifies it as navigational (people look for one particular website)' };
  // 3. a public body or an identity document: "ministry of finance", "federal tax authority" (no content / buying word), "fta", "emaratax uae",
  //    "emirates id status" (the body alone, or with a portal / status word); "zatca e invoicing" and "fta vat registration" are topics and stay
  const govWord = (' ' + kw + ' ').match(FIT_GOV_WORDS);
  if (govWord && !contentWord) return { ok: false, reason: 'government', detail: 'a public body, not a topic (' + String(govWord[1] || govWord[0]).trim() + ')' };
  const govName = (' ' + kw + ' ').match(FIT_GOV_NAMES);
  if (govName) {
    const body = String(govName[1] || govName[0]).trim();
    const rest = toks.filter(t => !fitTokens(body).includes(t) && !FIT_GEO.has(t) && !/^(check|checking|card|number|no|online|status)$/.test(t));
    if (!rest.length || (portalWord && !contentWord)) return { ok: false, reason: 'government', detail: 'a public body or an identity document, not a topic (' + body + ')' };
    // R60 (2026-10-16, re-rating 2026-10-15): "mofa attestation dubai" and "how to check emirates id status with passport number" walked
    // through because one more word ("attestation", "passport") or a content word ("how to") made them look like a topic. A word that only
    // names what the public body does FOR A PERSON (attest a document, issue a passport or visa, renew a card, collect a fine, book an
    // appointment) adds no topic: the searcher still wants the body's own service, whatever "how to" is in front of it. "fta vat registration"
    // and "zatca e invoicing" keep a business topic word of their own, so they stay.
    if (rest.every(t => FIT_GOV_SERVICE.test(t))) return { ok: false, reason: 'government', detail: 'a service a public body provides to a person, not a topic for this website (' + body + ': ' + rest.join(' ') + ')' };
  }
  const serp = (ctx.serp || []).map(fitHost).filter(Boolean).slice(0, FIT_CFG.serp_top);
  if (serp.length >= FIT_CFG.serp_hold && serp.filter(fitGovHost).length >= FIT_CFG.serp_hold) return { ok: false, reason: 'government', detail: 'the results page belongs to government sites (' + [...new Set(serp.filter(fitGovHost))].slice(0, 3).join(', ') + ')' };
  // 4. a login / portal / status task
  if (portalWord && !contentWord) return { ok: false, reason: 'portal', detail: 'a login, portal, status or application task: people want the owner\'s own site' };
  // 5. another company's brand. A declared competitor's label counts anywhere in the keyword; a results-page label (often a dictionary word:
  //    facts.ae) only where a product name sits — first, or right before a category word ("facts erp", "best facts erp"; not "erp facts and figures")
  const rescue = partnerWord || compareWord;
  const leads = (l) => { const i = toks.indexOf(l); return i === 0 || (i > 0 && i + 1 < toks.length && (FIT_GENERIC.has(toks[i + 1]) || protect.includes(toks[i + 1]))); };
  for (const d of (ctx.competitors || [])) for (const l of fitLabels(d, protect)) if ((toks.includes(l) || squashed.includes(l)) && !compareWord) return { ok: false, reason: 'other brand', detail: 'names a competitor: ' + l + ' (' + fitHost(d) + ')' };
  for (const d of (ctx.serp_domains || [])) for (const l of fitLabels(d, protect)) if (toks.includes(l) && leads(l) && !rescue) return { ok: false, reason: 'other brand', detail: 'names another company on the results page: ' + l + ' (' + fitHost(d) + ')' };
  for (const [name, d] of Object.entries(ctx.brands || {})) {
    const nt = fitTokens(name).filter(t => !FIT_GENERIC.has(t) && !protect.includes(t));
    if (!nt.length || rescue) continue;
    const phrase = nt.join(' ');
    if ((' ' + toks.join(' ') + ' ').includes(' ' + phrase + ' ') || fitLabels(d, protect).some(l => toks.includes(l))) return { ok: false, reason: 'other brand', detail: 'a brand AI names for another company: ' + name + ' (' + fitHost(d) + ')' };
  }
  if (serp.length >= FIT_CFG.serp_hold) {
    const count = {}; for (const h of serp) count[h] = (count[h] || 0) + 1;
    for (const [h, n] of Object.entries(count)) if (n >= FIT_CFG.serp_hold && fitLabels(h, protect).some(l => toks.includes(l))) return { ok: false, reason: 'other brand', detail: h + ' holds ' + n + ' of the top ' + serp.length + ' results: a brand query' };
  }
  // 6. relevance to the website's services: the caller's own hook (G19) first, else the topic bar when the caller gave topics (R13)
  if (typeof ctx.relevance === 'function') { const r = ctx.relevance(kw); if (r && r.ok === false) return { ok: false, reason: r.reason || 'off topic', detail: r.detail || '' }; }
  else if (ctx.topics && (Array.isArray(ctx.topics) ? ctx.topics.length : String(ctx.topics).trim())) {
    const t = fitTopic(kw, ctx.topics, ctx); if (!t.ok) return { ok: false, reason: t.reason, detail: t.detail };
  }
  return { ok: true };
}
// one line for reports and prompts: "facts (facts.ae), cleartax (cleartax.com), Zoho Books (zoho.com)"
const fitBrandList = (ctx, protect) => { const out = []; const seen = new Set(); const add = (s) => { if (s && !seen.has(s)) { seen.add(s); out.push(s); } };
  for (const d of (ctx.competitors || [])) for (const l of fitLabels(d, protect)) add(l + ' (' + fitHost(d) + ')');
  for (const d of (ctx.serp_domains || [])) for (const l of fitLabels(d, protect)) add(l + ' (' + fitHost(d) + ')');
  for (const [n, d] of Object.entries(ctx.brands || {})) add(n + ' (' + fitHost(d) + ')');
  return out.slice(0, 40).join(', '); };
// ---- R16 (2026-10-13, system review FIX_PLAN §3.11): the same gate, run over a row somebody stored BEFORE the gate existed ----
// The gate stops a new keyword, but nothing ever revisited the rows already in `seo_ladders`: rung 2 of lad_mv40b6s9h5a8 still held
// "facts erp" (facts.ae, a competing UAE ERP vendor) as a planned page, so the Rank Tracker's report of 2026-10-12 listed it and the
// Content Cadence would have written it. `fitStored` is `fitGate` plus the one rule a stored row needs: a rung whose page is already
// written or published is never dropped — that page is live work, it keeps being tracked, and it is flagged instead of hidden.
// Returns { ok, live, flagged, reason, detail, note }: ok false = leave it out of what is written and reported; `note` is the sentence
// a report or the repair script prints, so the reason always travels with the decision.
const fitStoredLive = (row) => { const r = row || {}; const st = String(r.status || '').toLowerCase();
  return st === 'writing' || st === 'published' || r.page_exists === true || r.page_exists === 'true' || !!String(r.published_url || '').trim(); };
const fitStored = (row, ctx) => {
  const r = row || {}; const kw = String(r.keyword || '').trim();
  const live = fitStoredLive(r) || (ctx || {}).written === true;
  if (!kw) return { ok: false, live, flagged: false, reason: 'empty', detail: 'the row has no keyword', note: 'a stored row with no keyword' };
  const g = fitGate(kw, ctx || {});
  if (g.ok) return { ok: true, live, flagged: false, reason: '', detail: '', note: '' };
  const why = '"' + kw + '" is not a search this website should target: ' + g.detail + ' (' + g.reason + ')';
  if (live) return { ok: true, live: true, flagged: true, reason: g.reason, detail: g.detail,
    note: why + ' — its page is already written, so it stays tracked; decide whether to keep it' };
  return { ok: false, live: false, flagged: true, reason: g.reason, detail: g.detail,
    note: why + ' — it was planned before this rule existed, so it is set aside instead of written' };
};
// ---- B-G1 / B-G2 / B-G3 (2026-10-15, FIX_PLAN §3.16; INVARIANTS rule 2): the READ path, written once ----
// R16 put `fitStored` on two read paths — the Rank Tracker and the Content Cadence — and wrote the loop around it twice. Three more
// readers of the same stored rungs were written afterwards without it, and every one of them ACTS on what it reads: *AI Plan* (the AI
// Visibility Tracker and the AI Pulse) turns a stored rung into a question asked of ChatGPT and then scores the site against the answer;
// *Growth Plan* turns it into a "question to win" and then into a page the Content Cadence writes; *Site Plan* buys it a live rank check
// every week and prints it in the weekly report. Three copies of one loop are three chances to drift, and the drift IS this defect — so
// the loop lives here, once, and every reader calls it. FITR.rungs() never throws a refusal away: `set_aside` carries the row, the reason
// and the sentence to print, because a list that is shorter because a gate ran has to say so (INVARIANTS rule 1).
const FITR = {
  // The context a stored row is judged in. Deliberately the shape R16's two callers build by hand: the site's own domain, the
  // competitors it declared, the brand names AI uses for other companies, and — PROTECTED, so the ladder's own subject can never look
  // like somebody's brand — the ladder head terms, the site's services and its own tracked keywords. Topics are optional: with none on
  // file the topic bar judges nothing (fitTopic's own "no evidence, no refusal" rule).
  ctx(o) {
    o = o || {};
    const own = fitHost(o.own_domain || o.domain || '');
    const protect = [...new Set([...(o.heads || []), ...(o.services || []), ...(o.keywords || []), ...(o.protect || [])]
      .map(x => String(x || '').trim()).filter(Boolean))];
    return { own_domain: own, brands: o.brands || {}, intent: o.intent || '',
      competitors: [...new Set((o.competitors || []).map(fitHost).filter(d => d && d !== own))],
      serp_domains: (o.serp_domains || []).map(fitHost).filter(Boolean), protect,
      topics: o.topics && (Array.isArray(o.topics) ? o.topics.length : String(o.topics).trim()) ? o.topics : null,
      topic_label: o.topic_label || 'what this website sells' };
  },
  // Every stored row, gated once. Returns { keep, set_aside, dropped, flagged, refused_keywords }:
  //   keep      — what the caller may act on (a row whose page is already written stays: that page is live work);
  //   set_aside — one record per refusal, with `reason`, `detail`, `note` (the sentence to print), `written` and `dropped`.
  // opts: { keyword: row -> the keyword (default row.keyword), live: row -> true when the row must be kept and only flagged,
  //         serpFor: (keyword, row) -> [domains in rank order] for the results-page rules, where: a label naming this read path }.
  rungs(rows, ctx, opts) {
    const o = opts || {}; const C = ctx || {};
    const kwOf = typeof o.keyword === 'function' ? o.keyword : ((r) => (r || {}).keyword);
    const liveOf = typeof o.live === 'function' ? o.live : null;
    const serpFor = typeof o.serpFor === 'function' ? o.serpFor : null;
    const keep = []; const set_aside = [];
    for (const r0 of (rows || [])) {
      const r = (r0 && typeof r0 === 'object') ? r0 : {};
      const kw = String(kwOf(r0) || '').trim();
      if (!kw) { keep.push(r0); continue; }   // a row with no keyword is not this gate's business (the caller's own emptiness rules apply)
      const serp = serpFor ? (serpFor(kw, r0) || []).map(fitHost).filter(Boolean) : [];
      let c = C;
      if (serp.length) c = { ...c, serp, serp_domains: [...new Set([...(C.serp_domains || []), ...serp])] };
      if (liveOf && liveOf(r0)) c = { ...c, written: true };
      const g = fitStored({ ...r, keyword: kw }, c);
      if (g.ok) keep.push(r0);
      if (!g.flagged) continue;
      set_aside.push({ keyword: kw, reason: g.reason, detail: g.detail, note: g.note, written: !!g.live, dropped: !g.ok,
        where: String(o.where || ''), ladder_id: r.ladder_id || '', head_keyword: r.head_keyword || '', rung: Number(r.rung) || 0,
        page_no: Number(r.page_no) || 0, status: r.status || '', target_url: r.target_url || '', prompt_id: r.prompt_id || '' });
    }
    return { keep, set_aside, dropped: set_aside.filter(x => x.dropped), flagged: set_aside.filter(x => !x.dropped),
      refused_keywords: set_aside.filter(x => x.dropped).map(x => x.keyword) };
  },
  // The sentence a human reads. INVARIANTS rule 1: a list that is shorter because a gate ran says so, with the reason, every time.
  // `what` finishes "so they are not …" ("asked of the AI engines", "tracked", "written as a page").
  line(set_aside, what) {
    const a = (set_aside || []).filter(x => x && x.dropped);
    if (!a.length) return '';
    return a.length + ' stored keyword' + (a.length === 1 ? ' was' : 's were') + ' set aside, so ' + (a.length === 1 ? 'it is' : 'they are')
      + ' not ' + String(what || 'used') + ': ' + a.slice(0, 6).map(x => '"' + x.keyword + '" — ' + (x.detail || x.reason)).join('; ')
      + (a.length > 6 ? ' (and ' + (a.length - 6) + ' more)' : '')
      + '. They were planned before this rule existed; a page that is already written is kept and only flagged.';
  }
};
// Rank tracker: one SERP check (Google top 50) per tracked keyword: the primary keyword of every ladder page, plus the head term.
// Reads the ladders and the history from the Data Tables, skips finished ladders and caps the spend per run.
// v4.6 (no repeated checks): live pages, the head term and any keyword the site already ranks for are checked every week; pages not written /
// published yet that do not rank are checked once a month ("do we rank with another page now?") and carried in the report with their last check.
// v4.8: a WON ladder (the main keyword in the top 3 in each of its last 4 checks; failed checks skipped) is no longer dropped: its main keyword
// and its published pages are checked once a month, so a drop is noticed (a drop below the top 3 brings the ladder back to weekly checks).
// v4.16 (G6, 2026-10-12 system review): every check says which device it is for and carries the site's competitor list, so Parse Positions can
// record the competitors' positions and the share of voice from the same answer. The ladder's MAIN keywords (the top rung and the main page) also
// get a MOBILE check once a week — only 13% of sites hold the same position on both devices (Semrush, 50k keywords), so a desktop-only tracker
// reports a position most visitors never see. Cost: one more depth-50 call per main keyword, the measured $0.015, at most 2 per ladder a week
// (about $0.13 a month for a ladder, on top of the ~$0.60 it costs today).
// B6-7 (2026-10-15, benchmark area 6 - docs/system-review-2026-10-14/BENCH_AREA6_rank_tracking.md gap G6-8, register row B6-7):
// the tracker also watches the keywords the CUSTOMER named. max_watch_per_site / max_watch_per_run bound what one week may buy for them
// (the measured $0.015 a check, so 10 a site is $0.15 a week); watch_own_days is our own weekly rhythm (6, not 7, for the same reason the
// mobile check uses 6); watch_site_days is how recent a reading from the weekly SITE check has to be for the tracker to read it instead of
// buying a second one of the same results page on the same morning.
const LIMITS = { max_keywords_per_ladder: 15, max_checks_per_run: 120, stop_after_top3_checks: 4, unpublished_every_days: 28, won_every_days: 28,
  mobile: true, max_mobile_per_ladder: 2, mobile_every_days: 6,   // 6, not 7: a run started by hand on the day of the weekly run must not pay for the same mobile check twice
  max_watch_per_site: 10, max_watch_per_run: 30, watch_own_days: 6, watch_site_days: 10, max_watch_listed: 40 };
const daysSince = (iso) => iso ? (Date.now() - new Date(iso).getTime()) / 864e5 : 1e9;
const deferred = [];
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const rows = $('Load Ladders').all().map(i => i.json).filter(r => r && r.ladder_id);
let history = []; try { history = $('Load History').all().map(i => i.json).filter(r => r && r.ladder_id); } catch (e) { history = []; }
const isMobile = (h) => String((h || {}).device || '') === 'mobile';   // rows written before G6 have no device: they are desktop checks
const deskHist = history.filter(h => !isMobile(h));
// G6: who else we watch on these results pages — the one site model (SITE_MODEL_SPEC.md) merges seo_monitors.competitors with the
// seo_sites model column, so the tracker names the same competitors as the AI and backlink monitors. No rows stored = no competitor list.
const siteRows = rowsOf('Load Sites (Tracker)').filter(r => r.domain);
const monRows = rowsOf('Load Monitors (Tracker)').filter(r => r.site_id || r.domain);
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const competitorsFor = (domain) => {
  const d = normD(domain); if (!d) return [];
  const site = siteRows.find(r => normD(r.domain) === d) || { site_id: 'site_' + d.replace(/[^a-z0-9]+/g, '-'), domain: d };
  const mon = monRows.find(r => r.site_id === site.site_id || normD(r.domain) === d) || {};
  try { return SM.from(site, { monitors: mon }).competitors; } catch (e) { return []; }
};
// R16: the fit gate's context for one site — its own domain, its declared competitors, and the ladder heads plus the site's services as
// protected words (so the ladder's own topic can never be read as a brand).
// R90 (2026-10-16, re-rating 2026-10-15): a stored rung is judged with the evidence the gate needs and the plan never gave it. "facts erp"
// (rung 2 of "erp software uae") names facts.ae, which stands on the HEAD's own stored results page (#6 on 2026-10-14) — but the plan
// gave the gate only the declared competitors, `brands: {}` and no results page, and the rung is checked monthly, so it was planned and
// printed for another month. Now every stored rung of a ladder sees (a) the domains of its ladder's stored results pages (head and rungs,
// the last `serp_days`, the newest desktop reading of each keyword) as `serp_domains`, (b) its own newest stored page as `serp` (one entry
// per position, RS.serpHosts), and (c) the names AI uses for other companies (seo_cache ai_brands:<site>). Protected, so the site's own
// subject can never read as a brand: EVERY ladder head of the site and its services (the gate's own safety valve).
const SERP_DAYS = 60;
const aiBrandRows = rowsOf('Load AI Brands (Tracker)');
const nowIso = new Date().toISOString();
const storedRead = (domain, kw) => { const h = RS.prevReading(deskHist, { keyword: kw, domain, before: nowIso, withSnapshot: true });
  return (h && daysSince(h.checked_at) <= SERP_DAYS) ? h : null; };
const fitCtxFor = (domain, pages) => {
  const d = normD(domain);
  const site = siteRows.find(r => normD(r.domain) === d) || { site_id: 'site_' + d.replace(/[^a-z0-9]+/g, '-'), domain: d };
  const mon = monRows.find(r => r.site_id === site.site_id || normD(r.domain) === d) || {};
  let services = [];
  try { services = SM.from(site, { monitors: mon }).services || []; } catch (e) { services = []; }
  const heads = rows.filter(r => normD(r.domain) === d).map(r => String(r.head_keyword || ''));
  const serp_domains = [...new Set((pages || []).flatMap(p => RS.serpHosts(storedRead(d, p.keyword), 10)))].filter(h => normD(h) !== d);
  return { own_domain: d, brands: fitLearnedBrands(aiBrandRows.filter(r => String(r.key || '') === 'ai_brands:' + site.site_id)), competitors: competitorsFor(domain), serp_domains,
    protect: [...new Set([...heads, ...(pages || []).map(p => String(p.head_keyword || '')), ...services].filter(Boolean))] };
};
const byLadder = new Map();
for (const r of rows) { if (!byLadder.has(r.ladder_id)) byLadder.set(r.ladder_id, []); byLadder.get(r.ladder_id).push(r); }
const checks = []; const skipped = []; const setAside = []; const pausedLadders = [];
const serpBody = (p, device) => [{ keyword: p.keyword, location_code: Number(p.location_code), language_code: p.language_code || 'en', depth: 50,
  device, os: device === 'mobile' ? 'android' : 'windows' }];   // the device was never set before G6 (DataForSEO's default is desktop/windows)
for (const [id, pages] of byLadder) {
  const top = pages.find(p => Number(p.rung) === 4) || pages[0];
  const topHist = deskHist.filter(h => h.ladder_id === id && h.keyword === top.keyword && h.position !== '' && h.position != null && Number(h.position) >= 0).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));   // -1 = failed check: check again
  const last = topHist.slice(0, LIMITS.stop_after_top3_checks);
  const won = last.length >= LIMITS.stop_after_top3_checks && last.every(h => Number(h.position) > 0 && Number(h.position) <= 3);
  if (won && daysSince(last[0].checked_at) < LIMITS.won_every_days) {
    skipped.push({ ladder_id: id, reason: 'won: the top rung has held the top 3 for ' + last.length + ' checks — checked monthly, next after ' + new Date(new Date(last[0].checked_at).getTime() + LIMITS.won_every_days * 864e5).toISOString().slice(0, 10), won: true }); continue;
  }
  const competitors = competitorsFor(top.domain);
  const fitCtx = fitCtxFor(top.domain, pages);
  // R87 (2026-10-16): a ladder whose MAIN keyword is set aside is paused — its rungs exist only to climb towards it. Set aside means the
  // head row says `set_aside` (the Rank Tracker report and the cadence write it back with the reason) or the gate refuses the head now on
  // its own stored results page. Pages of the ladder that are live keep their weekly check (they are real pages); nothing else is bought.
  const headRow = pages.find(p => Number(p.rung) === 4) || null;
  const headFit = headRow ? fitStored(headRow, { ...fitCtx, serp: RS.serpHosts(storedRead(top.domain, headRow.keyword), 10) }) : { ok: true };
  const headAside = headRow && (String(headRow.status || '') === 'set_aside' || (headFit.flagged && !headFit.ok))
    ? { ladder_id: id, domain: top.domain, head_keyword: headRow.keyword, reason: String(headRow.status || '') === 'set_aside' ? 'set aside' : headFit.reason,
        detail: String(headRow.status || '') === 'set_aside' ? String(headRow.status_note || 'its main keyword was set aside') : headFit.detail,
        note: String(headRow.status || '') === 'set_aside' ? String(headRow.status_note || '') : headFit.note, held: [] } : null;
  if (headAside) pausedLadders.push(headAside);
  const sorted = [...pages].sort((a, b) => Number(a.rung) - Number(b.rung) || Number(a.page_no) - Number(b.page_no)).slice(0, LIMITS.max_keywords_per_ladder);
  const mobileWanted = [];   // the ladder's main keywords: the top rung and the main page (page 1), at most max_mobile_per_ladder
  for (const p of sorted) {
    if (checks.length >= LIMITS.max_checks_per_run) break;
    const live = Number(p.rung) === 4 || p.status === 'published' || p.page_exists === true || p.page_exists === 'true';
    // R16: a rung stored before the fit gate that nobody should write — no check is bought and the report names it with the reason
    const realPage = p.status === 'published' || p.page_exists === true || p.page_exists === 'true';
    if (headAside && Number(p.rung) === 4 && String(p.status || '') === 'set_aside') continue;   // R87: a head already set aside is not bought again
    if (headAside && Number(p.rung) !== 4 && !realPage) { headAside.held.push(p.keyword); continue; }   // R87: paused, so nothing is bought for a page that is not live
    const fit = fitStored(p, { ...fitCtx, serp: RS.serpHosts(storedRead(p.domain, p.keyword), 10) });
    if (fit.flagged) setAside.push({ ladder_id: id, domain: p.domain, head_keyword: p.head_keyword, rung: Number(p.rung) || 0, page_no: Number(p.page_no) || 0, keyword: p.keyword,
      target_url: p.target_url || '', status: p.status || '', reason: fit.reason, detail: fit.detail, note: fit.note, written: !!fit.live, dropped: !fit.ok });
    if (!fit.ok) continue;
    if (won && !live) continue;   // won ladder, monthly check: the main keyword and the published pages only
    const lastH = deskHist.filter(h => h.ladder_id === id && h.keyword === p.keyword).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0];
    if (!live && lastH && Number(lastH.position) === 0 && daysSince(lastH.checked_at) < LIMITS.unpublished_every_days) {   // only 'not in the top 50' (0); a page that ranks (published but not reported) or a failed check (-1) stays weekly
      deferred.push({ ladder_id: id, domain: p.domain, head_keyword: p.head_keyword, rung: Number(p.rung), page_no: Number(p.page_no), keyword: p.keyword, page_type: p.page_type || '', target_url: p.target_url || '', status: p.status || '',
        last_position: Number(lastH.position), last_url: lastH.url || '', last_checked: lastH.checked_at, device: 'desktop' }); continue; }
    const base = { ladder_id: id, domain: p.domain, head_keyword: p.head_keyword, rung: Number(p.rung), page_no: Number(p.page_no), keyword: p.keyword, page_type: p.page_type || '', target_url: p.target_url || '', status: p.status || '',
      location_code: Number(p.location_code), language_code: p.language_code || 'en', email: p.email || '', callback_url: p.callback_url || '', request_id: p.request_id || '', country: p.country || '', won_monthly: won, competitors };
    checks.push({ ...base, device: 'desktop', endpoint: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced', body: serpBody(p, 'desktop') });   // depth 50: ~$0.015 per check (depth 100 measured at $0.028); positions below 50 add little for a ladder
    if (LIMITS.mobile && (Number(p.rung) === 4 || Number(p.page_no) === 1) && mobileWanted.length < LIMITS.max_mobile_per_ladder && !mobileWanted.some(m => m.keyword === p.keyword)) mobileWanted.push(base);
  }
  // one mobile check per main keyword, after the desktop ones (so the desktop series keeps its order and the cap is spent on it first)
  for (const m of mobileWanted) {
    if (checks.length >= LIMITS.max_checks_per_run) break;
    const lastM = history.filter(h => isMobile(h) && h.ladder_id === id && h.keyword === m.keyword).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0];
    const every = won ? LIMITS.won_every_days : LIMITS.mobile_every_days;
    if (lastM && daysSince(lastM.checked_at) < every) { deferred.push({ ladder_id: id, domain: m.domain, head_keyword: m.head_keyword, rung: m.rung, page_no: m.page_no, keyword: m.keyword, page_type: m.page_type, target_url: m.target_url, status: m.status,
      last_position: Number(lastM.position), last_url: lastM.url || '', last_checked: lastM.checked_at, device: 'mobile' }); continue; }
    checks.push({ ...m, device: 'mobile', endpoint: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced', body: serpBody(m, 'mobile') });
  }
}
// ---- B6-7 (2026-10-15, benchmark area 6 - BENCH_AREA6_rank_tracking.md section 7): the keywords the CUSTOMER named ----
// Until now `Tracker Plan` read `seo_ladders` and nothing else, so the thirty searches a business names when it sets tracking up were
// invisible to the tracker that exists for exactly that question (gap G6-8: "a tracker tracks whatever keyword list you give it").
// Their list is already stored - `seo_sites.keywords`, written by the tracking form and by "Track my site" - and the weekly Site
// Tracker already BUYS a live check for much of it an hour later and stores the reading in THIS table (ladder_id = site_id, rung 0).
// So the rule here is read first, buy second:
//   * a reading the weekly site check made less than `watch_site_days` ago is READ, never bought again - the two workflows share one
//     series instead of each paying for the same results page on the same morning (R28's rule one step up: money is counted once
//     because it is spent once). Our own reading counts for `watch_own_days`, so the series stays weekly;
//   * what is bought is bounded - `max_watch_per_site` a site and `max_watch_per_run` a run, oldest reading first - and every keyword
//     the cap does not reach is NAMED with the cap and its last reading, never silently dropped (INVARIANTS rule 1);
//   * INVARIANTS rule 2: a stored keyword is read through the same fit gate the stored rungs pass. A competitor's brand typed into a
//     form is still a competitor's brand. Unlike the Site Tracker's own read path, the customer's keywords are deliberately NOT put
//     in `protect` here - protecting them would mean the gate could never judge them, which is the whole point of running it;
//   * the rows are written under `watch_<site_id>`, so a reading of ours is told apart from the site check's own (that is what makes
//     "somebody already buys this one weekly" a measurement and not a guess) while both halves stay one series for the report.
const kwList = (v) => [...new Set(String(v || '').split(/[\n,;]+/).map(k => k.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean))];
const already = new Set();   // what the ladders of this run already cost money for, or deliberately did not: a keyword is counted once
for (const c of checks) already.add(normD(c.domain) + '|' + String(c.keyword).toLowerCase());
for (const d of deferred) already.add(normD(d.domain) + '|' + String(d.keyword).toLowerCase());
for (const a of setAside) already.add(normD(a.domain) + '|' + String(a.keyword).toLowerCase());
const watchChecks = []; const watchCarried = []; const watchHeld = []; const watchAside = []; const watchSites = [];
let watchBudget = LIMITS.max_watch_per_run;
for (const s of siteRows) {
  if (String(s.status || 'active') === 'paused') continue;
  const d = normD(s.domain); if (!d) continue;
  const kws = kwList(s.keywords); if (!kws.length) continue;
  const sid = String(s.site_id || ('site_' + d.replace(/[^a-z0-9]+/g, '-')));
  const wid = 'watch_' + sid;
  const mon = monRows.find(m => m.site_id === sid || normD(m.domain) === d) || {};
  let services = []; try { services = SM.from(s, { monitors: mon }).services || []; } catch (e) { services = []; }
  const fitCtx = FITR.ctx({ own_domain: d, competitors: competitorsFor(d), heads: rows.filter(r => normD(r.domain) === d).map(r => r.head_keyword), services });
  const gated = FITR.rungs(kws.map(k => ({ keyword: k, domain: d, ladder_id: wid })), fitCtx, { where: 'the weekly rank tracker' });
  for (const a of gated.set_aside) watchAside.push({ site_id: sid, domain: d, keyword: a.keyword, reason: a.reason, detail: a.detail, dropped: !!a.dropped,
    note: '"' + a.keyword + '" is on your tracking list, but no position is checked for it: ' + a.detail + ' (' + a.reason + '). Take it off the list, or tell us it is deliberate.' });
  const kept = gated.keep.map(r => r.keyword);
  const site = { site_id: sid, domain: d, email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '',
    country: s.country || '', total: kws.length, checked: 0, carried: 0, held: 0, set_aside: gated.set_aside.filter(x => x.dropped).length };
  const loc = Number(s.location_code) || 0;
  if (!(loc > 0)) {   // rule 1: a keyword nobody can buy a country-level check for is named, not quietly missing
    for (const k of kept) watchHeld.push({ site_id: sid, domain: d, keyword: k, last_position: null, last_checked: '',
      reason: 'no market (country) is stored for this website, so a position cannot be checked for it - set the country in your tracking settings' });
    site.held = kept.length; watchSites.push(site); continue;
  }
  const competitors = competitorsFor(d);
  const newest = (kw, who) => deskHist.filter(h => String(h.keyword).toLowerCase() === kw && (who ? h.ladder_id === who : (h.ladder_id === wid || h.ladder_id === sid || normD(h.domain) === d))
    && h.position !== '' && h.position != null && h.checked_at).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0] || null;
  const cand = [];
  for (const k of kept) {
    const theirs = newest(k, sid), ours = newest(k, wid), any = newest(k, '');
    if (already.has(d + '|' + k)) {
      watchCarried.push({ site_id: sid, domain: d, keyword: k, source: 'ladder', last_checked: any ? any.checked_at : '',
        reason: 'it is also a rung of one of your keyword ladders, so the check bought there is the one reported - it is never bought twice' });
      site.carried++; continue;
    }
    if (theirs && daysSince(theirs.checked_at) < LIMITS.watch_site_days) {
      watchCarried.push({ site_id: sid, domain: d, keyword: k, source: 'site_check', last_checked: theirs.checked_at,
        reason: 'the weekly site check already read this results page on ' + String(theirs.checked_at).slice(0, 10) + ', so the tracker reads that reading instead of buying a second one' });
      site.carried++; continue;
    }
    if (ours && daysSince(ours.checked_at) < LIMITS.watch_own_days) {
      watchCarried.push({ site_id: sid, domain: d, keyword: k, source: 'own', last_checked: ours.checked_at,
        reason: 'it was checked on ' + String(ours.checked_at).slice(0, 10) + ', less than ' + LIMITS.watch_own_days + ' days ago - a position is checked once a week, not once a run' });
      site.carried++; continue;
    }
    cand.push({ keyword: k, last_at: any ? String(any.checked_at) : '', last_position: any ? Number(any.position) : null });
  }
  // oldest reading first, and a keyword nobody has ever checked before all of them: the cap buys the readings that are missing most
  cand.sort((a, b) => (a.last_at ? 1 : 0) - (b.last_at ? 1 : 0) || String(a.last_at).localeCompare(String(b.last_at)) || a.keyword.localeCompare(b.keyword));
  const room = Math.max(0, Math.min(LIMITS.max_watch_per_site, watchBudget, LIMITS.max_checks_per_run - checks.length - watchChecks.length));
  cand.forEach((c, i) => {
    if (i < room) {
      watchChecks.push({ ladder_id: wid, watch_keyword: true, site_id: sid, domain: d, head_keyword: '', rung: 0, page_no: 0, keyword: c.keyword,
        page_type: '', target_url: '', status: '', location_code: loc, language_code: s.language_code || 'en', email: s.email || '',
        callback_url: s.callback_url || '', request_id: s.request_id || '', country: s.country || '', won_monthly: false, competitors,
        device: 'desktop', endpoint: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
        body: serpBody({ keyword: c.keyword, location_code: loc, language_code: s.language_code || 'en' }, 'desktop') });
      site.checked++;
    } else {
      watchHeld.push({ site_id: sid, domain: d, keyword: c.keyword, last_position: c.last_position, last_checked: c.last_at,
        reason: 'the tracker buys at most ' + LIMITS.max_watch_per_site + ' checks a week for your own keyword list (oldest reading first, about $0.015 each), so this one waits for a week when an older reading does not need it more' });
      site.held++;
    }
  });
  watchBudget -= site.checked;
  watchSites.push(site);
}
const watch = { sites: watchSites, limits: { per_site: LIMITS.max_watch_per_site, per_run: LIMITS.max_watch_per_run, own_days: LIMITS.watch_own_days, site_days: LIMITS.watch_site_days },
  carried: watchCarried.slice(0, LIMITS.max_watch_listed), held: watchHeld.slice(0, LIMITS.max_watch_listed), set_aside: watchAside.slice(0, LIMITS.max_watch_listed),
  carried_total: watchCarried.length, held_total: watchHeld.length, set_aside_total: watchAside.length, checked_total: watchChecks.length };
const all = [...checks, ...watchChecks];
if (!all.length) return [{ json: { nothing_to_do: true, ladders: byLadder.size, skipped, deferred, set_aside: setAside, paused_ladders: pausedLadders, watch } }];
return all.map(c => ({ json: { ...c, skipped_ladders: skipped, deferred_pages: deferred, set_aside_pages: setAside, paused_ladders: pausedLadders, watch } }));
