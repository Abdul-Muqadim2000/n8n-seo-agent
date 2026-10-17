// Content cadence: picks this week's blog topics per site (pages per week from seo_cadence, max 3), in this order: the keyword ladders' next
// planned pages (with each ladder's internal links), REFRESHES of pages the Site Tracker proved are losing traffic (v4.16 / B4-3, ranked by
// the clicks actually lost), striking-distance queries from Search Console (positions 4-20 with impressions:
// strengthen the page that already ranks), rising related searches from Google Trends. Skips keywords written in the last 90 days, pages already
// written or published, brand queries, and paused sites. Each pick becomes a content run (mode keyword, force_content) that delivers the blog package.
// v4.8 (Pipeline phase 2, PIPELINE_FEATURE_SPEC §6-7) — per ladder from seo_ladder_settings (no row = the site's default mode, else auto; active;
// priority by start date), per site from its '_site' row (defaults: opportunities auto, max_active 2, max_waiting 3):
//   * only Auto ladders with status active / queued are written; the max_active highest-priority ones that still have planned pages are active,
//     the others wait (queued_ladders). Ladder 1's eligible pages come before ladder 2's; inside a ladder by rung, then page_no; plan_type
//     'direct' writes the main page (rung 4) first.
//   * main-page gate (not direct): the main page waits until half of the ladder's supporting pages are published (ladder row 'published' or a
//     content-log row with a published_url), or the main keyword's latest rank check is 1-30 (waiting_for_support lists ladders where that
//     main page is all that is left to write).
//   * won: the main keyword in the top 3 in each of the last 4 rank checks (failed checks skipped) -> no more pages (won_ladders).
//   * pile-up guard (v4.14, FIX_PLAN D5): max_waiting or more distinct keywords written but not published -> nothing is written for the
//     site (paused_reason 'pileup'; waiting_keywords names them); an on-demand run may bypass it only with force: true. A keyword waits
//     when a content-log row of the last 120 days says `written` (R1: `started` is a run that never finished), or a ladder row is still 'writing',
//     its keyword has a `written` content-log row and no
//     published page (ladder pages reach the content log only from v4.14 on).
//   * opportunity posts (striking / trend) only when opportunities is auto; when manual they are listed as suggestions.
//   * Manual ladders are never written: each one's next eligible page is listed in awaiting_approval.
// Sites without a pick but with something to say (paused, awaiting approval, suggestions, a main page waiting for support) get one report_only item (nothing_to_do: true) for the
// Cadence Status note; dry_run only plans.
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
  return { from, stored, siteUrl, apiTarget, name, nap, services, pages, facts, matchPage, withPages, toRow, pageRows, COLUMNS, isFresh, ageDays, FRESH_DAYS, MATCH_MIN,
    titleShare, titleGap, canonUrl, isListing, pageScore,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml, matchTerms } };
})();
// ---- the pages written and not yet published, and the ladders being written: ONE rule for the Content Cadence and the ladder mode ----
// F-A1 / A-12 (2026-10-17, re-rating exec 770): the ladder mode counted the site's waiting pages its own way (published keywords left
// out, ladder rows ignored) and then wrote a sixth waiting page and started a seventh active ladder while the Content Cadence - the
// owner of both limits (`_site.max_waiting`, `_site.max_active` in seo_ladder_settings) - would have written nothing. Both now ask this
// kit, inlined by the build into *Cadence Plan* (Content Cadence) and *Ladder Plan* (main workflow); the web app mirrors the same rule in
// app/server/src/services/cadence.ts (pile-up) and ladders.ts (focus).
//   waiting(): the Content Cadence's pile-up count, unchanged in meaning (FIX_PLAN D5, R1, R111): a keyword waits when a content-log row
//   of the last `days` says `written` or `not_ready`, or when a ladder row says its page was written (A-20: `writing`, `written` or
//   `not_ready`) and the content log proves it with such a row and no published page. Each keyword counts once; a failed draft
//   (`not_ready`) is labelled `needs_fix`.
//   focus(): which Auto ladders the cadence writes now. The `max_active` highest-priority Auto ladders (status active / queued, main
//   keyword not set aside) that still have a planned page to write are active; the rest wait as Queued. `won` is not judged here (no
//   rank history is read by the ladder mode) - a won ladder with a planned page left is counted, and the result says so in `basis`.
const WAITING = (() => {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const lc = (v) => String(v == null ? '' : v).toLowerCase().trim();
  const WAITS = new Set(['written', 'not_ready']);
  const LADDER_WRITTEN = new Set(['writing', 'written', 'not_ready']);   // A-20: a ladder row whose page run has started or finished
  const STATUSES = ['active', 'queued', 'paused', 'won', 'stuck', 'archived'];
  const posInt = (v, d, max) => { const n = Number(v); return (v !== '' && v != null && Number.isFinite(n) && n >= 1) ? Math.min(max, Math.floor(n)) : d; };
  const waiting = (o) => {
    const x = o || {}; const now = Number(x.now) || Date.now(); const days = Number(x.days) || 120;
    const log = (x.log || []).filter(r => r && typeof r === 'object'); const ladders = (x.ladders || []).filter(r => r && typeof r === 'object');
    const fresh = (t) => { const v = Date.parse(String(t || '')); return Number.isFinite(v) && (now - v) < days * 864e5; };
    const publishedKw = new Set(log.filter(l => String(l.published_url || '').trim()).map(l => norm(l.keyword)));
    const writtenOf = (k) => log.filter(r => norm(r.keyword) === k && (WAITS.has(r.status) || r.status === 'published' || String(r.published_url || '').trim()))
      .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0] || null;
    const fixOf = (l) => l && l.status === 'not_ready' ? { needs_fix: true, reasons: String(l.qa_reasons || '').split(/;\s+/).filter(Boolean).slice(0, 3) } : {};
    const map = new Map();
    for (const l of log) { if (!WAITS.has(l.status) || !fresh(l.started_at)) continue; const k = norm(l.keyword); if (!k || map.has(k)) continue;
      map.set(k, { keyword: l.keyword, written_at: String(l.started_at || ''), source: String(l.source || ''), ...fixOf(l) }); }
    for (const l of ladders) { if (!LADDER_WRITTEN.has(l.status)) continue; const k = norm(l.keyword); if (!k || map.has(k) || publishedKw.has(k)) continue;
      const lg = writtenOf(k); if (!lg) continue;   // R1: no written log row = the page was never written
      const at = String(lg.started_at || l.start_date || ''); if (!fresh(at)) continue;
      map.set(k, { keyword: l.keyword, written_at: at, source: 'ladder', ...fixOf(lg) }); }
    const list = [...map.values()].sort((a, b) => String(a.written_at).localeCompare(String(b.written_at)));
    return { list, keys: new Set(map.keys()), count: list.length, needs_fix: list.filter(w => w.needs_fix).length };
  };
  // o: { ladders (seo_ladders rows of the site), settings (seo_ladder_settings rows of the site, '_site' included), log, exclude (ladder id),
  //      recent_days } -> { max_active, active: [...], queued: [...], order: [...] } ; each entry { ladder_id, head, priority, mode, open }
  const focus = (o) => {
    const x = o || {}; const now = Number(x.now) || Date.now();
    const settings = (x.settings || []).filter(r => r && r.ladder_id);
    const siteRow = settings.find(r => String(r.ladder_id) === '_site') || {};
    const siteMode = lc(siteRow.mode) === 'manual' ? 'manual' : 'auto';
    const max_active = posInt(siteRow.max_active, 2, 20);
    const settingOf = new Map(settings.filter(r => String(r.ladder_id) !== '_site').map(r => [String(r.ladder_id), r]));
    const recentDays = Number(x.recent_days) || 90;
    const recent = new Set((x.log || []).filter(l => l && (l.status === 'published' || (now - Date.parse(String(l.started_at || 0))) < recentDays * 864e5)).map(l => norm(l.keyword)));
    for (const l of (x.ladders || [])) if (l && (LADDER_WRITTEN.has(l.status) || l.status === 'published')) recent.add(norm(l.keyword));
    const groups = new Map();
    for (const r of (x.ladders || [])) { if (!r || !r.ladder_id || String(r.ladder_id) === String(x.exclude || '')) continue; const id = String(r.ladder_id); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(r); }
    const all = [...groups.entries()].map(([id, rows]) => {
      const st = settingOf.get(id) || null; const top = rows.find(r => Number(r.rung) === 4) || null;
      const mode = st && ['auto', 'manual'].includes(lc(st.mode)) ? lc(st.mode) : siteMode;
      const status = st && STATUSES.includes(lc(st.status)) ? lc(st.status) : 'active';
      const priority = st && Number(st.priority) >= 1 ? Number(st.priority) : Infinity;
      const start = rows.map(r => String(r.start_date || '')).filter(Boolean).sort()[0] || String((st && st.created_at) || '');
      const head_aside = !!top && String(top.status || '') === 'set_aside';
      const open = head_aside ? 0 : rows.filter(r => String(r.status || 'planned') === 'planned' && !recent.has(norm(r.keyword))).length;
      return { ladder_id: id, head: String((top && top.keyword) || rows[0].head_keyword || ''), mode, status, priority, start, open, head_aside };
    }).sort((a, b) => a.priority - b.priority || String(a.start).localeCompare(String(b.start)) || a.ladder_id.localeCompare(b.ladder_id));
    const auto = all.filter(l => l.mode === 'auto' && ['active', 'queued'].includes(l.status) && l.open > 0);
    return { max_active, site_mode: siteMode, order: auto, active: auto.slice(0, max_active), queued: auto.slice(max_active), all,
      basis: 'the Content Cadence\'s rule: Auto ladders with status active or queued that still have a planned page, in priority order; a ladder that has already won its main keyword is not told apart here (no rank history is read on this run)' };
  };
  return { waiting, focus, norm, LADDER_WRITTEN, WAITS };
})();
// R16 (2026-10-13, FIX_PLAN §3.11): the fit gate also reads the rows that were STORED before it existed, so a competitor's brand or a
// government portal planned as a rung is set aside here instead of being written (`set_aside`, with the reason; the Ladder Marks node
// writes `status: set_aside` back on the row, so the app and the next run see the same thing).
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
const FIT_GENERIC = new Set(['ai', 'software', 'softwares', 'services', 'service', 'erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'tax', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll', 'finance', 'financial', 'cloud', 'digital', 'online', 'web', 'data', 'tech', 'technology', 'technologies', 'solutions', 'solution', 'systems', 'system', 'business', 'company', 'group', 'global', 'international', 'gulf', 'arab', 'arabia', 'emirates', 'national', 'consulting', 'consultants', 'consultancy', 'partners', 'partner', 'network', 'news', 'blog', 'guide', 'guides', 'info', 'best', 'top', 'free', 'app', 'apps', 'shop', 'store', 'market', 'media', 'academy', 'institute', 'university', 'school', 'bank', 'pay', 'pro', 'plus', 'hub', 'one', 'first', 'smart', 'easy', 'get', 'go', 'ae', 'com', 'net', 'org', 'home', 'house', 'world', 'city', 'daily', 'times', 'post', 'review', 'reviews', 'compare', 'comparison', 'list', 'directory', 'jobs', 'careers', 'businesses', 'companies', 'firms', 'wiki', 'wikipedia', 'youtube', 'linkedin', 'facebook', 'instagram', 'twitter', 'reddit', 'quora', 'medium', 'google', 'microsoft', 'amazon', 'apple']);
const FIT_GOV_WORDS = /\b(ministry|ministries|authority|authorities|federal|government|govt|municipality|municipal|embassy|consulate|police|courts?|customs|immigration|department of|public prosecution|parliament|chamber of commerce|free zone authority)\b/;
const FIT_GOV_NAMES = /\b(fta|emaratax|emara ?tax|tax authority|mohre|mohap|mofa|moec|gdrfa|icp|ica|rta|dewa|sewa|fewa|addc|aadc|dha|doh|ded|tdra|adjd|ejari|dubai land department|dld|dubai economy|dubai courts|zatca|gazt|gosi|qiwa|absher|muqeem|mudad|hrsd|misa|nafath|tawtheeq|uae pass|smart pass|amer cent(er|re)|tasheel|tawjeeh|emirates id|emirates identity|national id|i ?d card|identity card|labou?r card|work permit status|visa status|visa check|passport status|establishment card|golden visa status|trn verification|trn check|trn lookup|tax registration number check)\b/;
const FIT_PORTAL = /\b(log ?in|logins|sign ?in|sign ?up|password|passwords|portal|portals|e ?services?|customer care|customer service number|helpline|toll ?free|contact number|phone number|status|status check|check status|status enquiry|application status|track(ing)? (status|application|order)|renewal|renew|verification|verify|apply online|online application|download (the )?app|app download|complaint|complaints|fine check|traffic fines?|balance check|otp)\b/;
// content / buying words that turn a portal or government query into a topic ("best erp software with mobile login", "emaratax registration guide");
// plain category nouns (software, system, services …) do not — "erp software login" is still a login
const FIT_CONTENT = /\b(best|top|vs|versus|compar(e|ison)|review|reviews|alternatives?|how to|guide|guides|checklist|requirements?|pricing|price|prices|cost|costs|quote|quotes|hire|consultan(t|ts|cy|cies)|consulting|partner|partners|provider|providers|vendor|vendors|agency|agencies|accredited|approved|certified|compliant|compliance|implementation|integration|integrations|training|course|courses|template|templates|examples?|explained|meaning|benefits|registration|register|filing|return|returns|refund|refunds|deadline|deadlines|penalt(y|ies)|rules?|regulations?|free trial|demo|tutorial|steps|process|procedure)\b/;
const FIT_PARTNER = /\b(partner|partners|partnership|reseller|resellers|implementation|implement|implementer|implementers|consultan(t|ts|cy|cies)|consulting|integration|integrations|integrate|migration|migrate|support|training|developer|developers|development|customi[sz]ation|customi[sz]e|add-?ons?|plugins?|specialist|specialists|expert|experts|agency|agencies|services?)\b/;
// R60: the words of a public body's own service to a person (with FIT_GOV_NAMES only): nothing a business sells is left once they are taken out
const FIT_GOV_SERVICE = /^(attestation|attestations|attest|attested|legali[sz]ation|legali[sz]e|apostille|notari[sz]ation|passport|passports|visa|visas|residency|iqama|renewal|renew|renewing|fines?|penalty|appointment|appointments|booking|stamp|stamping|medical|fitness|typing|cancellation|cancel|replacement|lost|reprint|fees?|charges?|timings?|working|hours|office|offices|centre|center|centres|centers|near|location|locations|track|tracking|apply|application|form|forms|download|print|copy|expiry|expired|validity|valid|enquiry|inquiry|document|documents|certificate|certificates|degree|degrees|diploma|marriage|birth|educational|personal)$/;
// B-3 (2026-10-17, re-rating 2026-10-17, exec 767): the same refusal WITHOUT a body's name. "mofa attestation dubai" was refused but "uae document
// attestation" and "mofa document attestation" were offered as keyword-gap targets under a High finding: attesting, legalising or notarising a
// person's document is a public service whatever words surround it. A keyword whose own words are such a service word plus document / service
// words is refused as 'government'; "attestation software" or "document attestation management system" keep a product word and stay.
const FIT_DOC_SERVICE = /^(attestation|attestations|attest|attested|attesting|apostille|legali[sz]ation|legali[sz]e|notari[sz]ation|notari[sz]e|notary)$/;
// B-3: a person looking for work is not a buyer ("finance jobs in uae", "finance manager jobs in uae" were offered as easy wins). A job word with no
// product word ("recruitment software", "hr jobs portal system") is refused as 'job search'.
const FIT_JOBS = /\b(jobs?|careers?|vacanc(y|ies)|salary|salaries|internships?|walk ?in interviews?|job openings?|cv|resume)\b/;
const FIT_PRODUCT = /\b(software|system|systems|platform|platforms|tool|tools|app|apps|module|modules|solution|solutions|crm|erp|hrms|hcm|ats|portal software)\b/;
// B-3: words common enough in English that, lifted out of a longer service NAME, they say nothing about the topic: "intelligent" out of
// "Intelligent Document Processing" let "intelligent software solutions" (another company's name) through; "management" out of "Supply Chain
// Management" let "top facilities management companies uae" through; "commerce" out of "Dynamics 365 Commerce" let "commercial companies law
// uae" through. Such a word counts as on topic only when the keyword carries the whole name, or at least two of its words (fitTopic).
const FIT_COMMON = new Set(['management', 'manager', 'document', 'documents', 'processing', 'process', 'processes', 'intelligent', 'intelligence', 'central', 'operations', 'operation', 'operational',
  'project', 'projects', 'field', 'customer', 'customers', 'client', 'clients', 'sales', 'human', 'resources', 'resource', 'commerce', 'commercial', 'supply', 'chain', 'identity', 'model', 'models',
  'predictive', 'virtual', 'desktop', 'studio', 'builder', 'factory', 'pipeline', 'pipelines', 'modernization', 'modernisation', 'enterprise', 'enterprises', 'advanced', 'modern', 'integrated',
  'unified', 'professional', 'premium', 'standard', 'basic', 'core', 'general', 'public', 'private', 'social', 'mobile', 'facility', 'facilities', 'experience', 'insights', 'transformation',
  'innovation', 'value', 'impact', 'productivity', 'efficiency', 'assets', 'asset', 'people', 'team', 'teams', 'growth', 'performance']);
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
// B-3: category words too wide to stand for what a site sells on their own: "dubai business tax" and "uae businesses" were judged "a category you
// sell (business) in your market" because the site's services name "Dynamics 365 Business Central". They never count for a head term.
const FIT_WIDE = new Set(['business', 'businesses', 'company', 'companies', 'firms', 'finance', 'financial', 'tax', 'data', 'digital', 'online', 'web', 'technology', 'technologies', 'tech',
  'solutions', 'solution', 'services', 'service', 'systems', 'system', 'global', 'group', 'national', 'international', 'best', 'top', 'free', 'news', 'jobs', 'careers', 'smart', 'consulting',
  'consultants', 'consultancy', 'partners', 'partner', 'network', 'info', 'guide', 'guides', 'blog', 'list', 'directory', 'review', 'reviews', 'compare', 'comparison', 'pro', 'plus', 'one', 'first',
  'get', 'go', 'easy', 'home', 'world', 'city', 'market', 'media', 'shop', 'store', 'gulf', 'arab', 'arabia', 'emirates', 'google', 'microsoft', 'amazon', 'apple']);
const fitStem = (w) => w.length > 5 ? w.replace(/(ingly|ings|ing|ments|ment|ations|ation|ions|ion|ies|ers|er|ed|es|s|e)$/, '') : w;   // the outreach kit's stem: invoice / invoices / invoicing -> invoic
const fitTopicWords = (topics) => new Set((Array.isArray(topics) ? topics.filter(Boolean).join(' ') : String(topics || '')).toLowerCase()
  .split(/[^a-z0-9]+/).filter(t => t.length > 2 && !FIT_STOP.has(t) && !FIT_GEO.has(t)).map(fitStem));
// B-3: the topics as PHRASES (one service name, one configured keyword, one description), so a common word can be judged against the name
// it came from. `dist` = the phrase's own distinctive words (stemmed); prose (more than 6 of them) never vouches for a common word.
const fitTopicPhrases = (topics) => (Array.isArray(topics) ? topics.filter(Boolean).map(String) : [String(topics || '')])
  .map(t => { const w = t.toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length > 2 && !FIT_STOP.has(x) && !FIT_GEO.has(x) && !/^\d+$/.test(x));
    return { dist: [...new Set(w.filter(x => !FIT_GENERIC.has(x)).map(fitStem))], words: [...new Set(w.map(fitStem))] }; })
  .filter(p => p.dist.length).map(p => ({ ...p, prose: p.dist.length > 6 }));
function fitTopic(keyword, topics, ctx) {
  const o = ctx || {};
  const bar = typeof o.topic_bar === 'number' ? o.topic_bar : FIT_TOPIC_BAR;
  const label = String(o.topic_label || 'what this website sells');
  const T = fitTopicWords(topics);
  const PH = fitTopicPhrases(topics);
  // With little on file the measure would refuse good keywords, so under topic_min_words (12) distinctive words it judges nothing: a site
  // whose services and description are a single line gets no topic refusals at all ("no evidence, no refusal").
  if (T.size < (typeof o.topic_min_words === 'number' ? o.topic_min_words : 12)) return { ok: true, reason: '', detail: T.size ? 'too few topic words on file (' + T.size + ') to judge topic distance' : 'no topics on file, so topic distance was not judged', share: null };
  const toks = fitTokens(keyword);
  const own = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t));
  const known = [...T];
  const stemHit = (s, x) => x === s || (x.length >= 5 && s.length >= 5 && (s.indexOf(x) === 0 || x.indexOf(s) === 0));
  const matches = (t) => { const s = fitStem(t); return T.has(s) || known.some(x => stemHit(s, x)); };
  // B-3: a common word (FIT_COMMON) is on topic only through a service NAME the keyword carries whole, or two words of (prose never vouches)
  // ("business central partner uae" carries two words of "Dynamics 365 Business Central"; "intelligent software solutions" one of "Intelligent Document Processing")
  const ownStems = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t)).map(fitStem);
  const allStems = toks.filter(t => t.length > 2 && !FIT_GEO.has(t)).map(fitStem);
  const viaName = (t) => { const s = fitStem(t); return PH.some(ph => !ph.prose && ph.dist.some(x => stemHit(s, x))
    && (ph.dist.every(x => ownStems.some(k => stemHit(k, x))) || ph.words.filter(x => allStems.some(k => stemHit(k, x))).length >= 2)); };
  const matchOwn = (t) => FIT_COMMON.has(t) ? viaName(t) : matches(t);
  // a keyword made only of category and place words is a head term: it is on topic when at least two of those categories are the site's own
  // ("erp software uae", "best erp software dubai"), and too broad when only one is and there is no market in it either ("ai", "google ai")
  if (!own.length) {
    const cats = toks.filter(t => FIT_GENERIC.has(t) && !FIT_WIDE.has(t)).filter(matches);   // B-3: a wide word never stands for a category
    const hasPlace = toks.some(t => FIT_GEO.has(t));
    if (cats.length >= 2 || (cats.length >= 1 && hasPlace)) return { ok: true, reason: '', detail: 'a category you sell (' + cats.join(', ') + ')' + (hasPlace ? ' in your market' : ''), share: 1 };
    return { ok: false, reason: 'too broad', detail: 'only category or place words, so it says nothing about ' + label + ' ("' + String(keyword || '').trim() + '")', share: cats.length ? 0.5 : 0 };
  }
  const hits = own.filter(matchOwn);
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
  // B-3 (2026-10-17): what the site's own topics say it sells (empty when none are on file), for the two rules below
  const topicT = (ctx.topics && (Array.isArray(ctx.topics) ? ctx.topics.length : String(ctx.topics).trim())) ? fitTopicWords(ctx.topics) : null;
  const sells = (re) => !!topicT && [...topicT].some(w => re.test(w));
  // 3b. a document service a public body provides to a person, without the body's name ("uae document attestation"): refused unless the
  //     site's own topics say it sells that service (an attestation agency keeps it)
  const docSvc = toks.filter(t => FIT_DOC_SERVICE.test(t));
  if (docSvc.length && !sells(/^(attest|apostill|legali|notar)/)) {
    const restD = toks.filter(t => !FIT_GEO.has(t) && !FIT_DOC_SERVICE.test(t) && !FIT_GOV_SERVICE.test(t) && !FIT_GOV_NAMES.test(' ' + t + ' ')
      && !/^(online|services?|centre|center|centres|centers|near|price|prices|cost|costs|company|companies|agency|agencies|best|top|cheap|fast|same|day|requirements?|procedure|process|steps)$/.test(t));
    if (!restD.length) return { ok: false, reason: 'government', detail: 'a document service public bodies (a ministry, an embassy, a notary) provide to a person (' + docSvc.join(' ') + '), not a topic for this website' };
  }
  // 4. a login / portal / status task
  if (portalWord && !contentWord) return { ok: false, reason: 'portal', detail: 'a login, portal, status or application task: people want the owner\'s own site' };
  // 4b. a person looking for work (B-3): no product word in it, and the site's topics are not recruitment
  if (has(FIT_JOBS) && !has(FIT_PRODUCT) && !sells(/^(recruit|staff|hiring|job|career|headhunt|talent)/)) return { ok: false, reason: 'job search', detail: 'people looking for work, not buyers of what this website sells' };
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
  return st === 'writing' || st === 'written' || st === 'not_ready' || st === 'published' || r.page_exists === true || r.page_exists === 'true' || !!String(r.published_url || '').trim(); };
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
    if (!a || !a.ok) return { unavailable: true, top: [], above: [], own: [], competitors: comps.map(domain => ({ domain, position: null, tracked: true })), tracked: comps };
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
    // B6-6 (2026-10-16, benchmark area 6): EVERY result of ours over the whole depth bought, not only the best one. `top` keeps one row
    // per domain (the best position it holds), so a second page of the site on the same results page was thrown away before it was
    // stored, and cannibalisation (two of our own URLs answering one search) could never be seen in the snapshot we keep.
    const own = organic.filter(o => isOurs(o.domain, our)).sort((x, y) => x.position - y.position).map(o => ({ position: o.position, url: o.url }))
      .filter((o, i, arr) => arr.findIndex(x => urlKey(x.url) === urlKey(o.url)) === i);
    return { unavailable: false, top, above, own, competitors, tracked: comps };
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
    top: ((land && land.top) || []).map(t => ({ p: t.position, u: S(t.url).slice(0, 180), t: S(t.title).slice(0, 80) })),
    // B6-6: how many of OUR pages the answer held (any depth), and, only when there are two or more, which ones. `own_n` missing = a
    // reading stored before this was kept, which can say nothing about a second page either way.
    ...(land && !land.unavailable && Array.isArray(land.own) ? { own_n: land.own.length } : {}),
    ...(land && !land.unavailable && Array.isArray(land.own) && land.own.length >= 2 ? { own: land.own.slice(0, 3).map(o => ({ p: o.position, u: S(o.url).slice(0, 140) })) } : {}) });

  // a JSON string that stays small: titles go first, then the tail of the list (a snapshot is proof, not an archive)
  const pack = (obj, max) => {
    const limit = Number(max) || 1800;
    let s = JSON.stringify(obj || null);
    if (s.length <= limit) return s;
    const o = JSON.parse(s);
    if (Array.isArray(o.top)) { o.top = o.top.map(t => ({ p: t.p, u: t.u })); o.trimmed = 'titles'; }
    s = JSON.stringify(o);
    if (s.length > limit && Array.isArray(o.own) && o.own.length > 2) { o.own = o.own.slice(0, 2); o.trimmed = (o.trimmed ? o.trimmed + '+' : '') + 'own'; s = JSON.stringify(o); }   // B6-6: two pages are enough to show cannibalisation
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
    depth: 0, changed: null, changed_pct: null, entered: null, gone: null, moved: null, mean_move: null, mean_move_others: null, depth_others: 0, changed_others: null, changed_others_pct: null, band_others: null, band: null,
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
    // B6-8: the page WITHOUT us. Our own fall of five places inside the top ten shifts five other results by one place each, so `changed`
    // above counts our move as the page's churn (six of ten places, "high", every time). With `o.own` the other results are re-ranked
    // among themselves in both readings and compared: how many of their places changed, and how far they moved relative to each other.
    const ownD = bare(c.own || '');
    const notOurs = (e) => !(ownD && isOurs(bare(e.k.split('/')[0]), ownD));
    const aO = a.filter(notOurs).map((e, i) => ({ k: e.k, p: i + 1 })), bO = b.filter(notOurs).map((e, i) => ({ k: e.k, p: i + 1 }));
    const depthO = Math.min(aO.length, bO.length);
    const aOPos = new Map(aO.map(e => [e.k, e.p]));
    let changedO = 0; for (let p = 1; p <= depthO; p++) if (aO[p - 1].k !== bO[p - 1].k) changedO++;
    const movesO = bO.filter(e => aOPos.has(e.k)).map(e => Math.abs(e.p - aOPos.get(e.k)));
    const changedOPct = depthO ? Math.round(changedO / depthO * 100) : null;
    const changed_pct = Math.round(changed / depth * 100);
    return { available: true, reason: '', basis: 'measured', measured: true, depth,
      changed, changed_pct, entered, gone, moved: moves.filter(m => m > 0).length,
      mean_move: moves.length ? r1(moves.reduce((s, x) => s + x, 0) / moves.length) : 0,
      mean_move_others: movesO.length ? r1(movesO.reduce((s, x) => s + x, 0) / movesO.length) : 0,
      depth_others: depthO, changed_others: changedO, changed_others_pct: changedOPct,
      band_others: changedOPct == null ? null : changedOPct >= c.high_pct ? 'high' : changedOPct >= c.still_pct ? 'some' : 'still',
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
  // ---- B6-8 (2026-10-16, benchmark area 6): A MOVE IS THE SITE'S OWN ONLY WHEN IT BEATS THE PAGE'S OWN CHURN ----
  // Since v4.2 a move of five places was "a drop" whatever the results page around it did; B6-2 put the measurement beside it, and the
  // label stayed the same. Now the label follows the measurement: the page's own move when the page around it held (fewer than half of
  // the top places changed occupant) AND the move is more than twice what the other pages present in both readings moved on average
  // (and more than two places); "the results page moving" when it did not; "one reading against one reading" when the page's change is
  // no larger than two readings of one moment show (R88); and "not compared", no verdict at all, when the earlier reading cannot be
  // compared. The size of a listed move stays five places. These are stated rules: no tool publishes a per-keyword threshold.
  const MOVE = { min_places: 5, others_factor: 2, others_floor: 2,
    rule: 'a move is called your page\'s own only when the other results on the page held (fewer than half of them changed place among themselves) and the move is more than twice the average move of the other pages present in both readings, and more than 2 places; a stated rule, not a measurement' };
  const moveKind = (delta, ch) => {
    if (delta == null || !Number(delta)) return null;
    const size = Math.abs(Number(delta)) >= 100 ? null : Math.abs(Number(delta));   // +-100 = came into / fell out of the depth checked
    const sizeText = size == null ? (Number(delta) > 0 ? 'came into the top 50' : 'fell out of the top 50') : 'moved ' + size + ' place' + (size === 1 ? '' : 's');
    if (!ch || !ch.available) return { kind: 'not_compared', own: false, text: 'not compared: ' + ((ch && ch.reason) || 'no earlier reading of the results page is stored') + ', so whether this is your page or the page around it is not said' };
    if (ch.band === 'noise') return { kind: 'within_noise', own: false, text: 'the results page changed no more than two readings of the same moment do (' + ch.changed + ' of the top ' + ch.depth + ' places), so this is one reading against one reading, not a move' };
    // the page without us decides (band_others, from churn's `own` option); a reading compared without it falls back to the whole page
    const band = ch.band_others || ch.band;
    const chg = ch.band_others ? ch.changed_others + ' of the other ' + ch.depth_others + ' results changed place' : ch.changed + ' of the top ' + ch.depth + ' places changed occupant';
    if (band === 'high') return { kind: 'with_page', own: false, text: 'the results page moving: ' + chg + ', so this is not necessarily about your page' };
    const others = ch.mean_move_others != null ? Number(ch.mean_move_others) : (Number(ch.mean_move) || 0);
    const ref = Math.max(MOVE.others_floor, MOVE.others_factor * others);
    if (size != null && size <= ref) return { kind: 'with_page', own: false, ref, text: 'the results page moving: your page ' + sizeText + ' and the other pages present in both readings moved ' + others + ' on average, so this move is no larger than the page\'s own churn' };
    return { kind: 'own', own: true, ref, text: 'your page\'s own move: it ' + sizeText + ' while ' + chg + ' and the other pages moved ' + others + ' place' + (others === 1 ? '' : 's') + ' on average' };
  };

  // ---- B6-6 (2026-10-16, benchmark area 6, criterion 2.10): TWO OF THE SITE'S OWN PAGES ON ONE RESULTS PAGE ----
  // Semrush has a cannibalisation tab. We had nothing, and the stored snapshot could not have shown it: it kept one URL per site. The
  // snapshot now keeps how many of our pages the answer held and which. Silent when there is one; "not checked" (never "none") for a
  // reading stored before the count was kept. "Preferred" = the page Google placed higher in THIS reading; if the previous reading ranked
  // a different page of ours, that is said too.
  const cannibal = (cur, o) => {
    const q = o || {}; const x = unpack(cur, null);
    if (!x || x.unavailable) return { checked: false, found: false, count: null, pages: [], reason: 'this check could not read the results page' };
    if (x.own_n == null) return { checked: false, found: false, count: null, pages: [], reason: 'this reading was stored before a second page of the site was kept' };
    const n = Number(x.own_n) || 0;
    const pages = (Array.isArray(x.own) ? x.own : []).map(e => ({ position: Number(e && e.p) || 0, url: S(e && e.u) })).filter(e => e.position > 0 && e.url).sort((a, b) => a.position - b.position);
    if (n < 2 || pages.length < 2) return { checked: true, found: false, count: n, pages: [] };
    const preferred = pages[0];
    const prevUrl = S(q.previous_url);
    const switched = !!prevUrl && urlKey(prevUrl) !== urlKey(preferred.url);
    const kw = S(q.keyword);
    const text = (n === 2 ? 'Two' : String(n)) + ' of your pages appear on the results page' + (kw ? ' for "' + kw + '"' : '') + ' (top ' + (Number(q.depth) || 50) + ' of this check): '
      + pages.map(p => p.url + ' at #' + p.position).join(' and ') + (n > pages.length ? ' (and ' + (n - pages.length) + ' more)' : '')
      + '. Google prefers ' + preferred.url + ' today: it is the higher of them in this reading.'
      + (switched ? ' In the previous reading' + (q.previous_at ? ' (' + S(q.previous_at).slice(0, 10) + ')' : '') + ' it ranked ' + prevUrl + ' instead, so Google is changing which of your pages it shows.' : '')
      + ' Pages that compete for one search split its signals: choose one page for it and make the other point to it (merge it, redirect it, or link to it with this search\'s words).';
    return { checked: true, found: true, count: n, pages, preferred, previous_url: prevUrl || null, switched, text, basis: 'observed: the URLs of this site in the stored reading of this check' };
  };

  // ---- B6-10 (2026-10-16, benchmark area 6, Ahrefs parity): WHO TOOK THE PLACE ----
  // Ahrefs warns when a target URL is outranked. Our report said the number fell; the two stored snapshots name everybody above us in both
  // readings, so the domains above the target now that were not above it then are named, with where they were. Refuses (with the
  // reason) when either reading cannot be read, when we were not ranking before, or when we were below the depth the previous reading kept.
  const outranked = (prev, cur, o) => {
    const q = o || {}; const our = bare(q.domain);
    const none = (reason) => ({ available: false, reason, domains: [], text: '' });
    const P = unpack(prev, null), C = unpack(cur, null);
    if (!C || C.unavailable || !Array.isArray(C.top) || !C.top.length) return none('this check could not read the results page');
    if (!P || P.unavailable || !Array.isArray(P.top) || !P.top.length) return none('no earlier stored reading of this results page to compare with');
    if (S(P.device || 'desktop') !== S(C.device || 'desktop')) return none('the two readings are of different devices');
    const pp = Number(q.previous_position), cp = Number(q.position);
    if (!(pp > 0)) return none(pp === 0 ? 'your page was not in the top 50 in the previous reading, so nobody moved above it' : 'the previous position could not be read');
    if (!Number.isFinite(cp) || cp < 0) return none('this check could not read your position');
    const rows = (s) => s.top.map(e => ({ p: Number(e && e.p) || 0, h: hostOf(S(e && e.u)) })).filter(e => e.p > 0 && e.h);
    const pDepth = Math.max(0, ...P.top.map(e => Number(e && e.p) || 0));
    if (pp > pDepth) return none('your page was at #' + pp + ' in the previous reading and that reading kept the top ' + pDepth + ' only, so who was above it then is not fully known');
    const bestP = new Map(); for (const e of rows(P)) if (!isOurs(e.h, our) && (!bestP.has(e.h) || e.p < bestP.get(e.h))) bestP.set(e.h, e.p);
    const domains = [];
    for (const e of rows(C).sort((a, b) => a.p - b.p)) {
      if (isOurs(e.h, our) || (cp > 0 && e.p >= cp) || domains.some(d => d.domain === e.h)) continue;
      const b = bestP.has(e.h) ? bestP.get(e.h) : null;
      if (b != null && b < pp) continue;   // it was above us then too
      domains.push({ domain: e.h, position: e.p, previous: b });
    }
    const target = S(q.target_url) || 'your page';
    const text = domains.length ? 'Outranked since the reading of ' + (S(q.previous_at).slice(0, 10) || 'the previous check') + ': '
      + domains.slice(0, 4).map(d => d.domain + ' (now #' + d.position + ', ' + (d.previous == null ? 'not in the top ' + pDepth + ' then' : 'was #' + d.previous + ', below your page then') + ')').join(', ')
      + (domains.length > 4 ? ' and ' + (domains.length - 4) + ' more' : '') + ' moved above ' + target + ' (#' + pp + ' then, ' + (cp > 0 ? '#' + cp : 'not in the top 50') + ' now).' : '';
    return { available: true, reason: '', domains, text, previous_position: pp, position: cp, target_url: S(q.target_url) || null, basis: 'measured: the two stored top-ten readings' };
  };

  // ---- B6-14 (2026-10-16, benchmark area 6, gap G6-6): ONE SHARE OF VOICE OVER MANY KEYWORDS, WEIGHTED BY WHAT THEY ARE WORTH TO THE SITE ----
  // The summary averaged the per-keyword shares unweighted, so 40% of a search nobody makes counted as much as 4% of the head term (Ahrefs
  // and AccuRanker weight by volume). The weight here is the site's OWN Search Console impressions per query (seo_query_history, the
  // newest stored 28-day period only: the table only grows), first-party and free. Impressions count only searches in which Google showed
  // the site, so a keyword it does not appear for yet weighs nothing; fewer than two keywords with impressions is not a weighting, and the
  // figure falls back to the unweighted mean, labelled so.
  const WEIGHT = { min_keywords: 2,
    basis: 'weighted by your own Search Console impressions for each keyword (the newest stored 28-day period); impressions count only searches in which Google showed your site, so a keyword you do not appear for yet weighs nothing' };
  const weightedVoice = (items, rows, o) => {
    const q = o || {}; const dom = bare(q.domain);
    const its = (items || []).filter(x => x && x.share_of_voice != null && Number.isFinite(Number(x.share_of_voice)));
    const unweighted = its.length ? r1(its.reduce((s, x) => s + Number(x.share_of_voice), 0) / its.length) : null;
    if (!its.length) return { value: null, unweighted: null, weight: 'none', keywords: 0, weighted_keywords: 0, period_end: null, note: 'no results page was read, so no share of voice can be modelled' };
    const mine = (rows || []).filter(r => r && !r.error && S(r.query) && (!dom || bare(r.domain) === dom));
    const period = mine.reduce((m, r) => S(r.period_end) > m ? S(r.period_end) : m, '');
    const imp = new Map();
    for (const r of mine.filter(r => S(r.period_end) === period).sort((a, b) => S(a.checked_at).localeCompare(S(b.checked_at)))) imp.set(kwKey(r.query), Math.max(0, Number(r.impressions) || 0));
    const w = its.map(x => ({ keyword: S(x.keyword), share_of_voice: Number(x.share_of_voice), impressions: imp.has(kwKey(x.keyword)) ? imp.get(kwKey(x.keyword)) : null }));
    const withW = w.filter(x => x.impressions > 0);
    const total = withW.reduce((s, x) => s + x.impressions, 0);
    const base = { unweighted, keywords: its.length, weighted_keywords: withW.length, period_end: period || null, per_keyword: w.slice(0, 30) };
    if (!mine.length) return { ...base, value: unweighted, weight: 'none', note: 'unweighted: no Search Console data is stored for this site, so every keyword counts the same' };
    if (withW.length < WEIGHT.min_keywords) return { ...base, value: unweighted, weight: 'none', note: 'unweighted: ' + (withW.length ? 'only one' : 'none') + ' of these ' + its.length + ' keywords had Search Console impressions in the 28 days to ' + period + ', too few to weight by, so every keyword counts the same' };
    const value = r1(withW.reduce((s, x) => s + x.share_of_voice * x.impressions, 0) / total);
    const left = its.length - withW.length;
    return { ...base, value, weight: 'impressions', impressions: total,
      note: 'weighted by your Search Console impressions: ' + total + ' impressions over ' + withW.length + ' of the ' + its.length + ' keywords, 28 days to ' + period
        + (left ? '; ' + left + (left === 1 ? ' keyword with no impressions weighs nothing' : ' keywords with no impressions weigh nothing') : '') + '; the unweighted average is ' + unweighted + '%' };
  };
  return { MOVE, moveKind, cannibal, outranked, WEIGHT, weightedVoice, CTR, SUM_CTR, METHOD, AIO_KEEP, AIO_SOURCE, keepAt, CHURN, read, features, typeList, ourRank, landscape, voice, snapshot, pack, unpack,
    featureLine, featureChips, churn, churnNone, churnText, moveNote, bare, hostOf, isOurs, listOf, weight, urlKey, serpHosts, prevReading, noise, withNoise };
})();
const CONFIG = { default_pages_per_week: 1, max_pages_per_week: 3, skip_recent_days: 90, striking_min_impressions: 30, striking_min_position: 4, striking_max_position: 20, publish_reminder_days: 7, upcoming: 4,
  max_active: 2, max_waiting: 3, waiting_days: 120, gate_head_position: 30, won_checks: 4, won_position: 3, suggestions: 5,
  // B4-3 (2026-10-15, benchmark area 4): at most this many refreshes of decaying pages offered in one week, and the days a page
  // is left alone after any refresh before it can be queued again (Semrush's own content-audit guide says to wait at least two
  // months before judging a refresh: https://www.semrush.com/blog/content-audit/)
  decay_per_week: 2, decay_refresh_days: 60 };
let trigger = {}; try { const t = $('Manual Run').first(); trigger = (t && t.json) || {}; } catch (e) {}
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const lc = (v) => String(v == null ? '' : v).toLowerCase().trim();
const sites = rowsOf('Load Sites').filter(r => r.site_id && r.domain), cad = rowsOf('Load Cadence').filter(r => r.site_id), ladders = rowsOf('Load Ladders').filter(r => r.ladder_id && r.keyword), qh = rowsOf('Load Query History'), trends = rowsOf('Load Trends'), logs = rowsOf('Load Content Log').filter(r => r.keyword);
const settings = rowsOf('Load Ladder Settings').filter(r => r.ladder_id);
// R16 (2026-10-13): the node loads the ranks of EVERY rung now (it was rung 4 only). The won / gate rules still read the main keyword's
// own rows (headRanks); every rung's rows carry the results page the Rank Tracker stored for that keyword, which the fit gate reads.
const allRanks = rowsOf('Load Main Keyword Ranks').filter(r => r.ladder_id && r.keyword);
const headRanks = allRanks.filter(r => Number(r.rung) === 4 || r.rung === '' || r.rung == null);
// 2026-10-12 (FIX_PLAN D11): the site's page inventory (seo_pages, filled weekly by the Site Tracker). A candidate whose search a live page
// already answers is not written as a new post: a ladder page becomes a refresh of that page, an opportunity post is dropped and named.
const pageRows = rowsOf('Load Pages (Cadence)').filter(r => r.site_id && r.url);
// v4.12 (AI_GROWTH_SPEC.md): the AI targets the AI Growth loop queued (questions AI answers without the business) and each site's AI pages a month
const aiTargets = rowsOf('Load AI Targets (Cadence)').filter(r => r.target_id && r.status === 'queued'), monitors = rowsOf('Load Monitors (Cadence)');
// R90 (2026-10-16): the names AI uses for other companies (seo_cache ai_brands:<site>), for the fit gate of the stored rungs
const aiBrandRows = rowsOf('Load AI Brands (Cadence)').filter(r => r.key);
const aiQuotaOf = (siteId) => { const m = monitors.find(x => x.site_id === siteId) || {}; const on = (v) => !(v === false || /^(false|0|no|off)$/i.test(String(v == null ? '' : v))); if (!on(m.ai_visibility) || !on(m.ai_growth)) return 0; return m.ai_pages_month === '' || m.ai_pages_month == null || !Number.isFinite(Number(m.ai_pages_month)) ? 2 : Math.min(8, Math.max(0, Math.round(Number(m.ai_pages_month)))); };
const cadOf = new Map(cad.map(c => [c.site_id, c]));
const want = normD(trigger.domain) || String(trigger.site_id || '').trim(); const on_demand = !!want; const dry_run = !!trigger.dry_run;
const force = on_demand && (trigger.force === true || lc(trigger.force) === 'true');
const now = new Date(); const nowIso = now.toISOString(); const week = nowIso.slice(0, 10);
const byDomain = new Map(); for (const s of sites) { const d = normD(s.domain); if (d && !byDomain.has(d)) byDomain.set(d, { ...s, domain: d }); }
for (const s of byDomain.values()) { if (s.email && s.callback_url) continue; const l = ladders.find(l => normD(l.domain) === s.domain && (l.email || l.callback_url)); if (l) { s.email = s.email || l.email || ''; s.callback_url = s.callback_url || l.callback_url || ''; } }
let list = [...byDomain.values()];
if (on_demand) list = list.filter(s => s.domain === want || s.site_id === want); else list = list.filter(s => String(s.status || 'active') !== 'paused');
const byRung = (a, b) => (Number(a.rung) || 0) - (Number(b.rung) || 0) || (Number(a.page_no) || 0) - (Number(b.page_no) || 0);
const isTop = (l) => Number(l.rung) === 4;
const posInt = (v, d, max) => { const n = Number(v); return (v !== '' && v != null && Number.isFinite(n) && n >= 1) ? Math.min(max, Math.floor(n)) : d; };
const settingOf = new Map(settings.filter(r => String(r.ladder_id) !== '_site').map(r => [String(r.ladder_id), r]));
const STATUSES = ['active', 'queued', 'paused', 'won', 'stuck', 'archived'];
const out = [];
for (const s of list) {
  const c = cadOf.get(s.site_id);
  let pages = (on_demand && trigger.pages != null && trigger.pages !== '') ? Number(trigger.pages) : (c ? (String(c.status || 'active') === 'off' ? 0 : Number(c.pages_per_week)) : (on_demand ? CONFIG.default_pages_per_week : 0));
  pages = Math.min(CONFIG.max_pages_per_week, Math.max(0, pages || 0));
  const aiQuota = aiQuotaOf(s.site_id);   // AI answer / refresh pages a month: on top of the blog posts, at most one a week
  if (!pages && !aiQuota) continue;
  // website defaults ('_site' row)
  const siteRow = settings.find(r => String(r.ladder_id) === '_site' && (r.site_id === s.site_id || normD(r.domain) === s.domain)) || {};
  const cfg = { mode: lc(siteRow.mode) === 'manual' ? 'manual' : 'auto', opportunities: lc(siteRow.opportunities) === 'manual' ? 'manual' : 'auto', max_active: posInt(siteRow.max_active, CONFIG.max_active, 20), max_waiting: posInt(siteRow.max_waiting, CONFIG.max_waiting, 100) };
  const slog = logs.filter(l => normD(l.domain) === s.domain);
  const recent = new Set(slog.filter(l => l.status === 'published' || (now - new Date(l.started_at || 0)) < CONFIG.skip_recent_days * 864e5).map(l => norm(l.keyword)));
  const publishedKw = new Set(slog.filter(l => l.published_url).map(l => norm(l.keyword)));
  const lrows = ladders.filter(l => normD(l.domain) === s.domain).sort(byRung);
  const ladderKw = new Set(lrows.map(l => norm(l.keyword)));
  for (const l of lrows) if (WAITING.LADDER_WRITTEN.has(l.status) || l.status === 'published') recent.add(norm(l.keyword));   // A-20: writing, written, not_ready
  // R16: every stored rung goes through the fit gate before it can be written. Context: the website's own domain, the competitors it
  // declared (seo_monitors / the site model) and, PROTECTED so that the ladder's own topic can never look like a brand, the ladder head
  // terms and the site's services. A rung whose page is already written or published is kept (fitStored) and only flagged.
  const monRow = monitors.find(m => m.site_id === s.site_id || normD(m.domain) === s.domain) || {};
  const fitModel = (() => { try { return SM.from(s, { monitors: monRow }); } catch (e) { return null; } })();
  const fitCtx = { own_domain: s.domain, brands: fitLearnedBrands(aiBrandRows.filter(r => String(r.key || '') === 'ai_brands:' + s.site_id)),
    competitors: fitModel ? fitModel.competitors : String(monRow.competitors || '').split(',').map(x => normD(x)).filter(Boolean),
    protect: [...new Set([...lrows.map(l => String(l.head_keyword || '')), ...(fitModel ? fitModel.services : [])].filter(Boolean))] };
  // the results page the Rank Tracker stored for this very keyword (G6 `competitors_json` / `snapshot_json`, written two hours earlier on
  // the same Monday): the domains that really rank for it, in rank order — the evidence that makes "facts erp" a brand query
  // R87 / R90 (2026-10-16, re-rating 2026-10-15): ONE stored reading — the newest desktop reading of the keyword for this site within 60
  // days, whichever workflow bought it — read one entry per position (RS.serpHosts, the same rule as the Rank Tracker). The old reader merged
  // every reading the keyword ever had into one list of best positions: an October page and a September page judged as one.
  const serpFor = (kw) => { const h = RS.prevReading(allRanks, { keyword: kw, domain: s.domain, before: nowIso, withSnapshot: true });
    return (h && (now - new Date(h.checked_at)) <= 60 * 864e5) ? RS.serpHosts(h, 10) : []; };
  // R90: every stored rung of a ladder is also judged against the domains of its LADDER's stored results pages (the head's above all):
  // "facts erp" has no reading of its own, but facts.ae stands on its head's page ("erp software uae", #6 on 2026-10-14)
  const ladderDoms = new Map();
  for (const l of lrows) { const d0 = ladderDoms.get(l.ladder_id) || new Set(); for (const h of serpFor(l.keyword)) d0.add(h); ladderDoms.set(l.ladder_id, d0); }
  const fitOf = new Map(); const set_aside = [];
  for (const l of lrows) {
    const serp = serpFor(l.keyword);
    const g = fitStored(l, { ...fitCtx, serp, serp_domains: [...new Set([...serp, ...(ladderDoms.get(l.ladder_id) || [])])].filter(h => normD(h) !== s.domain) }); fitOf.set(l, g);
    if (!g.flagged) continue;
    set_aside.push({ ladder_id: l.ladder_id, keyword: l.keyword, rung: Number(l.rung) || 0, page_no: Number(l.page_no) || 0, head: l.head_keyword || '',
      reason: g.reason, detail: g.detail, note: g.note, written: !!g.live, dropped: !g.ok });
  }
  const fitOk = (l) => (fitOf.get(l) || { ok: true }).ok;
  const open = (l) => String(l.status || 'planned') === 'planned' && !recent.has(norm(l.keyword)) && fitOk(l);
  // one entry per ladder: settings, main-keyword ranks, gate, won, eligible pages in writing order
  const groups = new Map(); for (const l of lrows) { if (!groups.has(l.ladder_id)) groups.set(l.ladder_id, []); groups.get(l.ladder_id).push(l); }
  const info = [...groups.entries()].map(([id, rows]) => {
    const st = settingOf.get(String(id)) || null;
    const top = rows.find(isTop) || null;
    const head = (top && top.keyword) || rows[0].head_keyword || '';
    const mode = st && ['auto', 'manual'].includes(lc(st.mode)) ? lc(st.mode) : cfg.mode;
    const status = st && STATUSES.includes(lc(st.status)) ? lc(st.status) : 'active';
    const plan_type = st && ['direct', 'short', 'full'].includes(lc(st.plan_type)) ? lc(st.plan_type) : '';
    const priority = st && Number(st.priority) >= 1 ? Number(st.priority) : Infinity;
    const start = rows.map(r => String(r.start_date || '')).filter(Boolean).sort()[0] || String((st && st.created_at) || '');
    const hist = headRanks.filter(h => String(h.ladder_id) === String(id) && norm(h.keyword) === norm(head) && String(h.position) !== '' && h.position != null && Number.isFinite(Number(h.position)) && Number(h.position) >= 0)
      .sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));   // failed checks (-1) are "check again", not a position
    const head_position = hist.length ? Number(hist[0].position) : null;
    const lastN = hist.slice(0, CONFIG.won_checks);
    const won = lastN.length >= CONFIG.won_checks && lastN.every(h => Number(h.position) >= 1 && Number(h.position) <= CONFIG.won_position);
    const support = rows.filter(r => !isTop(r));
    const published = support.filter(r => r.status === 'published' || publishedKw.has(norm(r.keyword))).length;
    const gate_open = plan_type === 'direct' || !support.length || published * 2 >= support.length || (head_position != null && head_position >= 1 && head_position <= CONFIG.gate_head_position);
    const ordered = plan_type === 'direct' ? [...rows.filter(isTop), ...rows.filter(r => !isTop(r))] : rows;
    const remaining = ordered.filter(open);
    const eligible = remaining.filter(r => !isTop(r) || gate_open);
    const main_waiting = !gate_open && remaining.some(isTop) && !eligible.length;   // blocked on publishing: the gated main page is all that is left
    // R87 (2026-10-16): a ladder whose MAIN keyword is set aside — its row says `set_aside` (the Rank Tracker and *Ladder Marks* write it
    // back with the reason), or the gate refuses it now on its stored results page — is paused. Its rungs exist to climb towards that
    // keyword, so none of them is written or queued (exec 638 queued four rungs of a ladder whose head the Rank Tracker had just set aside).
    const hf = top ? fitOf.get(top) : null;
    const head_aside = top && (String(top.status || '') === 'set_aside' || (hf && hf.flagged && !hf.ok))
      ? { keyword: top.keyword, reason: String(top.status || '') === 'set_aside' ? String(top.status_note || 'its main keyword was set aside') : (hf.detail + ' (' + hf.reason + ')') } : null;
    if (head_aside) return { id, rows, top, head, mode, status, plan_type, priority, start, head_position, won, won_checks: lastN.length, support: support.length, published, gate_open, main_waiting: false, remaining: [], eligible: [], head_aside };
    return { id, rows, top, head, mode, status, plan_type, priority, start, head_position, won, won_checks: lastN.length, support: support.length, published, gate_open, main_waiting, remaining, eligible };
  }).sort((a, b) => a.priority - b.priority || String(a.start).localeCompare(String(b.start)) || String(a.id).localeCompare(String(b.id)));
  const writable = info.filter(x => ['active', 'queued'].includes(x.status) && !x.won);
  const autoL = writable.filter(x => x.mode === 'auto' && x.remaining.length);
  const active = autoL.slice(0, cfg.max_active), queued = autoL.slice(cfg.max_active);
  const manualL = writable.filter(x => x.mode === 'manual');
  const ladderCand = (x, l) => {
    const rows = x.rows, top = x.top; const links = [];
    if (isTop(l)) { for (const r of rows.filter(r => !isTop(r) && r.target_url).slice(0, 12)) links.push({ url: r.target_url, role: 'down', keyword: r.keyword }); }   // the top page is the hub: it lists the whole cluster (12, was 6; v4.4)
    else { if (top && top.target_url && top.keyword !== l.keyword) links.push({ url: top.target_url, role: 'top', keyword: top.keyword }); const sib = rows.find(r => Number(r.rung) === Number(l.rung) && r.keyword !== l.keyword && r.target_url); if (sib) links.push({ url: sib.target_url, role: 'sibling', keyword: sib.keyword }); }
    // R15 (2026-10-13): `target_url` is the URL this ladder planned for the page — the run keeps it as the page's slug, so the ladder's
    // link map, the other rung pages' links and the rank tracking never point at a URL that will not exist
    return { keyword: l.keyword, page_type: l.page_type || 'Service Page', existing_page_url: l.page_exists ? (l.target_url || '') : '', target_url: l.target_url || '', source: 'ladder', ladder_id: l.ladder_id, rung: Number(l.rung) || 0, page_no: Number(l.page_no) || 0, head: l.head_keyword || '', links, why: 'keyword ladder, rung ' + (isTop(l) ? 'top' : l.rung) + ' towards "' + (l.head_keyword || '') + '"' };
  };
  const cands = [];
  for (const x of active) for (const l of x.eligible) cands.push(ladderCand(x, l));
  const opps = [];
  // ---- B4-3 (2026-10-15, benchmark area 4): A PAGE THAT IS LOSING TRAFFIC IS WORK, NOT A LINE IN AN E-MAIL ----
  // Until today the decay verdict lived for the length of one Site Tracker run and died in a weekly e-mail as a priority-3
  // "Refresh this page"; nothing in the system ever wrote that refresh. The leaders all close this loop — Clearscope generates a
  // Draft straight from its Content Decay view (https://www.clearscope.io/support/content-decay), Siteimprove.ai Content Strategy
  // sells "a prioritized plan of what to create, refresh, or optimize" (https://www.siteimprove.com/marketmuse/).
  // The Site Tracker now stores its judgement on the seo_pages row (B4-1 / B4-2), so the cadence reads it and queues the refresh
  // AHEAD of striking distance and rising trends: recovering clicks a page already earned beats guessing at new ones, and a
  // decaying page is measured fact where a rising trend is a forecast. Ladder rungs still come first — they are the plan the
  // owner chose. Only `decaying` qualifies: `seasonal`, `watch` and `too_small` are never written, so nothing is rewritten
  // because of a quiet month. A page refreshed in the last `decay_refresh_days` is left to settle before being touched again.
  const decayRows = pageRows.filter(r => r.site_id === s.site_id && String(r.decay_state || '') === 'decaying' && r.url);
  const ukeyD = (u) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const touchedRecently = new Set(slog.filter(l => l.existing_page_url && (now - new Date(l.started_at || 0)) < CONFIG.decay_refresh_days * 864e5).map(l => ukeyD(l.existing_page_url)));
  const topQueryRow = (r) => { let best = null; try { const qs = JSON.parse(r.queries_json || '[]');
      for (const q of (Array.isArray(qs) ? qs : [])) { const k = String(q.query || '').trim(); if (!k) continue;
        if (!best || (Number(q.impressions) || 0) > (Number(best.impressions) || 0)) best = q; } } catch (e) {}
    return best; };
  const decayCands = decayRows.map(r => ({ row: r, q: topQueryRow(r), lost: Number(r.decay_lost) || 0 }))
    // a refresh needs a search to be refreshed FOR; a page Search Console names no query for is reported, never written blind
    .filter(x => x.q && !touchedRecently.has(ukeyD(x.row.url)) && !recent.has(norm(x.q.query)) && !ladderKw.has(norm(x.q.query)))
    .sort((a, b) => b.lost - a.lost).slice(0, CONFIG.decay_per_week);
  const decay_skipped = decayRows.length - decayCands.length;
  for (const x of decayCands) opps.push({ keyword: x.q.query, page_type: 'Guide', existing_page_url: x.row.url, source: 'decay', decay_lost: x.lost,
    why: 'this page is losing traffic: ' + x.lost + ' clicks lost in 28 days (' + (Number(x.row.prev_clicks) || 0) + ' → ' + (Number(x.row.clicks) || 0) + ')'
      + (String(x.row.decay_kind || '') === 'clickthrough' ? ', and it is still shown as often, so the title and description come first' : '')
      + ' — refreshed, not written again. ' + String(x.row.decay_basis || '') });
  const sq = qh.filter(q => normD(q.domain) === s.domain && q.query); const latest = sq.reduce((m, q) => String(q.period_end) > m ? String(q.period_end) : m, '');
  const brand = s.domain.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const strikes = sq.filter(q => String(q.period_end) === latest && Number(q.position) >= CONFIG.striking_min_position && Number(q.position) <= CONFIG.striking_max_position && Number(q.impressions) >= CONFIG.striking_min_impressions && !(brand.length >= 4 && norm(q.query).replace(/\s/g, '').includes(brand)) && !recent.has(norm(q.query)) && !ladderKw.has(norm(q.query))).sort((a, b) => Number(b.impressions) - Number(a.impressions));
  // B4-3: a page already queued as a refresh is not queued a second time for one of its other queries — one page, one piece of work
  const decayUrls = new Set(decayCands.map(x => ukeyD(x.row.url)));
  for (const q of strikes) { if (q.page && decayUrls.has(ukeyD(q.page))) continue;
    opps.push({ keyword: q.query, page_type: (q.page && !/\/(blog|news|insights|articles)\//i.test(q.page)) ? 'Service Page' : 'Guide', existing_page_url: q.page || '', source: 'striking', why: 'ranks #' + Math.round(Number(q.position)) + ' with ' + q.impressions + ' impressions in 28 days (Search Console): one push from the top 3' }); }
  const st = trends.filter(t => normD(t.domain) === s.domain && t.direction === 'rising' && t.rising); const latestT = st.reduce((m, t) => String(t.checked_at) > m ? String(t.checked_at) : m, '');
  for (const t of st.filter(t => String(t.checked_at) === latestT)) for (const rq of String(t.rising).split(',').map(x => x.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase()).filter(Boolean)) {
    if (recent.has(norm(rq)) || ladderKw.has(norm(rq)) || cands.some(x => norm(x.keyword) === norm(rq)) || opps.some(x => norm(x.keyword) === norm(rq))) continue;
    opps.push({ keyword: rq, page_type: 'Guide', existing_page_url: '', source: 'trend', why: 'rising related search for "' + t.keyword + '" (Google Trends, ' + (t.change_pct > 0 ? '+' : '') + t.change_pct + '% vs the 12-month average)' }); }
  let suggestions = [];
  if (cfg.opportunities === 'auto') cands.push(...opps);
  else { const sk = new Set(); suggestions = opps.filter(o => { const k = norm(o.keyword); if (!k || sk.has(k)) return false; sk.add(k); return true; }).slice(0, CONFIG.suggestions).map(o => ({ keyword: o.keyword, source: o.source, page_type: o.page_type, existing_page_url: o.existing_page_url || '', why: o.why })); }
  // D11: one search, one page — a candidate a live page of the site already answers is written as a refresh of that page (ladder) or left out
  const invRows = pageRows.filter(r => r.site_id === s.site_id);
  const invModel = invRows.length ? SM.from({ site_id: s.site_id, domain: s.domain }, { pages: invRows }) : null;
  const ukeyP = (u) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const covered = [];
  const coverOf = (x) => { if (!invModel || x.existing_page_url) return null; const m = SM.matchPage(invModel, x.keyword); return (m && ukeyP(m.url) !== ukeyP(x.existing_page_url)) ? m : null; };
  const seen = new Set(); const uniq = cands.filter(x => { const k = norm(x.keyword); if (!k || seen.has(k)) return false; seen.add(k);
    const c = coverOf(x); if (!c) return true;
    covered.push({ keyword: x.keyword, source: x.source, url: c.url, matched_by: c.matched_by });
    if (x.source !== 'ladder') return false;   // an opportunity post would be a second page for the same search
    x.existing_page_url = c.url; x.covered_by = c.url; x.why += ' \u2014 ' + c.url + ' already answers this search, so it is refreshed, not written again';
    return true; });
  // pile-up guard (v4.14, FIX_PLAN D5): every page written and not published counts, each keyword once — the content log rows that say
  // `written` (in the last 120 days) AND the ladder rows still 'writing' whose keyword has such a row and no published page.
  // R1 / R111 / A-20: the rule itself lives in v5/code/_waiting.js (WAITING.waiting), so the ladder mode counts the same pages
  const WAITS = WAITING.WAITS;   // R111: const WAITS = new Set(['written', 'not_ready']); - a failed draft still waits, labelled "needs a fix"
  const W = WAITING.waiting({ log: slog, ladders: lrows, now: Number(now), days: CONFIG.waiting_days });
  const waiting = W.list;
  const waitingKw = W.keys;
  const pileup = waitingKw.size >= cfg.max_waiting;
  const paused_reason = pileup && !force ? 'pileup' : '';
  const picks = paused_reason ? [] : uniq.slice(0, pages);
  // v4.12: the AI page of the week — the most valuable queued AI target (a new answer page or a refresh of the page the site has), within the month's
  // allowance, one a week, not while the pile-up guard holds; Manual opportunities make it a suggestion instead
  const isAi = (l) => l.source === 'ai_answer' || l.source === 'ai_refresh';
  const aiUsed = slog.filter(l => isAi(l) && String(l.started_at || '').slice(0, 7) === nowIso.slice(0, 7)).length;
  const aiThisWeek = slog.some(l => isAi(l) && (now - new Date(l.started_at || 0)) < 6 * 864e5);
  const keyOfU = (u) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const refreshedRecently = new Set(slog.filter(l => l.existing_page_url && (now - new Date(l.started_at || 0)) < 60 * 864e5).map(l => keyOfU(l.existing_page_url)));
  // one search, one page: an AI question that a keyword-ladder page already targets is written AS that ladder page (with the AI target), never twice.
  // Words of the site's ladder heads ("e invoicing in uae") appear everywhere and do not count.
  const STOPW = new Set(['the', 'and', 'for', 'with', 'what', 'how', 'which', 'are', 'can', 'does', 'your', 'you', 'that', 'this', 'from', 'into', 'best', 'top', 'list', 'guide']);
  const headWords = new Set(lrows.flatMap(l => norm(l.head_keyword).split(' ')).filter(Boolean));
  const kwTok = (k) => [...new Set(norm(k).replace(/\b(e)\b/g, ' ').split(' ').filter(w => w.length > 2 && !STOPW.has(w) && !headWords.has(w)))];
  const sameSearch = (a, b) => { const A = kwTok(a), B = new Set(kwTok(b)); if (!A.length || !B.size) return false; return A.filter(w => B.has(w)).length / A.length >= 0.6; };
  const ladderFor = (t) => lrows.find(l => sameSearch(t.keyword, l.keyword) || sameSearch(l.keyword, t.keyword)) || null;
  const aiTargetOf = (t) => { const parseS = (v) => { try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } }; return { question: t.question, kind: t.kind, target_id: t.target_id, fanout: String(t.fanout || '').split(' | ').filter(Boolean), sources: parseS(t.sources_json), competitors: String(t.competitors || '').split(', ').filter(Boolean) }; };
  for (const p of picks) if (p.source === 'ladder' && !p.ai_target) { const t = aiTargets.find(x => x.site_id === s.site_id && x.status === 'queued' && x.kind !== 'refresh' && (sameSearch(x.keyword, p.keyword) || sameSearch(p.keyword, x.keyword))); if (t) { p.ai_target = aiTargetOf(t); p.target_id = t.target_id; p.why += ' — written to answer "' + t.question + '" in AI answers'; } }
  const aiQueue = aiTargets.filter(t => t.site_id === s.site_id && t.keyword && !(t.kind !== 'refresh' && ladderFor(t)) && (t.kind === 'refresh' ? !!t.page_url && !refreshedRecently.has(keyOfU(t.page_url)) : !recent.has(norm(t.keyword)) && !ladderKw.has(norm(t.keyword))) && !picks.some(x => norm(x.keyword) === norm(t.keyword)))
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  const aiCand = aiQueue.length ? (() => { const t = aiQueue[0];
    return { keyword: t.keyword, page_type: t.kind === 'refresh' ? 'Service Page' : (t.page_type || 'Guide'), existing_page_url: t.kind === 'refresh' ? t.page_url : '', source: t.kind === 'refresh' ? 'ai_refresh' : 'ai_answer', target_id: t.target_id,
      why: 'AI answers "' + t.question + '" without you' + (t.competitors ? ' (it names ' + String(t.competitors).split(', ').slice(0, 3).join(', ') + ')' : '') + (t.kind === 'refresh' ? ': refresh ' + t.page_url : ': a new answer page'),
      ai_target: aiTargetOf(t) }; })() : null;
  const aiDue = !!aiCand && aiQuota > aiUsed && !aiThisWeek;
  const aiPick = aiDue && !paused_reason && cfg.opportunities === 'auto' ? aiCand : null;
  if (aiDue && !paused_reason && cfg.opportunities !== 'auto') suggestions = [{ keyword: aiCand.keyword, source: aiCand.source, page_type: aiCand.page_type, existing_page_url: aiCand.existing_page_url, why: aiCand.why, target_id: aiCand.target_id }, ...suggestions].slice(0, CONFIG.suggestions);
  if (aiPick) picks.push(aiPick);
  const fromUniq = paused_reason ? 0 : Math.min(pages, uniq.length);   // the AI page (v4.12) is not one of uniq
  const upcoming = uniq.slice(fromUniq, fromUniq + CONFIG.upcoming).map(x => ({ keyword: x.keyword, source: x.source, why: x.why }));
  const pending = waiting.filter(w => !w.needs_fix).map(w => ({ keyword: w.keyword, started_at: w.written_at, days: Math.round((now - new Date(w.written_at || nowIso)) / 864e5) })).filter(p => p.days >= CONFIG.publish_reminder_days);   // D5: ladder pages are in `waiting` too; R111: a failed draft is never a publish reminder
  const needs_fix = waiting.filter(w => w.needs_fix).map(w => ({ keyword: w.keyword, written_at: w.written_at, reasons: w.reasons || [] }));   // R111
  const awaiting_approval = manualL.filter(x => x.eligible.length).map(x => { const l = x.eligible[0]; return { ladder_id: x.id, head: x.head, keyword: l.keyword, rung: Number(l.rung) || 0, page_no: Number(l.page_no) || 0, page_type: l.page_type || 'Service Page', existing_page_url: l.page_exists ? (l.target_url || '') : '' }; });
  const facts = { set_aside, covered_by_live_pages: covered.slice(0, 10), paused_reason, waiting_publish: waitingKw.size,
    needs_fix, needs_fix_keywords: needs_fix.map(w => w.keyword),   // R111: of the waiting pages, the drafts that failed their quality check
    paused_ladders: info.filter(x => x.head_aside).map(x => ({ ladder_id: x.id, head: x.head, reason: x.head_aside.reason })),   // R87
    // B4-3: what the week knows about pages losing traffic, whether or not one was picked — `decaying` is how many the Site
    // Tracker's test confirmed, `skipped` how many of those were left alone (refreshed recently, or no search to refresh for)
    decay: { decaying: decayRows.length, queued: decayCands.length, skipped: decay_skipped,
      pages: decayCands.map(x => ({ url: x.row.url, keyword: x.q.query, lost: x.lost, kind: String(x.row.decay_kind || ''), basis: String(x.row.decay_basis || '') })) }, waiting_keywords: waiting.map(w => w.keyword).slice(0, 20), max_waiting: cfg.max_waiting, pileup_forced: pileup && force, opportunities: cfg.opportunities, awaiting_approval, suggestions,
    ai_pages: { per_month: aiQuota, used_this_month: aiUsed, this_week: !!aiPick, next: aiCand ? { keyword: aiCand.keyword, source: aiCand.source, target_id: aiCand.target_id, why: aiCand.why } : null, queued: aiQueue.length },
    queued_ladders: queued.map(x => ({ ladder_id: x.id, head: x.head, priority: Number.isFinite(x.priority) ? x.priority : null, reason: 'max_active' })),
    won_ladders: info.filter(x => x.won || x.status === 'won').map(x => ({ ladder_id: x.id, head: x.head, position: x.head_position, checks: x.won_checks })),
    waiting_for_support: info.filter(x => x.main_waiting && ['active', 'queued'].includes(x.status) && !x.won).map(x => ({ ladder_id: x.id, head: x.head, published: x.published, supporting: x.support, needed: Math.ceil(x.support / 2), head_position: x.head_position })) };
  picks.forEach((p, i) => { const request_id = 'cad_' + week.replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, '') + '_' + (i + 1);
    out.push({ json: { site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', country: s.country || '', source: p.source, keyword: p.keyword, page_type: p.page_type, existing_page_url: p.existing_page_url || '', ladder_id: p.ladder_id || '', rung: p.rung || 0, page_no: p.page_no || 0, target_id: p.target_id || '', why: p.why, request_id, pages_per_week: pages, upcoming, pending_publish: pending, candidates: uniq.length, dry_run, week, ...facts,
      body: { mode: 'keyword', keyword: p.keyword, page_type: p.page_type, country: s.country || '', domain: s.domain, receive: ['Keyword Report', 'Page Content'], existing_page_url: p.existing_page_url || '', email: s.email || '', callback_url: s.callback_url || '', request_id, client_ip: 'cadence:' + s.site_id, force_content: true,
        ...(p.ai_target ? { ai_target: p.ai_target } : {}),
        ...(p.source === 'ladder' ? { ladder_id: p.ladder_id, ladder_rung: p.rung, ladder_head: p.head, ladder_page_no: p.page_no, ladder_target_url: p.target_url || '', ladder_links: (p.links || []).map(l => ({ url: l.url, path: String(l.url).replace(/^https?:\/\/[^\/]+/i, '') || '/', role: l.role, keyword: l.keyword, planned: true })) } : {}) } } }); });
  const dropped = set_aside.filter(x => x.dropped);   // R16: a rung nobody should write is a reason to report, not to go quiet
  if (!picks.length && (paused_reason || awaiting_approval.length || suggestions.length || facts.waiting_for_support.length || dropped.length || facts.paused_ladders.length)) {
    const fixK = new Set(needs_fix.map(w => norm(w.keyword)));
    const reason = paused_reason ? waitingKw.size + ' written pages waiting for publication (pile-up guard, limit ' + cfg.max_waiting + '): ' + facts.waiting_keywords.slice(0, 6).map(k => '"' + k + '"' + (fixK.has(norm(k)) ? ' (needs a fix: it did not pass the quality check)' : '')).join(', ')
        + (needs_fix.length ? ' — publish the ones that passed, and fix the ' + needs_fix.length + ' that need a fix and run them again, to continue' : ' — publish them to continue')
      : dropped.length ? 'nothing to write automatically this week; ' + dropped.length + ' planned page(s) set aside: ' + dropped.slice(0, 3).map(x => x.note).join(' | ')
      : 'nothing to write automatically this week';
    out.push({ json: { nothing_to_do: true, report_only: true, reason, site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', country: s.country || '', request_id: 'cad_' + week.replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, '') + '_0',
      pages_per_week: pages, upcoming, pending_publish: pending, candidates: uniq.length, dry_run, week, ...facts } });
  }
}
if (!out.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'nothing to write for "' + want + '" (no cadence set, nothing planned, or everything written recently)' : 'no site has a content cadence this week', sites: list.length, dry_run } }];
return out;
