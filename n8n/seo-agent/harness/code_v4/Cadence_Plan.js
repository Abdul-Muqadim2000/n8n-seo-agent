// Content cadence: picks this week's pages per site (pages per week from seo_cadence, max 3), in this order: the keyword ladders' next
// planned pages (with each ladder's internal links), REFRESHES of pages the Site Tracker proved are losing traffic (v4.16 / B4-3, ranked by
// the clicks actually lost), striking-distance queries from Search Console (positions 4-20 with impressions:
// strengthen the page that already ranks), rising related searches from Google Trends. Skips keywords written in the last 90 days, pages already
// written or published, brand queries, and paused sites. Each pick becomes a content run (mode keyword, force_content) that delivers the blog package.
// v4.8 (Pipeline phase 2, PIPELINE_FEATURE_SPEC §6-7) — per ladder from seo_ladder_settings (no row = the site's default mode, else auto; active;
// priority by start date), per site from its '_site' row (defaults: max_active 2, max_waiting 3):
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
//   * Manual ladders are never written: each one's next eligible page is listed in awaiting_approval.
// ---- KEYWORD-FIRST AUTOPILOT (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §5.1 / §5.5 / §14; the contract is app/shared/src/cycles.ts) ----
// On 2026-10-19 this node wrote "dynamics 365 finance operations partner uae" (an AI refresh) for a CRM-only client who had chosen no keyword:
// the AI quota defaulted to 2 a month, a site with 0 posts a week still ran for AI pages, `opportunities` defaulted to auto and the AI target
// passed no topic gate. The rules now, per website (`autopilot_level` on its `_site` row of seo_ladder_settings; empty or invalid = 2):
//   * R-K1: ladder pages are written only for ladders the client chose (`chosen_by` client_typed / client_picked / empty = legacy or API);
//     a `system_announced` ladder is written at level 3 only; anything else is never written on its own (listed for approval instead).
//   * R-K2: at levels 1 and 2 NOTHING is written until the site has at least one client-chosen ladder (any status except archived): the
//     site gets a report-only status "Waiting for your first keyword" (`waiting_for_keyword: true`). Level 3 needs no ladder.
//   * R-K3: what runs on its own depends on the level (AUTO_SOURCES, the same table as cycles.ts): 1 = ladder pages only; 2 = also refreshes
//     of the client's EXISTING pages (decay, striking distance with a page, AI refresh), each only when the keyword is IN TOPIC (positive
//     evidence: its own words match the site's ladder heads, rungs and services); 3 = also new topics (rising trends, AI answer pages, striking
//     distance without a page). Everything else is a SUGGESTION (max 5) with its price — never written. The old `opportunities` setting no
//     longer decides anything (a stored `auto` is read as "suggest").
//   * R-K4: the fit gate (own brand, other brands, government, portal, off topic, too broad — the site's own domain, its competitors, the brand
//     names AI uses for other companies, the ladder heads and services protected, as the rung gate does) runs on EVERY non-ladder candidate
//     and every suggestion at every level. A refusal is listed with its reason (`set_aside`, `refused`) and is never suggested.
//   * `pages_per_week` bounds everything automatic, and 0 means nothing at any level (the old "skip only when there are no pages AND no AI quota" let a site set
//     to 0 posts get AI pages). At level 3 the AI page still comes on top, by `ai_pages_month`. At levels 1 and 2 an AI ANSWER page (a new
//     page) is only ever a suggestion; an AI refresh of an existing page in topic is a level-2 refresh like the others and takes a slot of
//     `pages_per_week` (cycles.ts AUTO_SOURCES[2] lists ai_refresh).
//   * R-K7, one cycle one budget: pages a ladder start wrote in this cycle, and pages an earlier run of this cycle's cadence started, count
//     against `pages_per_week`. The cycle starts at the cycle run's `scheduled_for`; a run outside a cycle counts the last 6 days.
//   * skips (seo_skips, written by the app): `skip` (scope `always`, or `cycle` for this cycle's key) -> not written, not suggested;
//     `approve` for this cycle -> a needs-OK item is written in this cycle, within `pages_per_week`, after the ladder pages and before the
//     other automatic items. item_key = cycleNorm(keyword), the same normalisation as cycles.ts. An approval is the CLIENT's choice, so it is
//     written even while the site waits for its first keyword at levels 1-2 (2026-10-19, agent E4): R-K2 stops what the system would choose,
//     not what the client asked for. Skips still beat approvals, the budget still applies, and the pile-up guard still holds everything.
//   * `trigger: 'cycle'` (the Cycle Dispatcher, plan §14.2): one site, scheduled semantics (pauses and an `off` cadence honoured, no `pages`
//     override, no `force`), request ids dated by the cycle. `preview: true` (the dispatcher's `preview` job, 48 h before a cycle) plans exactly
//     what that cycle would write and WRITES NOTHING: one item per site (`preview: true`, `dry_run: true`) that the Cadence Preview node turns
//     into the `cycle_preview` callback (shape CyclePreview in cycles.ts).
// ---- F-KW (2026-10-20, production-safety review of keyword-first; replays in harness/scenarios_keyword_first.js KF11-KF20) ----
// The review proved the default level still wrote the Techand page once ANY keyword was chosen: "in topic" read the services the site crawl
// inferred (Techand IS a Dynamics 365 partner), so the D365 refresh was "in topic" for a client who chose CRM. The owner's rule: levels 1-2
// never write a topic the client did not choose. Now:
//   * IN TOPIC = what the CLIENT chose: the heads and kept rungs of the client's own ladders and the services they declared (`chosenTopics`).
//     The crawl's services still PROTECT words in the gate (no refusal of the site's own services), but never make a page "in topic" at
//     levels 1-2. Level 3 (full autopilot, the client's choice) adds the crawl's services, and needs that evidence for EVERY automatic item,
//     new topics included; no evidence = a suggestion (fitEvidence, v5/code/_fit_gate.js: a site listing two services no longer passes all).
//   * the website's root and its main menu pages (`nav_pages_json`) are never rewritten on their own, at any level: a suggestion at most.
//   * a preview (any `preview: true`) plans the cycle AS OF its due time (`scheduled_for`): the month of the AI allowance, "an AI page this
//     week", the 90-day recent rule, the decay and refresh windows, the pile-up window and in-flight runs are all read at that time.
//   * a ladder planned more than 60 days ago (cycles.ts QUEUED_RECHECK_DAYS) that has never had a page written waits for the app's fresh
//     Keyword Check (`rechecked_at` on its seo_ladder_settings row, written by the app) before its first page: listed for the client
//     ("checking this keyword again before writing", `recheck: true`) and in `recheck_ladders`, never written on a plan that old.
//   * R-K7 for ladder starts at ANY point of the cycle: a page a ladder start wrote counts against the first cadence run after it, so a
//     Saturday start counts against the next Wednesday (the previous cadence run's time comes from seo_cycle_jobs, else the previous due time).
//   * who chose a ladder: its seo_ladder_settings row, else its own seo_ladders rows (the ladder run writes `chosen_by` on both, rows first),
//     so a failed settings save can no longer make an announced keyword read as the client's; '' on both = a ladder from before the column.
//   * an approval matches the item's source and ladder when the app recorded them; a keyword-only approval that fits two items writes none.
//   * every keyword and item key is normalised in every script (Unicode letters, marks and digits), identically in app/shared/src/cycles.ts.
// ---- P1 (2026-10-20, rehearsal §4 item 1, owner decision): no page before the author profile and the business facts ----
// A new client's first page was written with neither on file and Content QA refused it (11 bracketed author fields, claims nothing on file
// supports), after the client paid about 62 credits. Now every page this run would write (ladder pages, approved items, the level's own
// items, the AI page) is HELD while the website's author profile (seo_profiles: name, job title, bio) or business facts (seo_sites
// .business_facts, at least READY.FACTS_MIN characters) are missing: `held_for_profile` lists them with the reason, a preview shows them
// as items with `held: 'profile'`, an approval waits too (approved_not_written reason `profile`), nothing is started or charged, and the
// next cycle after both are filled in writes them, within its budget. The site is not "waiting for a keyword" for this: it is
// `waiting_for_profile`. One rule with the ladder start and the app: v5/code/_readiness.js (app/shared/src/readiness.ts).
// Every page run also carries the website's stored business facts and call to action (`business_facts`, `cta`), so the brief uses them.
// Sites without a pick but with something to say (paused, waiting for a keyword, awaiting approval, suggestions, a main page waiting for
// support, refusals) get one report_only item (nothing_to_do: true) for the Cadence Status note; dry_run only plans.
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
  const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();   // F-KW (2026-10-20): every script, as cycleNorm
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
// ---- is the website ready for its first written page? ONE rule for the ladder start, the Content Cadence and the app (P1, 2026-10-20) ----
// Rehearsal 2026-10-20 (docs/REHEARSAL_2026-10-20.md §4 item 1): a new client launched a ladder with no author profile and no business facts;
// the first page was written at once (Claude about $1.02, about 62 credits) and Content QA rightly refused it: "11 bracketed field(s) in the
// byline, the author box and the Person schema still need your details" and claims "nothing on file supports". The owner's decision: the
// first page waits until the author profile and the business facts are filled in. Inlined by the build (its marker is READINESS in a block comment) into
// *Ladder Plan* (main workflow) and *Cadence Plan* (Content Cadence); mirrored word for word in app/shared/src/readiness.ts.
//   * author profile ready = what Content QA needs to put NO bracket in the byline, the author box or the Person schema (Content_QA.js
//     PROFILE_PH, Blog_Package.js): the author's name (without it 11 fields are brackets) and a bio (without it the author box keeps one),
//     plus the author's job title, the role the byline and the Person schema name (the owner's minimum: a name and a role).
//   * business facts ready = facts on file of a reasonable length (FACTS_MIN characters, whitespace collapsed): what the page may claim
//     about the business, so its own terms, scope and credentials are not marked [Confirm: ...].
//   of({ profile, facts }) -> { ready, profile_ready, facts_ready, missing: [{ key, label }], missing_text, reason, basis }
const READY = (() => {
  const S = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const FACTS_MIN = 30;
  const PROFILE_FIELDS = [
    { key: 'author_name', label: "your author's name" },
    { key: 'author_job_title', label: "your author's job title" },
    { key: 'author_bio', label: 'a short author bio' },
  ];
  const FACTS = { key: 'business_facts', label: 'your business facts' };
  const REASON = 'waiting for your author profile and business facts';
  const listText = (a) => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const of = (o) => {
    const x = o || {}; const p = (x.profile && typeof x.profile === 'object') ? x.profile : {};
    const missingProfile = PROFILE_FIELDS.filter(f => !S(p[f.key]));
    const facts = S(x.facts);
    const facts_ready = facts.length >= FACTS_MIN;
    const missing = [...missingProfile.map(f => ({ key: f.key, label: f.label })), ...(facts_ready ? [] : [{ key: FACTS.key, label: FACTS.label }])];
    const missing_text = listText(missing.map(m => m.label));
    return { ready: !missing.length, profile_ready: !missingProfile.length, facts_ready, facts_chars: facts.length, facts_min: FACTS_MIN, missing, missing_text,
      reason: missing.length ? REASON + ' (add ' + missing_text + ')' : '',
      basis: 'the author profile needs a name, a job title and a bio (the fields the byline, the author box and the Person schema print); the business facts need at least ' + FACTS_MIN + ' characters' };
  };
  return { of, FACTS_MIN, PROFILE_FIELDS, REASON };
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
// F-KW (2026-10-20, finding 8): letters and digits of EVERY script, not a-z only. An Arabic keyword ("برنامج محاسبة في الإمارات") was
// no tokens at all, so a ladder the client chose in Arabic was set aside as `empty` and every Arabic item key was ''. NFKC folds
// full-width and compatibility forms, toLowerCase (never the locale form) folds case; marks (\p{M}) stay inside their word.
const FIT_SPLIT = /[^\p{L}\p{M}\p{N}.]+/u, FIT_SPLIT_WORDS = /[^\p{L}\p{M}\p{N}]+/u;
const fitLow = (s) => String(s || '').normalize('NFKC').toLowerCase();
const fitTokens = (s) => fitLow(s).replace(/[’']/g, '').split(FIT_SPLIT).map(t => t.replace(/^\.+|\.+$/g, '')).filter(t => t.length > 1 && !FIT_STOP.has(t));
const fitHost = (d) => String(d || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^(www|m|app|en|ar)\./, '');
const fitGovHost = (d) => { const h = fitHost(d); return /(^|\.)gov(\.[a-z]{2,3})?$/.test(h) || /(^|\.)(gouv|gob|go|gv)\.[a-z]{2}$/.test(h) || /(^|\.)mil(\.[a-z]{2})?$/.test(h) || /(^|\.)(u\.ae|government\.ae|dubai\.ae|abudhabi\.ae|sharjah\.ae|ajman\.ae|rak\.ae|tax\.gov\.ae|europa\.eu)$/.test(h); };
// the brand label(s) of a domain: "facts.ae" -> ["facts"], "northwind-erp.com" -> ["northwind"] (generic / short parts dropped), "e-invoicing.ae" -> []
const fitLabels = (domain, protect) => { const h = fitHost(domain); if (!h) return []; const first = h.split('.')[0]; const parts = [...new Set([first, ...first.split(/[-_]/)])];
  return parts.map(p => p.replace(/[^a-z0-9]/g, '')).filter(p => p.length >= FIT_CFG.min_label && !FIT_GENERIC.has(p) && !FIT_GEO.has(p) && !(protect || []).includes(p)); };
// F-KW (2026-10-20, finding 5): a label is the website's own BRAND only when it is distinctive. A label that splits entirely into category,
// generic or place words, or into the words of the keyword or of what the client protected (its ladder heads, its services), describes what
// the site sells ("erp-software.ae", "crmexperts.ae", "accountingsoftware.ae", "interiordesign-dubai.com"); it is not a name, and a keyword
// built from those words is the client's own subject. "techand" does not split ("tech" + the stop word "and" is not allowed), so "techand crm"
// stays the site's own brand. The label itself is never part of its own vocabulary, so "crmexperts reviews" (one word) is still the brand.
const FIT_CATEGORY = new Set(['expert', 'experts', 'specialist', 'specialists', 'consultant', 'advisor', 'advisors', 'advisory', 'agency', 'agencies', 'design', 'designs', 'designer', 'designers',
  'interior', 'interiors', 'outsourcing', 'marketing', 'seo', 'legal', 'law', 'lawyer', 'lawyers', 'clinic', 'clinics', 'dental', 'medical', 'health', 'care', 'realty', 'property', 'properties', 'homes',
  'travel', 'tours', 'logistics', 'cargo', 'shipping', 'trading', 'auto', 'autos', 'cars', 'motors', 'insurance', 'printing', 'events', 'cleaning', 'maintenance', 'security', 'training', 'courses',
  'implementation', 'integration', 'migration', 'support', 'hosting', 'it', 'hr', 'audit', 'auditing', 'bookkeeping', 'consult', 'advice', 'pros', 'works', 'labs', 'studio', 'studios',
  'center', 'centre', 'source', 'point', 'zone', 'link', 'links', 'line', 'now', 'hq', 'co', 'inc', 'llc', 'ltd', 'fz', 'fzco', 'fze', 'dmcc']);
const fitWordBreak = (label, vocab) => { const n = label.length; const ok = new Array(n + 1).fill(false); ok[0] = true;
  for (let i = 1; i <= n; i++) for (let j = Math.max(0, i - 30); j < i; j++) if (ok[j] && vocab.has(label.slice(j, i))) { ok[i] = true; break; }
  return ok[n]; };
const fitOwnLabels = (domain, toks, protect) => fitLabels(domain, []).filter(l => {
  const words = [...FIT_GENERIC, ...FIT_GEO, ...FIT_CATEGORY, ...(toks || []), ...(protect || [])].map(w => String(w || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(w => w.length >= 2 && w !== l && !FIT_STOP.has(w));
  const vocab = new Set(); for (const w of words) { vocab.add(w); vocab.add(w + 's'); if (w.length > 3 && w.endsWith('s')) vocab.add(w.slice(0, -1)); }
  vocab.delete(l);
  return !fitWordBreak(l, vocab); });
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
// E-GATE (2026-10-21, pre-launch run D4): the topic words drop every word of two letters (below), so "ai" is never one of them, and a client
// whose first declared service is "AI consulting" was told "ai consulting services uae", "ai consulting dubai" and "best ai consulting firms
// dubai" were "too broad" (only category or place words, none of them the site's). Making "ai" a topic word on its own is not the fix: it is a
// category word (R13), and with it every "ai" + category or place search of an AI-selling site passed ("ai online", "ai in cloud", "best ai
// apps", harness S103). The short word counts through the client's own phrase instead (fitCarriedName below): a keyword made only of category
// and place words that carries the WHOLE of a short topic phrase (a service the client named, a keyword they chose: "AI consulting", "Power
// BI", "HR software") names that service. Two-letter words count there because fitTokens keeps them.
const fitTopicWords = (topics) => new Set((Array.isArray(topics) ? topics.filter(Boolean).join(' ') : String(topics || '')).normalize('NFKC').toLowerCase()
  .split(FIT_SPLIT_WORDS).filter(t => t.length > 2 && !FIT_STOP.has(t) && !FIT_GEO.has(t)).map(fitStem));
// E-GATE (D4): words a buyer adds to any service search ("ai consulting cost uae", "best ai consulting firm dubai"). They say how the person
// buys, not what they buy, so they are neutral like a place: "ai consulting cost uae" was refused as off topic on the word "cost" alone.
const FIT_BUYER = new Set(['cost', 'costs', 'price', 'prices', 'pricing', 'fee', 'fees', 'quote', 'quotes', 'cheap', 'cheapest', 'affordable', 'firm', 'near', 'nearby']);
const fitAnd = (a) => a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
// the short topic phrase (2 to 6 words, never prose) whose every word the keyword carries ("consultants" carries "consulting": the same stem rule as fitTopic)
const fitCarriedName = (toks, topics) => { const ks = toks.filter(t => !FIT_GEO.has(t)).map(fitStem);
  const hit = (x) => { const s = fitStem(x); return ks.some(k => k === s || (k.length >= 5 && s.length >= 5 && (k.indexOf(s) === 0 || s.indexOf(k) === 0))); };
  for (const t of (Array.isArray(topics) ? topics : [topics])) { const raw = String(t || '').replace(/\s+/g, ' ').trim(); if (!raw) continue;
    const w = fitTokens(raw).filter(x => !FIT_GEO.has(x) && !/^\d+$/.test(x));
    if (w.length < 2 || w.length > 6) continue;
    if (w.every(hit)) return raw; }
  return ''; };
// B-3: the topics as PHRASES (one service name, one configured keyword, one description), so a common word can be judged against the name
// it came from. `dist` = the phrase's own distinctive words (stemmed); prose (more than 6 of them) never vouches for a common word.
const fitTopicPhrases = (topics) => (Array.isArray(topics) ? topics.filter(Boolean).map(String) : [String(topics || '')])
  .map(t => { const w = fitLow(t).split(FIT_SPLIT_WORDS).filter(x => x.length > 2 && !FIT_STOP.has(x) && !FIT_GEO.has(x) && !/^\d+$/.test(x));
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
  const own = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !FIT_BUYER.has(t) && !/^\d+$/.test(t));   // F-KW: a year or a number ("2026") is neutral, like a place; E-GATE: so is a buyer's word (cost, firm)
  const known = [...T];
  const stemHit = (s, x) => x === s || (x.length >= 5 && s.length >= 5 && (s.indexOf(x) === 0 || x.indexOf(s) === 0));
  const matches = (t) => { const s = fitStem(t); return T.has(s) || known.some(x => stemHit(s, x)); };
  // B-3: a common word (FIT_COMMON) is on topic only through a service NAME the keyword carries whole, or two words of (prose never vouches)
  // ("business central partner uae" carries two words of "Dynamics 365 Business Central"; "intelligent software solutions" one of "Intelligent Document Processing")
  const ownStems = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !FIT_BUYER.has(t) && !/^\d+$/.test(t)).map(fitStem);
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
    const carried = fitCarriedName(toks, topics);
    if (carried) return { ok: true, reason: '', detail: 'it names "' + carried + '", part of ' + label, share: 1 };
    // E-GATE (D4): the sentence names the words, not the keyword again (it read "... and the keywords you chose ("<the keyword itself>")")
    return { ok: false, reason: 'too broad', detail: (toks.length === 1 ? 'its one word, "' + toks[0] + '", is a category or a place' : 'it has only category or place words, ' + fitAnd(toks.map(t => '"' + t + '"'))) + ', so nothing in it points to ' + label, share: cats.length ? 0.5 : 0 };
  }
  const hits = own.filter(matchOwn);
  const share = Math.round(100 * hits.length / own.length) / 100;
  if (share < bar) return { ok: false, reason: 'off topic', detail: Math.round(share * 100) + '% of its own words match ' + label + ' (' + Math.round(bar * 100) + '% is the bar): '
    + own.filter(t => hits.indexOf(t) < 0).slice(0, 4).join(', ') + '. Add it to your services if you do sell it.', share };
  return { ok: true, reason: '', detail: Math.round(share * 100) + '% of its own words match ' + label, share };
}
// ---- F-KW (2026-10-20, findings 1 and 2): POSITIVE topic evidence, for the decisions that write on their own ----
// fitTopic answers "may we refuse it?" and, with fewer than 12 topic words on file, refuses nothing ("no evidence, no refusal"). That is the
// right rule for a refusal and the wrong one for writing a page on our own: a site that lists two services passed every keyword. fitEvidence
// answers "is there evidence it is the client's subject?": `in` = at least the topic bar of the keyword's own words is in the topics given (any
// number of topic words); `out` = with 12+ topic words on file the keyword misses the bar (a refusal); `unknown` = too little on file to say,
// which a caller must treat as NOT in topic (a suggestion at most) and say so in plain words.
// F-REH (2026-10-20, real-credit rehearsal): a DECLARED service's product-category word is positive evidence. "crm service provider uae" for a
// client who listed "CRM implementation" came back "not enough information": `crm` is a category word (FIT_GENERIC), which the share rule
// treats as neutral, so the keyword was judged on "provider" alone. When the client named the category in a service (ctx.services = the
// services they DECLARED, never the crawl's guesses), that word counts as one of the keyword's own words AND as a hit, at any number of topic
// words on file. Only product categories qualify: `ai`, `software`, `cloud` and the wide words never do ("character ai" stays off topic for an
// "AI consulting" site); a FIT_COMMON word ("sales", "central") still needs the whole service name, as in fitTopic.
const FIT_SERVICE_CATS = new Set(['erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll']);
const fitServiceAnchors = (keyword, services) => {
  const svc = new Set((Array.isArray(services) ? services : [services]).filter(Boolean).flatMap(x => fitTokens(String(x))).filter(t => FIT_SERVICE_CATS.has(t)).map(fitStem));
  if (!svc.size) return [];
  return [...new Set(fitTokens(keyword).filter(t => FIT_SERVICE_CATS.has(t) && svc.has(fitStem(t))))];
};
function fitEvidence(keyword, topics, ctx) {
  const o = ctx || {};
  const T = fitTopicWords(topics);
  const anchors = fitServiceAnchors(keyword, o.services || []);
  const t = T.size ? fitTopic(keyword, topics, { ...o, topic_min_words: 1 }) : { ok: false, share: null, detail: '' };
  if (t.ok && t.share != null) return { verdict: 'in', share: t.share, words: T.size, detail: t.detail, basis: 'topics' };
  if (anchors.length) {
    // the share again, with the declared category word counted as the keyword's own and as matched
    const toks = fitTokens(keyword);
    const own = toks.filter(x => x.length > 2 && !FIT_GEO.has(x) && !FIT_GENERIC.has(x) && !FIT_BUYER.has(x) && !/^\d+$/.test(x));
    const PH = fitTopicPhrases(topics), known = [...T];
    const stemHit = (s, x) => x === s || (x.length >= 5 && s.length >= 5 && (s.indexOf(x) === 0 || x.indexOf(s) === 0));
    const ownStems = own.map(fitStem), allStems = toks.filter(x => x.length > 2 && !FIT_GEO.has(x)).map(fitStem);
    const viaName = (w) => { const s = fitStem(w); return PH.some(ph => !ph.prose && ph.dist.some(x => stemHit(s, x)) && (ph.dist.every(x => ownStems.some(k => stemHit(k, x))) || ph.words.filter(x => allStems.some(k => stemHit(k, x))).length >= 2)); };
    const hit = (w) => FIT_COMMON.has(w) ? viaName(w) : (T.has(fitStem(w)) || known.some(x => stemHit(fitStem(w), x)));
    const hits = own.filter(hit).length + anchors.length, all = own.length + anchors.length;
    const share = Math.round(100 * hits / all) / 100;
    const bar = typeof o.topic_bar === 'number' ? o.topic_bar : FIT_TOPIC_BAR;
    if (share >= bar) return { verdict: 'in', share, words: T.size, basis: 'declared service', anchors,
      detail: '"' + anchors.join('", "') + '" is one of the services you listed' + (own.length ? ' (' + Math.round(share * 100) + '% of its own words match)' : '') };
  }
  if (!T.size) return { verdict: 'unknown', share: null, words: 0, detail: 'nothing is on file yet about what this website sells or which keywords you chose' };
  if (T.size >= 12) return { verdict: 'out', share: t.share == null ? null : t.share, words: T.size, detail: t.detail };
  return { verdict: 'unknown', share: t.share == null ? null : t.share, words: T.size, detail: 'too little is on file about what this website sells to tell whether this keyword is part of it' };
}
// ---- E-GATE (2026-10-21, pre-launch run RV-11): a search made by people looking for WORK or TRAINING, read from its results page ----
// The job-search rule (4b) reads the keyword's own words only, so it refused "ai consultant jobs" and "ai consultant salary" and let "ai
// consultant" through: research labelled it commercial, "buyers comparing providers", Easy, and it became the client's ladder head, while its
// results page was ae.indeed.com, usaii.org (a certification course) and upwork, and the questions people also ask were "What is AI
// consulting's salary?" and "How do I become an AI consultant?". fitCareer reads three kinds of evidence a caller may have:
//   pages   - the top results ({ domain, url, title } or domains): job boards, salary sites and course / certification sites, or a page whose
//             address or title is a job listing or a course;
//   paa     - the "people also ask" questions: pay, jobs, careers, becoming one, courses, certification;
//   related - the research pool: of the searches that contain all of this keyword's own words, the share that are about jobs, pay or courses.
// Points: 3+ such pages 1.5, 2 pages 1, 1 page 0.5; 2+ questions 1, one 0.5; related 40%+ of 4+ variants 1. A career search needs 1.5, so
// one kind of evidence alone is never enough unless the results page itself is mostly job and course pages. A keyword with a product or
// buyer word ("ai consulting services uae", "hire an ai consultant", "recruitment software") is never one. A site whose own short topics
// (a service name, a chosen keyword; never prose) are recruitment keeps its job searches, one that sells training keeps its course searches.
const FIT_JOB_HOSTS = /(^|\.)(naukrigulf|naukri|indeed|glassdoor|bayt|monster|monstergulf|foundit|gulftalent|ziprecruiter|jooble|careerjet|simplyhired|wellfound|laimoon|drjobpro|jobsdb|jobstreet|seek|reed|totaljobs|careerbuilder|dice|payscale|salary|salaryexplorer|ambitionbox|talent|adzuna|jobrapido|levels)\.[a-z.]+$/;
const FIT_COURSE_HOSTS = /(^|\.)(coursera|udemy|edx|simplilearn|udacity|usaii|iabac|greatlearning|mygreatlearning|upgrad|datacamp|skillshare|futurelearn|pluralsight|classcentral|emeritus|edureka|intellipaat|knowledgehut|careerfoundry|springboard|codecademy|alison)\.[a-z.]+$/;
const FIT_JOB_PATH = /\/(jobs?|careers?|vacanc[a-z]*|salar[a-z]*)(\/|$|-|\?)/i, FIT_COURSE_PATH = /\/(courses?|certifications?|learning)(\/|$|-|\?)/i;
const FIT_JOB_TITLE = /\b(jobs?|vacanc(y|ies)|hiring now|salar(y|ies))\b/i, FIT_COURSE_TITLE = /\b(courses?|certification|certificate program(me)?|program fee|bootcamp|diploma|degree)\b/i;
const FIT_JOB_Q = /\b(salary|salaries|earn|earns|earning|become|becoming|jobs?|careers?|qualifications?)\b/i, FIT_COURSE_Q = /\b(courses?|certifications?|degree|study)\b/i;
const FIT_JOB_KW = /\b(jobs?|careers?|vacanc(y|ies)|salary|salaries|internships?|cv|resume|become|becoming)\b/, FIT_COURSE_KW = /\b(courses?|certifications?|degree|diploma)\b/;
const FIT_BUYER_KW = /\b(services?|company|companies|firms?|agency|agencies|provider|providers|vendor|vendors|partners?|hire|cost|costs|price|prices|pricing|quote|quotes|outsourc\w*)\b/;
function fitCareer(keyword, o) {
  o = o || {};
  const kw = fitLow(keyword).replace(/\s+/g, ' ').trim();
  const none = (why) => ({ career: false, points: 0, signals: [], detail: '', why });
  if (!kw) return none('no keyword');
  if (FIT_PRODUCT.test(' ' + kw + ' ') || FIT_BUYER_KW.test(' ' + kw + ' ')) return none('it carries a product or buyer word');
  const T = fitTopicWords((Array.isArray(o.topics) ? o.topics : [o.topics]).filter(t => t && fitTokens(t).length <= 6));
  const sellsJobs = [...T].some(w => /^(recruit|staff|hiring|headhunt|talent|job|career)/.test(w)), sellsCourses = [...T].some(w => /^(train|cours|educat|academ|certif|tutor)/.test(w));
  if (sellsJobs && sellsCourses) return none('this website sells recruitment and training');
  const isJob = (p) => !sellsJobs && (FIT_JOB_HOSTS.test(p.domain) || FIT_JOB_PATH.test(p.path) || FIT_JOB_TITLE.test(p.title));
  const isCourse = (p) => !sellsCourses && (FIT_COURSE_HOSTS.test(p.domain) || FIT_COURSE_PATH.test(p.path) || FIT_COURSE_TITLE.test(p.title));
  const pages = (o.pages || []).map(p => typeof p === 'string' ? { domain: p, url: '', title: '' } : (p || {}))
    .map(p => ({ domain: fitHost(p.domain || p.url || ''), path: String(p.url || '').replace(/^https?:\/\/[^/]+/i, ''), title: String(p.title || '') })).filter(p => p.domain).slice(0, 10);
  const careerDom = [...new Set(pages.filter(p => isJob(p) || isCourse(p)).map(p => p.domain))];
  const qs = [...new Set((o.paa || []).map(q => String(q || '').trim()).filter(q => q && ((!sellsJobs && FIT_JOB_Q.test(q)) || (!sellsCourses && FIT_COURSE_Q.test(q)))))];
  const own = fitTokens(kw).filter(t => !FIT_GEO.has(t));
  const variants = [...new Set((o.related || []).map(r => fitLow(typeof r === 'string' ? r : (r || {}).keyword).replace(/\s+/g, ' ').trim()))]
    .filter(r => r && r !== kw && own.length && own.every(t => fitTokens(r).includes(t)));
  const careerVar = variants.filter(r => (!sellsJobs && FIT_JOB_KW.test(' ' + r + ' ')) || (!sellsCourses && FIT_COURSE_KW.test(' ' + r + ' ')));
  const pp = careerDom.length >= 3 ? 1.5 : careerDom.length === 2 ? 1 : careerDom.length === 1 ? 0.5 : 0;
  const qp = qs.length >= 2 ? 1 : qs.length === 1 ? 0.5 : 0;
  const rp = variants.length >= 4 && careerVar.length / variants.length >= 0.4 ? 1 : 0;
  const points = pp + qp + rp;
  const signals = [];
  if (careerDom.length) signals.push('job, salary or course pages rank for it (' + careerDom.slice(0, 4).join(', ') + ')');
  if (qs.length) signals.push('the questions people also ask are about pay, jobs or training ("' + qs[0].replace(/["\u201c\u201d]/g, '') + '")');
  if (rp) signals.push(careerVar.length + ' of the ' + variants.length + ' related searches are about jobs, pay or courses');
  if (points < 1.5) return { career: false, points, signals, detail: '', why: 'not enough evidence' };
  return { career: true, points, signals, why: '',
    detail: 'people searching it are mostly looking for work or training, not for a provider: ' + signals.join('; ') };
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
  // F-KW (2026-10-20, finding 5): only a DISTINCTIVE label is a brand. On an exact-match domain the label is made of the very words the client
  //    sells ("erp-software.ae" -> "erpsoftware"), and "erp software uae" was refused as the site's own brand (fitOwnLabels above).
  for (const l of fitOwnLabels(ctx.own_domain, toks, protect)) if (toks.includes(l) || squashed.includes(l)) return { ok: false, reason: 'own brand', detail: 'names the website itself (' + l + ')' };
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
  // 4c. the same, read from the keyword's results page when the caller has it (E-GATE RV-11: ctx.career = { pages, paa, related })
  if (ctx.career && typeof ctx.career === 'object') { const c = fitCareer(kw, { ...ctx.career, topics: ctx.career.topics || ctx.topics || [] }); if (c.career) return { ok: false, reason: 'job search', detail: c.detail, career: c }; }
  // 5. another company's brand. A declared competitor's label counts anywhere in the keyword; a results-page label (often a dictionary word:
  //    facts.ae) only where a product name sits — first, or right before a category word ("facts erp", "best facts erp"; not "erp facts and figures")
  const rescue = partnerWord || compareWord;
  const leads = (l) => { const i = toks.indexOf(l); return i === 0 || (i > 0 && i + 1 < toks.length && (FIT_GENERIC.has(toks[i + 1]) || protect.includes(toks[i + 1]))); };
  for (const d of (ctx.competitors || [])) for (const l of fitLabels(d, protect)) if ((toks.includes(l) || squashed.includes(l)) && !compareWord) return { ok: false, reason: 'other brand', detail: 'names a competitor: ' + l + ' (' + fitHost(d) + ')' };
  for (const d of (ctx.serp_domains || [])) for (const l of fitLabels(d, protect)) if (toks.includes(l) && leads(l) && !rescue) return { ok: false, reason: 'other brand', detail: 'names another company on the results page: ' + l + ' (' + fitHost(d) + ')' };
  // E-GATE (2026-10-21, pre-launch run RV-7): a learned name counts only through its DISTINCTIVE words. "Microsoft UAE" (seo_cache ai_brands:)
  // lost "microsoft" as a generic word and kept "uae", so every "... uae" keyword without a partner word ("ai for finance operations uae", "erp
  // software uae") was refused as "a brand of Microsoft UAE" in research, ladders, AI Growth and the pulse. Place, generic, category and common
  // words and numbers are never a brand's own part; a name with nothing else left is ignored here, so a stored bad name is harmless on read.
  for (const [name, d] of Object.entries(ctx.brands || {})) {
    const nt = fitTokens(name).filter(t => !FIT_GENERIC.has(t) && !FIT_GEO.has(t) && !FIT_WIDE.has(t) && !FIT_CATEGORY.has(t) && !FIT_COMMON.has(t) && !FIT_BUYER.has(t)
      && !/^\d+$/.test(t) && !protect.includes(t));
    if (!nt.length || !nt.some(t => t.length >= 3) || rescue) continue;
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
  // F-KW (2026-10-20, finding 10): plain sentences, and no claim about WHEN the row was planned: a row written after the gate existed (its
  // results page changed, a competitor was declared later) is set aside by the same rule, and "planned before this rule existed" was false for it
  if (live) return { ok: true, live: true, flagged: true, reason: g.reason, detail: g.detail,
    note: why + '. Its page is already written, so it stays tracked; decide whether to keep it.' };
  return { ok: false, live: false, flagged: true, reason: g.reason, detail: g.detail,
    note: why + '. It is set aside, so no page is written for it.' };
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
      + ' not ' + String(what || 'used') + ': ' + a.slice(0, 6).map(x => '"' + x.keyword + '" (' + (x.detail || x.reason) + ')').join('; ')
      + (a.length > 6 ? ' (and ' + (a.length - 6) + ' more)' : '')
      + '. A page that is already written is kept and only flagged.';
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
      + ' (measured by comparing the two stored readings; ' + ch.labels_basis + (ch.noise ? '; ' + ch.noise.text : '') + ')' + (ch.outlier ? '; ' + ch.outlier.text : '') + '.';   // C-4
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
  // ---- C-4 (re-rating 2026-10-17): ONE OUTLIER READING IS NOT THE BASELINE ----
  // "e invoicing in uae: the whole results page moved: 9 of the top 9 places changed since the reading of 2026-10-16, 9 new pages came in"
  // - today's top ten was IDENTICAL to the readings of 2026-10-15 19:48 and 2026-10-16 00:33; the one compared against (2026-10-16 19:58,
  // the same request) was a different page. The baseline is still the newest earlier reading, unless that reading is a one-off: it differs
  // from this reading by half the page or more, while an older reading (up to 3 back, within 21 days) matches this one (under a fifth of
  // the places changed) and differed from the newest by half or more. Then the older, agreeing reading is the baseline and the one-off is
  // named with its figures. A change is never computed against a reading the readings around it contradict.
  const stableReading = (rows, o) => {
    const q = o || {}; const kw = kwKey(q.keyword), dom = bare(q.domain); const before = S(q.before || '9999');
    const since = new Date(Date.parse(before.slice(0, 4) === '9999' ? new Date().toISOString() : before) - (Number(q.days) || 21) * 864e5).toISOString();
    const fallback = prevReading(rows, q);
    const cands = (rows || []).filter(h => h && isDesk(h) && kwKey(h.keyword) === kw && (!dom || bare(h.domain) === dom) && S(h.checked_at) && S(h.checked_at) < before
      && S(h.checked_at) >= since && h.position !== '' && h.position != null && Number(h.position) >= 0 && snapOf(h.snapshot_json))
      .sort((a, b) => S(b.checked_at).localeCompare(S(a.checked_at))).slice(0, Number(q.max) || 3);
    const latest = fallback && cands.length && S(cands[0].checked_at) === S(fallback.checked_at) ? cands[0] : null;
    if (!latest || cands.length < 2 || !snapOf(q.cur)) return { row: fallback, outlier: null };
    const c0 = churn(latest.snapshot_json, q.cur, {});
    if (!c0.available || c0.changed_pct < CHURN.high_pct) return { row: latest, outlier: null };
    for (const older of cands.slice(1)) {
      const co = churn(older.snapshot_json, q.cur, {}), cl = churn(older.snapshot_json, latest.snapshot_json, {});
      if (co.available && cl.available && co.changed_pct < CHURN.still_pct && cl.changed_pct >= CHURN.high_pct) {
        const at = (x) => S(x).slice(0, 16).replace('T', ' ');
        return { row: older, outlier: { at: S(latest.checked_at), changed: c0.changed, depth: c0.depth, vs_older: cl.changed, older_at: S(older.checked_at), older_changed: co.changed,
          text: 'the reading of ' + at(latest.checked_at) + ' UTC was a one-off: it differed from this reading in ' + c0.changed + ' of the top ' + c0.depth + ' places and from the reading before it in ' + cl.changed
            + ', while this reading matches the reading of ' + at(older.checked_at) + ' UTC (' + co.changed + ' changed) - so movement is measured against that one' } };
      }
    }
    return { row: latest, outlier: null };
  };
  // the label beside a "N of top M changed" figure, in words, each one defined in the report's footer (BAND_TERMS)
  const BAND_WORD = { high: 'most of the page moved', some: 'part of the page moved', still: 'barely moved', noise: 'within noise' };
  const BAND_TERMS = 'Labels: "most of the page moved" = half the places or more changed occupant; "part of the page moved" = a fifth or more; "barely moved" = less; '
    + '"within noise" = no more places changed than in two readings of the same page taken minutes apart, so it is not called movement at all';
  const bandWord = (b) => BAND_WORD[S(b)] || S(b);
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
    featureLine, featureChips, churn, churnNone, churnText, moveNote, bare, hostOf, isOurs, listOf, weight, urlKey, serpHosts, prevReading, stableReading, bandWord, BAND_TERMS, noise, withNoise };
})();
// Shared cost kit (G23 + the estimate recalibration, 2026-10-13; FIX_PLAN G23, RESULTS §0b / §2.10).
//
// Two things were wrong with the money this engine reports.
//
// 1. **Claude's cost was a range, not a number.** Three Opus nodes stream (`streaming: true`, required above ~21k tokens because the
//    Anthropic SDK's 10-minute rule: `calculateNonstreamingTimeout` throws above 128000 * 10/60 = 21,333), and n8n records only
//    `tokenUsageEstimate` for them — which a Code node cannot read either, nor can it read the real `tokenUsage` of the non-streaming
//    nodes, because usage rides the `ai_languageModel` connection and the data proxy only ever reads `main`. The re-rating could put
//    Claude's spend no closer than "$1.6-3.0", and `seo_run_ledger.settled_usd` stored the per-mode *reservation* while every reader took
//    it for a measured cost. CC.callCost / CC.runCost price every Claude call from what the run really knows — the characters the prompt
//    actually interpolates, the characters the node answered with, and the thinking budget of its effort level — and every figure they
//    return carries `estimated: true` and a one-line basis. Nothing measured is ever folded into an estimate without saying so.
//
// 2. **The per-mode estimates were far from the money**, which is why the guard refused five customer runs that would have cost a
//    fraction of what it reserved (RESULTS §0b: `ai_visibility` reserved $0.06 and cost $0.79; backlinks $0.04 for $0.37; the full report
//    $0.25 for $0.41; the written page reserved $1.23 and cost about $0.46). CC.pick resolves one request to its estimate, and CC.readCal
//    / CC.calRow make that estimate **self-correcting**: when a run settles, the mode's rolling figure in `seo_cache` (`cost:<kind>:<mode>`)
//    moves toward what that run cost, and the estimate the guard then uses is `max(rolling x CC.HEADROOM, the recent maximum)` — so an
//    estimate can fall as a mode gets cheaper but can **never** sit below what the mode has actually cost recently. The shipped tables
//    stay the fallback for a mode with no history, and CC.CAP stops one freak run from locking the guard.
//
// 3. **The monthly reconciliation.** The character-based figure is an estimate, so it needs a reality check the engine cannot do by
//    itself: once a month the owner downloads the Anthropic Console usage export and `reconcile_claude_cost.py` compares it with the
//    month's ledger rows per model, then writes one correction factor per model family into `seo_cache` (`cost:factor:claude`).
//    CC.readCal picks those factors up and CC.callCost applies them, so the next month's estimates are already corrected.
//
// 4. **B-A8 / B-A5 (2026-10-15, build section 62).** Two of those figures stopped being estimates. The free Anthropic token counter now
//    counts the exact prompt and the exact answer of the three streaming Opus nodes on the main path, where a Code node can read them
//    (CC.countUsage, section 0b below), so only the thinking those calls did is still modelled; and every settle takes a second free
//    `appendix/user_data` reading so a run that was ALONE in flight is costed from the account itself (CC.dfsRun, section 5c).
//
// Used by: Rate Limit and Run Ledger Row (the guard), the five report builders' run ledger, Run Ledger Settle, Cost Calibration Row,
// the monitors' ledger settle, reconcile_claude_cost.py and harness scenarios S60 and S72.
const CC = (() => {
  // Anthropic list prices per MILLION tokens (the baseline the re-rating priced its token counts at). A model we do not know is priced
  // at the dearest one we use: an unknown model must never make a run look cheaper than it is.
  const PRICES = {
    'claude-opus-5-5': { in: 4, out: 20 }, 'claude-opus-5': { in: 4, out: 20 },
    'claude-sonnet-5-5': { in: 2, out: 10 }, 'claude-sonnet-5': { in: 2, out: 10 },
    'claude-haiku-4-5-20251001': { in: 1, out: 5 }, 'claude-haiku-4-5': { in: 1, out: 5 },
  };
  const UNKNOWN = { in: 4, out: 20 };
  // English prose and the JSON the prompts interpolate both sit near 3.7 characters a token for Claude's tokeniser; a lower figure would
  // flatter the estimate, so this is the conservative end of what the live runs showed.
  const CHARS_PER_TOKEN = 3.7;
  // adaptive thinking spends part of maxTokensToSample before the answer, and it counts as OUTPUT tokens (CLAUDE.md: thinking tokens count
  // against maxTokensToSample). Share of the budget by effort, from the three Opus nodes of exec 521 (27,365 in / 16,426 out reported as
  // `tokenUsageEstimate` against ~11k tokens of real answer).
  const THINK_SHARE = { low: 0.05, medium: 0.1, high: 0.2 };
  // B-8 / A-27 (re-rating 2026-10-17): that budget share is right for nothing we can check. On the NON-streaming adaptive-thinking
  // nodes n8n records the real `tokenUsage`, whose output count INCLUDES the thinking (Anthropic bills thinking as output), and on
  // execs 760 / 764 / 765 / 767 / 770 it exceeded the counted answer by about 50 tokens a call (Content Reviewer 2,258 vs 2,208;
  // 3,959 vs 3,909; 1,535 vs 1,484) — while the budget share added 1,638-3,277 per node and put the ledger 19-31% above n8n. Adaptive
  // thinking at low / medium effort mostly does not think on these tasks. So a non-streaming call is modelled at the thinking it was
  // SEEN to do, a little above the measured gap; only a streaming call (where n8n reports no usage, so nothing can check it) keeps the
  // budget share, and its basis says so.
  const THINK_SEEN = 64;
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const r4 = (v) => +n0(v).toFixed(4);
  const family = (model) => {
    const m = String(model || '').toLowerCase();
    return /opus/.test(m) ? 'opus' : /sonnet/.test(m) ? 'sonnet' : /haiku/.test(m) ? 'haiku' : 'other';
  };
  const priceOf = (model) => PRICES[String(model || '')] || PRICES[String(model || '').replace(/-\d{8}$/, '')] || UNKNOWN;
  const tokensOf = (chars) => Math.ceil(n0(chars) / CHARS_PER_TOKEN);

  // ---- 0b. B-A8 (2026-10-15): the tokens Anthropic itself counted -------------------------------------------------------------
  // Everything below used to be an estimate, because nothing a Code node can reach reports token usage. That was checked against the
  // running instance on 2026-10-15 rather than assumed, and the three places it dies are:
  //   * `@langchain/anthropic` 1.5.6 `_generate`: for a STREAMING call it returns `{ generations: [{ text, message }] }` with **no
  //     `llmOutput`** at all — the usage Anthropic sends on `message_delta` survives only on `message.usage_metadata`;
  //   * n8n's `LmChatAnthropic` reads `result?.llmOutput?.usage`, finds nothing and falls back to `{input_tokens: 0, output_tokens: 0}`,
  //     so `N8nLlmTracing` records `tokenUsageEstimate` (a tiktoken guess) instead of `tokenUsage`;
  //   * and even for the NON-streaming nodes, where n8n does record real `tokenUsage`, it lands on the model node's `ai_languageModel`
  //     connection — and `WorkflowDataProxy` only ever reads `taskData.data.main`, so `$('Claude - Critic')` throws "No data found from
  //     `main` input". No Code node in any workflow can read a single reported token.
  // So the measurement has to arrive on the main path, and it does: *Count Prompt (…)* / *Count Answer (…)* ask Anthropic's **free**
  // `/v1/messages/count_tokens` endpoint to count the exact prompt the run rendered and that prompt plus the exact answer it got back.
  // `counted` carries the two answers; the difference is the answer's own tokens, counted by the same tokeniser that bills them.
  // What a counter cannot see is the THINKING the model did before answering: those tokens are billed as output and are never returned.
  // They stay modelled from the node's effort budget and are the only part of such a call that is still an estimate — Rule 1: a figure
  // is measured and says what measured it, modelled and says from what, or not available and says why.
  const COUNTER = 'Anthropic /v1/messages/count_tokens';
  const countUsage = (c) => {
    const o = (c || {}).counted;
    if (!o || typeof o !== 'object') return null;
    const p = Math.round(n0(o.prompt_tokens)), t = Math.round(n0(o.total_tokens));
    if (!(p > 0) || !(t > p)) return null;          // one of the two probes did not answer: nothing usable, fall back and say so
    return { in_tokens: p, out_tokens: t - p, source: String(o.source || COUNTER) };
  };

  // ---- 1. one Claude call ----------------------------------------------------------------------------------------------------
  // `call`: { node, model, prompt_chars, output_chars, max_tokens, effort, streaming, calls, usage, counted }
  // Three ways to price it, best first, and the answer always says which one it used:
  //   `usage`    — reported token usage (promptTokens / completionTokens). Whole call MEASURED, characters ignored. n8n never hands
  //                this to a Code node today (see above), but a call that ever does report it must never be replaced by an estimate.
  //   `counted`  — B-A8 / B-F1: { prompt_tokens, total_tokens, rounds } from the free token counter — the TOTAL it answered with and
  //                how many of this node's calls that total covers. Input and answer are MEASURED; only the thinking budget stays
  //                modelled, and only that part lands in `estimated_usd`.
  //   characters — the fallback, everything estimated, exactly as before.
  const callCost = (call, factors) => {
    const c = call || {}, f = factors || {};
    const model = String(c.model || ''), fam = family(model), price = priceOf(model);
    const factor = n0(f[fam]) > 0 ? Number(f[fam]) : 1;
    const calls = Math.max(1, Math.round(n0(c.calls) || 1));
    const u = c.usage && (n0(c.usage.promptTokens) || n0(c.usage.completionTokens)) ? c.usage : null;
    let cnt = u ? null : countUsage(c);
    // R47 / R69 / R80 (2026-10-16, re-rating 2026-10-15): the counter was sent `String(output)`, so every STRUCTURED answer reached it as
    // the 15 characters "[object Object]" and came back as 4-6 answer tokens labelled "measured" — 16 agents, 15-67% low. The builders
    // now send the answer as the model wrote it (JSON for a parsed object); this is the net under that fix. A count that saw far fewer
    // answer tokens than the answer's own characters can hold (under a quarter of the characters-a-token figure, on an answer of more
    // than 200 characters a call) did not see the answer, so it is not a measurement: the call falls back to characters and says why.
    let unseen = '';
    if (cnt) {
      const cov = Math.max(1, Math.round(n0((c.counted || {}).rounds) || 1));
      const perChars = n0(c.output_chars) / cov, perCounted = cnt.out_tokens / cov;
      if (perChars > 200 && perCounted < (perChars / CHARS_PER_TOKEN) * 0.25) {
        unseen = 'the token counter answered for ' + cnt.out_tokens + ' answer token(s) where the answer holds ' + Math.round(n0(c.output_chars))
          + ' characters, so it did not see the answer and is not used';
        cnt = null;
      }
    }
    // R57 (2026-10-16): an agent that n8n re-ran after a failed answer (a parser that refused the format; `retryOnFail`) called its model
    // twice and kept one answer. `retries` is how many extra model runs the model node itself recorded; they are in `calls` and priced
    // as repeats of the call the run can see.
    const retries = Math.max(0, Math.round(n0(c.retries)));
    // how many of this node's `calls` the two counts actually cover, and what ONE of those calls cost in tokens.
    // B-F1 (2026-10-15, build section 76): `counted` carries the TOTAL the counter answered with and `rounds` says how many calls
    // that total covers, because a node may answer once per item — the keyword screen runs once per chunk of 80 candidates, so its
    // counter chain fires once per chunk and the chunks are summed. With one call the two readings are the same number, which is
    // why every figure section 62 measured is unchanged. The Editor still runs once per QA round with only the LAST round on the
    // main path, so the rest are REPEATED from it and stay modelled, not measured.
    const covers = cnt ? Math.max(1, Math.round(n0((c.counted || {}).rounds) || 1)) : 0;
    const rounds = cnt ? Math.min(calls, covers) : 0;
    const perIn = cnt ? cnt.in_tokens / covers : 0, perOut = cnt ? cnt.out_tokens / covers : 0;
    const seenThink = !!c.effort && !c.streaming;   // B-8 / A-27: a non-streaming call is modelled at the thinking it was seen to do
    const budget = !c.effort ? 0 : seenThink ? THINK_SEEN * calls : Math.round(n0(c.max_tokens) * (THINK_SHARE[String(c.effort)] || 0)) * calls;
    const think = u ? 0 : budget;
    const inTok = u ? n0(u.promptTokens) : cnt ? Math.round(perIn * calls) : tokensOf(c.prompt_chars) * calls;
    const outTok = u ? n0(u.completionTokens) : (cnt ? Math.round(perOut * calls) : tokensOf(c.output_chars) * calls) + think;
    const price1 = (i, o) => r4((n0(i) / 1e6) * price.in * factor + (n0(o) / 1e6) * price.out * factor);
    const usd = price1(inTok, outTok);
    // which half of THIS call is a measurement. A reported usage measures everything; a counted call measures the rounds the counter
    // saw, minus the thinking it cannot see; a character-priced call measures nothing.
    const measured_usd = u ? usd : cnt ? price1(Math.round(perIn * rounds), Math.round(perOut * rounds)) : 0;
    const estimated_usd = r4(usd - measured_usd);
    const retried = retries > 0 ? '; ' + retries + ' of the ' + calls + ' model call(s) were a retry after a failed answer (n8n asked again), priced as a repeat' : '';
    return { node: String(c.node || ''), model, family: fam, calls, retries, in_tokens: inTok, out_tokens: outTok, think_tokens: think,
      usd, measured_usd, estimated_usd, measured: !!(u || cnt) && estimated_usd <= 0,
      counted: !!cnt, counted_rounds: rounds, counter: cnt ? cnt.source : '', streaming: !!c.streaming, factor, count_unseen: !!unseen,
      basis: u ? 'measured: the token usage this call reported' + retried
        : cnt ? 'measured: ' + cnt.source + ' counted ' + cnt.in_tokens + ' prompt and ' + cnt.out_tokens + ' answer token(s)'
            + (covers > 1 ? ' across ' + covers + ' call(s)' : '')
            + (calls > rounds ? ', repeated for the ' + (calls - rounds) + ' round(s) the counter did not see' : '')
            + (think > 0 ? '; the ' + think + ' thinking token(s) it cannot see are modelled ' + (seenThink
              ? 'at the ' + THINK_SEEN + ' a call n8n\'s reported output was seen to exceed the counted answer by (2026-10-17)'
              : 'from the ' + String(c.effort) + ' effort budget') : '')
            + retried
            + (estimated_usd > 0 ? ' ($' + estimated_usd.toFixed(4) + ' of $' + usd.toFixed(4) + ' is modelled)' : '')
        : 'estimated: prompt and answer characters at ' + CHARS_PER_TOKEN + ' characters a token'
            + (think > 0 ? ' plus the thinking budget' : '') + retried + (unseen ? '; ' + unseen : '') };
  };

  // ---- 2. one run's Claude cost ---------------------------------------------------------------------------------------------
  // Measured and estimated money are kept apart and both are reported; `estimated` is true as soon as one cent of it is an estimate.
  // B-A8 (2026-10-15): the split is now taken PER CALL, not per call-bucket. A node whose tokens Anthropic counted contributes its
  // prompt and answer to `measured_usd` and only its modelled thinking budget to `estimated_usd` — before this, one estimated cent
  // anywhere in a call threw the whole call's money into the estimated half.
  const runCost = (calls, factors) => {
    const out = { usd: 0, measured_usd: 0, estimated_usd: 0, estimated: false, calls: 0, in_tokens: 0, out_tokens: 0,
      by_node: {}, models: {}, streaming_nodes: [], counted_nodes: [], think_usd: 0, basis: '' };
    const charNodes = [];
    for (const c of (calls || [])) {
      const r = callCost(c, factors);
      if (!r.usd && !r.calls) continue;
      out.usd = r4(out.usd + r.usd);
      out.measured_usd = r4(out.measured_usd + r.measured_usd);
      out.estimated_usd = r4(out.estimated_usd + r.estimated_usd);
      out.calls += r.calls; out.in_tokens += r.in_tokens; out.out_tokens += r.out_tokens;
      if (r.node) out.by_node[r.node] = { usd: r.usd, model: r.model, in_tokens: r.in_tokens, out_tokens: r.out_tokens,
        measured_usd: r.measured_usd, estimated_usd: r.estimated_usd, estimated: !r.measured, counted: r.counted, basis: r.basis };
      out.models[r.family] = r4((out.models[r.family] || 0) + r.usd);
      if (r.counted) { if (r.node) out.counted_nodes.push(r.node); out.think_usd = r4(out.think_usd + r.estimated_usd); }
      else if (r.measured_usd <= 0 && r.node) charNodes.push(r.node);
      // "reports no token usage" is only true of a streaming node nothing measured; a counted one reports its tokens through the counter
      if (r.streaming && !r.counted && !r.measured && r.node) out.streaming_nodes.push(r.node);
    }
    out.estimated = out.estimated_usd > 0;
    out.measured_share = out.usd > 0 ? +((out.measured_usd / out.usd) * 100).toFixed(1) : null;
    const counted = out.counted_nodes.length
      ? '; $' + out.measured_usd.toFixed(4) + ' of it is measured — ' + COUNTER + ' counted the prompt and the answer of '
        + out.counted_nodes.length + ' node(s) (' + out.counted_nodes.join(', ') + ')'
        + (out.think_usd > 0 ? ' and only their $' + out.think_usd.toFixed(4) + ' of thinking is modelled from the effort budget' : '')
      : '';
    out.basis = out.estimated
      ? (charNodes.length || !out.counted_nodes.length
          ? 'estimated: prompt and answer characters at ' + CHARS_PER_TOKEN + ' characters a token plus the thinking budget, at the Anthropic list prices'
            + (out.streaming_nodes.length ? ' (' + out.streaming_nodes.length + ' streaming node(s) report no token usage: ' + out.streaming_nodes.join(', ') + ')' : '')
            + (counted ? counted : (out.measured_usd > 0 ? '; $' + out.measured_usd.toFixed(4) + ' of it is measured token usage' : ''))
          : 'measured: ' + COUNTER + ' counted the prompt and the answer of every call (' + out.counted_nodes.join(', ')
            + '); the $' + out.think_usd.toFixed(4) + ' of thinking no counter can see is modelled from the effort budget')
      : out.usd > 0 ? 'measured: reported token usage at the Anthropic list prices' : 'no Claude call ran';
    return out;
  };

  // ---- 3. the per-mode estimates the guard reserves -------------------------------------------------------------------------
  // Shipped defaults, recalibrated on 2026-10-13 from the measured runs of docs/system-review-2026-10-13/RESULTS.md (both passes).
  // `ai` = Claude money, `dfs` = DataForSEO money. Every value is ABOVE the measured figure beside it and never below it.
  const EST = {               // measured Claude cost of that run →
    content: 0.8,             // 0.587 (exec 521; $0.438 of it the three Opus streaming nodes) — was 1.20
    report: 0.16,             // 0.105 (exec 519, the follow-up keyword report) — was 0.30
    verdict: 0.16,            // 0.108 (exec 486) — was 0.20
    discover: 0.24,           // 0.165 (exec 518) — was 0.35
    ladder: 0.18,             // 0.115 (exec 495) — was 0.55
    full: 0.08,               // 0.049 (exec 523) — was 0.25
    site_audit: 0,            // 0     (execs 497 / 513: an audit calls no model)
    describe: 0.03,           // 0.012 (exec 485)
    ai_visibility: 0.14,      // 0.095 (exec 526) — was 0.06, the worst of the five refusals
    backlinks: 0.06,          // 0     this run; the Link Analyst does run on a full check — was 0.04
    track: 0, published: 0, checkin: 0, profile: 0, case_study: 0,   // these spawn the work that costs; each spawn reserves its own row
  };
  const DFS_EST = {           // measured DataForSEO cost of that run →
    crawl: 0.09,              // 0.09   (execs 497 and 513, both exactly)
    full: 0.55,               // 0.4094 (exec 523) — was 1.00, set before D7 stopped the report paying for WHOIS
    content: 0.04,            // 0.0221 (exec 521) — was 0.08
    verdict: 0.04,            // 0.0221 (exec 486) — was 0.06
    report: 0.04,             // 0.0221 (exec 519)
    discover: 0.34,           // 0.2552 (exec 518) — was 0.15, below the money
    ladder: 0.21,             // 0.1162 (exec 495) + 24 results-page calls at $0.002 = 0.1642 — was 0.16 before B2-4 (2026-10-15)
    ai_visibility: 0.95,      // 0.7946 (exec 526) — was 0.60, below the money
    backlinks: 0.5,           // 0.3727 (execs 528 / 529)
    assess: 0.034,            // 0.0254 per check (execs 487-489, $0.0761 for three) — was 0.024, below the money
  };
  const ALPHA = 0.3;          // how fast the rolling figure follows the last settle
  const HEADROOM = 1.25;      // the guard reserves a quarter more than the rolling figure
  const KEEP = 8;             // the recent window whose maximum the estimate may never fall below
  const CAP = 5;              // and never more than five times the shipped default: one freak run may not lock the guard
  const calKey = (kind, mode) => 'cost:' + kind + ':' + mode;
  const FACTOR_KEY = 'cost:factor:claude';
  const MODEL_PREFIX = 'cost:model:';   // one row per model family: what this engine thinks it spent on it THIS month

  // which estimate keys a request uses. One source for Rate Limit, Run Ledger Row, Run Ledger Settle and the reconciliation.
  const keysFor = (kind, d) => {
    const r = d || {}, m = String(r.mode || '');
    if (kind === 'ai') {
      const k = m === 'site_description' ? ['describe']
        : m === 'audit' ? [r.include_full_report ? 'full' : 'site_audit']
        : m === 'discover' ? ['discover']
        : m === 'keyword' ? [r.verdict_only ? 'verdict' : (r.include_content ? 'content' : 'report')]
        : m === 'backlinks' ? (r.free_only ? [] : ['backlinks'])
        : (m && EST[m] !== undefined) ? [m] : [];
      // R101 (2026-10-16, re-rating D-5): a describe run keeps `need_site_description` on (Use Cached Description leaves it set for
      // `site_description`), so its estimate was describe + describe ($0.06 for a $0.03 mode). The extra key is for OTHER modes only.
      if (r.need_site_description && !k.includes('describe')) k.push('describe');
      return k;
    }
    return m === 'audit' ? (r.include_full_report ? ['full'] : ['crawl'])
      : m === 'discover' ? (r.include_full_report ? ['discover', 'full'] : ['discover'])
      : m === 'keyword' ? [r.verdict_only ? 'verdict' : (r.include_content ? 'content' : 'report')]
      : m === 'backlinks' ? (r.free_only ? [] : ['backlinks'])
      : (m && DFS_EST[m] !== undefined) ? [m] : [];
  };

  // the stored rows of seo_cache (kind 'cost') as one object: a stat per mode per kind, plus the reconciliation's model factors
  const readCal = (rows) => {
    const cal = { ai: {}, dfs: {}, models: {}, factors: {}, factor_note: '', rows: 0 };
    for (const row of (rows || [])) {
      const key = String((row || {}).key || '');
      let v = {}; try { v = JSON.parse(String(row.value || '{}')) || {}; } catch (e) { v = {}; }
      if (key.indexOf(MODEL_PREFIX) === 0) {
        cal.models[key.slice(MODEL_PREFIX.length)] = { month: String(v.month || ''), usd: n0(v.usd), runs: n0(v.runs), updated_at: String(v.updated_at || '') };
        cal.rows++;
        continue;
      }
      if (key === FACTOR_KEY) {
        for (const f of ['opus', 'sonnet', 'haiku', 'other']) if (n0(v[f]) > 0) cal.factors[f] = Number(v[f]);
        cal.factor_note = String(v.note || v.month || '');
        cal.rows++;
        continue;
      }
      const m = key.match(/^cost:(ai|dfs):(.+)$/);
      if (!m) continue;
      cal[m[1]][m[2]] = { mean: n0(v.mean), max: n0(v.max), last: n0(v.last), n: n0(v.n),
        recent: (Array.isArray(v.recent) ? v.recent : []).map(n0), measured: !!v.measured, updated_at: String(v.updated_at || row.updated_at || '') };
      cal.rows++;
    }
    return cal;
  };

  // the estimate for ONE key: the shipped default until the mode has history, then the rolling figure with headroom, and never below
  // what the mode cost in its last CC.KEEP settles.
  const estOf = (kind, key, cal) => {
    const def = n0((kind === 'ai' ? EST : DFS_EST)[key]);
    const st = ((cal || {})[kind] || {})[key];
    if (!st || !st.n) return { usd: def, source: 'default', floor: 0, def };
    // the floor is what the mode has actually cost in its last CC.KEEP settles and is absolute: an estimate may never sit below it.
    // CC.CAP bounds only the rolling part, so a runaway average cannot lock the guard while a genuinely dearer mode still reserves
    // what it costs.
    const recentMax = Math.max(n0(st.max), ...(st.recent || []).map(n0));
    const rolling = +(n0(st.mean) * HEADROOM).toFixed(4);
    const capped = def > 0 ? Math.min(rolling, def * CAP) : rolling;
    return { usd: r4(Math.max(capped, recentMax)), source: 'calibrated', floor: r4(recentMax), def, n: st.n };
  };

  // B-9: how many 200-page plain crawls an audit's crawl is. DataForSEO on-page charges per crawled page, and a page rendered with
  // JavaScript costs 4x (exec 739: $0.36 quoted for 200 pages against $0.09). Pages default to 200, as Normalize Input does.
  const CRAWL_BASE_PAGES = 200, CRAWL_JS_MULT = 4;
  const crawlFactor = (d) => { const r = d || {}; const pages = n0(r.crawl_max_pages) > 0 ? n0(r.crawl_max_pages) : CRAWL_BASE_PAGES;
    const js = r.crawl_js === true || /^(true|yes|1)$/i.test(String(r.crawl_js || ''));
    return +((pages / CRAWL_BASE_PAGES) * (js ? CRAWL_JS_MULT : 1)).toFixed(4); };

  // one request -> what it reserves. `room` is the extra the case-study intake holds back for the page run it spawns.
  const pick = (kind, d, cal) => {
    const keys = keysFor(kind, d);
    let usd = 0, source = 'default', floor = 0;
    // B-9 (re-rating 2026-10-17): the crawl figure is one 200-page plain crawl, whatever the request asked for. Exec 739 asked for a
    // JavaScript crawl ($0.36 quoted for 200 pages, 4x the plain one) and was told $0.11. An audit's crawl is now scaled by the pages it
    // may crawl and by JavaScript (CC.crawlFactor) — the same formula as the app's app/shared/src/cost.ts `crawlFactor`.
    const cf = (kind === 'dfs' && String((d || {}).mode) === 'audit') ? crawlFactor(d) : 1;
    for (const k of keys) { const e = estOf(kind, k, cal); usd += e.usd; floor += e.floor; if (e.source === 'calibrated') source = 'calibrated';
      if (cf !== 1 && k === 'crawl') usd += e.usd * (cf - 1);
      if (cf !== 1 && k === 'full') usd += n0(DFS_EST.crawl) * (cf - 1); }
    const room = (kind === 'ai' && String((d || {}).mode) === 'case_study') ? estOf('ai', 'content', cal).usd : 0;
    // `key` is the PRIMARY estimate key and the one the rolling figure is stored under, so what a settle teaches is read back by the next
    // run of the same shape; `label` names every key the request used (a run that also needs a site description adds `describe`, which
    // only makes that mode's figure a shade conservative — the safe direction).
    return { usd: r4(usd), keys, key: keys[0] || '', label: keys.join('+'), source, floor: r4(floor), room: r4(room),
      crawl_factor: cf,
      basis: (keys.length ? (source === 'calibrated' ? 'calibrated from this mode\'s last settled runs (never below $' + r4(floor).toFixed(4) + ', what it recently cost)' : 'the shipped estimate for ' + keys.join(' + ') + ' (no settled run of this mode yet)') : 'this mode spends nothing here')
        + (cf !== 1 ? '; the crawl scaled x' + cf + ' (up to ' + (n0((d || {}).crawl_max_pages) || CRAWL_BASE_PAGES) + ' pages'
          + (crawlFactor({ crawl_max_pages: CRAWL_BASE_PAGES, crawl_js: (d || {}).crawl_js }) > 1 ? ', rendered with JavaScript at 4x a page' : '') + ')' : '') };
  };

  // what a settle writes back: the rolling figure moves toward this run's amount, the recent window keeps the floor honest.
  const calStat = (prev, amount, measured) => {
    const a = r4(amount), p = prev && n0(prev.n) ? prev : null;
    const recent = [...((p && p.recent) || []), a].slice(-KEEP);
    return { n: (p ? n0(p.n) : 0) + 1, last: a, mean: r4(p ? n0(p.mean) + ALPHA * (a - n0(p.mean)) : a),
      max: r4(Math.max(p ? n0(p.max) : 0, a)), recent, measured: !!measured, updated_at: new Date().toISOString() };
  };
  // the exact seo_cache row (columns key / kind / site_id / value / updated_at)
  const calRow = (kind, mode, amount, cal, measured) => {
    const stat = calStat(((cal || {})[kind] || {})[mode], amount, measured);
    return { key: calKey(kind, mode), kind: 'cost', site_id: '', value: JSON.stringify(stat), updated_at: stat.updated_at };
  };

  // what the engine thinks it spent on one model family this month, so reconcile_claude_cost.py has something to compare the owner's
  // Anthropic Console export WITH. The figure resets when the month turns; nothing but this engine's own estimates goes into it.
  const monthRow = (family, usd, prev, month) => {
    const same = prev && String(prev.month || '') === String(month);
    const v = { month: String(month), usd: r4((same ? n0(prev.usd) : 0) + n0(usd)), runs: (same ? n0(prev.runs) : 0) + 1,
      estimated: true, updated_at: new Date().toISOString() };
    return { key: MODEL_PREFIX + family, kind: 'cost', site_id: '', value: JSON.stringify(v), updated_at: v.updated_at };
  };

  // ---- 4. the honest split a settled row carries ---------------------------------------------------------------------------
  // Each side is { usd, measured, basis } and may carry its own `measured_usd` when part of it IS reported usage (a content run
  // measures its Sonnet calls and can only estimate its three streaming Opus ones). Nothing is ever rounded into the wrong half.
  const part = (x) => {
    const o = x || {}, usd = r4(o.usd);
    const m = r4(Math.min(usd, o.measured_usd != null ? n0(o.measured_usd) : (o.measured ? usd : 0)));
    return { usd, measured_usd: m, estimated_usd: r4(usd - m) };
  };
  // R31 (2026-10-14): "nothing spent" carries its reason when there is one — a free run has to say WHY it settles nothing, or the row
  // reads exactly like a run whose figure was never computed.
  const word = (p, basis) => p.usd <= 0 ? 'nothing spent' + (basis ? ' (' + basis + ')' : '')
    : p.estimated_usd <= 0 ? 'measured'
    : p.measured_usd <= 0 ? 'ESTIMATED (' + (basis || 'per-mode estimate') + ')'
    : 'PARTLY ESTIMATED: $' + p.measured_usd.toFixed(4) + ' measured, $' + p.estimated_usd.toFixed(4) + ' estimated (' + (basis || 'per-mode estimate') + ')';
  // the one line a settled ledger row carries, so nobody reads an estimate as a measured cost
  const costBasis = (ai, dfs) => {
    const a = part(ai), d = part(dfs);
    return ('Claude $' + a.usd.toFixed(4) + ' ' + word(a, (ai || {}).basis)
      + '; DataForSEO $' + d.usd.toFixed(4) + ' ' + word(d, (dfs || {}).basis)).slice(0, 500);
  };
  const split = (ai, dfs) => {
    const a = part(ai), d = part(dfs);
    return { measured_usd: r4(a.measured_usd + d.measured_usd), estimated_usd: r4(a.estimated_usd + d.estimated_usd),
      cost_basis: costBasis(ai, dfs) };
  };

  // ---- 5. the DataForSEO money: each task once, and the day checked against the account ------------------------------------
  // R28 (2026-10-14, FIX_PLAN §3.12; RESULTS §0): the engine's own "measured" DataForSEO figures did not reconcile with the balance —
  // window C moved $0.0520 while the runs in it reported $0.0900 (+73%), window A $0.5506 against $0.6145 (+11.6%). Two causes, both here.
  //
  // (a) **A task was counted on every answer about it.** DataForSEO bills a crawl when the task is CREATED and then repeats the same
  //     `tasks[].cost` in every later answer about that task, so a polled on_page task was charged again on every poll. `dfsAdd` counts a
  //     task on its first sighting, by its own id, and keeps the repeats visible rather than silently dropping them.
  const dfsLedger = () => {
    const seen = new Set();
    const st = { usd: 0, tasks: 0, repeated: 0, no_id: 0 };
    // one DataForSEO answer: adds what has not been counted yet and returns that amount
    const add = (j) => {
      let c = 0;
      const ts = j && Array.isArray(j.tasks) ? j.tasks : null;
      if (ts) {
        for (const t of ts) {
          const cost = n0(t && t.cost); if (!cost) continue;
          const id = String((t && t.id) || '');
          if (!id) { st.no_id++; c += cost; continue; }   // nothing identifies it: counted, and said so
          if (seen.has(id)) { st.repeated++; continue; }
          seen.add(id); st.tasks++; c += cost;
        }
      } else if (j && n0(j.cost)) { c += n0(j.cost); }
      st.usd = r4(st.usd + c);
      return r4(c);
    };
    return { add, state: st, seen };
  };

  // (a2) R32 (2026-10-14, FIX_PLAN §3.13): **a crawl was settled at the price it was QUOTED, labelled "measured".** Audit 588 settled
  //      `dfs_usd 0.09 measured` — what DataForSEO quotes when an on_page task is created for the **200 pages it was asked for** — while
  //      47 were crawled and the account fell $0.031950 (+181%). DataForSEO bills a crawl for the work it does and never reports that
  //      final amount per task (every later answer repeats the creation quote), so the run cannot measure it. What the run does know is
  //      the quote, the pages it asked for and the pages the crawl reported: the figure is priced pro rata from those and is labelled an
  //      ESTIMATE with all three numbers in its basis. Nothing here is ever called measured.
  const crawlCost = (c) => {
    const o = c || {};
    const quoted = r4(o.quoted), req = Math.round(n0(o.pages_requested)), got = Math.round(n0(o.pages_crawled));
    const out = { applies: false, usd: quoted, quoted, pages_requested: req, pages_crawled: got, per_page: 0, estimated: false, basis: '' };
    if (quoted <= 0) { out.usd = 0; out.basis = 'no crawl was billed in this run'; return out; }
    out.applies = true; out.estimated = true;
    if (!(req > 0) || o.pages_crawled == null || !Number.isFinite(Number(o.pages_crawled))) {
      out.pages_crawled = null;
      out.basis = 'the crawl was quoted $' + quoted.toFixed(4) + ' when the task was created and never reported how many pages it crawled, '
        + 'so the quote stands and is an ESTIMATE (DataForSEO bills a crawl for the pages it does, not for the pages it was asked for)';
      return out;
    }
    const capped = Math.max(0, Math.min(got, req));
    out.pages_crawled = capped;
    out.per_page = +(quoted / req).toFixed(6);
    out.usd = r4(quoted * (capped / req));
    out.basis = 'the crawl was quoted $' + quoted.toFixed(4) + ' for the ' + req + ' pages it asked for and crawled ' + capped
      + ', so it is priced at $' + out.usd.toFixed(4) + ' ($' + out.per_page + ' a page) — ESTIMATED: DataForSEO bills a crawl for the pages '
      + 'it does and reports only the quote (audit 588 settled the $0.0900 quote as measured while the account fell $0.0320)';
    return out;
  };

  // ---- 5b. the Claude money a run settles: what it priced, nothing at all, or the reservation (and it says which) -------------------
  // R31 / R33 (2026-10-14, FIX_PLAN §3.13): a settle used to take the per-mode RESERVATION whenever the branch carried no priced figure —
  // so a `free_only` backlink run that called no model at all settled $0.05 while telling the caller $0, and `describe` settled the $0.06
  // it reserved where its own Haiku node reported 4,874 / 1,306 tokens ($0.0114). A reservation is a guard; a settlement is a measurement.
  // `ran` is the model nodes of THIS execution that produced items, `checked` how many the workflow has: when a workflow has model nodes
  // and none of them ran, the run spent nothing on Claude and settles nothing.
  const aiRun = (o) => {
    const x = o || {}, fig = x.figure || null, reserved = r4(x.reserved);
    const ran = (x.ran || []).map(String).filter(Boolean);
    const checked = Math.max(Math.round(n0(x.checked)), ran.length);
    // a priced figure wins: calls it counted are calls that happened, whatever the node-by-node sweep could see
    if (fig && n0(fig.calls) > 0) return { usd: r4(fig.usd), measured: fig.estimated === false, measured_usd: r4(fig.measured_usd),
      source: 'priced', ran, checked, basis: String(fig.basis || '') };
    // R82 (2026-10-16, re-rating C-6): a workflow that HAS no Claude node (the AI Pulse, the Rank Tracker) settled its per-mode Claude
    // reservation ($0.004 a day for the pulse) because the rule below only fired when the workflow had model nodes. `checked: 0`, said
    // explicitly by a caller that looked, is a measurement too: nothing can have been spent on Claude.
    if (x.checked != null && Math.round(n0(x.checked)) === 0 && !ran.length) return { usd: 0, measured: true, measured_usd: 0, source: 'none',
      ran, checked: 0, basis: 'this workflow has no Claude node, so no model call can have run'
        + (reserved > 0 ? ' and nothing is settled against the $' + reserved.toFixed(4) + ' it reserved' : '') };
    if (checked > 0 && !ran.length) return { usd: 0, measured: true, measured_usd: 0, source: 'none', ran, checked,
      basis: 'no model call ran in this run (all ' + checked + ' Claude node(s) of this workflow were checked)'
        + (reserved > 0 ? ', so nothing is settled against the $' + reserved.toFixed(4) + ' it reserved' : '') };
    return { usd: reserved, measured: false, measured_usd: 0, source: 'reserved', ran, checked,
      basis: 'the per-mode reservation: ' + (ran.length
        ? ran.length + ' model node(s) ran (' + ran.slice(0, 4).join(', ') + ') and this branch prices no call of its own'
        : 'this branch priced no model call of its own') };
  };

  // (b) **Nothing checked the sum against the money.** Every reservation now records the free `appendix/user_data` balance reading
  //     (seo_run_ledger.dfs_balance), so the day's reported spend can be held against the only measurement that cannot be argued with:
  //     how far the account actually fell between the day's first reading and the latest one. `rows` are the day's ledger rows,
  //     `mine` is this run's own reserved row (its reading is the latest). Nothing is corrected automatically — the engine says so.
  const RECONCILE_TOLERANCE = 0.1;    // 10% of the move, or 2 cents, whichever is larger: DataForSEO rounds to 4 decimals per task
  const RECONCILE_FLOOR = 0.02;
  const dfsDay = (rows, mine) => {
    const me = mine || {};
    const day = String(me.created_at || '').slice(0, 10);
    const read = (rows || []).filter(r => r && String(r.created_at || '').slice(0, 10) === day && n0(r.dfs_balance) > 0)
      .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    const mineBalance = n0(me.dfs_balance);
    const from = read[0] || null;
    const to = mineBalance > 0 ? { created_at: String(me.created_at || ''), dfs_balance: mineBalance } : (read.length > 1 ? read[read.length - 1] : null);
    const out = { comparable: false, day, readings: read.length + (mineBalance > 0 && (!read.length || read[read.length - 1].created_at !== me.created_at) ? 1 : 0),
      from: from ? String(from.created_at) : '', to: to ? String(to.created_at) : '',
      balance_usd: 0, engine_usd: 0, diff_usd: 0, diff_pct: null, within: true, basis: '' };
    if (!from || !to || String(from.created_at) >= String(to.created_at)) {
      out.basis = read.length ? 'the day has only one balance reading so far, so nothing can be compared yet'
        : 'no balance reading for the day (appendix/user_data was not answered), so the figures are the engine\'s own sums only';
      return out;
    }
    // what the engine says the runs between the two readings cost, settled rows only (a reserved row has spent nothing yet)
    const between = (rows || []).filter(r => r && String(r.status || '') === 'done'
      && String(r.created_at || '') >= String(from.created_at) && String(r.created_at || '') < String(to.created_at));
    out.engine_usd = r4(between.reduce((s, r) => s + n0(r.dfs_usd), 0));
    out.balance_usd = r4(Math.max(0, n0(from.dfs_balance) - n0(to.dfs_balance)));
    out.diff_usd = r4(out.engine_usd - out.balance_usd);
    out.diff_pct = out.balance_usd > 0 ? +((out.diff_usd / out.balance_usd) * 100).toFixed(1) : null;
    out.within = Math.abs(out.diff_usd) <= Math.max(RECONCILE_FLOOR, out.balance_usd * RECONCILE_TOLERANCE);
    out.comparable = true;
    out.settled_rows = between.length;
    out.basis = 'the account fell $' + out.balance_usd.toFixed(4) + ' between ' + out.from.slice(11, 19) + ' and ' + out.to.slice(11, 19)
      + ' while ' + between.length + ' settled run(s) report $' + out.engine_usd.toFixed(4)
      + (out.within ? ' — they agree' : ' — they do NOT agree ($' + out.diff_usd.toFixed(4) + (out.diff_pct == null ? '' : ', ' + out.diff_pct + '%') + '); the account is the figure to believe');
    return out;
  };

  // (c) B-A5 (2026-10-15): **only the DAY was reconciled, never the run.** `dfsDay` holds the day's settled rows against how far the
  //     account fell, which is the right check for the day and says nothing about any single run: a run could be out by 100% and the
  //     day still agree. A run CAN be measured against the account, but only when it was alone — so every settle takes a second free
  //     `appendix/user_data` reading and this decides whether the move between the two readings belongs to this run.
  //     A row was OPEN during this run's window when it was reserved before this run settled and had not already settled before this
  //     run reserved. If any was, the account's move is shared and this run keeps the cost its own tasks reported — and says so.
  //     Nothing here ever invents a figure: when the account cannot settle the question (a reading missing, the account not moved, or
  //     moved far more than every task reported, which means something outside this engine spends on the same account) it says which.
  const RUN_OVERSPEND = 10;       // the account moved more than ten times what every task reported: not this run's money
  const dfsRun = (o) => {
    const x = o || {}, mine = x.mine || {};
    const start = n0(mine.dfs_balance), end = n0(x.end_balance);
    const from = String(mine.created_at || ''), to = String(x.settled_at || '');
    const engine = r4(x.engine_usd);
    const out = { attributed: false, alone: false, comparable: false, usd: 0, engine_usd: engine, account_usd: 0,
      diff_usd: 0, diff_pct: null, within: true, overlapped: [], overlapped_n: 0, from, to,
      start_balance: +start.toFixed(6), end_balance: +end.toFixed(6), source: 'tasks', basis: '' };
    const mineId = String(mine.run_id || '');
    // R81 parts 2-3 (2026-10-16, re-rating C-5): the request that STARTED this run is not another run. A monitor started by the main
    // workflow's front door names that run in its own key (`parent:<id>`, Monitor_Ledger_Row / R77); the parent spends nothing itself and
    // settles $0 as a hand-off (`dfs_source: handoff`, R81 part 1), so neither its row nor any hand-off row can share this run's money.
    const mineKey = String(mine.key || '');
    const parentId = mineKey.indexOf('parent:') === 0 ? mineKey.slice(7).trim() : String(x.parent_run_id || '').trim();
    // when a row CLOSED. A settled row stamps `settled_at`; a refused or released row was closed when it was marked (its `settled_at`
    // when the refusal stamped one); and a `done` row with no stamp (the Keyword Check settled without one until 2026-10-16, and old
    // rows never had the column) closed when the table last wrote it (`updatedAt`) — or, failing that, when it was reserved. A row
    // with no end at all was "open for ever", which named finished runs as "in flight" all day (598, 599, 600, 624).
    const closedAt = (r) => String(r.settled_at || r.updatedAt || r.updated_at || r.created_at || '');
    // every other row that was open while this run was in flight
    const open = (x.rows || []).filter((r) => {
      if (!r || !r.run_id || r.error || String(r.run_id) === mineId) return false;
      if (String(r.dfs_source || '') === 'handoff' || (parentId && String(r.run_id) === parentId)) return false;
      const c = String(r.created_at || '');
      if (!c || (to && c >= to)) return false;                       // reserved after this run had already settled
      const st = String(r.status || '');
      if (st === 'reserved' || st === '') return true;               // still reserved: it was open the whole time
      const s = closedAt(r);
      return !from || s > from;                                      // closed, but only after this run reserved: it overlapped
    });
    out.overlapped = open.map((r) => String(r.run_id)).slice(0, 20);
    out.overlapped_n = open.length;
    if (!(start > 0) || !(end > 0) || !from || !to || from >= to) {
      out.basis = 'the account was not read at both ends of this run' + (start > 0 ? ' (no reading when it settled)' : ' (no reading when it reserved)')
        + ', so its DataForSEO figure is the cost its own tasks reported';
      return out;
    }
    out.comparable = true;
    out.account_usd = r4(Math.max(0, start - end));
    if (open.length) {
      out.basis = open.length + ' other run(s) were in flight at the same time (' + out.overlapped.slice(0, 4).join(', ')
        + '), so the $' + out.account_usd.toFixed(4) + ' the account moved is shared and cannot be attributed to this run; '
        + 'its figure stays the $' + engine.toFixed(4) + ' its own tasks reported';
      return out;
    }
    out.alone = true;
    // a run that sent no paid task cannot have moved the account, however alone it was: whatever moved it came from somewhere else
    // (the owner's own probe, another tool on the same account). Attributing it here would invent a cost out of thin air.
    if (x.calls != null && Math.round(n0(x.calls)) <= 0) {
      out.basis = 'this run sent no paid DataForSEO task, so the $' + out.account_usd.toFixed(4) + ' the account moved while it ran is '
        + 'not its money — nothing is attributed to it';
      return out;
    }
    if (out.account_usd <= 0) {
      out.basis = 'this run was the only one in flight but the account had not moved when it settled (DataForSEO posts a charge a '
        + 'moment later), so its figure stays the $' + engine.toFixed(4) + ' its own tasks reported';
      return out;
    }
    if (engine > 0 && out.account_usd > Math.max(0.5, engine * RUN_OVERSPEND)) {
      out.basis = 'this run was the only one of ours in flight, but the account fell $' + out.account_usd.toFixed(4)
        + ' against the $' + engine.toFixed(4) + ' its tasks reported — something outside this engine is spending on the same account, '
        + 'so nothing is attributed to this run and the gap is reported instead';
      return out;
    }
    out.attributed = true;
    out.source = 'account';
    out.usd = out.account_usd;
    out.diff_usd = r4(engine - out.account_usd);
    out.diff_pct = out.account_usd > 0 ? +((out.diff_usd / out.account_usd) * 100).toFixed(1) : null;
    out.within = Math.abs(out.diff_usd) <= Math.max(RECONCILE_FLOOR, out.account_usd * RECONCILE_TOLERANCE);
    out.basis = 'measured against the account: this run was the only one in flight between ' + from.slice(11, 19) + ' and '
      + to.slice(11, 19) + ', and the balance fell $' + out.account_usd.toFixed(4) + ' — its own tasks report $' + engine.toFixed(4)
      + (out.within ? ', which agrees' : ' ($' + out.diff_usd.toFixed(4) + (out.diff_pct == null ? '' : ', ' + out.diff_pct + '%')
        + ' out); the account is the figure to believe');
    return out;
  };

  return { PRICES, UNKNOWN, CHARS_PER_TOKEN, THINK_SHARE, THINK_SEEN, crawlFactor, CRAWL_BASE_PAGES, CRAWL_JS_MULT, EST, DFS_EST, ALPHA, HEADROOM, KEEP, CAP, FACTOR_KEY, MODEL_PREFIX,
    RECONCILE_TOLERANCE, RECONCILE_FLOOR, RUN_OVERSPEND, COUNTER, countUsage, dfsLedger, dfsDay, dfsRun, crawlCost, aiRun,
    family, priceOf, tokensOf, callCost, runCost, keysFor, readCal, estOf, pick, calKey, calStat, calRow, monthRow, part, costBasis, split };
})();
const CONFIG = { default_pages_per_week: 1, max_pages_per_week: 3, skip_recent_days: 90, striking_min_impressions: 30, striking_min_position: 4, striking_max_position: 20, publish_reminder_days: 7, upcoming: 4,
  max_active: 2, max_waiting: 3, waiting_days: 120, gate_head_position: 30, won_checks: 4, won_position: 3, suggestions: 5,
  // B4-3 (2026-10-15, benchmark area 4): at most this many refreshes of decaying pages offered in one week, and the days a page
  // is left alone after any refresh before it can be queued again (Semrush's own content-audit guide says to wait at least two
  // months before judging a refresh: https://www.semrush.com/blog/content-audit/)
  decay_per_week: 2, decay_refresh_days: 60,
  // R-K7: a run outside a cycle (on demand, the old weekly schedule) counts the pages started in the last 6 days as this week's
  cycle_window_days: 6, in_flight_hours: 2,
  // F-KW: a ladder planned longer ago than this is checked again before its first page (cycles.ts QUEUED_RECHECK_DAYS); a cycle is 7 days
  recheck_days: 60, cycle_days: 7 };
// ---- the contract (app/shared/src/cycles.ts): levels, the sources each level writes on its own, the item key ----
const LEVELS = [1, 2, 3], DEFAULT_LEVEL = 2;
const AUTO_SOURCES = { 1: ['ladder'], 2: ['ladder', 'decay', 'striking', 'ai_refresh'], 3: ['ladder', 'decay', 'striking', 'ai_refresh', 'trend', 'ai_answer'] };
const CLIENT_CHOSEN = new Set(['', 'client_typed', 'client_picked']);   // '' = neither the settings row nor the ladder's own rows name a chooser: a ladder from before chosen_by existed (chooserOf)
const cycleNorm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();   // cycles.ts cycleNorm / itemKey, character for character
let trigger = {}; try { const t = $('Manual Run').first(); trigger = (t && t.json) || {}; } catch (e) {}
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const norm = cycleNorm;
const lc = (v) => String(v == null ? '' : v).toLowerCase().trim();
const sites = rowsOf('Load Sites').filter(r => r.site_id && r.domain), cad = rowsOf('Load Cadence').filter(r => r.site_id), ladders = rowsOf('Load Ladders').filter(r => r.ladder_id && r.keyword), qh = rowsOf('Load Query History'), trends = rowsOf('Load Trends'), logs = rowsOf('Load Content Log').filter(r => r.keyword);
const settings = rowsOf('Load Ladder Settings').filter(r => r.ladder_id);
// P1: the websites' business profiles (seo_profiles, written by "Set up my business profile"): the author fields the readiness rule reads
const profileRows = rowsOf('Load Profiles (Cadence)').filter(r => r.site_id || r.domain);
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
// keyword-first: the client's decisions on the "Coming up" plan (seo_skips, written by the app) and the engine's own cost calibration
const skipRows = rowsOf('Load Skips (Cadence)').filter(r => r.site_id && r.item_key != null && String(r.item_key) !== '' && r.decision);
// F-KW (R-K7): the content-cadence jobs of earlier cycles (seo_cycle_jobs, written by the dispatcher): when the previous cadence really ran
const cycleJobRows = rowsOf('Load Cycle Jobs (Cadence)').filter(r => r.site_id && String(r.job || '') === 'content_cadence');
const cal = CC.readCal(rowsOf('Load Cost (Cadence)').filter(r => r.key));
const CONTENT_REQ = { mode: 'keyword', include_content: true };   // what every pick is: a content run (Rate Limit prices it the same way)
const estAi = CC.pick('ai', CONTENT_REQ, cal), estDfs = CC.pick('dfs', CONTENT_REQ, cal);
const EST_PAGE_USD = +(estAi.usd + estDfs.usd).toFixed(4);
const est_basis = 'a content run: Claude ' + estAi.basis + '; DataForSEO ' + estDfs.basis;
const aiQuotaOf = (siteId) => { const m = monitors.find(x => x.site_id === siteId) || {}; const on = (v) => !(v === false || /^(false|0|no|off)$/i.test(String(v == null ? '' : v))); if (!on(m.ai_visibility) || !on(m.ai_growth)) return 0; return m.ai_pages_month === '' || m.ai_pages_month == null || !Number.isFinite(Number(m.ai_pages_month)) ? 2 : Math.min(8, Math.max(0, Math.round(Number(m.ai_pages_month)))); };
const cadOf = new Map(cad.map(c => [c.site_id, c]));
// ---- who is asking: the Cycle Dispatcher (trigger 'cycle', one site, scheduled semantics), an on-demand caller (one site), or the batch ----
const isCycle = lc(trigger.trigger) === 'cycle';
// F-KW (finding 9): ANY `preview: true` is a preview and writes nothing, with or without `trigger: 'cycle'` (it used to run for real without it)
const preview = trigger.preview === true || lc(trigger.preview) === 'true' || (isCycle && lc(trigger.job) === 'preview');
const want = normD(trigger.domain) || String(trigger.site_id || '').trim(); const scoped = !!want; const on_demand = scoped && !isCycle;
const dry_run = !!trigger.dry_run || preview;   // a preview writes nothing: every writer downstream drops a dry-run item as well
const force = on_demand && !preview && (trigger.force === true || lc(trigger.force) === 'true');
const cycle_key = isCycle ? String(trigger.cycle_key || '').trim() : '';
const cycle_date = (cycle_key.match(/(\d{4}-\d{2}-\d{2})$/) || [])[1] || '';
const scheduled_for = isCycle ? String(trigger.scheduled_for || '') : '';
// the cycle run's own request id (plan §14.2: cyc_<site>_<YYYYMMDD>_<job>, from the dispatcher): the id of this run's note / status / preview
// callback, so the app files it under the cycle. The pages it starts keep their own cad_ ids (each is a run of its own; R-K7 counts them by it).
// The fields read from the Manual Run input for a cycle: trigger, domain | site_id, cycle_key, scheduled_for, preview | job, request_id.
const cycle_request_id = isCycle ? String(trigger.request_id || '').trim().slice(0, 120) : '';
const now = new Date(); const nowIso = now.toISOString(); const week = cycle_date || nowIso.slice(0, 10);
const schedT = Date.parse(scheduled_for);
// F-KW (finding 3a): the clock the plan is judged at. A preview runs 48 h before the cycle and must show what the cycle will write THEN: every
// time window below (the month of the AI allowance, an AI page this week, recent keywords, the decay / refresh windows, the pile-up window,
// in-flight runs) is read at the cycle's due time. A real run reads the wall clock.
const at = preview && Number.isFinite(schedT) ? new Date(schedT) : now; const atIso = at.toISOString();
// R-K7: where this cycle's budget starts — the cycle run's own due time, or (outside a cycle) the last six days
const windowStart = isCycle && Number.isFinite(schedT) ? schedT : Number(now) - CONFIG.cycle_window_days * 864e5;
const trigger_kind = isCycle ? 'cycle' : on_demand ? 'on_demand' : 'schedule';
const byDomain = new Map(); for (const s of sites) { const d = normD(s.domain); if (d && !byDomain.has(d)) byDomain.set(d, { ...s, domain: d }); }
for (const s of byDomain.values()) { if (s.email && s.callback_url) continue; const l = ladders.find(l => normD(l.domain) === s.domain && (l.email || l.callback_url)); if (l) { s.email = s.email || l.email || ''; s.callback_url = s.callback_url || l.callback_url || ''; } }
let list = [...byDomain.values()];
if (scoped) list = list.filter(s => s.domain === want || s.site_id === want);
// a paused site: the batch leaves it out; a cycle run of it is refused with the reason (its preview still tells the app why); on demand it runs
const pausedSites = isCycle ? list.filter(s => String(s.status || 'active') === 'paused') : [];
if (!on_demand) list = list.filter(s => String(s.status || 'active') !== 'paused');
const byRung = (a, b) => (Number(a.rung) || 0) - (Number(b.rung) || 0) || (Number(a.page_no) || 0) - (Number(b.page_no) || 0);
const isTop = (l) => Number(l.rung) === 4;
const posInt = (v, d, max) => { const n = Number(v); return (v !== '' && v != null && Number.isFinite(n) && n >= 1) ? Math.min(max, Math.floor(n)) : d; };
const levelOf = (row) => { const n = Number((row || {}).autopilot_level); return LEVELS.includes(n) ? n : DEFAULT_LEVEL; };
const settingOf = new Map(settings.filter(r => String(r.ladder_id) !== '_site').map(r => [String(r.ladder_id), r]));
const STATUSES = ['active', 'queued', 'paused', 'won', 'stuck', 'archived'];
const out = [];
// the one shape a "Coming up" item and a suggestion take (CyclePreviewItem in cycles.ts)
const itemOf = (p, auto) => ({ item_key: cycleNorm(p.keyword), keyword: p.keyword, source: p.source, page_type: p.page_type || '', existing_page_url: p.existing_page_url || '',
  ladder_id: p.ladder_id || '', rung: Number(p.rung) || 0, why: p.why || '', auto: !!auto, est_usd: EST_PAGE_USD, ai_target: p.ai_target || null,
  ...(p.target_id ? { target_id: p.target_id } : {}), ...(p.approved ? { approved: true } : {}), ...(p.chosen_by != null && p.source === 'ladder' ? { chosen_by: p.chosen_by } : {}) });
for (const s of pausedSites) {
  if (preview) out.push({ json: { preview: true, dry_run: true, site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', country: s.country || '',
    request_id: cycle_request_id || 'prev_' + (cycle_date || week).replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, ''), cycle_key, cycle_date, scheduled_for, trigger: trigger_kind,
    level: levelOf(settings.find(r => String(r.ladder_id) === '_site' && (r.site_id === s.site_id || normD(r.domain) === s.domain))), pages_per_week: 0, waiting_for_keyword: false,
    paused_reason: 'site_paused', reason: 'the website is paused, so its next cycle writes nothing', items: [], suggestions: [], est_ai_usd: 0, est_dfs_usd: 0, est_page_usd: EST_PAGE_USD, est_basis, week } });
  else out.push({ json: { nothing_to_do: true, site_id: s.site_id, domain: s.domain, reason: 'the website ' + s.domain + ' is paused: its cycle writes nothing (resume it through Site Admin)', paused_reason: 'site_paused', cycle_key, dry_run } });
}
for (const s of list) {
  const c = cadOf.get(s.site_id);
  // pages a week: the cadence row (0-3; `off` = 0); an on-demand caller may name its own number; a cycle run never overrides the client's
  let pages = (on_demand && trigger.pages != null && trigger.pages !== '') ? Number(trigger.pages) : (c ? (String(c.status || 'active') === 'off' ? 0 : Number(c.pages_per_week)) : (on_demand ? CONFIG.default_pages_per_week : 0));
  pages = Math.min(CONFIG.max_pages_per_week, Math.max(0, pages || 0));
  const aiQuota = aiQuotaOf(s.site_id);   // AI answer / refresh pages a month: on top of the pages a week at level 3, at most one a week
  // pages_per_week bounds everything automatic: a site set to 0 gets nothing written at any level. The batch leaves it out (as before, minus
  // the AI pages it used to get); a run for this one site still reports its status, because that is what the caller asked for.
  if (!pages && !scoped) continue;
  // website defaults ('_site' row)
  const siteRow = settings.find(r => String(r.ladder_id) === '_site' && (r.site_id === s.site_id || normD(r.domain) === s.domain)) || {};
  const level = levelOf(siteRow);
  // P1: is the website ready for a written page (author profile + business facts)? Decided once per site, applied to everything written below
  const readiness = READY.of({ profile: profileRows.find(r => r.site_id === s.site_id) || profileRows.find(r => normD(r.domain) === s.domain) || {}, facts: s.business_facts });
  // `opportunities` is read only to report what was stored: it decides nothing any more (a stored `auto` means "suggest", plan §5.1 R-K3)
  const cfg = { mode: lc(siteRow.mode) === 'manual' ? 'manual' : 'auto', opportunities: lc(siteRow.opportunities) === 'manual' ? 'manual' : 'auto', max_active: posInt(siteRow.max_active, CONFIG.max_active, 20), max_waiting: posInt(siteRow.max_waiting, CONFIG.max_waiting, 100) };
  const slog = logs.filter(l => normD(l.domain) === s.domain);
  const recent = new Set(slog.filter(l => l.status === 'published' || (at - new Date(l.started_at || 0)) < CONFIG.skip_recent_days * 864e5).map(l => norm(l.keyword)));
  const publishedKw = new Set(slog.filter(l => l.published_url).map(l => norm(l.keyword)));
  const lrows = ladders.filter(l => normD(l.domain) === s.domain).sort(byRung);
  const ladderKw = new Set(lrows.map(l => norm(l.keyword)));
  for (const l of lrows) if (WAITING.LADDER_WRITTEN.has(l.status) || l.status === 'published') recent.add(norm(l.keyword));   // A-20: writing, written, not_ready
  // R16: every stored rung goes through the fit gate before it can be written. Context: the website's own domain, the competitors it
  // declared (seo_monitors / the site model) and, PROTECTED so that the ladder's own topic can never look like a brand, the ladder head
  // terms and the site's services. A rung whose page is already written or published is kept (fitStored) and only flagged.
  const monRow = monitors.find(m => m.site_id === s.site_id || normD(m.domain) === s.domain) || {};
  const fitModel = (() => { try { return SM.from(s, { monitors: monRow }); } catch (e) { return null; } })();
  const services = fitModel ? fitModel.services : [];   // the site model's services: what the Site Tracker read AND what the client declared (declared_services)
  // F-KW (finding 1): what the CLIENT said they sell, kept apart from what a crawl inferred: only these make a keyword "in topic" at levels 1-2
  const declared = fitModel && Array.isArray(fitModel.declared_services) ? fitModel.declared_services : [];
  const fitCtx = { own_domain: s.domain, brands: fitLearnedBrands(aiBrandRows.filter(r => String(r.key || '') === 'ai_brands:' + s.site_id)),
    competitors: fitModel ? fitModel.competitors : String(monRow.competitors || '').split(',').map(x => normD(x)).filter(Boolean),
    protect: [...new Set([...lrows.map(l => String(l.head_keyword || '')), ...services].filter(Boolean))] };
  // the results page the Rank Tracker stored for this very keyword (G6 `competitors_json` / `snapshot_json`, written two hours earlier on
  // the same Monday): the domains that really rank for it, in rank order — the evidence that makes "facts erp" a brand query
  // R87 / R90 (2026-10-16, re-rating 2026-10-15): ONE stored reading — the newest desktop reading of the keyword for this site within 60
  // days, whichever workflow bought it — read one entry per position (RS.serpHosts, the same rule as the Rank Tracker). The old reader merged
  // every reading the keyword ever had into one list of best positions: an October page and a September page judged as one.
  const serpFor = (kw) => { const h = RS.prevReading(allRanks, { keyword: kw, domain: s.domain, before: atIso, withSnapshot: true });
    return (h && (at - new Date(h.checked_at)) <= 60 * 864e5) ? RS.serpHosts(h, 10) : []; };
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
  // ---- F-KW (finding 9): who chose each ladder. The seo_ladder_settings row says it (the app and the ladder run write it); when it is empty
  // (a settings save that failed, or a row the ladder run back-filled), the ladder's OWN rows say it: the ladder run writes `chosen_by` on
  // every seo_ladders row before the settings row, so an announced keyword can no longer read as the client's when the second write fails.
  // Empty on both = a ladder started before the column existed (all of them were started by the client or its API), read as client_typed. ----
  const chooserOf = (id) => { const st0 = settingOf.get(String(id)); const sv = lc(st0 && st0.chosen_by); if (sv) return sv;
    return lrows.filter(l => String(l.ladder_id) === String(id)).map(l => lc(l.chosen_by)).find(Boolean) || ''; };
  const statusOfL = (id) => { const st0 = settingOf.get(String(id)); return st0 && STATUSES.includes(lc(st0.status)) ? lc(st0.status) : 'active'; };
  const ladderIds = [...new Set(lrows.map(l => String(l.ladder_id)))];
  const clientIds = new Set(ladderIds.filter(id => CLIENT_CHOSEN.has(chooserOf(id)) && statusOfL(id) !== 'archived'));
  const okIds = new Set(ladderIds.filter(id => { const c = chooserOf(id); return CLIENT_CHOSEN.has(c) || (c === 'system_announced' && level === 3); }));
  // the ladders whose subject may make a page "in topic": chosen, and not paused or archived (a paused ladder is the client saying "not now";
  // R-K2 still counts it as a choice, so the site does not fall back to "waiting for your first keyword")
  const liveTopic = (id) => !['paused', 'archived'].includes(statusOfL(id));
  const ladderTopics = (ids) => lrows.filter(l => ids.has(String(l.ladder_id)) && liveTopic(String(l.ladder_id))).flatMap(l => [String(l.head_keyword || ''), ...(isTop(l) || fitOk(l) ? [String(l.keyword || '')] : [])]);
  const cleanT = (a) => [...new Set(a.map(x => String(x || '').trim()).filter(Boolean))];
  // finding 1: levels 1-2 judge "in topic" against what the client chose; level 3 (full autopilot) also against what the site sells
  const chosenTopics = cleanT([...ladderTopics(clientIds), ...declared]);
  const fullTopics = cleanT([...chosenTopics, ...ladderTopics(okIds), ...services]);
  const evidenceTopics = level === 3 ? fullTopics : chosenTopics;
  // ---- R-K4: the gate every candidate that is NOT a ladder page passes, at every level. Topics = what the client's ladders are about (heads
  // and the rungs the gate kept) and what the site sells (the model's services, declared ones included), so "off topic" / "too broad" are
  // judged against the client's own subject. The serp is the keyword's own stored results page when the Rank Tracker read one. ----
  const topics = [...new Set([...lrows.map(l => String(l.head_keyword || '')), ...lrows.filter(fitOk).map(l => String(l.keyword || '')), ...services].map(x => String(x || '').trim()).filter(Boolean))];
  const gateCtx = { ...fitCtx, topics: topics.length ? topics : null, topic_label: 'what this website sells and the keywords you chose' };
  const refused = [];
  const gateOf = (o) => { const serp = serpFor(o.keyword);
    return fitGate(o.keyword, { ...gateCtx, serp, serp_domains: serp.filter(h => normD(h) !== s.domain) }); };
  const refuse = (o, g) => { const note = '"' + o.keyword + '" (' + o.source + ') is not a search this website should target: ' + g.detail + ' (' + g.reason + '), so it is not written and not suggested';
    const x = { ladder_id: '', keyword: o.keyword, source: o.source, reason: g.reason, detail: g.detail, note, written: false, dropped: true, ...(o.target_id ? { target_id: o.target_id } : {}) };
    set_aside.push(x); refused.push({ keyword: o.keyword, source: o.source, reason: g.reason, detail: g.detail, note, ...(o.target_id ? { target_id: o.target_id } : {}) }); };
  // "in topic": POSITIVE evidence that the keyword is about the client's own subject. F-KW (findings 1 and 2): levels 1-2 read only what the
  // client chose (their ladders and their declared services, never the crawl's services); level 3 also the crawl's services. With too few
  // topic words on file the gate above judges nothing (its "no evidence, no refusal" rule); here no evidence means no automatic page: it stays
  // a suggestion, at every level.
  // F-REH (2026-10-20): deliberately WITHOUT `services`. fitEvidence's declared-category rule ("crm" in a keyword, "CRM implementation" declared)
  // is evidence enough to rank a research suggestion or to answer the Keyword Check, where a person decides; it is not enough to WRITE a page
  // on our own ("hubspot crm free" for a CRM implementation partner, fixture level3_sparse_topics_new_topics_suggested). Automatic writing keeps
  // the topic-share evidence, exactly as the app's mirror (server/src/services/cadence.ts inTopic) judges it.
  const evidenceOf = (kw) => fitEvidence(kw, evidenceTopics, { topic_label: level === 3 ? 'what this website sells and the keywords you chose' : 'the keywords and services you chose' });
  const inTopic = (kw) => evidenceOf(kw).verdict === 'in';
  // finding 4: the website's root and its main menu pages are never rewritten on their own, at any level (a suggestion at most)
  const navKeys = new Set(((fitModel && fitModel.nav_pages) || []).map(p => String(p.url || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '')).filter(Boolean));
  const mainPage = (u) => { const k = String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, ''); if (!k) return false;
    return !/\//.test(k) || navKeys.has(k); };
  const MAIN_WHY = '; it is your homepage or a main menu page, so it is only suggested and never rewritten on its own';
  // ---- skips and approvals (seo_skips): the client's word on the "Coming up" plan ----
  const mySkips = skipRows.filter(r => r.site_id === s.site_id);
  const skipAlways = new Set(mySkips.filter(r => lc(r.decision) === 'skip' && lc(r.scope) === 'always').map(r => cycleNorm(r.item_key)));
  const skipCycle = new Set(cycle_key ? mySkips.filter(r => lc(r.decision) === 'skip' && lc(r.scope) !== 'always' && String(r.cycle_key || '') === cycle_key).map(r => cycleNorm(r.item_key)) : []);
  const approveRows = cycle_key ? mySkips.filter(r => lc(r.decision) === 'approve' && String(r.cycle_key || '') === cycle_key) : [];
  const approvedKeys = new Set(approveRows.map(r => cycleNorm(r.item_key)));
  // F-KW (finding 9): an approval is for ONE item. When the app recorded the item's source (and ladder), only that item matches; an older
  // keyword-only row matches only when one item alone has that keyword (approvalFor below), never two different pages that share it.
  const rowFits = (r, o) => cycleNorm(r.item_key) === cycleNorm(o.keyword) && (!String(r.source || '').trim() || lc(r.source) === lc(o.source))
    && (!String(r.ladder_id || '').trim() || String(r.ladder_id) === String(o.ladder_id || ''));
  const skipped = [];
  const isSkipped = (kw) => skipAlways.has(cycleNorm(kw)) || skipCycle.has(cycleNorm(kw));
  const noteSkip = (o) => { const k = cycleNorm(o.keyword); if (skipped.some(x => x.item_key === k)) return; skipped.push({ item_key: k, keyword: o.keyword, source: o.source, scope: skipAlways.has(k) ? 'always' : 'cycle' }); };
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
    const chosen_by = chooserOf(id);   // R-K1 / F-KW: the settings row, else the ladder's own rows; '' = a ladder from before the column
    const chosen_ok = okIds.has(String(id));
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
    // F-KW (finding 3b, plan §5.6): a ladder planned more than 60 days ago that has never had a page written is not written on that old plan:
    // it waits until the app's fresh Keyword Check passed (`rechecked_at` on its settings row, no older than the plan it checks and itself
    // within 60 days). A check that fell pauses the ladder (the app writes `status: paused`), so it is never written at all.
    const planned_at = Date.parse(start);
    const everWritten = rows.some(r => WAITING.LADDER_WRITTEN.has(String(r.status || '')) || (String(r.status || '') === 'published' && !(r.page_exists === true || r.page_exists === 'true')))
      || slog.some(l => String(l.ladder_id || '') === String(id) || rows.some(r => norm(r.keyword) === norm(l.keyword)));
    const recheckedT = Date.parse(String((st && st.rechecked_at) || ''));
    const recheck_due = Number.isFinite(planned_at) && (at - planned_at) > CONFIG.recheck_days * 864e5 && !everWritten
      && !(Number.isFinite(recheckedT) && recheckedT >= planned_at && (at - recheckedT) <= CONFIG.recheck_days * 864e5);
    const main_waiting = !gate_open && remaining.some(isTop) && !eligible.length;   // blocked on publishing: the gated main page is all that is left
    // R87 (2026-10-16): a ladder whose MAIN keyword is set aside — its row says `set_aside` (the Rank Tracker and *Ladder Marks* write it
    // back with the reason), or the gate refuses it now on its stored results page — is paused. Its rungs exist to climb towards that
    // keyword, so none of them is written or queued (exec 638 queued four rungs of a ladder whose head the Rank Tracker had just set aside).
    const hf = top ? fitOf.get(top) : null;
    const head_aside = top && (String(top.status || '') === 'set_aside' || (hf && hf.flagged && !hf.ok))
      ? { keyword: top.keyword, reason: String(top.status || '') === 'set_aside' ? String(top.status_note || 'its main keyword was set aside') : (hf.detail + ' (' + hf.reason + ')') } : null;
    if (head_aside) return { id, rows, top, head, mode, status, plan_type, priority, start, chosen_by, chosen_ok, head_position, won, won_checks: lastN.length, support: support.length, published, gate_open, main_waiting: false, remaining: [], eligible: [], head_aside, recheck_due: false };
    return { id, rows, top, head, mode, status, plan_type, priority, start, chosen_by, chosen_ok, head_position, won, won_checks: lastN.length, support: support.length, published, gate_open, main_waiting, remaining, eligible, recheck_due };
  }).sort((a, b) => a.priority - b.priority || String(a.start).localeCompare(String(b.start)) || String(a.id).localeCompare(String(b.id)));
  // R-K2: the ladders the client chose (any status except archived: a won ladder still tells us their topics)
  const clientLadders = info.filter(x => clientIds.has(String(x.id)));
  const waiting_for_keyword = level < 3 && !clientLadders.length;
  const writable = info.filter(x => ['active', 'queued'].includes(x.status) && !x.won);
  const autoL = writable.filter(x => x.mode === 'auto' && x.remaining.length && x.chosen_ok);
  const active = autoL.slice(0, cfg.max_active), queued = autoL.slice(cfg.max_active);
  const manualL = writable.filter(x => x.mode === 'manual');
  // R-K1: an Auto ladder whose keyword the client did not choose (system_announced below level 3, or an unknown chooser) is never written on
  // its own: its next page waits for the client's OK like a Manual ladder's, and the list says why
  const unchosenL = writable.filter(x => x.mode === 'auto' && !x.chosen_ok);
  const ladderCand = (x, l) => {
    const rows = x.rows, top = x.top; const links = [];
    if (isTop(l)) { for (const r of rows.filter(r => !isTop(r) && r.target_url).slice(0, 12)) links.push({ url: r.target_url, role: 'down', keyword: r.keyword }); }   // the top page is the hub: it lists the whole cluster (12, was 6; v4.4)
    else { if (top && top.target_url && top.keyword !== l.keyword) links.push({ url: top.target_url, role: 'top', keyword: top.keyword }); const sib = rows.find(r => Number(r.rung) === Number(l.rung) && r.keyword !== l.keyword && r.target_url); if (sib) links.push({ url: sib.target_url, role: 'sibling', keyword: sib.keyword }); }
    // R15 (2026-10-13): `target_url` is the URL this ladder planned for the page — the run keeps it as the page's slug, so the ladder's
    // link map, the other rung pages' links and the rank tracking never point at a URL that will not exist
    return { keyword: l.keyword, page_type: l.page_type || 'Service Page', existing_page_url: l.page_exists ? (l.target_url || '') : '', target_url: l.target_url || '', source: 'ladder', ladder_id: l.ladder_id, rung: Number(l.rung) || 0, page_no: Number(l.page_no) || 0, head: l.head_keyword || '', links, chosen_by: x.chosen_by, why: 'keyword ladder, rung ' + (isTop(l) ? 'top' : l.rung) + ' towards "' + (l.head_keyword || '') + '"' };
  };
  const cands = [];
  // F-KW (finding 3b): an active ladder waiting for its fresh check keeps its place (the next ladder does not jump the queue) and writes nothing
  const recheckL = active.filter(x => x.recheck_due);
  for (const x of active) { if (x.recheck_due) continue; for (const l of x.eligible) { if (isSkipped(l.keyword)) { noteSkip({ keyword: l.keyword, source: 'ladder' }); continue; } cands.push(ladderCand(x, l)); } }
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
  // Keyword-first (2026-10-19): written on its own from level 2 when in topic, else a suggestion.
  const decayRows = pageRows.filter(r => r.site_id === s.site_id && String(r.decay_state || '') === 'decaying' && r.url);
  const ukeyD = (u) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const touchedRecently = new Set(slog.filter(l => l.existing_page_url && (at - new Date(l.started_at || 0)) < CONFIG.decay_refresh_days * 864e5).map(l => ukeyD(l.existing_page_url)));
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
    why: 'this page is losing traffic: ' + x.lost + ' clicks lost in 28 days (from ' + (Number(x.row.prev_clicks) || 0) + ' to ' + (Number(x.row.clicks) || 0) + ')'
      + (String(x.row.decay_kind || '') === 'clickthrough' ? ', and it is still shown as often, so the title and description come first' : '')
      + '. It is refreshed, not written again. ' + String(x.row.decay_basis || '').replace(/\s*(->|\u2192)\s*/g, ' to ') });
  const sq = qh.filter(q => normD(q.domain) === s.domain && q.query); const latest = sq.reduce((m, q) => String(q.period_end) > m ? String(q.period_end) : m, '');
  // F-KW (finding 5): a brand query names the site's DISTINCTIVE label (fitOwnLabels): on an exact-match domain ("erp-software.ae") the client's
  // own subject ("erp software uae") is not a brand query
  const protectT = [...new Set((fitCtx.protect || []).flatMap(x => fitTokens(x)))];
  const brandQuery = (q) => { const t = fitTokens(q); const sq0 = t.join(''); return fitOwnLabels(s.domain, t, protectT).some(l => t.includes(l) || sq0.includes(l)); };
  const strikes = sq.filter(q => String(q.period_end) === latest && Number(q.position) >= CONFIG.striking_min_position && Number(q.position) <= CONFIG.striking_max_position && Number(q.impressions) >= CONFIG.striking_min_impressions && !brandQuery(q.query) && !recent.has(norm(q.query)) && !ladderKw.has(norm(q.query))).sort((a, b) => Number(b.impressions) - Number(a.impressions));
  // B4-3: a page already queued as a refresh is not queued a second time for one of its other queries — one page, one piece of work
  const decayUrls = new Set(decayCands.map(x => ukeyD(x.row.url)));
  for (const q of strikes) { if (q.page && decayUrls.has(ukeyD(q.page))) continue;
    opps.push({ keyword: q.query, page_type: (q.page && !/\/(blog|news|insights|articles)\//i.test(q.page)) ? 'Service Page' : 'Guide', existing_page_url: q.page || '', source: 'striking', why: 'ranks #' + Math.round(Number(q.position)) + ' with ' + q.impressions + ' impressions in 28 days (Search Console): one push from the top 3' }); }
  const st = trends.filter(t => normD(t.domain) === s.domain && t.direction === 'rising' && t.rising); const latestT = st.reduce((m, t) => String(t.checked_at) > m ? String(t.checked_at) : m, '');
  for (const t of st.filter(t => String(t.checked_at) === latestT)) for (const rq of String(t.rising).split(',').map(x => x.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase()).filter(Boolean)) {
    if (recent.has(norm(rq)) || ladderKw.has(norm(rq)) || cands.some(x => norm(x.keyword) === norm(rq)) || opps.some(x => norm(x.keyword) === norm(rq))) continue;
    opps.push({ keyword: rq, page_type: 'Guide', existing_page_url: '', source: 'trend', why: 'rising related search for "' + t.keyword + '" (Google Trends, ' + (t.change_pct > 0 ? '+' : '') + t.change_pct + '% vs the 12-month average)' }); }
  // R-K3: which of these runs on its own at this level. Level 2 needs an existing page AND positive topic evidence; level 3 takes every source
  // the gate let through; level 1 none.
  // F-KW (findings 1, 2, 4): every automatic item needs positive topic evidence (against what the client chose; at level 3 also what the site
  // sells), level 2 also an existing page, and never the homepage or a main menu page
  const autoFor = (o) => AUTO_SOURCES[level].includes(o.source) && o.in_topic === true && !o.main_page && (level === 3 || !!o.existing_page_url);
  const markTopic = (o) => { const ev = evidenceOf(o.keyword); o.in_topic = ev.verdict === 'in'; o.topic_evidence = ev.verdict;
    o.main_page = !!o.existing_page_url && mainPage(o.existing_page_url); if (o.main_page) o.why += MAIN_WHY; return o; };
  const okOpps = [];
  for (const o of opps) { const g = gateOf(o); if (!g.ok) { refuse(o, g); continue; } if (isSkipped(o.keyword)) { noteSkip(o); continue; } okOpps.push(markTopic(o)); }
  // ---- the AI page (v4.12): the most valuable queued AI target the gate lets through, within the month's allowance, one a week ----
  const isAi = (l) => l.source === 'ai_answer' || l.source === 'ai_refresh';
  const aiUsed = slog.filter(l => isAi(l) && String(l.started_at || '').slice(0, 7) === atIso.slice(0, 7)).length;
  const aiThisWeek = slog.some(l => isAi(l) && (at - new Date(l.started_at || 0)) < 6 * 864e5);
  const keyOfU = (u) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const refreshedRecently = new Set(slog.filter(l => l.existing_page_url && (at - new Date(l.started_at || 0)) < 60 * 864e5).map(l => keyOfU(l.existing_page_url)));
  // one search, one page: an AI question that a keyword-ladder page already targets is written AS that ladder page (with the AI target), never twice.
  // Words of the site's ladder heads ("e invoicing in uae") appear everywhere and do not count.
  const STOPW = new Set(['the', 'and', 'for', 'with', 'what', 'how', 'which', 'are', 'can', 'does', 'your', 'you', 'that', 'this', 'from', 'into', 'best', 'top', 'list', 'guide']);
  const headWords = new Set(lrows.flatMap(l => norm(l.head_keyword).split(' ')).filter(Boolean));
  const kwTok = (k) => [...new Set(norm(k).replace(/\b(e)\b/g, ' ').split(' ').filter(w => w.length > 2 && !STOPW.has(w) && !headWords.has(w)))];
  const sameSearch = (a, b) => { const A = kwTok(a), B = new Set(kwTok(b)); if (!A.length || !B.size) return false; return A.filter(w => B.has(w)).length / A.length >= 0.6; };
  const ladderFor = (t) => lrows.find(l => sameSearch(t.keyword, l.keyword) || sameSearch(l.keyword, t.keyword)) || null;
  const aiTargetOf = (t) => { const parseS = (v) => { try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } }; return { question: t.question, kind: t.kind, target_id: t.target_id, fanout: String(t.fanout || '').split(' | ').filter(Boolean), sources: parseS(t.sources_json), competitors: String(t.competitors || '').split(', ').filter(Boolean) }; };
  const aiCandOf = (t) => ({ keyword: t.keyword, page_type: t.kind === 'refresh' ? 'Service Page' : (t.page_type || 'Guide'), existing_page_url: t.kind === 'refresh' ? t.page_url : '', source: t.kind === 'refresh' ? 'ai_refresh' : 'ai_answer', target_id: t.target_id,
    why: 'AI answers "' + t.question + '" without you' + (t.competitors ? ' (it names ' + String(t.competitors).split(', ').slice(0, 3).join(', ') + ')' : '') + (t.kind === 'refresh' ? ': refresh ' + t.page_url : ': a new answer page'),
    ai_target: aiTargetOf(t) });
  const aiQueue = [];
  for (const t of aiTargets.filter(t => t.site_id === s.site_id && t.keyword && !(t.kind !== 'refresh' && ladderFor(t)) && (t.kind === 'refresh' ? !!t.page_url && !refreshedRecently.has(keyOfU(t.page_url)) : !recent.has(norm(t.keyword)) && !ladderKw.has(norm(t.keyword))))
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))) {
    const o = aiCandOf(t); const g = gateOf(o);   // R-K4: the AI target's keyword passes the same gate (the Techand D365 refresh did not)
    if (!g.ok) { refuse(o, g); continue; }
    if (isSkipped(o.keyword)) { noteSkip(o); continue; }
    aiQueue.push(markTopic(o));
  }
  // F-KW: the client's own subject first (stable: by value inside each group), so the AI page of the week, or the one AI suggestion, is on it
  aiQueue.sort((a, b) => (b.in_topic === true ? 1 : 0) - (a.in_topic === true ? 1 : 0));
  const aiDue = aiQuota > aiUsed && !aiThisWeek;
  // ---- what is written: the ladder pages, then what the client approved for this cycle, then the level's own automatic items ----
  const aiCand0 = aiQueue[0] || null;
  // level 2: an AI refresh of an existing page in topic is one of the level's refreshes (a slot of pages_per_week); level 3: the AI page on top
  const aiAuto2 = level === 2 && aiCand0 && aiDue && aiCand0.source === 'ai_refresh' && !!aiCand0.existing_page_url && aiCand0.in_topic === true && !aiCand0.main_page ? aiCand0 : null;
  const autoOpps = [...okOpps.filter(autoFor), ...(aiAuto2 ? [aiAuto2] : [])];
  // the needs-OK candidates the client may approve: the other opportunities, the AI targets, and the next pages of Manual / not-chosen ladders
  const aiTop3 = level === 3 && aiCand0 && aiCand0.in_topic === true && !aiCand0.main_page ? aiCand0 : null;   // F-KW: the level-3 AI page needs evidence too
  const needOk = [...okOpps.filter(o => !autoFor(o)), ...aiQueue.filter(o => o !== aiAuto2 && o !== aiTop3)];
  // while the site waits for its first keyword the level's automatic items are shown as suggestions (sugPool below), so the client may
  // approve them too: they are approvable then (E4, 2026-10-19)
  const approvable = [...needOk, ...(waiting_for_keyword ? autoOpps : []), ...[...manualL, ...unchosenL].flatMap(x => x.eligible.filter(l => !isSkipped(l.keyword)).map(l => ladderCand(x, l)))];
  const approvedSeen = new Set(); const approval_ambiguous = [];
  // F-KW (finding 9): the approval row that names this item (source / ladder), or a keyword-only row when no other item shares the keyword
  const approvalFor = (o) => { const k = cycleNorm(o.keyword); const rows0 = approveRows.filter(r => cycleNorm(r.item_key) === k); if (!rows0.length) return false;
    if (rows0.some(r => String(r.source || '').trim() && rowFits(r, o))) return true;
    if (!rows0.some(r => !String(r.source || '').trim() && rowFits(r, o))) return false;
    const same = approvable.filter(x => cycleNorm(x.keyword) === k); const kinds = new Set(same.map(x => lc(x.source) + '|' + String(x.ladder_id || '') + '|' + String(x.existing_page_url || '')));
    if (kinds.size > 1) { if (!approval_ambiguous.some(a => a.item_key === k)) approval_ambiguous.push({ item_key: k, keyword: o.keyword, sources: same.map(x => x.source) }); return false; }
    return true; };
  const approved = approvable.filter(o => { const k = cycleNorm(o.keyword); if (approvedSeen.has(k) || !approvalFor(o)) return false; approvedSeen.add(k); return true; })
    .map(o => ({ ...o, approved: true, why: o.why + '; approved by you for this cycle' }));
  cands.push(...approved, ...autoOpps.filter(o => !approvedSeen.has(cycleNorm(o.keyword))));
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
    x.existing_page_url = c.url; x.covered_by = c.url; x.why += '; ' + c.url + ' already answers this search, so it is refreshed, not written again';
    return true; });
  // pile-up guard (v4.14, FIX_PLAN D5): every page written and not published counts, each keyword once — the content log rows that say
  // `written` (in the last 120 days) AND the ladder rows still 'writing' whose keyword has such a row and no published page.
  // R1 / R111 / A-20: the rule itself lives in v5/code/_waiting.js (WAITING.waiting), so the ladder mode counts the same pages
  const WAITS = WAITING.WAITS;   // R111: const WAITS = new Set(['written', 'not_ready']); - a failed draft still waits, labelled "needs a fix"
  const W = WAITING.waiting({ log: slog, ladders: lrows, now: Number(at), days: CONFIG.waiting_days });
  const waiting = W.list;
  const waitingKw = W.keys;
  const pileup = waitingKw.size >= cfg.max_waiting;
  const paused_reason = pileup && !force ? 'pileup' : '';
  // ---- R-K7: one cycle, one budget. A ladder start writes its first page(s) at once (Spawn Page Runs); those, and the pages an earlier run
  // of this cycle's cadence started (a retry after a crash), count against pages_per_week. Evidence, not a guess (R1's rule): a page counts
  // when the content log says it exists (written / not ready / published) in the window, or while its run is IN FLIGHT - a content-log row
  // that says `started`, or a ladder row the start marked `writing` with no log row yet, younger than `in_flight_hours` (a page run takes
  // 10-15 minutes). An older `started` row is a run that never finished: it wrote nothing, so it spends nothing.
  const inWin = (t) => { const v = Date.parse(String(t || '')); return Number.isFinite(v) && v >= windowStart; };
  const inFlight = (t) => { const v = Date.parse(String(t || '')); return Number.isFinite(v) && (Number(at) - v) < CONFIG.in_flight_hours * 36e5; };
  // F-KW (finding 6): a page a LADDER START wrote counts against the first cadence run after it, wherever in the cycle it happened. Inside a
  // cycle that is every start since the previous cycle's cadence ran (seo_cycle_jobs started_at of the newest earlier content_cadence job,
  // else that cycle's due time, else this cycle's due time minus 7 days): a start before that run was counted by it, one after it (a mid-cycle
  // start by the client, or a level-3 announcement) is this cycle's. Outside a cycle: the last six days, as before.
  const prevJob = isCycle && Number.isFinite(schedT) ? cycleJobRows.filter(r => r.site_id === s.site_id && String(r.cycle_key || '') !== cycle_key
    && Number.isFinite(Date.parse(String(r.due_at || r.started_at || ''))) && Date.parse(String(r.due_at || r.started_at || '')) < schedT)
    .sort((a, b) => String(b.due_at || b.started_at || '').localeCompare(String(a.due_at || a.started_at || '')))[0] || null : null;
  const prevRan = prevJob ? (Date.parse(String(prevJob.started_at || '')) || Date.parse(String(prevJob.due_at || ''))) : NaN;
  const startWindow = isCycle && Number.isFinite(schedT) ? Math.min(schedT, Number.isFinite(prevRan) ? prevRan : schedT - CONFIG.cycle_days * 864e5) : windowStart;
  const inStartWin = (t) => { const v = Date.parse(String(t || '')); return Number.isFinite(v) && v >= startWindow && v <= Number(at); };
  const EXISTS = new Set(['written', 'not_ready', 'published']);
  const spentKeys = new Map();
  const spend = (kw, how) => { const k = norm(kw); if (k && !spentKeys.has(k)) spentKeys.set(k, how); };
  for (const l of slog) { const rid = String(l.request_id || ''); const own = /^cad_/.test(rid);
    if (own ? !inWin(l.started_at) : !inStartWin(l.started_at)) continue;   // F-KW: this cycle's cadence runs from its due time; ladder starts since the last cadence run
    if (!own && String(l.source || '') !== 'ladder') continue;   // the app's "Write it" is a page the client asked for on top: not the autopilot's budget
    const st = String(l.status || '');
    if (EXISTS.has(st) || String(l.published_url || '').trim() || (st === 'started' && inFlight(l.started_at))) spend(l.keyword, own ? 'this cycle\'s cadence' : 'ladder start'); }
  for (const l of lrows) if (WAITING.LADDER_WRITTEN.has(l.status) && inStartWin(l.start_date) && inFlight(l.start_date) && !/^cad_/.test(String(l.request_id || ''))
    && !slog.some(g => norm(g.keyword) === norm(l.keyword) && inStartWin(g.started_at))) spend(l.keyword, 'ladder start (being written)');
  const spent = spentKeys.size;
  const room = Math.max(0, pages - spent);
  const budget = { pages_per_week: pages, spent, room, window_start: new Date(windowStart).toISOString(), ladder_start_window: new Date(startWindow).toISOString(),
    window: isCycle && Number.isFinite(schedT) ? 'this cycle (from its due time; ladder starts since the previous cadence run)' : 'the last ' + CONFIG.cycle_window_days + ' days',
    spent_keywords: [...spentKeys.entries()].slice(0, 10).map(([k, how]) => ({ keyword: k, how })) };
  const blocked = !!paused_reason || waiting_for_keyword;   // R-K2: at levels 1 and 2 nothing the SYSTEM chooses is written before the first chosen keyword
  // ... but an item the client approved for this cycle is the client's own choice: it is written while the site waits for its first keyword,
  // within the budget (pages_per_week), skips first (an approved item that is also skipped never reached `approved`). The pile-up guard holds it.
  const pickable = paused_reason ? [] : waiting_for_keyword ? uniq.filter(x => x.approved) : uniq;
  const picks = pickable.slice(0, room);
  // v4.12: the AI page of the week ON TOP of the pages a week — level 3 only, within the month's allowance, one a week, never while the
  // pile-up guard holds, and never for a site set to 0 pages a week
  for (const p of picks) if (p.source === 'ladder' && !p.ai_target) { const t = aiTargets.find(x => x.site_id === s.site_id && x.status === 'queued' && x.kind !== 'refresh' && (sameSearch(x.keyword, p.keyword) || sameSearch(p.keyword, x.keyword))); if (t) { p.ai_target = aiTargetOf(t); p.target_id = t.target_id; p.why += '; written to answer "' + t.question + '" in AI answers'; } }
  const aiCand = aiCand0 && !picks.some(x => norm(x.keyword) === norm(aiCand0.keyword)) ? aiCand0 : null;
  const aiPick = level === 3 && pages > 0 && aiCand && aiCand === aiTop3 && aiDue && !blocked ? aiCand : null;
  if (aiPick) picks.push(aiPick);
  // ---- suggestions: every needs-OK candidate the gate let through, not skipped, not written this run — with its price (max 5, AI first) ----
  const pickedK = new Set(picks.map(p => norm(p.keyword)));
  const sugSeen = new Set();
  const sugPool = [...(aiCand && aiDue && aiCand !== aiPick && aiCand !== aiAuto2 ? [aiCand] : []), ...needOk.filter(o => !isAi(o)), ...autoOpps.filter(o => !pickedK.has(norm(o.keyword)) && blocked)];
  const suggestions = sugPool.filter(o => { const k = norm(o.keyword); if (!k || sugSeen.has(k) || pickedK.has(k) || approvedSeen.has(k)) return false; sugSeen.add(k);   // an approved item is upcoming, not a suggestion
      if (coverOf(o)) { if (!covered.some(c => norm(c.keyword) === k)) { const c = coverOf(o); covered.push({ keyword: o.keyword, source: o.source, url: c.url, matched_by: c.matched_by }); } return false; }   // D11: never suggest a second page for a search a live page answers
      return true; })
    .slice(0, CONFIG.suggestions).map(o => itemOf(o, false));
  // P1: nothing is written before the author profile and the business facts are on file: what this run would write is HELD (listed, priced,
  // never started, never charged) and the first cycle after both exist writes it. Suggestions are computed above from the same picks, so a
  // held page is never offered a second time as a suggestion.
  const heldForProfile = !readiness.ready ? picks.splice(0, picks.length) : [];
  const heldK = new Set(heldForProfile.map(p => norm(p.keyword)));
  const HELD_WHY = '; ' + READY.REASON + ': it is written once you add ' + readiness.missing_text;
  const pickedU = new Set([...picks, ...heldForProfile].map(p => norm(p.keyword)));   // the AI page (v4.12) is not one of uniq; a held page is not "later" either
  const upcoming = uniq.filter(x => !pickedU.has(norm(x.keyword))).slice(0, CONFIG.upcoming).map(x => ({ keyword: x.keyword, source: x.source, why: x.why }));
  const pending = waiting.filter(w => !w.needs_fix).map(w => ({ keyword: w.keyword, started_at: w.written_at, days: Math.round((at - new Date(w.written_at || atIso)) / 864e5) })).filter(p => p.days >= CONFIG.publish_reminder_days);   // D5: ladder pages are in `waiting` too; R111: a failed draft is never a publish reminder
  const needs_fix = waiting.filter(w => w.needs_fix).map(w => ({ keyword: w.keyword, written_at: w.written_at, reasons: w.reasons || [] }));   // R111
  const awaitOf = (x, why) => { const l = x.eligible.find(r => !isSkipped(r.keyword) && !approvedSeen.has(cycleNorm(r.keyword))); if (!l) return null;
    return { ladder_id: x.id, head: x.head, keyword: l.keyword, rung: Number(l.rung) || 0, page_no: Number(l.page_no) || 0, page_type: l.page_type || 'Service Page', existing_page_url: l.page_exists ? (l.target_url || '') : '',
      item_key: cycleNorm(l.keyword), est_usd: EST_PAGE_USD, chosen_by: x.chosen_by, ...(why ? { why } : {}) }; };
  const RECHECK_WHY = 'checking this keyword again before writing: it was planned more than ' + CONFIG.recheck_days + ' days ago';
  const awaiting_approval = [...manualL.map(x => awaitOf(x, '')), ...unchosenL.map(x => awaitOf(x, x.chosen_by === 'system_announced'
      ? 'a keyword we announced: its pages are written on their own only at full autopilot (level 3)' : 'a ladder whose keyword you did not choose (' + (x.chosen_by || 'unknown') + '): its pages wait for your OK')),
    ...recheckL.map(x => { const a = awaitOf(x, RECHECK_WHY); return a ? { ...a, recheck: true } : null; })].filter(Boolean);
  // F-KW (finding 3b): the ladders that wait for the app's fresh Keyword Check (the app checks the head keyword and writes rechecked_at, or pauses it)
  const recheck_ladders = recheckL.map(x => ({ ladder_id: x.id, head: x.head, planned_at: x.start, reason: RECHECK_WHY }));
  // an approval that is not written this cycle, with the reason: the pile-up guard, the budget, or a live page already answering its search
  const approved_not_written = approved.filter(o => !picks.some(p => norm(p.keyword) === norm(o.keyword))).map(o => ({ keyword: o.keyword, source: o.source,
    reason: paused_reason || (heldK.has(norm(o.keyword)) ? 'profile' : covered.some(c => norm(c.keyword) === norm(o.keyword)) ? 'covered_by_live_page' : 'budget') }))
    .concat(approval_ambiguous.map(a => ({ keyword: a.keyword, source: '', reason: 'ambiguous', detail: 'your approval names only the keyword, and ' + a.sources.length + ' different pages share it (' + a.sources.join(', ') + '): approve the one you want again' })));
  const facts = { set_aside, refused, covered_by_live_pages: covered.slice(0, 10), paused_reason, waiting_publish: waitingKw.size,
    needs_fix, needs_fix_keywords: needs_fix.map(w => w.keyword),   // R111: of the waiting pages, the drafts that failed their quality check
    paused_ladders: info.filter(x => x.head_aside).map(x => ({ ladder_id: x.id, head: x.head, reason: x.head_aside.reason })),   // R87
    // B4-3: what the week knows about pages losing traffic, whether or not one was picked — `decaying` is how many the Site
    // Tracker's test confirmed, `skipped` how many of those were left alone (refreshed recently, or no search to refresh for)
    decay: { decaying: decayRows.length, queued: decayCands.length, skipped: decay_skipped,
      pages: decayCands.map(x => ({ url: x.row.url, keyword: x.q.query, lost: x.lost, kind: String(x.row.decay_kind || ''), basis: String(x.row.decay_basis || '') })) }, waiting_keywords: waiting.map(w => w.keyword).slice(0, 20), max_waiting: cfg.max_waiting, pileup_forced: pileup && force, opportunities: cfg.opportunities, awaiting_approval, suggestions,
    // keyword-first (2026-10-19): the level, whether the site still waits for its first keyword, the cycle, the budget, the client's decisions
    // P1: the readiness for a written page, and what was held for it (keyword, source, why, price; the preview carries them as items)
    readiness, waiting_for_profile: !readiness.ready, held_for_profile: heldForProfile.map(p => ({ ...itemOf(p, true), held: 'profile', why: p.why + HELD_WHY })),
    cycle_request_id, level, auto_sources: AUTO_SOURCES[level], waiting_for_keyword, client_ladders: clientLadders.length, cycle_key, cycle_date, scheduled_for, trigger: trigger_kind, budget,
    skipped, approved_items: approved.map(o => ({ keyword: o.keyword, source: o.source, item_key: cycleNorm(o.keyword) })), approved_not_written, est_page_usd: EST_PAGE_USD, est_basis,
    not_chosen_ladders: unchosenL.map(x => ({ ladder_id: x.id, head: x.head, chosen_by: x.chosen_by })), recheck_ladders,
    ai_pages: { per_month: aiQuota, used_this_month: aiUsed, this_week: !!aiPick, next: aiCand ? { keyword: aiCand.keyword, source: aiCand.source, target_id: aiCand.target_id, why: aiCand.why } : null, queued: aiQueue.length, on_top: level === 3 },
    queued_ladders: queued.map(x => ({ ladder_id: x.id, head: x.head, priority: Number.isFinite(x.priority) ? x.priority : null, reason: 'max_active' })),
    won_ladders: info.filter(x => x.won || x.status === 'won').map(x => ({ ladder_id: x.id, head: x.head, position: x.head_position, checks: x.won_checks })),
    waiting_for_support: info.filter(x => x.main_waiting && ['active', 'queued'].includes(x.status) && !x.won).map(x => ({ ladder_id: x.id, head: x.head, published: x.published, supporting: x.support, needed: Math.ceil(x.support / 2), head_position: x.head_position })) };
  const ridOf = (i) => 'cad_' + week.replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, '') + '_' + i;
  // ---- preview: ONE item per site, what the cycle would write — nothing is started, logged or marked ----
  if (preview) {
    const items = [...picks.map(p => itemOf(p, true)), ...facts.held_for_profile.map(h => ({ ...h, auto: true })),
      ...awaiting_approval.map(a => ({ ...itemOf({ ...a, source: 'ladder', why: (a.why || 'the next page of your ladder "' + a.head + '": it waits for your OK') + (readiness.ready ? '' : HELD_WHY) }, false), ...(readiness.ready ? {} : { held: 'profile' }) }))];
    const profileP = heldForProfile.length ? READY.REASON + ': ' + heldForProfile.length + ' page' + (heldForProfile.length === 1 ? '' : 's') + ' ' + (heldForProfile.length === 1 ? 'is' : 'are') + ' written once you add ' + readiness.missing_text : '';
    const reasonP = waiting_for_keyword ? 'waiting for your first keyword: choose the keyword you want to be found for' + (picks.length ? '; until then only what you approved is written' : profileP ? '; and ' + profileP : ', nothing is written until then')
      : paused_reason ? waitingKw.size + ' written pages are waiting to be published (limit ' + cfg.max_waiting + '): nothing new is written until they are'
      : profileP ? profileP
      : !pages ? 'no pages a week are set for this website' : !picks.length ? 'nothing to write automatically in this cycle' : '';
    out.push({ json: { preview: true, dry_run: true, site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', country: s.country || '',
      request_id: cycle_request_id || 'prev_' + week.replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, ''), pages_per_week: pages, items, reason: reasonP, upcoming, pending_publish: pending, candidates: uniq.length, week,
      est_ai_usd: 0, est_dfs_usd: 0, ...facts } });   // a preview spends nothing: the run ledger reserves 0 for it
    continue;
  }
  picks.forEach((p, i) => { const request_id = ridOf(spent + i + 1);
    out.push({ json: { site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', country: s.country || '', source: p.source, keyword: p.keyword, page_type: p.page_type, existing_page_url: p.existing_page_url || '', ladder_id: p.ladder_id || '', rung: p.rung || 0, page_no: p.page_no || 0, target_id: p.target_id || '', why: p.why, request_id, pages_per_week: pages, upcoming, pending_publish: pending, candidates: uniq.length, dry_run, week, item_key: cycleNorm(p.keyword), auto: !p.approved, approved: !!p.approved, est_usd: EST_PAGE_USD, ...facts,
      body: { mode: 'keyword', keyword: p.keyword, page_type: p.page_type, country: s.country || '', domain: s.domain, receive: ['Keyword Report', 'Page Content'], existing_page_url: p.existing_page_url || '', email: s.email || '', callback_url: s.callback_url || '', business: '', customers: '', request_id, client_ip: 'cadence:' + s.site_id, force_content: true,
        business_facts: String(s.business_facts || '').trim().slice(0, 2000), cta: String(s.cta || '').trim().slice(0, 200),   // P1: the stored facts reach every page run (Normalize Input matches `business` first, so it is sent, empty, before them)
        ...(p.ai_target ? { ai_target: p.ai_target } : {}),
        ...(p.source === 'ladder' ? { ladder_id: p.ladder_id, ladder_rung: p.rung, ladder_head: p.head, ladder_page_no: p.page_no, ladder_target_url: p.target_url || '', ladder_links: (p.links || []).map(l => ({ url: l.url, path: String(l.url).replace(/^https?:\/\/[^\/]+/i, '') || '/', role: l.role, keyword: l.keyword, planned: true })) } : {}) } } }); });
  const dropped = set_aside.filter(x => x.dropped);   // R16: a rung nobody should write is a reason to report, not to go quiet
  if (!picks.length && (isCycle || paused_reason || waiting_for_keyword || heldForProfile.length || awaiting_approval.length || suggestions.length || facts.waiting_for_support.length || dropped.length || facts.paused_ladders.length)) {
    const fixK = new Set(needs_fix.map(w => norm(w.keyword)));
    const profileR = heldForProfile.length ? READY.REASON + ': ' + heldForProfile.length + ' page' + (heldForProfile.length === 1 ? '' : 's') + ' ' + (heldForProfile.length === 1 ? 'is' : 'are') + ' ready to write once you add ' + readiness.missing_text + ' (Website settings); nothing is written or charged until then' : '';
    const reason = waiting_for_keyword ? 'waiting for your first keyword: choose the keyword you want to be found for, nothing is written until you do'
        + (suggestions.length ? ' (' + suggestions.length + ' suggestion' + (suggestions.length === 1 ? '' : 's') + ' wait for your OK)' : '') + (profileR ? '; and ' + profileR : '')
      : paused_reason ? waitingKw.size + ' written pages waiting for publication (pile-up guard, limit ' + cfg.max_waiting + '): ' + facts.waiting_keywords.slice(0, 6).map(k => '"' + k + '"' + (fixK.has(norm(k)) ? (() => { const cv = coverOf({ keyword: k }); return cv ? ' (not needed: ' + SM.pageStep({ keyword: k, covered_url: cv.url, not_ready: true }).text + ')' : ' (needs a fix: it did not pass the quality check)'; })() : '')).join(', ')
        + (needs_fix.length ? '. Publish the ones that passed, and fix the ' + needs_fix.length + ' that need a fix and run them again, to continue' : '. Publish them to continue')
      : !pages ? 'no pages a week are set for this website, so nothing is written at any autopilot level'
      : profileR ? profileR
      : (pages && !room && spent) ? 'this cycle\'s ' + pages + ' page' + (pages === 1 ? '' : 's') + ' a week ' + (spent === 1 ? 'is' : 'are') + ' already used: ' + budget.spent_keywords.map(x => '"' + x.keyword + '" (' + x.how + ')').join(', ')
      : dropped.length ? 'nothing to write automatically this week; ' + dropped.length + ' planned page(s) set aside: ' + dropped.slice(0, 3).map(x => x.note).join(' | ')
      : 'nothing to write automatically this week';
    out.push({ json: { nothing_to_do: true, report_only: true, reason, site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', country: s.country || '', request_id: cycle_request_id || ridOf(0),
      pages_per_week: pages, upcoming, pending_publish: pending, candidates: uniq.length, dry_run, week, ...facts } });
  }
}
if (!out.length) return [{ json: { nothing_to_do: true, reason: scoped ? 'nothing to write for "' + want + '" (not a tracked website, or no cadence set, nothing planned, or everything written recently)' : 'no site has a content cadence this week', sites: list.length, dry_run, ...(preview ? { cycle_key } : {}) } }];
return out;
