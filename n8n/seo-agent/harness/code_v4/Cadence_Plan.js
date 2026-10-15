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
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml } };
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
const FIT_GENERIC = new Set(['ai', 'software', 'softwares', 'services', 'service', 'erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'tax', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll', 'finance', 'financial', 'cloud', 'digital', 'online', 'web', 'data', 'tech', 'technology', 'technologies', 'solutions', 'solution', 'systems', 'system', 'business', 'company', 'group', 'global', 'international', 'gulf', 'arab', 'arabia', 'emirates', 'national', 'consulting', 'consultants', 'consultancy', 'partners', 'partner', 'network', 'news', 'blog', 'guide', 'guides', 'info', 'best', 'top', 'free', 'app', 'apps', 'shop', 'store', 'market', 'media', 'academy', 'institute', 'university', 'school', 'bank', 'pay', 'pro', 'plus', 'hub', 'one', 'first', 'smart', 'easy', 'get', 'go', 'ae', 'com', 'net', 'org', 'home', 'house', 'world', 'city', 'daily', 'times', 'post', 'review', 'reviews', 'compare', 'comparison', 'list', 'directory', 'jobs', 'careers', 'wiki', 'wikipedia', 'youtube', 'linkedin', 'facebook', 'instagram', 'twitter', 'reddit', 'quora', 'medium', 'google', 'microsoft', 'amazon', 'apple']);
const FIT_GOV_WORDS = /\b(ministry|ministries|authority|authorities|federal|government|govt|municipality|municipal|embassy|consulate|police|courts?|customs|immigration|department of|public prosecution|parliament|chamber of commerce|free zone authority)\b/;
const FIT_GOV_NAMES = /\b(fta|emaratax|emara ?tax|tax authority|mohre|mohap|mofa|moec|gdrfa|icp|ica|rta|dewa|sewa|fewa|addc|aadc|dha|doh|ded|tdra|adjd|ejari|dubai land department|dld|dubai economy|dubai courts|zatca|gazt|gosi|qiwa|absher|muqeem|mudad|hrsd|misa|nafath|tawtheeq|uae pass|smart pass|amer cent(er|re)|tasheel|tawjeeh|emirates id|emirates identity|national id|i ?d card|identity card|labou?r card|work permit status|visa status|visa check|passport status|establishment card|golden visa status|trn verification|trn check|trn lookup|tax registration number check)\b/;
const FIT_PORTAL = /\b(log ?in|logins|sign ?in|sign ?up|password|passwords|portal|portals|e ?services?|customer care|customer service number|helpline|toll ?free|contact number|phone number|status|status check|check status|status enquiry|application status|track(ing)? (status|application|order)|renewal|renew|verification|verify|apply online|online application|download (the )?app|app download|complaint|complaints|fine check|traffic fines?|balance check|otp)\b/;
// content / buying words that turn a portal or government query into a topic ("best erp software with mobile login", "emaratax registration guide");
// plain category nouns (software, system, services …) do not — "erp software login" is still a login
const FIT_CONTENT = /\b(best|top|vs|versus|compar(e|ison)|review|reviews|alternatives?|how to|guide|guides|checklist|requirements?|pricing|price|prices|cost|costs|quote|quotes|hire|consultan(t|ts|cy|cies)|consulting|partner|partners|provider|providers|vendor|vendors|agency|agencies|accredited|approved|certified|compliant|compliance|implementation|integration|integrations|training|course|courses|template|templates|examples?|explained|meaning|benefits|registration|register|filing|return|returns|refund|refunds|deadline|deadlines|penalt(y|ies)|rules?|regulations?|free trial|demo|tutorial|steps|process|procedure)\b/;
const FIT_PARTNER = /\b(partner|partners|partnership|reseller|resellers|implementation|implement|implementer|implementers|consultan(t|ts|cy|cies)|consulting|integration|integrations|integrate|migration|migrate|support|training|developer|developers|development|customi[sz]ation|customi[sz]e|add-?ons?|plugins?|specialist|specialists|expert|experts|agency|agencies|services?)\b/;
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
  for (const l of lrows) if (l.status === 'writing' || l.status === 'published') recent.add(norm(l.keyword));
  // R16: every stored rung goes through the fit gate before it can be written. Context: the website's own domain, the competitors it
  // declared (seo_monitors / the site model) and, PROTECTED so that the ladder's own topic can never look like a brand, the ladder head
  // terms and the site's services. A rung whose page is already written or published is kept (fitStored) and only flagged.
  const monRow = monitors.find(m => m.site_id === s.site_id || normD(m.domain) === s.domain) || {};
  const fitModel = (() => { try { return SM.from(s, { monitors: monRow }); } catch (e) { return null; } })();
  const fitCtx = { own_domain: s.domain, brands: {},
    competitors: fitModel ? fitModel.competitors : String(monRow.competitors || '').split(',').map(x => normD(x)).filter(Boolean),
    protect: [...new Set([...lrows.map(l => String(l.head_keyword || '')), ...(fitModel ? fitModel.services : [])].filter(Boolean))] };
  // the results page the Rank Tracker stored for this very keyword (G6 `competitors_json` / `snapshot_json`, written two hours earlier on
  // the same Monday): the domains that really rank for it, in rank order — the evidence that makes "facts erp" a brand query
  const serpFor = (kw) => {
    const best = new Map();
    for (const h of allRanks.filter(h => norm(h.keyword) === norm(kw))) {
      for (const col of ['competitors_json', 'snapshot_json']) {
        let o = null; try { o = JSON.parse(h[col] || 'null'); } catch (e) { o = null; }
        if (!o || typeof o !== 'object') continue;
        for (const x of [...(o.above || []), ...(o.competitors || []), ...(o.top || [])]) {
          const d = normD(x.d || x.domain || x.u || x.url), p = Number(x.p || x.position);
          if (d && Number.isFinite(p) && p > 0) best.set(d, Math.min(best.get(d) == null ? 999 : best.get(d), p));
        }
      }
    }
    return [...best.entries()].sort((a, b) => a[1] - b[1]).map(e => e[0]);
  };
  const fitOf = new Map(); const set_aside = [];
  for (const l of lrows) {
    const serp = serpFor(l.keyword);
    const g = fitStored(l, { ...fitCtx, serp, serp_domains: serp }); fitOf.set(l, g);
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
  const freshW = (t) => { const x = Date.parse(String(t || '')); return Number.isFinite(x) && (now - x) < CONFIG.waiting_days * 864e5; };
  const waitingMap = new Map();   // keyword key -> { keyword, written_at, source }
  // R1 (2026-10-13, re-rating): `written` in the content log is the only proof that a page exists. A `started` row is a run that opened the
  // row and never finished, and a ladder row saying `writing` is a promise, not a page: live, a page run the budget guard refused left row 19
  // "writing" with a `started` log row, and this guard counted it as one of 6 pages waiting and paused the site's writing for a week.
  const writtenOf = (k) => slog.filter(r => norm(r.keyword) === k && (r.status === 'written' || r.status === 'published' || String(r.published_url || '').trim()))
    .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0] || null;
  for (const l of slog) { if (l.status !== 'written' || !freshW(l.started_at)) continue; const k = norm(l.keyword); if (!k || waitingMap.has(k)) continue; waitingMap.set(k, { keyword: l.keyword, written_at: String(l.started_at || ''), source: String(l.source || '') }); }
  for (const l of lrows) { if (l.status !== 'writing') continue; const k = norm(l.keyword); if (!k || waitingMap.has(k) || publishedKw.has(k)) continue;
    const lg = writtenOf(k); if (!lg) continue;   // R1: no `written` log row = the page was never written (the refusal path resets such a row to `planned`)
    const at = String(lg.started_at || l.start_date || ''); if (!freshW(at)) continue;
    waitingMap.set(k, { keyword: l.keyword, written_at: at, source: 'ladder' }); }
  const waiting = [...waitingMap.values()].sort((a, b) => String(a.written_at).localeCompare(String(b.written_at)));
  const waitingKw = new Set(waitingMap.keys());
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
  const pending = waiting.map(w => ({ keyword: w.keyword, started_at: w.written_at, days: Math.round((now - new Date(w.written_at || nowIso)) / 864e5) })).filter(p => p.days >= CONFIG.publish_reminder_days);   // D5: ladder pages are in `waiting` too
  const awaiting_approval = manualL.filter(x => x.eligible.length).map(x => { const l = x.eligible[0]; return { ladder_id: x.id, head: x.head, keyword: l.keyword, rung: Number(l.rung) || 0, page_no: Number(l.page_no) || 0, page_type: l.page_type || 'Service Page', existing_page_url: l.page_exists ? (l.target_url || '') : '' }; });
  const facts = { set_aside, covered_by_live_pages: covered.slice(0, 10), paused_reason, waiting_publish: waitingKw.size,
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
  if (!picks.length && (paused_reason || awaiting_approval.length || suggestions.length || facts.waiting_for_support.length || dropped.length)) {
    const reason = paused_reason ? waitingKw.size + ' written pages waiting for publication (pile-up guard, limit ' + cfg.max_waiting + '): ' + facts.waiting_keywords.slice(0, 6).map(k => '"' + k + '"').join(', ') + ' — publish them to continue'
      : dropped.length ? 'nothing to write automatically this week; ' + dropped.length + ' planned page(s) set aside: ' + dropped.slice(0, 3).map(x => x.note).join(' | ')
      : 'nothing to write automatically this week';
    out.push({ json: { nothing_to_do: true, report_only: true, reason, site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', country: s.country || '', request_id: 'cad_' + week.replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, '') + '_0',
      pages_per_week: pages, upcoming, pending_publish: pending, candidates: uniq.length, dry_run, week, ...facts } });
  }
}
if (!out.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'nothing to write for "' + want + '" (no cadence set, nothing planned, or everything written recently)' : 'no site has a content cadence this week', sites: list.length, dry_run } }];
return out;
