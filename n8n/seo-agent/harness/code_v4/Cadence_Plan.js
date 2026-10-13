// Content cadence: picks this week's blog topics per site (pages per week from seo_cadence, max 3), in this order: the keyword ladders' next
// planned pages (with each ladder's internal links), striking-distance queries from Search Console (positions 4-20 with impressions:
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
  const pageRows = (model) => pages(model).map(p => ({ site_id: S((model || {}).site_id), url: S(p.url), title: S(p.title).slice(0, 300), h1: S(p.h1).slice(0, 300),
    source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries_json: JSON.stringify(p.queries || []), updated_at: S((model || {}).model_updated_at) || new Date().toISOString() }));
  return { from, stored, siteUrl, apiTarget, name, nap, services, pages, facts, matchPage, withPages, toRow, pageRows, COLUMNS, isFresh, ageDays, FRESH_DAYS, MATCH_MIN,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml } };
})();
const CONFIG = { default_pages_per_week: 1, max_pages_per_week: 3, skip_recent_days: 90, striking_min_impressions: 30, striking_min_position: 4, striking_max_position: 20, publish_reminder_days: 7, upcoming: 4,
  max_active: 2, max_waiting: 3, waiting_days: 120, gate_head_position: 30, won_checks: 4, won_position: 3, suggestions: 5 };
let trigger = {}; try { const t = $('Manual Run').first(); trigger = (t && t.json) || {}; } catch (e) {}
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const lc = (v) => String(v == null ? '' : v).toLowerCase().trim();
const sites = rowsOf('Load Sites').filter(r => r.site_id && r.domain), cad = rowsOf('Load Cadence').filter(r => r.site_id), ladders = rowsOf('Load Ladders').filter(r => r.ladder_id && r.keyword), qh = rowsOf('Load Query History'), trends = rowsOf('Load Trends'), logs = rowsOf('Load Content Log').filter(r => r.keyword);
const settings = rowsOf('Load Ladder Settings').filter(r => r.ladder_id), headRanks = rowsOf('Load Main Keyword Ranks').filter(r => r.ladder_id && r.keyword);
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
  const open = (l) => String(l.status || 'planned') === 'planned' && !recent.has(norm(l.keyword));
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
    return { keyword: l.keyword, page_type: l.page_type || 'Service Page', existing_page_url: l.page_exists ? (l.target_url || '') : '', source: 'ladder', ladder_id: l.ladder_id, rung: Number(l.rung) || 0, page_no: Number(l.page_no) || 0, head: l.head_keyword || '', links, why: 'keyword ladder, rung ' + (isTop(l) ? 'top' : l.rung) + ' towards "' + (l.head_keyword || '') + '"' };
  };
  const cands = [];
  for (const x of active) for (const l of x.eligible) cands.push(ladderCand(x, l));
  const opps = [];
  const sq = qh.filter(q => normD(q.domain) === s.domain && q.query); const latest = sq.reduce((m, q) => String(q.period_end) > m ? String(q.period_end) : m, '');
  const brand = s.domain.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const strikes = sq.filter(q => String(q.period_end) === latest && Number(q.position) >= CONFIG.striking_min_position && Number(q.position) <= CONFIG.striking_max_position && Number(q.impressions) >= CONFIG.striking_min_impressions && !(brand.length >= 4 && norm(q.query).replace(/\s/g, '').includes(brand)) && !recent.has(norm(q.query)) && !ladderKw.has(norm(q.query))).sort((a, b) => Number(b.impressions) - Number(a.impressions));
  for (const q of strikes) opps.push({ keyword: q.query, page_type: (q.page && !/\/(blog|news|insights|articles)\//i.test(q.page)) ? 'Service Page' : 'Guide', existing_page_url: q.page || '', source: 'striking', why: 'ranks #' + Math.round(Number(q.position)) + ' with ' + q.impressions + ' impressions in 28 days (Search Console): one push from the top 3' });
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
  const facts = { covered_by_live_pages: covered.slice(0, 10), paused_reason, waiting_publish: waitingKw.size, waiting_keywords: waiting.map(w => w.keyword).slice(0, 20), max_waiting: cfg.max_waiting, pileup_forced: pileup && force, opportunities: cfg.opportunities, awaiting_approval, suggestions,
    ai_pages: { per_month: aiQuota, used_this_month: aiUsed, this_week: !!aiPick, next: aiCand ? { keyword: aiCand.keyword, source: aiCand.source, target_id: aiCand.target_id, why: aiCand.why } : null, queued: aiQueue.length },
    queued_ladders: queued.map(x => ({ ladder_id: x.id, head: x.head, priority: Number.isFinite(x.priority) ? x.priority : null, reason: 'max_active' })),
    won_ladders: info.filter(x => x.won || x.status === 'won').map(x => ({ ladder_id: x.id, head: x.head, position: x.head_position, checks: x.won_checks })),
    waiting_for_support: info.filter(x => x.main_waiting && ['active', 'queued'].includes(x.status) && !x.won).map(x => ({ ladder_id: x.id, head: x.head, published: x.published, supporting: x.support, needed: Math.ceil(x.support / 2), head_position: x.head_position })) };
  picks.forEach((p, i) => { const request_id = 'cad_' + week.replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, '') + '_' + (i + 1);
    out.push({ json: { site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', country: s.country || '', source: p.source, keyword: p.keyword, page_type: p.page_type, existing_page_url: p.existing_page_url || '', ladder_id: p.ladder_id || '', rung: p.rung || 0, page_no: p.page_no || 0, target_id: p.target_id || '', why: p.why, request_id, pages_per_week: pages, upcoming, pending_publish: pending, candidates: uniq.length, dry_run, week, ...facts,
      body: { mode: 'keyword', keyword: p.keyword, page_type: p.page_type, country: s.country || '', domain: s.domain, receive: ['Keyword Report', 'Page Content'], existing_page_url: p.existing_page_url || '', email: s.email || '', callback_url: s.callback_url || '', request_id, client_ip: 'cadence:' + s.site_id, force_content: true,
        ...(p.ai_target ? { ai_target: p.ai_target } : {}),
        ...(p.source === 'ladder' ? { ladder_id: p.ladder_id, ladder_rung: p.rung, ladder_head: p.head, ladder_page_no: p.page_no, ladder_links: (p.links || []).map(l => ({ url: l.url, path: String(l.url).replace(/^https?:\/\/[^\/]+/i, '') || '/', role: l.role, keyword: l.keyword, planned: true })) } : {}) } } }); });
  if (!picks.length && (paused_reason || awaiting_approval.length || suggestions.length || facts.waiting_for_support.length)) {
    const reason = paused_reason ? waitingKw.size + ' written pages waiting for publication (pile-up guard, limit ' + cfg.max_waiting + '): ' + facts.waiting_keywords.slice(0, 6).map(k => '"' + k + '"').join(', ') + ' — publish them to continue' : 'nothing to write automatically this week';
    out.push({ json: { nothing_to_do: true, report_only: true, reason, site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', country: s.country || '', request_id: 'cad_' + week.replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, '') + '_0',
      pages_per_week: pages, upcoming, pending_publish: pending, candidates: uniq.length, dry_run, week, ...facts } });
  }
}
if (!out.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'nothing to write for "' + want + '" (no cadence set, nothing planned, or everything written recently)' : 'no site has a content cadence this week', sites: list.length, dry_run } }];
return out;
