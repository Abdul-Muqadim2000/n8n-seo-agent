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
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const all = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const ready = all('AI Readiness').filter(x => !x.skip), earnedAll = all('Earned Media').filter(x => !x.skip);
const oIn = all('AI Outreach Input').filter(x => !x.skip), oOut = all('AI Outreach Writer');
const bSub = all('Bing Submit Requests').filter(x => !x.skip), bRes = all('Submit to Bing'), bReq = all('Bing Growth Requests').filter(x => !x.skip);
const kReq = all('IndexNow Key Requests').filter(x => !x.skip), kRes = all('Fetch IndexNow Key'), iReq = all('IndexNow Requests').filter(x => !x.skip), iRes = all('Submit IndexNow');
const eReq = all('Entity Requests').filter(x => !x.skip), eRes = all('Fetch Wikidata');
const BING = true;
const jsonOf = (r) => { if (!r) return {}; if (r.d !== undefined || r.ErrorCode !== undefined || r.search || r.query) return r; const b = r.body ?? r.data; if (b && typeof b === 'object') return b; try { return JSON.parse(b || '{}'); } catch (e) { return {}; } };
const parseJ = (raw) => { if (raw && typeof raw === 'object') return raw; try { return JSON.parse(String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')); } catch (e) { return {}; } };
const keyOf = (u) => { const m = String(u || '').trim().match(/^https?:\/\/(?:www\.)?([^\/?#]+)([^?#]*)/i); if (!m) return ''; return m[1].toLowerCase() + ((m[2] || '/').replace(/\/+$/, '') || '/'); };
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
  const scored = pages.filter(r => r.status);
  const avg_score = scored.length ? Math.round(scored.reduce((t, r) => t + r.score, 0) / scored.length) : null;
  // ---- earned media (+ drafts) ----
  const em = earnedAll.find(x => x.site_id === p.site_id) || { earned: [], prospect_rows: [], outreach_jobs: [] };
  const oi = oIn.findIndex(x => x.site_id === p.site_id); const drafts = oi >= 0 && oOut[oi] && !oOut[oi].error ? ((parseJ(oOut[oi].output).drafts) || []) : [];
  const draftFor = (job) => drafts.find(d => Number(d.n) === job.n) || null;
  // P34-1 (live 2026-10-12): the drafts the report counts and prints are the ones THIS run's writer produced. Reading them off the
  // stored prospect row brought back the pitches of 2026-10-02 — written before the D12 / D13 gates — as "8 outreach draft(s) written",
  // including one to tax.gov.ae. A draft written now is stamped (drafted_at); Earned Media has already withdrawn the superseded ones.
  const wroteNow = new Map();
  const prospect_rows = em.prospect_rows.map(r => { const job = em.outreach_jobs.find(j => j.prospect_domain === r.prospect_domain); const d = job ? draftFor(job) : null;
    if (!(d && d.body)) return r;
    const fresh = DRAFTS.fresh(d, now); wroteNow.set(r.prospect_domain, { subject: fresh.outreach_subject, body: fresh.outreach_body });
    return { ...r, outreach_subject: fresh.outreach_subject, outreach_body: fresh.outreach_body, drafted_at: fresh.drafted_at }; });   // status stays new (the app's prospect statuses: new / contacted / won / rejected / ignored); a stored draft = ready to send
  const earned = em.earned.slice(0, 15).map(e => { const row = prospect_rows.find(r => r.prospect_domain === e.host && r.source_url === e.url); return { ...e, status: row ? row.status : '', contact_email: (row && row.contact_email) || e.contact_email || '', draft: wroteNow.get(e.host) || null }; });
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
  for (const r of pages.filter(r => !r.status || r.status >= 400 || r.checks.some(c => c.key === 'indexable' && c.ok === false && r.status >= 200 && r.status < 300))) {
    actions.push({ priority: 1, type: 'access', action: 'Fix ' + r.url + (r.status >= 400 || !r.status ? ' (answers ' + (r.status || 'nothing') + ')' : ' (not indexable)'), why: r.issues[0] || 'Assistants cannot use a page they cannot fetch or index.' });
    if (['cited', 'target', 'ladder', 'content', 'home'].includes(r.kind)) alerts.push({ level: 'high', text: 'Key page ' + r.url + ' cannot be used by AI: ' + (r.issues[0] || 'error ' + r.status) });
  }
  for (const r of pages.filter(r => r.checks.some(c => c.key === 'raw_text' && c.ok === false))) actions.push({ priority: 1, type: 'render', action: 'Serve the text of ' + r.url + ' in the HTML', why: 'Only ' + r.words_raw + ' words without JavaScript; ChatGPT, Claude, Perplexity and Gemini do not run JavaScript.' });
  for (const e of earned.filter(e => e.draft || e.action_type === 'reply').slice(0, 3)) actions.push({ priority: 1, type: 'earned', action: e.action, why: 'AI cited "' + (e.title || e.url) + '" ' + e.citations + 'x (' + e.engines.join(', ') + ') for "' + (e.questions[0] || '') + '"' + (e.competitors_named.length ? '; it names ' + e.competitors_named.join(', ') + ' and not you' : '') + (e.draft ? '. A draft is ready.' : ''), url: e.url, draft: e.draft });
  if (!verified) actions.push({ priority: 2, type: 'indexnow', action: 'Put one file on the website: ' + indexnow.key_url, why: 'The file contains just ' + p.indexnow_key + '. Then every new or updated page is sent the same day to Bing (ChatGPT search, Copilot), Yandex, Naver and the other IndexNow engines.', key: p.indexnow_key, key_url: indexnow.key_url });
  if (BING && !inAccount) actions.push({ priority: 2, type: 'bing', action: 'Add ' + p.site_host + ' to Bing Webmaster Tools', why: 'Import it from Google Search Console (one click) in the account the agent reads: new pages are then submitted to Bing every week and Bing\'s crawl of each key page is checked.' });
  for (const t of queued.slice(0, 2)) actions.push({ priority: 2, type: t.kind === 'refresh' ? 'refresh' : 'content', action: (t.kind === 'refresh' ? 'Refresh ' + t.page_url + ' to answer "' : 'Write an answer page for "') + t.question + '"', why: t.reason + (p.ai_pages_month > 0 ? '. Queued: the Monday content run writes it (' + p.ai_pages_month + ' AI pages a month).' : '. AI pages are off for this site: write it from the AI visibility page.'), target_id: t.target_id,
    api_body: { mode: 'keyword', keyword: t.keyword, country: p.country, domain: p.domain, page_type: t.page_type || 'Guide', existing_page_url: t.kind === 'refresh' ? t.page_url : '', receive: ['Keyword Report', 'Page Content'], ai_target: { question: t.question, kind: t.kind, fanout: t.fanout.split(' | ').filter(Boolean), sources: JSON.parse(t.sources_json || '[]'), competitors: t.competitors.split(', ').filter(Boolean), target_id: t.target_id } } });
  for (const r of pages.filter(r => ['cited', 'target', 'ladder', 'content'].includes(r.kind) && r.checks.some(c => (c.key === 'fresh' || c.key === 'answer_first') && c.ok !== true)).slice(0, 3)) actions.push({ priority: 3, type: 'page', action: 'Improve ' + r.url + ' (AI-readiness ' + r.score + '/100)', why: r.issues.slice(0, 2).join(' ') });
  if (entity && !entity.found) actions.push({ priority: 3, type: 'entity', action: 'Become a recognised entity', why: 'No Wikidata item has ' + p.domain + ' as its official website. Wikidata accepts organisations with independent sources (press, registries): once covered, create the item with the website (P856), the founding date and the location — knowledge graphs feed AI answers.' });
  for (const w of newlyWon) alerts.push({ level: 'good', text: 'You are now named on ' + w.source_url + ', a page AI cites for your topic.' });
  for (const t of wonT) alerts.push({ level: 'good', text: 'AI now names you for "' + t.question + '" (an AI target written for it).' });
  const growth_row = { site_id: p.site_id, domain: p.domain, run_id: p.run_id, checked_at: now, submitted: bing.submitted + indexnow.submitted, submitted_json: J({ bing, indexnow: { ...indexnow, key: undefined } }), indexnow: verified ? 'verified' : 'key_missing',
    pages_checked: scored.length, avg_score, pages_json: J(pages.map(r => ({ url: r.url, kind: r.kind, score: r.score, status: r.status, issues: r.issues.slice(0, 3), updated_on: r.updated_on, words_raw: r.words_raw, bing_crawled_at: r.bing_crawled_at, submitted: r.submitted_now }))),
    targets_json: J({ queued: queued.length, writing: targets.filter(t => t.status === 'writing').length, written: targets.filter(t => t.status === 'written').length, won: targets.filter(t => t.status === 'won').length, top: queued.slice(0, 5).map(t => ({ target_id: t.target_id, question: t.question, kind: t.kind, page_url: t.page_url, value: t.value })) }),
    earned_json: J(earned.slice(0, 12).map(e => ({ url: e.url, title: e.title, host: e.host, kind: e.kind, citations: e.citations, engines: e.engines, questions: e.questions, mentions_us: e.mentions_us, competitors_named: e.competitors_named, action: e.action, status: e.status, drafted: !!e.draft }))),
    entity_json: entity ? J(entity) : '', actions_json: J(actions.map(({ api_body, draft, ...a }) => a).slice(0, 12)), alerts: alerts.map(a => a.level + ': ' + a.text).join(' | ').slice(0, 2000), cost_usd: oi >= 0 ? 0.03 : 0 };
  const cache_rows = (p.indexnow_new || (verified && !p.indexnow_verified_at)) ? [{ key: 'indexnow:' + p.site_id, kind: 'ai', site_id: p.site_id, value: J({ key: p.indexnow_key, verified_at: verified ? now : '', created_at: now }), updated_at: now }] : [];
  out.push({ json: { site_id: p.site_id, domain: p.domain, site_host: p.site_host, business_name: p.business_name, email: p.email, callback_url: p.callback_url, request_id: p.request_id, on_demand: p.on_demand, run_id: p.run_id, checked_at: now, ai_pages_month: p.ai_pages_month,
    submitted: { bing, indexnow }, pages: pages.map(({ checks, ...r }) => ({ ...r, checks: checks.map(c => ({ key: c.key, ok: c.ok, label: c.label })) })), avg_score, previous_avg_score: p.previous ? p.previous.avg_score : null,
    targets: targets.map(t => ({ target_id: t.target_id, question: t.question, kind: t.kind, page_url: t.page_url, status: t.status, value: t.value, reason: t.reason, engines: t.engines, competitors: t.competitors })),
    // B-G2 (2026-10-15): the rungs the read-path fit gate set aside, with the reason, so the report says why the list is shorter
    set_aside: p.set_aside || [], set_aside_note: p.set_aside_note || '',
    earned, entity, actions: actions.slice(0, 12), alerts, drafts_written, handed_over, page_rows, target_rows: targets, prospect_rows, growth_row, cache_rows } });
}
return out.length ? out : [{ json: { skip: true } }];
