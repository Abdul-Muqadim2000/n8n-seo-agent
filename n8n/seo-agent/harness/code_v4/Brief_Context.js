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
const FIT_GENERIC = new Set(['software', 'softwares', 'services', 'service', 'erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'tax', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll', 'finance', 'financial', 'cloud', 'digital', 'online', 'web', 'data', 'tech', 'technology', 'technologies', 'solutions', 'solution', 'systems', 'system', 'business', 'company', 'group', 'global', 'international', 'gulf', 'arab', 'arabia', 'emirates', 'national', 'consulting', 'consultants', 'consultancy', 'partners', 'partner', 'network', 'news', 'blog', 'guide', 'guides', 'info', 'best', 'top', 'free', 'app', 'apps', 'shop', 'store', 'market', 'media', 'academy', 'institute', 'university', 'school', 'bank', 'pay', 'pro', 'plus', 'hub', 'one', 'first', 'smart', 'easy', 'get', 'go', 'ae', 'com', 'net', 'org', 'home', 'house', 'world', 'city', 'daily', 'times', 'post', 'review', 'reviews', 'compare', 'comparison', 'list', 'directory', 'jobs', 'careers', 'wiki', 'wikipedia', 'youtube', 'linkedin', 'facebook', 'instagram', 'twitter', 'reddit', 'quora', 'medium', 'google', 'microsoft', 'amazon', 'apple']);
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
  // 6. relevance to the website's services (G19): not built yet — the hook
  if (typeof ctx.relevance === 'function') { const r = ctx.relevance(kw); if (r && r.ok === false) return { ok: false, reason: r.reason || 'off topic', detail: r.detail || '' }; }
  return { ok: true };
}
// one line for reports and prompts: "facts (facts.ae), cleartax (cleartax.com), Zoho Books (zoho.com)"
const fitBrandList = (ctx, protect) => { const out = []; const seen = new Set(); const add = (s) => { if (s && !seen.has(s)) { seen.add(s); out.push(s); } };
  for (const d of (ctx.competitors || [])) for (const l of fitLabels(d, protect)) add(l + ' (' + fitHost(d) + ')');
  for (const d of (ctx.serp_domains || [])) for (const l of fitLabels(d, protect)) add(l + ' (' + fitHost(d) + ')');
  for (const [n, d] of Object.entries(ctx.brands || {})) add(n + ' (' + fitHost(d) + ')');
  return out.slice(0, 40).join(', '); };
// ---- anchor kit (D9, 2026-10-11; inlined through the __ANCHOR__ marker): the words a link to one of our own pages is written with.
// Live, "Guides in this series" linked to "Facts erp" and "Erp software dubai" — a raw keyword string with one capital letter (exec 365).
// anchorText() uses the page's own title when we have one, else title-cases the keyword and keeps acronyms: a token that is already
// all-caps and at most 4 letters is left alone, a known acronym (erp, uae, vat, crm, …) is upper-cased, mixed-case names keep their shape,
// and the small joining words stay lower-case unless they start the anchor. Regex only (no URL constructor in the n8n Code sandbox).
const ACRONYMS = new Set(['erp', 'uae', 'vat', 'crm', 'seo', 'sem', 'ppc', 'api', 'ai', 'bi', 'hr', 'it', 'ui', 'ux', 'qa', 'b2b', 'b2c', 'd2c', 'ksa', 'gcc', 'eu', 'uk', 'us', 'usa', 'uae', 'pos', 'edi', 'gst', 'trn', 'asp', 'sme', 'smb', 'cms', 'roi', 'kpi', 'sla', 'ocr', 'cfo', 'ceo', 'cto', 'coo', 'cio', 'rfp', 'rfq', 'kyc', 'aml', 'iso', 'xml', 'json', 'csv', 'pdf', 'url', 'sap', 'wps', 'fta', 'llm', 'rpa', 'mrp', 'scm', 'plm', 'eam', 'etl', 'pim', 'epm', 'ocr', 'vpn', 'sso', 'mfa', 'cpa', 'cfa', 'ifrs', 'gaap', 'nda', 'tco', 'sku', 'erp']);
const ANCHOR_MIXED = { saas: 'SaaS', paas: 'PaaS', iaas: 'IaaS', ecommerce: 'eCommerce', zatca: 'ZATCA', peppol: 'Peppol', emaratax: 'EmaraTax', iphone: 'iPhone', ipad: 'iPad', javascript: 'JavaScript', wordpress: 'WordPress', youtube: 'YouTube', linkedin: 'LinkedIn', chatgpt: 'ChatGPT', openai: 'OpenAI', netsuite: 'NetSuite', quickbooks: 'QuickBooks', powerbi: 'PowerBI' };
const ANCHOR_SMALL = new Set(['a', 'an', 'and', 'the', 'of', 'for', 'in', 'on', 'to', 'at', 'by', 'or', 'vs', 'via', 'with', 'from', 'into', 'per']);
function titleCaseKeyword(s) {
  const words = String(s == null ? '' : s).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return words.map((w, i) => {
    const bare = w.replace(/[^A-Za-z0-9&]/g, '');
    if (!bare) return w;
    if (bare === bare.toUpperCase() && bare.length <= 4 && /[A-Z]/.test(bare)) return w;   // already an acronym, e.g. "ERP"
    const low = bare.toLowerCase();
    const sub = (rep) => w.replace(bare, rep);
    if (ACRONYMS.has(low)) return sub(low.toUpperCase());
    if (ANCHOR_MIXED[low]) return sub(ANCHOR_MIXED[low]);
    if (i > 0 && ANCHOR_SMALL.has(low)) return sub(low);
    if (bare !== low && /[A-Z]/.test(bare.slice(1))) return w;   // a name the caller already cased ("McKinsey", "eInvoicing")
    return sub(low.charAt(0).toUpperCase() + low.slice(1));
  }).join(' ');
}
// a page = { title?, keyword?, url } -> the words to link it with (never an empty string, never a bare URL path in lower case)
function anchorText(p) {
  const o = p && typeof p === 'object' ? p : { keyword: p };
  const t = String(o.title || '').trim();
  if (t) return t.replace(/\s*\|\s*[^|]{1,40}$/, '').trim() || t;   // "ERP Software UAE | Tech&" -> "ERP Software UAE"
  const kw = String(o.keyword || '').trim();
  if (kw) return titleCaseKeyword(kw);
  const path = String(o.url || '').replace(/^https?:\/\/[^\/]+/i, '').replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '').split('/').pop().replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').trim();
  return titleCaseKeyword(path) || String(o.url || '');
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

    const services = uniq([...listOf(x.services), ...listOf((x.description || {}).services), ...(jparse(row.services_json, []) || [])].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
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
// Content runs (v4.4): what the brief, the copy, the schema and the blog package need beyond the keyword research —
// the site's business profile (author, reviewer, address / NAP), proof from its case studies, the page role (hub, case study, local,
// standard), the cluster pages a hub links down to, and the video details (YouTube page / Vimeo oEmbed, read by Fetch Video Details).
// 2026-10-11 (FIX_PLAN D8): a cluster page that is another company's brand (or a government / portal search) never reaches the writer, even
// when an older ladder row still carries it.
const d = $('Parse Verdict').first().json;
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(x => x && typeof x === 'object' && !x.error && Object.keys(x).length); } catch (e) { return []; } };
const s = (v) => String(v == null ? '' : v).trim();
const list = (v, sep) => s(v).split(sep || /\s*,\s*/).map(x => x.trim()).filter(Boolean);
const domain = s(d.domain).toLowerCase();
const site_id = 'site_' + domain.replace(/[^a-z0-9]+/g, '-');
const kw = s(d.keyword).toLowerCase();

// ---- business profile: the stored row, with per-request author / reviewer overrides (API `author` / `reviewer`) ----
const AUTHOR_KEYS = ['author_name', 'author_job_title', 'author_credentials', 'author_bio', 'author_url', 'author_image_url', 'author_same_as', 'author_knows_about', 'reviewer_name', 'reviewer_job_title', 'reviewer_url'];
const stored = domain ? (rowsOf('Load Profile (Brief)').find(r => r.site_id === site_id) || null) : null;
const P = { ...(stored || {}) }; const over = d.profile_input || {};
if (over.author_name) for (const k of AUTHOR_KEYS.filter(k => k.startsWith('author_'))) P[k] = s(over[k]);
if (over.reviewer_name) for (const k of AUTHOR_KEYS.filter(k => k.startsWith('reviewer_'))) P[k] = s(over[k]);
const sameAs = list(P.author_same_as, /\s+/).filter(u => /^https?:\/\//i.test(u));
const author = s(P.author_name) ? { name: s(P.author_name), job_title: s(P.author_job_title), credentials: s(P.author_credentials), bio: s(P.author_bio), url: s(P.author_url) || sameAs[0] || '', has_author_page: !!s(P.author_url), image_url: s(P.author_image_url),
  same_as: sameAs, knows_about: list(P.author_knows_about) } : null;   // no author page on the site: the byline links to the first public profile
const reviewer = s(P.reviewer_name) ? { name: s(P.reviewer_name), job_title: s(P.reviewer_job_title), url: s(P.reviewer_url) } : null;
const hasBiz = ['business_name', 'street_address', 'city', 'phone'].some(k => s(P[k]));
const site_profile = hasBiz || author ? { business_name: s(P.business_name), business_type: s(P.business_type), logo_url: s(P.logo_url),
  address: { street: s(P.street_address), city: s(P.city), region: s(P.region), postal_code: s(P.postal_code), country_code: s(P.country_code) || s(d.country_iso) },
  phone: s(P.phone), public_email: s(P.public_email), opening_hours: s(P.opening_hours), price_range: s(P.price_range), service_areas: list(P.service_areas), map_url: s(P.map_url), stored: !!stored } : null;

// ---- which angles the facts support (FIX_PLAN D10, 2026-10-12) ----
// The live page of execution 365 was built on cost and timeline — the gap the competitor analysis found — although the business had given
// no prices and no timelines, so the copy ended up with 30 × [Price] and 20 × [Timeline]. A cost or timeline angle is allowed only when
// such facts exist: the site model answers that (profile price range, business facts, call to action), and the case facts count too.
let site_model = null;
try { site_model = $('Site Model').first().json.site_model || null; } catch (e) {}
if (!site_model && d.site_model && typeof d.site_model === 'object') site_model = d.site_model;
const model = site_model || SM.from({ domain }, { profile: P, request: d, description: d.site_description || {} });
const mFacts = SM.facts(model);
const csIn = (d.case_study && typeof d.case_study === 'object') ? d.case_study : {};
const ownText = [d.business_facts, s(P.price_range), csIn.timeline, csIn.results].map(s).filter(Boolean).join(' ');
const pricing_facts = !!(mFacts.pricing || (/\d/.test(ownText) && /(\$|£|€|₹|\b(aed|sar|pkr|inr|usd|gbp|eur)\b|\bprice|\bpricing|\bcost|\bfee|per (user|seat|month|hour|day|project))/i.test(ownText)));
const timeline_facts = !!(mFacts.timeline || /\b\d+\s*(day|week|month|year)s?\b|\btimeline\b|\bgo.?live\b|\bturnaround\b|\bwithin \d/i.test(ownText));
const angle_rules = (pricing_facts && timeline_facts)
  ? 'ANGLE: price and timeline facts are on file, so a cost or a timeline angle is allowed — but every figure must come from the facts above, never from the competitors or from an estimate.'
  : 'ANGLE LIMIT: this business has given no ' + (pricing_facts ? 'timeline facts' : timeline_facts ? 'price facts' : 'price or timeline facts')
    + ', so the page must NOT be built on ' + (pricing_facts ? 'how long the work takes' : timeline_facts ? 'what it costs' : 'what it costs or how long it takes')
    + '. Do not make that the unique_angle, do not promise it in information_gain, do not plan a comparison-table column for it and never plan a row that can only be filled with [Price] or [Timeline].'
    + ' A buyer question about ' + (pricing_facts ? 'duration' : 'cost') + ' may still be answered — qualitatively: what drives it, which choices change it, what to ask a vendor for, with no numbers and no placeholders.'
    + ' Build the page on something the facts support instead: the compliance or regulatory requirements, a decision framework, the risks and how to avoid them, integration depth, migration effort, local rules, or what separates the options.';

// ---- proof: the site's recorded case studies (anonymised where the client may not be named) ----
const proof_library = domain ? rowsOf('Load Case Studies (Brief)').filter(r => r.site_id === site_id && r.case_id !== d.case_id)
  .sort((a, b) => s(b.created_at).localeCompare(s(a.created_at))).slice(0, 6)
  .map(r => { const pub = r.client_public === true || r.client_public === 'true';
    return { title: s(r.title), client: pub ? s(r.client_name) : ('a ' + (s(r.industry) ? s(r.industry) + ' business' : 'client') + (s(r.location) ? ' in ' + s(r.location) : '')), industry: s(r.industry), location: s(r.location), service: s(r.service),
      results: s(r.results).slice(0, 400), quote: s(r.quote).slice(0, 300), quote_by: pub ? s(r.quote_by) : s(r.quote_by).replace(/^[^,]+,\s*/, ''), url: s(r.status) === 'published' ? s(r.page_url) : '' }; }) : [];

// ---- page role ----
const pt = s(d.page_type).toLowerCase();
const isHub = Number(d.ladder_rung) === 4 || /pillar|hub/.test(pt);
const cs = d.case_study && typeof d.case_study === 'object' ? d.case_study : null;
const page_role = (cs || /case stud/.test(pt)) ? 'case_study' : /local/.test(pt) ? 'local' : isHub ? 'hub' : 'standard';
const article_like = /blog|guide|article|pillar|hub|case stud|comparison|faq/.test(pt) || !!(d.ai_target && d.ai_target.question);   // v4.12: these pages show the byline with a visible "Updated" date (AI cites fresh, dated pages)
const STOP = new Set(['the', 'and', 'for', 'with', 'your', 'our', 'how', 'what', 'best', 'top', 'near', 'from', 'are', 'you', 'www', 'com', 'html', 'php', 'page', 'pages', 'blog', 'services', 'service']);
const toks = (t) => s(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(x => x.length > 2 && !STOP.has(x));
// 2026-10-11 (FIX_PLAN D9): a cluster page counts as live only when the site really has it (sitemap / crawl — Collect Site URLs keeps the
// ladder pages it found there out of `planned_link_targets`). Everything else is planned: it is described in the brief, but nothing links to
// it, and the blog package records it as a link to add once it is published. Every page carries the anchor words a link would use.
const normU = (u) => s(u).toLowerCase().replace(/[#?].*$/, '').replace(/\/+$/, '');
const liveUrls = new Set([...(d.site_urls || []), ...(d.internal_link_candidates || []).map(c => c && c.url)].map(normU).filter(Boolean));
const plannedUrls = new Set((d.planned_link_targets || []).map(l => normU(l && l.url)).filter(Boolean));
const isLive = (u) => { const k = normU(u); return !!k && liveUrls.has(k) && !plannedUrls.has(k); };
let hub_pages = [];
if (page_role === 'hub') {
  // ladder top page: its links down to the rung pages (Spawn Page Runs: role "rung N"; Content Cadence: role "down")
  hub_pages = [...(d.ladder_links || []), ...(d.planned_link_targets || [])].filter(l => l && l.url && !/^(top|sibling)$/i.test(s(l.role || l.ladder)))
    .filter((l, i, a) => a.findIndex(x => normU(x.url) === normU(l.url)) === i).slice(0, 12)
    .map(l => ({ url: s(l.url), keyword: s(l.keyword || l.about), title: s(l.title), role: s(l.role || l.ladder) || 'down', planned: !isLive(l.url) }));
  if (!hub_pages.length) {   // a stand-alone pillar page: the site's own pages on the topic
    const kt = new Set(toks(kw));
    hub_pages = (d.internal_link_candidates || []).filter(c => c && c.url && c.path && c.path !== '/')
      .map(c => ({ c, score: toks(c.path + ' ' + (c.title || c.about || '')).filter(t => kt.has(t)).length })).filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score).slice(0, 10)
      .map(x => ({ url: s(x.c.url), keyword: s(x.c.about || x.c.title) || s(x.c.path).replace(/[\/_-]+/g, ' ').trim(), title: s(x.c.title), role: 'cluster', planned: !isLive(x.c.url) }));
  }
  hub_pages = hub_pages.map(p => ({ ...p, anchor: anchorText(p) }));
  const sdB = d.site_description || {};
  const fitCtxB = { own_domain: domain, competitors: (d.competitors || []).map(String), serp_domains: [...new Set((d.competitors_summary || []).map(c => String(c.domain || '')).filter(Boolean))],
    brands: {}, protect: [kw, ...(sdB.products_or_services || []), ...(d.services || []), String(d.business || sdB.business_description || '').slice(0, 400)] };
  hub_pages = hub_pages.filter(p => { if (!p.planned && !p.keyword) return true; const g = fitGate(p.keyword, fitCtxB); return g.ok || (g.reason === 'own brand' && !p.planned); });
}

// ---- video: details from the YouTube watch page or Vimeo oEmbed; transcript cleaned; chapters from "0:00 Title" lines ----
const ent = (t) => s(t).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const isoDur = (secs) => { secs = Math.round(Number(secs) || 0); if (!secs) return ''; const h = Math.floor(secs / 3600), m = Math.floor(secs % 3600 / 60), x = secs % 60; return 'PT' + (h ? h + 'H' : '') + (m ? m + 'M' : '') + (x ? x + 'S' : ''); };
const toSecs = (t) => { const p = s(t).split(':').map(Number); return p.some(isNaN) ? 0 : p.reduce((a, b) => a * 60 + b, 0); };
let video = d.video && d.video.url ? { ...d.video } : null;
if (video) {
  let r = {}; try { r = $('Fetch Video Details').first().json || {}; } catch (e) {}
  const raw = r.body != null ? r.body : r.data; const body = typeof raw === 'string' ? raw : (raw ? JSON.stringify(raw) : '');
  const m1 = (re) => { const x = body.match(re); return x ? ent(x[1]) : ''; };
  let found = false;
  if (video.provider === 'vimeo' && body) { try { const j = JSON.parse(body); found = true;
    video.title = video.title || s(j.title); video.description = video.description || s(j.description); video.thumbnail_url = video.thumbnail_url || s(j.thumbnail_url);
    if (!video.duration && j.duration) video.duration = String(j.duration); if (!video.upload_date && j.upload_date) video.upload_date = s(j.upload_date).replace(' ', 'T'); } catch (e) {} }
  if (video.provider === 'youtube' && body) {
    const up = m1(/<meta[^>]+itemprop=["']uploadDate["'][^>]+content=["']([^"']+)["']/i) || m1(/"uploadDate":"([^"]+)"/) || m1(/"publishDate":"([^"]+)"/);
    const du = m1(/<meta[^>]+itemprop=["']duration["'][^>]+content=["']([^"']+)["']/i); const ls = m1(/"lengthSeconds":"(\d+)"/);
    const ti = m1(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || m1(/<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i);
    const de = m1(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i) || m1(/"shortDescription":"((?:[^"\\]|\\.)*)"/).replace(/\\n/g, '\n');
    found = !!(up || du || ls || ti);
    video.title = video.title || ti; video.description = video.description || de; if (!video.upload_date && up) video.upload_date = up; if (!video.duration) video.duration = du || ls;
  }
  const dur = s(video.duration);
  video.duration_iso = /^P(T|\d)/i.test(dur) ? dur.toUpperCase() : /^\d+$/.test(dur) ? isoDur(dur) : /^\d+(:\d{1,2}){1,2}$/.test(dur) ? isoDur(toSecs(dur)) : '';
  video.duration_seconds = (() => { const m = video.duration_iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/); return m ? (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) : 0; })();
  video.minutes = video.duration_seconds ? Math.max(1, Math.round(video.duration_seconds / 60)) : null;
  video.upload_date = s(video.upload_date);
  // transcript: strip WebVTT / SRT numbering and cue timings, keep the words; chapters from "0:00 Title" lines (description first, then transcript)
  const tr = s(video.transcript).replace(/^WEBVTT.*$/m, '').split(/\r?\n/).filter(l => !/^\d+$/.test(l.trim()) && !/-->/.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  video.transcript = tr;
  const chap = (txt) => s(txt).split(/\r?\n/).map(l => l.trim().match(/^\(?((?:\d{1,2}:)?\d{1,2}:\d{2})\)?\s*[-–—:]?\s+(.{3,90})$/)).filter(Boolean).map(m => ({ start_seconds: toSecs(m[1]), name: m[2].trim() }));
  let chapters = chap(video.description); if (chapters.length < 2) chapters = chap(tr);
  video.chapters = chapters.length >= 2 && chapters[0].start_seconds === 0 ? chapters.slice(0, 20) : [];
  video.details_found = found;
  video.missing = [!video.upload_date && 'upload date', !video.duration_iso && 'duration', !video.thumbnail_url && 'thumbnail', !video.transcript && 'transcript'].filter(Boolean);
}

// ---- texts for the prompts (built here so the prompts stay readable) ----
const hub_live = hub_pages.filter(p => !p.planned), hub_planned = hub_pages.filter(p => p.planned);
const cluster = (hub_live.length ? 'LIVE — link to these, with the anchor shown:\n' + hub_live.map(p => '- ' + (p.keyword || p.url) + ' — ' + p.url + ' — anchor: "' + p.anchor + '"').join('\n') : 'LIVE: none yet')
  + (hub_planned.length ? '\nPLANNED, NOT PUBLISHED — write the section, set no link_to and never write a link to these:\n' + hub_planned.map(p => '- ' + (p.keyword || p.url)).join('\n') : '');
const area = s(d.local_area);
const nap = site_profile ? [site_profile.business_name, [site_profile.address.street, site_profile.address.city, site_profile.address.region, site_profile.address.postal_code].filter(Boolean).join(', '), site_profile.phone, site_profile.opening_hours].filter(Boolean).join(' · ') : '';
const caseFacts = cs ? [['Client', cs.client_public === false ? (cs.client_name || 'the client') + ' (do NOT name them; describe them as "a ' + (cs.industry ? cs.industry + ' business' : 'client') + (cs.location ? ' in ' + cs.location : '') + '")' : cs.client_name], ['Industry', cs.industry], ['Location', cs.location], ['Service delivered', cs.service], ['Challenge', cs.challenge], ['What was done', cs.solution], ['Timeline', cs.timeline], ['Results', cs.results], ['Client quote (verbatim)', cs.quote ? '"' + cs.quote + '" — ' + (cs.client_public === false ? s(cs.quote_by).replace(/^[^,]+,\s*/, '') : cs.quote_by) : '']]
  .filter(x => s(x[1])).map(x => x[0] + ': ' + s(x[1])).join('\n') : '';
const ROLE_BRIEF = {
  hub: 'HUB PAGE (pillar): this page is the complete guide to "' + kw + '" and the hub of a topic cluster. Plan 8-12 H2 sections: the core definition and the decision framework in depth, plus one section per cluster page below (group 2-3 closely related ones) that summarises the subtopic in 120-250 words. Set "link_to" ONLY for a page listed as LIVE, and only to its exact URL; a page listed as PLANNED has no URL yet, so its section carries no link_to and no link. internal_link_suggestions must include every LIVE cluster page with its anchor, in addition to the usual links, and no planned page. The system adds a linked table of contents and a "Guides in this series" block of the live pages only; do not plan them as sections.\nCLUSTER PAGES:\n' + (cluster || '- none found: plan the hub so each section can later link to a detailed page'),
  case_study: 'CASE STUDY: the page tells one real project and proves the service "' + s((cs || {}).service || kw) + '". Use ONLY the case facts below for anything about the project: never invent numbers, names, dates, tools or quotes; anything missing stays a bracketed placeholder. Copy the case facts into client_facts. Outline (6-8 H2s): the challenge; why they chose the business; what was done (approach, steps, timeline); the results (each number from the case facts, before → after where given, plus a results table); in the client\'s words (only when a quote is given, verbatim); what other ' + (s((cs || {}).industry) || 'teams') + ' can learn (3-5 transferable lessons); next step (CTA). Title pattern: client (or the anonymised description) + the headline result + the service. target_word_count 900-1,600. The system renders an "at a glance" snapshot box.\nCASE FACTS:\n' + (caseFacts || 'none given'),
  local: 'LOCAL PAGE for ' + (area || '[City]') + ': written for buyers in ' + (area || 'this area') + '. It must carry genuinely local substance, never a city-name swap of another page: the districts, free zones or neighbourhoods served, local rules, authorities or permits that matter for this service, how the service works on site there (visits, response times, local team), local examples or proof, and local FAQs. Plan one section about reaching the business in ' + (area || 'the area') + ' — the system adds the verified name / address / phone / opening hours block below it. Never invent an address, phone number, office, review or local client.\nBUSINESS DETAILS ON FILE: ' + (nap || 'none — the page must not claim a local office; describe the service area instead') + (site_profile && site_profile.service_areas.length ? '\nAREAS SERVED: ' + site_profile.service_areas.join(', ') : ''),
  standard: ''
};
const ROLE_WRITER = {
  hub: 'HUB PAGE: every outline section with a "link_to" URL ends with one sentence that links to that page with a descriptive anchor ([anchor](url)). A section without a "link_to" is about a page that is not published yet: summarise the subtopic and write NO link for it — never invent or guess a URL. Summarise each subtopic; do not repeat the detailed page. Do not write a table of contents or a list of guides (the system adds both).',
  case_study: 'CASE STUDY: tell the project as a story with real numbers. These case facts are true and may be stated; nothing else about the project may be:\n' + caseFacts + '\nUse the quote verbatim and only if given. Include a before → after results table. No invented metrics, names, dates or tools.',
  local: 'LOCAL PAGE for ' + (area || '[City]') + ': genuinely local detail in every section (areas served, local rules and authorities, how the service works on site, local examples). Do not write the address, phone number or opening hours (the system inserts the verified block); never claim an office, review or client that is not in the facts.',
  standard: ''
};
const eeat_context = (author ? 'Written by ' + author.name + (author.job_title ? ', ' + author.job_title : '') + '. Credentials and experience: ' + (author.credentials || 'not given') + (author.knows_about.length ? '. Expert in: ' + author.knows_about.join(', ') : '') + (author.bio ? '. Bio: ' + author.bio.slice(0, 400) : '') + '.'
  : 'No author profile on file: plan the experience notes as bracketed prompts for the author.') + (reviewer ? ' Expert reviewer: ' + reviewer.name + (reviewer.job_title ? ', ' + reviewer.job_title : '') + '.' : '');
const proof_context = proof_library.length ? proof_library.map(c => '- ' + (c.title || c.service) + ' — ' + c.client + (c.industry ? ' (' + c.industry + ')' : '') + ': ' + c.results + (c.quote ? ' Quote: "' + c.quote + '"' + (c.quote_by ? ' — ' + c.quote_by : '') : '') + (c.url ? ' — ' + c.url : ' — no public page yet (do not link)')).join('\n') : 'none recorded';
const video_context = video ? 'VIDEO: the page has a video ("' + (video.title || 'untitled') + '"' + (video.minutes ? ', about ' + video.minutes + ' minutes' : '') + '). The system embeds it' + (video.placement ? ' under "' + video.placement + '"' : ' after the quick answer') + ' with its transcript. Refer to it once, naturally (what it shows and why to watch); never transcribe it or invent what it says.' + (video.chapters.length ? ' Key moments: ' + video.chapters.map(c => c.name).join(' · ') + '.' : '') : '';
const case_facts_text = caseFacts.replace(/\n/g, ' | ') + (proof_library.length ? (caseFacts ? ' | ' : '') + proof_library.map(c => c.results).join(' | ') : '');

return [{ json: { ...d, site_profile, author, reviewer, proof_library, page_role, article_like, hub_pages, hub_pages_planned: hub_planned, video, case_study: cs, local_area: area,
  eeat_context, proof_context, role_brief: ROLE_BRIEF[page_role] || '', role_writer: ROLE_WRITER[page_role] || '', video_context, case_facts_text,
  // the facts and the call to action the site model holds (what the app sent, what the weekly run stored) when this request carries none
  business_facts: s(d.business_facts) || mFacts.business_facts, cta: s(d.cta) || mFacts.cta,
  pricing_facts, timeline_facts, angle_rules, site_model: model } }];
