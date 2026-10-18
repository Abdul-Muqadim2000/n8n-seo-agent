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
  return { from, stored, siteUrl, apiTarget, name, nap, services, pages, facts, matchPage, withPages, toRow, pageRows, COLUMNS, isFresh, ageDays, FRESH_DAYS, MATCH_MIN,
    titleShare, titleGap, canonUrl, isListing, pageScore, pageStep,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml, matchTerms } };
})();
// D15 (system review 2026-10-11): every URL we emit uses the site model's canonical host (SITE_MODEL_SPEC.md §6) -- the bare domain
// 308-redirects on a www site. With no model (an older run) or another site's domain, the bare domain keeps today's behaviour.
let SITE_MODEL = null; try { SITE_MODEL = $('Site Model').first().json.site_model || null; } catch (e) {}
const siteUrlOf = (dom, path) => SM.siteUrl(SITE_MODEL && SITE_MODEL.domain && SITE_MODEL.domain === SM.helpers.bare(dom) ? SITE_MODEL : { domain: dom }, path);
const base = $('Analyze Probes').first().json;
const domain = base.domain;
const picked = $('Pick Key Pages').all().map(i => i.json);
const res = $input.all().map(i => i.json);
const nowYear = new Date().getFullYear();

const entDecode = (() => {
  const N = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·', laquo: '«', raquo: '»', euro: '€', pound: '£', deg: '°' };
  return (s) => String(s == null ? '' : s).replace(/&(?:#[xX]([0-9a-fA-F]+)|#(\d+)|([a-zA-Z][a-zA-Z0-9]*));/g, (m, h, d, n) => {
    if (h !== undefined || d !== undefined) { const cp = h !== undefined ? parseInt(h, 16) : Number(d); if (cp === 160) return ' '; try { return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m; } catch (e) { return m; } }
    const k = n.toLowerCase(); return Object.prototype.hasOwnProperty.call(N, k) ? N[k] : m;
  });
})();   // R62: named + decimal + hex entities, one pass (v5/code/_entities.js)
const strip = (s) => entDecode(String(s || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const attr = (tag, name) => { const m = tag.match(new RegExp('\\s' + name + '\\s*=\\s*["\']([^"\']*)["\']', 'i')); return m ? m[1] : null; };
const asArr = (v) => v == null ? [] : (Array.isArray(v) ? v : [v]);
const typesOf = (n) => asArr(n['@type']).map(String);
const urlOf = (v) => typeof v === 'string' ? v : (v && (v.url || v['@id'])) || null;

const IGNORE_EXT = /cloudinary|apollo|googletagmanager|google-analytics|gstatic|googleapis|facebook\.net|doubleclick|hotjar|clarity|linkedin\.com\/company|vercel|jsdelivr|cdnjs|fonts\./i;

const P = [];
picked.forEach((pk, i) => {
  const r = res[i] || {};
  const html = String(r.html || r.body || r.data || '');
  const text = strip(html);

  // JSON-LD
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const nodes = []; let invalid = 0;
  for (const b of blocks) {
    try {
      const j = JSON.parse(b.trim());
      for (const x of asArr(j)) { if (x && x['@graph']) nodes.push(...x['@graph']); else if (x) nodes.push(x); }
    } catch (e) { invalid++; }
  }
  const types = [...new Set(nodes.flatMap(typesOf))];

  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => strip(m[1])).filter(Boolean);
  const headings = [...html.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi)].map(m => strip(m[1]));
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  const tels = [...new Set([...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map(m => m[1].trim()))];
  const extDomains = [...new Set([...html.matchAll(/href=["'](https?:\/\/[^"'\/]+)/gi)]
    .map(m => m[1].replace(/^https?:\/\/(www\.)?/, '').toLowerCase())
    .filter(d => !d.endsWith(domain) && !IGNORE_EXT.test(d)))];

  P.push({
    url: pk.url, kind: pk.kind, status: r.statusCode || 0, html, text, nodes, types, invalid,
    h1s, headings, imgs, tels, extDomains,
    forms: (html.match(/<form\b/gi) || []).length,
    inputs: (html.match(/<(input|textarea)\b/gi) || []).length,
    lang: (html.match(/<html[^>]*\slang=["']([^"']+)["']/i) || [])[1] || null,
    hreflang: /hreflang=/i.test(html),
    hreflangs: [...html.matchAll(/<link[^>]+hreflang=["']([^"']+)["'][^>]*>/gi)].map(m => ({ lang: m[1].toLowerCase(), href: (m[0].match(/href=["']([^"']+)["']/i) || [])[1] || '' })),
    speculation: /type=["']speculationrules["']/i.test(html),
    viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    noindex: /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html) || /<meta[^>]+content=["'][^"']*noindex[^"']*["'][^>]+name=["']robots["']/i.test(html),
    mixed: [...html.matchAll(/<(?:img|script|link|iframe|source|video|audio)\b[^>]*\s(?:src|href)=["']http:\/\/[^"']+["']/gi)].length,
    canonical: (html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i) || [])[1] || null
  });
});

const findings = [];
const works = [];
const urlsToCheck = [];
const F = (category, severity, title, evidence, why, fix, sample_urls = [], affected = null, total = null) => findings.push({
  category, severity, title, evidence, why, fix, sample_urls,
  affected_count: affected, affected_pct: affected != null && total ? Math.round(affected / total * 100) : 100,
  scope: affected != null ? 'page' : 'site'
});

const home = P.find(p => p.kind === 'home') || P[0] || { nodes: [], types: [], h1s: [], imgs: [], text: '', html: '' };
const allNodes = P.flatMap(p => p.nodes);
const ORG_TYPES = /^(Organization|Corporation|LocalBusiness|ProfessionalService|Store|Restaurant|MedicalBusiness|LegalService|FinancialService|EducationalOrganization)$/;
const org = home.nodes.find(n => typesOf(n).some(t => ORG_TYPES.test(t))) || allNodes.find(n => typesOf(n).some(t => ORG_TYPES.test(t)));

// ---------- Schema basics ----------
const invalidTotal = P.reduce((s, p) => s + p.invalid, 0);
if (invalidTotal) F('Schema', 'High', 'Invalid structured data (JSON-LD will not parse)', invalidTotal + ' broken JSON-LD block(s) on sampled pages', 'Search engines ignore structured data that cannot be parsed.', 'Validate the markup with Google Rich Results Test and fix syntax errors.', P.filter(p => p.invalid).map(p => p.url));
if (!home.nodes.length) {
  F('Schema', 'High', 'No structured data on the homepage', 'No JSON-LD found on ' + home.url, 'Structured data helps Google and AI systems understand who you are and what you offer.', 'Add Organization (or LocalBusiness/ProfessionalService) JSON-LD with name, logo, address, contact details and sameAs profiles.');
} else works.push('Structured data present on the homepage (' + home.types.join(', ') + ')');

if (!org) {
  F('Schema', 'High', 'No Organization schema', 'None of ' + P.length + ' sampled pages declare Organization or LocalBusiness', 'Without it, search engines and AI tools have no machine-readable identity for the business.', 'Add Organization JSON-LD sitewide with @id, name, logo, address, telephone, email and sameAs.');
} else {
  works.push('Organization schema found (' + typesOf(org).join(', ') + ')');

  // logo
  const logo = urlOf(org.logo);
  if (!logo) F('Schema', 'Medium', 'Organization schema has no logo', 'logo property missing', 'Google uses the schema logo for knowledge panels and brand results.', 'Add a logo ImageObject with url, width and height.');
  else urlsToCheck.push({ url: logo, purpose: 'Organization logo' });
  if (urlOf(org.image)) urlsToCheck.push({ url: urlOf(org.image), purpose: 'Organization image' });

  // sameAs
  const sameAs = asArr(org.sameAs).map(String);
  const bad = sameAs.filter(u => {
    const m = u.match(/(?:twitter|x)\.com\/([^\/?#]+)/i);
    return m ? !/^[A-Za-z0-9_]{1,15}$/.test(m[1]) : !/^https?:\/\/[^\s]+\.[^\s]+/.test(u);
  });
  if (bad.length) F('Schema', 'High', 'Malformed sameAs profile link', 'Invalid: ' + bad.join(', '), 'A broken identity link is worse than none: it confuses entity matching in Google and AI systems.', 'Remove or correct the invalid entry and link only real, active profiles.');
  if (sameAs.length - bad.length < 3) F('Schema', 'Medium', 'Few verified profiles linked in sameAs', (sameAs.length - bad.length) + ' valid sameAs link(s): ' + (sameAs.join(', ') || 'none'), 'Entity recognition works best with 4-6 independent profiles (LinkedIn, directories, Wikidata, Crunchbase, review sites).', 'Add sameAs links to every real business profile.');
  else works.push(sameAs.length + ' sameAs profile links');

  // NAP
  const addr = org.address && typeof org.address === 'object' ? org.address : null;
  const missing = [];
  if (!addr || !addr.streetAddress) missing.push('streetAddress');
  if (!addr || !addr.addressLocality) missing.push('addressLocality');
  const cps = asArr(org.contactPoint);
  const hasTel = org.telephone || cps.some(c => c.telephone);
  const hasEmail = org.email || cps.some(c => c.email);
  const visibleTel = P.some(p => p.tels.length) || /\+\d[\d\s-]{7,}/.test(home.text);
  const visibleMail = /[\w.+-]+@[\w-]+\.[\w.]+/.test(P.map(p => p.text).join(' '));
  if (!hasTel && visibleTel) missing.push('telephone');
  if (!hasEmail && visibleMail) missing.push('email');
  if (missing.length) F('Schema', 'High', 'Structured contact details are thinner than what the site shows', 'Missing in schema: ' + missing.join(', '), 'Search engines cannot match your business listing to your site when the address and phone in schema are incomplete.', 'Add full PostalAddress (streetAddress, addressLocality, addressRegion, postalCode, addressCountry), telephone and email to Organization schema.');
  else works.push('Organization schema includes full address and contact details');
  if (!org.alternateName) F('Schema', 'Low', 'No alternateName in Organization schema', 'alternateName missing', 'Helps search engines and AI map spelling variants of the brand to one entity.', 'Add alternateName with common variants of the brand name.');
  if (!org['@id']) F('Schema', 'Low', 'Organization schema has no @id', '@id missing', 'An @id lets other schema (Service, Article) reference the same organisation cleanly.', 'Add "@id": "https://' + domain + '/#organization".');

  // founding date vs experience claims
  const fy = parseInt(String(org.foundingDate || '').slice(0, 4), 10);
  const claims = P.flatMap(p => [...p.text.matchAll(/(\d{1,2})\s*\+?\s*years?\b/gi)].map(m => ({ n: +m[1], url: p.url })));
  const maxClaim = claims.reduce((a, c) => c.n > a.n ? c : a, { n: 0 });
  if (fy && maxClaim.n && maxClaim.n > (nowYear - fy) + 1) {
    F('Content', 'High', 'Experience claim conflicts with the founding date', '"' + maxClaim.n + '+ years" on ' + maxClaim.url + ' but schema foundingDate is ' + org.foundingDate, 'Contradictory facts damage trust with buyers and with search quality systems.', 'Make the claims consistent (e.g. "leadership with ' + maxClaim.n + '+ years of experience") or correct the founding date.', [maxClaim.url]);
  }

  // language
  const langs = asArr(org.availableLanguage).length;
  if (langs > 1 && !P.some(p => p.hreflang)) F('Technical', 'Info', 'Multiple languages declared but no hreflang', 'Schema lists ' + langs + ' languages; no hreflang tags found', 'Only matters once other language versions exist.', 'Add hreflang when translated pages go live.');
}

// ---------- Service & Breadcrumb ----------
const services = P.filter(p => p.kind === 'service');
const noService = services.filter(p => !p.types.some(t => /Service|Product|Offer/i.test(t)));
if (services.length && noService.length) F('Schema', noService.length === services.length ? 'High' : 'Medium', 'Service pages have no Service schema', noService.length + ' of ' + services.length + ' sampled service pages', 'Service schema tells search engines exactly what you offer, where and by whom, and separates similar service pages.', 'Add Service JSON-LD (serviceType, provider → Organization @id, areaServed) on each service page.', noService.map(p => p.url), noService.length, services.length);
else if (services.length) works.push('Service schema present on sampled service pages');

const inner = P.filter(p => p.kind !== 'home');
const noCrumb = inner.filter(p => !p.types.includes('BreadcrumbList'));
if (inner.length && noCrumb.length) F('Schema', noCrumb.length === inner.length ? 'High' : 'Medium', 'No BreadcrumbList schema', noCrumb.length + ' of ' + inner.length + ' sampled inner pages', 'Breadcrumbs show site hierarchy in search results and help search engines understand structure.', 'Add BreadcrumbList JSON-LD to every inner page.', noCrumb.map(p => p.url), noCrumb.length, inner.length);
else if (inner.length) works.push('BreadcrumbList schema present');

// ---------- Articles ----------
const arts = P.filter(p => p.kind === 'article');
const artNodes = arts.map(p => ({ p, n: p.nodes.find(n => typesOf(n).some(t => /Article|BlogPosting|NewsArticle/.test(t))) }));
// B-18 (re-rating 2026-10-17): a byline is a named person, a TEAM (an Organization author, or "Tech& Team" / staff / editorial desk), or
// nothing at all — and the finding says which it saw, on how many of the site's articles.
const bylineOf = (n) => { const a = n && asArr(n.author)[0]; const name = String((a && (typeof a === 'string' ? a : a.name)) || '').trim();
  const isOrg = !!a && typeof a === 'object' && typesOf(a).some(t => /Organization/.test(t));
  return { name, team: !!name && (isOrg || /\b(team|staff|admin|editors?|editorial|desk)\b/i.test(name)) }; };
const bylines = artNodes.map(x => ({ ...x, by: bylineOf(x.n) }));
const teamBy = bylines.filter(x => x.by.team), noneBy = bylines.filter(x => !x.by.name);
const noAuthor = [...teamBy, ...noneBy];
// the crawl's own article count; when the in-200 gate marked the crawl `unavailable` (__dfs) the count could not be read and is not claimed
const crawlAns18 = (() => { try { return $('Get Crawled Pages Answers').first().json || {}; } catch (e) { return {}; } })();
const siteArticles = (crawlAns18.__dfs && crawlAns18.__dfs.unavailable) ? null
  : (crawlAns18.tasks?.[0]?.result?.[0]?.items || []).filter(p => p && p.url && Number(p.status_code) === 200 && /\/(insights|blog|news|articles?|guides?)\/./i.test(p.url)).length;
const teamNames = [...new Set(teamBy.map(x => x.by.name))].slice(0, 3);
const authorTitle = !noneBy.length ? 'Articles have no named human author: they are credited to a team, not a person' : 'Articles have no named human author';
const authorEvidence = [teamBy.length ? teamBy.length + ' of ' + arts.length + ' sampled articles credit a team (' + teamNames.map(t => '"' + t + '"').join(', ') + '), not a named person' : '',
  noneBy.length ? noneBy.length + ' of ' + arts.length + ' sampled articles name no author at all' : ''].filter(Boolean).join('; ')
  + (siteArticles == null ? ' (the crawl could not be read, so how many articles the site has is not known)' : siteArticles > arts.length ? ' (' + arts.length + ' of the ' + siteArticles + ' articles the crawl found were read)' : '');
if (arts.length && noAuthor.length) F('Content', 'High', authorTitle, authorEvidence, 'Expertise signals (E-E-A-T) depend on a real, credentialed author, especially on advice or compliance topics.', 'Credit a named expert with an author page, job title and LinkedIn (author @type Person with url and sameAs).', noAuthor.map(x => x.p.url), noAuthor.length, arts.length);
const frozen = artNodes.filter(({ n }) => n && n.datePublished && n.dateModified && n.datePublished === n.dateModified);
if (frozen.length) F('Content', 'Medium', 'No freshness signal on articles', frozen.length + ' of ' + arts.length + ' sampled articles have dateModified equal to datePublished', 'Time-sensitive content looks unmaintained without a genuine update date.', 'Show a visible "Last reviewed" date and update dateModified only after real edits.', frozen.map(x => x.p.url), frozen.length, arts.length);
artNodes.forEach(({ n }) => { const pl = n && n.publisher && urlOf(n.publisher.logo); if (pl) urlsToCheck.push({ url: pl, purpose: 'Article publisher logo' }); });
const noCite = arts.filter(p => p.extDomains.length === 0);
if (arts.length && noCite.length) F('Content', noCite.length === arts.length ? 'High' : 'Medium', 'Articles cite no external sources', noCite.length + ' of ' + arts.length + ' sampled articles link to no authoritative source', 'Uncited facts are less trustworthy and less likely to be quoted by Google AI Overviews, ChatGPT or Perplexity.', 'Link each key fact, law or statistic to its primary source (government, standards body, vendor docs).', noCite.map(p => p.url), noCite.length, arts.length);
else if (arts.length) works.push('Sampled articles link to external sources');

// ---------- Homepage H1 ----------
const brand = String((org && org.name) || domain.split('.')[0]).toLowerCase().replace(/[^a-z0-9]/g, '');
const h1 = home.h1s[0] || '';
if (h1 && brand && !h1.toLowerCase().replace(/[^a-z0-9]/g, '').includes(brand.slice(0, Math.max(4, brand.length - 1)))) {
  F('On-Page', 'Low', 'Homepage H1 does not name the business or what it does', 'Homepage H1: "' + h1 + '"', 'The homepage H1 is the strongest on-page signal of who you are, what you sell and where.', 'Rewrite the H1 to name the brand, the service category and the location.', [home.url]);
}

// ---------- Contact form ----------
const contact = P.find(p => p.kind === 'contact');
if (contact && contact.forms === 0 && contact.inputs === 0) F('Technical', 'Medium', 'Contact form is not in the server-rendered HTML', 'Raw HTML of ' + contact.url + ' has 0 <form> and 0 <input> elements', 'Crawlers and AI agents that do not run JavaScript see no way to contact you.', 'Server-render the form (fields, labels, submit) or add a <noscript> fallback form.', [contact.url]);

// ---------- Images ----------
const heroImg = home.imgs[0];
if (heroImg && !(attr(heroImg, 'alt') || '').trim()) F('Images', 'Medium', 'Main homepage image has empty alt text', 'First image on the homepage: ' + (attr(heroImg, 'src') || '').slice(0, 80), 'The main image is usually the LCP element and carries meaning; empty alt loses context for search and accessibility.', 'Write descriptive alt text for the hero image.', [home.url]);
const noDim = P.flatMap(p => p.imgs.filter(t => !attr(t, 'width') || !attr(t, 'height')).map(t => ({ url: p.url, src: attr(t, 'src') })));
if (noDim.length >= 3) F('Images', 'Medium', 'Images without width and height', noDim.length + ' images on sampled pages lack explicit dimensions', 'Images without reserved space can shift the layout while loading (CLS).', 'Add width and height (or aspect-ratio) to every image.', [...new Set(noDim.map(x => x.url))]);

// ---------- Phone numbers ----------
const hiddenTels = [];
P.forEach(p => p.tels.forEach(t => { const digits = t.replace(/\D/g, '').slice(-7); if (digits && !p.text.replace(/\D/g, '').includes(digits)) hiddenTels.push(t + ' (' + p.url + ')'); }));
if (hiddenTels.length) F('Content', 'Low', 'Phone number in a link but not shown on the page', [...new Set(hiddenTels)].slice(0, 5).join('; '), 'Hidden or unlabeled numbers can be picked up by directories and AI as conflicting contact details.', 'Confirm the number, display it, or remove the link.');

// ---------- Content defects ----------
const latex = P.filter(p => /\$\\(ge|le|geq|leq|lt|gt|times)\$|\$[<>]\$/.test(p.text));
if (latex.length) F('Content', 'Medium', 'Raw formatting code visible on the page (LaTeX)', latex.length + ' page(s) show symbols like $\\ge$', 'Visible code looks unprofessional and breaks the most quotable passages.', 'Replace with plain characters such as ≥, ≤, <, >.', latex.map(p => p.url));
const artifacts = P.filter(p => p.headings.some(h => /^h[1-6]\s*:/i.test(h)));
if (artifacts.length) F('Content', 'Medium', 'Authoring artifacts in headings', 'Headings start with "H4:" or similar on ' + artifacts.length + ' page(s)', 'Leftover drafting labels show in the page, table of contents and anchor links.', 'Remove the "H2:/H3:/H4:" prefixes from headings.', artifacts.map(p => p.url));

// ---------- Mobile, indexability, security, hreflang ----------
const noViewport = P.filter(p => p.status === 200 && p.html.length > 500 && !p.viewport);
if (noViewport.length) F('Technical', 'High', 'Missing viewport meta tag (mobile-first indexing)', noViewport.length + ' of ' + P.length + ' sampled pages have no <meta name="viewport">', 'Without a viewport tag the page is not mobile-friendly and Google indexes the mobile version first.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the template.', noViewport.map(p => p.url), noViewport.length, P.length);
const noindexed = P.filter(p => p.noindex);
if (noindexed.length) F('Crawlability & Indexing', noindexed.some(p => p.kind === 'home' || p.kind === 'service') ? 'Critical' : 'Medium', 'Key pages carry a noindex tag', noindexed.map(p => p.kind + ': ' + p.url).join('; '), 'A noindex tag removes the page from Google entirely, however good it is.', 'Remove the noindex directive from pages that should rank; keep it only on utility pages.', noindexed.map(p => p.url), noindexed.length, P.length);
const mixedPages = P.filter(p => p.mixed > 0);
if (mixedPages.length) F('Security', 'Medium', 'Mixed content (HTTP resources on HTTPS pages)', mixedPages.reduce((s, p) => s + p.mixed, 0) + ' http:// resources referenced on ' + mixedPages.length + ' sampled pages', 'Browsers block or warn about insecure resources, which can break layout and scripts and undermines trust.', 'Reference every image, script and stylesheet over https://.', mixedPages.map(p => p.url), mixedPages.length, P.length);
const withHreflang = P.filter(p => p.hreflangs.length);
if (withHreflang.length) {
  const problems = [];
  withHreflang.forEach(p => {
    const langs = p.hreflangs.map(x => x.lang);
    if (!langs.includes('x-default')) problems.push(p.url + ': no x-default');
    const self = p.hreflangs.some(x => String(x.href).replace(/\/$/, '') === String(p.url).replace(/\/$/, ''));
    if (!self) problems.push(p.url + ': no self-referencing hreflang');
    langs.forEach(l => { if (l !== 'x-default' && !/^[a-z]{2,3}(-[a-z0-9]{2,4})?$/i.test(l)) problems.push(p.url + ': invalid code ' + l); });
  });
  if (problems.length) F('Technical', 'Medium', 'hreflang annotations are incomplete', problems.slice(0, 6).join('; '), 'Incomplete hreflang sets are ignored by Google, so the wrong language version can rank in each country.', 'Every language version must list all versions including itself, plus an x-default.', [...new Set(problems.map(x => x.split(':')[0]))]);
  else works.push('hreflang annotations look complete on sampled pages');
}
const absCanon = (p) => { let c = String(p.canonical || ''); if (c.startsWith('/')) c = siteUrlOf(domain, c); return c.replace(/\/$/, '').toLowerCase().replace(/^https?:\/\/(www\.)?/, ''); };
const canonMismatch = P.filter(p => p.canonical && p.status === 200 && (p.kind === 'home' || p.kind === 'service') && absCanon(p) !== String(p.url).replace(/\/$/, '').toLowerCase().replace(/^https?:\/\/(www\.)?/, ''));
if (canonMismatch.length) F('Crawlability & Indexing', 'Info', 'Key pages canonicalise to a different URL', canonMismatch.map(p => p.url + ' → ' + p.canonical).slice(0, 5).join('; '), 'Fine if intentional, but these pages will not rank on their own URL.', 'Confirm each canonical is intended.', canonMismatch.map(p => p.url));

// ---------- Misc ----------
if (!home.lang) F('Technical', 'Low', 'No language declared on the page', '<html> has no lang attribute', 'Helps browsers and search engines pick the right language.', 'Add lang="en" (or the correct language) to the <html> tag.');
if (!P.some(p => p.speculation)) F('Performance', 'Low', 'No speculation rules for instant navigation', 'No <script type="speculationrules"> found', 'Prefetching likely next pages makes navigation feel instant.', 'Add conservative speculation rules for key pages (e.g. contact and top services).');

return [{
  json: {
    ...base,
    html_analysis: {
      sampled_pages: P.map(p => ({ url: p.url, kind: p.kind, status: p.status, schema_types: p.types })),
      findings, works, urls_to_check: urlsToCheck
    }
  }
}];