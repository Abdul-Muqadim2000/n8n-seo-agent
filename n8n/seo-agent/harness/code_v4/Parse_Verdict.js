// ---- verdict exclusions kit (A-18, 2026-10-17; inlined through the EXCLUSIONS marker and prepended to Parse Verdict) ----
// What the verdict said this page must NOT cover reaches the brief, the writer and the quality check. Live (exec 771) the verdict's
// own `what_must_change[3]` said "Skip the consultancy-licence and start-an-IT-company questions, which don't match buyer intent", and
// the delivered page carried the H2 "How Much Is a Consultancy Licence in Dubai?": the strategy brief prompt only ever printed the
// verdict's reasons, never its changes, so the instruction reached nobody and nothing checked it.
//   EXC.fromVerdict(changes, skips)  the topics to leave out: the verdict's structured `topics_to_skip`, plus every "skip / avoid /
//                                    leave out / do not cover …" phrase in its free-text changes (the fallback for older answers)
//   EXC.match(text, ex, keyword)     does a heading (or an outline section) cover that topic? every content word of the topic must be in it;
//                                    a one-word topic that is also a word of the page's own keyword never matches (it would match everything)
//   EXC.check(headings, list, kw)    [{ heading, topic }] for every heading that covers an excluded topic
//   EXC.prune(outline, list, kw)     the brief's outline without those sections, and the ones dropped
// Regex only (the n8n Code sandbox has no URL constructor).
const EXC = (() => {
  const S = (v) => String(v == null ? '' : v);
  const STOP = new Set('the a an and or of for to in on with by at from about any all each every their your our its it is are be this that these those how what which why when who much many do does can should would will questions question topics topic sections section queries query searches search angles angle content pages page posts post details detail things thing buyer buyers intent people readers reader'.split(' '));
  const norm = (w) => { let x = S(w).toLowerCase().replace(/licens/g, 'licenc');
    if (x.length > 5) x = x.replace(/(?:ings|ing|ies|es|ed|s)$/, ''); else if (x.length > 3) x = x.replace(/s$/, ''); return x; };
  const toks = (t) => S(t).toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w)).map(norm);
  const SKIP_RE = /\b(?:skip|avoid|leave out|drop|exclude|omit|ignore|steer clear of|stay away from|do not (?:cover|answer|target|include)|don['’]t (?:cover|answer|target|include)|no need to (?:cover|answer))\s+(?:the\s+|any\s+|all\s+)?([^.;:!?]+?)(?=\s*,\s*(?:which|as|because|since|they|these|it|that)\b|\s+(?:which|because|since|as they|as these)\b|[.;:!?]|$)/gi;
  const TAIL_RE = /\s+(?:questions?|topics?|sections?|queries|query|searches|angles?|content|pages?|posts?|subjects?|keywords?)\s*$/i;
  const fromText = (line) => {
    const out = [];
    for (const m of S(line).matchAll(SKIP_RE)) {
      const phrase = S(m[1]).replace(TAIL_RE, '').trim();
      for (const part0 of phrase.split(/\s*(?:,|;|\band\b|\bor\b|&|\/)\s*/i)) {
        const part = part0.replace(/[-_]+/g, ' ').replace(TAIL_RE, '').trim();
        if (toks(part).length) out.push(part);
      }
    }
    return out;
  };
  const fromVerdict = (changes, skips) => {
    const seen = new Set(); const out = [];
    const add = (topic, source) => { const k = toks(topic).join(' '); if (!k || seen.has(k)) return; seen.add(k); out.push({ topic: S(topic).trim(), source }); };
    (Array.isArray(skips) ? skips : []).forEach(t => add(S(t).replace(/[-_]+/g, ' '), 'verdict'));
    (Array.isArray(changes) ? changes : []).forEach(c => fromText(c).forEach(t => add(t, 'verdict_changes')));
    return out.slice(0, 12);
  };
  const match = (text, ex, keyword) => {
    const T = toks(ex && ex.topic != null ? ex.topic : ex); if (!T.length) return false;
    const kw = new Set(toks(keyword));
    if (T.length === 1 && kw.has(T[0])) return false;
    const H = new Set(toks(text));
    return T.every(w => H.has(w));
  };
  const check = (headings, list, keyword) => {
    const out = [];
    for (const h of (Array.isArray(headings) ? headings : [])) {
      const text = S(h).replace(/^#+\s*/, '').replace(/[*_`]+/g, '').trim(); if (!text) continue;
      const ex = (Array.isArray(list) ? list : []).find(e => match(text, e, keyword));
      if (ex) out.push({ heading: text, topic: S(ex.topic != null ? ex.topic : ex) });
    }
    return out;
  };
  const prune = (outline, list, keyword) => {
    const kept = [], dropped = [];
    for (const sec of (Array.isArray(outline) ? outline : [])) {
      const ex = (Array.isArray(list) ? list : []).find(e => match(S(sec && sec.h2), e, keyword));
      if (ex) dropped.push({ h2: S(sec.h2), topic: S(ex.topic) }); else kept.push(sec);
    }
    return { kept, dropped };
  };
  return { fromVerdict, fromText, match, check, prune, toks };
})();
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
// ---- what the site already holds for a search: its pages, its keyword ladders and its unpublished drafts (2026-10-17, re-rating A-1 /
// A-5 / A-23 / A-25; inlined by build_v4.py section 130 and build_api.py where a node asks for the OWN_COVER placeholder) ----
// The re-rating of 2026-10-17 found four paths that recommended work the site had already done or planned:
//   * the keyword report "erp system dubai" (exec 765) said "Build a Dynamics 365 Business Central / Finance & Operations ERP service
//     page" while /dynamics-365-business-central-uae and /dynamics-365-finance-and-operations-uae are live, and gave as secondary keywords
//     the slug of the first, a planned rung of the ladder "erp software uae" and a variant of the ladder "erp implementation dubai";
//   * the verdict "e invoicing software uae" (exec 760) folded five planned pages of the active ladder "e invoicing in uae" and a written
//     draft into the page it said to improve, and asked for "a penalties section" while the site has the penalties article and the rung;
//   * discovery (exec 764) led "Where to start" / "Build first" / "Now" with "erp system dubai" and "erp systems in uae", the searches the
//     ladder "erp software uae" already holds in other words;
//   * the Keyword Check (exec 750) answered "business central partner uae" with `existing: null` beside the live Business Central page.
// One question underneath all four: does something the site owns already answer this search? This kit answers it from three sources -
// the page inventory (through the caller's `matchPage`, SM.matchPage), the keyword ladders (seo_ladders + seo_ladder_settings, the rows
// the CALLER has already passed through the fit gate) and the content log's unpublished drafts - and says HOW it matched, so a report
// can name the page, the ladder or the draft instead of recommending a second one. Pure functions; the harness drives them directly.
const OWN = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'near', 'me', 'vs', 'is', 'are', 'what', 'how', 'best', 'top', 'your', 'my']);
  // the same words as _reach.js `overlapTokens` (one search, one page), so "the same search" means the same thing in every path
  const tokens = (s) => { const out = []; for (const t of S(s).toLowerCase().split(/[^a-z0-9]+/)) { if (t.length <= 1 || STOP.has(t)) continue;
    const w = t.replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, '').replace(/[^a-z0-9]/g, ''); if (w && !out.includes(w)) out.push(w); } return out; };
  // two words people use for the same product search ("erp system dubai" = "erp software dubai"): applied to both sides, never to one
  const SYN = { system: 'software' };
  const syn = (ts) => [...new Set(ts.map(t => SYN[t] || t))];
  // places: a search for the same thing in another emirate / the country is the same TOPIC, not the same search
  const PLACES = new Set(['uae', 'dubai', 'abu', 'dhabi', 'abudhabi', 'sharjah', 'ajman', 'fujairah', 'rak', 'ra', 'khaimah', 'emirate', 'emirat', 'gcc', 'ksa', 'saudi', 'riyadh', 'jeddah', 'qatar', 'doha', 'bahrain', 'oman', 'muscat', 'kuwait', 'mena', 'middle', 'east', 'arab', 'united']);
  const noPlace = (ts) => ts.filter(t => !PLACES.has(t));
  const jacc = (a, b) => { if (!a.length || !b.length) return 0; const sb = new Set(b); const c = a.filter(t => sb.has(t)).length; return c / (a.length + b.length - c); };
  const inside = (a, b) => a.length > 0 && a.every(t => b.includes(t));
  const RANK = { same: 4, 'other words': 3, variant: 2, 'other place': 1 };
  /** how two searches relate: 'same' (75%+ the same words), 'other words' (the same once system = software), 'variant' (one is the
   *  other plus ONE word, places aside: "erp implementation partner uae" of "erp implementation dubai"), 'other place' (the same words for
   *  another place), or null */
  const relate = (a, b) => {
    const A = tokens(a), B = tokens(b); if (!A.length || !B.length) return null;
    if (jacc(A, B) >= 0.75) return 'same';
    const As = syn(A), Bs = syn(B);
    if (jacc(As, Bs) >= 0.75) return 'other words';
    const Ap = noPlace(As), Bp = noPlace(Bs);
    if (Ap.length >= 2 && Bp.length >= 2) {
      if (jacc(Ap, Bp) >= 0.75) return (As.length === Ap.length && Bs.length === Bp.length) ? 'other words' : 'other place';
      if ((inside(Bp, Ap) && Ap.length - Bp.length === 1) || (inside(Ap, Bp) && Bp.length - Ap.length === 1)) return 'variant';
    }
    return null;
  };
  const HOW = { same: 'the same search', 'other words': 'the same search in other words', variant: 'a close variant of it', 'other place': 'the same topic for another place' };
  const listOf = (v) => (Array.isArray(v) ? v : S(v).split(/[,;\n]+/)).map(x => S(x).toLowerCase()).filter(Boolean);
  const bare = (d) => S(d).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#:].*$/, '');
  /** the site's keyword ladders as one list of searches (each rung keyword, its supporting keywords and the head), archived ladders and
   *  set-aside rungs left out, each with the LADDER's status from seo_ladder_settings (paused / active) beside the row's own status.
   *  `keep(row)` is the caller's fit gate (fitStored) - a stored rung is read back through the gate it was written through. */
  const ladders = (rows, settings, o) => {
    const c = o || {}; const dom = bare(c.domain); const keep = typeof c.keep === 'function' ? c.keep : () => true;
    const st = new Map((Array.isArray(settings) ? settings : []).filter(r => r && r.ladder_id).map(r => [S(r.ladder_id), S(r.status).toLowerCase()]));
    const out = [];
    for (const r of (Array.isArray(rows) ? rows : [])) {
      if (!r || !S(r.ladder_id) || !S(r.keyword)) continue;
      if (dom && bare(r.domain) && bare(r.domain) !== dom) continue;
      const lst = st.get(S(r.ladder_id)) || '';
      if (lst === 'archived' || /^(set_aside|refused|deleted)$/i.test(S(r.status))) continue;
      if (!keep(r)) continue;
      const rung = Number(r.rung) || 0;
      out.push({ ladder_id: S(r.ladder_id), head_keyword: S(r.head_keyword).toLowerCase(), keyword: S(r.keyword).toLowerCase(), rung, part: rung === 4 ? 'head' : 'rung',
        status: S(r.status) || 'planned', ladder_status: lst || null, target_url: S(r.target_url), supporting: listOf(r.supporting).slice(0, 12) });
    }
    return out;
  };
  /** the content log's pages that exist as text but not on the site (written, not ready, started) */
  const drafts = (rows, o) => {
    const dom = bare((o || {}).domain);
    return (Array.isArray(rows) ? rows : []).filter(r => r && S(r.keyword) && (!dom || !bare(r.domain) || bare(r.domain) === dom))
      .filter(r => !/^(published|discarded|deleted|failed)$/i.test(S(r.status)))
      .map(r => ({ keyword: S(r.keyword).toLowerCase(), status: S(r.status) || 'written', ladder_id: S(r.ladder_id), url: S(r.published_url || r.existing_page_url || r.suggested_url) }));
  };
  const best = (cands) => cands.filter(x => x.rel).sort((a, b) => RANK[b.rel] - RANK[a.rel])[0] || null;
  /** the ladder entry that holds a search, with how. `o.self` = { ladder_id, keyword } of the run's own row (never a conflict with itself);
   *  `o.min` = the weakest relation that counts ('variant' by default; 'other place' to also catch the same topic elsewhere). */
  const ladderOf = (index, kw, o) => {
    const c = o || {}; const min = RANK[c.min || 'variant'];
    const self = c.self || {}; const selfKw = S(self.keyword).toLowerCase();
    const cands = [];
    for (const e of (index || [])) {
      if (self.ladder_id && e.ladder_id === S(self.ladder_id) && (e.keyword === selfKw || (e.part === 'head' && e.head_keyword === selfKw))) continue;
      for (const [k, via] of [[e.keyword, 'keyword'], ...e.supporting.map(s => [s, 'supporting'])]) {
        const rel = relate(kw, k); if (rel && RANK[rel] >= min) cands.push({ ...e, matched: k, via, rel });
      }
    }
    const b = best(cands); if (!b) return null;
    return { kind: 'ladder', ladder_id: b.ladder_id, head_keyword: b.head_keyword, keyword: b.keyword, rung: b.rung, part: b.part, status: b.status,
      ladder_status: b.ladder_status, target_url: b.target_url, matched: b.matched, via: b.via, how: HOW[b.rel], relation: b.rel };
  };
  const draftOf = (list, kw, o) => {
    const c = o || {}; const min = RANK[c.min || 'other words']; const selfKw = S(c.self_keyword).toLowerCase();
    const b = best((list || []).filter(d => d.keyword !== selfKw).map(d => ({ ...d, rel: relate(kw, d.keyword) })).filter(d => d.rel && RANK[d.rel] >= min));
    return b ? { kind: 'draft', keyword: b.keyword, status: b.status, url: b.url, ladder_id: b.ladder_id, how: HOW[b.rel], relation: b.rel } : null;
  };
  const ukey = (u) => bare(u) + S(u).toLowerCase().replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  /** what the site already holds for `kw`: a page (ctx.matchPage), then a ladder, then a draft - the first that answers, or null.
   *  ctx = { matchPage(kw) -> { url, title, matched_by, score } | null, ladders, drafts, exclude_urls: [the page this run improves], self,
 *          page_min: the share of the search's words a page must carry by slug / title (default: whatever matchPage accepted) } */
  const claim = (kw, ctx) => {
    const c = ctx || {};
    const skip = new Set((c.exclude_urls || []).filter(Boolean).map(ukey));
    const p = typeof c.matchPage === 'function' ? c.matchPage(kw) : null;
    const strong = p && (S(p.matched_by) === 'query' || (Number(p.score) || 0) + 1e-9 >= (Number(c.page_min) || 0));   // a caller may ask for every word (secondary keywords)
    if (p && strong && S(p.url) && !skip.has(ukey(p.url))) return { kind: 'page', url: S(p.url), title: S(p.title), matched_by: S(p.matched_by) || 'inventory', how: 'a page of yours targets it' };
    const l = ladderOf(c.ladders, kw, { self: c.self, min: c.min_ladder });
    if (l) return l;
    return draftOf(c.drafts, kw, { self_keyword: (c.self || {}).keyword });
  };
  /** one line a customer reads: "your page /x", "your ladder "y" (rung page "z", planned)", "your draft "z" (not ready)" */
  const sayOf = (x) => {
    if (!x) return '';
    const path = (u) => S(u).replace(/^https?:\/\/[^/]+/i, '') || '/';
    if (x.kind === 'page') return 'your page ' + path(x.url) + (x.title ? ' ("' + x.title + '")' : '');
    if (x.kind === 'ladder') return 'your keyword ladder "' + x.head_keyword + '"' + (x.ladder_status === 'paused' ? ' (paused)' : '') + ' — ' + (x.part === 'head' ? 'its main page' : 'its rung ' + x.rung + ' page') + ' "' + x.keyword + '" (' + x.status + ')' + (x.via === 'supporting' ? ', which also targets "' + x.matched + '"' : '');
    return 'your draft "' + x.keyword + '" (' + x.status + ', not published yet)';
  };
  /** the site's own words that set a page / rung apart from `kw`: its tokens minus the search's, places and generic words left out */
  const GENERIC = new Set(['page', 'service', 'solution', 'software', 'company', 'compan', 'partner', 'guide', 'complete', 'tech', 'uae', 'best', 'top', 'list', 'new', 'cost', 'price']);
  const distinct = (text, kw) => { const k = new Set(syn(tokens(kw))); return syn(tokens(text)).filter(t => !k.has(t) && !PLACES.has(t) && !GENERIC.has(t) && !/^\d+$/.test(t)); };
  /** the prompt block: what the site already has on this topic, so the model never proposes it as new */
  const text = (ctx, kw, o) => {
    const c = ctx || {}; const lim = (o && o.max) || 8;
    const want = noPlace(syn(tokens(kw)));
    const near = (k) => { const t = syn(tokens(k)); return want.some(w => t.includes(w)); };
    const lines = [];
    const pages = (c.pages || []).slice(0, lim);
    if (pages.length) lines.push('Pages of the site on this topic: ' + pages.map(p => (S(p.url).replace(/^https?:\/\/[^/]+/i, '') || '/') + (p.title ? ' ("' + S(p.title).slice(0, 80) + '")' : '')).join('; '));
    const lads = new Map();
    for (const e of (c.ladders || [])) { if (!(near(e.keyword) || near(e.head_keyword) || e.supporting.some(near))) continue;
      const k = e.ladder_id; if (!lads.has(k)) lads.set(k, { head: e.head_keyword, status: e.ladder_status, rungs: [] });
      lads.get(k).rungs.push(e.keyword + ' (' + e.status + ')'); }
    for (const [, l] of [...lads.entries()].slice(0, 6)) lines.push('Keyword ladder "' + l.head + '"' + (l.status ? ' (' + l.status + ')' : '') + ' - its pages: ' + l.rungs.slice(0, 8).join(', '));
    const dr = (c.drafts || []).filter(d => near(d.keyword)).slice(0, 6);
    if (dr.length) lines.push('Pages written but not published yet: ' + dr.map(d => d.keyword + ' (' + d.status + ')').join(', '));
    return lines.join('\n');
  };
  return { tokens, relate, ladders, drafts, ladderOf, draftOf, claim, sayOf, distinct, text, HOW, PLACES, ukey };
})();
// Accepts an object (from the Structured Output Parser) or a string with/without code fences or surrounding text
const parseAgentJson = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  let s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  throw new Error('AI did not return valid JSON. Output was: ' + s.slice(0, 300));
};

// ---- reach (v4.8, PIPELINE_FEATURE_SPEC §5.3-5.5): the keyword difficulty this website can already win. ONE copy, inlined by the build into
// Ladder Plan, Reach (Discovery), Rank Keywords, Build Keyword Strategy and the Keyword Check workflow (SEOagentAssess), so they all agree.
//   reach      = the 75th-percentile difficulty of the keywords the site ranks top 10 for (at least 5 of them; linear interpolation), else by
//                size (keywords in the top 10: 0-4 -> 10, 5-49 -> 20, 50-499 -> 35, 500+ -> 50); the larger of the two when both exist.
//   difficulty = easy (kd <= reach + 5, or the site already ranks 1-20 for the keyword) · reachable (<= reach + 20) · hard (<= reach + 40) ·
//   for you      very hard (above) · not realistic (navigational / another company's brand / verdict AVOID); an unknown kd counts as reach + 10.
//   plan       = easy -> direct (2-4 months) · reachable -> short (4-8) · hard -> full (9-15) · very hard -> full, stretch · not realistic -> none;
//                strong sites (100+ top-10 keywords, 1,000+ ranking keywords, or already top 20 for it): direct 2-3, short 3-6, full 6-12.
//   cache      = seo_cache 'reach:<site_id>' for 30 days and the same market (value: reach, method, p75, size_reach, sample, top10,
//                organic_keywords, location_code, and since B1-2 the EVIDENCE itself: `r` = the top-10 keywords it was measured on);
//                a reach that could not be measured (both calls failed) is never stored.
const REACH_CFG = { min_top10: 5, percentile: 0.75, ttl_days: 30, unknown_kd: 10, easy: 5, reachable: 20, hard: 40, easy_position: 20, sample: 100, sample_keep: 60 };
const REACH_MONTHS = { direct: [2, 4], short: [4, 8], full: [9, 15] }, REACH_MONTHS_STRONG = { direct: [2, 3], short: [3, 6], full: [6, 12] };
const REACH_DIFF_LABEL = { easy: 'Easy for your site', reachable: 'Reachable for your site', hard: 'Hard for your site', very_hard: 'Very hard for your site', not_realistic: 'Not realistic for your site' };
const REACH_PLAN_LABEL = { direct: 'Direct plan', short: 'Short ladder', full: 'Full ladder', none: 'No ladder' };
// G3 (2026-10-11): the evidence behind "months, not weeks" and an estimated chance per plan. Ahrefs 2025 (REACH_BASE_RATE.url): 1.74% of new
// pages reached Google's top 10 within a year, and 40.8% of those did so within a month (the 2017 figure, 5.7%, is no longer cited). The chance
// bands are judgement calls relative to that base rate (a keyword within the site's reach is far from a random new page) and are UNCALIBRATED
// until G17 fits them to this system's own ladders — every text that shows them says so. The same values live in app/shared/src/keywords.ts.
const REACH_BASE_RATE = { year: 2025, source: 'Ahrefs', top10_within_year_pct: 1.74, of_those_within_month_pct: 40.8, url: 'https://ahrefs.com/blog/how-long-does-it-take-to-rank/' };
const REACH_CHANCE = { direct: { band: 'good', range: [50, 70] }, short: { band: 'fair', range: [30, 50] }, full: { band: 'low', range: [15, 30] }, stretch: { band: 'slim', range: [5, 15] }, none: { band: 'none', range: [0, 0] } };
const REACH_CHANCE_NOTE = 'an uncalibrated estimate until this system has measured its own ladders';
// { band, range, label }: "estimated chance good (50-70%, uncalibrated)"; '' label for no plan
// R49 (2026-10-16, re-rating 2026-10-15): the band was read off the plan type alone, so a site whose reach is only the size tier for
// "0 keywords in Google's top 10" (method size, sample 0) was told "estimated chance good (50-70%)" for a KD-3 keyword — the highest
// band, on a reach nothing was measured on. The table stays (a judgement call until G17); it is now applied only when the reach rests on
// a measured ranking: the site's top-10 keywords (percentile, or any top-10 keyword at all), a reach measured on the topic, or the site
// already ranking 1-20 for the keyword. Otherwise there is no band — the plan and the months stay, with the base rate as the only figure.
// The same words live in app/shared/src/keywords.ts (UNMEASURED_LABEL).
const REACH_UNMEASURED_LABEL = 'no estimated chance (no measured ranking to judge it by)';
const reachMeasured = (info, position) => { const i = info || {}; const p = reachNum(position);
  if (p != null && p >= 1 && p <= REACH_CFG.easy_position) return true;
  if (i.used === true || String(i.method || '') === 'percentile') return true;
  return (Number(i.top10) || 0) > 0 || (Number(i.sample) || 0) > 0; };
const reachChance = (plan_type, stretch, measured) => { const c = REACH_CHANCE[plan_type === 'none' ? 'none' : (stretch ? 'stretch' : plan_type)] || REACH_CHANCE.full;
  if (c.band !== 'none' && measured === false) return { band: 'unmeasured', range: [0, 0], label: REACH_UNMEASURED_LABEL, basis: 'base rate' };
  return { band: c.band, range: c.range.slice(), label: c.band === 'none' ? '' : 'estimated chance ' + c.band + ' (' + c.range[0] + '-' + c.range[1] + '%, uncalibrated)' }; };
const reachBaseRateText = () => 'Base rate (' + REACH_BASE_RATE.source + ', ' + REACH_BASE_RATE.year + '): only ' + REACH_BASE_RATE.top10_within_year_pct + '% of new pages reach Google\'s top 10 within a year, and ' + REACH_BASE_RATE.of_those_within_month_pct + '% of those do so within a month — the rest take months.';
// the sentence under a plan's month range: the chance band, that it is uncalibrated, and the 2025 base rate it is judged against
const reachChanceText = (plan) => !(plan && plan.chance && plan.chance.label) ? '' : plan.chance.band === 'unmeasured'
  ? 'No estimated chance: the reach this plan is judged against rests on no measured ranking (the search data shows none of your keywords in Google\'s top 10), so a band would only restate the plan. The only measured figure is the base rate. ' + reachBaseRateText()
  : (plan && plan.chance && plan.chance.label) ? 'Estimated chance of reaching the top 10 within ' + plan.months + ' months: ' + plan.chance.band + ' (' + plan.chance.range[0] + '-' + plan.chance.range[1] + '%) — ' + REACH_CHANCE_NOTE + '. ' + reachBaseRateText() : '';
const reachDomain = (d) => String(d || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '');
const reachSiteId = (d) => 'site_' + reachDomain(d).replace(/[^a-z0-9]+/g, '-');
const reachKey = (d) => 'reach:' + reachSiteId(d);
const reachNum = (v) => (v === '' || v == null || typeof v === 'boolean' || !Number.isFinite(Number(v))) ? null : Number(v);
const reachSizeTier = (top10) => { const n = Number(top10) || 0; return n >= 500 ? 50 : n >= 50 ? 35 : n >= 5 ? 20 : 10; };
// ranked: [{ kd, position }] for the site (null = the call failed; only positions 1-10 count); authority: { top10, organic_keywords } (null = unknown)
function reachFrom(ranked, authority) {
  const top = (ranked || []).filter(r => { const p = reachNum(r && r.position); return p != null && p >= 1 && p <= 10; });
  const kds = top.map(r => reachNum(r.kd)).filter(v => v != null).sort((a, b) => a - b);
  let p75 = null;
  if (kds.length >= REACH_CFG.min_top10) { const i = REACH_CFG.percentile * (kds.length - 1), lo = Math.floor(i), hi = Math.ceil(i); p75 = Math.round(kds[lo] + (kds[hi] - kds[lo]) * (i - lo)); }
  const known = !!(authority && reachNum(authority.top10) != null);
  const top10 = known ? reachNum(authority.top10) : top.length;
  const size_reach = reachSizeTier(top10);
  const reach = p75 != null ? Math.max(p75, size_reach) : size_reach;
  const method = (!ranked && !known) ? 'default' : (p75 != null && p75 >= size_reach) ? 'percentile' : 'size';
  return { reach, method, p75, size_reach, sample: kds.length, top10, organic_keywords: authority && reachNum(authority.organic_keywords) != null ? reachNum(authority.organic_keywords) : null, cached: false };
}
// the stored reach of this site for this market, when it is younger than 30 days (null otherwise). B1-2: the row also carries the
// keywords the number was measured on (`r`), so a run that reuses the cached reach can still answer "and what is it measured on?" and
// measure a reach on ITS OWN topic (reachTopic) without re-buying the pull. A row written before B1-2 has no `r`: `ranked` is then null
// and the caller says the evidence was not re-read, which is true, rather than reporting zero on-topic keywords, which is not.
function reachCached(rows, domain, location_code) {
  const key = reachKey(domain);
  const row = (rows || []).filter(r => r && !r.error && r.key === key).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
  if (!row) return null;
  let v = null; try { v = JSON.parse(row.value); } catch (e) { return null; }
  if (!v || reachNum(v.reach) == null) return null;
  if (reachNum(location_code) && reachNum(v.location_code) && Number(v.location_code) !== Number(location_code)) return null;
  const days = (Date.now() - new Date(row.updated_at).getTime()) / 864e5;
  if (!(days >= 0 && days < REACH_CFG.ttl_days)) return null;
  const { r: packed, ...rest } = v;
  const ranked = Array.isArray(packed) ? packed.map(x => ({ keyword: String((x || [])[0] || ''), kd: reachNum((x || [])[1]), position: reachNum((x || [])[2]) })).filter(x => x.keyword) : null;
  return { ...rest, reach: Number(v.reach), cached: true, cached_at: String(row.updated_at), ranked, ranked_from: ranked ? 'the stored measurement of ' + String(row.updated_at).slice(0, 10) : '' };
}
// the seo_cache row (exact columns) for a freshly measured reach. `ranked` (optional) is the evidence: [{ keyword, kd, position }] as
// the pull returned it, packed as [keyword, kd, position] triples and capped at REACH_CFG.sample_keep so one row stays small.
const reachPack = (ranked) => (Array.isArray(ranked) ? ranked : []).filter(r => r && r.keyword && reachNum(r.position) != null)
  .slice(0, REACH_CFG.sample_keep).map(r => [String(r.keyword).slice(0, 120), reachNum(r.kd), Number(r.position)]);
const reachCacheRow = (domain, info, location_code, ranked) => { const r = reachPack(ranked);
  return { key: reachKey(domain), kind: 'reach', site_id: reachSiteId(domain),
    value: JSON.stringify({ reach: info.reach, method: info.method, p75: info.p75, size_reach: info.size_reach, sample: info.sample, top10: info.top10, organic_keywords: info.organic_keywords, location_code: reachNum(location_code), ...(r.length ? { r } : {}) }),
    updated_at: new Date().toISOString() }; };
// o: { position (the site's rank for the keyword), navigational, other_brand, verdict }
function difficultyForYou(kd, reach, o) {
  o = o || {};
  if (o.navigational || o.other_brand || String(o.verdict || '').toUpperCase() === 'AVOID') return 'not_realistic';
  const pos = reachNum(o.position);
  if (pos != null && pos >= 1 && pos <= REACH_CFG.easy_position) return 'easy';
  const r = reachNum(reach) == null ? reachSizeTier(0) : Number(reach);
  const k = reachNum(kd) == null ? r + REACH_CFG.unknown_kd : Number(kd);
  return k <= r + REACH_CFG.easy ? 'easy' : k <= r + REACH_CFG.reachable ? 'reachable' : k <= r + REACH_CFG.hard ? 'hard' : 'very_hard';
}
// ---- B2-1 (2026-10-15, benchmark area 2): the reach measured on ONE TOPIC, not across the whole website ----
// `reach` above is a single number per site: the 75th-percentile difficulty of everything it ranks top 10 for, cached 30 days. The same
// number therefore decided two unrelated plans — "peppol uae" and "erp implementation dubai" (lad_mv5pjt5y4aoa, 2026-10-13: reach 10 from
// a cached 2026-10-08 measurement). The leaders personalise per TOPIC: MarketMuse subtracts a topic-level Topic Authority from the keyword
// difficulty ("If you have no Topic Authority, then your Personalized Difficulty = Keyword Difficulty",
// https://docs.marketmuse.com/reference/personalized-difficulty-and-topic-authority/), and Semrush measures the thematic distance between a
// domain's core topics and the target topic, lowering PKD the closer the match (https://www.semrush.com/blog/ai-keyword-research-updates/).
// reachTopic() does the same from data the run already paid for: the keywords the site ALREADY ranks for that are on this topic. It is used
// only when that evidence is as strong as the site-wide measurement demands (REACH_CFG.min_top10 keywords in the top 10 with a difficulty).
// Below that bar the site-wide reach stays and the caller is told WHY, so no plan quietly rests on a number measured on other topics. There
// is no third direction: absence of on-topic wins is not evidence of inability, so it never invents a penalty of its own.
const REACH_TOPIC_CFG = { max_examples: 6, max_other: 4 };
// the default on-topic test: half of the head's meaningful words (the shape `_radius.js` RAD.headFit uses; the ladder passes that kit in)
const reachTopicMatch = (head) => { const h = overlapTokens(head); const need = Math.max(1, Math.ceil(h.length / 2));
  return (kw) => { if (!h.length) return false; const t = overlapTokens(kw); return t.filter(x => h.includes(x)).length >= need; }; };
/**
 * ranked: [{ keyword, kd, position }] — every keyword the site ranks for that this run saw (null = the pull failed)
 * head: the topic's head keyword · domainReach: the site-wide reach · o: { match (the on-topic test), domain, reason_missing }
 * -> { used, reach, topic_reach, site_reach, on_topic, top10, sample, best, examples, other_topics, reason, note }
 */
function reachTopic(ranked, head, domainReach, o) {
  const opts = o || {};
  const site = reachNum(domainReach) == null ? reachSizeTier(0) : Number(domainReach);
  const match = typeof opts.match === 'function' ? opts.match : reachTopicMatch(head);
  const rows = (ranked || []).filter(r => r && r.keyword && reachNum(r.position) != null);
  const on = rows.filter(r => { try { return !!match(String(r.keyword)); } catch (e) { return false; } });
  const pos = (r) => Number(r.position);
  const top10 = on.filter(r => pos(r) >= 1 && pos(r) <= 10);
  const kds = top10.map(r => reachNum(r.kd)).filter(v => v != null).sort((a, b) => a - b);
  let p75 = null;
  if (kds.length >= REACH_CFG.min_top10) { const i = REACH_CFG.percentile * (kds.length - 1), lo = Math.floor(i), hi = Math.ceil(i); p75 = Math.round(kds[lo] + (kds[hi] - kds[lo]) * (i - lo)); }
  const used = p75 != null;
  const best = on.slice().sort((a, b) => pos(a) - pos(b))[0] || null;
  const examples = top10.slice().sort((a, b) => pos(a) - pos(b)).slice(0, REACH_TOPIC_CFG.max_examples)
    .map(r => ({ keyword: String(r.keyword), position: pos(r), kd: reachNum(r.kd) }));
  const other_topics = rows.filter(r => pos(r) >= 1 && pos(r) <= 10 && on.indexOf(r) < 0).sort((a, b) => pos(a) - pos(b))
    .slice(0, REACH_TOPIC_CFG.max_other).map(r => String(r.keyword));
  const who = String(opts.domain || 'your site');
  const q = '"' + String(head || '') + '"';
  // B1-2: a caller that reuses a stored reach knows WHY there is no list (the pull was not made again); it says that instead of
  // "could not be read", which would blame a failure that never happened.
  const reason = ranked == null ? (String(opts.reason_missing || '') || 'the keywords ' + who + ' ranks for could not be read on this run')
    : !on.length ? 'nothing ' + who + ' ranks for is on this topic'
    : !top10.length ? on.length + ' keyword(s) on this topic rank for ' + who + ', none of them in the top 10 (best #' + (best ? pos(best) : '-') + ')'
    : top10.length + ' keyword(s) on this topic are in the top 10' + (kds.length < top10.length ? ', ' + kds.length + ' of them with a known difficulty' : '')
      + ' - fewer than the ' + REACH_CFG.min_top10 + ' needed to measure a reach on one topic';
  const note = used
    ? 'Measured on this topic: 75% of the ' + kds.length + ' keyword(s) about ' + q + ' that ' + who + ' ranks in the top 10 for have a difficulty of ' + p75
      + ' or lower, so this plan is measured against ' + p75 + ' and not against the site-wide reach of ' + site + '.'
    : 'This plan is measured against your site-wide reach (' + site + '), because ' + reason + '. A reach measured on other topics'
      + (other_topics.length ? ' (' + other_topics.map(k => '"' + k + '"').join(', ') + ')' : '') + ' is weaker evidence for this one: treat the months and the chance below as the optimistic case.';
  return { used, reach: used ? p75 : site, topic_reach: p75, site_reach: site, on_topic: on.length, top10: top10.length, sample: kds.length,
    best: best ? { keyword: String(best.keyword), position: pos(best) } : null, examples, other_topics, reason, note, head: String(head || '') };
}
const reachStrong = (authority, position) => { const p = reachNum(position); return !!(authority && ((Number(authority.top10) || 0) >= 100 || (Number(authority.organic_keywords) || 0) >= 1000)) || (p != null && p >= 1 && p <= REACH_CFG.easy_position); };
// `measured` (R49): reachMeasured(reach info, position); false = no chance band. Left out, the band stays (a caller with no reach info).
function reachPlan(difficulty, strong, measured) {
  const plan_type = { easy: 'direct', reachable: 'short', hard: 'full', very_hard: 'full', not_realistic: 'none' }[difficulty] || 'full';
  const m = plan_type === 'none' ? null : (strong ? REACH_MONTHS_STRONG : REACH_MONTHS)[plan_type];
  return { plan_type, months: m ? m[0] + '-' + m[1] : '', months_range: m ? m.slice() : null, stretch: difficulty === 'very_hard', chance: reachChance(plan_type, difficulty === 'very_hard', measured) };
}
const reachLabel = (difficulty, plan) => [REACH_DIFF_LABEL[difficulty] || '', plan ? REACH_PLAN_LABEL[plan.plan_type] + (plan.stretch ? ' (stretch)' : '') : '', plan && plan.months ? plan.months + ' months' : ''].filter(Boolean).join(' · ');
// DataForSEO Labs calls that measure reach on a cache miss (~$0.03): the site's top-10 keywords with their difficulty, and its size
const reachRequests = (domain, location_code, language_code) => {
  const L = 'https://api.dataforseo.com/v3/dataforseo_labs/google/', t = reachDomain(domain), lang = language_code || 'en';
  return [{ kind: 'reach_ranked', label: 'top-10 keywords of ' + t, endpoint: L + 'ranked_keywords/live',
      body: [{ target: t, location_code, language_code: lang, limit: REACH_CFG.sample, order_by: ['keyword_data.keyword_info.search_volume,desc'], filters: [['ranked_serp_element.serp_item.rank_group', '<=', 10]] }] },
    { kind: 'reach_overview', label: 'size of ' + t, endpoint: L + 'domain_rank_overview/live', body: [{ target: t, location_code, language_code: lang }] }];
};
const reachTaskOk = (x) => !!(x && !x.error && (((x.tasks || [])[0] || {}).status_code || 0) < 40000 && ((x.tasks || [])[0] || {}).status_code);
const reachError = (x) => { if (!x) return 'no response'; const e = x.error; if (e) return String((typeof e === 'object' ? (e.message || e.description || JSON.stringify(e)) : e)).slice(0, 200);
  const t = (x.tasks || [])[0] || {}; return String(t.status_message || x.status_message || 'no data').slice(0, 200) + (t.status_code ? ' (' + t.status_code + ')' : ''); };
// parses the answers of reachRequests (in any order: matched by kind) -> { ranked: [{ keyword, kd, position }] | null, authority | null, errors }
function reachParse(reqs, res) {
  let ranked = null, authority = null; const errors = [];
  (reqs || []).forEach((r, i) => {
    const x = (res || [])[i];
    if (!reachTaskOk(x)) { errors.push(r.label + ': ' + reachError(x)); return; }
    const r0 = ((x.tasks[0].result || [])[0]) || {};
    if (r.kind === 'reach_ranked') ranked = (r0.items || []).map(it => { const kd0 = it.keyword_data || {}; const se = (it.ranked_serp_element || {}).serp_item || {};
      return { keyword: String(kd0.keyword || '').toLowerCase(), kd: (kd0.keyword_properties || {}).keyword_difficulty ?? null, position: se.rank_group ?? null }; });
    if (r.kind === 'reach_overview') { const m = (((r0.items || [])[0] || {}).metrics || {}).organic; authority = m ? { organic_keywords: m.count ?? 0, top3: (m.pos_1 || 0) + (m.pos_2_3 || 0), top10: (m.pos_1 || 0) + (m.pos_2_3 || 0) + (m.pos_4_10 || 0) } : { organic_keywords: 0, top3: 0, top10: 0 }; }
  });
  return { ranked, authority, errors };
}
// rule R1 "one search, one page" — the same words as the web app (app/shared/src/ladders.ts): lower case, one-letter and stop words out, a light
// stem, place names kept; two keywords are the same search when their word sets are equal or 75%+ the same (Jaccard)
const OVERLAP_STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'near', 'me', 'vs', 'is', 'are', 'what', 'how', 'best', 'top', 'your', 'my']);
const overlapTokens = (s) => { const out = []; for (const t of String(s || '').toLowerCase().split(/[^a-z0-9]+/)) { if (t.length <= 1 || OVERLAP_STOP.has(t)) continue;
  const w = t.replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, '').replace(/[^a-z0-9]/g, ''); if (w && !out.includes(w)) out.push(w); } return out; };
const overlapScore = (a, b) => { if (!a.length || !b.length) return 0; const sb = new Set(b); const common = a.filter(t => sb.has(t)).length; return common / (a.length + b.length - common); };
const keywordsOverlap = (a, b) => overlapScore(overlapTokens(a), overlapTokens(b)) >= 0.75;
// ---- what the keyword research is allowed to use, and what its numbers mean (2026-10-13, FIX_PLAN G8; criteria K2 / K4 / K6 / K7) ----
// Three inputs the research was missing, all built from data the run already holds (no extra paid call):
//   * KWI.gscSeeds()     - the site's OWN Search Console queries as discovery seeds: a query that gets impressions while no live page
//                          answers it (the D11 page inventory decides through SM.matchPage) and a striking-distance query (position
//                          8-20). Search Console is the only first-party record of what people really type, so it now seeds the paid
//                          pulls instead of only being read afterwards (K6).
//   * KWI.calibrate()    - the traffic estimate checked against the site's own measured clicks and impressions where it already
//                          ranks, labelled `calibrated` or `modelled`. A modelled number is never presented as measured (K2).
//   * KWI.serpClusters() - keywords grouped when their results pages share enough URLs, each cluster named by its head keyword and
//                          carrying the shared URLs, so one page can target the whole group (K7). Discovery compares the top 10 at 3
//                          shared URLs from results pages the run already fetched (the live checks and the competitors' own ranking
//                          URLs); the keyword ladder (B2-4, 2026-10-15) buys one results page per rung candidate and compares the
//                          TOP 7 at a 40% threshold, the convention's own current numbers (B2-6, `top_n` / `min_overlap`).
// Every function is pure and takes its thresholds as options, so the harness (S52) can drive it directly.
const KWI = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
  const low = (v) => S(v).toLowerCase().replace(/\s+/g, ' ');
  const yes = (v) => v === true || /^(true|1|yes|on)$/i.test(S(v));
  const CFG = {
    min_impressions: 10,        // a query needs this many impressions in the Search Console period before it seeds anything
    striking_min: 8,            // "striking distance": bottom of page 1 to the end of page 2, where one strong page moves the needle
    striking_max: 20,
    target_share: 0.75,         // A-22: a page's own slug / title targets a search at this share of its words (SM.MATCH_MIN)
    off_topic_share: 0.5,       // R35: a ranking page is "about something else" only when its own title / H1 hold less than half of the search's words
    max_seeds: 10,              // how many Search Console queries may be handed to the research as seeds
    period_days: 28,            // the Search Console window the Site Tracker stores (Site_Plan.js ranges.current)
    month_days: 30,
    top_share: 0.3,             // the share of a search a page in the top three takes (the modelled estimate uses the same share)
    min_shared_urls: 3,         // K7: a shared results page means at least this many of the same top-10 URLs
    min_urls: 3,                // a keyword needs this many known top-10 URLs before it can be compared at all
    max_cluster_keywords: 12,
    live_serp_checks: 16,       // K4: how many keywords get a live intent / page-type check (cost-aware cap, see LIVE_MAX)
    live_serp_max: 25,
    // B2-6 (2026-10-15, benchmark area 2, approved by the owner): Keyword Insights, whose convention the shared-URL rule is, now
    // compares the TOP 7 and not the top 10 - "the overlap setting was originally 1-10, it now runs from 1-7 because Google no longer
    // reliably shows 10 traditional links" - at a default threshold of 40% of them (https://docs.keywordinsights.ai/learning-center/
    // the-features/keyword-clustering/). `top_n` cuts every keyword's list to that depth BEFORE anything is compared, and
    // `min_overlap` turns the threshold into a share of it: ceil(7 x 0.4) = 3 of 7. Both default to 0 = off, so the discovery path
    // keeps the top-10 / 3-URL shape it was measured on until the orchestrator re-baselines K7; the ladder (B2-4) passes 7 / 0.4.
    top_n: 0,
    min_overlap: 0,
    // B2-4: how many of a ladder's rung candidates may be sent for a results page of their own, and what one costs. A full ladder
    // plans at most 11 pages (rung limits 4 / 4 / 3) and a page takes at most 7 keywords, so 24 covers more than twice the pages a
    // plan can hold; the rest of the pool would be bought for keywords no page will ever target.
    ladder_serp_checks: 24,
    ladder_serp_max: 30,
    serp_check_usd: 0.002       // one DataForSEO live-advanced SERP at depth 10, the same call the discovery live checks buy
  };
  const bare = (v) => S(v).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '');
  const cap = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  // K4: how many live results-page checks this run may buy. One check is a DataForSEO live-advanced SERP at depth 10 (~$0.002), so the
  // default 16 costs about $0.032 a run against $0.016 at the old fixed 8; the owner may set it per run and it is hard-capped at 25.
  const liveChecks = (requested) => { const n = num(requested); return n == null || n <= 0 ? CFG.live_serp_checks : Math.round(cap(n, 1, CFG.live_serp_max)); };
  // B2-4: the same shape for the ladder's own cap. 0 or a negative number means "make no call at all" (a free run), which is why this
  // one does NOT fall back to the default when it is given a zero: a bound of nothing has to be expressible.
  const ladderChecks = (requested) => { const n = num(requested); if (n == null) return CFG.ladder_serp_checks; if (n <= 0) return 0; return Math.round(cap(n, 1, CFG.ladder_serp_max)); };
  const checkCost = (n) => +((Math.max(0, Number(n) || 0)) * CFG.serp_check_usd).toFixed(4);

  // ---- K6: the site's own Search Console queries as seeds ----
  // rows = seo_query_history rows (the Site Tracker writes one per site, query and 28-day period). Only the newest period counts:
  // the table only grows, so older rows would seed last month's picture.
  const gscSeeds = (rows, o) => {
    const c = { ...CFG, ...(o || {}) };
    const dom = bare(c.domain);
    const all = (Array.isArray(rows) ? rows : []).filter(r => r && S(r.query) && !r.error && (!dom || bare(r.domain) === dom));
    const period = all.reduce((m, r) => S(r.period_end) > m ? S(r.period_end) : m, '');
    const isScraper = typeof c.isScraper === 'function' ? c.isScraper : () => false;
    const isBrand = typeof c.isBrand === 'function' ? c.isBrand : () => false;
    const matchPage = typeof c.matchPage === 'function' ? c.matchPage : () => null;
    const dropped = { scraper: 0, brand: 0, low_impressions: 0, duplicate: 0 };
    const seen = new Set(); const considered = [];
    for (const r of all.filter(r => S(r.period_end) === period).sort((a, b) => (num(b.impressions) || 0) - (num(a.impressions) || 0))) {
      const q = low(r.query); if (!q) continue;
      if (seen.has(q)) { dropped.duplicate++; continue; }
      seen.add(q);
      if (isScraper(q)) { dropped.scraper++; continue; }
      if (isBrand(q)) { dropped.brand++; continue; }
      const impressions = num(r.impressions) || 0, clicks = num(r.clicks) || 0, position = num(r.position) || 0;
      if (impressions < c.min_impressions) { dropped.low_impressions++; continue; }
      // which page, if any, already answers this search: the page inventory first (D11), the page Search Console reports only when
      // the inventory is empty (then it is the best evidence we have, and it is labelled as such)
      const inv = matchPage(q, S(r.page));   // R35: the page Search Console credits wins a tie
      // R12 (2026-10-13, re-rating §3.11): 11 of 25 rows read "no page of yours answers this search" while the same row named a live
      // 200-OK page of the site — one of them ranking #6.2 — because only the slug / title match counted and the URL Search Console
      // itself reports was ignored whenever the inventory was non-empty. A URL on this site is evidence: it is the answering page, with
      // its own label ("the page that gets the impressions does not target this search"), so the report never asks the owner for a second
      // page for a search they already rank for (D11's cannibalisation rule, in the discovery path).
      // R55 (2026-10-16): Search Console reports the bare host for an sc-domain property while the inventory holds the canonical one,
      // so one table linked both. Every site URL printed goes through the site's canonical host (`c.canon`, SM.canonUrl); Google's own
      // URL stays as `gsc_page`.
      const canon = typeof c.canon === 'function' ? c.canon : (u) => u;
      const rowUrl = S(r.page);
      const rowBare = bare(rowUrl);
      const rowOnSite = !!rowUrl && !!rowBare && (!dom || rowBare === dom || rowBare.endsWith('.' + dom));
      const pageUrl = rowOnSite ? S(canon(rowUrl)) : rowUrl;
      // R35 (2026-10-16, re-rating 2026-10-15): a row whose page is on the site is a page that RANKS for the query. It used to be labelled
      // "the page that gets the impressions does not target this search" whenever the literal word matcher failed — 20 rows, 18 of them
      // the D365 F&O page for D365 F&O searches. A page is now called off-target only on evidence about the page itself: its own title /
      // H1 (`c.pageTitleShare`, SM.titleShare) holding less than half of the search's words, and the sentence says what was compared.
      const evidence = rowOnSite && typeof c.pageTitleShare === 'function' ? c.pageTitleShare(rowUrl, q) : null;
      const row_page = (rowUrl && (c.use_row_page || rowOnSite))
        ? { url: pageUrl, title: S(evidence && evidence.title), matched_by: c.use_row_page ? 'search console page' : 'search console' } : null;
      // A-22 (2026-10-17, re-rating 2026-10-17, exec 764): 17 of 79 rows named a different page than the one Search Console reports for the
      // query — "dynamics 365 finance and operations pricing dubai" ranks #9.6 with /dynamics-365-finance-and-operations-uae and the owner was
      // told to improve the VAT article, because the inventory's word match decided first and Google's own page only broke a tie. The page
      // Google ranks for a search (Search Console's query x page row) IS the answer. The word match is the fallback for a row with no page
      // of ours, and is labelled as such; where another page targets the search more closely by its words, both are named (`also`), never
      // swapped. The one exception stays R56: a listing page (the blog index) gets impressions for every article it lists, so the dedicated
      // page behind it answers, and the listing is named beside it.
      const listingOf = typeof c.isListing === 'function' ? c.isListing : () => false;
      const pageScore = typeof c.pageScore === 'function' ? c.pageScore : () => null;
      const ukey = (u) => bare(u) + S(u).toLowerCase().replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
      const invUrl = inv ? S(canon(S(inv.url))) : '';
      const invIsRow = !!inv && !!rowUrl && ukey(invUrl) === ukey(pageUrl);
      const listingRow = rowOnSite && listingOf(rowUrl) && !!inv && !invIsRow && !listingOf(inv.url);
      let answered_by = null;
      if (rowOnSite && !listingRow) {
        answered_by = { ...row_page, basis: 'the page Search Console reports for this search' };
        if (inv && !invIsRow && S(inv.matched_by) !== 'query') {
          const own = pageScore(rowUrl, q);
          if (own == null || (Number(inv.score) || 0) > own + 1e-9) answered_by.also = { url: invUrl, title: S(inv.title), matched_by: S(inv.matched_by), score: inv.score ?? null };
        }
      } else if (inv) {
        answered_by = { url: invUrl, title: S(inv.title), matched_by: S(inv.matched_by) || 'inventory',
          basis: listingRow ? 'the page about this search behind the listing page Google shows for it' : 'matched by its words: Search Console names no page of yours for this search',
          ...(inv.listing ? { listing: inv.listing } : listingRow ? { listing: { url: pageUrl, impressions: impressions,
            note: 'Google currently shows ' + (pageUrl.replace(/^https?:\/\/[^/]+/i, '') || '/') + ' (a listing page) for this search; the page that is about it is ' + (invUrl.replace(/^https?:\/\/[^/]+/i, '') || '/') } } : {}) };
      } else answered_by = row_page;
      const kinds = [];
      const ownScore = rowOnSite ? pageScore(rowUrl, q) : null;   // the ranking page's own words (slug or title / H1): a slug that targets the search is not "about something else"
      const offTopic = !!answered_by && answered_by.matched_by === 'search console' && !invIsRow && !!evidence && evidence.share != null && evidence.share < c.off_topic_share
        && !(ownScore != null && ownScore + 1e-9 >= c.target_share);
      const striking = position >= c.striking_min && position <= c.striking_max;
      const lowPos = position > c.striking_max;
      if (!answered_by) kinds.push('no_page');
      else if (offTopic) kinds.push('page_mismatch');
      else if (!inv && lowPos) kinds.push('low_position');
      if (striking) kinds.push('striking');
      const posTxt = position > 0 ? '#' + (Math.round(position * 10) / 10) : 'unreported';
      const pathTxt = answered_by ? (S(answered_by.url).replace(/^https?:\/\/[^/]+/i, '') || '/') : '';
      // A-22: the second page is named beside Google's own, never instead of it; a page matched by words alone says so
      const alsoTxt = answered_by && answered_by.also ? ' — ' + (S(answered_by.also.url).replace(/^https?:\/\/[^/]+/i, '') || '/') + ' matches the words of this search more closely: keep one page for it and link the other to it' : '';
      // a listing page (the blog index) is what Google shows; the position is ITS position, and the page about the search is named beside it
      const listPath = answered_by && answered_by.listing ? (S(answered_by.listing.url).replace(/^https?:\/\/[^/]+/i, '') || '/') : '';
      const rankTxt = listPath ? 'Google shows ' + listPath + ' (a listing page) at ' + posTxt + ' for it; the page about it is ' + pathTxt + ' (link it from ' + listPath + ')'
        : 'you rank ' + posTxt + ' with ' + pathTxt;
      const basisTxt = answered_by && answered_by.matched_by !== 'search console' && answered_by.matched_by !== 'search console page' && !answered_by.listing ? ' (matched by its words: Search Console names no page of yours for this search)' : '';
      const why = kinds.indexOf('no_page') >= 0 ? 'no page of yours answers this search'
        : kinds.indexOf('page_mismatch') >= 0 ? 'the page that gets the impressions is about something else: ' + (evidence.h1 ? 'its title and H1 share' : 'its title shares') + ' only '
          + evidence.have + ' of the ' + evidence.of + ' words of this search (missing: ' + evidence.missing.join(', ') + ') — you rank ' + posTxt + ' with ' + pathTxt
          + (striking ? ' (striking distance)' : '') + (answered_by.also ? '; ' + (S(answered_by.also.url).replace(/^https?:\/\/[^/]+/i, '') || '/') + ' is the page about it by its words — make that page the clear answer and link it from ' + pathTxt : '; aim that page at it or give the search its own')
        : striking ? rankTxt + ' — striking distance: improve that page' + alsoTxt + basisTxt
        : lowPos ? (listPath ? 'low position: ' + rankTxt : 'low position on ' + pathTxt + ' (you rank ' + posTxt + ' with it)') + ' — improve that page' + alsoTxt + basisTxt
        : 'a page of yours already answers this search (' + pathTxt + (position > 0 ? ', you rank ' + posTxt : '') + ')'
          + (answered_by && answered_by.listing ? ' — Google currently shows ' + (S(answered_by.listing.url).replace(/^https?:\/\/[^/]+/i, '') || '/') + ' for it' : '') + alsoTxt + basisTxt;
      considered.push({ keyword: q, impressions, clicks, position: position > 0 ? Math.round(position * 10) / 10 : null,
        ctr: impressions ? Math.round(clicks / impressions * 1000) / 10 : 0, page: rowOnSite ? pageUrl : rowUrl, gsc_page: rowUrl, on_site: rowOnSite, answered_by, kinds, why,
        period_end: period, period_days: c.period_days, tracked: yes(r.tracked) });
    }
    const wanted = considered.filter(q => q.kinds.length);
    const rank = (x) => x.kinds.indexOf('no_page') >= 0 ? 2 : x.kinds.indexOf('page_mismatch') >= 0 ? 1 : 0;   // R12: a search with no page at all first, then one whose ranking page targets something else
    const order = [...wanted].sort((a, b) => rank(b) - rank(a) || b.impressions - a.impressions);
    return { available: all.length > 0, period_end: period, period_days: c.period_days, rows: all.length, considered: considered.length,
      page_check: (num(c.pages_known) || 0) > 0 ? 'page inventory' : (c.use_row_page ? 'search console page' : 'unavailable'),
      pages_known: num(c.pages_known) || 0,
      queries: wanted, no_page: wanted.filter(q => q.kinds.indexOf('no_page') >= 0), striking: wanted.filter(q => q.kinds.indexOf('striking') >= 0),
      mismatch: wanted.filter(q => q.kinds.indexOf('page_mismatch') >= 0),
      low_position: wanted.filter(q => q.kinds.indexOf('low_position') >= 0),
      // R36 (2026-10-16): EVERY measured search with its page (not only the seeds), so discovery can say "you already rank for this with
      // <page>" for a keyword the providers also returned, instead of recommending a second page for it
      measured: considered.filter(q => q.on_site).slice(0, 500).map(q => ({ keyword: q.keyword, impressions: q.impressions, clicks: q.clicks, position: q.position,
        page: q.page, gsc_page: q.gsc_page, answered_url: q.answered_by ? q.answered_by.url : '' })),
      answered: considered.filter(q => !q.kinds.length && q.answered_by).slice(0, 60),
      seeds: order.slice(0, c.max_seeds).map(q => q.keyword), dropped,
      min_impressions: c.min_impressions, striking_min: c.striking_min, striking_max: c.striking_max };
  };

  // ---- K3: the click loss a results page causes, and where each figure comes from (B1-3, 2026-10-15, benchmark area 1) ----
  // Until today every factor here was an undated constant, and the AI Overview one (0.65 = a 35% loss) was the APRIL 2025 measurement
  // -- "AI Overviews reduced clicks to top-ranking content by 34.5%" -- while the current study, published 2026-02-04 on December 2025
  // data over 300,000 keywords, measures **-58.0% at position 1**, -50.8% at 2 and -46.4% at 3
  // (https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/). The estimate these factors feed is explicitly "what a page in the top
  // three would get" (`top_share`), so the top-three average of that table is the figure that belongs here: it was 1.5x too generous.
  // The other features have no comparable published measurement (the 2025 featured-snippet numbers disagree with each other and with
  // Perficient's "click-neutral" finding), so they stay where they were and are labelled a STATED RULE, not a measurement. Every one of
  // them is named in `CLICK_LOSS` with its basis so a report can print what it applied and why, instead of a bare multiplier.
  const AIO_CTR_2025 = { 1: 0.420, 2: 0.492, 3: 0.536 };   // 1 - the measured loss at each of the top three positions
  const CLICK_LOSS = {
    ai_overview: { factor: +(((AIO_CTR_2025[1] + AIO_CTR_2025[2] + AIO_CTR_2025[3]) / 3).toFixed(3)), basis: 'measured',
      what: 'an AI Overview', source: 'Ahrefs, 300,000 keywords, December 2025 data (published 2026-02-04)',
      url: 'https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/',
      note: 'clicks to position 1 fall 58.0% when an AI Overview is shown (50.8% at 2, 46.4% at 3); this estimate is for a page in the top three, so their average is applied' },
    featured_snippet: { factor: 0.85, basis: 'stated rule', what: 'a featured snippet', source: 'no measurement we could verify; published 2025 studies disagree', url: '' },
    video: { factor: 0.92, basis: 'stated rule', what: 'video results', source: 'no measurement we could verify', url: '' },
    local_pack: { factor: 0.85, basis: 'stated rule', what: 'a local pack', source: 'no measurement we could verify', url: '' },
    shopping: { factor: 0.9, basis: 'stated rule', what: 'shopping results', source: 'no measurement we could verify', url: '' },
  };
  const FEATURE_KEY = { ai_overview: 'ai_overview', featured_snippet: 'featured_snippet', video: 'video', short_videos: 'video',
    local_pack: 'local_pack', map: 'local_pack', shopping: 'shopping', popular_products: 'shopping' };
  // which of the five were seen on this results page, each once, in the order they are listed above
  const lossApplied = (types) => { const seen = new Set((Array.isArray(types) ? types : []).map(x => FEATURE_KEY[S(x).toLowerCase()]).filter(Boolean));
    return Object.keys(CLICK_LOSS).filter(k => seen.has(k)).map(k => ({ key: k, ...CLICK_LOSS[k] })); };
  const featureLoss = (types) => lossApplied(types).reduce((ctr, f) => ctr * f.factor, 1);
  // "an AI Overview (-52% of the clicks, measured: Ahrefs ...)" - one clause per feature, for the note under a traffic figure
  const lossText = (types) => lossApplied(types).map(f => f.what + ' (-' + Math.round((1 - f.factor) * 100) + '% of the clicks, ' + f.basis + (f.source ? ': ' + f.source : '') + ')').join(', ');

  // ---- K2: the traffic number, and where it comes from ----
  // `calibrated`: the site's own measured impressions for this exact search (the Search Console period, scaled to a month) through the
  //               results page's click loss and the share a top-three page takes, never below the clicks the site already gets.
  // `modelled`:   the provider's monthly volume through the same two factors - an estimate of an estimate, named as one.
  // `unknown`:    neither a volume nor a measurement, so no number at all (better than a confident zero).
  const calibrate = (e, o) => {
    const c = { ...CFG, ...(o || {}) };
    const k = e || {};
    const ctr = featureLoss(k.serp_types);
    // B1-3: the figure says which features took clicks off it, how much each one took and whether that number is measured or a rule
    const lossTxt = lossText(k.serp_types);
    const lossNote = lossTxt ? ' Click loss applied: ' + lossTxt + '.' : '';
    // B1-3 (2026-10-15): `num(null)` is 0, not null — Number(null) is 0 and 0 is finite — so a keyword the provider has NO volume for
    // came back as "0 visits a month (modelled)" instead of "no estimate", a confident number where nothing was measured (the R26
    // class). An absent volume is absent; a provider that really reports 0 still reports 0.
    const vol = (k.volume === null || k.volume === undefined || k.volume === '') ? null : num(k.volume);
    const modelled = vol == null ? null : Math.round(vol * ctr * c.top_share);
    const g = (k.gsc && typeof k.gsc === 'object') ? k.gsc : null;
    const impressions = g ? num(g.impressions) : null;
    if (impressions != null && impressions > 0) {
      const clicks = num(g.clicks) || 0;
      const days = num(g.period_days) > 0 ? num(g.period_days) : c.period_days;
      const toMonth = c.month_days / days;
      const traffic_potential = Math.max(Math.round(impressions * toMonth * ctr * c.top_share), Math.round(clicks * toMonth));
      const pos = num(g.position);
      return { traffic_potential, traffic_basis: 'calibrated', modelled_traffic_potential: modelled,
        traffic_note: 'Calibrated with your own Search Console data: ' + Math.round(impressions) + ' impressions and ' + Math.round(clicks)
          + ' click(s) measured for this exact search on your site in ' + Math.round(days) + ' days'
          + (pos ? ' at average position ' + (Math.round(pos * 10) / 10) : '') + '. A page in the top three would take about '
          + traffic_potential + ' visits a month' + (modelled != null ? ' (the modelled estimate from the provider\'s volume is ' + modelled + ').' : '.') + lossNote };
    }
    if (modelled == null) {
      return { traffic_potential: null, traffic_basis: 'unknown', modelled_traffic_potential: null,
        traffic_note: 'No monthly volume from the provider and no Search Console measurement for this search, so no traffic estimate is given.' };
    }
    return { traffic_potential: modelled, traffic_basis: 'modelled', modelled_traffic_potential: modelled,
      traffic_note: 'Modelled, not measured: ' + vol + ' searches a month (a provider estimate) through the click loss of this results page and the share a top-three page takes.' + lossNote };
  };
  // ---- K4: what KIND of page Google actually ranks for this search (B1-5, 2026-10-15, benchmark area 1) ----
  // The intent and the page type came from the AI screen's label (and DataForSEO's `main_intent` behind it). The live results page
  // was already bought for the priority keywords and only its domains, its features and its People Also Ask were kept, so the one
  // piece of evidence that settles the question - the ten pages Google chose - was thrown away. K4's own anchor for a 10 is "the
  // dominant top-10 page type decides, a mismatch is flagged"; Ahrefs tells you to study the top 10 by hand for exactly this.
  // `serpPageTypes` reads the URL and the title of each organic result, with the title first where it is decisive ("best ... ",
  // "how to ...") and the path after it. Nothing is inferred from a domain we have not read, and a result it cannot place is
  // `Other`, counted and never guessed at.
  // F-A1 / A-11 (2026-10-17, re-rating): a title that says it IS a list ("Top 10 ...", "List of ...", "Top IT Consulting Companies in
  // Dubai") is a list wherever it is published - the LinkedIn Pulse listicle of exec 770 was counted as a forum post, so the results page
  // of "dubai it consulting companies" (4 lists of 7) settled nothing and the rung was planned as a service page with no word about it.
  const LIST_TITLE = /\b(?:top\s*\d+\+?|list of)\b|\btop\s+(?:[\w&.-]+\s+){0,4}(?:companies|firms|agencies|providers|consultants|consultancies|vendors|partners|tools|platforms)\b/i;
  const SHAPES = [
    { type: 'Government or official', test: (u, t, d) => /(^|\.)(gov|gov\.[a-z]{2}|gob|govt)(\.|$)/.test(d) || /\.gov($|\.)/.test(d) },
    { type: 'Comparison or list', test: (u, t) => LIST_TITLE.test(t) },
    { type: 'Forum or community', test: (u, t, d) => /(^|\.)(reddit|quora|stackexchange|stackoverflow|linkedin|facebook|x|twitter|medium)\./.test(d) || /\/(forum|community|questions|discussion)\//.test(u) },
    { type: 'Directory or marketplace', test: (u, t, d) => /(^|\.)(g2|capterra|getapp|softwareadvice|trustradius|saashub|clutch|crunchbase|yelp|yellowpages|indiamart)\./.test(d) },
    { type: 'Comparison or list', test: (u, t) => /\b(best|top\s*\d+|vs\.?|versus|alternatives?|comparison|compared)\b/i.test(t) || /\/(best|top|vs|alternatives|compare)[-\/]/.test(u) },
    { type: 'Pricing page', test: (u, t) => /\bpricing\b|\bprice list\b|\bcost(s)?\b.*\b(plans?|pricing)\b/i.test(t) || /\/(pricing|plans|price)(\/|$)/.test(u) },
    { type: 'Guide or article', test: (u, t) => /\b(how to|what is|why|guide|tutorial|checklist|explained|step[- ]by[- ]step|everything you need)\b/i.test(t) || /\/(blog|insights|articles?|news|resources?|learn|guides?|knowledge|academy)(\/|$)/.test(u) },
    { type: 'Service or product page', test: (u, t) => /\/(services?|solutions?|products?|software|platform|industries)(\/|$)/.test(u) || /\b(software|solution|services?|platform)\b/i.test(t) },
    { type: 'Homepage', test: (u) => /^[a-z0-9.-]+\/?$/.test(u) },
  ];
  // what WE would write for it, in the same words, so a mismatch is a real disagreement and not a vocabulary difference
  const OURS = { 'Blog Post': 'Guide or article', Guide: 'Guide or article', 'Pillar Page': 'Guide or article', 'FAQ Page': 'Guide or article',
    'Comparison Page': 'Comparison or list', 'Service Page': 'Service or product page', 'Product Page': 'Service or product page',
    'Landing Page': 'Service or product page', 'Category Page': 'Service or product page', 'Location Page': 'Service or product page',
    'Local Page': 'Service or product page', 'Case Study': 'Guide or article' };
  const shapeOf = (url, title) => {
    const u = urlKey(url), d = bare(url), t = S(title);
    for (const sh of SHAPES) { try { if (sh.test(u, t, d)) return sh.type; } catch (e) {} }
    return 'Other';
  };
  /** results: [{ url, title }] from the live top 10 · o.page_type = the page we plan to write
   *  -> { read, counts, dominant, dominant_count, dominant_share, ours, mismatch, text } */
  const serpPageTypes = (results, o) => {
    const c = { ...CFG, ...(o || {}) };
    const list = (Array.isArray(results) ? results : []).filter(r => r && S(r.url)).slice(0, 10);
    const counts = {};
    for (const r of list) { const k = shapeOf(r.url, r.title); counts[k] = (counts[k] || 0) + 1; }
    const read = list.length;
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const top = ranked[0] || null;
    const ours = OURS[S(c.page_type)] || '';
    // a dominant kind is one at least half the page agrees on, out of at least four results read: below that nobody can call it
    const dominant = top && read >= 4 && top[1] / read >= 0.5 && top[0] !== 'Other' ? top[0] : '';
    const mismatch = !!(dominant && ours && dominant !== ours);
    const text = !read ? 'The results page was not read, so what Google ranks for this search is unknown.'
      : !dominant ? 'Google ranks a mix for this search (' + ranked.map(x => x[1] + ' ' + x[0].toLowerCase()).join(', ') + '), so no page type is settled by the results.'
        : dominant.toLowerCase().replace(/^./, m => m.toUpperCase()) + 's are what Google ranks here: ' + top[1] + ' of the ' + read + ' results read'
          + (ours ? (mismatch ? ', while this plan writes a ' + ours.toLowerCase() + ' - expect to work harder, or write what the results page shows'
            : ', which is what this plan writes') : '') + '.';
    return { read, counts, dominant, dominant_count: top ? top[1] : 0, dominant_share: read ? Math.round((top ? top[1] : 0) / read * 100) : 0,
      ours, mismatch, text };
  };
  const BASIS_TEXT = { calibrated: 'calibrated with your Search Console data', modelled: 'modelled from provider volume', unknown: 'no estimate' };

  // ---- A-24 (2026-10-17, re-rating exec 764): who may stand as a COMPETITOR whose rankings feed keyword discovery ----
  // Discovery took the top three domains of one results page ("erp consultants dubai"), and #2 was naukrigulf.com "ERP Consultant Jobs
  // in UAE - 67 Vacancies": its 300 ranked keywords ("flydubai careers", "dubai iranian hospital", "jobs abu dhabi") were 545 of the
  // 1,168 researched and 224 of the 240 reviewed were rated off-topic. A competitor is a business that sells what the site sells; a job
  // board, a directory / review marketplace, a list of companies, a government portal, a news site or a forum ranks for the search but
  // competes for nothing. Each class is read from the result itself (host, title, URL shape — KWI.shapeOf's rules), never guessed.
  const JOB_HOSTS = /(^|\.)(naukrigulf|naukri|indeed|glassdoor|bayt|monster|monstergulf|foundit|gulftalent|ziprecruiter|jooble|careerjet|simplyhired|wellfound|dubizzle|laimoon|drjobpro|jobsdb|jobstreet|seek|reed|totaljobs|careerbuilder)\./;
  const NEWS_HOSTS = /(^|\.)(khaleejtimes|gulfnews|thenationalnews|thenational|arabianbusiness|zawya|gulfbusiness|emirates247|wam|bloomberg|reuters|forbes|forbesmiddleeast|cnbc|bbc|cnn|nytimes|theguardian|businessinsider|techcrunch|wired|zdnet|computerweekly|itp|economymiddleeast|wamda)\./;
  const DIRECTORY_HOSTS = /(^|\.)(clutch|themanifest|goodfirms|sortlist|designrush|techbehemoths|2gis|yellowpages|yelp|g2|capterra|getapp|softwareadvice|trustradius|saashub|crunchbase|trustpilot|upwork|fiverr|softwaresuggest|gartner|peerspot|serchen|dnb|zoominfo|kompass|hidubai|uaeyp)\./;
  const JOB_TEXT = /\b(jobs?|vacanc(?:y|ies)|careers?|hiring|recruit\w*|salar(?:y|ies))\b/i;
  /** -> '' (a business: may be a competitor) or the class that rules it out */
  const competitorClass = (domain, url, title) => {
    const d = bare(domain || url); if (!d) return 'unknown';
    if (JOB_HOSTS.test(d) || JOB_TEXT.test(S(title)) || /\/(jobs?|careers?|vacanc\w*)(\/|$|-)/i.test(urlKey(url))) return 'job board';
    if (NEWS_HOSTS.test(d)) return 'news or media';
    const shape = shapeOf(S(url) || d, title);
    if (shape === 'Government or official') return 'government';
    if (shape === 'Forum or community') return 'forum or social';
    if (DIRECTORY_HOSTS.test(d) || shape === 'Directory or marketplace') return 'directory or marketplace';
    if (shape === 'Comparison or list') return 'list of companies';
    return '';
  };

  // ---- K7: clusters by shared results pages ----
  // entries: [{ keyword, urls: [top-10 urls], weight, volume }]. A head keyword takes every keyword that shares at least
  // min_shared_urls of its own top-10 URLs; the head is the strongest keyword not already in a cluster, so the cluster can be named
  // after it. Queries and trailing slashes are ignored when URLs are compared (the same page, written two ways).
  const urlKey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const serpClusters = (entries, o) => {
    const c = { ...CFG, ...(o || {}) };
    // B2-6: the depth every list is cut to before it is compared, and the number of shared URLs that depth demands. With `top_n` and
    // `min_overlap` set (the ladder: 7 and 0.4) the threshold is a SHARE of the depth - ceil(7 x 0.4) = 3 of 7 - instead of the flat
    // count discovery still uses, and both numbers travel on every cluster so a report can state what was compared and how deeply.
    const depth = (num(c.top_n) || 0) > 0 ? Math.round(c.top_n) : 0;
    const need = (num(c.min_overlap) || 0) > 0 && depth ? Math.max(1, Math.ceil(depth * c.min_overlap)) : c.min_shared_urls;
    const list = (Array.isArray(entries) ? entries : []).map(e => ({ keyword: low((e || {}).keyword),
      urls: (() => { const u = [...new Set(((e || {}).urls || []).map(urlKey).filter(Boolean))]; return depth ? u.slice(0, depth) : u; })(),
      weight: num((e || {}).weight) || 0, volume: num((e || {}).volume) }))
      .filter(e => e.keyword && e.urls.length >= c.min_urls);
    const byKw = new Map(); for (const e of list) if (!byKw.has(e.keyword)) byKw.set(e.keyword, e);
    const ranked = [...byKw.values()].sort((a, b) => b.weight - a.weight || (b.volume || 0) - (a.volume || 0) || a.keyword.localeCompare(b.keyword));
    const used = new Set(); const clusters = [];
    const built = [];
    for (const head of ranked) {
      if (used.has(head.keyword)) continue;
      const hs = new Set(head.urls); const members = [];
      for (const other of ranked) {
        if (other.keyword === head.keyword || used.has(other.keyword)) continue;
        const shared = other.urls.filter(u => hs.has(u));
        if (shared.length >= need) members.push({ keyword: other.keyword, volume: other.volume, shared_urls: shared.length, shared: shared.slice(0, 3), shared_with_head: shared.length });
      }
      if (!members.length) continue;
      used.add(head.keyword); members.forEach(m => used.add(m.keyword));
      built.push({ head, members });
    }
    // F-A1 / A-9 (2026-10-17, re-rating exec 770): a keyword that meets the rule with a MEMBER of a group but not with its head was left
    // alone and labelled "own results page (no other search Google answers with the same pages)" - "it consulting company dubai" shares
    // 3 of its top 7 with "it consulting company in dubai" (the plan's own threshold) and only 2 with the group's head. The rule is a
    // pair rule, so the label could only be true if every pair was compared. A keyword still alone after the heads have taken their
    // members joins the group of the member it shares the most with (one hop: a keyword that joined this way is never a bridge for the
    // next one), and says through whom it joined and how much it shares with the head.
    if (c.attach !== false) {
      for (const k of ranked) {
        if (used.has(k.keyword)) continue;
        const ks = new Set(k.urls); let best = null;
        for (const g of built) for (const m of [{ keyword: g.head.keyword, urls: g.head.urls }, ...g.members.filter(x => !x.via).map(x => byKw.get(x.keyword))]) {
          if (!m || !Array.isArray(m.urls)) continue;
          const shared = m.urls.filter(u => ks.has(u));
          if (shared.length >= need && (!best || shared.length > best.shared.length)) best = { g, via: m.keyword, shared };
        }
        if (!best) continue;
        const hs = new Set(best.g.head.urls);
        best.g.members.push({ keyword: k.keyword, volume: k.volume, shared_urls: best.shared.length, shared: best.shared.slice(0, 3),
          via: best.via === best.g.head.keyword ? '' : best.via, shared_with_head: k.urls.filter(u => hs.has(u)).length });
        used.add(k.keyword);
      }
    }
    for (const { head, members } of built) {
      members.sort((a, b) => b.shared_urls - a.shared_urls || (b.volume || 0) - (a.volume || 0));
      clusters.push({ head_keyword: head.keyword, keyword_count: members.length + 1, urls_compared: head.urls.length,
        min_shared_urls: need, top_n: depth, min_overlap_pct: depth && (num(c.min_overlap) || 0) > 0 ? Math.round(c.min_overlap * 100) : null,
        total_volume: [head, ...members].reduce((s, m) => s + (num(m.volume) || 0), 0),
        keywords: [{ keyword: head.keyword, volume: head.volume, shared_urls: head.urls.length, shared: [] }, ...members].slice(0, c.max_cluster_keywords) });
    }
    clusters.sort((a, b) => b.keyword_count - a.keyword_count || b.total_volume - a.total_volume);
    // every compared keyword's own list, at the depth it was compared at, so a later step can test any pair by the same rule (A-10)
    const urls_of = {}; for (const e of ranked) urls_of[e.keyword] = e.urls.slice();
    return { clusters, urls_of, keywords_compared: ranked.length, compared_keywords: ranked.map(e => e.keyword), min_shared_urls: need, min_urls: c.min_urls, top_n: depth,
      min_overlap_pct: depth && (num(c.min_overlap) || 0) > 0 ? Math.round(c.min_overlap * 100) : null,
      clustered: clusters.reduce((n, x) => n + x.keyword_count, 0) };
  };
  // R40 (2026-10-16, re-rating 2026-10-15): ONE rule for which keywords may share a page, used by the ladder (Ladder Plan) and by
  // discovery's content plan (Rank Keywords). Exec 610 compared the results pages of all 10 rung keywords, found no two sharing even 2 of
  // their top 7, and still merged "openai consulting" into "ai consulting firm" because the AI's topic label said so. Now:
  //   * Google answers it with the same pages as other keywords (a SERP cluster)  -> one page for the cluster ('shared results page');
  //   * its results page was read and compared and shares with no one             -> its own page ('own results page');
  //   * its results page could not be read or compared                           -> the AI's topic label + page type ('topic label').
  // -> { key, by } ; `o` = { keyword, topic, page_type, serp_head (the cluster head, '' when it is not in a cluster), compared }
  const pageGroup = (o) => { const x = o || {}; const kw = low(x.keyword);
    if (S(x.serp_head)) return { key: 'serp|' + low(x.serp_head), by: 'shared results page' };
    if (x.compared) return { key: 'kw|' + kw, by: 'own results page' };
    return { key: 'topic|' + (low(x.topic) || kw) + '|' + S(x.page_type), by: 'topic label' }; };
  // "one page can serve all three: 'erp software uae' also covers 'erp system uae' (4 of the same top-10 pages), ..."
  const clusterText = (cl) => {
    const c = cl || {}; const others = (c.keywords || []).slice(1);
    if (!others.length) return '';
    const depthTxt = c.top_n ? 'top ' + c.top_n : 'top-10';
    return 'One page can target all ' + c.keyword_count + ': "' + c.head_keyword + '" shares '
      + others.map(k => k.via ? k.shared_urls + ' of the ' + depthTxt + ' pages of "' + k.via + '" with "' + k.keyword + '" (' + (k.shared_with_head ?? 0) + ' with "' + c.head_keyword + '" itself)'
        : k.shared_urls + ' of its ' + depthTxt + ' pages with "' + k.keyword + '"').join(', ')
      + ' - Google answers these searches with the same pages, so a second page would only split the signals.';
  };
  const pageKindOf = (page_type) => OURS[S(page_type)] || '';   // F-A1 / A-11: the kind of page a plan's page type is, in serpPageTypes' words
  return { CFG, CLICK_LOSS, gscSeeds, calibrate, serpClusters, pageGroup, pageKindOf, clusterText, featureLoss, lossApplied, lossText, serpPageTypes, shapeOf, competitorClass, liveChecks, ladderChecks, checkCost, urlKey, BASIS_TEXT, helpers: { bare, low, num } };
})();
const prev = $('Merge Keyword Data').first().json;
const verdict = parseAgentJson($input.first().json.output);

// ---- the page type, as one of the options the form offers (D10, 2026-10-12; the builders inline this file where a node asks for the PAGE_TYPE kit) ----
// The verdict and the keyword screen answer in free text: the live page of execution 365 was planned as "Service Page (ERP implementation
// UAE) with built-in vendor-neutral comparison, cost and compliance sections". That sentence then travelled as the page type into the brief
// (which read it as a guide and set 3,100 words), into the schema and into meta.json. PT.of() maps any such text to one of the fixed options
// and PT.notes() keeps the sentence itself, so nothing the verdict said is lost — it reaches the brief as page_notes instead.
const PT = (() => {
  const TYPES = ['Service Page', 'Product Page', 'Blog Post', 'Landing Page', 'Guide', 'Pillar Page', 'Local Page', 'Case Study'];
  // first match wins by POSITION in the text, not by rule order: "Service Page (…) with built-in vendor-neutral comparison" is a service
  // page that also compares, not a comparison guide.
  const RULES = [[/case stud/i, 'Case Study'], [/\bpillar\b|\bhub\b|topic cluster/i, 'Pillar Page'], [/\blocal\b|city page|area page/i, 'Local Page'],
    [/\bproducts?\b|e-?commerce|\bshop\b|\bstore\b|catalou?g/i, 'Product Page'], [/landing|lead capture|campaign page|squeeze/i, 'Landing Page'],
    [/\bblogs?\b|\bnews\b|\barticles?\b|\bposts?\b/i, 'Blog Post'],
    [/\bguides?\b|how.?to|tutorial|comparison|compare|versus|\bvs\b|\bfaqs?\b|resource|checklist|listicle|round.?up|explainer|glossary/i, 'Guide'],
    [/\bservices?\b|solution|category|collection|offering/i, 'Service Page']];
  const of = (v, dflt) => {
    const t = String(v == null ? '' : v).trim();
    const fallback = TYPES.find(x => x.toLowerCase() === String(dflt || '').trim().toLowerCase()) || 'Service Page';
    if (!t) return fallback;
    const exact = TYPES.find(x => x.toLowerCase() === t.toLowerCase());
    if (exact) return exact;
    let best = null;
    for (const r of RULES) { const i = t.search(r[0]); if (i >= 0 && (!best || i < best.i)) best = { i: i, type: r[1] }; }
    return best ? best.type : fallback;
  };
  // the free text, kept for the brief; empty when it says nothing beyond the type itself (the form's own wording included)
  const SAME = ['pillar / hub page', 'pillar/hub page', 'hub page', 'local page (city or area)', 'case study page'];
  const notes = (v, type) => {
    const t = String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
    if (!t) return '';
    const bare = t.replace(/[.\s]+$/, '').toLowerCase();
    if (bare === String(type || '').toLowerCase() || TYPES.some(x => x.toLowerCase() === bare) || SAME.indexOf(bare) >= 0) return '';
    return t.slice(0, 300);
  };
  return { of: of, notes: notes, TYPES: TYPES };
})();
// 2026-10-12 (FIX_PLAN D10): the verdict answers in free text; the fixed option decides the length band, the schema and
// meta.json, and the sentence itself travels on as page_notes so the brief still hears what the verdict asked for.
const allowed = ['GO', 'GO_WITH_CHANGES', 'AVOID'];
if (!allowed.includes(verdict.verdict)) verdict.verdict = 'GO_WITH_CHANGES';

// ---- a keyword the site already has a page for (P2-5, 2026-10-12; inlined into the v3 node *Parse Verdict* by build_v4.py section 39) ----
// Run 444 asked for a verdict on "uae e invoicing penalties" — a search the site's own /insights/…-uae-e-invoicing-penalties-… page has
// answered since 2026-08-21 — and the answer was "Build an informational penalty guide", recommended_page "Guide": the owner was told to
// create a second URL for a search their page already answers (the exact D11 harm). *Collect Client Pages* now sets `existing_page` from
// the page inventory (SM.matchPage) and `v5/prompts/verdict.txt` forbids a new page; this is the deterministic half of it.
// ---- R7 (2026-10-13, re-rating): no verdict may ask for FAQPage schema (G2 removed it from everything we write) ----
// Live: exec 486 `verdict_changes[3]` said "add … an FAQ with schema matching the People Also Ask questions" and the ladder's exec 495
// `what_must_change[3]` said "Add an FAQ section that mirrors the People Also Ask questions, with FAQ and Service schema". Google stopped
// showing FAQ rich results on 2026-05-07, so the owner would spend time on markup that shows nothing. The prompt now forbids it; this
// rewrites the schema part out of any line that still asks for it and keeps the FAQ *section*, which is what AI assistants quote.
const FAQ_SCHEMA_RE = /\b(?:faq\s*page|faqpage)\b(?:\s+(?:schema|markup|structured\s+data))?|\bfaq\b[^.;]{0,20}?\b(?:schema|markup|structured\s+data)\b|\b(?:schema|markup|structured\s+data)\b[^.;]{0,20}?\bfaq\b/gi;
const noFaqSchema = (line) => {
  let t = String(line == null ? '' : line);
  if (!FAQ_SCHEMA_RE.test(t)) return t;
  FAQ_SCHEMA_RE.lastIndex = 0;
  t = t.replace(/\b(an?\s+)?FAQ\s+with\s+(?:its\s+own\s+)?(?:schema|markup|structured data)\b/gi, '$1FAQ section (question headings answered directly)')
       .replace(/\bwith\s+FAQ\s+and\s+([A-Z][A-Za-z]*)\s+schema\b/g, 'with $1 schema')
       .replace(/\bFAQ\s+and\s+([A-Z][A-Za-z]*)\s+schema\b/g, '$1 schema')
       .replace(/\b(?:an?\s+)?FAQ\s*(?:page)?\s+(?:schema|markup|structured data)\b/gi, 'an FAQ section (question headings answered directly)')
       .replace(/\bFAQPage\b/gi, 'an FAQ section (question headings answered directly)')
       .replace(/\bwith\s+(?:FAQ|FAQPage)\s+(?:schema|markup|structured data)\b/gi, '')
       .replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').replace(/,\s*\./g, '.').trim();
  return t;
};
verdict.risks = (Array.isArray(verdict.risks) ? verdict.risks : []).map(noFaqSchema);
verdict.reasons = (Array.isArray(verdict.reasons) ? verdict.reasons : []).map(noFaqSchema);
// Page-claims kit (R38 / R48, 2026-10-16; inlined by build sections 102 and 103).
// A statement about what the CUSTOMER'S OWN page lacks is a statement about their property, and the verdict made three false ones in one
// sentence (exec 608: "no mandate dates, no tables, no author or date" - the page has all three). `Collect Client Pages` now measures the
// page's facts on the whole page (`existing_page_digest`); this kit is the deterministic half: a negative claim about the page that the
// digest contradicts, or that the digest says could not be checked, is not allowed to reach the customer as a fact.
//   PC.topics(text)            which parts of a page a sentence is about: dates, pubdate, table, author, cta
//   PC.claimsAbsence(text)     does it say something is missing / absent
//   PC.judge(text, digest, o)  { drop, why } - o.scoped: every line is about the client's page (the analyzer's `existing_page_gaps`)
//   PC.filterLines(lines, d, o) -> { lines, dropped }   one line = one statement (arrays of reasons / gaps)
//   PC.filterText(text, d, o)   -> { text, dropped }    sentence by sentence (a paragraph)
//   PC.fta(text)               R48: "FTA-accredited" -> the Ministry of Finance (the UAE's e-invoicing accreditation is the Ministry's)
const PC = (() => {
  const S = (x) => String(x == null ? '' : x);
  const NEG = /\b(?:no|not|without|lacks?|lacking|lack of|missing|absent|doesn['’]?t|does not|isn['’]?t|is not|aren['’]?t|are not|never|zero|nothing|none|yet to|fails? to|omits?)\b/i;
  const HEDGE = /\b(?:in the excerpt|excerpt provided|text provided|provided text|provided excerpt|first part|visible in the text provided|in the text we (?:read|were given))\b/i;
  const TOPIC = [
    ['table', /\btables?\b|comparison (?:chart|matrix)|\bmatrix\b/i],
    ['author', /\bauthors?\b|\bbylines?\b|written by|author box|\bexpert (?:name|bio|credit)/i],
    ['pubdate', /\b(?:publish(?:ed|ing)?|updated?|modified|last[- ]updated|revised|freshness)\b[^.;]{0,30}\bdates?\b|\bdates?\b[^.;]{0,20}\b(?:published|updated|modified)\b|\bpublication dates?\b|\bdatestamps?\b|\bdated\b/i],
    ['dates', /\b(?:mandate|deadline|implementation|compliance|timeline|key|regulatory|go-live|rollout|roll-out)\s+dates?\b|\bdates?\b|\b(?:19|20)\d{2}\b[^.;]{0,20}\b(?:deadline|mandate)\b/i],
    ['cta', /\bCTAs?\b|call[- ]to[- ]action|contact (?:form|details|button|link)|lead (?:form|capture|magnet)|enquiry form|inquiry form|conversion (?:element|path)/i]
  ];
  const CLIENT_REF = /\b(?:existing|current|client['’]?s?|your|our|target (?:url|page)|the (?:insights |blog |service )?(?:page|article|post)|this (?:page|article|post)|its (?:visible |own |current )?(?:text|content|copy)|the url)\b/i;
  const COMP_ONLY = /\b(?:competitors?|rivals?|top[- ]?(?:3|5|10)|ranking pages|the serp|results pages?)\b/i;
  const topics = (text) => {
    const t = S(text), out = [];
    for (const [k, re] of TOPIC) if (re.test(t)) out.push(k);
    // "no author or date" is a statement about the byline and its date
    if (out.indexOf('author') >= 0 && /\bor\s+(?:a\s+)?(?:publication |publish |update )?dates?\b/i.test(t) && out.indexOf('pubdate') < 0) out.push('pubdate');
    return out;
  };
  const claimsAbsence = (text) => NEG.test(S(text));
  const dig = (d) => (d && typeof d === 'object' && d.url !== undefined) ? d : null;
  // one statement, judged against the page's facts; the `why` is the sentence the owner can read in the report
  const judge = (text, digest, o) => {
    const d = dig(digest), t = S(text), opts = o || {};
    if (!d || !t) return { drop: false };
    if (!claimsAbsence(t)) return { drop: false };
    const tp = topics(t);
    if (!tp.length) return { drop: false };
    // a sentence that does not name the client's page (competitors, the results page) is not a claim about it
    if (!opts.scoped && (!CLIENT_REF.test(t) || (COMP_ONLY.test(t) && !/\b(?:existing|current|client['’]?s?|your|our)\b/i.test(t)))) return { drop: false };
    const dates = (d.dates || []), structure = !!d.structure_reliable;
    for (const k of tp) {
      if (k === 'dates' && (dates.length || d.published)) return { drop: true, topic: k, why: 'the page states dates in its text (' + (dates.slice(0, 3).join('; ') || d.published) + ')' };
      if (k === 'table') { if (d.tables > 0) return { drop: true, topic: k, why: 'the page has ' + d.tables + ' table(s)' }; if (!structure) return { drop: true, topic: k, why: 'tables could not be checked: the text reader flattens them and the page\'s HTML was not read in full' }; }
      if (k === 'author') { if (d.author) return { drop: true, topic: k, why: 'the page names its author (' + d.author + ')' }; if (!structure) return { drop: true, topic: k, why: 'a byline could not be checked: the text reader drops it and the page\'s HTML was not read in full' }; }
      if (k === 'pubdate') { if (d.published || d.modified) return { drop: true, topic: k, why: 'the page carries a publication date (' + (d.published || d.modified) + ')' }; if (!structure) return { drop: true, topic: k, why: 'a publication date could not be checked: the page\'s HTML was not read in full' }; }
      if (k === 'cta') { if (d.cta === true) return { drop: true, topic: k, why: 'the page has a call to action' }; if (!structure && d.cta !== false) return { drop: true, topic: k, why: 'a call to action could not be checked: the page\'s HTML was not read in full' }; }
    }
    // a negative claim that rests on "the excerpt provided" is a guess about the rest of the page, whatever it is about
    if (HEDGE.test(t)) return { drop: true, topic: tp[0], why: 'it rests on an excerpt of the page, not on the page' };
    return { drop: false };
  };
  const filterLines = (lines, digest, o) => {
    const kept = [], dropped = [];
    for (const l of (Array.isArray(lines) ? lines : [])) {
      const j = judge(l, digest, o);
      if (j.drop) dropped.push({ text: S(l).slice(0, 300), topic: j.topic, why: j.why }); else kept.push(l);
    }
    return { lines: kept, dropped };
  };
  const filterText = (text, digest, o) => {
    const t = S(text), parts = t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/), kept = [], dropped = [];
    for (const p of parts) {
      const j = judge(p, digest, o);
      if (j.drop) dropped.push({ text: p.slice(0, 300), topic: j.topic, why: j.why }); else kept.push(p);
    }
    return { text: kept.join(' ').trim(), dropped };
  };
  // R48: in the UAE the Ministry of Finance accredits e-invoicing service providers (the Federal Tax Authority administers the tax); vendors' own pages say "FTA-accredited"
  const fta = (text) => S(text)
    .replace(/\bFTA[-\s]accredited\b/g, 'Ministry of Finance-accredited').replace(/\bFTA[-\s]accredit(ation)\b/gi, 'Ministry of Finance accreditation')
    .replace(/\baccredited by the (?:UAE )?(?:Federal Tax Authority|FTA)\b/gi, 'accredited under the Ministry of Finance\'s e-invoicing framework');
  return { topics, claimsAbsence, judge, filterLines, filterText, fta };
})();
// ---- R38 / R48 (2026-10-16): what the verdict says about the client's own page is checked against what was measured on that page ----
// Exec 608: reasons[3] said "Its visible text has no mandate dates, ... no tables, ... no author or date" about a page that has all three.
// The Verdict Agent now reads the page's facts; this removes any sentence of its reasons / risks that the digest still contradicts (or that
// the digest says could not be checked) and says so in `page_claims_dropped`. R48: "FTA-accredited" -> the Ministry of Finance's framework.
const PCD = prev.existing_page_digest || null;
const page_claims_dropped = [];
const pcClean = (arr) => (Array.isArray(arr) ? arr : []).map(x => { const r = PC.filterText(x, PCD, {}); r.dropped.forEach(d => page_claims_dropped.push(d)); return PC.fta(r.text); }).filter(Boolean);
verdict.risks = pcClean(verdict.risks);
verdict.reasons = pcClean(verdict.reasons);

// ---- R18 (2026-10-14, FIX_PLAN §3.12): a feasibility score computed on a results page nobody could read ----
// Execution 549: both SERP calls answered 40101 inside an HTTP 200, were billed, ran once — and the run still said
// "winnable, GO_WITH_CHANGES 68" and wrote a page. The retry is wired above; when it fails too, the competition was never seen,
// so there is no verdict and no number — only what was tried, and the suggestion to run the check again.
const EV56 = (() => {
  const sf = prev.serp_features || {}; const ev = prev.serp_evidence || null; const kd = prev.keyword_data_evidence || null;
  const out = !!(sf.unavailable || (ev && ev.unavailable));
  const why = String((ev && ev.error) || sf.error || 'no answer from the search data provider').slice(0, 160);
  const again = (ev && ev.retried) ? ' The search was sent again once and failed again.' : '';
  return {
    withheld: out,
    evidence: { serp: out ? 'unavailable' : 'read', error: out ? why : '', asked: ev ? ev.asked : 1, checked: ev ? ev.checked : (out ? 0 : 1),
      retried: ev ? ev.retried : 0, keyword_data: (kd && kd.unavailable) ? 'unavailable' : 'read' },
    reason: out ? 'No score is given for this keyword: the live Google results could not be read (' + why + ').' + again
      + ' Nobody has seen the pages that rank, the featured snippet or the AI Overview, so any number here would be invented. Run the check again.' : ''
  };
})();
// ---- B1-1 (2026-10-15, benchmark area 1): the two numbers the keyword report puts in front of a customer ----
// They used to be whatever the Verdict Agent typed into its JSON. The same run computes both properly: `_reach.js` turns a keyword
// difficulty and this site's reach into a plan with a month RANGE and an uncalibrated chance band against a published base rate, and
// `KWI.calibrate` turns a monthly volume into visits through the measured click loss of the results page that was actually read.
const KD77 = (prev.keyword_data || {}).keyword_difficulty ?? null;
const VOL77 = (prev.keyword_data || {}).search_volume ?? null;
const SF77 = prev.serp_features || {};
const SERP_READ77 = SF77.unavailable !== true;
let CACHE77 = []; try { CACHE77 = $('Load Site Cache').all().map(i => i.json); } catch (e) { CACHE77 = []; }
// the site's reach: the stored measurement (30 days, same market) or, failing that, the size tier of the authority this run already
// read. Never a fresh paid pull: a keyword report does not buy the ranked-keywords list.
const RI77 = reachCached(CACHE77, prev.domain, prev.location_code) || { ...reachFrom(null, prev.site_authority || null), ranked: null, cached: false };
const TA77 = reachTopic(RI77.ranked === undefined ? null : RI77.ranked, prev.keyword, RI77.reach, { domain: prev.domain || 'your site',
  reason_missing: RI77.cached ? 'the reach stored on ' + String(RI77.cached_at || '').slice(0, 10) + ' was kept without the keywords behind it, so this report has no topic evidence to read'
    : 'a keyword report does not buy the list of keywords your site ranks for (the keyword research and the ladder do)' });
const DIFF77 = prev.domain ? difficultyForYou(KD77, TA77.reach, {}) : null;
const PLAN77 = DIFF77 ? reachPlan(DIFF77, reachStrong(RI77, null), reachMeasured(TA77 && TA77.used ? { used: true } : RI77, null)) : null;   // R49: no chance band on a reach no measured ranking supports
const FORYOU77 = !DIFF77 ? null : { difficulty_for_you: DIFF77, plan_type: PLAN77.plan_type, months: PLAN77.months, months_range: PLAN77.months_range,
  stretch: PLAN77.stretch, chance: PLAN77.chance, reach_used: TA77.reach, reach_basis: TA77.used ? 'topic' : 'site',
  site_reach: TA77.site_reach, topic_reach: TA77.topic_reach, kd_known: KD77 != null,
  label: reachLabel(DIFF77, PLAN77.plan_type === 'none' ? null : PLAN77) + (TA77.used ? ' \u00b7 measured on this topic' : ''),
  note: TA77.note + (KD77 == null ? ' This keyword has no measured difficulty either, so it is counted as that reach + ' + REACH_CFG.unknown_kd + '.' : '') };
const TTR77 = (!PLAN77 || PLAN77.plan_type === 'none') ? null : { months: PLAN77.months, months_range: PLAN77.months_range, basis: 'modelled',
  chance: PLAN77.chance, note: reachChanceText(PLAN77), base_rate: REACH_BASE_RATE, model_months: verdict.time_to_rank_months ?? null };
// the visits a page in the top three would take. A results page nobody could read yields NO estimate: what it takes in clicks before
// anyone reaches a link is exactly what was not seen.
const VIS77 = (() => {
  const model = verdict.expected_monthly_visits_top3 ?? null;
  if (!SERP_READ77) return { visits: null, basis: 'unknown', basis_text: 'not estimated: the live results page could not be read, so the clicks it takes before anyone reaches a link are unknown',
    note: 'No visit estimate: the live Google results could not be read (' + String(SF77.error || 'no answer').slice(0, 120) + ').', model_estimate: model, loss_applied: '' };
  const c = KWI.calibrate({ volume: VOL77, serp_types: SF77.features_present || [] }, {});
  const basis_text = c.traffic_basis === 'calibrated' ? 'calibrated with your own Search Console data'
    : c.traffic_basis === 'modelled' ? 'modelled from the provider\'s monthly volume, after this results page\'s click loss'
    : 'not estimated: no monthly search volume was measured for this keyword';
  return { visits: c.traffic_potential, basis: c.traffic_basis, basis_text, note: c.traffic_note, model_estimate: model, loss_applied: KWI.lossText(SF77.features_present || []) };
})();
const EXP = (prev.existing_page && prev.existing_page.url) ? prev.existing_page : null;
let verdict_changes = Array.isArray(verdict.what_must_change) ? verdict.what_must_change.map(x => PC.fta(noFaqSchema(x))).filter(Boolean) : [];   // R7: never FAQPage schema
let existing_page_action = null;
if (EXP) {
  existing_page_action = 'improve';
  // a line that explicitly asks for a SECOND URL is dropped; a line that asks for work ("Build an informational penalty guide of about
  // 1,800 words …", the live answer of run 444) is kept but addressed to the page that exists, so no advice and no word target is lost.
  const NEW_URL_RE = /\b(?:new|second|separate|dedicated|additional|another|standalone|stand-alone)\s+(?:page|url|post|article)\b|\b(?:publish|create|build|launch|spin up)\s+an?\s+(?:new\s+)?(?:page|url)\b/i;
  const CREATE_RE = /^(?:please\s+)?(?:build|create|write|publish|launch|produce|develop|make|add|set up)\b/i;
  const WORDS_RE = /\b(\d[\d,]{2,5})\s*words?\b/i;
  const dropped = verdict_changes.filter(c => NEW_URL_RE.test(c));
  verdict_changes = verdict_changes.filter(c => !NEW_URL_RE.test(c))
    .map(c => CREATE_RE.test(c) ? c.replace(CREATE_RE, (m) => 'On that page, ' + m.toLowerCase()) : c);
  // the length the verdict asked for is the brief's clamp (D10): never lose it with the line that happened to carry it
  const lostWords = dropped.map(c => (c.match(WORDS_RE) || [])[1]).filter(Boolean)[0];
  if (lostWords && !verdict_changes.some(c => WORDS_RE.test(c))) verdict_changes.push('Aim for about ' + lostWords + ' words on that page.');
  verdict_changes.unshift('Improve the page the site already has for this search (' + EXP.url + '): update and expand it, keep its URL, and do not publish a second page for this keyword.');
}

// ---- A-5 / A-6 / A-23 (2026-10-17, re-rating execs 760 / 765): the verdict's advice checked against what the site already holds ----
// (inlined into *Parse Verdict* by build_v4.py section 130, after the existing-page rules; reads `prev.own_coverage` from *Own Coverage
// (Run)*, the site model's pages and the existing page's whole text.) Four deterministic checks, each reported, nothing silently dropped:
//   1. a secondary keyword another page, a ladder or a written draft of the site already holds is taken off this page and named (A-5:
//      five planned pages of the ladder "e invoicing in uae" and the draft "uae e-invoicing deadline 2027"; A-23: the slug of the live
//      Business Central page, a rung of "erp software uae", a variant of "erp implementation dubai");
//   2. with no page of its own for the search, a change that says "build a ... page" is preceded by the pages the site already has on
//      that topic, read from their titles (A-23: /dynamics-365-business-central-uae and /dynamics-365-finance-and-operations-uae);
//   3. a change that asks for a section on a topic a rung or a draft of the site covers names it ("a penalties section" beside the
//      penalties rung and article, A-5);
//   4. an amount the change asks to "add" that the page already states is moved out of the request (A-6: "the AED 50 million threshold").
const OWNV = (() => {
  const cov = prev.own_coverage && typeof prev.own_coverage === 'object' ? prev.own_coverage : null;
  const model = prev.site_model && typeof prev.site_model === 'object' ? prev.site_model : null;
  const res = { secondary: (Array.isArray(verdict.secondary_keywords) ? verdict.secondary_keywords : []).map(s => String(s || '').trim()).filter(Boolean),
    covered: [], related: [], sections: [], already_on_page: [], keyword_covered: null, checked: !!cov };
  const pathOf = (u) => String(u || '').replace(/^https?:\/\/[^/]+/i, '') || '/';
  // 4 (first). an amount the change asks to add that the page already states (A-6)
  const pageText = String(prev.existing_page_text || '').toLowerCase().replace(/\s+/g, ' ');
  if (EXP && pageText) {
    const AMT = /\b(?:aed|usd|eur|gbp|sar|dhs?)\s?\d[\d,.]*\s*(?:million|billion|thousand|bn|m|k)?\b|\$\s?\d[\d,.]*\s*(?:million|billion|thousand|bn|m|k)?\b|\b\d[\d,.]*\s*(?:million|billion)\b/gi;
    const forms = (m) => { const t = m.toLowerCase().replace(/\s+/g, ' ').trim(); const out = [t];
      const n = t.match(/(\d[\d,.]*)\s*(million|billion|m|bn)?/); if (n) { const u = n[2] === 'm' ? 'million' : n[2] === 'bn' ? 'billion' : n[2] || ''; out.push(t.replace(/\s*(million|billion|m|bn)\b/, u ? ' ' + u : ''), n[1] + (u ? ' ' + u : '')); }
      return [...new Set(out)].filter(f => f.length >= 3); };
    verdict_changes = verdict_changes.map(line => {
      if (!/\b(?:add|include|state|mention|cover|explain)\b/i.test(line)) return line;
      const items = line.split(/,\s*(?:and\s+)?|;\s*|:\s+/);
      let out = line; const kept = [];
      for (const it of items) { const ms = it.match(AMT) || []; if (!ms.length) continue;
        if (!ms.every(m => forms(m).some(f => pageText.includes(f)))) continue;
        const item = it.trim().replace(/[.\s]+$/, ''); if (!item || item.length > 120) continue;
        const re = new RegExp('(,\\s*(?:and\\s+)?|\\s+and\\s+)?' + item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const next = out.replace(re, ''); if (next === out) continue;
        out = next; kept.push(item); }
      if (!kept.length) return line;
      kept.forEach(k => res.already_on_page.push(k));
      return out.replace(/\s+([,.;])/g, '$1').replace(/,\s*\./g, '.').replace(/\s*$/, '') + ' Already on the page, keep as it is: ' + kept.join('; ') + '.';
    });
  }
  if (cov) {
    const expUrl = EXP ? EXP.url : '';
    const self = cov.self || { ladder_id: prev.ladder_id || '', keyword: prev.keyword };
    const ctx = { matchPage: model ? (k) => SM.matchPage(model, k) : null, ladders: cov.ladders || [], drafts: cov.drafts || [],
      exclude_urls: [expUrl, self.target_url || prev.ladder_target_url || ''], self, page_min: 1 };
    // 0. the search itself: a ladder or a draft of the site may already hold it (A-23: "erp system dubai" is the rung "erp software dubai"
    //    of the ladder "erp software uae" in other words) - said first, so nobody writes a second page for it
    const selfClaim = EXP ? null : (OWN.ladderOf(ctx.ladders, prev.keyword, { self, min: 'other words' }) || OWN.draftOf(ctx.drafts, prev.keyword, { self_keyword: self.keyword }));
    if (selfClaim) { res.keyword_covered = { by: selfClaim.kind, ladder_id: selfClaim.ladder_id || null, head_keyword: selfClaim.head_keyword || null, keyword: selfClaim.keyword, status: selfClaim.status, how: selfClaim.how, note: OWN.sayOf(selfClaim) };
      verdict_changes.unshift('This search is already planned on the site: ' + OWN.sayOf(selfClaim) + ' is ' + selfClaim.how + '. Write or improve that page rather than a second one for it.'); }
    // 1. secondary keywords
    const keep = [];
    for (const s of res.secondary) {
      if (OWN.relate(s, prev.keyword)) { keep.push(s); continue; }   // the page's own search in other words stays on it
      const c = OWN.claim(s, ctx);
      if (c && c.relation !== 'other place') res.covered.push({ keyword: s, by: c.kind, url: c.url || c.target_url || '', ladder_id: c.ladder_id || null,
        head_keyword: c.head_keyword || null, status: c.status || null, how: c.how, note: OWN.sayOf(c) });
      else keep.push(s);
    }
    res.secondary = keep;
    // 2. "build a page" beside the pages the site already has on that topic (only when the search has no page of its own)
    const BUILD_RE = /\b(?:build|create|write|publish|launch|develop|make|set up)\b[^.;]{0,120}?\b(?:page|landing page|hub|guide|article|post)\b/i;
    const titleTerms = (p) => OWN.distinct(String(p.title || '').replace(/\s*[|–—]\s*[^|–—]{1,30}$/, ''), '');
    if (!EXP && model) {
      const ask = verdict_changes.find(l => BUILD_RE.test(l) && !/^This search is already planned on the site/.test(l));   // the model's own request, not our note
      if (ask) {
        const lt = new Set(OWN.tokens(ask).map(t => t === 'system' ? 'software' : t));
        res.related = SM.pages(model).filter(p => !SM.isListing(p.url)).map(p => { const tt = titleTerms(p); const hit = tt.filter(t => lt.has(t)).length;
          return { url: SM.canonUrl(model, p.url), title: String(p.title || '').replace(/\s*[|–—]\s*[^|–—]{1,30}$/, ''), hit, of: tt.length }; })
          .filter(p => p.of >= 2 && p.hit >= 2 && p.hit / p.of >= 0.75).sort((a, b) => b.hit / b.of - a.hit / a.of || b.hit - a.hit).slice(0, 4);
        const at = /^This search is already planned on the site/.test(verdict_changes[0] || '') ? 1 : 0;
        if (res.related.length) verdict_changes.splice(at, 0, 'Before building anything new: the site already has ' + res.related.map(p => pathOf(p.url) + (p.title ? ' ("' + p.title + '")' : '')).join(' and ')
          + ' on this topic. Improve and link those first; a new page is worth it only for a search none of them targets, and it must link to them.');
      }
    }
    // 3. a section on a topic a rung or a draft of the site covers
    const holders = [...(cov.ladders || []).filter(e => !(self.ladder_id && e.ladder_id === self.ladder_id && e.keyword === String(self.keyword || '').toLowerCase()))
      .map(e => ({ text: e.keyword, say: OWN.sayOf({ kind: 'ladder', ...e }), url: model ? ((SM.matchPage(model, e.keyword) || {}).url || '') : '' })),
      ...(cov.drafts || []).filter(d => d.keyword !== String(prev.keyword || '').toLowerCase()).map(d => ({ text: d.keyword, say: OWN.sayOf({ kind: 'draft', ...d }), url: '' }))];
    const kwCore = OWN.distinct(prev.keyword, '');
    const onTopic = (t) => { const tt = OWN.tokens(t); return kwCore.some(w => tt.includes(w)); };
    verdict_changes = verdict_changes.map(line => {
      const lt = new Set(OWN.tokens(line)); const notes = [];
      for (const h of holders) { const d = OWN.distinct(h.text, prev.keyword).filter(t => t.length >= 5); if (!d.length || d.length > 2 || !d.every(t => lt.has(t))) continue;
        if (!onTopic(h.text) || notes.some(n => n.topic === h.text)) continue;   // a rung of another topic is not this page's business
        notes.push({ topic: h.text, say: h.say + (h.url && (!EXP || OWN.ukey(h.url) !== OWN.ukey(EXP.url)) ? ', page ' + pathOf(h.url) : '') }); if (notes.length >= 2) break; }
      if (!notes.length) return line;
      notes.forEach(n => res.sections.push({ line: line.slice(0, 120), topic: n.topic, by: n.say }));
      return line.replace(/\s*$/, '') + ' (The site already covers ' + notes.map(n => '"' + n.topic + '": ' + n.say).join('; ') + ' — keep it to a short summary here that links there, not a full section.)';
    });
  }
  if (res.covered.length) verdict_changes.push('Kept off this page because the site already holds ' + (res.covered.length === 1 ? 'it' : 'them') + ': '
    + res.covered.slice(0, 8).map(c => '"' + c.keyword + '" (' + c.note + ')').join('; ') + '. Two pages for one search split the signals — link to those pages instead.');
  return res;
})();
// ---- F-A1 / A-21 (2026-10-17, re-rating execs 770 / 771): the same keyword, read twice, says that it was read twice ----
// The ladder run scored "it consulting dubai" 52 with "No AI Overview was seen in the check at 16:09 UTC"; the page run it spawned three
// minutes later read the same results page again and scored it 48 with "An AI Overview was seen in the check at 16:12 UTC" - and neither
// report mentioned the other. A results page does change between readings, so the second reading is not wrong; what was wrong is two
// numbers for one keyword with no word between them. *Spawn Page Runs* now hands the main page's run what the ladder measured
// (`ladder_measure`: score, check time, AI Overview, features) and this block, inlined into *Parse Verdict*, says that this run
// re-measured, when each reading was taken, what the results page showed differently, and that the page is written against the newer one.
const LM21 = (prev.ladder_measure && typeof prev.ladder_measure === 'object') ? prev.ladder_measure : null;
let ladder_remeasure = null;
if (LM21 && String(LM21.keyword || '').toLowerCase().trim() === String(prev.keyword || '').toLowerCase().trim() && !EV56.withheld) {
  const sfR = prev.serp_features || {};
  const clock = (t) => { const m = String(t || '').match(/T(\d\d:\d\d)/); return m ? m[1] + ' UTC' : 'an earlier time'; };
  const nowAt = String(sfR.checked_at || ((sfR.ai_overview || {}).seen_at) || '');
  const nowAio = ((sfR.ai_overview || {}).present) === true, thenAio = LM21.ai_overview === true;
  const nowScore = verdict.score ?? null, thenScore = (LM21.score === '' || LM21.score == null) ? null : Number(LM21.score);
  const featsNow = (Array.isArray(sfR.features_present) ? sfR.features_present : []).map(String).filter(f => f !== 'ai_overview');
  const featsThen = (Array.isArray(LM21.features) ? LM21.features : []).map(String).filter(f => f !== 'ai_overview');
  const changed = [];
  if (thenAio !== nowAio) changed.push(nowAio ? 'an AI Overview was seen this time, and none in the plan\'s reading' : 'no AI Overview was seen this time, while the plan\'s reading had one');
  const added = featsNow.filter(f => !featsThen.includes(f)), gone = featsThen.filter(f => !featsNow.includes(f));
  if (added.length) changed.push('new on the page: ' + added.join(', '));
  if (gone.length) changed.push('gone from the page: ' + gone.join(', '));
  const moved = thenScore != null && nowScore != null && Number(nowScore) !== thenScore;
  const text = 'Re-measured: the ladder plan read this results page at ' + clock(LM21.checked_at) + (thenScore != null ? ' and scored this keyword ' + thenScore : '')
    + '; this page run read it again at ' + clock(nowAt) + (nowScore != null ? ' and scores it ' + nowScore : '') + '. '
    + (changed.length ? 'What the results page showed differently: ' + changed.join('; ') + '. '
      : (moved ? 'The results-page features read the same both times, so the difference is the judgement of the competing pages, made again on this reading. ' : ''))
    + 'A results page changes between readings; this page is written against the newer one.';
  ladder_remeasure = { then: { score: thenScore, checked_at: String(LM21.checked_at || ''), ai_overview: thenAio, features: featsThen },
    now: { score: nowScore, checked_at: nowAt, ai_overview: nowAio, features: featsNow }, score_moved: moved, changed, text };
  verdict.reasons = [...(Array.isArray(verdict.reasons) ? verdict.reasons : []), text];
}

return [{
  json: {
    ...prev,
    verdict: EV56.withheld ? 'NOT_CHECKED' : verdict.verdict,
    verdict_score: EV56.withheld ? null : (verdict.score ?? null),
    verdict_evidence: EV56.evidence,
    ladder_remeasure,   // A-21
    score_withheld: EV56.withheld,
    score_withheld_reason: EV56.reason,
    verdict_reasons: EV56.withheld ? [EV56.reason, ...(verdict.reasons || [])] : (verdict.reasons || []),
    verdict_risks: verdict.risks || [],
    recommended_page: PT.of(verdict.recommended_page || prev.page_type, prev.page_type),
    page_notes: PT.notes(verdict.recommended_page, PT.of(verdict.recommended_page || prev.page_type, prev.page_type)),
    secondary_keywords: OWNV.secondary,
    secondary_covered: OWNV.covered,   // A-5: the searches the site already holds elsewhere, kept off this page and named
    existing_related: OWNV.related, sections_covered: OWNV.sections, already_on_page: OWNV.already_on_page, keyword_covered: OWNV.keyword_covered, own_coverage_checked: OWNV.checked,
    verdict_changes,
    page_claims_dropped,
    verdict_exclusions: EXC.fromVerdict(verdict_changes, verdict.topics_to_skip),   // A-18: what this page must not cover
    existing_page_action,
    expected_visits_top3: EV56.withheld ? null : (VIS77.visits ?? null),
    expected_visits: EV56.withheld ? null : VIS77,
    time_to_rank_months: EV56.withheld ? null : (verdict.time_to_rank_months ?? null),   // kept for the ladder and older readers: it is the MODEL's own number and every surface now says so
    time_to_rank: EV56.withheld ? null : TTR77,
    for_you: EV56.withheld ? null : FORYOU77,
    reach_info: FORYOU77 ? { reach: RI77.reach, method: RI77.method, cached: !!RI77.cached, cached_at: RI77.cached_at || null, evidence_kept: !!RI77.ranked } : null
  }
}];