// ---- a check-in that is a test (D25c, 2026-10-12; the builders inline this file where a node asks for the CHECKIN_TEST kit) ----
// October's Search Console check-in was still the 2026-10-02 test row ("October check-in (test)"), so the reminder stopped asking the owner
// and the Monday report showed a test as the month's answer. A check-in is a test when the person said so (the form's "test" answer or the
// API's is_test), when it was written by a test caller (source "test"), or when its own note marks it as one. A test check-in is recorded
// like any other, but it never satisfies the month: CK.isTest(row) keeps it out of the monthly check, so the reminder keeps asking.
const CK = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const yes = (v) => /^(y|yes|true|1|on)$/i.test(S(v));
  // the note marks it as a test: "(test)", "test check-in / submission / entry / row / run / data", or a note that starts with "test"
  const MARK = /\(\s*test[^)]*\)|\btest\s+(check-?in|submission|entry|row|run|data)\b|^test\b[\s:,-]/i;
  const isTest = (row) => {
    const r = row || {};
    return yes(r.is_test) || S(r.source).toLowerCase() === 'test' || MARK.test(S(r.notes));
  };
  // why a stored row counts as a test (for the report and the harness)
  const testReason = (row) => {
    const r = row || {};
    if (yes(r.is_test)) return 'marked as a test when it was submitted';
    if (S(r.source).toLowerCase() === 'test') return 'written by a test caller (source "test")';
    if (MARK.test(S(r.notes))) return 'its note marks it as a test';
    return '';
  };
  return { isTest, testReason, yes, MARK };
})();
// Site tracker plan: one job per tracked site. Sites come from the Data Table "seo_sites" (registered through the form option
// "Track my site" / API mode "track") plus every domain that has a keyword ladder (registered automatically, e-mail from the ladder).
// Google data is read for the last 28 complete days ending 3 days ago (Search Console data is final after about 3 days),
// against the 28 days before and the same 28 days a year earlier.
// B-G3 (2026-10-15, FIX_PLAN §3.16; INVARIANTS rule 2): every stored rung used to join the tracked keywords with no gate, so a rung set
// aside for being a competitor's brand still bought a live rank check every week and still appeared in the weekly report. The same shared
// read-path gate the Rank Tracker and the Content Cadence use (FITR, _fit_gate.js) runs here, and what it sets aside is named with its reason.
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
const CONFIG = {
  service_account_email: 'seo-agent@seo-tool-511608.iam.gserviceaccount.com',   // filled from n8n/.env (SEO_GOOGLE_SA_EMAIL) at build time; shown in the connect instructions
  max_sites_per_run: 25, max_tracked_keywords: 40, max_gsc_keyword_requests: 30, max_trend_keywords: 4, max_serp_checks: 20,
  // G25 (2026-10-13, FIX_PLAN): URL Inspection used to see 20 ladder pages a week. Google allows 2,000 inspections a day and 600 a minute
  // per property, so one weekly run asks about up to 150 key pages (7.5% of a day's quota, free) and the pages rotate oldest-first;
  // whatever the budget does not reach is reported as "not checked". The audit spends its own 100 (GSC Audit Plan).
  max_inspections: 150,
  // B7-1 (2026-10-15, benchmark area 7): the dated page changes this run measures against a control group. Each one costs two free
  // Search Console requests (the 28 complete days after it, and the 28 before it), so the newest `max_change_tests` are read.
  // change_test_min_days = the complete days a change needs after it before anything is read at all; 28 is one full comparison
  // window, and CT (v5/code/_change_test.js) keeps its own 6-week bar for the POSITION verdict.
  max_change_tests: 6, change_test_min_days: 28, change_test_max_age_days: 400,
  max_gsc_pages: 4,                 // G9: Search Console serves 25,000 rows per request; up to 4 pages per kind = 100,000 query / page rows
  striking_min_impressions: 30,     // "striking distance": position 4-20 with at least this many impressions in 28 days
  ctr_gap_min_impressions: 100,     // CTR gap: top-10 position, at least this many impressions, CTR under half the expected rate for the position
  // B4-1 (2026-10-15, benchmark area 4): a flat 25% drop on a 10-click floor was the last fixed threshold in the site
  // tracking. A decaying page now needs a fall that survives the two-sample Poisson test (ST.decay) and is not the dip the same
  // weeks had a year ago. min_click_events = what both 28-day periods must carry together before anything is claimed (40, the
  // same bar as a traffic alert); min_pct = the size worth acting on (20%, the bar Ahrefs publishes for a year-over-year flag).
  decay_min_click_events: 40, decay_min_pct: 20,
  // G28: a drop is an alert when it is statistically real (two-sample Poisson z, 95%) AND at least alert_min_pct; alert_drop_pct only decides
  // whether that alert is "high" or "medium". min_*_events = the events both periods must carry together before anything is claimed at all.
  // G28 follow-up (2026-10-13): a position alert needs volume too — both 28-day periods must carry alert_min_position_impressions
  // impressions for the keyword before a move of alert_min_places is called a drop (ST.position)
  alert_drop_pct: 30, alert_min_pct: 10, alert_min_click_events: 40, alert_min_impression_events: 400, alert_min_session_events: 40,
  alert_min_position_impressions: 50, alert_min_places: 5
};
let trigger = {}; try { const t = $('Manual Run').first(); trigger = (t && t.json) || {}; } catch (e) {}
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const siteIdFor = (d) => 'site_' + d.replace(/[^a-z0-9]+/g, '-');
const kwList = (s) => String(s || '').split(/[\n,;]+/).map(k => k.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean);
const sites = rowsOf('Load Sites').filter(r => r.site_id && r.domain);
const ladders = rowsOf('Load Ladders').filter(r => r.ladder_id && r.domain && r.keyword);
const history = rowsOf('Load Rank History').filter(r => r.keyword && r.checked_at);
const logRows = rowsOf('Load Content Log').filter(r => r.keyword && r.domain);   // pages written by the Content Cadence / reported as published
const alertRows = rowsOf('Load Console Alerts').filter(r => r.domain && r.kind);     // Search Console notification mails + check-in flags
const checkinRows = rowsOf('Load Check-ins').filter(r => r.site_id && r.month && !CK.isTest(r));   // D25c: a test check-in is kept out of the monthly check (_checkin_test.js), so the reminder keeps asking     // monthly owner check-ins (manual action / security / Pages export)
const monRows = rowsOf('Load Monitors (Site)');   // B-G3: the declared competitors the fit gate needs on the read path
const byDomain = new Map();
for (const s of sites) { const d = normD(s.domain); if (d && !byDomain.has(d)) byDomain.set(d, { ...s, domain: d, keywords: kwList(s.keywords), virtual: false }); }
for (const l of ladders) { const d = normD(l.domain); if (d && !byDomain.has(d)) byDomain.set(d, { site_id: siteIdFor(d), domain: d, gsc_property: '', ga4_property_id: '', country: l.country || '', location_code: Number(l.location_code) || 0, language_code: l.language_code || 'en', email: l.email || '', callback_url: l.callback_url || '', keywords: [], status: 'active', source: 'ladder', created_at: '', last_run_at: '', request_id: l.request_id || '', virtual: true }); }
// a registered site without an address inherits the ladder's e-mail / callback for the same domain (API registrations with callback only)
for (const s of byDomain.values()) { if (s.email && s.callback_url) continue; const l = ladders.find(l => normD(l.domain) === s.domain && (l.email || l.callback_url)); if (l) { s.email = s.email || l.email || ''; s.callback_url = s.callback_url || l.callback_url || ''; } }
const want = normD(trigger.domain) || String(trigger.site_id || '').trim();
const on_demand = !!want;
let list = [...byDomain.values()];
if (on_demand) list = list.filter(s => s.domain === want || s.site_id === want);
else list = list.filter(s => String(s.status || 'active') !== 'paused');
if (!list.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'no tracked site matches "' + want + '"' : 'no sites to track yet (register one through "Track my site" or plan a keyword ladder)', sites: byDomain.size } }];
const end = new Date(Date.now() - 3 * 864e5); end.setUTCHours(0, 0, 0, 0);
const iso = (d) => d.toISOString().slice(0, 10); const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const ranges = { current: { start: iso(addDays(end, -27)), end: iso(end) }, previous: { start: iso(addDays(end, -55)), end: iso(addDays(end, -28)) }, yoy: { start: iso(addDays(end, -27 - 364)), end: iso(addDays(end, -364)) },
  // B7-8 (W3-D): the days AFTER the final-data window (Search Console serves them as preliminary data), up to today
  recent: { start: iso(addDays(end, 1)), end: iso(new Date()) } };
const now = new Date().toISOString();
return list.slice(0, CONFIG.max_sites_per_run).map(s => {
  const lrowsAll = ladders.filter(l => normD(l.domain) === s.domain).sort((a, b) => (Number(a.rung) || 0) - (Number(b.rung) || 0) || (Number(a.page_no) || 0) - (Number(b.page_no) || 0));
  // B-G3: the read-path gate. The site's OWN keyword list is the owner's explicit choice and is never judged here — only the stored rungs.
  const mon = monRows.find(m => m.site_id === s.site_id || normD(m.domain) === s.domain) || {};
  const fitCtx = FITR.ctx({ own_domain: s.domain, competitors: kwList(mon.competitors).map(normD),
    heads: lrowsAll.map(l => l.head_keyword), keywords: s.keywords || [] });
  const fitS = FITR.rungs(lrowsAll, fitCtx, { where: 'weekly site tracking' });
  const lrows = fitS.keep; const set_aside = fitS.set_aside;
  const tracked = []; const seen = new Set();
  for (const k of s.keywords) if (!seen.has(k)) { seen.add(k); tracked.push({ keyword: k, source: 'site', rung: 0, ladder_id: '', head_keyword: '' }); }
  for (const l of lrows) { const k = String(l.keyword).toLowerCase().trim(); if (!seen.has(k)) { seen.add(k); tracked.push({ keyword: k, source: 'ladder', rung: Number(l.rung) || 0, ladder_id: l.ladder_id, head_keyword: String(l.head_keyword || '').toLowerCase() }); } }
  const pages = []; const seenU = new Set();
  const blogs = logRows.filter(r => normD(r.domain) === s.domain);
  // R1 (2026-10-13, re-rating): `written` in seo_content_log is the only proof that a page exists. A ladder row saying `writing` is a promise:
  // live, a page run the budget guard refused left row 19 "writing", and the weekly report then called it "written, not published yet" and
  // asked the owner to publish it. A `started` row is a run that opened the row and never finished.
  const normKw = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const writtenKw = new Set(blogs.filter(b => b.status === 'written' || b.status === 'published' || String(b.published_url || '').trim()).map(b => normKw(b.keyword)));
  // R111 (2026-10-16): a page whose last quality round failed is a draft to fix, never a page to publish. Its keyword is not `written`
  // (that word means "passed QA, waiting to be published"); it is carried as `not_ready` with the quality check's own reasons.
  const notReadyOf = new Map(blogs.filter(b => b.status === 'not_ready' && !String(b.published_url || '').trim()).map(b => [normKw(b.keyword), b]));
  const reasonsOf = (b) => String((b && b.qa_reasons) || '').split(/;\s+/).map(x => x.trim()).filter(Boolean);
  for (const l of lrows) { const u = String(l.target_url || '').trim(); if (u && /^https?:\/\//.test(u) && !seenU.has(u)) { seenU.add(u); const nr = notReadyOf.get(normKw(l.keyword)) || null; pages.push({ url: u, keyword: l.keyword, rung: Number(l.rung) || 0, status: l.status || '', ladder_id: l.ladder_id, page_exists: !!l.page_exists, written: writtenKw.has(normKw(l.keyword)), not_ready: !!nr && !writtenKw.has(normKw(l.keyword)), qa_reasons: nr ? reasonsOf(nr) : [], status_note: String(l.status_note || '') }); } }
  for (const b of blogs) { const k = String(b.keyword).toLowerCase().trim(); if (!seen.has(k)) { seen.add(k); tracked.push({ keyword: k, source: 'blog', rung: 0, ladder_id: b.ladder_id || '', head_keyword: '' }); } }
  for (const b of blogs) { const u = String(b.published_url || '').trim(); if (u && /^https?:\/\//.test(u) && !seenU.has(u)) { seenU.add(u); pages.push({ url: u, keyword: b.keyword, rung: 0, status: 'published', ladder_id: b.ladder_id || '', page_exists: true, written: true, status_note: '', published_at: b.published_at || '' }); } }
  // R1 (2026-10-13): only a row that says `written` waits for the owner's publish link — a `started` row is a run that never finished, and
  // asking the owner to publish a page that was never written is the harm R1 describes. P2-4 (2026-10-12): the comment used to sit before the
  // .map(), which an inline // swallows, so every row kept the raw content-log shape and the report said "(undefined days ago)".
  const pending_publish = blogs.filter(b => b.status === 'written' && !b.published_url)
    .map(b => ({ keyword: b.keyword, started_at: b.started_at || '', days: Math.round((Date.now() - new Date(b.started_at || now).getTime()) / 864e5) }));
  // R111: the drafts that failed their last quality round — "fix it and run it again", with the reasons, never "publish it"
  const needs_fix = blogs.filter(b => b.status === 'not_ready' && !String(b.published_url || '').trim())
    .map(b => ({ keyword: b.keyword, started_at: b.started_at || '', days: Math.round((Date.now() - new Date(b.started_at || now).getTime()) / 864e5),
      ladder_id: b.ladder_id || '', rung: Number(b.rung) || 0, page_type: b.page_type || '', reasons: reasonsOf(b) }));
  // B7-1 (2026-10-15, benchmark area 7): the dated changes this run can actually test. A change needs 28 COMPLETE days of final
  // Search Console data after it and 28 before it, so the test gets its own two windows instead of borrowing the report's 28-v-28
  // — which both sit after a change made three months ago and would therefore measure nothing. Everything too new is kept out with
  // the date it can first be read; `joint` marks a second change to the same page inside 56 days, which splits the credit (CT).
  const chAll = blogs.filter(b => String(b.published_url || '').trim() && String(b.published_at || '').slice(0, 10))
    .map(b => ({ url: String(b.published_url).trim(), date: String(b.published_at).slice(0, 10), keyword: String(b.keyword || ''),
      what: String(b.source || '') === 'refresh' ? 'refreshed' : 'published' }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const byUrl = new Map(); for (const c of chAll) { const k = c.url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, ''); if (!byUrl.has(k)) byUrl.set(k, c); }
  const endD = Date.parse(ranges.current.end + 'T00:00:00Z');
  const ageOf = (d) => Math.floor((endD - Date.parse(d + 'T00:00:00Z')) / 864e5);
  const changes = [...byUrl.values()].map(c => { const age = ageOf(c.date);
    const joint = chAll.some(o => o !== c && o.url === c.url && Math.abs(ageOf(o.date) - age) <= 56);
    const readable = age >= CONFIG.change_test_min_days && age <= CONFIG.change_test_max_age_days;
    const after = { start: c.date, end: iso(addDays(new Date(Date.parse(c.date + 'T00:00:00Z')), 27)) };
    const before = { start: iso(addDays(new Date(Date.parse(c.date + 'T00:00:00Z')), -28)), end: iso(addDays(new Date(Date.parse(c.date + 'T00:00:00Z')), -1)) };
    return { key: 'chg_' + c.date.replace(/-/g, '') + '_' + c.url.replace(/[^a-z0-9]+/gi, '').slice(-12).toLowerCase(), url: c.url, date: c.date, keyword: c.keyword, what: c.what, age_days: age, joint, readable,
      window_after: after, window_before: before,
      not_yet: readable ? '' : age < CONFIG.change_test_min_days
        ? 'only ' + Math.max(0, age) + ' of the ' + CONFIG.change_test_min_days + ' complete days needed after the change; it can first be read on ' + iso(addDays(new Date(Date.parse(c.date + 'T00:00:00Z')), CONFIG.change_test_min_days + 3))
        : 'the change is ' + age + ' days old, past the ' + CONFIG.change_test_max_age_days + ' days this test looks back' }; })
    .sort((a, b) => Number(b.readable) - Number(a.readable) || b.date.localeCompare(a.date));
  const cutoff = new Date(Date.now() - 35 * 864e5).toISOString();
  const console_alerts = alertRows.filter(a => normD(a.domain) === s.domain && String(a.received_at) >= cutoff).sort((a, b) => String(b.received_at).localeCompare(String(a.received_at))).slice(0, 10).map(a => ({ kind: a.kind, severity: a.severity, subject: a.subject, summary: a.summary, received_at: a.received_at, source: a.source || 'mail' }));
  const cks = checkinRows.filter(c => c.site_id === s.site_id).sort((a, b) => String(b.month).localeCompare(String(a.month)));
  const last_checkin = cks[0] ? { month: cks[0].month, manual_action: !!cks[0].manual_action, security_issue: !!cks[0].security_issue, not_indexed_total: Number(cks[0].not_indexed_total), csv_kind: cks[0].csv_kind || 'none', coverage: (() => { try { return JSON.parse(cks[0].coverage_json || '{}'); } catch (e) { return {}; } })(), notes: cks[0].notes || '', submitted_at: cks[0].submitted_at || '' } : null;
  // B7-7 (W3-D): the owner's own dated notes (monthly check-ins) become chart marks; test check-ins never do
  const owner_notes = checkinRows.filter(c => c.site_id === s.site_id && !c.is_test && String(c.notes || '').trim() && String(c.submitted_at || '').slice(0, 10))
    .map(c => ({ date: String(c.submitted_at).slice(0, 10), text: String(c.notes).trim().slice(0, 300), source: 'seo_console_checkins' })).slice(0, 24);
  // B7-5 (W3-D): content groups -- [{name, pattern}] from the site row (Site Admin action content_groups); none when unset, and it says so
  const content_groups = (() => { try { const v = JSON.parse(s.content_groups_json || '[]'); return (Array.isArray(v) ? v : []).map(g => ({ name: String(g && g.name || '').trim().slice(0, 60), pattern: String(g && g.pattern || '').trim().slice(0, 200) })).filter(g => g.name && g.pattern).slice(0, 12); } catch (e) { return []; } })();
  const checkin_due = !cks.some(c => c.month === now.slice(0, 7));
  const serp = {};
  for (const h of history) { if (normD(h.domain) !== s.domain) continue; const k = String(h.keyword).toLowerCase(); if (!serp[k] || String(h.checked_at) > String(serp[k].checked_at)) serp[k] = { position: Number(h.position), url: h.url || '', checked_at: h.checked_at }; }
  return { json: { site_id: s.site_id, domain: s.domain, gsc_property_hint: s.gsc_property || '', ga4_property_id: String(s.ga4_property_id || '').replace(/^properties\//, ''), country: s.country || '', location_code: Number(s.location_code) || 0, language_code: s.language_code || 'en',
    email: s.email || '', callback_url: s.callback_url || '', request_id: String(trigger.request_id || s.request_id || ''), source: s.source || 'form', status: s.status || 'active', created_at: s.created_at || now, first_run: !s.last_run_at, virtual: !!s.virtual,
    keywords: s.keywords, tracked: tracked.slice(0, CONFIG.max_tracked_keywords), ladder_pages: pages.slice(0, CONFIG.max_inspections), ladder_heads: [...new Set(lrows.map(l => String(l.head_keyword || '').toLowerCase().trim()).filter(Boolean))],
    // B-G3: what the gate refused, with its reason, so the weekly report names it instead of printing a shorter list (INVARIANTS rule 1)
    set_aside, set_aside_note: FITR.line(set_aside, 'tracked or given a live rank check'),
    // B7-1: the dated changes, readable ones first; GSC Requests buys the two windows of the first `max_change_tests`, the rest
    // travel with the reason they could not be read so the report says so instead of showing a shorter list
    changes: changes.slice(0, Math.max(CONFIG.max_change_tests, 12)),
    owner_notes, content_groups, content_groups_json: s.content_groups_json || '', serp_positions: serp, pending_publish, needs_fix, console_alerts, last_checkin, checkin_due, ranges, on_demand, checked_at: now, config: CONFIG } };
});
