// AI Growth plan (v4.12, AI_GROWTH_SPEC.md; weekly, Monday 09:30 after the AI Visibility Tracker and the Site Tracker, and on demand): the work that
// gets a site named and cited in AI answers, not only measured. Per site with AI visibility and the growth loop on:
//   * key pages to check this week (can an assistant read and quote them: the AI Readiness step) — pages AI cited, the targets' pages, written and
//     ladder pages, the pages Search Console shows most, the homepage; each page about once a month, never-checked ones first;
//   * pages to send to Bing (the index Bing and Microsoft Copilot answer from) and to notify through IndexNow (Bing, Yandex, Naver, Seznam, Yep, Amazon — not
//     Google): new or updated pages, and key pages Bing has not crawled — plus (B9-2) the pages submitted in earlier runs whose outcome nobody ever looked up;
//   * the questions to win (seo_ai_targets): every lost question of the latest AI visibility run becomes a target — a new answer page, or a
//     refresh of the page the site already has for it — which the Content Cadence writes (ai_pages_month, default 2);
//   * the earned-media list: the exact third-party pages AI cited in answers that did not name the business (articles, lists, reviews, threads),
//     fetched next to see whether they name the business or its competitors (the strongest lever on AI mentions: earned media);
//   * the monthly entity check (Wikidata).
// B-G2 (2026-10-15, FIX_PLAN §3.16; INVARIANTS rule 2): the stored ladder rungs reached this plan with no gate, so a rung that is a
// competitor's brand or a government portal became a "question to win" and then a page the Content Cadence writes. The same shared
// read-path gate R16 built now runs here (FITR, _fit_gate.js) before any rung is read for a target, a key page or a submission.
// ---- shared by the monitors (AI Visibility Tracker, Backlink Monitor, Audit Scheduler; inlined by the build): which sites, with which settings ----
// Sites = the Data Table seo_sites ("Track my site") + every domain with a keyword ladder; settings per site from seo_monitors (defaults: everything on).
// On demand (Manual Run with { domain | site_id }) one site runs even when its weekly / monthly monitor is off; an untracked domain is checked ad hoc
// with the trigger's country, e-mail and callback.
let trigger = {}; try { const t = $('Manual Run').first(); trigger = (t && t.json) || {}; } catch (e) {}
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const siteIdFor = (d) => 'site_' + d.replace(/[^a-z0-9]+/g, '-');
const listOf = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\n,;]+/)).map(x => String(x).trim()).filter(Boolean);
const flag = (v, dflt) => (v === undefined || v === null || v === '') ? dflt : !(v === false || /^(false|0|no|off)$/i.test(String(v)));
const DEFAULT_ENGINES = ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode'];
const ALL_ENGINES = [...DEFAULT_ENGINES, 'copilot'];   // v4.12: Copilot (Bing's Copilot Search summary) only when chosen: Bing shows it for few searches (0 of 10 live, 2026-10-10)
// P34-6 (live 2026-10-12): the AI Visibility Tracker and the Backlink Monitor called the business "techand.ai" in every report and in
// the analyst's fact sheet, because the name was read from seo_profiles only — while AI Growth and the Link Builder read the site model
// and say "Tech&". The name now comes through the model (SM.name over the stored seo_sites row, SITE_MODEL_SPEC.md), with the business
// profile first as before; the bare domain is never a name. The AI Pulse does not inline the model kit, so SM is optional here.
const nameOf = (row, prof) => {
  const own = String((prof || {}).business_name || '').trim();
  if (own) return own;
  if (typeof SM === 'undefined') return '';
  const model = SM.stored(row) || null; const nm = model ? SM.name(model) : '';
  return nm && SM.helpers.bare(nm) !== String(row.domain || '').toLowerCase() ? nm : '';
};
function monitorSites(kind) {   // kind: 'ai' | 'backlinks' | 'audit' | 'links' (v4.13 Link Builder)
  const sites = rowsOf('Load Sites').filter(r => r.site_id && r.domain), ladders = rowsOf('Load Ladders').filter(r => r.domain), mons = rowsOf('Load Monitors'), profiles = rowsOf('Load Profiles');
  const byDomain = new Map();
  for (const s of sites) { const d = normD(s.domain); if (d && !byDomain.has(d)) byDomain.set(d, { ...s, domain: d, keywords: listOf(s.keywords).map(k => k.toLowerCase()), virtual: false }); }
  for (const l of ladders) { const d = normD(l.domain); if (d && !byDomain.has(d)) byDomain.set(d, { site_id: siteIdFor(d), domain: d, country: l.country || '', location_code: Number(l.location_code) || 0, language_code: l.language_code || 'en', email: l.email || '', callback_url: l.callback_url || '', keywords: [], status: 'active', source: 'ladder', virtual: true }); }
  for (const s of byDomain.values()) { if (s.email && s.callback_url) continue; const l = ladders.find(l => normD(l.domain) === s.domain && (l.email || l.callback_url)); if (l) { s.email = s.email || l.email || ''; s.callback_url = s.callback_url || l.callback_url || ''; } }
  const want = normD(trigger.domain) || String(trigger.site_id || '').trim();
  let list = [...byDomain.values()];
  if (want) {
    list = list.filter(s => s.domain === want || s.site_id === want);
    if (!list.length && normD(trigger.domain)) list = [{ site_id: siteIdFor(normD(trigger.domain)), domain: normD(trigger.domain), country: trigger.country || '', location_code: Number(trigger.location_code) || 0, language_code: trigger.language_code || 'en', email: '', callback_url: '', keywords: [], status: 'active', source: 'adhoc', virtual: true, adhoc: true }];
  } else list = list.filter(s => String(s.status || 'active') !== 'paused');
  const out = list.map(s => {
    const m = mons.find(x => x.site_id === s.site_id) || {};
    const p = profiles.find(x => x.site_id === s.site_id) || {};
    const engines = [...new Set(listOf(m.ai_engines).map(e => e.toLowerCase()).filter(e => ALL_ENGINES.includes(e)))];
    const settings = { ai_visibility: flag(m.ai_visibility, true), backlinks: flag(m.backlinks, true), audit_monthly: flag(m.audit_monthly, true), engines: engines.length ? engines : DEFAULT_ENGINES,
      prompts_max: Math.min(50, Math.max(3, Number(m.ai_prompts_max) || 20)), pulse: flag(m.ai_pulse, true), growth: flag(m.ai_growth, true), link_builder: flag(m.link_builder, true),
      ai_pages_month: m.ai_pages_month === '' || m.ai_pages_month == null || !Number.isFinite(Number(m.ai_pages_month)) ? 2 : Math.min(8, Math.max(0, Math.round(Number(m.ai_pages_month)))), audit_pages: Math.min(1000, Math.max(50, Number(m.audit_pages) || 200)), audit_js: flag(m.audit_js, false),
      competitors: [...new Set([...listOf(m.competitors), ...listOf(trigger.competitors)].map(normD).filter(d => d && d !== s.domain))].slice(0, 5),
      brand_names: [...new Set([...listOf(m.brand_names), ...listOf(trigger.brand_names), p.business_name || '', nameOf(s, p)].map(x => String(x).trim()).filter(Boolean))], stored: !!m.site_id };
    const o = { ...s, business_name: nameOf(s, p), settings, profile: { business_name: p.business_name || '', business_type: p.business_type || '', city: p.city || '', phone: p.phone || '', street_address: p.street_address || '', author_name: p.author_name || '',
      region: p.region || '', country_code: p.country_code || '', public_email: p.public_email || '', price_range: p.price_range || '', service_areas: p.service_areas || '', opening_hours: p.opening_hours || '' } };
    if (want) { if (trigger.email) o.email = trigger.email; if (trigger.callback_url) o.callback_url = trigger.callback_url; if (trigger.country) o.country = trigger.country; if (Number(trigger.location_code)) o.location_code = Number(trigger.location_code); if (trigger.language_code) o.language_code = trigger.language_code; }
    o.request_id = String(trigger.request_id || s.request_id || '');
    return o;
  });
  const flagOf = { ai: 'ai_visibility', backlinks: 'backlinks', audit: 'audit_monthly', links: 'link_builder' }[kind];
  return { list: want ? out : out.filter(s => s.settings[flagOf]), on_demand: !!want, want, trigger, total: byDomain.size };
}

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
const CONFIG = { audit_per_week: 12, recheck_days: 25, max_key_pages: 40, submit_max: 50, resubmit_days: 30, recent_days: 8, earned_fetch: 10, max_targets: 6, refresh_after_days: 90,
  win_min_answers: 2, follow_up_days: 45, follow_up_max: 15, decay_runs: 3, stale_writing_days: 14,   // B9-2 / B9-4 / B9-5 / B9-6 (benchmark area 9): what became of a submission, what a win needs, a page AI has stopped citing, and a page run that never produced a page
  stage_weight: { decision: 1, consideration: 0.8, awareness: 0.6 } };
const { list, on_demand, want, total } = monitorSites('ai');
const sites = on_demand ? list : list.filter(s => s.settings.ai_visibility && s.settings.growth);
if (!sites.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'no site matches "' + want + '"' : (total ? 'the AI growth loop is off for every site' : 'no sites yet') } }];
const vis = rowsOf('Load AI Visibility'), answers = rowsOf('Load AI Answers'), prompts = rowsOf('Load AI Prompts'), logs = rowsOf('Load Content Log'), qh = rowsOf('Load Query History'),
  pagesStored = rowsOf('Load AI Pages'), targetsStored = rowsOf('Load AI Targets'), growthRows = rowsOf('Load AI Growth'), cache = rowsOf('Load Cache (Growth)'), ladders = rowsOf('Load Ladders');
const now = new Date(); const iso = now.toISOString(); const month = iso.slice(0, 7);
const parse = (t, d) => { try { const v = JSON.parse(t || ''); return v == null ? d : v; } catch (e) { return d; } };
const days = (d) => d ? (now - new Date(d)) / 864e5 : Infinity;
const hostOf = (u) => { const m = String(u || '').match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
const keyOf = (u) => { const m = String(u || '').trim().match(/^https?:\/\/(?:www\.)?([^\/?#]+)([^?#]*)/i); if (!m) return ''; const path = (m[2] || '/').replace(/\/+$/, '') || '/'; return m[1].toLowerCase() + path; };   // host-agnostic (www or not)
const pathOfU = (u) => { const m = String(u || '').trim().match(/^https?:\/\/[^\/?#]+([^?#]*)/i); return m ? (m[1] || '/') : ''; };   // as the site writes it (trailing slash kept: Bing / IndexNow get the real address)
const toks = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'what', 'how', 'which', 'are', 'can', 'does', 'your', 'you', 'that', 'this', 'from', 'into', 'best'].includes(w));
const overlap = (a, b) => { const A = new Set(toks(a)), B = new Set(toks(b)); if (!A.size || !B.size) return 0; let k = 0; for (const x of A) if (B.has(x)) k++; return k / A.size; };   // share of the target keyword's words found in the other text
const hex = (len) => { let s = ''; while (s.length < len) s += Math.floor(Math.random() * 16).toString(16); return s; };
const qid = (q) => { let h = 5381; for (const ch of String(q || '').toLowerCase().replace(/\s+/g, ' ').trim()) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return 'q' + h.toString(36); };   // a stable id for a question stored without one (runs before v4.12)
const GOV = /(^|\.)(gov|gob|gouv|govt|mil)(\.[a-z]{2})?$|(^|\.)gov\.[a-z]{2}$|(^|\.)europa\.eu$|(^|\.)(un|who|oecd|worldbank|imf)\.org$/i;
const REVIEW = /(^|\.)(g2\.com|capterra\.[a-z.]+|clutch\.co|goodfirms\.co|trustpilot\.com|softwareadvice\.com|getapp\.com|trustradius\.com|sourceforge\.net|gartner\.com|yelp\.[a-z.]+|tripadvisor\.[a-z.]+|bayut\.com|designrush\.com|sortlist\.[a-z.]+|themanifest\.com|upcity\.com)$/i;
const FORUM = /(^|\.)(reddit\.com|quora\.com|stackexchange\.com|stackoverflow\.com|news\.ycombinator\.com)$|^(community|forum|forums|discuss)\./i;
const VIDEO = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com)$/i;
const SOCIAL = /(^|\.)(linkedin\.com|facebook\.com|x\.com|twitter\.com|instagram\.com|medium\.com)$/i;
const WIKI = /(^|\.)(wikipedia\.org|wikidata\.org)$/i;
const NEWS = /(^|\.)(reuters\.com|bloomberg\.com|forbes\.com|cnbc\.com|bbc\.co\.uk|ft\.com|wsj\.com|gulfnews\.com|khaleejtimes\.com|thenationalnews\.com|zawya\.com|arabianbusiness\.com|gulfbusiness\.com|techcrunch\.com|theverge\.com|businessinsider\.com|economictimes\.indiatimes\.com|livemint\.com)$/i;
const LISTY = /\b(best|top\s?\d+|\d+\s(best|top)|alternatives?|vs\.?|versus|compared?|comparison|leading|list of|providers? in|companies in|ranked|review(s|ed)?)\b/i;
const kindOf = (host, title, url, comps) => comps.some(c => host === c || host.endsWith('.' + c)) ? 'competitor' : WIKI.test(host) ? 'encyclopedia' : GOV.test(host) ? 'official' : FORUM.test(host) ? 'forum' : VIDEO.test(host) ? 'video'
  : SOCIAL.test(host) ? 'social' : REVIEW.test(host) ? 'review' : LISTY.test(title + ' ' + String(url).replace(/[-_\/]/g, ' ')) ? 'list' : (NEWS.test(host) || /\/(news|press)\//i.test(url)) ? 'news' : 'article';
const out = [];
for (const s of sites) {
  const dom = s.domain; const ours = (u) => { const h = hostOf(u); return h === dom || h.endsWith('.' + dom); };
  // D15: the host the site really serves (www or not) comes from the one site model (SITE_MODEL_SPEC.md), which resolved it from the homepage,
  // its canonical tag and the site's own live URLs. Bing and IndexNow refuse addresses on another host than the site's. With no model yet
  // (the weekly Site Tracker has not run for this site), the model is built here from the same live URLs the old vote used.
  const seen_hosts = [...qh.filter(q => q.site_id === s.site_id && q.page).map(q => q.page), ...logs.filter(l => normD(l.domain) === dom && l.published_url).map(l => l.published_url)].filter(u => ours(u));
  const site_model = SM.stored(s) || SM.from({ site_id: s.site_id, domain: dom }, { seen_hosts });
  const site_host = site_model.canonical_host || dom;
  const normU = (u) => { const k = keyOf(u); return k ? SM.siteUrl(site_model, pathOfU(u)) : ''; };
  const visMine = vis.filter(x => x.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
  const v = visMine[0] || null;
  // B9-4 (2026-10-15, benchmark area 9): a win used to be "the question is not in the latest run's gap list" — one observation, and
  // brand lists come back the same less than 1% of the time (SparkToro, in CRITERIA 4A). The answers of the last 8 days (the weekly
  // run AND the daily pulse write them) are what a win is measured on: how many answers named the business, out of how many answered.
  const myAns = answers.filter(a => a.site_id === s.site_id);
  const obsOf = (pid) => { const rows = myAns.filter(a => String(a.prompt_id || '') === String(pid || '') && (a.answered === true || a.answered === 'true'));
    const named = rows.filter(a => a.mentioned === true || a.mentioned === 'true');
    return { answers: rows.length, named: named.length, engines: [...new Set(rows.map(a => a.engine))], named_engines: [...new Set(named.map(a => a.engine))],
      last: rows.reduce((m, a) => String(a.checked_at || '') > m ? String(a.checked_at || '') : m, '') }; };
  const obsLine = (o) => o.answers ? 'named in ' + o.named + ' of ' + o.answers + ' answers in the last 8 days' + (o.named_engines.length ? ' (' + o.named_engines.join(', ') + ')' : '') : 'not asked in the last 8 days';
  // B9-5: a page AI used to cite and has stopped citing is the best refresh there is — measured from our own stored weekly runs.
  const citedRuns = visMine.slice(0, 6).map(r => ({ at: r.checked_at, set: new Set((parse(r.pages_json, []) || []).map(x => keyOf(x && (x.url || x.u) || ''))) }));
  const decayOf = (url) => { const k = keyOf(url); if (citedRuns.length < CONFIG.decay_runs || !k) return null;
    const hit = citedRuns.map(r => r.set.has(k)); if (hit[0] || hit[1]) return null;   // still cited in one of the last two checks: nothing to say
    const earlier = hit.slice(2).filter(Boolean).length; if (earlier < 2) return null;
    const last = citedRuns.slice(2).find(r => r.set.has(k));
    return { runs: citedRuns.length, cited_in: earlier, missed: 2, last_cited: last ? String(last.at || '').slice(0, 10) : '' }; };
  const gaps = v ? parse(v.gaps_json, []) : []; const cited = v ? parse(v.pages_json, []) : []; const compRows = v ? parse(v.competitors_json, []) : [];
  const comps = [...new Set([...s.settings.competitors, ...compRows.filter(c => c && /\./.test(c.domain || '')).map(c => c.domain)])];
  const myPrompts = prompts.filter(p => p.site_id === s.site_id); const promptOf = new Map(myPrompts.map(p => [p.prompt_id, p]));
  const slog = logs.filter(l => normD(l.domain) === dom); const lrowsAll = ladders.filter(l => normD(l.domain) === dom);
  // B-G2: the read-path gate, before a rung can become a key page, a target's page or the ladder page a question is handed to.
  const fitCtx = FITR.ctx({ own_domain: dom, competitors: comps, heads: lrowsAll.map(l => l.head_keyword), services: SM.services(site_model) });
  const fitG = FITR.rungs(lrowsAll, fitCtx, { where: 'AI growth targets' });
  const lrows = fitG.keep; const set_aside = fitG.set_aside;
  const sqAll = qh.filter(q => q.site_id === s.site_id && q.page); const lastPeriod = sqAll.reduce((m, q) => String(q.period_end || '') > m ? String(q.period_end || '') : m, '');
  const sq = sqAll.filter(q => String(q.period_end || '') === lastPeriod);   // the latest Search Console period only
  const stored = new Map(pagesStored.filter(p => p.site_id === s.site_id).map(p => [keyOf(p.url), p]));
  // ---- key pages ----
  const key = new Map();
  const addPage = (url, kind, why, extra = {}) => { if (!ours(url)) return; const k = keyOf(url), u = normU(url); if (!k) return; const x = key.get(k) || { url: u, kind, why, cited_by: [], questions: [] }; if (pathOfU(url) === '/' || pathOfU(url) === '') { x.kind = 'home'; x.why = 'homepage'; } if (extra.cited_by) x.cited_by = [...new Set([...x.cited_by, ...extra.cited_by])]; if (extra.question) x.questions = [...new Set([...x.questions, extra.question])].slice(0, 5); key.set(k, x); };
  for (const c of cited) addPage(c.url, 'cited', 'AI cites it', { cited_by: c.engines || [] });
  for (const l of slog.filter(l => l.published_url)) addPage(l.published_url, 'content', 'written by the agent: "' + l.keyword + '"');
  for (const l of lrows.filter(l => l.target_url && (l.status === 'published' || l.page_exists === true || l.page_exists === 'true'))) addPage(l.target_url, 'ladder', 'keyword ladder page: "' + l.keyword + '"');
  const byPage = new Map(); for (const q of sq) { const u = normU(q.page); if (!u) continue; const same = [...byPage.keys()].find(y => keyOf(y) === keyOf(u)) || u; byPage.set(same, (byPage.get(same) || 0) + (Number(q.impressions) || 0)); }
  [...byPage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([u, imp]) => addPage(u, 'search', imp.toLocaleString('en-GB') + ' Google impressions'));
  addPage(SM.siteUrl(site_model, '/'), 'home', 'homepage');
  // ---- the questions to win (targets) ----
  const pageFor = (keyword, question, pid) => {
    const fromAi = cited.find(c => answers.some(a => a.site_id === s.site_id && a.prompt_id === pid && String(a.our_urls || '').includes(String(c.url || '').replace(/^https?:\/\/(www\.)?/, ''))));
    if (fromAi) return { url: normU(fromAi.url), how: 'AI cited it for this question' };
    let best = null; for (const [u, imp] of byPage) { if (usedPages.has(keyOf(u))) continue; const qs = sq.filter(q => keyOf(q.page) === keyOf(u)); const o = Math.max(0, ...qs.map(q => wcover(keyword, q.query))); if (o >= 0.7 && (!best || o * Math.log10(10 + imp) > best.s)) best = { url: u, s: o * Math.log10(10 + imp), how: 'ranks on Google for related searches' }; }
    if (best) return best;
    const lr = lrows.find(l => l.target_url && !usedPages.has(keyOf(l.target_url)) && (l.status === 'published' || l.page_exists === true || l.page_exists === 'true') && wcover(keyword, l.keyword) >= 0.6); if (lr) return { url: normU(lr.target_url), how: 'keyword ladder page' };
    const lg = slog.find(l => l.published_url && !usedPages.has(keyOf(l.published_url)) && wcover(keyword, l.keyword) >= 0.6); if (lg) return { url: normU(lg.published_url), how: 'page written earlier' };
    return null;
  };
  // the site's own topic words appear in most of its queries: weight each word by how rare it is (IDF), so a page matches a question by its distinctive words
  const qn = Math.max(1, sq.length); const df = new Map(); for (const q of sq) for (const w of new Set(toks(q.query))) df.set(w, (df.get(w) || 0) + 1);
  const wgt = (w) => Math.log(1 + qn / (1 + (df.get(w) || 0)));
  const wcover = (kw, text) => { const K = [...new Set(toks(kw))], T = new Set(toks(text)); if (!K.length) return 0; const tot = K.reduce((t, w) => t + wgt(w), 0); return tot ? K.filter(w => T.has(w)).reduce((t, w) => t + wgt(w), 0) / tot : 0; };
  const usedPages = new Set();   // one refresh per page: a page matched to a question is not offered for the next one
  const existing = new Map(targetsStored.filter(t => t.site_id === s.site_id).map(t => [t.target_id, t]));
  const logByReq = new Map(slog.filter(l => l.request_id).map(l => [String(l.request_id), l]));   // B9-6: the run a target claims to be written by
  const targets = []; const won_lost = []; const won_now = []; const stalled_targets = [];   // B9-4: what was won this run, with its evidence, and what was won before and is lost again
  for (const g of gaps.filter(g => g && g.prompt && g.kind !== 'brand').slice(0, 10)) {
    const p0 = promptOf.get(g.prompt_id || '') || myPrompts.find(x => String(x.prompt || '').trim() === String(g.prompt).trim()) || {}; const pid = g.prompt_id || p0.prompt_id || qid(g.prompt); const keyword = String(p0.keyword || g.topic || '').toLowerCase().trim() || toks(g.prompt).slice(0, 5).join(' ');
    const target_id = 'ait_' + s.site_id.replace(/^site_/, '') + '_' + pid; const old = existing.get(target_id) || {};
    const page = pageFor(keyword, g.prompt, pid); if (page) usedPages.add(keyOf(page.url)); const pr = page ? stored.get(keyOf(page.url)) : null;
    // a planned keyword-ladder page for the same search: the Content Cadence writes it with this AI target (one search, one page)
    const hw = new Set(lrows.flatMap(l => String(l.head_keyword || '').toLowerCase().split(/[^a-z0-9]+/)).filter(Boolean)); const kt = (k) => [...new Set(toks(k).filter(w => !hw.has(w)))];
    const same = (a, b) => { const A = kt(a), B = new Set(kt(b)); return A.length > 0 && A.filter(w => B.has(w)).length / A.length >= 0.6; };
    const ladderPage = !page ? lrows.find(l => !['published'].includes(String(l.status)) && (same(keyword, l.keyword) || same(l.keyword, keyword))) : null;
    const stale = !pr || !pr.updated_on || days(pr.updated_on) > CONFIG.refresh_after_days; const weak = !pr || (Number(pr.score) || 0) < 70;
    const kind = page ? 'refresh' : 'answer';
    const engines = Object.entries(g.engines || {}).filter(([, st]) => st === 'absent').map(([e]) => e);
    const vol = Number(g.volume) || 0; const value = Math.round(100 * (1 + Math.log10(1 + vol) / 2) * (CONFIG.stage_weight[g.stage] || 0.7) * (1 + Math.min(4, (g.competitors || []).length) / 4) * (1 + engines.length / 7)) / 100;
    const PT = { compare: 'Comparison Page', recommend: 'Guide', choose: 'Guide', cost: 'Guide', problem: 'Guide' };
    // B9-4: this question is LOST — so a row that says 'won' is out of date, whatever it said last week. It goes back in the queue
    // with the date it was won and the date it was lost again, and the report raises it; nothing stays won because it once was.
    const wasWon = old.status === 'won';
    // B9-6 (INVARIANTS rules 2 and 4): the Content Cadence marks a target `writing` and stamps written_at when it STARTS a page
    // run, and nothing writes the row back if that run is refused or fails — so a question could sit "being written" for ever and
    // never be queued again. The read path checks the evidence: a content-log row for the same run that really says written or
    // published. Without one, after two weeks the question goes back in the queue and says why. (The write-side release belongs
    // to the cadence — registered as B9-6 for area 4.)
    const stalled = (() => { if (old.status !== 'writing') return null;
      const l = logByReq.get(String(old.request_id || ''));
      if (l && ['written', 'published'].includes(String(l.status))) return null;
      const since = old.written_at || old.updated_at || '';
      if (days(since) < CONFIG.stale_writing_days) return null;
      return { since: String(since).slice(0, 10), log: l ? 'the page run is still "' + l.status + '"' : 'no page run on record' }; })();
    const status = wasWon ? 'queued' : stalled ? 'queued' : ['writing', 'written'].includes(old.status) ? old.status : (kind === 'refresh' && !stale && !weak) ? 'skipped' : (old.status === 'skipped' && old.reason === 'kept by you') ? 'skipped' : 'queued';
    if (stalled) stalled_targets.push({ target_id, question: g.prompt, since: stalled.since, detail: stalled.log });
    const lostAgain = wasWon ? { target_id, question: g.prompt, won_at: String(old.won_at || '').slice(0, 10), lost_at: String((v && v.checked_at) || iso).slice(0, 10), observed: obsLine(obsOf(pid)) } : null;
    if (lostAgain) won_lost.push(lostAgain);
    targets.push({ target_id, site_id: s.site_id, domain: dom, prompt_id: pid, question: g.prompt, keyword, kind, page_url: page ? page.url : '', page_type: kind === 'refresh' ? '' : (PT[g.kind] || 'Guide'),
      fanout: (g.fanout || []).slice(0, 8).join(' | '), sources_json: JSON.stringify((g.cited_urls || []).slice(0, 6).map(c => ({ u: c.u, t: c.t || '', n: c.n || 1 }))), competitors: (g.competitors || []).slice(0, 8).join(', '),
      engines: engines.join(', '), stage: g.stage || '', value, status,
      reason: (stalled ? 'the page run started on ' + stalled.since + ' never produced a page (' + stalled.log + '): queued again. ' : '') + (lostAgain ? 'AI named you for this question and has stopped (won ' + (lostAgain.won_at || 'earlier') + ', lost again in the check of ' + lostAgain.lost_at + '; ' + lostAgain.observed + '). ' : '') + (ladderPage ? 'written as the keyword ladder page "' + ladderPage.keyword + '" (one search, one page)' : status === 'skipped' && kind === 'refresh' ? 'the page is fresh (updated ' + String(pr && pr.updated_on || '').slice(0, 10) + ') and AI-ready (' + (pr && pr.score) + '/100)' : page ? 'refresh ' + page.url + ' (' + page.how + (stale ? '; not updated in 90+ days' : '') + (weak ? '; AI-readiness ' + (pr ? pr.score + '/100' : 'not checked yet') : '') + ')' : 'no page answers it yet'),
      created_at: old.created_at || iso, updated_at: iso, request_id: old.request_id || '', written_at: old.written_at || '', won_at: old.won_at || '' });
    if (page) addPage(page.url, 'target', 'answers "' + g.prompt.slice(0, 80) + '"', { question: g.prompt });
  }
  // targets no longer lost: won (if written) or no longer needed
  const lostIds = new Set(targets.map(t => t.target_id));
  for (const [id, t] of existing) if (!lostIds.has(id) && !['won', 'skipped'].includes(t.status) && v) {
    // B9-4: absent from the gap list is not the same as named. It can also mean the question was not asked this run (the panel
    // rotates, a request can fail), so the answers of the window decide: at least win_min_answers of them must name the business.
    const o = obsOf(t.prompt_id || ''); const written = ['writing', 'written'].includes(t.status);
    const won = written && o.named >= CONFIG.win_min_answers;
    const keep = !won && (written || o.answers === 0);   // still being written, or nothing was asked: the row waits rather than lying either way
    const why = won ? 'AI names you for this question: ' + obsLine(o) : o.answers === 0 ? 'not asked in the last 8 days: nothing to judge a win on (kept)'
      : written ? obsLine(o) + ' — too few to call it won (at least ' + CONFIG.win_min_answers + ' needed)' : 'no longer lost in the latest AI check';
    targets.push({ target_id: id, site_id: s.site_id, domain: dom, prompt_id: t.prompt_id || '', question: t.question || '', keyword: t.keyword || '', kind: t.kind || 'answer', page_url: t.page_url || '', page_type: t.page_type || '', fanout: t.fanout || '', sources_json: t.sources_json || '[]',
      competitors: t.competitors || '', engines: t.engines || '', stage: t.stage || '', value: Number(t.value) || 0, status: won ? 'won' : keep ? t.status : 'skipped', reason: why,
      created_at: t.created_at || iso, updated_at: iso, request_id: t.request_id || '', written_at: t.written_at || '', won_at: won ? iso : (t.won_at || '') });
    if (won) won_now.push({ target_id: id, question: t.question || '', observed: obsLine(o) }); }
  const queued = targets.filter(t => t.status === 'queued').sort((a, b) => b.value - a.value);
  queued.slice(CONFIG.max_targets).forEach(t => { t.status = 'skipped'; t.reason = 'lower value than the ' + CONFIG.max_targets + ' queued questions (checked again next week)'; });
  // ---- pages to audit this week (rotating) ----
  const keyPages = [...key.values()].slice(0, CONFIG.max_key_pages);
  const rank = { cited: 0, target: 1, content: 2, ladder: 3, search: 4, home: 5 };
  const audit = keyPages.filter(p => { const st = stored.get(keyOf(p.url)); return !st || days(st.checked_at) >= CONFIG.recheck_days || on_demand; })
    .sort((a, b) => (stored.has(keyOf(a.url)) ? 1 : 0) - (stored.has(keyOf(b.url)) ? 1 : 0) || rank[a.kind] - rank[b.kind]).slice(0, CONFIG.audit_per_week);
  for (const kp of key.values()) { const d = decayOf(kp.url); if (d) kp.decay = d; }   // B9-5
  // B9-2 (INVARIANTS rule 4): a page SENT to Bing is not a page Bing has crawled, and nothing ever went back to look. Every page
  // submitted in the last 45 days that Bing has not crawled is asked about again (GetUrlInfo, free) so the run can report what
  // became of the submissions instead of counting them as work done.
  const follow_up = [...stored.values()].filter(st => st.submitted_at && days(st.submitted_at) <= CONFIG.follow_up_days && !st.bing_crawled_at)
    .filter(st => !audit.some(a => keyOf(a.url) === keyOf(st.url)))
    .sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at))).slice(0, CONFIG.follow_up_max)
    .map(st => ({ url: normU(st.url), submitted_at: st.submitted_at, submitted_via: st.submitted_via || '', days: Math.round(days(st.submitted_at)) }));
  // ---- pages to submit (Bing / IndexNow): new or updated, and key pages Bing has not crawled ----
  const submit = new Map(); const addSub = (u, why) => { if (!ours(u)) return; const k = keyOf(u), x = normU(u); if (k && x && ![...submit.keys()].some(y => keyOf(y) === k)) submit.set(x, why); };   // one entry per page (www / slash variants)
  for (const l of slog.filter(l => l.published_url && days(l.published_at) <= CONFIG.recent_days)) addSub(l.published_url, 'published this week');
  for (const st of stored.values()) { if (st.updated_on && days(st.updated_on) <= CONFIG.recent_days && (!st.submitted_at || st.submitted_at < st.updated_on)) addSub(st.url, 'updated this week');
    else if (Number(st.bing_status) === 0 && st.checked_at && !st.bing_crawled_at && days(st.submitted_at) > CONFIG.resubmit_days) addSub(st.url, 'Bing has not crawled it'); }
  for (const p of keyPages) if (!stored.has(keyOf(p.url))) addSub(p.url, 'key page, first submission');
  // ---- the earned-media list: exact pages AI cited in answers that did not name the business (last 8 days, weekly + daily) ----
  const em = new Map();
  for (const a of answers.filter(a => a.site_id === s.site_id && (a.answered === true || a.answered === 'true') && !(a.mentioned === true || a.mentioned === 'true') && a.kind !== 'brand'))
    // G22 (2026-10-11 system review): a source chip sometimes carries only a fragment of the title ("E", "Best e" live). A title that
    // short is treated as missing, so Earned Media reads the page's own <title> from the copy it fetches anyway; a real title is kept whole.
    for (const c of parse(a.cited_urls, [])) { if (!c || !c.u || ours(c.u)) continue; const h = hostOf(c.u); const t0 = String(c.t || '').replace(/\s+/g, ' ').trim(); const t = t0.length >= 8 ? t0 : '';
      const x = em.get(c.u) || { url: c.u, title: t, host: h, n: 0, engines: new Set(), questions: new Set() }; x.n++; x.engines.add(a.engine); x.questions.add(a.prompt); if (!x.title && t) x.title = t; em.set(c.u, x); }
  const perHost = new Map();
  const earned = [...em.values()].map(x => ({ url: x.url, title: x.title, host: x.host, citations: x.n, engines: [...x.engines], questions: [...x.questions].slice(0, 3), kind: kindOf(x.host, x.title, x.url, comps) }))
    .sort((a, b) => b.citations * (1 + b.engines.length) - a.citations * (1 + a.engines.length))
    .filter((e, i, all) => !e.title || all.findIndex(x => x.host === e.host && x.title === e.title) === i)   // the same article under two addresses (tracking parameters) once
    .filter(e => { const k = perHost.get(e.host) || 0; perHost.set(e.host, k + 1); return k < 2; }).slice(0, 30);
  // ---- IndexNow key (stored once per site; the owner hosts https://<domain>/<key>.txt) and the monthly entity check ----
  const kRow = cache.find(c => c.key === 'indexnow:' + s.site_id); const kv = kRow ? parse(kRow.value, {}) : {};
  const indexnow_key = (kv && /^[a-f0-9]{32}$/.test(kv.key || '')) ? kv.key : hex(32);
  const prevG = growthRows.filter(g => g.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0] || null;
  const prevEntity = prevG ? parse(prevG.entity_json, null) : null;
  const entity_due = on_demand || !prevEntity || String(prevEntity.checked_at || '').slice(0, 7) !== month;
  const label = dom.split('.')[0];
  const brand_names = [...new Set([dom, ...(s.settings.brand_names || []), ...(label.length >= 5 ? [label] : []), s.profile.business_name].map(x => String(x || '').trim()).filter(x => x.length >= 3))];
  // D12: the name a draft signs with comes from the one site model (profile -> homepage Organization / og:site_name -> what the app sent),
  // never from the domain label — the earned-media drafts signed "techand" / "techand.ai" (live 2026-10-11). `link_builder` decides who
  // writes: with it on, these prospects go to the Link Builder's qualification and writer (one writer).
  const modelName = SM.name(site_model);
  const business_name = String(s.profile.business_name || '').trim() || (modelName && SM.helpers.bare(modelName) !== dom ? modelName : '');
  out.push({ json: { site_id: s.site_id, domain: dom, site_host, country: s.country || '', email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '', on_demand, business_name, profile: s.profile,
    link_builder: !!s.settings.link_builder, services: SM.services(site_model), accreditation: SM.facts(site_model).accreditation,
    // B-G2: what the gate refused, with its reason, so the report names it instead of printing a shorter list (INVARIANTS rule 1)
    set_aside, set_aside_note: FITR.line(set_aside, 'turned into a question to win or a page to write'),
    brand_names, competitors: comps.slice(0, 12), ai_pages_month: s.settings.ai_pages_month, run_id: 'grow_' + iso.slice(0, 10).replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, ''), checked_at: iso,
    vis_checked_at: v ? v.checked_at : '', win_min_answers: CONFIG.win_min_answers, won_lost, won_now, stalled_targets, follow_up, follow_up_days: CONFIG.follow_up_days,
    key_pages: keyPages, audit, submit: [...submit.entries()].slice(0, CONFIG.submit_max).map(([url, why]) => ({ url, why })), targets, earned, earned_fetch: earned.filter(e => e.kind !== 'competitor').slice(0, CONFIG.earned_fetch).map(e => e.url),
    indexnow_key, indexnow_new: !kRow, indexnow_verified_at: kv.verified_at || '', entity_due, previous_entity: prevEntity, previous: prevG ? { checked_at: prevG.checked_at, avg_score: Number(prevG.avg_score) || null, earned: parse(prevG.earned_json, []) } : null,
    stored_pages: [...stored.values()].map(p => ({ url: normU(p.url), key: keyOf(p.url), score: Number(p.score) || 0, checked_at: p.checked_at, updated_on: p.updated_on, submitted_at: p.submitted_at, submitted_via: p.submitted_via, bing_crawled_at: p.bing_crawled_at, bing_status: Number(p.bing_status) || 0, kind: p.kind })) } });
}
return out.length ? out : [{ json: { nothing_to_do: true, reason: 'no site to work on' } }];
