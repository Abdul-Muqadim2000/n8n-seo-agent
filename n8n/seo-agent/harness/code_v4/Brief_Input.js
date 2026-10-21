// Compact facts for the AI brief (one item per site): totals, movers, opportunities, tracked keywords, pages, traffic, trends, alerts, actions.
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
  const matchPage = (model, keyword, prefer) => {   // `prefer`: a URL that wins a tie (the page Search Console itself credits for the search)
    const prefKey = prefer ? bare(hostOf(prefer)) + pathOf(prefer).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase() : "";
    const isPref = (u) => !!prefKey && (bare(hostOf(u)) + pathOf(u).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase()) === prefKey;
    const want = matchTerms(keyword); if (!want.length) return null;
    const key = tokensOf(keyword).join(' ');
    const inv = pages(model).filter(p => !isGone(p));   // RV-1: a gone page answers nothing
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
  return { from, stored, siteUrl, apiTarget, name, nap, services, pages, facts, matchPage, withPages, toRow, pageRows, COLUMNS, isFresh, ageDays, FRESH_DAYS, MATCH_MIN,
    titleShare, titleGap, canonUrl, isListing, pageScore, pageStep, isGone, gonePages,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml, matchTerms } };
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
const r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
return $('Site Metrics').all().map(i => { const m0 = i.json;
  // RV-1 (2026-10-21): the pages that no longer answer never reach the brief as pages to work on (the brief made "make this 404 page the
  // single page for the search" its priority 1); they reach it once, as the redirects to make
  const goneSet = new Set((m0.gone_pages || []).map(r => GONE.keyOf(r.from_url)));
  const live = (list, pick) => GONE.drop(list, goneSet, pick).kept;
  const m = goneSet.size ? { ...m0, gsc: { ...m0.gsc, top_pages: live(m0.gsc.top_pages || [], x => x.page), striking: live(m0.gsc.striking || [], x => x.page), ctr_gaps: live(m0.gsc.ctr_gaps || [], x => x.page),
      decaying_pages: live(m0.gsc.decaying_pages || [], x => x.page), not_decay: live(m0.gsc.not_decay || [], x => x.page), rising_pages: live(m0.gsc.rising_pages || [], x => x.page) } } : m0;
  const G = m.gsc, A = m.ga4;
  const W = m.site || {};
  const facts = { website: { canonical_host: W.canonical_host || m.domain, home_url: W.home_url || SM.siteUrl({ canonical_host: W.canonical_host, domain: m.domain }, '/'), business_name: W.business_name || m.domain, services: W.services || [], city: (W.nap || {}).city || '', pages_known: W.pages_known || 0, note: 'Call the business by this name and write every URL on the canonical host. pages_known is how many pages of this site the agent knows: never tell the owner to publish a new page for a search a page in the list already answers \u2014 say to refresh that page.' },
    // RV-1 / RV-15: the redirects to make come first, and the brief never asks for a redirect the server already makes
    ...(goneSet.size ? { pages_that_no_longer_answer: (m.gone_pages || []).slice(0, 15).map(r => r.from_url + ' (HTTP ' + (r.status || 404) + ', ' + r.impressions + ' impressions in 28 days) -> redirect to ' + r.to_url + ' (' + r.match + ')'),
      pages_that_no_longer_answer_note: 'These addresses answer 404 and Google still shows them. The only action for them is the permanent (301) redirect listed: never tell the owner to improve, link to, consolidate on, watch or refresh any of them.' } : {}),
    host_note: 'The site uses ' + (W.canonical_host || m.domain) + ' as its address. Search Console rows under both host forms do not mean a redirect is missing: never tell the owner to add a redirect between the two host forms unless computed_actions holds a host_split action.',
    domain: m.domain, period: m.period.current, previous_period: m.period.previous, weeks_tracked: m.weeks_tracked,
    search_console: G.connected ? { totals: G.totals, deltas: G.deltas, queries_with_impressions: G.query_count, pages_with_impressions: G.page_count ?? null,
      // G9 (2026-10-12): every query row was read, not a sample; the queries Google withholds, and brand vs non-brand
      queries_google_does_not_name: G.anonymised ? { clicks: G.anonymised.current.clicks, impressions: G.anonymised.current.impressions, share_of_impressions_pct: G.anonymised.current.impressions_pct, note: G.anonymised.current.note } : null,
      brand_vs_non_brand: G.brand_split ? { brand_names: G.brand_split.names, brand: { queries: G.brand_split.brand.queries, clicks: G.brand_split.brand.clicks, impressions: G.brand_split.brand.impressions }, non_brand: { queries: G.brand_split.non_brand.queries, clicks: G.brand_split.non_brand.clicks, impressions: G.brand_split.non_brand.impressions }, previous_non_brand_clicks: G.brand_split.previous.non_brand.clicks, note: G.brand_split.note } : null,
      tool_and_scraper_queries: G.scraper_queries || null, rows_read: G.rows_read ?? null, ...(((G.truncated || []).length) ? { rows_truncated: G.truncated } : {}), winners: G.winners.slice(0, 5), losers: G.losers.slice(0, 5), new_queries: G.new_queries.slice(0, 5), lost_queries: G.lost_queries.slice(0, 5),
      striking_distance: G.striking.slice(0, 8).map(q => ({ query: q.query, position: r1(q.position), impressions: q.impressions, clicks: q.clicks, page: q.page })), ctr_gaps: G.ctr_gaps.slice(0, 5).map(q => ({ query: q.query, position: r1(q.position), impressions: q.impressions, ctr: r1(q.ctr * 1000) / 10, expected_ctr: Math.round(q.expected_ctr * 100), page: q.page })),
      // B4-1: the brief gets the decay judgement with its basis, and the pages the evidence refused to call decay, so the
      // writer cannot turn a seasonal dip into "your traffic is falling".
      top_pages: G.top_pages.slice(0, 8), decaying_pages: G.decaying_pages.slice(0, 5), decay_not_claimed: (G.not_decay || []).slice(0, 3), decay_check: G.decay_summary || null, rising_pages: G.rising_pages.slice(0, 5) } : { connected: false, error: G.error },
    analytics: A.connected ? { organic: A.organic, all_channels: A.total, organic_share_pct: A.organic_share, channels: A.channels.slice(0, 6), organic_landing_pages: A.landing.slice(0, 8) } : { connected: false, error: A.error },
    tracked_keywords: m.tracked.map(t => ({ keyword: t.keyword, source: t.source + (t.rung ? ' rung ' + t.rung : ''), search_console_position: G.connected ? (t.gsc_position ? r1(t.gsc_position) : 'no impressions in the period') : 'Search Console not connected', previous_position: G.connected && t.gsc_prev_position ? r1(t.gsc_prev_position) : null, impressions: G.connected ? t.impressions : null, clicks: G.connected ? t.clicks : null,
      live_google_position: t.serp_position == null ? 'not checked' : t.serp_position > 0 ? t.serp_position : t.serp_position === 0 ? 'not in the top 50' : 'check failed', live_check_date: t.serp_checked_at ? String(t.serp_checked_at).slice(0, 10) : null, page: t.page || t.serp_url || null })),
    ladder_pages: m.ladder_pages.map(p => ({ url: p.url, keyword: p.keyword, rung: p.rung, status: p.status, live: !!(p.page_exists || p.status === 'published'), indexed: (p.page_exists || p.status === 'published') ? p.indexed : 'not live yet', coverage: p.coverage || p.inspect_error || '' })),
    // D21 (2026-10-12): a sparse series gets NO percentage in the facts — the AI quoted "up 1,200%" from a series that is zero most weeks
    trends: m.trends.map(t => { const thin = t.direction === 'sparse' || t.change_pct == null;
      return { keyword: t.keyword, direction: t.direction, ...(thin ? { change: 'too little search data for a percentage' } : { change_pct: t.change_pct }), peak: t.peak_date, rising_searches: (t.rising || []).slice(0, 5).map(r => r.query) }; }),
    pages_waiting_for_publish_link: (m.pending_publish || []).map(p => p.keyword + ' (' + p.days + ' days)'),
    // R111 (2026-10-16): the drafts whose last quality round failed — never to be called pages to publish (exec 634's brief told the owner
    // to "publish the three written pages", two of them refused by their own quality check). The reasons travel with them.
    ...((m.needs_fix || []).length ? { drafts_to_fix_not_publish: m.needs_fix.map(p => p.keyword + ' (did not pass the quality check: ' + ((p.reasons || []).slice(0, 2).join('; ') || 'see the page report').slice(0, 240) + ')'),
      drafts_note: 'These pages were written but did NOT pass the quality check. Never tell the owner to publish them: tell them to fix the listed points and run the page again.' } : {}),
    // C-7 (re-rating 2026-10-17): drafts a live page of the site makes unnecessary - the Rank Tracker tells the owner to refresh that page
    ...((m.drafts_retired || []).length ? { drafts_not_needed: m.drafts_retired.map(d => d.keyword + ' -> refresh ' + d.live_url + ' instead'),
      drafts_not_needed_note: 'A live page of the site already answers each of these searches. Never tell the owner to fix or publish these drafts: tell them to refresh the live page named.' } : {}),
    ...((m.detected_published || []).length ? { pages_found_live_this_week: m.detected_published.map(f => f.keyword + ' -> ' + f.url + ' (tracking started)') } : {}),   // v4.8 publish detection
    search_console_notices: ((m.console || {}).notices || []).map(x => x.severity + ': ' + x.kind + ' — ' + x.subject + ' (' + String(x.received_at).slice(0, 10) + ')'),
    monthly_checkin: (m.console || {}).last_checkin ? { month: m.console.last_checkin.month, manual_action: m.console.last_checkin.manual_action, security_issue: m.console.last_checkin.security_issue, pages_not_indexed_sitewide: m.console.last_checkin.not_indexed_total >= 0 ? m.console.last_checkin.not_indexed_total : null, top_reasons: ((m.console.last_checkin.coverage || {}).reasons || []).slice(0, 3) } : (m.console && m.console.checkin_due ? 'due (not submitted this month)' : null),
    growth_monitors: (() => { const L = (nm) => { try { return $(nm).all().map(x => x.json).filter(r => r && r.site_id === m.site_id && !r.error).sort((x, y) => String(y.checked_at || y.audited_at).localeCompare(String(x.checked_at || x.audited_at)))[0] || null; } catch (e) { return null; } }; const av = L('Load AI Visibility (Site)'), bl = L('Load Backlink Snapshots (Site)'), au = L('Load Audits (Site)');
      return { ai_answers: av ? { mention_rate_pct: Number(av.mention_rate), citation_rate_pct: Number(av.citation_rate), share_of_voice_pct: Number(av.share_of_voice), alerts: av.alerts || '' } : 'not measured yet', backlinks: bl ? { referring_domains: Number(bl.referring_domains), new: Number(bl.new_links), lost: Number(bl.lost_links), important_lost: Number(bl.important_lost), spam_score: Number(bl.spam_score) } : 'not measured yet', technical: au ? { health: Number(au.health_score), critical: Number(au.critical), high: Number(au.high), audited: String(au.audited_at).slice(0, 10) } : 'not audited yet' }; })(),
    // G28: the significance of each traffic change — an alert worded "Watch:" is inside sampling noise and must never be called a fall
    traffic_significance: m.significance ? Object.entries(m.significance).filter(([, v]) => v).map(([k, v]) => ({ metric: k, current: v.cur, previous: v.prev, change_pct: v.pct, confidence_range_pct: v.ci, statistically_real: !!v.real, only_watch: !!v.watch })) : [],
    google_updates_in_period: ST.updatesIn(m.period.current).map(u => u.name + ' (' + u.start + ' to ' + u.end + ')'),
    alerts: m.alerts.map(a => a.level + ': ' + a.text), computed_actions: m.actions.map(a => ({ priority: a.priority, type: a.type || "", action: a.action, why: a.why })) };
  return { json: { site_id: m.site_id, domain: m.domain, facts: JSON.stringify(facts) } }; });
