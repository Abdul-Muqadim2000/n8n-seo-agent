// KI Plan (E2, 2026-11-08, DESIGN.md §2.1 / §3.1 / §7): what this run will ask, and what it may cost. ONE item, read by the run ledger
// (Monitor_Ledger_Row: `est_dfs_usd` is this run's own estimate, held at or under the quote the app charged) and by every later node by name.
//   * seeds (both runs): the confirmed services x the market ("{service} uae", "{service} company dubai", "best {service} dubai", "{product}
//     partner uae"), the request's own seeds, non-brand Search Console queries with impressions (the newest 28-day reading, top 50), the
//     tracked keywords and the ladder heads - every one through the fit gate (other brands, government, jobs, other markets), cap 20;
//   * stored ladder heads are read back through FITR.rungs (INVARIANTS rule 2): a head stored before a gate existed is set aside with its reason;
//   * the competitor set: the stored rows of this market (a `user` status is the client's), the declared competitors (start chosen), and how
//     many the client may choose (seo_monitors.ki_max_competitors, 1-5, empty = 5);
//   * the estimate assumes every results page is a miss of the day cache (it can only fall) and drops what would take it over the quote:
//     a competitor profile that does not fit waits for the next run, and says so.
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
const FIT_GEO = new Set(['uae', 'u.a.e', 'dubai', 'abu', 'dhabi', 'sharjah', 'ajman', 'fujairah', 'ras', 'al', 'khaimah', 'umm', 'quwain', 'emirates', 'gcc', 'saudi', 'arabia', 'ksa', 'riyadh', 'jeddah', 'qatar', 'doha', 'oman', 'muscat', 'bahrain', 'kuwait', 'egypt', 'india', 'pakistan', 'uk', 'usa', 'us', 'online', 'portal',
  // KW-GATE (2026-10-21): regions and the markets e-invoicing and ERP searches name ("e invoicing europe", "belgium", "bpo company in middle east")
  'middle', 'east', 'mena', 'emea', 'apac', 'europe', 'european', 'eu', 'africa', 'asia', 'belgium', 'germany', 'france', 'netherlands', 'italy', 'spain', 'portugal', 'poland', 'austria',
  'switzerland', 'ireland', 'luxembourg', 'denmark', 'sweden', 'norway', 'finland', 'greece', 'singapore', 'malaysia', 'australia', 'zealand', 'canada', 'japan', 'china', 'turkey', 'jordan', 'lebanon',
  'morocco', 'nigeria', 'kenya', 'london', 'england', 'britain', 'america', 'states', 'united', 'world', 'worldwide', 'global']);
// R13 (2026-10-13): 'ai' joined this list — it is a category word, not a topic. With it in, "ai" (165,000/mo) and "google ai" are left with
// nothing of their own ("too broad") while "character ai", "humanize ai", "meta ai" and "blackbox ai" are judged on the word that is really
// theirs; a keyword that names a service of the site ("ai automation uae") still matches on that service's own words.
const FIT_GENERIC = new Set(['ai', 'software', 'softwares', 'services', 'service', 'erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'tax', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll', 'finance', 'financial', 'cloud', 'digital', 'online', 'web', 'data', 'tech', 'technology', 'technologies', 'solutions', 'solution', 'systems', 'system', 'business', 'company', 'group', 'global', 'international', 'gulf', 'arab', 'arabia', 'emirates', 'national', 'consulting', 'consultants', 'consultancy', 'partners', 'partner', 'network', 'news', 'blog', 'guide', 'guides', 'info', 'best', 'top', 'free', 'app', 'apps', 'shop', 'store', 'market', 'media', 'academy', 'institute', 'university', 'school', 'bank', 'pay', 'pro', 'plus', 'hub', 'one', 'first', 'smart', 'easy', 'get', 'go', 'ae', 'com', 'net', 'org', 'home', 'house', 'world', 'city', 'daily', 'times', 'post', 'review', 'reviews', 'compare', 'comparison', 'list', 'directory', 'jobs', 'careers', 'businesses', 'companies', 'firms', 'wiki', 'wikipedia', 'youtube', 'linkedin', 'facebook', 'instagram', 'twitter', 'reddit', 'quora', 'medium', 'google', 'microsoft', 'amazon', 'apple']);
const FIT_GOV_WORDS = /\b(ministry|ministries|authority|authorities|federal|government|govt|municipality|municipal|embassy|consulate|police|courts?|customs|immigration|department of|public prosecution|parliament|chamber of commerce|free zone authority)\b/;
// KW-GATE (2026-10-21): other countries' tax and identity bodies too ("hmrc vat login" was a plain portal refusal, not a government one)
const FIT_GOV_NAMES = /\b(hmrc|irs|cra|ato|finanzamt|elster|agenzia entrate|belastingdienst|skatteverket|spf finances|dgfip|impots\.gouv|fta|emaratax|emara ?tax|tax authority|mohre|mohap|mofa|moec|gdrfa|icp|ica|rta|dewa|sewa|fewa|addc|aadc|dha|doh|ded|tdra|adjd|ejari|dubai land department|dld|dubai economy|dubai courts|zatca|gazt|gosi|qiwa|absher|muqeem|mudad|hrsd|misa|nafath|tawtheeq|uae pass|smart pass|amer cent(er|re)|tasheel|tawjeeh|emirates id|emirates identity|national id|i ?d card|identity card|labou?r card|work permit status|visa status|visa check|passport status|establishment card|golden visa status|trn verification|trn check|trn lookup|tax registration number check)\b/;
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
const FIT_COURSE_ONLY = /\b(courses?|bootcamps?|diploma|degree|syllabus|exam|exams|dumps|study material)\b/;
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
// KWL-RES D2 (2026-10-21 live keyword test, exec 111): "artificial intelligence consultancy" (170/mo, KD 5) was judged "not one of the services
// you listed" while "AI consulting" was the first service declared: the topic words never read "artificial intelligence" as "ai". fitSyn writes
// one spelling for the same thing, and the topic paths run it on BOTH sides (the keyword and the client's services / topics), so it can only
// make two spellings of one subject agree. An acronym the rules already treat as a category ("ai", "erp", "crm") is the canonical form; "ml"
// and "bi" are written out (a two-letter word is never a topic word on its own); advisory and advisor read as "consultant"; every spelling
// of e-invoicing reads as "e invoicing" (so "invoicing" stays a word of it).
const FIT_SYNONYMS = [[/\bartificial[\s-]+intelligence\b/g, 'ai'], [/\bcustomer[\s-]+relationship[\s-]+management\b/g, 'crm'], [/\benterprise[\s-]+resource[\s-]+planning\b/g, 'erp'],
  [/\bml\b/g, 'machine learning'], [/\bbi\b/g, 'business intelligence'],
  [/\b(?:advisory|advisors?|advisers?)\b/g, 'consultant'],   // consultancy, consulting and consultant already agree (one stem, "consult"); a consultant word stays a word of its own ("hire ai consultant dubai")
  [/\b(?:e[\s-]?|electronic[\s-]+)(invoic\w*)/g, 'e $1'],
  // N1 (KW recheck 2026-10-21, exec 149): "d365 cloud migration uae" was out for a Dynamics 365 partner: d365 is how buyers write Dynamics 365
  [/\b(?:d365|dynamics365|ms ?d365)\b/g, 'dynamics 365']];
const fitSyn = (s) => FIT_SYNONYMS.reduce((t, [re, to]) => t.replace(re, to), String(s || '').normalize('NFKC').toLowerCase());
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
// ---- KW-GATE (2026-10-21, keyword accuracy set: in recall 54%): Arabic keywords are READ, not guessed ----
// Every Arabic keyword was "0% of its own words match" (the topics are English), so "استشارات الذكاء الاصطناعي في دبي" (AI consulting in Dubai)
// was refused as off topic and "وظائف الذكاء الاصطناعي في دبي" (AI jobs in Dubai) was refused for the wrong reason. The keyword is normalised
// (alef forms, ta marbuta, alef maqsura, hamza seats, diacritics, tatweel, Arabic digits), split, its article / prefixes taken off, and the
// common search words are mapped to the English words the rules below already judge, through a small glossary (phrases first). No
// machine translation call. A word the glossary does not know stays as it is (fitTopic treats it as unread, not as evidence either way).
const FIT_AR = /[؀-ۿ]/;
const FIT_AR_PHRASES_SRC = [['ذكاء اصطناعي', 'ai'], ['فاتوره الكترونيه', 'e invoicing'], ['فواتير الكترونيه', 'e invoicing'], ['فوتره الكترونيه', 'e invoicing'],
  ['فوتره', 'invoicing'], ['ضريبه قيمه مضافه', 'vat'], ['قيمه مضافه', 'vat'], ['تخطيط موارد موسسات', 'erp'], ['تخطيط موارد', 'erp'], ['موارد بشريه', 'hr'],
  ['اداره علاقات عملاء', 'crm'], ['علاقات عملاء', 'crm'], ['هويه اماراتيه', 'emirates id'], ['بطاقه هويه', 'id card'], ['وزاره خارجيه', 'ministry of foreign affairs'],
  ['هيئه اتحاديه للضرائب', 'fta'], ['هيئه اتحاديه ضرائب', 'fta'], ['تعلم اله', 'machine learning'], ['ابو ظبي', 'abu dhabi'], ['راس خيمه', 'ras al khaimah'],
  ['خدمه عملاء', 'customer service'], ['تسجيل دخول', 'login'], ['سيره ذاتيه', 'cv'], ['عن بعد', 'remote']];
const FIT_AR_WORDS_SRC = { 'استشارات': 'consulting', 'استشاره': 'consulting', 'استشاري': 'consulting', 'استشاريه': 'consulting', 'مستشار': 'consultant', 'مستشارين': 'consultants', 'مستشارون': 'consultants',
  'شركه': 'company', 'شركات': 'companies', 'مكتب': 'firm', 'برنامج': 'software', 'برامج': 'software', 'نظام': 'system', 'انظمه': 'systems', 'حلول': 'solutions', 'خدمات': 'services',
  'خدمه': 'service', 'تطبيق': 'app', 'تطبيقات': 'apps', 'منصه': 'platform', 'اتمته': 'automation', 'ذكاء': 'intelligence', 'اصطناعي': 'artificial', 'فاتوره': 'invoice', 'فواتير': 'invoices',
  'الكترونيه': 'electronic', 'الكتروني': 'electronic', 'ضريبه': 'tax', 'ضرائب': 'tax', 'ضريبي': 'tax', 'محاسبه': 'accounting', 'محاسبي': 'accounting', 'محاسب': 'accountant', 'محاسبين': 'accountants',
  'راتب': 'salary', 'رواتب': 'salary', 'وظائف': 'jobs', 'وظيفه': 'job', 'توظيف': 'recruitment', 'دوره': 'course', 'دورات': 'courses', 'تدريب': 'training', 'شهاده': 'certificate', 'شهادات': 'certificates',
  'تصديق': 'attestation', 'توثيق': 'attestation', 'تجديد': 'renewal', 'هويه': 'id', 'تاشيره': 'visa', 'اقامه': 'residency', 'جواز': 'passport', 'حكومه': 'government', 'حكومي': 'government',
  'حكوميه': 'government', 'وزاره': 'ministry', 'هيئه': 'authority', 'بوابه': 'portal', 'تسجيل': 'registration', 'دخول': 'login', 'سعر': 'price', 'اسعار': 'prices', 'تكلفه': 'cost', 'افضل': 'best',
  'اكبر': 'top', 'مايكروسوفت': 'microsoft', 'دايناميكس': 'dynamics', 'داينامكس': 'dynamics', 'ديناميكس': 'dynamics', 'كوبايلوت': 'copilot', 'سيلزفورس': 'salesforce', 'ساب': 'sap',
  'اوراكل': 'oracle', 'نتسويت': 'netsuite', 'اودو': 'odoo', 'دبي': 'dubai', 'امارات': 'uae', 'اماراتي': 'uae', 'اماراتيه': 'uae', 'ابوظبي': 'abu dhabi', 'شارقه': 'sharjah', 'عجمان': 'ajman',
  'سعوديه': 'saudi', 'رياض': 'riyadh', 'جده': 'jeddah', 'قطر': 'qatar', 'دوحه': 'doha', 'مصر': 'egypt', 'كويت': 'kuwait', 'بحرين': 'bahrain', 'عمان': 'oman', 'خليج': 'gcc',
  'كيف': 'how to', 'ماهي': 'what is', 'ماهو': 'what is', 'ما': 'what', 'هو': '', 'هي': '', 'في': '', 'من': '', 'على': '', 'الى': '', 'عن': '', 'مع': 'with', 'او': '', 'و': '',
  'مبيعات': 'sales', 'بيع': 'sales', 'ماليه': 'finance', 'مالي': 'finance', 'اعمال': 'business', 'سحابه': 'cloud', 'سحابي': 'cloud', 'بيانات': 'data', 'امن': 'security', 'سيبراني': 'cyber',
  'تسويق': 'marketing', 'موقع': 'website', 'عقارات': 'real estate', 'تصنيع': 'manufacturing', 'مخزون': 'inventory', 'تنفيذ': 'implementation', 'شريك': 'partner', 'شركاء': 'partners',
  'مرخص': 'certified', 'معتمد': 'certified', 'معتمده': 'certified', 'متطلبات': 'requirements', 'دليل': 'guide', 'مقارنه': 'comparison', 'مجاني': 'free', 'تحميل': 'download' };
const fitArNorm = (s) => String(s || '').normalize('NFKC').replace(/[ً-ٰٟۖ-ۭ]/g, '').replace(/ـ/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
// the glossary in the same normal form as the keyword (so "وظائف" and "وظايف", "شركة" and "شركه" are one word)
const FIT_AR_WORDS = Object.fromEntries(Object.entries(FIT_AR_WORDS_SRC).map(([k, v]) => [fitArNorm(k), v]));
const FIT_AR_PHRASES = FIT_AR_PHRASES_SRC.map(([k, v]) => [fitArNorm(k), v]);
// the article and the one-letter prefixes glued to it ("الامارات", "بالامارات", "للشركات"); a word of 3 letters or less is never cut
const fitArStem = (w) => { if (FIT_AR_WORDS[w] !== undefined) return w; const m = w.match(/^(?:وال|بال|كال|فال|لل|ال)(.{2,})$/); if (m && m[1].length >= 2) return m[1];
  const v = w.match(/^و(.{3,})$/); return v && FIT_AR_WORDS[v[1]] !== undefined ? v[1] : w; };
// "استشارات الذكاء الاصطناعي في دبي" -> { text: "consulting ai dubai", read: true, unread: [] }; an English keyword comes back unchanged
const fitArabic = (s) => {
  const raw = String(s || '');
  if (!FIT_AR.test(raw)) return { text: raw, read: false, unread: [] };
  const toks = fitArNorm(raw).split(/[^\p{L}\p{M}\p{N}.&]+/u).filter(Boolean).map(t => FIT_AR.test(t) ? fitArStem(t) : t.toLowerCase());
  const out = [], unread = [];
  for (let i = 0; i < toks.length;) {
    let hit = null;
    for (const [p, en] of FIT_AR_PHRASES) { const pw = p.split(' '); if (pw.length > 1 && pw.every((w, j) => toks[i + j] === w)) { hit = [pw.length, en]; break; } }
    if (hit) { out.push(hit[1]); i += hit[0]; continue; }
    const t = toks[i++];
    if (!FIT_AR.test(t)) { out.push(t); continue; }
    const one = FIT_AR_PHRASES.find(([p]) => p === t);
    if (one) { out.push(one[1]); continue; }
    if (FIT_AR_WORDS[t] !== undefined) { if (FIT_AR_WORDS[t]) out.push(FIT_AR_WORDS[t]); continue; }
    out.push(t); unread.push(t);
  }
  return { text: out.join(' ').replace(/\s+/g, ' ').trim(), read: true, unread };
};
// ---- MKT (2026-10-27, docs/mismatch-audit-2026-10-27/AUDIT.md §2.4, M4 / M5 / M7): WHERE a keyword or a text points ----
// FIT_GEO above says only "this word is a place", so "ai automation solutions gcc" for a Pakistan website passed as "in your market". The
// gazetteer attaches countries (ISO-2) to the place words: a country, its people, its capital and largest cities; a region is the set of its
// countries. One table for the engine (fitGate's `ctx.market`) and the app (shared/src/markets.ts imports it through fit-gate.generated.js).
// Never the bare word "us"; demonyms that are also languages (german, french, spanish, italian, dutch, english) are not places
// ("spanish translation services" is not about Spain); "online", "near me", "global", "worldwide" are not places.
const FIT_PLACES_SRC = [
  ['AE', 'uae|united arab emirates|emirates|emirati|dubai|abu dhabi|sharjah|ajman|fujairah|ras al khaimah|umm al quwain|al ain'],
  ['SA', 'saudi|saudi arabia|ksa|riyadh|jeddah|dammam|khobar|al khobar|mecca|makkah|medina|madinah'],
  ['PK', 'pakistan|pakistani|lahore|karachi|islamabad|rawalpindi|faisalabad|multan|peshawar|quetta|sialkot|gujranwala'],
  ['IN', 'india|indian|delhi|new delhi|mumbai|bangalore|bengaluru|chennai|pune|kolkata|ahmedabad|noida|gurgaon|gurugram'],
  ['IN PK', 'hyderabad'],
  ['GB', 'uk|united kingdom|britain|great britain|british|england|scotland|wales|london|manchester|birmingham|leeds|glasgow|edinburgh'],
  ['US', 'usa|united states|united states of america|new york|nyc|california|texas|florida|chicago|los angeles|san francisco|houston|seattle|boston'],
  ['CA', 'canada|canadian|ottawa|toronto|montreal|vancouver|calgary'],
  ['AU', 'australia|australian|canberra|sydney|melbourne|brisbane'],
  ['NZ', 'new zealand|wellington|auckland|christchurch'],
  ['IE', 'ireland|irish|dublin|galway|limerick'],
  ['SG', 'singapore|singaporean'],
  ['ZA', 'south africa|south african|pretoria|johannesburg|cape town|durban'],
  ['DE', 'germany|deutschland|berlin|hamburg|munich|cologne|frankfurt'],
  ['FR', 'france|paris|marseille|lyon'],
  ['ES', 'spain|madrid|barcelona|valencia|seville'],
  ['IT', 'italy|rome|milan|naples|turin'],
  ['NL', 'netherlands|holland|amsterdam|rotterdam|the hague|utrecht'],
  ['BR', 'brazil|brazilian|brasilia|sao paulo|rio de janeiro'],
  ['MX', 'mexico|mexican|mexico city|guadalajara|monterrey'],
  // markets the product cannot measure (not in the COUNTRIES table): a keyword about them is flagged, and their rankings cannot be tracked
  ['QA', 'qatar|qatari|doha'], ['OM', 'oman|omani|muscat'], ['BH', 'bahrain|bahraini|manama'], ['KW', 'kuwait|kuwaiti'],
  ['EG', 'egypt|egyptian|cairo|alexandria'], ['JO', 'jordan|amman'], ['LB', 'lebanon|beirut'], ['TR', 'turkiye|istanbul|ankara'],
  ['CN', 'china|beijing|shanghai|shenzhen'], ['JP', 'japan|tokyo|osaka'], ['MY', 'malaysia|kuala lumpur'], ['ID', 'indonesia|jakarta'],
  ['PH', 'philippines|manila'], ['NG', 'nigeria|lagos|abuja'], ['KE', 'kenya|nairobi'], ['BD', 'bangladesh|dhaka'], ['LK', 'sri lanka|colombo'],
  ['NP', 'nepal|kathmandu'], ['AF', 'afghanistan|kabul'],
  // regions: the set of their countries ("gcc" is fine for a UAE website, not for a Pakistan one)
  ['AE SA QA OM BH KW', 'gcc|gcc countries|gulf|gulf countries|gulf region|arabian gulf|persian gulf|khaleej'],
  ['AE SA QA OM BH KW EG JO LB', 'middle east|mena|arab world|arab countries'],
  ['DE FR ES IT NL IE GB', 'europe|european|eu|european union'],
  ['US CA', 'north america'], ['BR MX', 'latin america|latam'], ['IN PK BD LK NP', 'south asia']];
const FIT_PLACES = FIT_PLACES_SRC.flatMap(([iso, ws]) => ws.split('|').map(w => ({ word: w, iso: iso.split(' '), region: iso.split(' ').length > 2 || iso === 'US CA' || iso === 'BR MX' })))
  .sort((a, b) => b.word.split(' ').length - a.word.split(' ').length || b.word.length - a.word.length);
// a one-word place is neutral for the topic rules, like the places FIT_GEO already held ("ai automation lahore" is about automation)
for (const p of FIT_PLACES) if (p.word.indexOf(' ') < 0) FIT_GEO.add(p.word);
// the comparable form of a text: Arabic read through the glossary, NFKC, lower case, dots dropped (u.a.e -> uae), every other mark a space
const fitPlaceText = (s) => { const raw = String(s || ''); const AR = fitArabic(raw);
  return ' ' + fitLow((AR.read ? AR.text + ' ' : '') + raw).replace(/\./g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' '; };
// every place a text names, longest phrase first (each word read once): [{ word, iso: [..], region }], in the order found
const fitPlaces = (s) => { let t = fitPlaceText(s); const out = [];
  for (const p of FIT_PLACES) { const k = ' ' + p.word + ' '; let i = t.indexOf(k);
    while (i >= 0) { out.push({ word: p.word, iso: p.iso.slice(), region: p.region, at: i }); t = t.slice(0, i) + ' | ' + t.slice(i + k.length - 1); i = t.indexOf(k); } }
  return out.sort((a, b) => a.at - b.at).map(({ word, iso, region }) => ({ word, iso, region })); };
// the keyword without the given place words (and the "in" / "for" left dangling): "ai automation solutions gcc" -> "ai automation solutions"
const FIT_PLACE_GLUE = /^(in|for|across|at|of|the|and|near|from|within|around|throughout|to)$/;
const fitDropPlaces = (keyword, words) => { if (FIT_AR.test(String(keyword || ''))) return '';
  let t = fitPlaceText(keyword); for (const w of (words || [])) t = t.split(' ' + w + ' ').join(' | ');
  const parts = t.split('|').map(x => x.trim().split(' ').filter(Boolean));
  for (const p of parts) { while (p.length && FIT_PLACE_GLUE.test(p[p.length - 1])) p.pop(); while (p.length && FIT_PLACE_GLUE.test(p[0])) p.shift(); }
  return parts.map(p => p.join(' ')).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(); };
// does a text point to the market `iso`? ok = it names no place, or at least one place that includes the market
//   { ok, iso, places, inside: [words], outside: [words], without: the text with the outside words dropped ('' when it cannot be said) }
const fitMarket = (s, iso) => { const m = String(iso || '').toUpperCase(); const places = fitPlaces(s);
  const inside = places.filter(p => p.iso.includes(m)).map(p => p.word), outside = places.filter(p => !p.iso.includes(m)).map(p => p.word);
  const ok = !m || !places.length || inside.length > 0;
  return { ok, iso: m, places, inside, outside, without: ok ? String(s || '').trim() : fitDropPlaces(s, outside) }; };
// ---- KW-GATE: what the client DECLARED it sells, widened by a small category tree, and the products of OTHER vendors ----
// A category search of what the client sells is in topic ("erp software uae" for a Business Central partner, "peppol uae" for an e-invoicing
// firm, "vat registration uae" next to e-invoicing compliance, "it company dubai" for an IT firm). A family is declared only by the client's
// own words (ctx.services / ctx.protect: services, business line, chosen keywords), never by a crawl or the research pool. `anchors` are product
// categories that count as matched words of the keyword; `words` join the topic words; `wide` are two-letter categories ("ai", "it") that
// count only with a word naming a seller ("best ai companies uae", "ai firm dubai"), so "ai online", "ai uae" and "best ai apps" stay too broad.
const FIT_FAMILIES = [
  // N1: `cat` = a product family; a service the client declared in it (Business Central, Dynamics 365 Finance, F&O; Dynamics 365 Sales; any
  // e-invoicing service) makes the family's category word one of the client's own (fitServiceAnchors), so "erp consultants" and "finance erp
  // system" are the work of a Business Central partner. `subj` = the names of the standard itself (not a vendor): a keyword about PINT-AE is
  // an e-invoicing firm's subject whatever else it asks ("pint-ae xml format mandatory fields").
  { re: /\b(erp|erps|enterprise resource planning|business central|dynamics 365 (finance|f ?& ?o|supply chain)|finance and operations|netsuite|sap|odoo|acumatica|epicor|sage (x3|intacct|200)|oracle (fusion|cloud erp|epm|erp))\b/, anchors: ['erp', 'erps'], words: ['erp'], cat: true },
  { re: /\b(e ?-?invoic\w*|einvoic\w*|electronic invoic\w*|peppol|fatoora)\b/, anchors: ['invoicing', 'invoice', 'invoices', 'einvoicing'], words: ['peppol', 'pint', 'fatoora', 'invoicing', 'einvoicing'], svc: ['vat'], cat: true, subj: ['peppol', 'pint', 'fatoora'] },
  { re: /\b(crm|dynamics 365 (sales|customer service|marketing)|customer engagement|salesforce|hubspot)\b/, anchors: ['crm'], words: ['crm'], cat: true },
  { re: /\b(vat|value added tax|tax (registration|consultan\w*|advis\w*|filing|compliance))\b/, anchors: ['vat'], words: [] },
  { re: /\b(ai|artificial intelligence|machine learning|copilot|genai|generative ai)\b/, anchors: [], words: [], wide: ['ai'] },   // no extra topic words: "generative ai" and "ai agent" stay as wide as "ai" (R13)
  { re: /\b(it (services|support|solutions|consulting|company|outsourcing|infrastructure)|managed it|information technology)\b/, anchors: [], words: [], wide: ['it'] }];
const FIT_TAX_SERVICE = /\b(registration|register|registering|deregistration|filing|returns?|compliance|compliant|consultants?|consultancy|consulting|advisors?|advisory|agents?|services?|refunds?|audit|auditing)\b/;
const FIT_SELLER = /\b(company|companies|firm|firms|agency|agencies|provider|providers|consultants?|consultancy|consultancies|consulting|services|service|partners?|vendors?|specialists?|experts?|solutions|integrators?)\b/;
const FIT_REAL_GEO = (t) => FIT_GEO.has(t) && t !== 'online' && t !== 'portal';
// the declared side, once per context: { text, toks: Set, anchors: Set, words: Set (stemmed), wide: Set }
const fitDeclared = (ctx) => {
  const o = ctx || {};
  const src = [...(Array.isArray(o.services) ? o.services : [o.services]), ...(o.protect || []), ...(o.brand_names || [])].filter(Boolean).map(x => fitLow(x)).join(' | ');
  const d = { text: src, toks: new Set(src.split(FIT_SPLIT_WORDS).filter(Boolean)), anchors: new Set(), words: new Set(), wide: new Set() };
  d.svc = new Set();
  for (const f of FIT_FAMILIES) if (f.re.test(src)) { f.anchors.forEach(a => d.anchors.add(a)); f.words.forEach(w => d.words.add(fitStem(w))); (f.wide || []).forEach(w => d.wide.add(w)); (f.svc || []).forEach(w => d.svc.add(w)); }
  // a product category the client named in a service ("CRM implementation", "Payroll outsourcing") is an anchor too (F-REH's rule, for every caller)
  for (const t of d.toks) if (FIT_SERVICE_CATS_K.has(t)) d.anchors.add(t);
  // what makes a vendor the client's own: everything the client told us, the topics included (some callers pass services only as topics)
  const topicsTxt = (Array.isArray(o.topics) ? o.topics : [o.topics]).filter(Boolean).map(x => fitLow(x)).join(' | ');
  d.vtext = src + ' | ' + topicsTxt; d.vtoks = new Set(d.vtext.split(FIT_SPLIT_WORDS).filter(Boolean));
  return d;
};
const FIT_SERVICE_CATS_K = new Set(['erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll']);
// Another company's PRODUCT or firm. Refused as 'other brand' unless the client declared it (its services, business line, chosen keywords or
// domain name it), or the keyword compares it ("dynamics 365 vs sap business one"). A partner word does not make SAP the client's: "sap
// implementation dubai" is a page for SAP's partners, not for a Dynamics 365 partner.
const FIT_VENDORS = [['SAP', ['sap', 's4hana']], ['Oracle NetSuite', ['netsuite'], ['oracle']], ['Oracle', ['oracle'], ['netsuite']], ['Odoo', ['odoo']], ['Sage', ['sage']], ['Acumatica', ['acumatica']],
  ['Epicor', ['epicor']], ['Infor', ['infor']], ['Syspro', ['syspro']], ['QuickBooks', ['quickbooks']], ['Xero', ['xero']], ['Tally', ['tally']], ['Zoho', ['zoho']], ['FreshBooks', ['freshbooks']],
  ['Microsoft Dynamics 365', ['dynamics', 'navision', 'axapta'], ['microsoft', 'business central']], ['Business Central', ['business central'], ['dynamics', 'microsoft']], ['Microsoft Copilot', ['copilot'], ['microsoft']],
  ['Salesforce', ['salesforce']], ['HubSpot', ['hubspot']], ['Pipedrive', ['pipedrive']], ['Freshworks', ['freshworks', 'freshsales']], ['Zendesk', ['zendesk']], ['ServiceNow', ['servicenow']], ['Workday', ['workday']],
  ['Storecove', ['storecove']], ['Pagero', ['pagero']], ['Avalara', ['avalara']], ['Sovos', ['sovos']], ['ClearTax', ['cleartax']], ['Edicom', ['edicom']], ['Tungsten', ['tungsten']], ['Basware', ['basware']],
  ['Comarch', ['comarch']], ['Banqup', ['banqup']], ['Unifiedpost', ['unifiedpost']], ['Tradeshift', ['tradeshift']], ['Coupa', ['coupa']],
  ['Capgemini', ['capgemini']], ['Deloitte', ['deloitte']], ['Accenture', ['accenture']], ['KPMG', ['kpmg']], ['PwC', ['pwc']], ['McKinsey', ['mckinsey']], ['IBM', ['ibm']], ['Infosys', ['infosys']],
  ['TCS', ['tcs']], ['Wipro', ['wipro']], ['Cognizant', ['cognizant']],
  ['OpenAI', ['openai', 'chatgpt']], ['Google Gemini', ['gemini']], ['Perplexity', ['perplexity']], ['Meta', ['meta']], ['Anthropic', ['anthropic', 'claude']], ['DeepSeek', ['deepseek']], ['Mistral', ['mistral']],
  ['Midjourney', ['midjourney']], ['Jasper', ['jasper']]];
// the first vendor the keyword names that the client did not declare: { name, word } or null
const fitVendor = (toks, decl, ownLabels) => {
  const line = ' ' + toks.join(' ') + ' ';
  const said = (w) => w.indexOf(' ') > 0 ? line.includes(' ' + w + ' ') : toks.includes(w);
  const declared = (w) => w.indexOf(' ') > 0 ? (' ' + String(decl.vtext || decl.text).replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ').includes(' ' + w + ' ') : ((decl.vtoks || decl.toks).has(w) || (ownLabels || []).includes(w));
  for (const [name, words, also] of FIT_VENDORS) {
    const w = words.find(said); if (!w) continue;
    if ([...words, ...(also || [])].some(declared)) continue;
    return { name, word: w };
  }
  return null;
};
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
const fitTopicWords = (topics) => new Set(fitSyn(Array.isArray(topics) ? topics.filter(Boolean).join(' ') : String(topics || ''))
  .split(FIT_SPLIT_WORDS).filter(t => t.length > 2 && !FIT_STOP.has(t) && !FIT_GEO.has(t)).map(fitStem));
// E-GATE (D4): words a buyer adds to any service search ("ai consulting cost uae", "best ai consulting firm dubai"). They say how the person
// buys, not what they buy, so they are neutral like a place: "ai consulting cost uae" was refused as off topic on the word "cost" alone.
const FIT_BUYER = new Set(['cost', 'costs', 'price', 'prices', 'pricing', 'fee', 'fees', 'quote', 'quotes', 'cheap', 'cheapest', 'affordable', 'firm', 'near', 'nearby']);
const fitAnd = (a) => a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
// the short topic phrase (2 to 6 words, never prose) whose every word the keyword carries ("consultants" carries "consulting": the same stem rule as fitTopic)
const fitCarriedName = (toks, topics) => { const ks = toks.filter(t => !FIT_GEO.has(t)).map(fitStem);
  const hit = (x) => { const s = fitStem(x); return ks.some(k => k === s || (k.length >= 5 && s.length >= 5 && (k.indexOf(s) === 0 || s.indexOf(k) === 0))); };
  for (const t of (Array.isArray(topics) ? topics : [topics])) { const raw0 = String(t || '').replace(/\s+/g, ' ').trim(); if (!raw0) continue; const raw = fitSyn(raw0);
    const w = fitTokens(raw).filter(x => !FIT_GEO.has(x) && !/^\d+$/.test(x));
    if (w.length < 2 || w.length > 6) continue;
    if (w.every(hit)) return raw0; }
  return ''; };
// B-3: the topics as PHRASES (one service name, one configured keyword, one description), so a common word can be judged against the name
// it came from. `dist` = the phrase's own distinctive words (stemmed); prose (more than 6 of them) never vouches for a common word.
const fitTopicPhrases = (topics) => (Array.isArray(topics) ? topics.filter(Boolean).map(String) : [String(topics || '')])
  .map(t => { const w = fitSyn(t).split(FIT_SPLIT_WORDS).filter(x => x.length > 2 && !FIT_STOP.has(x) && !FIT_GEO.has(x) && !/^\d+$/.test(x));
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
  // KW-GATE (2026-10-21): an Arabic keyword is judged on its English reading; a "number 1" claim says nothing about the subject
  const AR = fitArabic(keyword);
  const toks = fitTokens(fitSyn(AR.text).replace(/(^|\s)(no\.? ?1|number (one|1)|#1)(?=\s|$)/gi, ' '));
  const decl = o._decl || fitDeclared(o);
  for (const w of decl.words) T.add(w);
  const unread = new Set(AR.unread);
  let own = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !FIT_BUYER.has(t) && !/^[\d.]+$/.test(t));   // F-KW: a year or a number ("2026", "3.0") is neutral, like a place; E-GATE: so is a buyer's word (cost, firm)
  // KW-GATE: a product category the client declared (erp for a Business Central partner, vat and invoicing next to e-invoicing) is a matched word of the keyword
  // a neighbouring tax word ("vat" next to e-invoicing compliance) counts only when the keyword asks for a service done for the buyer:
  // "vat registration uae" is the client's work, "uae vat", "vat tax uae" and "online vat calculator" are not
  const svcAsk = FIT_TAX_SERVICE.test(' ' + toks.join(' ') + ' ');
  const anchors = [...new Set(toks.filter(t => decl.anchors.has(t) || (svcAsk && (decl.svc || new Set()).has(t))))];
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
  // an Arabic word the glossary cannot read is neither evidence nor a refusal once another word of the keyword matched
  if (unread.size && own.some(t => !unread.has(t) && matchOwn(t))) own = own.filter(t => !unread.has(t));
  if (!own.length) {
    const cats = [...new Set(toks.filter(t => (FIT_GENERIC.has(t) && !FIT_WIDE.has(t) && matches(t)) || decl.anchors.has(t)))];   // B-3: a wide word never stands for a category
    // MKT (2026-10-27): with the website's market given, only a place IN that market is "your market" ("erp software gcc" for a Pakistan site is not)
    const hasPlace = o.market ? fitMarket(keyword, o.market).inside.length > 0 : toks.some(FIT_REAL_GEO);
    if (cats.length >= 2 || (cats.length >= 1 && hasPlace)) return { ok: true, reason: '', detail: 'a category you sell (' + cats.join(', ') + ')' + (hasPlace ? ' in your market' : ''), share: 1 };
    // KW-GATE (review 13): "it company dubai" for an IT firm, "best ai companies uae" for an AI consultancy: a two-letter category the client
    // declared, with a word naming a seller. "ai", "ai uae", "ai online", "best ai apps" carry no seller and stay too broad.
    const wide = toks.filter(t => decl.wide.has(t));
    if (wide.length && FIT_SELLER.test(' ' + toks.join(' ') + ' ')) return { ok: true, reason: '', detail: 'a search for a provider of ' + wide[0].toUpperCase() + ', a category you sell', share: 1 };
    const carried = fitCarriedName(toks, topics);
    if (carried) return { ok: true, reason: '', detail: 'it names "' + carried + '", part of ' + label, share: 1 };
    // E-GATE (D4): the sentence names the words, not the keyword again (it read "... and the keywords you chose ("<the keyword itself>")")
    return { ok: false, reason: 'too broad', detail: (toks.length === 1 ? 'its one word, "' + toks[0] + '", is a category or a place' : 'it has only category or place words, ' + fitAnd(toks.map(t => '"' + t + '"'))) + ', so nothing in it points to ' + label, share: cats.length ? 0.5 : 0 };
  }
  const hits = own.filter(matchOwn);
  const share = Math.round(100 * (hits.length + anchors.length) / (own.length + anchors.length)) / 100;
  const readAs = AR.read ? ' (read as "' + AR.text + '")' : '';
  if (share < bar) return { ok: false, reason: 'off topic', detail: Math.round(share * 100) + '% of its own words match ' + label + ' (' + Math.round(bar * 100) + '% is the bar): '
    + own.filter(t => hits.indexOf(t) < 0).slice(0, 4).join(', ') + readAs + '. Add it to your services if you do sell it.', share };
  return { ok: true, reason: '', detail: Math.round(share * 100) + '% of its own words match ' + label + (anchors.length ? ' ("' + anchors.join('", "') + '" is a category you listed)' : ''), share };
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
// the declared product families (FIT_FAMILIES `cat`) of these services, read on the services alone (never the crawl)
const fitServiceFamilies = (services) => { const txt = (Array.isArray(services) ? services : [services]).filter(Boolean).map(x => fitSyn(x)).join(' | ');
  return txt ? FIT_FAMILIES.filter(f => f.cat && f.re.test(txt)) : []; };
const fitServiceAnchors = (keyword, services) => {
  const svc = new Set((Array.isArray(services) ? services : [services]).filter(Boolean).flatMap(x => fitTokens(fitSyn(x))).filter(t => FIT_SERVICE_CATS.has(t)).map(fitStem));
  for (const f of fitServiceFamilies(services)) f.anchors.forEach(a => svc.add(fitStem(a)));   // N1: Business Central / D365 Finance -> erp, D365 Sales -> crm
  if (!svc.size) return [];
  return [...new Set(fitTokens(fitSyn(keyword)).filter(t => FIT_SERVICE_CATS.has(t) && svc.has(fitStem(t))))];
};
function fitEvidence(keyword, topics, ctx) {
  const o = ctx || {};
  const T = fitTopicWords(topics);
  const anchors = fitServiceAnchors(keyword, o.services || []);
  // KW-GATE: judged on the topics alone here (no declared-category anchors), so a keyword that passes only through a declared category says so (basis below)
  const t = T.size ? fitTopic(keyword, topics, { ...o, topic_min_words: 1, _decl: { ...fitDeclared(o), anchors: new Set(), svc: new Set() } }) : { ok: false, share: null, detail: '' };
  if (t.ok && t.share != null) return { verdict: 'in', share: t.share, words: T.size, detail: t.detail, basis: 'topics' };
  // N1: the name of a standard the client works in (PINT-AE, Peppol, FATOORA for an e-invoicing service) makes the search the client's subject
  const subjToks = fitTokens(fitSyn(keyword));
  for (const f of fitServiceFamilies(o.services || [])) { const w = (f.subj || []).find(x => subjToks.includes(x));
    if (w) return { verdict: 'in', share: t.share == null ? null : t.share, words: T.size, basis: 'declared service', anchors: [w],
      detail: '"' + w + '" is part of a service you listed (' + (o.services || []).find(s => f.re.test(fitSyn(s))) + ')' }; }
  if (anchors.length) {
    // the share again, with the declared category word counted as the keyword's own and as matched
    const toks = fitTokens(fitSyn(keyword));
    const own = toks.filter(x => x.length > 2 && !FIT_GEO.has(x) && !FIT_GENERIC.has(x) && !FIT_BUYER.has(x) && !/^\d+$/.test(x));
    const PH = fitTopicPhrases(topics), known = [...T];
    const stemHit = (s, x) => x === s || (x.length >= 5 && s.length >= 5 && (s.indexOf(x) === 0 || x.indexOf(s) === 0));
    const ownStems = own.map(fitStem), allStems = toks.filter(x => x.length > 2 && !FIT_GEO.has(x)).map(fitStem);
    const viaName = (w) => { const s = fitStem(w); return PH.some(ph => !ph.prose && ph.dist.some(x => stemHit(s, x)) && (ph.dist.every(x => ownStems.some(k => stemHit(k, x))) || ph.words.filter(x => allStems.some(k => stemHit(k, x))).length >= 2)); };
    const hit = (w) => FIT_COMMON.has(w) ? viaName(w) : (T.has(fitStem(w)) || known.some(x => stemHit(fitStem(w), x)));
    const hits = own.filter(hit).length + anchors.length, all = own.length + anchors.length;
    const share = Math.round(100 * hits / all) / 100;
    const bar = typeof o.topic_bar === 'number' ? o.topic_bar : FIT_TOPIC_BAR;
    // N1: a category reached through a product the client listed is named with that product ("erp" for Dynamics 365 Business Central)
    const said = new Set((o.services || []).flatMap(x => fitTokens(fitSyn(x))).map(fitStem));
    const via = anchors.every(a => said.has(fitStem(a))) ? '' : ((o.services || []).find(s => fitServiceFamilies([s]).some(f => f.anchors.some(a => anchors.includes(a)))) || '');
    if (share >= bar) return { verdict: 'in', share, words: T.size, basis: 'declared service', anchors,
      detail: '"' + anchors.join('", "') + '" ' + (via ? 'is the category of ' + via + ', one of the services you listed' : 'is one of the services you listed') + (own.length ? ' (' + Math.round(share * 100) + '% of its own words match)' : '') };
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
// KW-GATE (review 8): what a recruitment or a training business calls what it sells. Read from the client's own short topics (service names,
// chosen keywords; never prose), so "Manpower supply", "Executive search", "Employment agency" keep job searches and "Power BI workshops",
// "Corporate learning programs", "Excel bootcamps" keep course searches. One definition for rule 4b and for fitCareer.
const FIT_SELLS_JOBS = /\b(recruit\w*|staffing|staff augmentation|hiring|headhunt\w*|talent (acquisition|search|solutions)|manpower|employment (agenc\w*|services?)|placements?|executive search|job (board|portal)s?|careers? (services?|coaching))\b/;
const FIT_SELLS_COURSES = /\b(train\w*|courses?|educat\w*|academ\w*|tutor\w*|learning|e-?learning|workshops?|bootcamps?|class(es)?|institutes?|institution|certification (training|courses?|programs?|preparation))\b/;
const fitSells = (topics) => { const short = (Array.isArray(topics) ? topics : [topics]).filter(t => t && fitTokens(t).length <= 6).map(fitLow).join(' | ');
  return { jobs: FIT_SELLS_JOBS.test(short), courses: FIT_SELLS_COURSES.test(short) }; };
// KW-GATE (review 6): a word the keyword itself carries is not evidence about the results page ("certification" in "iso 27001 certification
// dubai" is in every buyer's title too). The title / question is read without the keyword's own words.
const fitWithout = (text, toks) => { let t = ' ' + fitLow(text) + ' '; for (const w of toks) t = t.split(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')).join(' '); return t; };
function fitCareer(keyword, o) {
  o = o || {};
  const kw = fitLow(fitArabic(keyword).text).replace(/\s+/g, ' ').trim();
  const none = (why) => ({ career: false, points: 0, signals: [], detail: '', why });
  if (!kw) return none('no keyword');
  if (FIT_PRODUCT.test(' ' + kw + ' ') || FIT_BUYER_KW.test(' ' + kw + ' ')) return none('it carries a product or buyer word');
  const S = fitSells(o.topics);
  const sellsJobs = S.jobs, sellsCourses = S.courses;
  if (sellsJobs && sellsCourses) return none('this website sells recruitment and training');
  const kwToks = fitTokens(kw);
  const isJob = (p) => !sellsJobs && (FIT_JOB_HOSTS.test(p.domain) || FIT_JOB_PATH.test(p.path) || FIT_JOB_TITLE.test(fitWithout(p.title, kwToks)));
  const isCourse = (p) => !sellsCourses && (FIT_COURSE_HOSTS.test(p.domain) || FIT_COURSE_PATH.test(p.path) || FIT_COURSE_TITLE.test(fitWithout(p.title, kwToks)));
  const pages = (o.pages || []).map(p => typeof p === 'string' ? { domain: p, url: '', title: '' } : (p || {}))
    .map(p => ({ domain: fitHost(p.domain || p.url || ''), path: String(p.url || '').replace(/^https?:\/\/[^/]+/i, ''), title: String(p.title || '') })).filter(p => p.domain).slice(0, 10);
  const careerDom = [...new Set(pages.filter(p => isJob(p) || isCourse(p)).map(p => p.domain))];
  const qs = [...new Set((o.paa || []).map(q => String(q || '').trim()).filter(q => q && ((!sellsJobs && FIT_JOB_Q.test(fitWithout(q, kwToks))) || (!sellsCourses && FIT_COURSE_Q.test(fitWithout(q, kwToks))))))];
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
  // KW-GATE (review 5): questions and related searches alone never make a career search: at least one job, salary or course page must rank for it
  if (!careerDom.length) return { career: false, points, signals, detail: '', why: 'no job, salary or course page ranks for it' };
  return { career: true, points, signals, why: '',
    detail: 'people searching it are mostly looking for work or training, not for a provider: ' + signals.join('; ') };
}
// ctx: { intent, own_domain, competitors: [domains, declared], serp_domains: [domains on the results page / auto-detected rivals], brands: { name: domain } (learned),
//       serp: [this keyword's own top domains, in rank order] (optional), protect: [words of the head term / seeds / services], relevance: fn (G19 hook) }
function fitGate(keyword, ctx) {
  ctx = ctx || {};
  // KW-GATE (2026-10-21): an Arabic keyword is judged on its English reading (fitArabic); the sentence says how it was read
  const AR = fitArabic(String(keyword || ''));
  const kw = AR.text.toLowerCase().replace(/\s+/g, ' ').trim();
  const res = (r) => (AR.read && r && r.ok === false && r.detail && !/read as "/.test(r.detail)) ? { ...r, detail: r.detail + ' (read as "' + AR.text + '")' } : r;
  const toks = fitTokens(kw); const squashed = toks.join('');
  if (!toks.length) return { ok: false, reason: 'empty', detail: 'no keyword' };
  const protect = [...new Set((ctx.protect || []).flatMap(p => fitTokens(p)))];
  const decl = fitDeclared(ctx);
  const has = (re) => re.test(' ' + kw + ' ');
  const contentWord = has(FIT_CONTENT), partnerWord = has(FIT_PARTNER), compareWord = has(FIT_COMPARE), portalWord = has(FIT_PORTAL);
  const topicsOn = !!(ctx.topics && (Array.isArray(ctx.topics) ? ctx.topics.length : String(ctx.topics).trim()));
  const sellsWhat = fitSells(ctx.topics || []);
  // 1. the website itself
  // F-KW (2026-10-20, finding 5): only a DISTINCTIVE label is a brand. On an exact-match domain the label is made of the very words the client
  //    sells ("erp-software.ae" -> "erpsoftware"), and "erp software uae" was refused as the site's own brand (fitOwnLabels above).
  // KW-GATE (2026-10-21): a label that is also a word of what the client declared is its TOPIC as well as its name: "peppol" for peppol.org
  //    (services "Peppol network", "Peppol access point certification") made "what is peppol", "peppol access point" and "peppol uae"
  //    navigational. Such a label is judged like any other topic word; a login, a job or a course search for it is still refused below.
  const ownLabels = fitOwnLabels(ctx.own_domain, toks, protect);
  for (const l of ownLabels) if ((toks.includes(l) || squashed.includes(l)) && !decl.toks.has(l)) {
    if (has(FIT_JOBS) && !sellsWhat.jobs) return { ok: false, reason: 'job search', detail: 'people looking for work at this company (' + l + '), not buyers of what it sells' };
    return { ok: false, reason: 'own brand', detail: 'names the website itself (' + l + ')' };
  }
  // 2. the search data says navigational
  if (String(ctx.intent || '').toLowerCase() === 'navigational') return { ok: false, reason: 'navigational', detail: 'the search data classifies it as navigational (people look for one particular website)' };
  // 2b. MKT (2026-10-27, AUDIT M4): with the website's market given (ctx.market, ISO-2), a keyword that names only places outside it is a
  //     search of another market ("ai automation solutions gcc" for a Pakistan website). The keyword the client chose itself (ctx.protect,
  //     the whole keyword) is never refused here: the app asked them first, and they decided.
  if (ctx.market) {
    const mk = fitMarket(String(keyword || ''), ctx.market);
    const chosen = (ctx.protect || []).some(p => fitLow(p).replace(/\s+/g, ' ').trim() === fitLow(keyword).replace(/\s+/g, ' ').trim());
    if (!mk.ok && !chosen) return res({ ok: false, reason: 'other market', detail: 'a search about ' + fitAnd(mk.outside.map(w => '"' + w + '"')) + ', outside the market this website is measured in (' + mk.iso + ')' });
  }
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
  // KW-GATE (review 2): a results page full of government sites says the searcher may want the public body, unless the keyword carries what
  //    the client declared it sells: "vat registration uae" for a VAT consultancy (tax.gov.ae, u.ae, mof.gov.ae, ey, pwc) is its own service
  const declaredHere = () => topicsOn && (toks.some(t => decl.anchors.has(t)) || fitTopic(AR.read ? keyword : kw, ctx.topics, { ...ctx, topic_min_words: 1, _decl: decl }).ok);
  if (serp.length >= FIT_CFG.serp_hold && serp.filter(fitGovHost).length >= FIT_CFG.serp_hold && !partnerWord && !declaredHere()) return { ok: false, reason: 'government', detail: 'the results page belongs to government sites (' + [...new Set(serp.filter(fitGovHost))].slice(0, 3).join(', ') + ')' };
  // B-3 (2026-10-17): what the site's own topics say it sells (empty when none are on file), for the two rules below
  const topicT = topicsOn ? fitTopicWords(ctx.topics) : null;
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
  //     (KW-GATE review 8: manpower, employment agencies, executive search and placements are recruitment too)
  if (has(FIT_JOBS) && !has(FIT_PRODUCT) && !sellsWhat.jobs && !sells(/^(recruit|staff|hiring|job|career|headhunt|talent)/)) return res({ ok: false, reason: 'job search', detail: 'people looking for work, not buyers of what this website sells' });
  //     KW-GATE: a person looking for a course for themselves ("netsuite certification course"), unless the client sells training
  if (has(FIT_COURSE_ONLY) && !has(FIT_PRODUCT) && !has(FIT_BUYER_KW) && !sellsWhat.courses) return res({ ok: false, reason: 'job search', detail: 'people looking for a course or a certificate for themselves, not buyers of what this website sells' });
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
  // 5c. KW-GATE (review 3, 4, 14; moved here from the full report so every path decides the same): a company's own name in front of a colon
  //     ("ingoude: erp solutions dubai") or of a "number 1" claim ("ibt no 1 bpo company in middle east"). The name must be a word that is no
  //     category, place or topic word: "dynamics 365: business central pricing" and "no 1 erp company in uae" are searches for what the client sells.
  const nameWords = (s) => fitTokens(s).filter(t => !FIT_GENERIC.has(t) && !FIT_GEO.has(t) && !FIT_WIDE.has(t) && !FIT_BUYER.has(t) && !/^[\d.]+$/.test(t)
    && !decl.toks.has(t) && !protect.includes(t) && !(topicT && topicT.has(fitStem(t))));
  // only a short name (one or two words) of a keyword, never a question ("Odoo or Business Central: which ERP ...?" is a comparison)
  const colon = String(keyword || '').includes('?') ? null : kw.match(/^([\p{L}\p{N}&.' -]{2,24}):\s+\S/u);
  if (colon && fitTokens(colon[1]).length <= 2 && !compareWord && !/\bor\b/.test(colon[1]) && nameWords(colon[1]).length) return res({ ok: false, reason: 'other brand', detail: 'starts with a company\'s own name (' + nameWords(colon[1]).join(' ') + '), not a topic' });
  const claim = kw.match(/^(.*?)(?:^|\s)(no\.? ?1|number (?:one|1)|#1)(?=\s|$)/);
  if (claim && nameWords(claim[1]).length) return res({ ok: false, reason: 'other brand', detail: 'a company\'s own "number 1" claim (' + nameWords(claim[1]).join(' ') + '), not a topic' });
  // 5d. a list of companies in ANOTHER industry ("top facilities management companies uae"), judged even when few topic words are on file;
  //     category words are neutral ("best erp companies in dubai" is judged by the topic rule below)
  const list = kw.match(/^(?:top|best|leading|biggest|largest)\s+(?:\d+\s+)?(.+?)\s+(?:companies|firms|providers|agencies|suppliers|contractors)\b/);
  if (list && topicT && topicT.size) {
    const T2 = new Set([...topicT, ...decl.words]);
    const w = fitTokens(list[1]).filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !decl.anchors.has(t) && !/^[\d.]+$/.test(t));
    const hit = (t) => { const st = fitStem(t); return T2.has(st) || [...T2].some(x => x.length >= 5 && st.length >= 5 && (st.indexOf(x) === 0 || x.indexOf(st) === 0)); };
    if (w.length && !w.some(hit)) return res({ ok: false, reason: 'off topic', detail: 'a list of companies in another industry (' + w.join(' ') + '), nothing this website sells' });
  }
  // 6. relevance to the website's services: the caller's own hook (G19) first, else the topic bar when the caller gave topics (R13)
  if (typeof ctx.relevance === 'function') { const r = ctx.relevance(kw); if (r && r.ok === false) return res({ ok: false, reason: r.reason || 'off topic', detail: r.detail || '' }); }
  else if (topicsOn) {
    const t = fitTopic(AR.read ? keyword : kw, ctx.topics, { ...ctx, _decl: decl });
    if (!t.ok) {
      // KW-GATE: off topic only BECAUSE every word of its own is another vendor's product ("netsuite pricing", "meta ai", "cleartax vs zoho"):
      // the client reads the real reason, another company's brand
      const ownW = toks.filter(x => x.length > 2 && !FIT_GEO.has(x) && !FIT_GENERIC.has(x) && !FIT_BUYER.has(x) && !/^[\d.]+$/.test(x));
      const vs = ownW.length && t.reason === 'off topic' ? ownW.map(x => fitVendor([x], decl, ownLabels)) : [];
      if (vs.length && vs.every(Boolean)) return res({ ok: false, reason: 'other brand', detail: 'names ' + [...new Set(vs.map(v => v.name))].join(' and ') + ', another company\'s product or firm, which is not among what you sell' });
      return res({ ok: false, reason: t.reason, detail: t.detail });
    }
  }
  // 7. KW-GATE (2026-10-21): a product or a firm of ANOTHER vendor the client did not declare ("netsuite pricing" and "sap implementation dubai"
  //     for a Dynamics 365 partner, "storecove pricing" for peppol.org, "tech consultant deloitte"). A comparison is a topic of its own and stays
  //     ("dynamics 365 vs sap business one"); the client's own products never count (its services, business line, chosen keywords, domain).
  //     No evidence, no refusal: only with the client's services, or 12+ topic words, on file. It runs after the topic rule, so a keyword that is off topic anyway keeps that reason (the app's port of this gate, app/shared/src/fit-gate.ts, and the shared cadence fixture agree on it).
  if (!compareWord && ((topicT && topicT.size >= 12) || (Array.isArray(ctx.services) && ctx.services.filter(Boolean).length))) { const v = fitVendor(toks, decl, ownLabels.length ? ownLabels : fitLabels(ctx.own_domain, [])); if (v) return res({ ok: false, reason: 'other brand', detail: 'names ' + v.name + ', another company\'s product or firm, which is not among what you sell' }); }
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
// ---- KW-COMP (2026-10-21, K6 / A-24 / RV-6): who is a COMPETITOR, one answer for research, the ladder and the full report ----
// Research took its competitors from ONE results page and its #2 was a job board (naukrigulf.com): 545 of 1,168 pool keywords came from
// job and directory sites. On 2026-10-21 the set held help.ardoq.com and job boards again. The leaders (Semrush, Ahrefs) pick organic
// competitors by keyword OVERLAP. A competitor here is a business that ranks for several of the client's in-topic keywords and sells
// something comparable; never a job board, directory, marketplace, review site, news or media site, government or free-zone authority,
// search engine, social network, Q&A site, the help / docs / community pages of another product, a course provider, an encyclopedia, a
// global platform, a "top 10 companies" list, or the client itself.
//  * CMP.kindOf(domain, url, title, snippet) -> { kind, label, by: 'host' | 'result' }: 'business' when nothing rules it out.
//    A HOST kind (naukrigulf.com, help.ardoq.com, difc.ae) rules the whole domain out; a RESULT kind (a jobs page, a list article, a
//    course page on an ordinary business domain) only means that one result is no evidence of competing.
//  * CMP.select({ serps: [{ keyword, items }], declared, own_domain, n, boost }) -> { picked, excluded, too_few, serps_read, note }
//    Scores each business by how many of the results pages the run already bought it appears in, weighted by position. With three or more
//    pages read a business must appear on at least two ("several of your keywords"). The competitors the owner declared stay first.
//    Nothing here buys anything.
const CMP = (() => {
  const S = (v) => String(v == null ? '' : v);
  const host = (h) => S(h).toLowerCase().trim().replace(/^[a-z]+:\/\//, '').replace(/^www\d?\./, '').replace(/[\/?#:].*$/, '').replace(/\.$/, '');
  const reg = (h) => { const x = host(h); const p = x.split('.').filter(Boolean); if (p.length <= 2) return x;
    const sl = p.slice(-2).join('.'); return /^(co|com|org|net|gov|ac|edu|ltd|plc|sch|nic|mil|gob|gouv)\.[a-z]{2}$/.test(sl) ? p.slice(-3).join('.') : sl; };
  const LABEL = { you: 'your own site', job: 'job board', directory: 'business directory', marketplace: 'marketplace or freelance platform',
    review: 'review or comparison site', media: 'news or media site', gov: 'government or free-zone authority', search: 'search engine',
    social: 'social network', qa: 'Q&A site or forum', help: 'help, docs or community pages of another product', education: 'course or education provider',
    reference: 'encyclopedia or reference site', platform: 'global software platform', list: 'list of companies, not a seller', business: 'business', unknown: 'unreadable address' };
  // the name, then only a public suffix (indeed.com, uk.indeed.com, indeed.ae, x.co.uk): a business's own subdomain "connect.acme.com" is not "connect"
  const SUF = '(?:com|net|org|co|io|ai|info|biz|me|tv|ly|app|fyi|news|[a-z]{2})(?:\\.[a-z]{2})?';
  const alt = (a) => new RegExp('(^|\\.)(' + a.join('|').replace(/\./g, '\\.') + ')\\.' + SUF + '$');
  // host lists: the name before the public suffix, any country ending (indeed.com, indeed.ae)
  const HOSTS = [
    ['search', alt(['google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'yandex', 'ask', 'ecosia', 'naver', 'brave'])],
    ['social', alt(['linkedin', 'facebook', 'instagram', 'twitter', 'x', 'tiktok', 'youtube', 'youtu', 'pinterest', 'threads', 'snapchat', 'vimeo', 'telegram', 't', 'whatsapp', 'slideshare', 'scribd'])],
    ['qa', alt(['reddit', 'quora', 'stackoverflow', 'stackexchange', 'superuser', 'serverfault', 'answers', 'discord', 'spiceworks'])],
    ['job', alt(['naukrigulf', 'naukri', 'indeed', 'glassdoor', 'bayt', 'monster', 'monstergulf', 'foundit', 'gulftalent', 'ziprecruiter', 'jooble', 'careerjet',
      'simplyhired', 'wellfound', 'laimoon', 'drjobpro', 'jobsdb', 'jobstreet', 'seek', 'reed', 'totaljobs', 'careerbuilder', 'rozee', 'dubaicareers', 'gulfjobs', 'naukrigulf', 'akhtaboot', 'tanqeeb', 'wuzzuf', 'payscale', 'salary', 'levels'])],
    ['review', alt(['g2', 'capterra', 'getapp', 'softwareadvice', 'trustradius', 'trustpilot', 'peerspot', 'softwaresuggest', 'gartner', 'sitejabber', 'saashub',
      'alternativeto', 'producthunt', 'selecthub', 'financesonline', 'comparably', 'reviews', 'softwareworld', 'crozdesk', 'technologyadvice'])],
    ['directory', alt(['clutch', 'themanifest', 'goodfirms', 'sortlist', 'designrush', 'techbehemoths', '2gis', 'yellowpages', 'yelp', 'crunchbase', 'dnb', 'zoominfo',
      'kompass', 'hidubai', 'uaeyp', 'serchen', 'topdevelopers', 'itfirms', 'appfutura', 'f6s', 'owler', 'cbinsights', 'tracxn', 'pitchbook', 'dubaidirectory',
      'uaecompanies', 'yello', 'cybo', 'tradeindia', 'europages', 'expertmarket', 'agencyspotter', 'upcity', 'bark', 'thumbtack', 'emiratesyellowpages'])],
    ['marketplace', alt(['upwork', 'fiverr', 'freelancer', 'toptal', 'peopleperhour', 'guru', 'amazon', 'noon', 'daraz', 'ebay', 'alibaba', 'aliexpress', 'dubizzle',
      'bayut', 'propertyfinder', 'appsource.microsoft', 'apps.shopify', 'marketplace.microsoft', 'aws.amazon', 'apps.odoo', 'play.google', 'apps.apple'])],
    ['media', alt(['khaleejtimes', 'gulfnews', 'thenationalnews', 'thenational', 'arabianbusiness', 'zawya', 'gulfbusiness', 'emirates247', 'wam', 'bloomberg', 'reuters',
      'forbes', 'forbesmiddleeast', 'cnbc', 'bbc', 'cnn', 'nytimes', 'theguardian', 'businessinsider', 'techcrunch', 'wired', 'zdnet', 'computerweekly', 'itp', 'economymiddleeast',
      'wamda', 'medium', 'substack', 'entrepreneur', 'inc', 'fastcompany', 'venturebeat', 'techradar', 'theverge', 'engadget', 'mashable', 'hbr', 'techtarget', 'cio',
      'computerworld', 'infoworld', 'analyticsinsight', 'towardsdatascience', 'kdnuggets', 'marktechpost', 'abcmoney', 'ft', 'wsj', 'economist', 'aljazeera', 'alarabiya',
      'skynewsarabia', 'albayan', 'alkhaleej', 'emaratalyoum', 'gitex', 'menabytes', 'magnitt', 'smeadvisor', 'cxotoday', 'datacenterdynamics', 'itnewsafrica', 'tahawultech'])],
    ['reference', alt(['wikipedia', 'wikihow', 'wikidata', 'britannica', 'investopedia', 'merriam-webster', 'dictionary', 'thefreedictionary', 'wiktionary', 'statista'])],
    ['education', alt(['coursera', 'udemy', 'edx', 'simplilearn', 'greatlearning', 'mygreatlearning', 'upgrad', 'udacity', 'datacamp', 'skillshare', 'pluralsight',
      'euro-training', 'usaii', 'iabac', 'knowledgehut', 'edureka', 'intellipaat', 'futurelearn', 'khanacademy', 'britishcouncil', 'emeritus', 'classcentral', 'w3schools'])],
    // free zones and authorities of the UAE (a business sets up THROUGH them; they compete with no one), plus the region's tax portals
    ['gov', alt(['difc', 'dmcc', 'dafz', 'jafza', 'rakez', 'ifza', 'meydanfz', 'shams', 'adgm', 'dso', 'dwtc', 'kezad', 'saif-zone', 'srtip', 'hfz', 'dic', 'dubaiinternetcity',
      'dubaicommercity', 'fujairahfreezone', 'ajmanfreezone', 'uaqftz', 'adafz', 'twofour54', 'dubaichamber', 'abudhabichamber', 'sharjahchamber', 'ded', 'dubaided', 'tamm',
      'u', 'zatca', 'mof', 'mohre', 'dubai', 'abudhabi', 'investindubai', 'gdrfad', 'moec', 'tdra',
      // KWL-RES D10: government foundations and initiatives (dubaifuture.ae was a ladder's #1 "competitor"); the title rule below finds the rest
      'dubaifuture', 'digitaldubai', 'smartdubai', 'dub', 'dubaiai', 'museumofthefuture', 'mbrf', 'mbrsg', 'adio', 'dubaiaicampus', 'aiseer'])],
    ['platform', alt(['microsoft', 'dynamics', 'office', 'apple', 'oracle', 'sap', 'salesforce', 'hubspot', 'ibm', 'aws', 'azure', 'github', 'gitlab', 'atlassian', 'zoho',
      'shopify', 'wix', 'wordpress', 'squarespace', 'adobe', 'openai', 'nvidia', 'meta', 'notion', 'odoo', 'intuit', 'quickbooks', 'xero', 'netsuite', 'workday', 'servicenow', 'cloudflare'])],
  ];
  const HELP_SUB = /^(help|support|docs|doc|documentation|kb|knowledge|knowledgebase|community|communities|techcommunity|academy|developer|developers|dev|learn|forum|forums|answers|faq|status|wiki|careers|jobs|training|university|partners?)\./;
  const kindOfHost = (domainOrUrl, own) => {
    const h = host(domainOrUrl); if (!h || !/\./.test(h)) return 'unknown';
    const o = host(own); if (o && (h === o || h.endsWith('.' + o) || reg(h) === reg(o))) return 'you';
    if (/(^|\.)(gov|mil|int|gob|gouv|govt|government)(\.[a-z]{2})?$/.test(h) || /\.(gov|mil)\.[a-z]{2}$/.test(h)) return 'gov';
    if (/(^|\.)(edu|ac)\.[a-z]{2}$/.test(h) || /\.edu$/.test(h)) return 'education';
    for (const [k, re] of HOSTS) if (re.test(h)) return k;
    if (HELP_SUB.test(h) && h.split('.').length >= 3) return 'help';
    const lab = reg(h).split('.')[0];
    if (/(jobs|careers|recruit|vacanc|hiring)/.test(lab)) return 'job';
    if (/(freezone|free-zone|freezon)/.test(lab) || /^[a-z]{2,10}fz$/.test(lab)) return 'gov';
    if (/(news|times|magazine|herald|tribune|gazette|journal|chronicle|insider|digest|money)$/.test(lab) || /^(the)?news/.test(lab)) return 'media';
    if (/(directory|yellowpages|listings?)$/.test(lab) || /^(top|best)(firms|companies|agencies|developers|vendors)/.test(lab)) return 'directory';
    if (/(university|college|institute|academy|school)$/.test(lab) || /^(university|college)/.test(lab)) return 'education';
    return 'business';
  };
  // what ONE result is, on an ordinary business domain: a jobs page, a list of companies, a course page (the domain may still compete elsewhere)
  const JOB_T = /\b(jobs?|vacanc(?:y|ies)|careers?|hiring|recruit\w*|salar(?:y|ies)|job openings?)\b/i;
  const JOB_AR = /(وظائف|وظيفة|رواتب|توظيف)/;
  const LIST_T = /\b(?:top|best|leading)\s+(?:\d+\s+)?[\w\s&.,-]{0,50}?\b(?:companies|firms|agencies|providers|consultants|consultancies|partners|vendors|developers|integrators|implementers|tools)\b|\b\d+\s+(?:best|top|leading)\b|\blist of\b|\btop\s*\d+\b/i;
  // the address of a list article: /rankings/..., /top-10-ai-consulting-companies, /blog/ai-companies-in-dubai (r04: consultancy-me.com, leewayhertz.com)
  const LIST_P = /\/(?:rankings?\/|[^\/?#]*\b(?:top|best)-(?:\d+-)?[^\/?#]*(?:companies|firms|agencies|providers|consultants|consultancies|vendors|partners|developers|tools)\b|[^\/?#]*\b(?:companies|firms|agencies)-in-)/;   // not "consultants-in-dubai": that is a vendor's own service page (hlbhamt.com)
  const LIST_AR = /(أفضل\s*\d*\s*شركات|قائمة)/;
  const COURSE_T = /\b(course|courses|certification (?:course|program(?:me)?|exam|training)|certificate program(?:me)?|bootcamp|diploma|program fee|enrol(?:l|ment)?|syllabus|curriculum|online training)\b/i;
  const COURSE_AR = /(دورة|دورات|شهادة معتمدة)/;
  const kindOfResult = (url, title, snippet) => {
    const t = S(title); const u = S(url).toLowerCase(); const p = u.replace(/^[a-z]+:\/\/[^\/]+/, '');
    if (JOB_T.test(t) || JOB_AR.test(t) || /\/(jobs?|careers?|vacanc\w*)(\/|$|-|\?)/.test(p)) return 'job';
    if (LIST_T.test(t) || LIST_AR.test(t) || LIST_P.test(p)) return 'list';
    if (COURSE_T.test(t) || COURSE_AR.test(t) || /\/(courses?|certifications?|training-courses?)(\/|$|-)/.test(p)) return 'education';
    return 'business';
  };
  // KWL-RES D10 (2026-10-21 live keyword test, exec 125): dubaifuture.ae (Dubai Future Foundation) was the ladder's top competitor: no host list
  // can name every authority, foundation, council or chamber, but their own results say what they are. A NAMED body ("Dubai Future Foundation",
  // "Roads and Transport Authority", "UAE Cyber Security Council", "Dubai Chamber") in the title, or a snippet that calls the site a government
  // entity / initiative, rules the whole domain out (a business result that merely mentions government work is not one: the name must end in
  // the word, or the snippet must say the site is the government's).
  // the name must be a whole segment of the title (the site name before or after "|", " - ", ":"), so a case study titled "How we helped
  // the Roads and Transport Authority" on a business's site is not read as the authority's own page
  const GOV_NAME_SEG = /^(?:the\s+)?(?:[A-Z][\w'&.-]*\s+(?:(?:of|and|for|the|de)\s+)?){1,6}(?:Foundation|Authority|Council|Chamber(?: of Commerce(?: and Industry)?)?|Municipality)(?:\s*\([A-Z]{2,6}\))?$|^(?:the\s+)?(?:Ministry|Government) of\s+[A-Z][\w\s&'-]{1,60}$/;
  const GOV_NAME_T = { test: (t) => S(t).split(/\s+[|\u2013\u2014:-]\s+|\s*\|\s*/).map(x => x.trim()).filter(Boolean).some(x => GOV_NAME_SEG.test(x)) };
  const GOV_SNIP = /\b(?:(?:a|an|the)\s+(?:federal|government|governmental|public)\s+(?:entity|initiative|agency|body|authority|department|foundation|organi[sz]ation|program(?:me)?|platform)|government[- ](?:owned|backed|led|initiative|entity)|established by (?:the )?(?:government|(?:an? |royal |emiri )?decree|law)|chamber of commerce|ministry of)\b/i;
  const govSignal = (title, snippet) => GOV_NAME_T.test(S(title)) || GOV_SNIP.test(S(title) + ' ' + S(snippet));
  const kindOf = (domain, url, title, snippet, own) => {
    const hk = kindOfHost(domain || url, own);
    if (hk !== 'business') return { kind: hk, label: LABEL[hk] || hk, by: 'host' };
    if (govSignal(title, snippet)) return { kind: 'gov', label: LABEL.gov, by: 'host' };
    const rk = kindOfResult(url, title, snippet);
    return { kind: rk, label: LABEL[rk] || rk, by: rk === 'business' ? '' : 'result' };
  };
  const weight = (p) => { const n = Number(p) || 99; return n <= 10 ? +(1 - (n - 1) * 0.07).toFixed(2) : n <= 20 ? 0.25 : n <= 30 ? 0.1 : 0; };
  const listOf = (v) => (Array.isArray(v) ? v : S(v).split(/[,;\n]+/)).map(host).filter(Boolean);
  const select = (o) => {
    o = o || {}; const own = host(o.own_domain); const n = Math.max(1, Number(o.n) || 3);
    const serps = (Array.isArray(o.serps) ? o.serps : []).filter(s => s && Array.isArray(s.items) && s.items.some(x => x && (!x.type || x.type === 'organic')));
    const read = serps.length;
    const cand = new Map(); const excl = new Map();
    // KWL-RES D10: a domain one of whose results names it a government body is a government body on every results page
    const govRegs = new Set(); for (const s of serps) for (const it of s.items) { if (!it || (it.type && it.type !== 'organic')) continue; const h = host(it.domain || it.url);
      if (h && kindOfHost(h, own) === 'business' && govSignal(it.title, it.description || it.snippet)) govRegs.add(reg(h)); }
    serps.forEach((s, si) => {
      const kw = S(s.keyword).trim();
      const seenHere = new Set();
      for (const it of s.items) {
        if (!it || (it.type && it.type !== 'organic')) continue;
        const h = host(it.domain || it.url); if (!h) continue;
        const pos = Number(it.rank_group || it.rank_absolute || it.rank || it.position) || 99;
        const k0 = kindOf(h, it.url, it.title, it.description || it.snippet, own);
        const k = (k0.kind === 'business' || k0.by === 'result') && govRegs.has(reg(h)) ? { kind: 'gov', label: LABEL.gov, by: 'host' } : k0;
        const d = k.by === 'host' ? (k.kind === 'gov' && govRegs.has(reg(h)) ? reg(h) : h) : reg(h);
        if (k.kind === 'you') continue;
        if (k.kind !== 'business') {
          const e = excl.get(d) || { domain: d, kind: k.kind, label: k.label, by: k.by, seen_in: 0, best_position: 99, example: '', kinds: {} };
          e.best_position = Math.min(e.best_position, pos);
          e.kinds[k.kind] = (e.kinds[k.kind] || 0) + 1;
          if (!seenHere.has('x:' + d)) { e.seen_in++; seenHere.add('x:' + d); }
          if (!e.example) e.example = S(it.title).replace(/\s+/g, ' ').trim().slice(0, 90) + (kw ? ' (for "' + kw + '")' : '');
          excl.set(d, e); continue;
        }
        if (seenHere.has(d)) continue; seenHere.add(d);
        const c = cand.get(d) || { domain: d, serps: 0, score: 0, best_position: 99, keywords: [] };
        const b = typeof o.boost === 'function' ? (Number(o.boost(it, d)) || 1) : 1;
        c.serps++; c.score = +(c.score + weight(pos) * b).toFixed(3); c.best_position = Math.min(c.best_position, pos);
        if (kw && c.keywords.length < 6) c.keywords.push(kw + ' #' + pos);
        cand.set(d, c);
      }
    });
    // a domain with result-level exclusions AND a counting appearance is a business: its list / jobs page is not held against it
    for (const d of cand.keys()) { const e = excl.get(d); if (e && e.by === 'result') excl.delete(d); }
    for (const e of excl.values()) if (e.by === 'result') { const top = Object.entries(e.kinds).sort((a, b) => b[1] - a[1])[0]; e.kind = top[0]; e.label = LABEL[e.kind] || e.kind; }
    const minSerps = read >= 3 ? 2 : 1;
    const ev = (c) => read <= 1 ? 'ranks #' + c.best_position + (c.keywords[0] ? ' for "' + c.keywords[0].replace(/ #\d+$/, '') + '"' : '') + ' (the only results page read)'
      : 'ranks for ' + c.serps + ' of your ' + read + ' keywords (best #' + c.best_position + ')';
    const ranked = [...cand.values()].sort((a, b) => b.score - a.score || b.serps - a.serps || a.best_position - b.best_position || a.domain.localeCompare(b.domain));
    const too_few = ranked.filter(c => c.serps < minSerps).map(c => ({ domain: c.domain, serps: c.serps, why: 'seen on only ' + c.serps + ' of your ' + read + ' results pages' }));
    const fromSerps = ranked.filter(c => c.serps >= minSerps);
    // the owner's own list first: kept unless the address itself is a job board, a directory, an authority… (said, not silently dropped)
    const declared = []; const declaredRefused = [];
    for (const d0 of [...new Set(listOf(o.declared))]) {
      const hk = kindOfHost(d0, own); if (hk === 'you') continue;
      const d = hk === 'business' || hk === 'unknown' ? reg(d0) : d0;
      if (hk !== 'business' && hk !== 'unknown') { declaredRefused.push({ domain: d, kind: hk, label: LABEL[hk], by: 'host', seen_in: 0, example: 'you named it as a competitor, but it is a ' + LABEL[hk] }); continue; }
      if (declared.some(x => x.domain === d)) continue;
      const c = cand.get(d);
      declared.push({ domain: d, source: 'declared', serps: c ? c.serps : 0, of: read, score: c ? c.score : 0, best_position: c ? c.best_position : null,
        keywords: c ? c.keywords : [], evidence: 'declared by you as a competitor' + (c ? '; ' + ev(c) : read ? '; not seen on the ' + read + ' results page(s) read' : '') });
    }
    const picked = [...declared, ...fromSerps.filter(c => !declared.some(x => x.domain === c.domain))
      .map(c => ({ domain: c.domain, source: 'results', serps: c.serps, of: read, score: c.score, best_position: c.best_position, keywords: c.keywords, evidence: ev(c) }))].slice(0, Math.max(n, declared.length));
    const excluded = [...declaredRefused, ...[...excl.values()].sort((a, b) => b.seen_in - a.seen_in || a.best_position - b.best_position || a.domain.localeCompare(b.domain))]
      .map(({ kinds, ...e }) => e);
    const exText = excluded.slice(0, 6).map(e => e.domain + ' (' + e.label + ')').join(', ');
    const note = !read
      ? (declared.length ? 'No results page was read on this run, so only the competitor(s) you declared are used: ' + declared.map(d => d.domain).join(', ') + '.'
        : 'No results page was read on this run and you declared no competitor, so no competitor was used.')
      : (declared.length ? declared.length + ' competitor(s) you declared, then ' : '')
        + (read === 1 ? (picked.length > declared.length ? 'the businesses on Google\'s results page for "' + S(serps[0].keyword) + '"' : 'no other business on Google\'s results page for "' + S(serps[0].keyword) + '"')
          + ' (one results page only, so this is a thin read)'
          : picked.length > declared.length ? 'the businesses that rank for the most of your ' + read + ' keywords on the results pages this run read' : 'no other business ranked often enough on the ' + read + ' results pages read')
        + (minSerps > 1 ? '; a business must rank for at least ' + minSerps + ' of them' : '')
        + (exText ? '. Passed over: ' + exText : '') + '.';
    return { picked, excluded: excluded.slice(0, 20), too_few: too_few.slice(0, 10), serps_read: read, min_serps: minSerps, note };
  };
  return { kindOf, kindOfHost, kindOfResult, govSignal, select, weight, host, reg, LABEL };
})();
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
    serp_check_usd: 0.006       // one DataForSEO live-advanced SERP 30 deep with the AI Overview (measured $0.006, fa3_live), the one request shape every path sends since KW-SERP (2026-10-21); depth 10 was $0.002
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
      const alsoTxt = answered_by && answered_by.also ? '; ' + (S(answered_by.also.url).replace(/^https?:\/\/[^/]+/i, '') || '/') + ' matches the words of this search more closely: keep one page for it and link the other to it' : '';
      // a listing page (the blog index) is what Google shows; the position is ITS position, and the page about the search is named beside it
      const listPath = answered_by && answered_by.listing ? (S(answered_by.listing.url).replace(/^https?:\/\/[^/]+/i, '') || '/') : '';
      const rankTxt = listPath ? 'Google shows ' + listPath + ' (a listing page) at ' + posTxt + ' for it; the page about it is ' + pathTxt + ' (link it from ' + listPath + ')'
        : 'you rank ' + posTxt + ' with ' + pathTxt;
      const basisTxt = answered_by && answered_by.matched_by !== 'search console' && answered_by.matched_by !== 'search console page' && !answered_by.listing ? ' (matched by its words: Search Console names no page of yours for this search)' : '';
      const why = kinds.indexOf('no_page') >= 0 ? 'no page of yours answers this search'
        : kinds.indexOf('page_mismatch') >= 0 ? 'the page that gets the impressions is about something else: ' + (evidence.h1 ? 'its title and H1 share' : 'its title shares') + ' only '
          + evidence.have + ' of the ' + evidence.of + ' words of this search (missing: ' + evidence.missing.join(', ') + '); you rank ' + posTxt + ' with ' + pathTxt
          + (striking ? ' (striking distance)' : '') + (answered_by.also ? '; ' + (S(answered_by.also.url).replace(/^https?:\/\/[^/]+/i, '') || '/') + ' is the page about it by its words, so make that page the clear answer and link it from ' + pathTxt : '; aim that page at it or give the search its own')
        : striking ? rankTxt + ', striking distance: improve that page' + alsoTxt + basisTxt
        : lowPos ? (listPath ? 'low position: ' + rankTxt : 'low position on ' + pathTxt + ' (you rank ' + posTxt + ' with it)') + ': improve that page' + alsoTxt + basisTxt
        : 'a page of yours already answers this search (' + pathTxt + (position > 0 ? ', you rank ' + posTxt : '') + ')'
          + (answered_by && answered_by.listing ? '; Google currently shows ' + (S(answered_by.listing.url).replace(/^https?:\/\/[^/]+/i, '') || '/') + ' for it' : '') + alsoTxt + basisTxt;
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
    // SERP-GOTO (review M4): a result whose address Google hid (url_exact false) does not vote on the page type - its path is a guess
    const list = (Array.isArray(results) ? results : []).filter(r => r && S(r.url) && r.url_exact !== false).slice(0, 10);
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
// ---- the in-200 retry gate, for every provider that answers "failed" with HTTP 200 (R18 / R19, 2026-10-14, FIX_PLAN §3.12) ----
// n8n's `retryOnFail` only fires when a node FAILS. DataForSEO answers a dead task with HTTP 200 and `status_code` 40101
// ("Internal SE Server Error."), Google's URL Inspection answers HTTP 200 with an `error` object ("Internal error
// encountered."): both look like success to n8n, so the run spent the money, got nothing, and carried on.
//   Until 2026-10-14 the only gate of this kind was `AI_Retry_Requests.js` (the AI paths) and the 50000-only IF of build
// section 25, which is why execution 549 billed `SERP Top 10` and `Facts SERP` for two 40101 answers, never re-sent them, and
// planned, scored ("winnable 68") and wrote a page on a results page nobody had seen; and why the technical audit of execution
// 550 lost 31 of 45 URL inspections and reported the 14 that answered as an improvement.
//   This kit is that one rule. Two halves, and the second matters more:
//     1. `RT.dfs` / `RT.google` classify an answer; `RT.retryable` says whether sending it again can help (a transient error
//        can, a permission error or an exhausted quota cannot); `RT.plan` builds the second attempt and `RT.merge` puts its
//        answers in the failed ones' place.
//     2. `RT.stats` / `RT.evidence` / `RT.note` carry what was actually seen — asked, answered, failed, retried — into the
//        report, so evidence that is missing is marked `unavailable` and nothing downstream may score on it. `RT.comparable`
//        is the same idea for two runs: counts measured on samples of different sizes are not compared.
const RT = (() => {
  const S = (x) => String(x == null ? '' : x);
  const N = (x) => { const v = Number(x); return Number.isFinite(v) ? v : 0; };
  // an answer that can be different next time: the provider's own servers, a timeout, a rate limit. Never a wrong request.
  const TRANSIENT = /internal (?:se )?server error|internal error|server error|timeout|timed out|temporar|try again|unavailable|service unavailable|backend|deadline exceeded|connection|socket|econn|eai_again|rate limit|too many requests|\b(?:429|500|502|503|504)\b/i;
  const PERMANENT = /permission|forbidden|unauthor|invalid[_ ]grant|credential|not found|no search results|no access|invalid field|unknown field|unsupported|quota|resource_exhausted|insufficient funds|payment|balance/i;
  // R68 (2026-10-16, re-rating B-10): 40102 "No Search Results." is DataForSEO's FINAL answer that the search has no results — the Google
  // Business Profile lookup for "Tech& Dubai" in execs 595 / 641 — not a failure. It was neither TRANSIENT nor PERMANENT, so it counted as
  // retryable: *Fetch GBP (Retry)* re-sent it and paid $0.0054 for the same 40102 every audit. It is a valid empty answer now: never
  // re-sent, never counted as a failure (Entity_Check already reads it as "no listing"), and marked `empty` so a reader can tell.
  const NO_RESULTS = 40102;
  const errText = (e) => {
    if (!e) return '';
    if (typeof e === 'string') return e.slice(0, 200);
    const ctx = (e.context && e.context.data) || {};
    const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null;
    return S((inner && inner.message) || (ctx.error_description ? S(ctx.error || 'error') + ': ' + ctx.error_description : '') || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200);
  };
  const verdict = (why, code) => {
    const ok = !why;
    const perm = !ok && PERMANENT.test(why) && !TRANSIENT.test(why);
    return { ok, why: why || '', code: code || 0, retryable: !ok && !perm, permanent: perm };
  };
  // the reason a report prints is the provider's OWN message ("Internal SE Server Error.", "Invalid Field: target."), never our
  // paraphrase of it: it is what the owner would see in the provider's console, and it is what `retryable` is decided on.
  const said = (msg, code, dflt) => S(msg).trim() ? S(msg).trim().slice(0, 160) : (code ? dflt + ' (error ' + code + ')' : dflt);
  /** one DataForSEO answer (the whole envelope of a live endpoint). The same four cases AI_Retry_Requests.js has used since D19. */
  const dfs = (r) => {
    const res = r || {};
    if (res.error) return verdict(errText(res.error) || 'the request failed');
    if (N(res.status_code) === NO_RESULTS) return { ...verdict('', NO_RESULTS), empty: true, permanent: true, said: S(res.status_message) || 'No Search Results.' };
    if (N(res.status_code) >= 40000) return verdict(said(res.status_message, N(res.status_code), 'the search data provider reported an error'), N(res.status_code));
    if (!Array.isArray(res.tasks) || !res.tasks.length) return verdict('no answer from the search data provider');
    const t = res.tasks[0] || {};
    const code = N(t.status_code);
    if (!code) return verdict('no answer from the search data provider');
    if (code === NO_RESULTS || (code >= 40000 && /no search results/i.test(S(t.status_message))))
      return { ...verdict('', code), empty: true, permanent: true, said: S(t.status_message) || 'No Search Results.' };
    if (code >= 40000) return verdict(said(t.status_message, code, 'the search data provider reported an error'), code);
    if (code === 20000 && !((t.result || [])[0])) return verdict('the search data provider returned no result', code);
    return verdict('', code);
  };
  /** one Google API answer (URL Inspection, Search Analytics): an `error` object, or the field the caller expected missing. */
  const google = (r, expect) => {
    const res = r || {};
    if (res.error) return verdict(errText(res.error));
    const want = S(expect);
    if (want && !res[want]) return verdict('no ' + want + ' in the answer');
    return verdict('');
  };
  const check = (r, o) => { const opt = o || {}; return opt.api === 'google' ? google(r, opt.expect) : dfs(r); };
  /** [answers] -> [{ i, why, retryable }] for the ones that failed (same order as the requests). */
  const failures = (answers, o) => (answers || []).map((r, i) => ({ i, v: check(r, o) })).filter(x => !x.v.ok).map(x => ({ i: x.i, why: x.v.why, code: x.v.code, retryable: x.v.retryable, permanent: x.v.permanent }));
  /** the second attempt: the failed requests, once, newest rule first — never more than `max`, never a permanent failure. */
  const plan = (requests, answers, o) => {
    const opt = o || {};
    const max = opt.max == null ? 60 : opt.max;
    const fails = failures(answers, opt).filter(f => !opt.only || opt.only(requests[f.i], f));
    const retryable = fails.filter(f => f.retryable);
    const out = retryable.slice(0, max).map(f => ({ ...(requests[f.i] || {}), retry_of: f.i, retry_reason: f.why, is_retry: true }));
    return { items: out, failed: fails.length, retryable: retryable.length, skipped: Math.max(0, retryable.length - out.length),
      permanent: fails.filter(f => f.permanent).map(f => f.why).slice(0, 3), reasons: fails.map(f => f.why).slice(0, 5) };
  };
  /** the first answers with each retry's answer in the failed one's place (the retry's own failure keeps the first reason). */
  const merge = (answers, retryItems, retryAnswers, o) => {
    const out = (answers || []).slice();
    (retryItems || []).forEach((q, k) => {
      const i = Number(q && q.retry_of);
      const a = (retryAnswers || [])[k];
      if (!Number.isFinite(i) || a === undefined) return;
      if (check(a, o).ok) out[i] = a;
    });
    return out;
  };
  /** what was actually seen, in numbers a report can print. */
  const stats = (answers, o, retryItems, retryAnswers) => {
    const opt = o || {};
    const first = failures(answers, opt);
    const merged = merge(answers, retryItems, retryAnswers, opt);
    const after = failures(merged, opt);
    const asked = (answers || []).length;
    const retried = (retryItems || []).length;
    return { asked, answered: asked - after.length, failed: after.length, failed_first: first.length, retried,
      retry_answered: Math.max(0, first.length - after.length), reasons: [...new Set(after.map(f => f.why))].slice(0, 3), answers: merged };
  };
  /** the same, for a path that makes ONE call and has one retry node (the SERP / facts / keyword-data gates). */
  const one = (first, retry, o) => stats([first], o, retry == null ? [] : [{ retry_of: 0 }], retry == null ? [] : [retry]);
  /** F-SERP (2026-10-20): ONE call sent up to N times in a row (the head keyword's results page: first, retry, lighter last try).
   *  `attempts` is [first, second, third ...] in the order they were sent, `null` for an attempt that never ran. The answer is the
   *  first attempt that answered (later attempts only run when the earlier ones failed); when none did, the FIRST failure's reason is
   *  kept, as `one` keeps it. `attempts` / `answered_on` say how many were sent and which one answered (1-based, 0 = none). */
  const chain = (attempts, o) => {
    const made = (attempts || []).map((a, k) => ({ a, k })).filter(x => x.a != null);
    if (!made.length) return { asked: 1, answered: 0, failed: 1, failed_first: 1, retried: 0, retry_answered: 0, reasons: ['no answer'], answers: [{}], attempts: 0, answered_on: 0, reasons_by_attempt: [] };
    const verdicts = made.map(x => ({ k: x.k, a: x.a, v: check(x.a, o) }));
    const hit = verdicts.find(x => x.v.ok);
    const firstV = verdicts[0];
    return { asked: 1, answered: hit ? 1 : 0, failed: hit ? 0 : 1, failed_first: firstV.v.ok ? 0 : 1, retried: made.length - 1,
      retry_answered: hit && hit !== firstV ? 1 : 0, reasons: hit ? [] : [firstV.v.why || 'no answer'], answers: [hit ? hit.a : firstV.a],
      attempts: made.length, answered_on: hit ? hit.k + 1 : 0, reasons_by_attempt: verdicts.map(x => x.v.ok ? '' : x.v.why),
      retryable: hit ? false : verdicts[verdicts.length - 1].v.retryable };
  };
  /** one sentence about those numbers, in the words the reports already use. */
  const note = (s, what) => {
    const st = s || {}; const thing = S(what) || 'request';
    const plural = (n) => n === 1 ? thing : thing + 's';
    if (!st.asked) return '';
    if (!st.failed && !st.retried) return '';
    if (!st.failed) return st.failed_first + ' of ' + st.asked + ' ' + plural(st.asked) + ' failed and ' + (st.retry_answered === 1 ? 'the retry answered' : 'all ' + st.retry_answered + ' answered when they were sent again') + '.';
    const again = (st.attempts > 2 && st.asked === 1) ? 'sent ' + st.attempts + ' times' : 'sent again once';   // F-SERP: one call sent three times is not "sent again once"
    return st.failed + ' of ' + st.asked + ' ' + plural(st.asked) + ' could not be checked' + (st.retried ? ' (' + again + ', ' + st.retry_answered + ' answered)' : ' (no answer)')
      + (st.reasons.length ? ': ' + st.reasons.join('; ') : '') + '. Only the ' + st.answered + ' that answered are counted below.';
  };
  /** the evidence block a score may be refused on: `unavailable` means nobody saw it, twice. */
  const evidence = (what, s, extra) => {
    const st = s || {};
    const unavailable = !st.asked || st.answered === 0;
    return { what: S(what), asked: st.asked || 0, checked: st.answered || 0, failed: st.failed || 0, retried: st.retried || 0,
      retry_answered: st.retry_answered || 0, unavailable, partial: !unavailable && (st.failed || 0) > 0,
      error: (st.reasons || [])[0] || '', note: note(st, (extra && extra.unit) || 'request'), ...(extra || {}) };
  };
  /** two counts measured on samples of different sizes are not a change (R19): say the sample moved instead of printing a delta.
   *  `unit` names what the sample is made of ("pages" by default, "questions" for the AI panel, "sources" for a link snapshot). */
  const MAX_SAMPLE_DRIFT = 0.2;
  const comparable = (now, before, o) => {
    const opt = o || {};
    const tol = opt.tolerance == null ? MAX_SAMPLE_DRIFT : opt.tolerance;
    const unit = S(opt.unit);                     // named only where the caller said what the sample is made of
    const a = Number(now), b = Number(before);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return { comparable: false, why: 'how many ' + (unit || 'pages') + ' each number was measured on was not recorded', drift: null };
    const drift = Math.abs(a - b) / Math.max(a, b);
    if (drift > tol) return { comparable: false, drift: Math.round(drift * 100) / 100,
      why: 'the two counts were measured on different samples (' + b + (unit ? ' ' + unit : '') + ' then, ' + a + ' now), so they are not compared' };
    return { comparable: true, drift: Math.round(drift * 100) / 100, why: '' };
  };
  /** the other half of like for like (R20, B-L4 / B-L5, 2026-10-15): two figures produced by runs of a DIFFERENT KIND are not a
   *  change either. R20 was a health score chained across a technical audit and a full report; the same shape reaches the AI
   *  panel (a weekly check asks fewer engines than the monthly full one) and the link ledger (a free_only snapshot is built from
   *  a different set of sources than a paid one). `labels` turns the stored key into the words a customer reads. The guard is a
   *  CALL, never an inlined kit: lineage_lint.py looks for the prefixed call, which this file never writes, so a node cannot
   *  look guarded without using it. Keep it that way: build section 73 fails if this kit ever spells one of those calls out. */
  const likeForLike = (now, before, o) => {
    const opt = o || {}, lab = opt.labels || {};
    const a = S(now).trim().toLowerCase(), b = S(before).trim().toLowerCase();
    const what = S(opt.what) || 'these two figures';
    const name = (k) => S(lab[k]) || k;
    if (!a || !b) return { comparable: false, why: 'what kind of run produced ' + (b ? 'this figure' : 'the earlier figure') + ' was not recorded, so ' + what + ' are not compared', kind: a, kind_before: b };
    if (a !== b) return { comparable: false, kind: a, kind_before: b,
      why: 'the earlier figure came from ' + name(b) + ' and this one from ' + name(a) + ', which do not measure the same thing, so ' + what + ' are not compared' };
    return { comparable: true, why: '', kind: a, kind_before: b };
  };
  return { dfs, google, check, failures, plan, merge, stats, one, chain, note, evidence, comparable, likeForLike, errText, MAX_SAMPLE_DRIFT, TRANSIENT, PERMANENT, NO_RESULTS };
})();
// KW-SERP / RV-12 (2026-10-21): ONE Google results-page reading per search and per day, shared by every path that reads it.
//   On 2026-10-21 the research, the ladder and the rank tracker read three different results pages for "ai consultant" on the same day,
// and on 2026-10-17 two runs three minutes apart said "no AI Overview" and "an AI Overview was seen". A client must get one answer, and
// we must pay for it once. The identity of a reading is: the keyword (lower case, spaces collapsed), location_code, language_code, device
// and the UTC day. The row in seo_cache is keyed WITHOUT the day (`serp:<keyword>|<location>|<language>|<device>`) and the day is checked
// on the stored value, so the table holds one row per search (overwritten by the next day's read), not one row per search per day.
//   A path asks for a reading with what it needs: a depth (how many results) and whether the AI Overview's content must be loaded. A
// stored reading is used only when it is from today AND at least that deep AND (when asked) loaded the AI Overview; otherwise the path
// makes its request as before and its reading replaces the stored one. A failed read (HTTP error, a task error inside an HTTP 200, no
// result) is never stored. "No Search Results" (40102) is DataForSEO's final answer: read, and empty, so it is stored.
//   Concurrency: two runs that miss at the same moment both pay once and the later write wins. That is accepted: it costs one extra
// read in a rare race and both runs still read a real page. A cache hit costs nothing: the rebuilt answer carries cost 0 and a task id
// `cache:<id of the paid task>`, so the ledger's count-once-by-task-id rule still counts the money exactly once.
const SC = (() => {
  const CFG = { prefix: 'serp:', kind: 'serp', title_len: 120, desc_len: 160, aio_text_len: 800, max_chars: 20000, default_depth: 100 };
  const S = (x) => (x == null ? '' : String(x));
  const normKw = (k) => { let s = S(k); try { s = s.normalize('NFKC'); } catch (e) {} return s.toLowerCase().replace(/\s+/g, ' ').trim(); };
  const dayOf = (t) => { const d = t ? new Date(t) : new Date(); return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10); };
  // DataForSEO's datetime is "2026-10-21 14:05:12 +00:00"; Date() does not read that form everywhere, so it is rewritten to ISO first
  const isoOf = (t) => { const s = S(t).trim(); if (!s) return ''; const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?\s*([+-]\d{2}):?(\d{2})$/);
    const d = new Date(m ? m[1] + 'T' + m[2] + m[3] + ':' + m[4] : s); return isNaN(d.getTime()) ? '' : d.toISOString(); };
  const ident = (q) => ({ keyword: normKw((q || {}).keyword), location_code: Number((q || {}).location_code) || 0,
    language_code: S((q || {}).language_code || 'en').toLowerCase().trim() || 'en', device: S((q || {}).device || 'desktop').toLowerCase().trim() || 'desktop' });
  const key = (q) => { const i = ident(q); return CFG.prefix + [i.keyword, i.location_code, i.language_code, i.device].join('|'); };
  // what a request needs from a reading: its depth (DataForSEO's default is 100) and whether it asked for the AI Overview's content
  const need = (body) => ({ depth: Number((body || {}).depth) || CFG.default_depth, aio: (body || {}).load_async_ai_overview === true });
  const hhmm = (iso) => { const s = isoOf(iso); return s ? s.slice(11, 16) : ''; };
  const timing = (r) => (r && r.at ? 'read earlier today at ' + hhmm(r.at) + ' UTC' : 'read earlier today');
  const task0 = (res) => ((res && Array.isArray(res.tasks)) ? res.tasks[0] : null) || {};
  // the one test of "this answer is a reading": no HTTP error, 20000 at the top and on the task, a result array; 40102 is read and empty
  const status = (res) => {
    if (!res || typeof res !== 'object' || res.error) return 'failed';
    const t = task0(res);
    if (Number(t.status_code) === 40102 || Number(res.status_code) === 40102) return 'empty';
    if (Number(res.status_code) !== 20000 || Number(t.status_code) !== 20000 || !Array.isArray(t.result)) return 'failed';
    return 'ok';
  };
  const cut = (s, n) => S(s).slice(0, n);
  const ref = (r) => ({ domain: cut((r || {}).domain, 80), url: cut((r || {}).url, 240), title: cut((r || {}).title, CFG.title_len) });
  // SERP-GOTO (2026-11-08, v5/code/_serp_url.js, inlined above this kit): a result whose url was a Google redirect is stored with its
  // recovered host and the flags that say its url is approximate; a clean result is stored exactly as before (no new keys)
  const su = (o, x) => { if (x && x.url_exact === false) { o.url_exact = false; o.url_recovered = x.url_recovered || null; o.url_partial = !!x.url_partial; o.url_path = x.url_path || null; o.relative_url = x.relative_url || null; } return o; };
  // the compact form of one item: enough for every reader of this codebase (organic order and owners, page titles, PAA, related searches,
  // forum threads, the featured snippet, the AI Overview and its cited sources, which features were on the page), nothing else
  const compactItem = (x) => {
    const t = S(x && x.type); const o = { type: t, rank_group: Number(x.rank_group) || null, rank_absolute: Number(x.rank_absolute) || null };
    if (t === 'organic') { o.url = cut(x.url, 300); o.domain = cut(x.domain, 100); o.title = cut(x.title, CFG.title_len); o.description = cut(x.description, CFG.desc_len); return su(o, x); }
    if (t === 'people_also_ask') { o.items = (x.items || []).slice(0, 10).map(q => ({ title: cut(q && (q.title || q.question), 200) })).filter(q => q.title); return o; }
    if (t === 'related_searches') { o.items = (x.items || []).slice(0, 12).map(q => cut(typeof q === 'string' ? q : (q && (q.title || q.keyword)), 120)).filter(Boolean); return o; }
    if (t === 'discussions_and_forums') { o.items = (x.items || []).slice(0, 6).map(q => ({ title: cut(q && q.title, CFG.title_len), domain: cut(q && (q.domain || q.source), 80), url: cut(q && q.url, 240) })); return o; }
    if (t === 'featured_snippet') { o.domain = cut(x.domain, 100); o.url = cut(x.url, 300); o.title = cut(x.title, CFG.title_len); o.description = cut(x.description || x.text, 400); return su(o, x); }
    if (t === 'ai_overview') {
      o.asynchronous_ai_overview = x.asynchronous_ai_overview === true;
      o.references = (x.references || []).slice(0, 12).map(ref);
      let left = CFG.aio_text_len;
      o.items = (x.items || []).slice(0, 8).map(y => { const tx = cut(y && (y.text || y.markdown), Math.max(0, left)); left -= tx.length;
        return { title: cut(y && y.title, CFG.title_len), text: tx, references: ((y && y.references) || []).slice(0, 6).map(ref) }; });
      return o;
    }
    if (t === 'local_pack' || t === 'map') { o.domain = cut(x.domain, 100); o.url = cut(x.url, 300); o.title = cut(x.title, CFG.title_len); return su(o, x); }
    return o;
  };
  // a fresh answer -> the reading to store (null when it is not a reading: a failed read is never stored)
  const reading = (res, body, opts) => {
    const st = status(res); if (st === 'failed') return null;
    const o = opts || {}; const t = task0(res); const r0 = ((t.result || [])[0]) || {};
    const b = body || (t.data || {}); const id = ident({ ...(t.data || {}), ...b }); const nd = need(b);
    const at = isoOf(r0.datetime) || isoOf(o.now) || new Date().toISOString();
    const items = Array.isArray(r0.items) ? SU.fixItems(r0.items) : [];   // SERP-GOTO: the real host behind a Google redirect, before anything is stored
    const out = { v: 1, ...id, day: dayOf(at), at, datetime: S(r0.datetime) || at, task_id: S(t.id), cost: Number(t.cost) || 0, depth: nd.depth, aio_loaded: nd.aio,
      empty: st === 'empty', se_results_count: r0.se_results_count ?? null, item_types: Array.isArray(r0.item_types) ? r0.item_types.map(S) : [...new Set(items.map(x => S(x && x.type)))].filter(Boolean),
      ai_overview_seen: items.some(x => x && x.type === 'ai_overview'), path: S(o.path),
      items: items.filter(Boolean).map(x => compactItem(x)) };
    // keep the stored value compact: drop the descriptions, then the titles below the top 10, then the tail, until it fits
    let s = JSON.stringify(out);
    const below10 = (x) => x.type === 'organic' && Number(x.rank_group) > 10;
    if (s.length > CFG.max_chars) { out.items.forEach(x => { if (below10(x)) delete x.description; }); s = JSON.stringify(out); }
    if (s.length > CFG.max_chars) { out.items.forEach(x => { if (below10(x)) delete x.title; }); s = JSON.stringify(out); }
    while (s.length > CFG.max_chars && out.items.length > 10) { out.items.pop(); out.depth = Math.min(out.depth, out.items.filter(x => x.type === 'organic').length); s = JSON.stringify(out); }
    return out;
  };
  // the descriptions, then the titles below the top 10 go first when the value is too long, then the tail (the depth then says so)
  // a stored reading -> an answer in DataForSEO's own shape, so every existing reader works unchanged; it cost nothing
  const response = (r) => ({ status_code: 20000, status_message: 'Ok.', cost: 0, tasks_count: 1, tasks_error: 0,
    serp_cache: { hit: true, key: key(r), read_at: r.at, day: r.day, task_id: r.task_id, depth: r.depth, aio_loaded: !!r.aio_loaded, text: timing(r) },
    tasks: [{ id: 'cache:' + S(r.task_id), status_code: r.empty ? 40102 : 20000, status_message: r.empty ? 'No Search Results.' : 'Ok.', cost: 0,
      data: { keyword: r.keyword, location_code: r.location_code, language_code: r.language_code, device: r.device, depth: r.depth, load_async_ai_overview: !!r.aio_loaded },
      result: r.empty ? null : [{ keyword: r.keyword, location_code: r.location_code, language_code: r.language_code, datetime: r.datetime || r.at,
        se_results_count: r.se_results_count, item_types: r.item_types || [], items_count: (r.items || []).length, items: (r.items || []).map(x => ({ ...x })) }] }] });
  const parse = (row) => { if (!row || typeof row !== 'object') return null; let v = row.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return null; } } return v && typeof v === 'object' ? v : null; };
  // the stored reading this request may use, or why not. `rows` are seo_cache rows (any keys; the right one is found by its key)
  const lookup = (rows, body, opts) => {
    const o = opts || {}; const k = key(body); const nd = need(body); const today = dayOf(o.now);
    const row = (Array.isArray(rows) ? rows : []).find(x => x && x.key === k);
    if (!row) return { hit: false, key: k, why: 'not read yet today' };
    const r = parse(row);
    if (!r) return { hit: false, key: k, why: 'stored reading unreadable' };
    if (r.day !== today) return { hit: false, key: k, why: 'last read on ' + (r.day || 'an unknown day') };
    if (SU.poisoned(r)) return { hit: false, key: k, why: 'stored reading holds Google redirect links with no site behind them (read before the 2026-11-08 fix)' };
    if (key(r) !== k) return { hit: false, key: k, why: 'stored reading is for another search' };
    if (!r.empty && Number(r.depth) < nd.depth) return { hit: false, key: k, why: 'read today only ' + r.depth + ' results deep, this needs ' + nd.depth };
    if (nd.aio && !r.aio_loaded) return { hit: false, key: k, why: 'read today without the AI Overview content, which this needs' };
    return { hit: true, key: k, reading: r, response: response(r), text: timing(r) };
  };
  // the seo_cache row (exact columns of CACHE_COLS) for a reading, or null
  const row = (r, siteId) => (r ? { key: key(r), kind: CFG.kind, site_id: S(siteId), value: JSON.stringify(r), updated_at: new Date().toISOString() } : null);
  // a fresh answer straight to its row (null when it was a cache hit or a failed read)
  const rowFor = (res, body, siteId, opts) => { if (res && res.serp_cache && res.serp_cache.hit) return null; return row(reading(res, body, opts), siteId); };
  return { CFG, key, ident, need, status, reading, response, lookup, row, rowFor, timing, dayOf, normKw };
})();
// ---- SERP-GOTO (2026-11-08, R5 L-1): the real site behind a Google results-page redirect (SU) ----
// Since about 2026-11-05 DataForSEO's LIVE Google organic SERP answers every organic and local-pack item with `domain: "google.com"`,
// `url: "https://google.com/goto?url=CAES..."` (an opaque token nobody can decode), `main_domain` / `relative_url` null and `links[].url`
// wrapped the same way. Google started serving /goto links in August; on 2026-11-02 DataForSEO wrote that Google now throttles how many
// of them can be resolved per results page, so "High priority and Live requests resolve about half" (live probes of 2026-11-08 resolved
// none of 50). Standard-priority tasks (task_post + task_get, about 80 s) still come back with every real URL.
//   Read as it comes, every reader took google.com for the site: the Rank Tracker never found the client (13 of 14 rows of 2026-11-05
// held goto URLs), competitors became google.com, and no two keywords ever shared a result (each token is unique).
//   What survives is `breadcrumb` ("https://www.sage.com › en-ae › erp") and sometimes `website_name` (a host, a brand, or
// "Facebook · <page name>"). The rule, applied as early as possible (every DataForSEO answer node, the SERP cache, the rank kit):
//   * an item is a REDIRECT when its url is a Google redirect (google.<tld>/goto, /url, /search/url, /aclk; or Bing /ck/a) - a normal
//     google.com result (support.google.com/..., about.google/...) is NOT one and passes untouched;
//   * its host comes from the breadcrumb (the text before the first " › "), else from website_name when that is a host, else from a
//     known social network named before " · " ("Facebook · X" -> facebook.com); otherwise the item stays UNRESOLVED: domain null,
//     url null, never google.com;
//   * a recovered url is `https://<host>/<breadcrumb segments joined by "/">` - APPROXIMATE: Google's breadcrumb segments are often the
//     path ("› en-ae › erp") but sometimes page labels ("› Home › Blog"), and a long one is cut ("› best-erp-sof..."). Only a complete
//     breadcrumb of slug segments is a path (`url_path: 'path'`); a cut one, labels or the host alone say `url_partial: true` and the url
//     is then the host's home page (review 2026-11-08, M2);
//   * every rewritten item carries `url_exact: false`, `url_recovered` ('breadcrumb' | 'website_name' | 'social' | null) and the original
//     redirect in `redirect_url`; an item that was not a redirect is returned as the SAME object (old fixtures stay byte-identical).
// What a reader may do with an approximate url (the rule every reader follows):
//   * the SITE (host) is reliable: own-site rank detection matches by host, competitors are counted by host;
//   * the PAGE is not: own-page identification says "page not identified" (url ''), never a guessed page; a cited source needs an exact
//     url; clustering compares `SU.key()` - host + the complete slug path - which is the same for the same result on two pages read
//     the same way, marked `~` so it never equals an exact url key; a partial result has NO key (review H1: two posts of one blog must
//     not look like one page);
//   * own-site rank: -1 only when a result with no site could be ours (`couldBe`: our domain label in its name / title / breadcrumb).
// Regex only: the n8n Code sandbox has no URL constructor. `var` + the guard lets two kits that both inline SU share one copy.
var SU = (typeof SU === 'object' && SU && SU.v === 1) ? SU : (() => {
  const S = (x) => (x == null ? '' : String(x));
  const REDIR = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:google\.[a-z]{2,3}(?:\.[a-z]{2})?\/(?:goto|url|search\/url|aclk)(?=[?\/#]|$)|bing\.com\/ck\/a(?=[?\/#]|$))/i;
  const isRedirect = (u) => REDIR.test(S(u).trim());
  // R-H2 (review 2026-11-08): a host may be Unicode (Google shows IDNs as "müller.de") or punycode, its TLD too ("xn--mgbaam7a8h", the UAE)
  const HOST = /^(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:\p{L}{2,24}|xn--[a-z0-9-]{1,59})$/iu;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);   // R-L1: "constructor" is not a social network
  const SOCIAL = { facebook: 'facebook.com', linkedin: 'linkedin.com', youtube: 'youtube.com', instagram: 'instagram.com', x: 'x.com',
    twitter: 'x.com', reddit: 'reddit.com', quora: 'quora.com', tiktok: 'tiktok.com', medium: 'medium.com', pinterest: 'pinterest.com' };
  const bare = (h) => S(h).toLowerCase().replace(/^www\./, '');
  // R-H2: the scheme is optional ("en.wikipedia.org › wiki › ERP"); a first word with no dot ("3 reactions · 1 month ago") is not a host
  const crumbHost = (b) => { const m = S(b).trim().match(/^(?:https?:\/\/)?([^\/\s›]+)/i); const h = m && !/@/.test(m[1]) ? m[1].toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '') : ''; return HOST.test(h) ? h : ''; };
  // the breadcrumb's path segments, up to (not including) the first cut one; `cut` says whether one was cut
  // R-M2: a segment is a PATH segment only when it looks like a slug (lower case, no spaces); "› Home › Blog" are page labels, not a path
  const SLUG = /^[a-z0-9%._~-]+$/;
  const crumbPath = (b) => {
    const parts = S(b).split(/\s*›\s*/).slice(1).map(x => x.trim()).filter(Boolean); const segs = []; let cut = false, labels = false;
    for (const p of parts) { if (/^(?:\.\.\.|…)$/.test(p) || /(?:\.\.\.|…)$/.test(p)) { cut = true; break; } if (!SLUG.test(p)) labels = true; segs.push(p.replace(/\s+/g, '-').replace(/[?#]/g, '')); }
    return { segs, cut, labels };
  };
  // a redirect that CARRIES its target (google.com/url?q=https://..., ?url=https%3A...) is read as that target, exactly (FU-SV kept this
  // rule for the facts search); the /goto token is opaque, so this finds nothing there
  // R-L2: one host rule for a carried target; userinfo ("https://u:p@host") or no host at all is not a target, and nothing here can throw
  const hostOfUrl = (u) => { const m = S(u).match(/^https?:\/\/([^\/?#\s]+)/i); if (!m || /@/.test(m[1])) return ''; const h = m[1].toLowerCase().replace(/:\d+$/, ''); return HOST.test(h) ? h : ''; };
  const dec = (v) => { let x = S(v); for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(x); i++) { try { x = decodeURIComponent(x); } catch (e) { break; } } return x; };
  const carried = (u) => { const s = S(u).trim(); const q = s.indexOf('?'); if (q < 0) return '';
    for (const n of ['url', 'q', 'u']) for (const p of s.slice(q + 1).replace(/#.*$/, '').split('&')) { const e = p.indexOf('=');
      if (e > 0 && p.slice(0, e).toLowerCase() === n) { const t = dec(p.slice(e + 1)).trim(); if (/^https?:\/\/[^\s\/?#]+\.[^\s<>"]*$/i.test(t) && !isRedirect(t) && hostOfUrl(t)) return t; } }
    return ''; };
  const nameHost = (n) => { const s = S(n).trim().toLowerCase(); if (HOST.test(s)) return s;
    const brand = s.split(/\s*·\s*/)[0].trim(); return has(SOCIAL, brand) ? SOCIAL[brand] : ''; };
  // one item -> the same object when it is not a redirect, else a copy with the real host (or none)
  const fixItem = (it) => {
    if (!it || typeof it !== 'object' || !isRedirect(it.url)) return fixLinks(it);
    const tgt = carried(it.url); const th = tgt ? hostOfUrl(tgt) : '';
    if (tgt && th) { const h = th;
      return fixLinks({ ...it, domain: h, url: tgt, main_domain: bare(h), relative_url: (tgt.match(/^https?:\/\/[^\/?#]+(\/[^?#]*)?/i) || [])[1] || '/', url_recovered: 'redirect', redirect_url: S(it.url) }, true); }   // exact: no url_exact flag
    const ch = crumbHost(it.breadcrumb); const nh = ch ? '' : nameHost(it.website_name);
    const host = ch || nh;
    const how = ch ? 'breadcrumb' : (nh ? (HOST.test(S(it.website_name).trim()) ? 'website_name' : 'social') : null);
    // url_path: 'path' (slug segments, complete), 'labels' (page labels, not a path), 'cut' (Google cut it), 'none' (the host only)
    // url_partial: the PAGE is not known from the breadcrumb (anything but 'path'); its url is then the host's home page
    let url = null, rel = null, partial = true, pathKind = 'none';
    if (host) {
      const p = ch ? crumbPath(it.breadcrumb) : { segs: [], cut: false, labels: false };
      pathKind = p.cut ? 'cut' : p.labels ? 'labels' : p.segs.length ? 'path' : 'none';
      partial = pathKind !== 'path'; const segs = partial ? [] : p.segs;
      rel = '/' + segs.join('/'); url = 'https://' + host + (segs.length ? rel : '/');
    }
    const out = { ...it, domain: host || null, url, main_domain: host ? bare(host) : null, relative_url: rel, url_exact: false,
      url_recovered: how, url_partial: partial, url_path: host ? pathKind : null, redirect_url: S(it.url) };
    return fixLinks(out, true);
  };
  // links / nested items (AI Overview elements, sitelinks): a redirect url there is dropped (null), never kept as google.com
  const fixLinks = (it, copied) => {
    if (!it || typeof it !== 'object') return it;
    let o = it;
    for (const f of ['links', 'items', 'references']) {
      const arr = it[f]; if (!Array.isArray(arr)) continue;
      let changed = false;
      const next = arr.map(x => { if (!x || typeof x !== 'object') return x;
        if (f === 'items' && x.type && (x.type === 'organic' || x.breadcrumb != null)) { const y = fixItem(x); if (y !== x) changed = true; return y; }
        if (isRedirect(x.url)) { changed = true; return { ...x, url: null, domain: (x.domain && !/^(?:www\.)?google\./i.test(S(x.domain))) ? x.domain : null, url_exact: false, redirect_url: S(x.url) }; }
        const y = fixLinks(x); if (y !== x) changed = true; return y; });
      if (changed) { if (o === it && !copied) o = { ...it }; o[f] = next; }   // `copied`: `it` is already this kit's own copy
    }
    return o;
  };
  // a whole DataForSEO answer -> the same object when nothing was a redirect, else a copy (result[].items rewritten, counts on the result)
  const fixAnswer = (res) => {
    if (!res || typeof res !== 'object' || !Array.isArray(res.tasks)) return res;
    let changedAny = false;
    const tasks = res.tasks.map(t => {
      if (!t || !Array.isArray(t.result)) return t;
      let ch = false;
      const result = t.result.map(r => {
        if (!r || !Array.isArray(r.items)) return r;
        let n = 0, rec = 0, unres = 0;
        const items = r.items.map(x => { const y = fixItem(x); if (y !== x) { if (y && y.redirect_url && y.type) { n++; if (y.domain) rec++; else unres++; } } return y; });
        if (!items.some((y, i) => y !== r.items[i])) return r;
        ch = true; return { ...r, items, serp_url: { redirects: n, recovered: rec, unresolved: unres, rule: 'SU (v5/code/_serp_url.js): host from the breadcrumb, url approximate' } };
      });
      if (!ch) return t; changedAny = true; return { ...t, result };
    });
    return changedAny ? { ...res, tasks } : res;
  };
  const fixItems = (items) => (Array.isArray(items) ? items.map(fixItem) : items);
  const exact = (it) => !!it && it.url_exact !== false;
  const unresolved = (it) => !!it && it.url_exact === false && !it.domain;
  // a stored compact reading written before this fix: an item still holding a redirect url with no recovery on it
  const poisoned = (v) => !!v && Array.isArray(v.items) && v.items.some(x => x && (x.type === 'organic' || x.type === 'local_pack') && isRedirect(x.url) && x.url_exact !== false);
  // the clustering key of one result: an exact url as it is (no scheme, no www, no query, no trailing slash); an approximate one as
  // "~host/segments" in lower case (the same result read on two pages gives the same key; it is never equal to an exact key)
  const urlKey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  // R-H1 (review 2026-11-08): only a COMPLETE slug path is a key. A cut, label or host-only breadcrumb has NO key ('') - two different
  // posts of one blog would otherwise share "~host/…" and merge two searches that share no page; with no key such a result neither
  // matches nor counts towards the minimum a results page needs to be compared (Ladder Clusters: "too few to compare")
  const key = (it) => { if (!it) return ''; if (exact(it)) return urlKey(it.url || it.domain);
    if (!it.domain || it.url_partial || !it.relative_url || it.relative_url === '/') return ''; return '~' + urlKey(S(it.domain) + it.relative_url); };
  // R-H2: could this unresolved result be the site's own? Its visible name, title or breadcrumb carries the site's own label
  // ("techand" for techand.ai, "gear up" for gear-up.ae), in any case and spacing
  const flat = (v) => S(v).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const labelOf = (d) => flat(bare(S(d)).replace(/^https?:\/\//, '').split('/')[0].split('.')[0]);
  const couldBe = (it, domain) => { const l = labelOf(domain); if (!it || l.length < 4) return false;
    return [it.website_name, it.title, it.breadcrumb].some(v => flat(v).includes(l)); };
  // ---- SERP-GOTO (re-review N1): unread readings of seo_rank_history, shared by the Rank Tracker and the Site Tracker ----
  // UNREAD = position -1 because a result Google hid may be ours (snapshot `mo`), or settled after that (`st`). A -1 without `mo` is a
  // failed read, which is not an unread reading and ends a streak. A row stored with bare redirects (before this fix) is no reading.
  const snapOf = (v) => { if (v && typeof v === 'object') return v; try { const o = JSON.parse(S(v) || 'null'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  const poisonedRow = (h) => !!h && ((Array.isArray(snapOf(h.snapshot_json).top) && snapOf(h.snapshot_json).top.some(e => e && isRedirect(e.u))) || isRedirect(h.url));
  const unreadRow = (h) => { if (!h || Number(h.position) !== -1) return false; const x = snapOf(h.snapshot_json); return Number(x.mo) > 0 || Number(x.st) > 0; };
  const weekOf = (t) => { const d = new Date(S(t)); if (isNaN(d.getTime())) return ''; return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))).toISOString().slice(0, 10); };
  // how many earlier CALENDAR WEEKS (Monday-based, UTC) in a row ended unread, newest first: a catch-up or an app re-check in the same
  // week is one week, and this run's own week does not count. rows: one keyword's desktop rows of one tracker (any order)
  const unreadWeeks = (rows, o) => { const now = weekOf((o || {}).now || new Date().toISOString()); const weeks = new Set();
    for (const h of (rows || []).filter(r => r && !poisonedRow(r) && S(r.checked_at)).sort((a, b) => S(b.checked_at).localeCompare(S(a.checked_at)))) {
      if (!unreadRow(h)) break; const w = weekOf(h.checked_at); if (w && w !== now) weeks.add(w); }
    return weeks.size; };
  // the words a report uses for an unread reading (null for any other)
  const unreadNote = (snap) => { const x = snapOf(snap); return Number(x.st) > 0 ? 'not found among the results we could read' : Number(x.mo) > 0 ? 'could not be told: a result Google hid may be yours' : null; };
  return { v: 1, REDIR, HOST, unreadRow, weekOf, unreadWeeks, unreadNote, poisonedRowSU: poisonedRow, isRedirect, carried, hostOfUrl, couldBe, labelOf, fixItem, fixItems, fixAnswer, exact, unresolved, poisoned, key, urlKey, crumbHost, crumbPath, nameHost };
})();
// ---- KI (keyword intelligence, 2026-11-08, docs/keyword-intel-2026-11-08/CONTRACTS.md section 6, R4_MARKET.md section 6): ONE kit for ----
// competitor analysis and buyer keyword research. Pure and deterministic: no clock (pass cfg.now), no network, no random, no table access.
// Inlined by the KI worker (build_ki.py) AFTER the kits it calls, which must be inlined first in the same node:
//   _fit_gate.js (fitGate, fitMarket, fitEvidence; required for KI.gate / KI.fit), _competitors.js (CMP; required for KI.classifyDomain /
//   KI.pageType), _site_model.js (SM; optional, KI.pageAction uses SM.matchPage when a site model is given), _kw_inputs.js (KWI; optional,
//   KI.pageType uses KWI.shapeOf for the guide / pricing / service shapes when present).
// Nothing here changes what those kits answer for their existing callers: KI only CALLS them and maps their answers to the KI vocabulary.
//
// The method (R4 6.1-6.7, DESIGN.md sections 2-4), every weight / threshold / cap / TTL in KI.CONFIG (overridable by a run's config_json):
//   Score  = 100 x Gate x Fit x StageW x (0.40 Demand + 0.35 Win + 0.15 Value + 0.10 Gap); every factor 0..1; monotone in every factor
//   Win    = 0.35 Strength + 0.25 ExistingRank + 0.20 Topical + 0.20 WeakSpots; verdict Go >= 0.60, Takes a few months >= 0.35, else Hard
//   Comp   = 0.45 SERPshare + 0.20 TopicSim + 0.15 GeoMatch + 0.20 AIshare, only for direct / adjacent; size is a TAG, never a score input
//   Cluster: head-based, sorted by click demand, a keyword joins the FIRST head it shares >= T_page (3) of the top 10 with; hub at T_hub (2);
//            no chaining (members never recruit); ties by key. Identical top 10s are never split, zero overlap is never merged.
//   Stage  : strong words first (what is / vs / best / pricing / near me), then the page types of the top 10 (position weighted), then weak
//            words, then the provider's intent label, else "info" with needs_review. Weights hire 1.00 compare 0.90 solution 0.65 problem
//            0.50 info 0.30.
// Live SERP items may carry recovered hosts (the SERP-goto hotfix, kit SU: url_exact false, url_recovered, url_partial): an item with no
// domain is skipped and never counted; an approximate url is compared by host + path tokens; a partial url counts for its host only (own
// site and competitors), never for clustering; a Google redirect still carrying google.com is treated as "host unknown".
// Text read from other sites (titles, snippets, page text, AI answers) is untrusted data: it can only move a class or a share, never pick
// an action by itself, and nothing is ever executed or followed from it.
var KI = (typeof KI === 'object' && KI && KI.VERSION === 'ki-1') ? KI : (() => {
  const VERSION = 'ki-1';
  const S = (v) => (v == null ? '' : String(v));
  const num = (v) => { if (v === '' || v == null || typeof v === 'boolean') return null; const x = Number(v); return Number.isFinite(x) ? x : null; };
  const clip = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const r2 = (x) => Math.round(x * 100) / 100;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const r1 = (x) => Math.round(x * 10) / 10;
  const uniq = (a) => { const seen = new Set(); const out = []; for (const x of a) if (!seen.has(x)) { seen.add(x); out.push(x); } return out; };
  const jparse = (v, d) => { if (v && typeof v === 'object') return v; try { const o = JSON.parse(S(v) || 'null'); return o == null ? d : o; } catch (e) { return d; } };
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  // FNV-1a 32 bit, base 36: deterministic ids (cluster, gap, action) from text
  const hash = (s) => { let h = 0x811c9dc5; const t = S(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
  // plain ASCII for every sentence a client reads (no em dashes, no curly quotes, no ellipsis character)
  const ascii = (s) => S(s).replace(/[\u2018\u2019\u201a\u2032]/g, "'").replace(/[\u201c\u201d\u201e\u2033]/g, '"').replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...').replace(/\u203a/g, '>').replace(/\u00a0/g, ' ').normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();

  // ---------------------------------------------------------------------------------------------------------------------------------
  // CONFIG: every number of the method. A run's config_json may override any of it (KI.cfg merges deeply, arrays replace).
  // ---------------------------------------------------------------------------------------------------------------------------------
  const CONFIG = {
    rule_version: VERSION,
    // opportunity score (R4 6.4)
    score_weights: { demand: 0.40, win: 0.35, value: 0.15, gap: 0.10 },
    win_weights: { strength: 0.35, existing_rank: 0.25, topical: 0.20, weak_spots: 0.20 },
    verdict: { go: 0.60, months: 0.35 },
    low_confidence_range: 25,          // points between the low and the high score
    win_spread: 0.15,                  // the modelled Win is printed +/- this
    fit_gate: 0.35,                    // Fit below this gates the keyword (reason low_fit)
    fit_unknown: 0.5,                  // nothing on file to judge topic distance: modelled middle, flagged
    fit_no_place: 0.9,                 // a keyword that names no place, for a site measured in one market
    fit_title_weight: 0.25,            // share of Fit read from the results' titles when they are in hand
    fit_spread: 0.1,                   // an inferred Fit is printed +/- this
    labs_unsure: 0.65,                 // a provider intent probability under this is "unsure" (R5 13.1 #7, Arabic labels)
    // demand (R4 6.4): clicks a page at p_star would get, after the AI answer's click loss; GSC impressions beat provider volume
    demand: { p_star: 5, d_ref: 300, floor: 0.15, floor_low: 0.10, floor_high: 0.25, min_sources_for_floor: 2, gsc_days: 28, month_days: 30,
      ctr_spread: 0.30, volume_spread: 0.20, gsc_max_position: 20, floor_volume: 5, floor_volume_high: 20, censored_high: 3 },
    // click-through by position (modelled curve; positions 11-20 and 21-30 flat)
    ctr: [0.28, 0.155, 0.10, 0.07, 0.053, 0.042, 0.034, 0.028, 0.024, 0.021],
    ctr_p11_20: 0.010, ctr_p21_30: 0.004,
    // win inputs
    existing_rank: [{ max: 10, v: 1.0 }, { max: 20, v: 0.8 }, { max: 50, v: 0.5 }],
    strength_span: 10,                 // 10x the median strength of the top 10 = 1.0, a tenth = 0.0, equal = 0.5
    strength_unknown: 0.5, strength_unknown_spread: 0.5,   // FX-L N4: an unknown Strength spans 0..1, so a guess never prints Hard
    topical_ref: 5,                    // this many of the site's own ranking queries on the topic = Topical 1.0
    topical_max_position: 50,
    weak: { stale_days: 730, thin_words: 300, low_rank: 100, low_refdomains: 10 },
    // value (R4 6.4)
    value: { cpc_ref: 15, missing: 0.5, missing_spread: 0.25 },
    // gap (R4 6.4)
    gap_ai_bonus: 0.5,
    // stage weights (R4 6.4 StageW); the app mirror is KI_STAGE_WEIGHT (parity fixture)
    stage_weights: { hire: 1.0, compare: 0.9, solution: 0.650, problem: 0.5, info: 0.3 },
    // stage rule (R4 6.5): page-type shares of the top 10 that decide
    stage_rule: { min_read: 4, provider_share: 0.40, list_share: 0.30, info_share: 0.50, ads_commercial: 3, review_below: 0.6 },
    // clustering (R4 6.3)
    cluster: { t_page: 3, t_hub: 2, top_n: 10, min_urls: 3 },
    // competitor score (R4 6.1)
    comp_weights: { serp_share: 0.45, topic_sim: 0.20, geo_match: 0.15, ai_share: 0.20 },
    comp_spread: 0.15,                 // an inferred TopicSim / GeoMatch is printed +/- this
    comp_min_seeds: 2,                 // with 3+ seeds read, a scored competitor must be seen on at least this many
    comp_max_rows: 20, comp_max_chosen: 5, comp_leave_after_misses: 2,
    class_review_below: 0.6,           // class confidence under this = needs your review
    direct_topic: 0.5,                 // TopicSim from which a business is a direct competitor (no contrary market evidence)
    size: { out_kw: 20, out_rd: 10, leader: 3, smaller: 1 / 3 },
    // candidate pipeline (DESIGN 3.2)
    caps: { enrich: 300, serp: 60, seeds: 20, plan: 10, questions: 30, striking: 30, clusters_out: 50, evidence: 20 },
    // striking distance (DESIGN 3.11): one definition everywhere
    // FX-L round 2: the impressions bar is relative to the site (one query must hold 1 / site_divisor of the site's 28-day impressions),
    // never under `floor` (fewer is noise) nor over `impressions` (the published 100). techand (8,013) -> 27, devaicon (66) -> 20, 30,000+ -> 100
    striking: { min: 8, max: 20, impressions: 100, floor: 20, site_divisor: 300 },
    // page action (DESIGN 3.9 / 3.10)
    page_action: { list_share: 0.50 },
    // gaps (R4 6.2)
    gaps: { missing_min: 2, top: 10, absent_over: 100, weak_min: 11, weak_max: 100, strong_max: 7 },
    // plan (DESIGN 3.13): expected value multipliers per action and verdict; FX-L: unknown (not judged yet) weighs above Hard, below Takes a few months
    plan: { kind_mult: { refresh: 1.15, new_page: 1.0, list: 0.9, pitch: 0.7, link: 0.5, defend: 0.6 },
      verdict_mult: { go: 1.0, months: 0.75, hard: 0.4, unknown: 0.5 }, gap_ev: { listing: 30, ai_answer: 25, backlink: 15, page_type: 28, topic: 32 } },
    // credits of a started action: usd x markup / credit value (the app's rate, cost.ts content = 1.90)
    credits: { markup: 3, credit_value_usd: 0.05, usd: { new_page: 1.90, refresh: 1.90, list: 0, pitch: 0, link: 0, defend: 0 } },
    // cache TTLs, days (DESIGN 7)
    ttl_days: { serp: 1, ranked_keywords: 7, volume: 30, backlinks: 7, homepage: 14, competitors: 30 },
    // the AI answer's share of clicks lost, per stage (modelled, R4 6.4: informational 0.55, comparison 0.40, selection 0.15)
    aio_loss: { info: 0.55, problem: 0.55, solution: 0.40, compare: 0.40, hire: 0.15, local_pack: 0.10 }
  };
  const merge = (a, b) => { if (!isObj(b)) return a; const out = { ...a }; for (const [k, v] of Object.entries(b)) out[k] = isObj(v) && isObj(a[k]) ? merge(a[k], v) : v; return out; };
  /** the config a run uses: KI.CONFIG with its config_json (object or JSON string) merged in */
  const cfg = (over) => merge(CONFIG, jparse(over, {}));
  const C = (c) => (c && c.rule_version ? c : cfg(c));

  // ---------------------------------------------------------------------------------------------------------------------------------
  // words
  // ---------------------------------------------------------------------------------------------------------------------------------
  /** the keyword as shown and stored: NFKC, lower case, punctuation to spaces, one space */
  const norm = (kw) => { let s = S(kw); try { s = s.normalize('NFKC'); } catch (e) {}
    return s.toLowerCase().replace(/[\u2018\u2019'`]/g, '').replace(/&/g, ' and ').replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim(); };
  const KEY_STOP = new Set(['a', 'an', 'the', 'in', 'of', 'for', 'to', 'at', 'on', 'and', 'with', 'by', 'near', 'from']);
  const stem1 = (t) => (t.length > 3 && /s$/.test(t) && !/(ss|us|is)$/.test(t)) ? t.replace(/ies$/, 'y').replace(/s$/, '') : t;
  /** close variants share one key: stop words out, plurals folded, single letters joined to the next word (e invoicing = einvoicing),
   *  word order ignored ("uae erp software" = "erp software uae"). Deterministic, never empty for a non-empty keyword. */
  // FX-L L1: stop words go BEFORE single letters are joined ("what is a crm company" = "what is crm company", never "acrm"), and a migration
  // pair keeps its direction ("sap to dynamics 365 migration" is not "dynamics 365 to sap migration")
  const MIGRATE = /\b(?:migrat\w*|upgrad\w*|mov(?:e|ing)|switch\w*|convert\w*|transition\w*)\b/;
  const key = (kw) => { const n = norm(kw); const all = n.split(' ').filter(Boolean); const dir = /\b(?:to|from)\b/.test(n) && MIGRATE.test(n);
    const toks = all.filter(t => !KEY_STOP.has(t) || (dir && (t === 'to' || t === 'from'))); const base = toks.length ? toks : all; const j = [];
    for (let i = 0; i < base.length; i++) { if (base[i].length === 1 && /\p{L}/u.test(base[i]) && i + 1 < base.length) { base[i + 1] = base[i] + base[i + 1]; continue; } j.push(base[i]); }
    const use = j.map(stem1);
    return dir ? use.join(' ') : uniq(use).sort().join(' '); };
  const GEO = (typeof FIT_GEO !== 'undefined' && FIT_GEO instanceof Set) ? FIT_GEO : new Set(['uae', 'dubai', 'abu', 'dhabi', 'sharjah', 'ajman', 'gcc', 'ksa', 'saudi', 'qatar', 'oman', 'bahrain', 'kuwait', 'pakistan', 'india', 'uk', 'usa', 'us']);
  const TOK_STOP = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'my', 'your', 'our', 'is', 'are', 'what', 'how', 'me', 'near', 'best', 'top', 'vs']);
  const toks = (s) => norm(s).split(' ').filter(t => t.length > 1 && !TOK_STOP.has(t));
  const ownToks = (s) => toks(s).filter(t => !GEO.has(t) && !/^\d+$/.test(t)).map(stem1);

  /** the site's services as a LIST of phrases (R3 #4: a confirmed service is never split on a comma inside it). Arrays are kept as given;
   *  a JSON array string is parsed; a plain string is split on new lines, semicolons, pipes and bullets, and on commas ONLY when every
   *  piece is a short phrase (a list typed in one line), never inside a sentence. */
  // FX-L B1 (REVIEW_LOGIC B1): the stored lists are not clean. services_json / declared_services hold the pieces of ONE sentence cut at
  // commas and at 80 characters ("Microsoft Dynamics 365 consulting and implementation in the UAE and GCC: Busines", "CRM and Project
  // Operations. We also do NAV", "and ongoing managed IT support. Every solution is built around your business nee"). EVERY item, array or
  // string, goes through the same cleaner: a word cut by the 80-character limit is dropped, the item is split at sentence ends, colons,
  // semicolons, bullets and (short pieces only) commas; "We provide" / "we also do" / a leading "and" go; a market tail ("in the UAE and
  // GCC") goes; a sentence ("Every solution is built ...") is not a service; "X and Y" becomes X and Y ("GP and AX migrations" -> "GP
  // migrations", "AX migrations"; "consulting and implementation" keeps its product). Deduped by KI.key. NO cap by position (the caller
  // ranks by relevance first and caps after): devaicon's "Open edX Services" is item 21 of 30.
  const SVC_GEO = '(?:uae|u\\.a\\.e|gcc|dubai|abu dhabi|sharjah|ajman|middle east|mena|the region|region|saudi arabia|saudi|ksa|qatar|oman|bahrain|kuwait|pakistan|india|uk|usa|us|emirates)';
  const SVC_GEO_TAIL = new RegExp('\\s+(?:in|across|for|throughout|within|around)\\s+(?:the\\s+)?' + SVC_GEO + '(?:\\s*(?:,|and|&)\\s*(?:the\\s+)?' + SVC_GEO + ')*\\b.*$', 'i');
  const SVC_GEO_HEAD = new RegExp('^(?:the\\s+)?' + SVC_GEO + '\\s+(?=\\S)', 'i');
  const SVC_VERB = /^(?:(?:we|our team|our company|our experts|i)\s+)?(?:also\s+|can\s+)?(?:provide|provides|offer|offers|deliver|delivers|do|does|build|builds|specialise in|specialize in|specialised in|specialized in|help with|work on|handle|handles|cover|covers|support you with)\s+/i;
  const SVC_LEAD = /^(?:(?:and|or|also|plus|as well as|including|incl\.?|such as|like|e\.g\.?|with)\s+)+/i;
  const SVC_SENT = /^(?:every|each|this|that|these|those|it|its|it's|there|here|when|while|because|if|which|who|whose|all|many|most|some|any|no|we|our|you|your|they|their|us|i|get|let|contact|call|learn|read|find|see)\b/i;
  const SVC_GENERIC = new Set(['services', 'service', 'solutions', 'solution', 'support', 'consulting', 'consultancy', 'implementation', 'implementations', 'development', 'compliance', 'migration',
    'migrations', 'integration', 'integrations', 'management', 'hosting', 'training', 'maintenance', 'systems', 'system', 'software', 'apps', 'products', 'upgrades', 'upgrade', 'automation', 'audit', 'audits']);
  const svcClean = (p0) => { let p = S(p0).replace(/\s+/g, ' ').trim();
    for (let k = 0; k < 3; k++) p = p.replace(SVC_LEAD, '').replace(SVC_VERB, '').trim();
    p = p.replace(SVC_GEO_TAIL, '').replace(SVC_GEO_HEAD, '').replace(/^[\s\-\u2013\u2014*+.,:;]+|[\s\-\u2013\u2014*+.,:;!?]+$/g, '').trim();
    return p; };
  const svcOk = (p) => { const w = p.split(/\s+/).filter(Boolean); if (!w.length || w.length > 7 || p.length < 2 || p.length > 70) return false;
    if (SVC_SENT.test(p) || /[.!?]/.test(p.replace(/\b[a-z]\.[a-z]\.?/gi, '').replace(/\.(?=net|js|io)\b/gi, ''))) return false;
    if (!/\p{L}/u.test(p)) return false; if (w.length === 1 && (SVC_GENERIC.has(w[0].toLowerCase()) && !/^automation$/i.test(w[0]))) return false;
    if (w.length === 1 && w[0].length < 3 && !/^[A-Z0-9&]{2}$/.test(w[0])) return false; return true; };
  // "X and Y": two services, or one with a shared head / tail ("GP and AX migrations", "Dynamics 365 consulting and implementation")
  const svcAnd = (p) => { const m = p.match(/^(.+?)\s+and\s+(.+)$/i); if (!m) return [p];
    let L = m[1].trim(), R = m[2].trim(); const Lw = L.split(' '), Rw = R.split(' ');
    const gen = (t) => SVC_GENERIC.has(S(t).toLowerCase());
    if (Rw.length <= 2 && Rw.every(gen) && Lw.length >= 2) R = (gen(Lw[Lw.length - 1]) ? Lw.slice(0, -1) : Lw).concat(Rw).join(' ');
    else if (Lw.length === 1 && Rw.length >= 2 && gen(Rw[Rw.length - 1]) && !gen(Lw[0]) && (Lw[0].length <= 4 || /^[A-Z0-9&]+$/.test(Lw[0]))) L = Lw[0] + ' ' + Rw[Rw.length - 1];   // a product code ("GP and AX migrations")
    return [L, ...svcAnd(R)]; };
  const svcPieces = (raw) => { let t = S(raw).replace(/\s*[\r\n]+\s*/g, ' ; ').replace(/[ \t]+/g, ' ').trim(); if (!t) return [];
    // a piece cut by the 80-character limit (no closing punctuation): its last, partial word is not a word
    if (t.length >= 78 && t.length <= 82 && !/[.!?)\]]$/.test(t)) t = t.replace(/\s*\S+$/, '');
    const out = [];
    const paren = []; t = t.replace(/\(([^)]{2,40})\)/g, (_m, x) => { paren.push(x); return ' '; });
    const segs = t.split(/\s*(?:\n|;|\||\u2022|\u00b7|:\s|:$|\.\s+(?=[A-Z0-9])|\.$|\s-\s|\s\u2013\s|\s\u2014\s)\s*/).map(x => x.trim()).filter(Boolean);
    for (const s0 of segs) { let pieces = [s0];
      if (s0.includes(',')) { const c = s0.split(/\s*,\s*/).map(x => x.trim()).filter(Boolean); if (c.length >= 2 && c.every(x => x.split(/\s+/).length <= 7)) pieces = c; }
      for (const p1 of pieces) { const p = svcClean(p1); if (!p) continue;
        const parts = p.split(/\s+/).length <= 8 && /\sand\s/i.test(p) ? svcAnd(p).map(svcClean) : [p];
        for (const x of parts) if (svcOk(x)) out.push(x); } }
    for (const x of paren) { const p = svcClean(x); if (svcOk(p) && p.split(' ').length <= 3) out.push(p); }
    return out; };
  const services = (v) => {
    let a = v;
    if (typeof a === 'string') { const j = jparse(a, null); if (Array.isArray(j)) a = j; }
    const items = Array.isArray(a) ? a.flatMap(x => Array.isArray(x) ? x : [isObj(x) ? (x.name || x.service || x.title || '') : x]) : [a];
    const out = []; const seen = new Set();
    for (const it of items) for (const p of svcPieces(it)) { const k = key(p); if (!k || seen.has(k)) continue; seen.add(k); out.push(p); }
    return out.slice(0, 120);
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // hosts and urls
  // ---------------------------------------------------------------------------------------------------------------------------------
  const HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24}|xn--[a-z0-9-]{2,20})$/;
  const REDIR = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:google\.[a-z]{2,3}(?:\.[a-z]{2})?\/(?:goto|url|search\/url|aclk)(?=[?\/#]|$)|bing\.com\/ck\/a(?=[?\/#]|$))/i;
  const bareHost = (h) => S(h).toLowerCase().trim().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^[^@\/]*@/, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/\.$/, '').replace(/^www\d?\./, '');
  /** a valid registrable web host, or '' (text fragments, IP literals, single words, spaces) */
  const validHost = (h) => { const x = bareHost(h); if (!x || /\s/.test(S(h).trim().replace(/^[a-z]+:\/\//i, '').replace(/[\/?#].*$/, '')) || /^\d+(\.\d+){3}$/.test(x)) return ''; return HOST_RE.test(x) ? x : ''; };
  const reg = (h) => { const x = bareHost(h); if (typeof CMP === 'object' && CMP && typeof CMP.reg === 'function') return CMP.reg(x);
    const p = x.split('.').filter(Boolean); if (p.length <= 2) return x; const sl = p.slice(-2).join('.'); return /^(co|com|org|net|gov|ac|edu)\.[a-z]{2}$/.test(sl) ? p.slice(-3).join('.') : sl; };
  /** the host of a SERP item, or null when it is not known (no domain, or a Google redirect that still says google.com) */
  const hostOf = (it) => { if (!it) return null; if (typeof it === 'string') return validHost(it) || null;
    const u = S(it.url); if (REDIR.test(u) && !it.url_recovered) return null;
    if (it.domain === null && it.url_exact === false) return null;
    const h = validHost(it.domain || it.main_domain || (u.match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '');
    if (!h) return null; if (REDIR.test(u) && /(^|\.)google\./.test(h)) return null;
    return h; };
  const pathTokens = (it) => { const u = S(typeof it === 'string' ? it : it.url).toLowerCase();
    let p = u.replace(/^[a-z]+:\/\/[^\/?#]*/, '').replace(/[?#].*$/, '');
    p = p.replace(/\.(html?|php|aspx?)$/, '');
    return p.split('/').map(x => x.replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-+|-+$/g, '')).filter(Boolean); };
  /** the identity of a result page for clustering: host + path tokens, www / scheme / slash / query ignored. An approximate (recovered)
   *  url is keyed the same way, so the same breadcrumb on two results pages agrees; a partial one, or one with no host, has no key. */
  const urlKey = (it) => { if (!it) return null; const o = typeof it === 'string' ? { url: it } : it;
    if (o.url_partial === true) return null; const h = hostOf(o); if (!h) return null;
    const p = pathTokens(o); return h + (p.length ? '/' + p.join('/') : '/'); };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // domain classes (R4 6.1 #5): rules + known lists first, page text second, an LLM answer only when the caller passes one
  // ---------------------------------------------------------------------------------------------------------------------------------
  // the vendor of a product a client may resell or implement: a service naming the product makes its domains PRINCIPALS (never competitors)
  const PRINCIPALS = [
    { re: /\b(microsoft|dynamics|d365|business central|power platform|power bi|power apps|power automate|fabric|copilot|azure|sharepoint|office 365|microsoft 365|m365|navision|nav|great plains|dynamics gp|dynamics ax)\b/i,
      hosts: ['microsoft.com', 'dynamics.com', 'microsoft.ae', 'azure.com', 'powerbi.com', 'powerplatform.com', 'office.com', 'microsoftonline.com', 'windows.net', 'sharepoint.com'] },
    { re: /\bopen ?edx\b/i, hosts: ['openedx.org', 'axim.org', 'edx.readthedocs.io', 'openedx.atlassian.net'] },
    { re: /\bodoo\b/i, hosts: ['odoo.com'] }, { re: /\bsap\b|s\/?4 ?hana/i, hosts: ['sap.com'] }, { re: /\bsalesforce\b/i, hosts: ['salesforce.com'] },
    { re: /\bhubspot\b/i, hosts: ['hubspot.com'] }, { re: /\bzoho\b/i, hosts: ['zoho.com'] }, { re: /\bnetsuite\b/i, hosts: ['netsuite.com', 'oracle.com'] },
    { re: /\boracle\b/i, hosts: ['oracle.com'] }, { re: /\bsage\b/i, hosts: ['sage.com'] }, { re: /\bshopify\b/i, hosts: ['shopify.com'] },
    { re: /\baws\b|amazon web services/i, hosts: ['aws.amazon.com', 'amazonaws.com'] }, { re: /\bgoogle cloud\b|\bgcp\b/i, hosts: ['cloud.google.com'] },
    { re: /\bgoogle workspace\b/i, hosts: ['workspace.google.com'] }, { re: /\bpeppol\b/i, hosts: ['peppol.org', 'peppol.eu'] },
    { re: /\bmoodle\b/i, hosts: ['moodle.org', 'moodle.com'] }, { re: /\bservicenow\b/i, hosts: ['servicenow.com'] }, { re: /\bacumatica\b/i, hosts: ['acumatica.com'] },
    { re: /\bwordpress\b/i, hosts: ['wordpress.org', 'wordpress.com'] }, { re: /\bmagento\b|adobe commerce/i, hosts: ['magento.com', 'adobe.com'] }
  ];
  // global platforms and other software vendors (format or vendor, not a competitor), beyond CMP's lists
  const PLATFORM_HOSTS = /(^|\.)(zapier|make|notion|slack|canva|figma|monday|asana|trello|clickup|airtable|freshworks|freshdesk|zendesk|pipedrive|intercom|mailchimp|dropbox|box|docusign|stripe|paypal|twilio|okta|infor|epicor|ifs|unit4|tally|quickbooks|sage|acumatica|syspro|xero|freshbooks|wave|bitrix24|insightly|keap|sugarcrm|vtiger|creatio|medium|researchgate|academia|sciencedirect|springer|ieee|arxiv|mdpi|ncbi|scribd|slideshare|issuu|github|gitlab|bitbucket|stackoverflow|npmjs|readthedocs|wikipedia|wikimedia|wikihow|fandom|quora|reddit|tumblr|blogspot|wordpress|wix|weebly|squarespace|upwork|fiverr|freelancer|toptal|guru|peopleperhour|play\.google|apps\.apple|appsource\.microsoft)\.[a-z.]+$/;
  // directories, review sites and "top companies" ranking sites (places to be listed)
  const DIRECTORY_HOSTS = /(^|\.)(clutch|themanifest|goodfirms|sortlist|designrush|techbehemoths|topdevelopers|itfirms|appfutura|f6s|g2|capterra|getapp|softwareadvice|trustradius|trustpilot|peerspot|softwaresuggest|gartner|saashub|alternativeto|selecthub|financesonline|softwareworld|crozdesk|technologyadvice|appvizer|softwarefinder|softwareconnect|top10erp|erpfocus|upcity|agencyspotter|expertise|yelp|yellowpages|2gis|crunchbase|zoominfo|dnb|kompass|hidubai|uaeyp|serchen|bark|thumbtack|goodfirms|rightfirms|techreviewer|vendorland|builtin|zoftwarehub)\.[a-z.]+$/;
  // trade media and analyst blogs that write about the products a client sells (they rank, they compete for no buyer)
  const MEDIA_HOSTS = /(^|\.)(erpresearch|erpsoftwareblog|msdynamicsworld|dynamicscommunity|technologyevaluation|panorama-consulting|erpnews|cio|computerweekly|itpro|zdnet|techtarget|techradar|forbes|businessinsider|entrepreneur|inc|fastcompany|venturebeat|techcrunch|theverge|wired|khaleejtimes|gulfnews|thenationalnews|arabianbusiness|zawya|gulfbusiness|itp|economymiddleeast|wamda|magnitt|cxotoday|tahawultech|menabytes|analyticsinsight|towardsdatascience|kdnuggets|marktechpost|dawn|tribune|propakistani|techjuice|mashable|engadget|bbc|cnn|reuters|bloomberg|cnbc|nytimes|theguardian|ft|wsj|economist)\.[a-z.]+$/;
  // regulators, central banks and public bodies whose addresses do not end in .gov (beyond CMP's UAE free-zone list and the .gov endings)
  const GOV_HOSTS = /(^|\.)(centralbank|cbuae|ico|fca|cma|sbp|secp|pta|fbr|sama|zatca|rbi|sebi|sec|ecb|europa|edpb|vara|sca|dfsa|fsra|tra|tdra|citra|qcb|cbb|cbo|cbk|mas|bnm|bis|imf|worldbank|oecd|un|who)\.(?!(?:com|net|io|ai|co|app|dev|biz)$)(?:[a-z]{2,3}|(?:org|gov|gob|go|or)\.[a-z]{2})$/;
  const CC_MARKET = { ae: 'AE', sa: 'SA', qa: 'QA', om: 'OM', bh: 'BH', kw: 'KW', eg: 'EG', pk: 'PK', in: 'IN', uk: 'GB', 'co.uk': 'GB', au: 'AU', 'com.au': 'AU', ca: 'CA', de: 'DE', fr: 'FR', nl: 'NL',
    es: 'ES', it: 'IT', ie: 'IE', sg: 'SG', my: 'MY', za: 'ZA', ng: 'NG', ke: 'KE', nz: 'NZ', 'co.nz': 'NZ', 'com.pk': 'PK', 'co.in': 'IN', 'com.sa': 'SA', 'com.eg': 'EG', tr: 'TR', jo: 'JO', lb: 'LB', ma: 'MA' };
  const hostMarket = (h) => { const x = bareHost(h); const p = x.split('.'); const two = p.slice(-2).join('.'); return CC_MARKET[two] || CC_MARKET[p[p.length - 1]] || ''; };
  // CMP's host kind -> the KI class (search engines and the site itself are not classes: they are never stored)
  const KIND_CLASS = { job: 'job_board', directory: 'directory', review: 'directory', marketplace: 'platform', media: 'media', gov: 'government',
    social: 'platform', qa: 'platform', reference: 'platform', education: 'platform', help: 'platform', platform: 'platform' };
  const principalsOf = (ctx) => { const o = ctx || {}; const txt = services(o.services).concat(services(o.topics || [])).join(' | ');
    const out = new Set((Array.isArray(o.principals) ? o.principals : []).map(x => reg(validHost(x) || x)).filter(Boolean));
    for (const p of PRINCIPALS) if (p.re.test(txt)) p.hosts.forEach(h => out.add(h));
    return out; };
  const isPrincipal = (h, set) => { for (const p of set) if (h === p || h.endsWith('.' + p) || reg(h) === p) return true; return false; };
  // FX-L B2 (REVIEW_LOGIC B2): the topic of a DOMAIN is read from its OWN text only - the titles of its results and its homepage words -
  // never from the search it was found on. The seeds are built from the client's services, so a seed's words always match them, and every
  // business on a service results page came out "direct" ("sometravel.com" on "dynamics 365 business central company dubai": 100%). Per
  // title: a service phrase of 2+ words inside it = 1, a product or category the client sells (Open edX, Dynamics 365, Peppol, ERP, CRM) =
  // 0.8, else the share of its own words (the brand's words and seller words like "company" / "best" / "solutions" left out) that are
  // the client's service words; its homepage: how many of the client's service phrases it names (3 = 1.0). The best reading counts. No
  // text of its own -> null (the caller says "needs your review", never "direct").
  const SELLER_W = new Set(['company', 'companies', 'services', 'service', 'solutions', 'solution', 'provider', 'providers', 'partner', 'partners', 'agency', 'agencies', 'firm', 'firms',
    'consultants', 'consultant', 'best', 'top', 'leading', 'official', 'homepage', 'welcome', 'group', 'llc', 'ltd', 'fze', 'fzco', 'inc', 'global', 'international',
    'technologies', 'technology', 'tech', 'experts', 'expert', 'specialists', 'specialist', 'trusted', 'certified', 'reviews', 'review', 'site', 'website', 'page', 'guide', 'choose', 'how', 'why']);
  const SELLER_S = new Set([...SELLER_W].map(stem1));
  const PRODUCT_W = /\b(?:open ?edx|dynamics 365|d365|business central|power bi|power platform|power apps|power automate|copilot studio|navision|great plains|dynamics (?:gp|ax|nav|crm)|sap(?: b1| business one| s\/?4 ?hana)?|odoo|netsuite|salesforce|zoho|moodle|hubspot|peppol|pint ?ae|sharepoint|azure|servicenow|acumatica|shopify|magento)\b/gi;
  const TOPIC_WEAK = new Set(['automation', 'cloud', 'ai', 'data', 'digital', 'it', 'web', 'marketing', 'design', 'consulting', 'support', 'software', 'development', 'service', 'solution', 'system', 'technology', 'integration', 'analytic', 'security']);
  const STANDARDS = [{ re: /e-?invoic|peppol|fatoora|zatca/, words: ['pint', 'peppol', 'ubl', 'fatoora', 'einvoice', 'einvoicing', 'invoicing'] },
    { re: /open ?edx|\blms\b|moodle/, words: ['edx', 'lms', 'scorm', 'xapi', 'lti'] }];
  const CAT_W = new Set(['erp', 'crm', 'hrms', 'hcm', 'lms', 'wms', 'einvoicing', 'peppol', 'odoo', 'netsuite', 'salesforce', 'zoho', 'moodle', 'hubspot', 'sharepoint', 'servicenow', 'acumatica', 'edx']);
  const topicKit = (ctx) => { const o = ctx || {}; const svc = services(o.services).concat(services(o.topics || []));
    const strip = (arr) => arr.filter(t => !SELLER_S.has(t));
    const phr = uniq(svc.map(x => strip(ownToks(x)).join(' ')).filter(Boolean)).map(x => x.split(' '));
    const prods = uniq(svc.flatMap(x => (S(x).match(PRODUCT_W) || []).map(m => ownToks(m).join(' '))).filter(Boolean)).map(x => x.split(' '));
    const cats = new Set(svc.flatMap(ownToks).filter(t => CAT_W.has(t)));
    // the standards a service works in are its subject too (PINT AE, Peppol, UBL for an e-invoicing service)
    const allTxt = svc.join(' | ').toLowerCase();
    for (const st of STANDARDS) if (st.re.test(allTxt)) st.words.forEach(w => cats.add(w));
    // a generic word ("automation", "cloud", "ai") is weak evidence alone: it counts half (a whole service phrase still counts 1 above)
    const strong = new Set(phr.flat().filter(t => !TOPIC_WEAK.has(t)));
    return { svc, strip, phr, prods, cats, vocab: new Set(phr.flat()), strong }; };
  // FX-L N2 (re-review): a rival's name is a BRAND only when its label is not made entirely of service, product, category, generic or place
  // words: softwarecompany.ae, crmsoftware.ae, businesscentral.ae, peppol-uae.com are exact-match domains, and gating their words would gate the
  // client's own money searches ("software company in uae"); velosio, randgroup, intwo, dynamicssquare stay brands
  const LABEL_GENERIC = new Set(['software', 'softwares', 'company', 'companies', 'solution', 'solutions', 'service', 'services', 'tech', 'techs', 'technology', 'technologies', 'digital', 'it',
    'consulting', 'consultant', 'consultants', 'consultancy', 'partner', 'partners', 'group', 'system', 'systems', 'global', 'cloud', 'ai', 'app', 'apps', 'web', 'online', 'pro', 'expert', 'experts',
    'hub', 'lab', 'labs', 'soft', 'net', 'info', 'smart', 'data', 'business', 'central', 'crm', 'erp', 'hr', 'hrms', 'lms', 'peppol', 'einvoice', 'einvoicing', 'invoice', 'invoicing', 'accounting',
    'agency', 'agencies', 'studio', 'dev', 'development', 'developer', 'developers', 'best', 'top', 'my', 'the', 'and', 'of', 'uae', 'dubai', 'abu', 'dhabi', 'sharjah', 'ajman', 'gcc', 'ksa', 'saudi',
    'qatar', 'oman', 'bahrain', 'kuwait', 'me', 'mena', 'arabia', 'emirates', 'middle', 'east', 'gulf', 'dynamics', 'microsoft', 'office', 'erpsoftware', 'implementation', 'support', 'managed',
    'automation', 'integration', 'marketing', 'design', 'media', 'online', 'store', 'shop', 'world', 'experts', 'center', 'centre', 'networks', 'network', 'computer', 'computers', 'mobile', 'agentic']);
  const genericLabel = (label, vocab) => { const L = S(label).toLowerCase().replace(/[^a-z0-9-]/g, ''); if (!L) return true;
    const words = (w) => w.length >= 2 && (LABEL_GENERIC.has(w) || vocab.has(w) || /^\d+$/.test(w));
    const seg = (x) => { const ok = new Array(x.length + 1).fill(false); ok[0] = true;   // can x be cut into known words? (dynamic programming, linear in practice)
      for (let i = 1; i <= x.length; i++) for (let j = Math.max(0, i - 16); j < i; j++) if (ok[j] && words(x.slice(j, i))) { ok[i] = true; break; }
      return ok[x.length]; };
    return L.split('-').filter(Boolean).every(seg); };
  /** KI.brandDomains(domains, ctx) -> the domains whose name is a brand (see above); ctx.services feeds the known words */
  const brandDomains = (domains, ctx) => { const o = ctx || {}; const vocab = new Set(services(o.services).concat(services(o.topics || [])).flatMap(x => norm(x).split(' ')).flatMap(w => [w, stem1(w)]).filter(w => w.length >= 2));
    return uniq((Array.isArray(domains) ? domains : []).map(d => validHost(d) || '').filter(Boolean)).filter(d => !genericLabel(reg(d).split('.')[0], vocab)); };
  /** KI.topicSim(titles, homeText, ctx, host) -> 0..1 or null: a domain's own text against the client's services (see above) */
  const topicSim = (titles, homeText, ctx, host) => {
    const K = topicKit(ctx); if (!K.svc.length) return null;
    // the site's own name in a title ("... | Rand Group", "Edly - ...") is left out: the title segment whose letters ARE the host's label
    const lab = S(validHost(host) || host).split('.')[0].replace(/[^a-z0-9]/g, '');
    const sq = (x) => norm(x).replace(/[^a-z0-9]/g, '');
    const noBrand = (text) => { const seg = S(text).split(/\s+[|\-\u2013\u2014:\u00b7]\s+/).map(x => x.trim()).filter(Boolean);
      const keep = seg.filter(x => { const q = sq(x); return !(lab.length >= 3 && q && x.split(/\s+/).length <= 4 && (q === lab || lab.includes(q) || q.includes(lab))); });
      return (keep.length ? keep : seg).join(' '); };
    const own = (text) => uniq(K.strip(ownToks(noBrand(text))));
    const one = (text) => { const tw = own(text); if (!tw.length) return null; const set = new Set(tw); const has = (p) => p.length && p.every(t => set.has(t));
      if (K.phr.some(p => p.length >= 2 && has(p))) return 1;
      if (K.prods.some(has) || tw.some(t => K.cats.has(t))) return 0.8;
      return r2(tw.reduce((x, t) => x + (K.strong.has(t) ? 1 : K.vocab.has(t) ? 0.5 : 0), 0) / tw.length); };
    const ts = (Array.isArray(titles) ? titles : [titles]).filter(t => S(t).trim()).slice(0, 8).map(one).filter(x => x != null);
    let hs = null; if (S(homeText).trim()) { const set = new Set(ownToks(homeText)); const hit = (p) => p.length && p.every(t => set.has(t));
      hs = clip((K.phr.filter(p => p.length >= 2 && hit(p)).length + K.prods.filter(hit).length) / 3, 0, 1); }
    const all = ts.concat(hs == null ? [] : [hs]); return all.length ? Math.max(...all) : null; };
  /** KI.classifyDomain(host, ctx) -> { class, basis, confidence, reasons, valid, host, reg, store, needs_review }
   *  ctx: { own_domain, market (ISO2), services (list), topics, principals, declared: [domains], user: { domain: class },
   *         appearances: [{ keyword, position, type, title, url }] (this domain on the run's results pages; titles are untrusted text),
   *         pages: [{ url, title, text }] (its own pages read, untrusted), llm: { class, confidence } (only when an LLM was asked) }
   *  store=false for anything that may never become a competitor row: text fragments, search engines, the site itself. */
  const CLASS_IDS = ['direct', 'adjacent', 'principal', 'directory', 'publisher_list', 'platform', 'government', 'job_board', 'media', 'education'];
  // FX-L 2026-11-10 (Trial classification ~50% wrong among `direct` on production results): classes generalised beyond the fixed host lists,
  // from the evidence held per host - its name's words, its results' titles and paths. A job board, a recruiter or a staffing firm; a news,
  // update or magazine site; a directory or "yellow pages"; a training provider, school or university are never competitors, whatever topic
  // their pages share with the client.
  const JOB_LABEL = /job|career|recruit|staff|talent|manpower|hiring|vacanc|trabajo|empleo|emploi|lavoro|naukri|bayt/;
  const DIR_LABEL = /yellowpages|yellowpage|directory|directories|listing|listings|agencies|companies|firms|vendors|suppliers|businesslist|bizlist|finder/;
  const MEDIA_LABEL = /news|update|updates|times|daily|journal|magazine|gazette|tribune|herald|insider|today|weekly|chronicle|blog/;
  const EDU_LABEL = /university|universit|college|academy|academi|institute|school|campus/;   // not 'learning' / 'training': LMS vendors are often named so
  const JOB_T = /\b(?:jobs?|vacanc(?:y|ies)|hiring|careers?|salar(?:y|ies)|recruit(?:ment|ing|er|ers)?|job openings?)\b/i;
  const EDU_T = /\b(?:course|courses|training|trainers?|certification|certificate|bootcamp|academy|university|college|diploma|degree|classes|workshop)\b/i;
  const NEWS_T = /\b(?:released|publishes|published|announces|announced|launches|launched|unveils|news|updates?|v\d+\.\d+)\b/i;
  const classifyDomain = (host, ctx) => {
    const o = ctx || {}; const raw = S(host).trim();
    const h = validHost(raw);
    const out = (cls, basis, conf, reasons, extra) => ({ class: cls, basis, confidence: r2(conf), reasons, valid: !!h, host: h || raw, reg: h ? reg(h) : '', store: !!cls,
      needs_review: !!cls && conf < C(o.cfg).class_review_below, ...(extra || {}) });
    if (!h) return { ...out(null, 'rule', 1, ['not a web address: ' + ascii(raw).slice(0, 60)]), valid: false, store: false, reject: 'fragment' };
    const own = validHost(o.own_domain);
    if (own && (h === own || h.endsWith('.' + own) || reg(h) === reg(own))) return { ...out(null, 'rule', 1, ['your own site']), store: false, reject: 'own_site' };
    const R = reg(h);
    // the client's or a platform admin's own word is final
    const user = isObj(o.user) ? (o.user[h] || o.user[R]) : null;
    if (user && CLASS_IDS.includes(user)) return out(user, 'user', 1, ['set by you']);
    const pset = principalsOf(o);
    if (isPrincipal(h, pset)) return out('principal', 'rule', 0.95, ['the maker of a product you sell or implement']);
    const kind = (typeof CMP === 'object' && CMP && CMP.kindOfHost) ? CMP.kindOfHost(h, own) : 'business';
    if (kind === 'search') return { ...out(null, 'rule', 1, ['a search engine, never a competitor']), store: false, reject: 'search_engine' };
    if (kind === 'unknown') return { ...out(null, 'rule', 1, ['not a web address']), valid: false, store: false, reject: 'fragment' };
    const declared = (Array.isArray(o.declared) ? o.declared : services(o.declared)).map(x => reg(validHost(x) || x)).filter(Boolean);
    if (kind === 'gov' || GOV_HOSTS.test(h)) return out('government', 'rule', 0.95, ['a government, regulator or public body']);
    if (kind === 'job' || /(^|\.)(indeed|naukri|naukrigulf|bayt|glassdoor|monster|gulftalent|rozee|mustakbil|wuzzuf)\./.test(h)) return out('job_board', 'rule', 0.95, ['a job board']);
    if (DIRECTORY_HOSTS.test(h)) return out('directory', 'rule', 0.9, ['a directory or review site where companies are listed']);
    if (MEDIA_HOSTS.test(h)) return out('media', 'rule', 0.85, ['a news, trade media or analyst site']);
    if (PLATFORM_HOSTS.test(h) || /^(?:about\.me|linktr\.ee|carrd\.co|bio\.link|beacons\.ai)$/.test(h)) return out('platform', 'rule', 0.9, ['a global platform or another company\'s software']);
    const ccOnly = /^[a-z0-9-]+\.[a-z]{2}$/.test(R) && !/\.(io|ai|co|me|tv|ly|fm)$/.test(R);
    if (kind !== 'business' && !(kind === 'platform' && ccOnly)) return out(KIND_CLASS[kind] || 'platform', 'rule', 0.9, [(typeof CMP === 'object' && CMP.LABEL && CMP.LABEL[kind]) || kind]);
    if (declared.includes(R)) return out('direct', 'declared', 0.9, ['declared by you as a competitor']);
    // FX-L 2026-11-10: the host's own name, then the titles of its results
    const label = R.split('.')[0];
    const eduTld = /(^|\.)(ac|edu)\.[a-z]{2}$|\.edu$/.test(h);
    if (JOB_LABEL.test(label)) return out('job_board', 'rule', 0.8, ['its name is a job board, recruiter or staffing firm']);
    if (eduTld || EDU_LABEL.test(label)) return out('education', 'rule', 0.8, ['its name is a school, university or training provider']);
    if (DIR_LABEL.test(label)) return out('directory', 'rule', 0.8, ['its name is a directory or listing site']);
    if (MEDIA_LABEL.test(label)) return out('media', 'rule', 0.75, ['its name is a news, update or blog site']);
    const tts = uniq((Array.isArray(o.appearances) ? o.appearances : []).map(a => S(a && a.title)).filter(Boolean));
    const share = (re) => tts.length ? tts.filter(t => re.test(t)).length / tts.length : 0;
    if (tts.length && share(JOB_T) >= 0.5) return out('job_board', 'page', tts.length >= 2 ? 0.8 : 0.65, ['its results read are job listings (' + tts.filter(t => JOB_T.test(t)).length + ' of ' + tts.length + ')']);
    if (tts.length && share(EDU_T) >= 0.5) return out('education', 'page', tts.length >= 2 ? 0.8 : 0.65, ['its results read are courses or training (' + tts.filter(t => EDU_T.test(t)).length + ' of ' + tts.length + ')']);
    if (tts.length >= 2 && share(NEWS_T) >= 0.5) return out('media', 'page', 0.7, ['its results read are news or update articles']);
    // page signals: what this domain's results on the run's pages are, and what its own pages say (untrusted text)
    const apps = (Array.isArray(o.appearances) ? o.appearances : []).filter(Boolean);
    // a comparison ("X vs Y") is an article, not a list of companies: it never makes its site a list publisher (FX-L 2026-11-10)
    const cmpOnly = (t) => /\b(?:vs\.?|versus|compared|comparison|face-off)\b/i.test(S(t)) && !LIST_NUM.test(S(t)) && !LIST_PLURAL.test(S(t));
    const typed = apps.map(a => { let t = S(a.type) || (a.url || a.title ? pageType({ url: a.url, domain: h, title: a.title }, o) : ''); if (t === 'list' && cmpOnly(a.title)) t = 'guide'; return { a, t }; }).filter(x => x.t);
    const types = typed.map(x => x.t);
    const nList = types.filter(t => t === 'list').length, nProv = types.filter(t => t === 'provider' || t === 'vendor').length;
    const nGuide = types.filter(t => t === 'guide' || t === 'news' || t === 'video').length;
    const reasons = [];
    // FX-L H3: a list publisher needs two list pages, or one list of PRODUCTS; one list of providers on a site is often that provider's own
    // article ("Best Open edX Service Providers in 2026 - Edly"), so it is read on its topic below, at review confidence
    let oneSellerList = false;
    if (types.length >= 1 && nList === types.length && nProv === 0) {
      if (types.length >= 2) return out('publisher_list', 'page', 0.8, ['every result of it read is a list of companies or products (' + nList + ')']);
      if (!LIST_SELLERS.test(S(typed[0].a.title))) return out('publisher_list', 'page', 0.55, ['its one result read is a list of products or tools']);
      oneSellerList = true;
    }
    if (typeof o.llm === 'object' && o.llm && CLASS_IDS.includes(o.llm.class)) {
      const lc = clip(num(o.llm.confidence) == null ? 0.5 : num(o.llm.confidence), 0, 1);
      return out(o.llm.class, 'llm', lc, ['an AI reading of its pages (' + Math.round(lc * 100) + '% sure)']);
    }
    // FX-L B2: its OWN text only (titles of its results, its pages), never the search it was found on
    const pageText = (Array.isArray(o.pages) ? o.pages : []).map(p => S(p.title) + ' ' + S(p.text).slice(0, 3000)).join(' | ');
    const sim = topicSim(apps.map(a => S(a.title)), pageText, o, h);
    const hm = hostMarket(h); const mkt = S(o.market).toUpperCase();
    const geoOff = !!(hm && mkt && hm !== mkt);
    const gm = hm === mkt && mkt ? 1 : 0.5;
    if (sim != null) reasons.push(Math.round(sim * 100) + '% topic match with your services (its own titles and pages)');
    if (hm) reasons.push('web address in ' + hm);
    if (oneSellerList) reasons.push('its one result read is a list of providers (it may be a competitor\'s own article)');
    const capC = (c) => (oneSellerList ? Math.min(c, 0.55) : c);
    if (sim === 0) return out('adjacent', 'page', 0.35, reasons.concat(['nothing in its own titles or pages matches your services: not counted as a competitor until you confirm']), { topic_sim: 0, geo_match: geoOff ? 0 : gm });
    if (geoOff) return out('adjacent', 'page', capC(0.7), reasons.concat(['based in another market']), { topic_sim: sim, geo_match: 0 });
    // FX-L 2026-11-10: `direct` needs PROVIDER evidence - a service / product page of its own among its results, or a homepage that names the
    // client's services; a site seen only through articles, guides or lists is a close competitor for you to confirm
    const homeSim = pageText.trim() ? topicSim([], pageText, o, h) : null;
    const provEv = nProv > 0 || (homeSim != null && homeSim >= 0.67);
    if (sim != null && sim >= C(o.cfg).direct_topic && provEv) return out('direct', 'page', capC(nProv ? 0.8 : 0.7), reasons, { topic_sim: sim, geo_match: gm });
    if (sim != null && sim >= C(o.cfg).direct_topic) return out('adjacent', 'page', 0.55, reasons.concat(['only its articles or lists were seen, no service page of its own: needs your review']), { topic_sim: sim, geo_match: gm });
    if (sim != null) return out('adjacent', 'page', capC(0.6), reasons.concat(['sells something that overlaps']), { topic_sim: sim, geo_match: gm });
    // no text of its own: never "direct" from where it was found
    return out('adjacent', 'rule', 0.4, reasons.concat([apps.length ? 'seen on your service searches, but no title or page of its own was read: needs your review' : 'not enough evidence yet']), { topic_sim: null, geo_match: gm });
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // page type of one SERP item (R4 6.5 #1)
  // ---------------------------------------------------------------------------------------------------------------------------------
  const PAGE_TYPES = ['provider', 'vendor', 'list', 'directory', 'guide', 'forum', 'job_board', 'government', 'news', 'video', 'other'];
  // FX-L H3 (REVIEW_LOGIC H3): a list needs a number ("Top 10 ...", "8 Best ..."), "list of", "alternatives" / "vs", or a PLURAL seller or
  // product noun as the head ("best CRM companies", "top ERP tools"); "Best ERP Software Company in Dubai" and "Leading CRM Solutions
  // Provider in Dubai" are a provider describing itself (singular seller), and a homepage is never a list without a number
  const LIST_NUM = /\b(?:top\s*\d+\+?|\d+\+?\s+(?:best|top|leading|greatest|biggest|largest|most)|list of)\b/i;
  const LIST_SELLERS = /\b(?:companies|firms|agencies|providers|consultants|consultancies|vendors|partners|developers|integrators|resellers|specialists|experts|studios|contractors)\b/i;
  const LIST_PLURAL = /\b(?:best|top|leading|biggest|largest|popular|recommended)\s+(?:[\w&.+-]+\s+){0,6}?(?:companies|firms|agencies|providers|consultants|consultancies|vendors|partners|developers|integrators|resellers|specialists|studios|contractors|tools|platforms|softwares|apps|alternatives|options|picks|choices)\b(?!\s+(?:company|firm|agency|provider|partner|consultant|consultancy|developer|integrator|reseller|vendor|specialist)\b)/i;
  const LIST_OTHER = /\balternatives\b|\b(?:vs\.?|versus)\b|\bcompared\b|\bcomparison\b/i;
  const LIST_YEAR = /\b(?:best|top)\s+(?:[\w&.+-]+\s+){0,5}?(?:software|tools|apps|systems|platforms)\b.*\b20\d\d\b/i;
  const LIST_SLUG = /(?:^|\/)(?:\d+-)?(?:top|best)-(?:[a-z0-9]+-){0,6}?(?:\d+|companies|firms|agencies|providers|consultants|vendors|partners|developers|integrators|tools|platforms|softwares|apps|alternatives)(?:-|\/|$)|(?:^|\/)top-(?:[a-z0-9]+-){0,4}?software(?!-(?:company|provider|partner|development|house))(?:-|\/|$)/;
  const isListTitle = (t, p, noHead) => { const home = p === '/' || !S(p).replace(/\//g, '');
    if (LIST_NUM.test(t)) return true; if (home) return false;
    // FX-L 2026-11-10: a title whose FIRST part names plural sellers as its head ("AI Companies UAE", "System Integrators Companies in Sharjah",
    // "Microsoft Office 365 Distributors And Suppliers In Sharjah") lists businesses
    const first = S(t).split(/\s+[|\-\u2013\u2014:]\s+/)[0];
    if (!noHead && /^(?:[\w&.+'-]+\s+){0,6}?(?:companies|agencies|firms|providers|vendors|developers|consultants|integrators|suppliers|distributors|resellers)\b(?:\s+\S+){0,5}$/i.test(first.trim()) && !/\b(?:company|agency|firm|provider|partner)\b/i.test(first)) return true;
    return LIST_PLURAL.test(t) || LIST_OTHER.test(t) || LIST_YEAR.test(t) || LIST_SLUG.test(p); };
  const GUIDE_T = /\b(?:what is|what are|what's|what it means|what you need to know|how to|how does|why|guide|tutorial|explained|overview|introduction|definition|meaning|vs|difference|everything you need|complete|ultimate|101|beginner|faq|examples?|review|reviews|pdf)\b|\?/i;
  const GUIDE_P = /\/(?:blog|blogs|insights?|articles?|news|resources?|learn|guides?|knowledge|academy|wiki|faq|post|posts|stories|publication|science|document|presentation|docs?)(?:\/|$)/;
  const SERVICE_P = /\/(?:services?|solutions?|products?|software|platform|industries|consulting|implementation|offerings?|what-we-do|capabilities|expertise|partners?)(?:\/|$|-)/;
  const SERVICE_T = /\b(?:services?|solutions?|software|platform|partner|consult(?:ing|ancy|ants?)|implementation|agency|company|developers?|development|hosting|support|integrat(?:ion|or)s?|provider)\b/i;
  const VIDEO_H = /(^|\.)(youtube|youtu|vimeo|dailymotion|tiktok)\.[a-z.]+$/;
  const pageType = (it, ctx) => {
    if (!it) return null; const h = hostOf(it); if (!h) return null;
    const t = S(it.title); const u = S(it.url).toLowerCase(); const p = '/' + pathTokens(it).join('/');
    const kind = (typeof CMP === 'object' && CMP && CMP.kindOfHost) ? CMP.kindOfHost(h, (ctx || {}).own_domain) : 'business';
    if (S(it.type) === 'video' || VIDEO_H.test(h) || /\/watch(?:$|\/)|\/videos?\//.test(p)) return 'video';
    if (kind === 'gov' || /(^|\.)(gov|gouv|gob|mil)(\.[a-z]{2})?$/.test(h)) return 'government';
    if (kind === 'job' || ((typeof CMP === 'object' && CMP.kindOfResult) ? CMP.kindOfResult(u, t, '') === 'job' : /\b(jobs?|vacanc|careers?)\b/i.test(t))) return 'job_board';
    const hasUrl = /^https?:\/\/[^\/]+/i.test(u) && !REDIR.test(u);   // FX-L 2026-11-10: a result with no readable address (a goto redirect) has an unknown path, not a homepage
    if (isListTitle(t, hasUrl ? p : 'x/unknown', DIRECTORY_HOSTS.test(h) || kind === 'directory' || kind === 'review') && !/\b(what is|how to)\b/i.test(t)) return 'list';   // a directory's category page stays a directory
    if (DIRECTORY_HOSTS.test(h) || kind === 'directory' || kind === 'review') return 'directory';
    if (kind === 'qa' || kind === 'social' || /\/(?:forums?|community|communities|questions|discussion|threads?|pulse)\//.test(p) || /(^|\.)(community|forums?|answers|techcommunity)\./.test(h)) return 'forum';
    if (kind === 'media' || MEDIA_HOSTS.test(h)) return 'news';
    if (kind === 'reference' || kind === 'education' || /(^|\.)(wikipedia|researchgate|sciencedirect|springer|ieee|arxiv|mdpi|scribd|slideshare|readthedocs)\./.test(h)) return 'guide';
    const pset = principalsOf(ctx || {}); const R0 = reg(h);
    const ccOnly = /^[a-z0-9-]+\.[a-z]{2}$/.test(R0) && !/\.(io|ai|co|me|tv|ly|fm)$/.test(R0);
    const vendorHost = isPrincipal(h, pset) || (kind === 'platform' && !ccOnly) || PLATFORM_HOSTS.test(h);
    const guide = GUIDE_T.test(t) || GUIDE_P.test(p) || /\b(?:documentation|docs|knowledge base|help center|support article)\b/i.test(t) || /^(?:learn|docs|support|help|developer|developers|community|techcommunity)\./.test(h);   // FX-L L4: a maker's documentation is a guide
    if (vendorHost) return guide && !/\/(?:products?|pricing|solutions?)(?:\/|$)/.test(p) ? 'guide' : 'vendor';
    if (guide && !(SERVICE_P.test(p) && !GUIDE_P.test(p))) return 'guide';
    if (SERVICE_P.test(p) || SERVICE_T.test(t) || (hasUrl && (p === '/' || !p.replace(/\//g, '')))) return 'provider';
    if (typeof KWI === 'object' && KWI && KWI.shapeOf) { const sh = KWI.shapeOf(u, t); if (sh === 'Guide or article') return 'guide'; if (sh === 'Service or product page' || sh === 'Pricing page' || sh === 'Homepage') return 'provider'; }
    return t || p.length > 1 ? 'provider' : 'other';
  };
  /** the top 10 as stored (top10_json): [{ url, host, type, pos, exact }], items with no host skipped, positions kept */
  const top10 = (items, ctx, c0) => { const c = C(c0); const out = []; const seen = new Set();
    (Array.isArray(items) ? items : []).filter(x => x && (!x.type || /organic|video|local|^(provider|vendor|list|directory|guide|forum|job_board|government|news|video|other)$/.test(S(x.type))))
      .map((x, i) => ({ x, pos: num(x.rank_group) || num(x.pos) || num(x.position) || num(x.p) || (i + 1) }))
      .sort((a, b) => a.pos - b.pos)
      .forEach(({ x, pos }) => { if (out.length >= c.cluster.top_n || pos > c.cluster.top_n) return; const h = hostOf(x.u ? { ...x, url: x.u } : x); if (!h) return;
        const o = x.u ? { ...x, url: x.u, title: x.t } : x; const k = urlKey(o) || ('~' + h + '#' + pos); if (seen.has(k)) return; seen.add(k);
        const ty = PAGE_TYPES.includes(S(x.type)) ? S(x.type) : pageType(o, ctx);
        out.push({ url: S(o.url), host: h, type: ty, pos, exact: o.url_exact !== false }); });
    return out; };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // intent and stage (R4 6.5): strong words, then what ranks, then weak words, then the provider's label
  // ---------------------------------------------------------------------------------------------------------------------------------
  const W_INFO = /^(?:what|who|why|when|where|which|is|are|does|do|can|should|will)\b|\b(?:what is|what are|meaning|definition|define|explained|examples?|history|types of|benefits of|advantages|disadvantages|pros and cons|methodolog(?:y|ies)|models?|frameworks?|languages?|life ?cycle|sdlc|tutorial|course|courses|certification|jobs?|salary|salaries|careers?)\b/;
  const W_QUESTION = /^(?:what|who|why|when|where|which|is|are|does|do|can|should|will|how)\b/;
  // a product noun, a project noun, or the name of a product a client may sell (the PRINCIPALS list): people who know the solution they want
  const W_PRODUCT = /\b(?:software|system|systems|platform|platforms|tool|tools|app|apps|module|modules|erp|crm|hrms|lms|implementation|migration|integration|upgrade|hosting)\b/;
  const W_COMPARE = /\b(?:best|top|vs|versus|alternatives?|compare|comparison|pricing|price|prices|cost|costs|fees?|quote|quotes|reviews?|rated|cheapest|affordable|ranking|rankings|list of)\b/;
  const W_PROBLEM = /\b(?:deadline|deadlines|penalt(?:y|ies)|fines?|mandate|mandatory|requirements?|compliance|compliant|rules|regulations?|law|problem|problems|issues?|errors?|not working|fix|risks?|challenges?|audit|phase 2|go live|obligations?)\b/;
  const W_SELLER_ONE = /\b(?:company|agency|firm|provider|partner|consultant|consultancy|contractor|developer|vendor|integrator|reseller|specialist|expert|freelancer|house|studio|near me|hire|hiring a)\b/;
  const W_SELLER_MANY = /\b(?:companies|agencies|firms|providers|partners|consultants|consultancies|contractors|developers|vendors|integrators|resellers|specialists|experts|studios)\b/;
  const W_SERVICE = /\b(?:(?:implementation|consulting|development|managed|support|migration|outsourcing|integration|maintenance|hosting|upgrade) services?|services? providers?|it services|managed services)\b/;
  const W_SOLUTION = /\b(?:software|system|systems|platform|platforms|tool|tools|solution|solutions|app|apps|application|module|modules|features?|implementation|migration|integration|upgrade|automation|development|hosting|cloud|erp|crm|hrms|lms|setup|process|services?)\b/;
  const W_NAV = /\b(?:log ?in|sign ?in|portal|login|download)\b/;
  const STAGE_INTENT = { hire: 'commercial', compare: 'commercial', solution: 'commercial', problem: 'informational', info: 'informational' };
  const TYPE_WORD = { provider: 'company service pages', vendor: 'software makers\' pages', list: 'lists', directory: 'directories', guide: 'guides or articles',
    forum: 'forum or social posts', job_board: 'job boards', government: 'government pages', news: 'news or media pages', video: 'videos', other: 'other pages' };
  const STAGE_WORD = { hire: 'people looking to hire', compare: 'people comparing options', solution: 'people looking for a solution', problem: 'people with a problem to solve', info: 'people learning about the topic' };
  const posW = (pos, i) => 1 / Math.sqrt(Math.max(1, num(pos) || (i + 1)));
  /** KI.stage(top10, keyword, labsIntent, ctx?) -> { stage, intent, confidence, evidence (text), shares, needs_review, by }
   *  top10: stored items ({ type, pos }) or raw SERP items (typed here); labsIntent: 'commercial' | ... or { label, probability }. */
  const stage = (topItems, keyword, labsIntent, ctx) => {
    const c = C((ctx || {}).cfg); const R = c.stage_rule;
    const kw = norm(keyword); const has = (re) => re.test(kw);
    const items = (Array.isArray(topItems) ? topItems : []).filter(Boolean).slice(0, c.cluster.top_n)
      .map((x, i) => ({ type: PAGE_TYPES.includes(S(x.type)) ? S(x.type) : pageType(x, ctx), pos: num(x.pos) || num(x.rank_group) || num(x.position) || (i + 1) }))
      .filter(x => x.type);
    const total = items.reduce((s, x, i) => s + posW(x.pos, i), 0);
    const share = (set) => total ? items.reduce((s, x, i) => s + (set.includes(x.type) ? posW(x.pos, i) : 0), 0) / total : 0;
    const sh = { provider: share(['provider', 'directory']), list: share(['list']), info: share(['guide', 'news', 'video', 'forum']), vendor: share(['vendor']) };
    const counts = {}; for (const x of items) counts[x.type] = (counts[x.type] || 0) + 1;
    const ctext = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => n + ' ' + (n === 1 ? TYPE_WORD[k].replace(/s$/, '').replace(/ pages$/, ' page') : TYPE_WORD[k])).join(', ');
    const li = isObj(labsIntent) ? S(labsIntent.label) : S(labsIntent); const lp = isObj(labsIntent) ? num(labsIntent.probability) : null;
    const nav = has(W_NAV) || li === 'navigational';
    const res = (st, conf, by, why) => { const informational = st === 'solution' && items.length >= R.min_read && sh.info >= R.info_share;
      const intent = nav && st !== 'hire' && st !== 'compare' ? 'navigational' : (informational ? 'informational' : (st === 'hire' && /\b(?:hire|buy|quote|near me)\b/.test(kw) ? 'transactional' : STAGE_INTENT[st]));
      const ev = (items.length ? items.length + ' results read: ' + ctext : 'results page not read') + ' -> ' + STAGE_WORD[st] + (why ? ' (' + why + ')' : '');
      return { stage: st, intent, confidence: r2(conf), evidence: ascii(ev), shares: { provider: r2(sh.provider), list: r2(sh.list), info: r2(sh.info), vendor: r2(sh.vendor) }, counts,
        read: items.length, needs_review: conf < R.review_below, by }; };
    if (!kw) return res('info', 0, 'none', 'no keyword');
    const serpOk = items.length >= R.min_read;
    // the SERP's own reading, when there is enough of it
    let serp = '';
    if (serpOk) {
      if (sh.list >= R.list_share && (sh.list >= sh.provider || has(W_SELLER_MANY) || has(W_COMPARE))) serp = 'compare';
      else if (sh.provider >= R.provider_share) serp = 'hire';
      else if (sh.info >= R.info_share) serp = 'info';
      else if (sh.vendor + sh.provider >= R.provider_share) serp = 'solution';
    }
    // 1. strong words (R4 6.5 #3)
    if (has(W_COMPARE) && !(/^(?:what|how|why|is|are)\b/.test(kw) && !/\b(?:best|top|vs|versus|alternatives?|cost|costs|price|pricing)\b/.test(kw))) return res('compare', serp === 'compare' ? 0.9 : 0.8, 'words', 'a comparison word');
    if (has(W_INFO) && (W_QUESTION.test(kw) || (!has(W_SELLER_ONE) && !has(W_SELLER_MANY)))) return res(has(W_PROBLEM) ? 'problem' : 'info', serp === 'info' || !serpOk ? 0.85 : 0.7, 'words', 'a learning word');
    if (/\bnear me\b/.test(kw)) return res('hire', 0.9, 'words', 'near me');
    // 2. what ranks
    const local = (typeof fitMarket === 'function') ? (fitMarket(kw, (ctx || {}).market || '').places || []).length > 0 : [...kw.split(' ')].some(t => GEO.has(t));
    const sellerOne = has(W_SELLER_ONE) || has(W_SERVICE), sellerMany = has(W_SELLER_MANY);
    if (serp === 'compare') return res('compare', sellerMany || sellerOne ? 0.85 : 0.75, 'serp', '');
    if (serp === 'hire') return res(has(W_PROBLEM) && !sellerOne ? 'problem' : 'hire', sellerOne || local ? 0.85 : 0.75, 'serp', '');
    const product = has(W_PRODUCT) || PRINCIPALS.some(p => p.re.test(kw));
    if (serp === 'info') return res(has(W_PROBLEM) ? 'problem' : (product ? 'solution' : 'info'), 0.75, 'serp', '');
    if (serp === 'solution') return res(sellerOne ? 'hire' : 'solution', 0.7, 'serp', '');
    // 3. weaker words
    if (sellerMany) return res('compare', 0.7, 'words', 'several sellers named');
    if (sellerOne) return res('hire', 0.75, 'words', 'a seller named');
    if (has(W_PROBLEM)) return res('problem', 0.7, 'words', 'a problem word');
    if ((has(W_SOLUTION) || product) && local) return res('hire', 0.65, 'words', 'a service in a place');
    if (has(W_SOLUTION) || product) return res('solution', 0.65, 'words', product && !has(W_SOLUTION) ? 'a product name' : 'a solution word');
    // 4. the provider's intent label (R5 13.1 #7: under 0.65 it is unsure)
    const unsure = lp != null && lp < c.labs_unsure;
    if (li === 'transactional') return res('hire', unsure ? 0.5 : 0.6, 'labs', 'provider intent');
    if (li === 'commercial') return res(local ? 'hire' : 'solution', unsure ? 0.5 : 0.6, 'labs', 'provider intent');
    if (li === 'informational' || li === 'navigational') return res('info', unsure ? 0.5 : 0.6, 'labs', 'provider intent');
    if (local) return res('hire', 0.55, 'words', 'a place named');
    return res('info', 0.4, 'default', 'no evidence');
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // gate and fit (the shared fit gate, mapped to the KI reasons)
  // ---------------------------------------------------------------------------------------------------------------------------------
  const CAREER_W = /\s(?:jobs?|careers?|vacanc(?:y|ies)|hiring|recruit(?:ing|ment)?|salar(?:y|ies)|internships?|job description|cv|resume|apply now|walk in|openings?|course|courses|certification|training institute)\s/;
  const SELLS_WORK = /\b(?:recruit\w*|staffing|manpower|headhunt\w*|executive search|employment agenc\w*|training|courses?|academy|education)\b/;
  const GATE_REASON = { 'other market': 'other_market', 'job search': 'career', 'other brand': 'other_brand', 'government': 'government', 'portal': 'portal',
    'navigational': 'navigational', 'own brand': 'own_brand', 'off topic': 'off_topic', 'too broad': 'too_broad', 'empty': 'empty' };
  const GATE_TEXT = { other_market: 'outside your market', career: 'someone looking for a job or a course', other_brand: 'another company\'s brand', government: 'a government service',
    portal: 'someone looking for a login or a portal', navigational: 'someone looking for one particular website', own_brand: 'your own brand (tracked, not a new opportunity)',
    practitioner: 'someone already using the product, looking for its documentation or settings', off_topic: 'not something you sell', too_broad: 'too broad to point to what you sell', empty: 'no keyword', low_fit: 'too far from what you sell', avoid: 'you or our check said not to write it' };
  /** the gate ctx from a site: { own_domain, market, services (list), topics, competitors, serp_domains, brands, intent, protect, serp, career, avoid } */
  const gctx = (ctx) => { const o = ctx || {}; const svc = services(o.services); const topics = uniq(svc.concat(services(o.topics || [])));
    return { own_domain: o.own_domain || o.domain || '', market: S(o.market || '').toUpperCase().slice(0, 2), services: svc, topics, competitors: o.competitors || [],
      serp_domains: o.serp_domains || [], brands: o.brands || {}, intent: o.intent || '', protect: o.protect || [], serp: o.serp || [], career: o.career || null }; };
  // ---- KI-GATE2: who is searching (job seekers, students, people using the product, another language, a packaged product the site does not sell)
  const BUYER_RX = /\s(?:company|companies|agency|agencies|firm|firms|partner|partners|provider|providers|vendor|vendors|reseller|resellers|consultant|consultants|consultancy|consulting|service|services|implementation|implementer|implementers|outsourc\w*|cost|costs|price|prices|pricing|quote|quotes|licen[cs]es?|licensing|subscription|best(?!\spractices?)|top|vs|versus|compare|comparison|alternatives?|reviews?|near me|support|managed|migration|migrate|upgrade|integration|integrator|integrators|hire|rates?|benefits|advantages|demo)\s/;
  // studying or working, not buying: coursework theory, exams, courses, definitions (the CAREER_W words above stay as they were)
  const STUDY_RX = /\s(?:sdlc|life cycle|lifecycle|methodolog(?:y|ies)|manifesto|waterfall|v model|design patterns?|user stories|wbs|raci|flowchart|syllabus|scrum|kanban|extreme programming|xp|adaptive software development|asd|clean room|cleanroom|interview questions?|exam|exams|certified|associate|tutorials?|course|courses|bootcamp|degree|university|college|nyu|wgu|computer science|thesis|assignment|homework|stands for|abbreviation|acronym|full form|meaning|definition|define|development models?|life ?cycle models?|process models?|phases|hierarchy|team building|team members)\s|\s(?:mb|pl|az|dp|ai|sc|ms|md|ab|da)\s\d{3}\s/;
  const STRONG_BUYER_RX = /\s(?:company|companies|agency|agencies|firm|firms|partner|partners|provider|providers|vendor|vendors|consultant|consultants|consultancy|consulting|service|services|implementation|outsourc\w*|cost|costs|price|prices|pricing|quote|quotes|hire|rates?)\s/;
  const STRONG_STUDY_RX = /\s(?:sdlc|life cycle|lifecycle|methodolog(?:y|ies)|manifesto|waterfall|v model|design patterns?|patterns|user stories|wbs|raci|flowchart|syllabus|scrum|kanban|extreme programming|agile|steps|languages|programme|niches|ideas|opportunities|standards?|interview questions?|exam|exams|tutorials?|course|courses|stands for|abbreviation|acronym|full form|cross functional)\s|\s(?:mb|pl|az|dp|ai|sc|ms|md|ab|da)\s\d{3}\s/;
  // a search for one company: its photos, its phone number, its page on a social site; an event, not a purchase
  const NAV_RX = /\s(?:photos|pictures|contact number|phone number|whatsapp|office address|linkedin|glassdoor|facebook|instagram)\s$/;
  const EVENT_RX = /\s(?:conference|summit|expo|exhibition|webinar|meetup|hackathon|tenders?|rfq)\s/;
  // training is studying unless it is a model's training or a training platform (Open edX, an LMS)
  const TRAIN_RX = /\s(?!(?:model|data|ai|ml|llm)\s)\S+\straining(?!\s(?:platform|software|system|lms|management))\s|^\straining\s/;
  // a job title on its own (places and seniority dropped), with no buyer word: "software developer", "finance operations specialist"
  const ROLE_RX = /\s(?:developer|developers|engineer|engineers|programmer|programmers|analyst|analysts|specialist|specialists|architect|architects|technician|technicians|leader|lead|officer|administrator|admin|intern|interns|professionals|associate)$/;
  // using the product, not buying a service around it: docs, files, specs, settings, an admin's how-to
  const DOCS_RX = /\s(?:documentation|docs|user guide|user manual|manual|manuals|guide pdf|pdf|ppt|pptx|download|downloads|cookbook|ebook|template|templates|xls|xlsx|sample|samples|icon|icons|logo|png|svg|jpg|screenshot|sdk|software development kit|api documentation|api reference|api|xml|xsd|json|schema|validator|validation rules?|specification|specifications|spec|data dictionary|mandatory fields|code list|codes|unit of measure|scheme id|as4|ubl|bis\d*|edi|test bed|testbed|ip ranges?|ip address(?:es)?|security roles?|backup policy|update schedule|release plan|release notes|release wave|roadmap|provisioning|installation|install|setup guide|configure|configuration|excel add in|add in|email templates|table browser|task recorder|error|errors|architecture|best practices|kpis?|key performance indicators|cheat sheet|shortcuts?|login|sign in|workflow|workflows|format|formats|number|news|countries|dictionary|members|check|international|document types|questionnaire|estimation|estimates|tools for)\s|\s(?<!low |no )code\s|\s(?:expense|asset|inventory|warehouse|case|document|cash flow|budget)\s(?:management\s)?(?:in\s|for\s)?(?:microsoft\s)?(?:d365|dynamics)\s|\show to (?:manage|use|create|set up|setup|configure|install|find|enable|add|delete|export|import|connect|get started)\s|\sbook(?!\s(?:a|demo|call|meeting|consultation))\s|\s\d+ \d+\s|\s0\d{3}\s/;
  const KI_PLACES = [['BE', /\s(?:belgium|belgian|belgie|belgique|brussels|bruxelles|antwerp|ghent)\s/], ['PL', /\s(?:poland|polska|warsaw|krakow)\s/], ['RO', /\s(?:romania|bucharest)\s/],
    ['NL', /\s(?:nederland|dutch)\s/], ['LU', /\sluxembourg\s/], ['DK', /\s(?:denmark|danish|copenhagen)\s/], ['SE', /\s(?:sweden|swedish|stockholm)\s/], ['NO', /\s(?:norway|norwegian|oslo)\s/],
    ['FI', /\s(?:finland|finnish|helsinki)\s/], ['CH', /\s(?:switzerland|swiss|zurich|geneva)\s/], ['AT', /\s(?:austria|vienna)\s/], ['PT', /\s(?:portugal|lisbon)\s/], ['GR', /\s(?:greece|athens)\s/],
    ['CZ', /\s(?:czech|czechia|prague)\s/], ['HU', /\s(?:hungary|budapest)\s/], ['GH', /\s(?:ghana|accra)\s/],
    ['US', /\s(?:tx|dallas|austin|atlanta|denver|miami|phoenix|san diego|san jose|new jersey|virginia)\s/], ['IN', /\s(?:kerala|kochi|jaipur|gujarat|chandigarh|indore)\s/]];
  const KI_PLACES_RX = new RegExp(KI_PLACES.map(([, rx]) => rx.source).join('|'));
  // another language (the market is measured in English): Dutch, French, German, Spanish words a search in English never carries
  const FOREIGN_RX = /\s(?:verplicht|verplichting|facturen|factuur|facturatie|facture|factures|facturation|cest|qu est|quest|wat is|wat zijn|was ist|rechnung|rechnungen|pflicht|obligatoire|obligatorio|factura|facturas|facturacion|que es|voor|pour|und|het|een|welke|hoe)\s/;
  // a packaged product of a category the site does not sell, with no build / implement word ("hrms software in dubai" for a software house)
  const PRODUCT_CAT_RX = /\s(game development|game|hrms|hris|hr|payroll|attendance|time attendance|applicant tracking|ats|pos|point of sale|accounting|bookkeeping|inventory|stock|erp|crm|school management|hospital management|clinic management|property management|queue management|fleet management|warehouse management|lms|learning management|project management|document management|billing|invoicing|e invoicing|trading|real estate)\s(?:software|system|systems|app|apps|application|applications|tool|tools|platform|platforms|solution|solutions)(?:\s|$)/;
  const BUILD_RX = /\s(?:development|developer|developers|develop|custom|customi[sz]ed|bespoke|build|building|agency|outsourc\w*|implementation|partner|partners|consultant|consultants|integration|company|companies)\s/;
  // generic English names of a vendor's products count as the product only with the vendor named ("finance operations" alone is not F&O)
  const GENERIC_SVC = /^(?:finance (?:and )?operations|project operations|nav|sales|customer service|field service|commerce|supply chain(?: management)?|human resources|marketing|managed support|managed services|post go live|support|operations|fabric)$/;   // CRM is a category a client sells whatever the vendor: not here
  const GENERIC_IN = /\b(?:finance (?:and )?operations|project operations|customer service|field service|supply chain(?: management)?|human resources|managed support|managed services|post go live)\b/g;
  const ANCHOR_RX = /\s(?:dynamics|d365|microsoft|ms|msft|fno|f and o|f o|ax|navision|business central|power|copilot|azure|365|sharepoint)\s/;
  const SERVICE_PRE = /\s(?:in|on|with|using|to|for)\s(?:microsoft\s)?(?:d365|dynamics(?:\s365)?|business central|power bi|power apps|power automate|finance and operations|fno|sharepoint)\b/;
  const PRODUCT_TAIL_RX = /\s(?:d365|dynamics(?:\s365)?|business central|finance and operations|fno|power bi)\s(?:\S+\s){0,3}(?:development|intercompany|mobile app|asset management|expense management|human resources|consolidation|budgeting|electronic reporting|business units?|task recorder|table browser)\s|\sbusiness units?\s(?:\S+\s){0,2}(?:d365|dynamics)/;
  const SCOPE_LEAD = /^(?:modules?|editions?|features?|apps|capabilities|what is new|whats new)$/;
  const CAT_COVER = { erp: /dynamics|business central|finance (?:and |& )?operations|\berp\b|sap\b|odoo|netsuite/, crm: /\bcrm\b|dynamics 365 sales|salesforce/, lms: /open edx|\blms\b|learning platform|e learning/,
    'learning management': /open edx|\blms\b|learning/, invoicing: /invoic|peppol/, 'e invoicing': /invoic|peppol/, billing: /invoic|billing/, accounting: /business central|accounting/, bookkeeping: /business central|accounting/,
    inventory: /business central|finance (?:and |& )?operations|inventory|supply chain/, stock: /business central|finance (?:and |& )?operations|inventory/, 'project management': /project operations|project management/,
    hr: /human resources|\bhr\b|payroll/, hrms: /human resources|\bhrms\b|payroll/, hris: /human resources|\bhris\b/, payroll: /payroll/, 'document management': /document|sharepoint/ };
  const anchored = (keyword, o) => { const kt = ' ' + norm(keyword) + ' '; if (ANCHOR_RX.test(kt)) return o;
    // a generic product name is dropped from the services, and from inside a longer service name ("Dynamics 365 Finance & Operations" -> "Dynamics 365")
    const keep = (v) => services(v).filter(x => !GENERIC_SVC.test(norm(x))).map(x => norm(x).replace(GENERIC_IN, ' ').replace(/\s+/g, ' ').trim()).filter(x => x.split(' ').length >= 1 && x.length > 2);
    return { ...o, services: keep(o.services), topics: keep(o.topics || []) }; };
  const inTopic = (text, o) => { const g = gctx(o); if (typeof fitEvidence !== 'function' || !g.topics.length || !S(text).trim()) return false;
    return fitEvidence(S(text), g.topics, { services: g.services, market: g.market }).verdict === 'in'; };
  const TAIL_OK = /^(?:for|uae|dubai|abu|dhabi|sharjah|gcc|middle|east|company|companies|services?|solutions?|partner|partners|provider|providers|agency|agencies|consultant|consultants|consulting|experts?|specialists?|team|teams|support|implementation|migration|upgrade|integration|cost|price|pricing|plans?|licen[cs]e|licensing|modules?|editions?|features?|overview|benefits|advantages|demo|trial|review|reviews|vs|comparison|alternatives?|outsourcing|offshore|nearshore|custom|bespoke|enterprise|small|business|businesses|startups?|sme|smes|online|cloud|managed|it|ai|uk|rates?|near|me|best|top|leading|list|in|the|and|of|a|an|to|on|with|by|at|via|penalt(?:y|ies)|fines?|deadlines?|mandate|mandatory|requirements?|rules|regulations?|compliance|law|customi[sz]ation|expertise|experience|timeline|readiness)$/;
  const serviceTail = (kt, o) => { const phr = uniq(services(o.services).map(x => norm(x)).filter(x => x.split(' ').length >= 2)).sort((a, b) => b.length - a.length);
    const t = kt.trim(); const ph = phr.find(x => t === x || t.startsWith(x + ' ')); if (!ph) return null;
    const rest = t.slice(ph.length).trim().split(' ').filter(Boolean); const svcW = new Set(services(o.services).concat(services(o.topics || [])).join(' ').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2));
    if (!rest.length || rest.length > 3 || rest.some(w => TAIL_OK.test(w) || /^\d+$/.test(w) || svcW.has(w))) return null;   // a tail word that is itself one of the services is the service
    if (typeof fitPlaces === 'function' && fitPlaces(rest.join(' ')).length) return null;
    return { words: rest.join(' '), anchor: ANCHOR_RX.test(' ' + ph + ' ') || /\s(?:peppol|pint)\s/.test(' ' + ph + ' ') }; };
  const fail = (reason, detail, text) => ({ gate: 'fail', reason, text: text || GATE_TEXT[reason], detail: ascii(detail) });
  const whoSearches = (keyword, o) => {
    const kt = ' ' + norm(keyword) + ' '; const buyer = BUYER_RX.test(kt);
    const svcText = services(o.services).concat(services(o.topics || [])).join(' | ').toLowerCase();
    if (FOREIGN_RX.test(kt)) return fail('other_market', 'it is written in another language: ' + (kt.match(FOREIGN_RX) || [''])[0].trim(), 'a search in another language');
    // markets the shared fit gate does not list (kept here so no other path of the engine changes): the European markets e-invoicing
    // searches name most, and more US / Indian places; a website measured in one of them is never stopped by its own country
    const xm = kt.match(KI_PLACES_RX); if (xm) { const iso = (KI_PLACES.find(([, rx]) => rx.test(xm[0])) || [''])[0]; const mk = S(o.market || '').toUpperCase().slice(0, 2);
      if (iso && iso !== mk) return fail('other_market', 'a search about ' + xm[0].trim() + ', outside the market this website is measured in (' + (mk || 'its market') + ')'); }
    if (!SELLS_WORK.test(svcText) && !STRONG_BUYER_RX.test(kt)) {
      const m = buyer ? kt.match(STRONG_STUDY_RX) : (kt.match(STUDY_RX) || kt.match(STRONG_STUDY_RX) || kt.match(TRAIN_RX)); if (m) return fail('career', 'it reads as studying or an exam: ' + m[0].trim());
    }
    if (!buyer) { const bare = (typeof fitDropPlaces === 'function' ? fitDropPlaces(keyword, (typeof fitPlaces === 'function' ? fitPlaces(keyword) : []).map(x => x.word)) : S(keyword));
      const bt = ' ' + norm(bare).replace(/\s(?:i|ii|iii|iv|v|senior|junior|sr|jr|lead|principal|chief)$/g, '') + ' ';
      if (ROLE_RX.test(bt.trimEnd()) && !/\sfor hire\s|\sfreelance\s/.test(kt)) return fail('career', 'it names a job title: ' + (bt.trimEnd().match(ROLE_RX) || [''])[0].trim()); }
    if (!buyer) { const m = kt.match(DOCS_RX); if (m) return fail('practitioner', 'it reads as someone using the product: ' + m[0].trim(), GATE_TEXT.practitioner); }
    // "<a task> in <the product>": an admin's how-to, unless the task itself is something the site sells ("e invoicing in dynamics 365")
    // a product followed by one of its own modules or a developer's task ("dynamics 365 finance and operations intercompany")
    if (!buyer && PRODUCT_TAIL_RX.test(kt)) return fail('practitioner', 'it is a task or a module inside the product: ' + (kt.match(PRODUCT_TAIL_RX) || [''])[0].trim(), GATE_TEXT.practitioner);
    if (!buyer) { const i = kt.search(SERVICE_PRE); if (i > 0) { const lead = kt.slice(0, i).trim(); if (lead && lead.split(' ').length <= 5 && !SCOPE_LEAD.test(lead) && !inTopic(lead, o))
      return fail('practitioner', 'it is a task inside the product: ' + lead, GATE_TEXT.practitioner); } }
    if (NAV_RX.test(kt)) return fail('other_brand', 'it looks for one company: ' + (kt.match(NAV_RX) || [''])[0].trim());
    if (!STRONG_BUYER_RX.test(kt) && EVENT_RX.test(kt)) return fail('off_topic', 'an event or a tender, not a buyer search: ' + (kt.match(EVENT_RX) || [''])[0].trim());
    // the results page names one company for it: a top-3 website whose name the search carries (not the client, not a directory or a social site)
    const sh = (Array.isArray(o.serp_hosts) ? o.serp_hosts : []).slice(0, 3);
    for (const h0 of sh) { const h = S(h0).toLowerCase().replace(/^www\./, ''); const label = h.split('.')[0]; if (!label || label.length < 4 || h === S(o.own_domain || o.domain).toLowerCase().replace(/^www\./, '')) continue;
      if (/^(?:linkedin|facebook|instagram|youtube|twitter|clutch|goodfirms|glassdoor|indeed|google|wikipedia|reddit|quora|microsoft|amazon|apple)$/.test(label)) continue;
      if (kt.includes(' ' + label + ' ') && !svcText.includes(label)) return fail('other_brand', 'it looks for ' + h + ' by name (that website is a top result for it)'); }
    const pc = kt.match(PRODUCT_CAT_RX);
    if (pc && !BUILD_RX.test(kt.replace(pc[0], ' '))) { const cat = pc[1]; const covered = CAT_COVER[cat] ? CAT_COVER[cat].test(svcText) : svcText.includes(cat);
      if (!covered) return fail('off_topic', 'a packaged ' + cat + ' product, which is not something you sell'); }
    // a service name followed by a word that is neither a buyer's, a place, an audience ("for startups") nor a scope word: a concept or a
    // product detail ("software development standard", "dynamics 365 finance and operations workflow"), not a search for a provider
    if (!buyer) { const tail = serviceTail(kt, o); if (tail) return tail.anchor ? fail('practitioner', 'a detail of the product: ' + tail.words, GATE_TEXT.practitioner)
      : fail('career', 'it reads as studying the subject: ' + tail.words); }
    return null;
  };
  /** KI.gate(keyword, ctx) -> { gate: 'pass' | 'fail', reason, text, detail }. The KI write path's gate (gate_lint pair: write KI.gate, read KI.readable). */
  const gate = (keyword, ctx) => {
    const o = ctx || {}; const k = key(keyword);
    const avoid = o.avoid instanceof Set ? o.avoid : new Set((Array.isArray(o.avoid) ? o.avoid : []).map(key));
    if (!k) return { gate: 'fail', reason: 'empty', text: GATE_TEXT.empty, detail: 'no keyword' };
    if (avoid.has(k)) return { gate: 'fail', reason: 'avoid', text: GATE_TEXT.avoid, detail: 'a stored AVOID verdict for this keyword (it needs an explicit override)' };
    if (typeof fitGate !== 'function') return { gate: 'fail', reason: 'empty', text: 'the fit gate is not available', detail: 'fit gate kit not inlined (fails closed)' };
    // FX-L 2026-11-10 (Trial: "software development company sharjah careers" passed): a search with a job / career / pay / study word is
    // someone looking for work or a course, unless the site sells recruitment or training
    const kn = ' ' + norm(keyword) + ' ';
    if (CAREER_W.test(kn) && !SELLS_WORK.test(services(o.services).concat(services(o.topics || [])).join(' | ').toLowerCase()))
      return { gate: 'fail', reason: 'career', text: GATE_TEXT.career, detail: 'it names a job, a career, pay or a course: ' + ascii((kn.match(CAREER_W) || [''])[0]).trim() };
    // KI-GATE2 (2026-11-11, docs/keyword-intel-2026-11-08/fixes/GATE2.md; measured on 800 labelled Trial searches): who is searching, before
    // what. Each rule names what it read; a buyer word (company, partner, services, cost, best, vs ...) always lets the search through to the
    // topic gate below, so "microsoft certified partner dubai" or "dynamics 365 support services" are never caught by a study or a docs word.
    const intent = whoSearches(keyword, o);
    if (intent) return intent;
    const g = fitGate(S(keyword), gctx(anchored(keyword, o)));
    if (g && g.ok) return { gate: 'pass', reason: '', text: '', detail: '' };
    const reason = GATE_REASON[(g || {}).reason] || 'off_topic';
    return { gate: 'fail', reason, text: GATE_TEXT[reason], detail: ascii((g || {}).detail || '') };
  };
  const BUYER_W = new Set(['provider', 'providers', 'company', 'companies', 'service', 'services', 'partner', 'partners', 'agency', 'agencies', 'firm', 'firms', 'vendor', 'vendors',
    'best', 'top', 'leading', 'cost', 'costs', 'price', 'prices', 'pricing', 'hire', 'expert', 'experts', 'specialist', 'specialists', 'consultant', 'consultants', 'solution',
    'solutions', 'list', 'cheap', 'affordable', 'quote', 'near', 'me', 'online', 'free', 'reviews', 'review', 'what', 'how', 'why', 'which']);
  const BUYER_S = new Set([...BUYER_W].map(stem1));
  const containFit = (keyword, g, pages) => {
    const kt = uniq(ownToks(keyword).filter(t => !BUYER_S.has(t))); if (!kt.length || !g.topics.length) return null;
    const K = topicKit({ services: g.services, topics: g.topics }); const set = new Set(kt); const has = (p) => p.length && p.every(t => set.has(t));
    const ph = K.phr.filter(p => p.length >= 2 && has(p)).sort((a, b) => b.length - a.length)[0];
    if (ph) return { fit: 1, detail: '"' + ph.join(' ') + '" is one of your services' };
    const pr = K.prods.find(has) || (kt.find(t => K.cats.has(t)) ? [kt.find(t => K.cats.has(t))] : null);
    if (pr) return { fit: 0.85, detail: '"' + pr.join(' ') + '" is a product or category you sell' };
    const docs = K.phr.concat((Array.isArray(pages) ? pages : []).map(x => uniq(ownToks(S(x && (x.title || x.h1 || '')) + ' ' + pathTokens(S(x && x.url)).join(' ').replace(/-/g, ' ')))).filter(d => d.length));
    if (!docs.length) return null;
    const df = (t) => docs.filter(d => d.includes(t)).length; const Nd = docs.length;
    const w = (t) => { const f = df(t); return Math.log(1 + Nd / (1 + f)); };
    const tot = kt.reduce((x, t) => x + (df(t) ? w(t) : Math.log(1 + Nd)), 0); const got = kt.filter(t => df(t) > 0).reduce((x, t) => x + w(t), 0);
    return { fit: tot > 0 ? r3(got / tot) : 0, detail: kt.filter(t => df(t) > 0).length + ' of its ' + kt.length + ' own words are in your services or pages' }; };
  /** KI.fit(keyword, ctx, top10?) -> { fit, low, high, basis, detail }: the keyword's (and its results' titles') share of what the site sells,
   *  x the place match (a place in the market 1, no place fit_no_place). The gate stays the hard stop; this is the continuous part above it. */
  const fit = (keyword, ctx, topItems) => {
    const o = ctx || {}; const c = C(o.cfg); const g = gctx(o);
    let base = null, basis = 'inferred', detail = '';
    if (typeof fitEvidence === 'function' && g.topics.length) { const e = fitEvidence(S(keyword), g.topics, { services: g.services, market: g.market });
      if (e.verdict === 'in') base = num(e.share) == null ? 1 : clip(num(e.share), 0, 1); else if (e.verdict === 'out') base = num(e.share) == null ? 0 : clip(num(e.share), 0, 1); detail = ascii(e.detail || ''); }
    // FX-L H8 (REVIEW_LOGIC H8): the service phrase INSIDE a longer search counts ("peppol access point provider uae" for an e-invoicing /
    // Peppol service; the qualifier words must not dilute it): a service phrase of 2+ words contained = 1, a product or category the site
    // sells = 0.85, else an IDF-weighted share of the search's own words (buyer words left out) found in the site's services and page
    // titles (a word every service carries weighs little, a word no service or page carries weighs most). The highest reading counts.
    const cn = containFit(keyword, g, o.pages);
    if (cn && cn.fit != null && (base == null || cn.fit > base)) { base = cn.fit; basis = 'inferred'; detail = cn.detail; }
    let unknown = false;
    if (base == null) { base = c.fit_unknown; unknown = true; detail = detail || 'too little on file about what you sell to judge it'; }
    const titles = (Array.isArray(topItems) ? topItems : []).map(x => S(x && (x.title || x.t))).filter(Boolean).slice(0, 10);
    if (titles.length >= 3 && typeof fitEvidence === 'function' && g.topics.length) {
      const inn = titles.filter(t => fitEvidence(t, g.topics, { services: g.services, market: g.market }).verdict === 'in').length / titles.length;
      base = (1 - c.fit_title_weight) * base + c.fit_title_weight * inn;
    }
    let geo = 1;
    if (g.market && typeof fitMarket === 'function') { const m = fitMarket(S(keyword), g.market); geo = !m.ok ? 0 : (m.inside.length ? 1 : c.fit_no_place); }
    const f = clip(base * geo, 0, 1); const sp = unknown ? c.fit_spread * 1.5 : c.fit_spread;
    return { fit: r3(f), low: r3(clip(f - sp, 0, 1)), high: r3(clip(f + sp, 0, 1)), basis, unknown, geo, detail };
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // candidates (DESIGN 3.1-3.2)
  // ---------------------------------------------------------------------------------------------------------------------------------
  const SOURCES = ['gsc', 'paa', 'related', 'forum', 'autocomplete', 'labs_ideas', 'labs_suggestions', 'labs_related', 'competitor', 'gap', 'tracked', 'ladder', 'seed'];
  // independent evidence families for the demand floor: three Labs endpoints are one provider; our own lists are no evidence of demand
  // FX-L H7: People also ask, related searches and forum threads come from the SAME results page: one family, not three
  const FAMILY = { gsc: 'gsc', paa: 'serp_page', related: 'serp_page', forum: 'serp_page', autocomplete: 'autocomplete', labs_ideas: 'labs', labs_suggestions: 'labs', labs_related: 'labs', competitor: 'competitor', gap: 'competitor' };
  const families = (row) => uniq(((row && (Array.isArray(row.sources) ? row.sources : jparse(row.sources_json, []))) || []).map(s => FAMILY[S(isObj(s) ? s.source : s)]).filter(Boolean));
  /** KI.mergeCandidates(sourceLists) -> rows { keyword, kw_key, sources: [{ source, fetched_at, detail }], source_count, families, volume, volume_basis,
   *  volume_source, cpc, kd, gsc_impressions, gsc_clicks, gsc_position, gsc_page, labs_intent, aio }. sourceLists: { source: [rows | strings] } or
   *  [{ source, rows, fetched_at }]. Close variants merge on KI.key; the shown keyword is the first one met in SOURCES order. Sorted by kw_key. */
  const mergeCandidates = (lists) => {
    const groups = Array.isArray(lists) ? lists.map(g => ({ source: S(g && g.source), rows: (g && g.rows) || [], fetched_at: S(g && g.fetched_at) }))
      : Object.entries(lists || {}).map(([s, rows]) => ({ source: s, rows: rows || [], fetched_at: '' }));
    groups.sort((a, b) => (SOURCES.indexOf(a.source) < 0 ? 99 : SOURCES.indexOf(a.source)) - (SOURCES.indexOf(b.source) < 0 ? 99 : SOURCES.indexOf(b.source)) || a.source.localeCompare(b.source));
    const by = new Map();
    for (const g of groups) {
      if (!SOURCES.includes(g.source)) continue;
      for (const r0 of g.rows) {
        const r = isObj(r0) ? r0 : { keyword: r0 }; const kw = norm(r.keyword || r.query || r.question || r.suggestion || r.text); if (!kw) continue;
        const k = key(kw); const row = by.get(k) || { keyword: kw, kw_key: k, sources: [], volume: null, volume_basis: '', volume_source: '', cpc: null, kd: null,
          gsc_impressions: null, gsc_clicks: null, gsc_position: null, gsc_page: '', labs_intent: '', aio: null, trend: null };
        const fa = S(r.fetched_at || g.fetched_at);
        if (!row.sources.some(s => s.source === g.source)) row.sources.push({ source: g.source, fetched_at: fa, detail: ascii(S(r.detail || r.from || '')).slice(0, 120) });
        if (g.source === 'gsc') { const im = num(r.impressions), cl = num(r.clicks), po = num(r.position);
          if (im != null && (row.gsc_impressions == null || im > row.gsc_impressions)) { row.gsc_impressions = im; row.gsc_clicks = cl; row.gsc_position = po; row.gsc_page = S(r.page || r.url); } }
        const vol = num(r.volume != null ? r.volume : r.search_volume);
        if (vol != null && row.volume == null) { row.volume = vol; row.volume_basis = 'provider_estimate'; row.volume_source = S(r.volume_source || (/^labs/.test(g.source) || g.source === 'competitor' || g.source === 'gap' ? 'DataForSEO keyword data' : 'Google Ads')); }
        if (row.cpc == null && num(r.cpc) != null) row.cpc = num(r.cpc);
        if (row.kd == null && num(r.kd != null ? r.kd : r.keyword_difficulty) != null) row.kd = num(r.kd != null ? r.kd : r.keyword_difficulty);
        if (!row.labs_intent && S(r.intent || r.main_intent)) row.labs_intent = S(r.intent || r.main_intent).toLowerCase();
        if (row.aio == null && typeof r.aio === 'boolean') row.aio = r.aio;
        if (row.trend == null && r.trend) row.trend = r.trend;
        by.set(k, row);
      }
    }
    return [...by.values()].map(r => ({ ...r, source_count: r.sources.length, families: families(r) })).sort((a, b) => a.kw_key.localeCompare(b.kw_key));
  };
  /** KI.prescore(row, cfg) -> 0..100, the cheap order before money (DESIGN 3.2: fit is IN it, R1 #4): gated rows 0; Fit x a word-based stage
   *  weight x (0.5 demand proxy + 0.3 independent sources + 0.2 Search Console). Ties are broken by the caller on kw_key. */
  const prescore = (row, c0) => {
    const c = C(c0); const r = row || {};
    if (S(r.gate) === 'fail') return 0;
    const f = num(r.fit) == null ? c.fit_unknown : clip(num(r.fit), 0, 1);
    const st = r.stage && c.stage_weights[r.stage] != null ? r.stage : stage([], r.keyword, r.labs_intent, {}).stage;
    const sw = c.stage_weights[st];
    const im = num(r.gsc_impressions), vol = num(r.volume);
    const dem = clip(Math.log10(1 + (im != null ? im * c.demand.month_days / c.demand.gsc_days : vol != null ? vol : 0)) / Math.log10(1 + 1000), 0, 1);
    const fam = (Array.isArray(r.families) ? r.families : families(r)).length;
    const p = 100 * f * sw * (0.5 * dem + 0.3 * clip(fam / 3, 0, 1) + 0.2 * (im != null && im > 0 ? 1 : 0));
    return r1(p);
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // clustering (R4 6.3)
  // ---------------------------------------------------------------------------------------------------------------------------------
  const keysOf = (row, c) => { const t = Array.isArray(row.top10) ? row.top10 : jparse(row.top10_json, []);
    return uniq((Array.isArray(t) ? t : []).slice(0, c.cluster.top_n).map(x => (isObj(x) && x.exact === false && !x.url_partial) ? urlKey({ url: x.url, domain: x.host, url_exact: false }) : urlKey(isObj(x) ? (x.u ? { ...x, url: x.u } : (x.host && !x.domain ? { ...x, domain: x.host } : x)) : x)).filter(Boolean)); };
  /** KI.cluster(rows, cfg) -> rows (same order as given) with cluster_id, is_head, cluster_size, cluster_demand, hub_id, shared_with_head,
   *  borderline. Demand for ordering: row.click_demand, else KI.demand([row]).clicks. Head-based, no chaining; rows with fewer than
   *  min_urls known results are their own head (not compared). Deterministic: same rows in any order -> same ids. */
  const cluster = (rows, c0) => {
    const c = C(c0); const T = c.cluster.t_page, H = c.cluster.t_hub;
    const list = (Array.isArray(rows) ? rows : []).map((r, i) => { const kk = S(r.kw_key) || key(r.keyword);
      const d = num(r.click_demand) != null ? num(r.click_demand) : demand([r], c).clicks; return { i, r, kk, d: d || 0, keys: new Set(keysOf(r, c)) }; });
    const order = list.slice().sort((a, b) => b.d - a.d || a.kk.localeCompare(b.kk));
    const heads = []; const res = new Map();
    for (const e of order) {
      if (e.keys.size < c.cluster.min_urls) {
        // FX-L M5: identical results pages are never split, even when fewer than min_urls of their addresses are keyable
        const twin = e.keys.size ? heads.find(h => h.e.keys.size === e.keys.size && [...e.keys].every(k => h.e.keys.has(k))) : null;
        if (twin) { res.set(e.i, { cluster_id: twin.id, is_head: false, hub_id: '', shared_with_head: e.keys.size, borderline: false, compared: true }); continue; }
        const id = 'c_' + hash(e.kk); heads.push({ e, id, compared: false }); res.set(e.i, { cluster_id: id, is_head: true, hub_id: '', shared_with_head: null, borderline: false, compared: false }); continue; }
      let joined = null, hub = null, border = false;
      for (const h of heads) { if (!h.compared) continue; let n = 0; for (const k of e.keys) if (h.e.keys.has(k)) n++;
        if (n === T || n === T - 1) border = true;
        if (n >= T) { joined = { h, n }; break; } if (n >= H && !hub) hub = h; }
      if (joined) res.set(e.i, { cluster_id: joined.h.id, is_head: false, hub_id: '', shared_with_head: joined.n, borderline: joined.n === T, compared: true });
      else { const id = 'c_' + hash(e.kk); heads.push({ e, id, compared: true }); res.set(e.i, { cluster_id: id, is_head: true, hub_id: hub ? hub.id : '', shared_with_head: null, borderline: border, compared: true }); }
    }
    const size = {}, dem = {}; for (const e of list) { const id = res.get(e.i).cluster_id; size[id] = (size[id] || 0) + 1; dem[id] = (dem[id] || 0) + e.d; }
    return list.map(e => { const x = res.get(e.i); return { ...e.r, kw_key: e.kk, ...x, cluster_size: size[x.cluster_id], cluster_demand: r1(dem[x.cluster_id]) }; });
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // factors (R4 6.4)
  // ---------------------------------------------------------------------------------------------------------------------------------
  const ctrAt = (p, c) => { const n = Math.round(num(p) || 0); if (n >= 1 && n <= 10) return c.ctr[n - 1]; if (n <= 20 && n > 10) return c.ctr_p11_20; if (n <= 30 && n > 20) return c.ctr_p21_30; return 0; };
  /** KI.demand(cluster, cfg) -> { demand, low, high, clicks, basis, floor, note }: cluster = rows (or { members }). Click demand per month at
   *  p_star after the AI answer's loss; Search Console impressions (28 days, scaled to a month) beat provider volume; no volume anywhere but
   *  >= 2 independent sources -> the floor, "evidenced, volume not measured". */
  const demand = (cl, c0) => {
    const c = C(c0); const D = c.demand; const rows = Array.isArray(cl) ? cl : ((cl && (cl.members || cl.rows)) || (cl ? [cl] : []));
    let clicks = 0, lo = 0, hi = 0, any = false, measured = false, est = false, censored = false; let fams = new Set();
    const ctr = ctrAt(D.p_star, c);
    const keepOf = (st0) => { const st = c.aio_loss[st0] != null ? st0 : 'info'; return c.aio_loss[st]; };
    for (const r of rows) {
      if (!r) continue; families(r).forEach(f => fams.add(f)); (Array.isArray(r.families) ? r.families : []).forEach(f => fams.add(f));
      const loss = keepOf(r.stage);
      const aio = r.aio === true ? 1 : r.aio === false ? 0 : null;
      const im = num(r.gsc_impressions); const vol = num(r.volume); const gp = num(r.gsc_position);
      // FX-L H7 (REVIEW_LOGIC H7): Search Console impressions are the demand only where the site is seen (page 1-2, position <= 20); further
      // down they are censored by the site's own position (a result at #50 is rarely shown), so the larger of them and the provider's volume
      // counts; a measured 0 is a measured 0 (no floor)
      const imM = im != null && im > 0 ? im * D.month_days / D.gsc_days : null;
      let v = null, vlo = null, vhi = null;
      if (imM != null && (gp == null || gp <= (D.gsc_max_position || 20))) { v = imM; vlo = v; vhi = v; measured = true; }
      else if (imM != null && vol != null && vol > 0) { if (vol >= imM) { v = vol; vlo = Math.max(imM, vol * (1 - D.volume_spread)); vhi = vol * (1 + D.volume_spread); est = true; } else { v = imM; vlo = imM; vhi = imM * (1 + D.volume_spread); measured = true; censored = true; } }
      else if (imM != null) { v = imM; vlo = imM; vhi = imM * (D.censored_high || 3); measured = true; censored = true; }
      else if (vol != null && vol > 0) { v = vol; vlo = vol * (1 - D.volume_spread); vhi = vol * (1 + D.volume_spread); est = true; }
      else if (vol === 0) { v = 0; vlo = 0; vhi = 0; est = true; }
      if (v == null) continue; any = true;
      const keep = aio == null ? 1 - loss * 0.5 : 1 - loss * aio;
      const keepLo = aio == null ? 1 - loss : keep, keepHi = aio == null ? 1 : keep;
      clicks += v * ctr * keep; lo += vlo * ctr * (1 - D.ctr_spread) * keepLo; hi += vhi * ctr * (1 + D.ctr_spread) * keepHi;
    }
    const sc = (x) => clip(Math.log10(1 + x) / Math.log10(1 + D.d_ref), 0, 1);
    if (!any) {
      // FX-L H7: the floor is the demand of a SMALL measured volume (floor_volume, default 5 a month), so an unmeasured search can never
      // outrank a measured 10; its range runs from 0 to the demand of floor_volume_high (20)
      const ok = fams.size >= D.min_sources_for_floor;
      const fv = (x) => sc(x * ctr * (1 - c.aio_loss.info * 0.5));
      const fl = Math.min(D.floor, fv(D.floor_volume || 5)), fh = Math.min(D.floor_high, fv(D.floor_volume_high || 20));
      return ok ? { demand: r3(fl), low: 0, high: r3(fh), clicks: 0, basis: 'modelled', floor: true, note: 'evidenced, volume not measured (' + fams.size + ' independent sources)' }
        : { demand: 0, low: 0, high: r3(fl), clicks: 0, basis: 'modelled', floor: false, note: 'no volume and fewer than ' + D.min_sources_for_floor + ' independent sources' };
    }
    return { demand: r3(sc(clicks)), low: r3(sc(lo)), high: r3(sc(hi)), clicks: r1(clicks), basis: 'modelled', floor: false,
      note: measured ? (censored ? 'from your Search Console impressions (a lower bound: your page is beyond page two)' : est ? 'from your Search Console impressions and provider volume' : 'from your Search Console impressions') : 'from provider volume (an estimate)' };
  };
  const existingRank = (p, c) => { const n = num(p); if (n == null || n <= 0) return 0; for (const b of c.existing_rank) if (n <= b.max) return b.v; return 0; };
  /** KI.win(row, site, cfg) -> { win, low, high, strength, existing_rank, topical, weak_spots, position, position_basis, parts (text) }
   *  row: { keyword, gsc_position, gsc_impressions, position (a SERP reading), top10, strength?, topical? }
   *  site: { domain, refdomains, rank, queries: [{ query, impressions, position }] } */
  const win = (row, site, c0) => {
    const c = C(c0); const r = row || {}; const s = site || {}; const own = validHost(s.domain || s.own_domain);
    const items = Array.isArray(r.top10) ? r.top10 : jparse(r.top10_json, []);
    // ExistingRank: Search Console first, then the reading of the results page (host only, so a recovered url still counts)
    let pos = null, pbasis = '';
    if (num(r.gsc_position) != null && num(r.gsc_position) > 0) { pos = num(r.gsc_position); pbasis = 'measured'; }
    else if (num(r.position) != null && num(r.position) > 0) { pos = num(r.position); pbasis = 'measured'; }
    else if (own) { const hit = (items || []).find(x => { const h = hostOf(x.u ? { ...x, url: x.u } : (x.host && !x.domain ? { ...x, domain: x.host } : x)); return h && (h === own || reg(h) === reg(own)); });
      if (hit) { pos = num(hit.pos) || num(hit.rank_group) || num(hit.position); pbasis = 'measured'; } }
    const er = existingRank(pos, c);
    // Strength: the site's referring domains (or rank) against the median of the top 10, log ratio
    let st = null, stLo = null, stHi = null, stBasis = 'modelled';
    if (num(r.strength) != null) { st = clip(num(r.strength), 0, 1); stLo = clip(st - 0.1, 0, 1); stHi = clip(st + 0.1, 0, 1); stBasis = S(r.strength_basis) || 'modelled'; }
    else if (num(s.refdomains) != null && num(r.market_refdomains_median) != null && !(items || []).some(x => num(x.refdomains) != null) && num(r.top10_refdomains_median) == null) {
      // FX-L 2026-11-10: no results page read for this search, but the client's referring domains and the median of the results pages read in this
      // market are known: Strength is read against the market, with a wider range (+/- 0.2) than against its own page
      st = clip(0.5 + 0.5 * Math.log10((1 + num(s.refdomains)) / (1 + num(r.market_refdomains_median))) / Math.log10(c.strength_span), 0, 1); stLo = clip(st - 0.2, 0, 1); stHi = clip(st + 0.2, 0, 1); stBasis = 'modelled'; }
    else {
      const med = (vals) => { const v = vals.filter(x => x != null).sort((a, b) => a - b); return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; };
      const pair = num(s.refdomains) != null ? [num(s.refdomains), num(r.top10_refdomains_median) != null ? num(r.top10_refdomains_median) : med((items || []).map(x => num(x.refdomains)))]
        : num(s.rank) != null ? [num(s.rank), num(r.top10_rank_median) != null ? num(r.top10_rank_median) : med((items || []).map(x => num(x.rank)))] : [null, null];
      if (pair[0] != null && pair[1] != null) { st = clip(0.5 + 0.5 * Math.log10((1 + pair[0]) / (1 + pair[1])) / Math.log10(c.strength_span), 0, 1); stLo = clip(st - 0.1, 0, 1); stHi = clip(st + 0.1, 0, 1); stBasis = 'modelled'; }
    }
    const stUnknown = st == null;
    // FX-L H2 / M1: an unknown Strength is the middle with its whole plausible span (never a constant presented as a judgement); a page the
    // site already has in the top 10 / top 20 is itself evidence that it is not weaker than most of these results
    if (stUnknown) { st = c.strength_unknown; stLo = clip(st - c.strength_unknown_spread, 0, 1); stHi = clip(st + c.strength_unknown_spread, 0, 1);
      if (pos != null && pos <= 10) stLo = Math.max(stLo, 0.5); else if (pos != null && pos <= 20) stLo = Math.max(stLo, 0.4); st = Math.max(st, stLo); }
    // Topical: the site's own ranking queries on this topic (Search Console)
    let tp = null;
    if (num(r.topical) != null) tp = clip(num(r.topical), 0, 1);
    else { const kt = ownToks(r.keyword); const need = Math.max(1, Math.ceil(kt.length / 2));
      const qs = (Array.isArray(s.queries) ? s.queries : []).filter(q => q && num(q.impressions) > 0 && num(q.position) != null && num(q.position) <= c.topical_max_position)
        .filter(q => { const qt = new Set(ownToks(q.query || q.keyword)); return kt.length && kt.filter(t => qt.has(t)).length >= need; });
      tp = kt.length ? clip(uniq(qs.map(q => key(q.query || q.keyword))).length / c.topical_ref, 0, 1) : 0; }
    // WeakSpots: the share of the top 10 that is thin, stale, off-intent, forum / UGC (hire / compare only) or low authority
    const W = c.weak; const nowMs = c.now ? Date.parse(c.now) : NaN; const stg = S(r.stage);
    const onIntent = { hire: ['provider', 'directory', 'list'], compare: ['list', 'directory', 'provider'], solution: ['vendor', 'provider', 'guide', 'list'], problem: ['guide', 'news', 'government', 'provider'], info: ['guide', 'news', 'video', 'government'] }[stg] || null;
    const it2 = (items || []).filter(x => x && (x.host || x.domain || x.url));
    const weakOne = (x) => { const ty = S(x.type);
      if ((stg === 'hire' || stg === 'compare') && ty === 'forum') return true;
      if (num(x.words) != null && num(x.words) < W.thin_words) return true;
      const d = Date.parse(S(x.date || x.updated || x.timestamp)); if (Number.isFinite(nowMs) && Number.isFinite(d) && nowMs - d > W.stale_days * 864e5) return true;
      if (onIntent && ty && !onIntent.includes(ty) && ty !== 'other') return true;
      if (num(x.rank) != null && num(x.rank) < W.low_rank) return true; if (num(x.refdomains) != null && num(x.refdomains) < W.low_refdomains) return true;
      return false; };
    const ws = it2.length ? it2.filter(weakOne).length / it2.length : 0;
    const ww = c.win_weights;
    const core = (sv) => ww.strength * sv + ww.existing_rank * er + ww.topical * tp + ww.weak_spots * ws;
    const w = clip(core(st), 0, 1);
    // FX-L M1: the range is what is not measured (Strength's span), not a constant: a measured Strength keeps its own +/- 0.1
    const lo = clip(Math.min(core(stLo), w), 0, 1), hi = clip(Math.max(core(stHi), w), 0, 1);
    const parts = [];
    parts.push(pos != null ? 'you are at position ' + Math.round(pos) + (pbasis === 'measured' && num(r.gsc_position) != null ? ' (your Search Console)' : '') : 'you do not rank for it yet');
    parts.push(stUnknown ? 'your strength against these results is not measured yet' : 'strength ' + Math.round(st * 100) + '% against the top results (referring domains)');
    if (tp > 0) parts.push('your site already ranks for related searches');
    if (ws > 0) parts.push(Math.round(ws * it2.length) + ' of the top ' + it2.length + ' results are weak spots');
    return { win: r3(w), low: r3(lo), high: r3(hi), strength: r3(st), strength_known: !stUnknown, existing_rank: er, topical: r3(tp), weak_spots: r3(ws), position: pos, position_basis: pbasis, parts };
  };
  /** KI.value(row, site, cfg) -> { value, low, high, basis }: the owner's value for the matching service, else CPC on a log scale, else 0.5 */
  const value = (row, site, c0) => {
    const c = C(c0); const r = row || {}; const sv = (site && site.service_values) || {};
    const kt = new Set(ownToks(r.keyword));
    for (const [svc, v] of Object.entries(sv).sort((a, b) => a[0].localeCompare(b[0]))) { const st = ownToks(svc); if (num(v) != null && st.length && st.every(t => kt.has(t))) { const x = clip(num(v), 0, 1); return { value: x, low: x, high: x, basis: 'measured', source: 'owner' }; } }
    const cpc = num(r.cpc);
    // FX-L L2: a CPC of 0 is "no advertiser data", not a value of 0 (it scored below an unknown CPC)
    if (cpc != null && cpc > 0) { const x = clip(Math.log10(1 + cpc) / Math.log10(1 + c.value.cpc_ref), 0, 1); return { value: r3(x), low: r3(x), high: r3(x), basis: 'provider_estimate', source: 'cpc' }; }
    const m = c.value.missing; return { value: m, low: clip(m - c.value.missing_spread, 0, 1), high: clip(m + c.value.missing_spread, 0, 1), basis: 'modelled', source: 'none' };
  };
  /** KI.gap(row, chosen, cfg) -> { gap, competitors: [{ domain, position }] }: the share of the chosen competitors in the top 10 (+0.5 when one is cited in AI answers for it) */
  const gapFactor = (row, chosen, c0) => {
    const c = C(c0); const r = row || {}; const ch = uniq((Array.isArray(chosen) ? chosen : []).map(d => reg(validHost(isObj(d) ? d.comp_domain || d.domain : d) || '')).filter(Boolean));
    if (!ch.length) return { gap: 0, competitors: [] };
    const items = Array.isArray(r.top10) ? r.top10 : jparse(r.top10_json, []);
    const seen = new Map(); for (const x of (items || [])) { const h = hostOf(x.u ? { ...x, url: x.u } : (x.host && !x.domain ? { ...x, domain: x.host } : x)); if (!h) continue; const R = reg(h);
      const ps = num(x.pos) || num(x.rank_group) || num(x.position); if (ps != null && ps > c.gaps.top) continue;   // FX-L M4: the top 10 only
      if (ch.includes(R) && !seen.has(R)) seen.set(R, ps); }
    const ai = (Array.isArray(r.ai_cited) ? r.ai_cited : []).map(d => reg(validHost(d) || '')).some(d => ch.includes(d));
    return { gap: r3(clip(seen.size / ch.length + (ai ? c.gap_ai_bonus : 0), 0, 1)), competitors: [...seen.entries()].map(([domain, position]) => ({ domain, position })) };
  };
  const fnum = (x, d) => { if (isObj(x)) return num(x.demand != null ? x.demand : x.win != null ? x.win : x.value != null ? x.value : x.gap != null ? x.gap : x.fit); return num(x) == null ? d : num(x); };
  const rng = (row, k, v) => { const rr = (row && row._ranges && row._ranges[k]) || (row && isObj(row[k]) ? [row[k].low, row[k].high] : null) || [num(row && row[k + '_low']), num(row && row[k + '_high'])];
    const lo = num(rr[0]), hi = num(rr[1]); return [lo == null ? v : Math.min(lo, v), hi == null ? v : Math.max(hi, v)]; };
  /** KI.score(row, cfg) -> { score, low, high, mid, factors: { gate, fit, stageW, demand, win, value, gap }, low_confidence, reason }
   *  row: { gate, fit, stage, demand, win, value, gap } (numbers, or the objects KI.demand / KI.win / KI.value / KI.fit return) with optional
   *  ranges (_ranges: { demand: [lo, hi], ... } or demand_low / demand_high). Gated -> 0, 0, 0 with the reason. */
  const score = (row, c0) => {
    const c = C(c0); const r = row || {};
    const f = clip(fnum(r.fit, c.fit_unknown), 0, 1); const lowFit = f < c.fit_gate; const g = S(r.gate) === 'fail' || lowFit ? 0 : 1;
    const sw = c.stage_weights[S(r.stage)] != null ? c.stage_weights[S(r.stage)] : c.stage_weights.info;
    const d = clip(fnum(r.demand, 0), 0, 1), w = clip(fnum(r.win, 0), 0, 1), v = clip(fnum(r.value, c.value.missing), 0, 1), gp = clip(fnum(r.gap, 0), 0, 1);
    const W = c.score_weights;
    const at = (ff, dd, wi, vv) => 100 * g * ff * sw * (W.demand * dd + W.win * wi + W.value * vv + W.gap * gp);
    const s = at(f, d, w, v);
    const [fl, fh] = rng(r, 'fit', f), [dl, dh] = rng(r, 'demand', d), [wl0, wh0] = rng(r, 'win', w), [vl, vh] = rng(r, 'value', v);
    // FX-L M1: a Win object carries its own range (Strength's span); only a bare number is printed +/- win_spread
    const winRanged = isObj(r.win) && num(r.win.low) != null && num(r.win.high) != null;
    const wl = winRanged ? wl0 : Math.min(wl0, clip(w - c.win_spread, 0, 1)), wh = winRanged ? wh0 : Math.max(wh0, clip(w + c.win_spread, 0, 1));
    const lo = at(clip(fl, 0, 1), clip(dl, 0, 1), wl, clip(vl, 0, 1)), hi = at(clip(fh, 0, 1), clip(dh, 0, 1), wh, clip(vh, 0, 1));
    const out = { score: r1(s), low: r1(Math.min(lo, s)), high: r1(Math.max(hi, s)), factors: { gate: g, fit: r3(f), stageW: sw, demand: r3(d), win: r3(w), value: r3(v), gap: r3(gp) },
      reason: g ? '' : (S(r.gate) === 'fail' ? S(r.gate_reason) : 'low_fit') };
    out.mid = r1((out.low + out.high) / 2); out.low_confidence = (out.high - out.low) > c.low_confidence_range;
    return out;
  };
  /** KI.verdict(row) -> go | months | hard | gated: from the Win factor only (no model types a verdict, R1 #7) */
  const verdict = (row, c0) => { const c = C(c0); const r = row || {}; if (S(r.gate) === 'fail') return 'gated';
    if (fnum(r.fit, null) != null && fnum(r.fit, null) < c.fit_gate) return 'gated';
    // FX-L H2 / L8: no Win is "not judged yet", never Hard; a Win read with an unknown Strength is judged only when both ends of its
    // range give the same word
    const w = fnum(r.win, null); if (w == null || !Number.isFinite(w)) return 'unknown';
    const word = (x) => x >= c.verdict.go ? 'go' : x >= c.verdict.months ? 'months' : 'hard';
    if (isObj(r.win) && r.win.strength_known === false && num(r.win.low) != null && num(r.win.high) != null && word(num(r.win.low)) !== word(num(r.win.high))) return 'unknown';
    return word(w); };
  const VERDICT_WORDS = { go: 'Go', months: 'Takes a few months', hard: 'Hard for your website now', gated: 'Not for you', unknown: 'Not judged yet' };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // competitors (R4 6.1 #2, #6)
  // ---------------------------------------------------------------------------------------------------------------------------------
  /** KI.sizeTag(client, comp, cfg) -> peer | leader | smaller | out_of_reach | unknown, from { keywords, refdomains } of both sides */
  const sizeTag = (client, comp, c0) => {
    const c = C(c0); const a = client || {}, b = comp || {};
    const rk = num(a.keywords) != null && num(b.keywords) != null ? (num(b.keywords) + 1) / (num(a.keywords) + 1) : null;
    const rr = num(a.refdomains) != null && num(b.refdomains) != null ? (num(b.refdomains) + 1) / (num(a.refdomains) + 1) : null;
    if (rk == null && rr == null) return 'unknown';
    if (rk != null && rr != null && rk > c.size.out_kw && rr > c.size.out_rd) return 'out_of_reach';
    const m = Math.max(rk == null ? 0 : rk, rr == null ? 0 : rr), n = Math.min(rk == null ? Infinity : rk, rr == null ? Infinity : rr);
    if (m > c.size.leader) return 'leader';
    if (n < c.size.smaller && m < 1) return 'smaller';
    return 'peer';
  };
  /** KI.scoreCompetitors(domains, seeds, cfg) -> rows (sorted: scored first by score, then serp_share, then domain)
   *  domains: [{ domain, class, class_basis, class_confidence, topic_sim, geo_match, ai_share, declared, status, keywords, refdomains }] or
   *           strings; empty = every host on the seeds, classified with cfg.ctx (KI.classifyDomain).
   *  seeds: [{ keyword, top10: [items], demand?: click demand weight, stage?: 'hire' ... }]
   *  SERPshare(d) = sum_k w_k x CTR(pos_dk) / sum_k w_k x CTR(1), w_k = demand x stage weight. Only direct / adjacent are scored. */
  const scoreCompetitors = (domains, seeds, c0) => {
    const c = C(c0); const ctx = (c0 && c0.ctx) || c.ctx || {}; const W = c.comp_weights;
    const sd = (Array.isArray(seeds) ? seeds : []).filter(s => s && S(s.keyword)).map(s => ({ keyword: norm(s.keyword), w: Math.max(0, num(s.demand) == null ? 1 : num(s.demand)) * (c.stage_weights[S(s.stage)] != null ? c.stage_weights[S(s.stage)] : 1), items: Array.isArray(s.top10) ? s.top10 : jparse(s.top10_json, []) }));
    // FX-L M3: the share is over the seeds whose results page was READ (an unread seed is not "absent"), and says how many were not read
    const readSd = sd.filter(s => (s.items || []).length > 0); const unread = sd.length - readSd.length;
    const denom = readSd.reduce((x, s) => x + s.w * c.ctr[0], 0);
    const best = new Map();   // reg -> Map(seed index -> { pos, url })
    sd.forEach((s, si) => { for (const [i, x0] of (s.items || []).entries()) { const x = x0 && x0.u ? { ...x0, url: x0.u } : (x0 && x0.host && !x0.domain ? { ...x0, domain: x0.host } : x0); const h = hostOf(x); if (!h) continue;
      const R = reg(h); const pos = num(x.pos) || num(x.rank_group) || num(x.position) || (i + 1); if (pos > c.cluster.top_n) continue;
      const m = best.get(R) || new Map(); const prev = m.get(si); if (!prev || pos < prev.pos) m.set(si, { pos, url: S(x.url), exact: x.url_exact !== false, title: S(x.title), type: S(x.type) }); best.set(R, m); } });
    let list = (Array.isArray(domains) ? domains : []).map(d => isObj(d) ? d : { domain: d }).filter(d => S(d.domain || d.comp_domain));
    if (!list.length) list = [...best.keys()].sort().map(d => ({ domain: d }));
    const read = readSd.length; const minSeeds = read >= 3 ? c.comp_min_seeds : 1;
    const rows = []; const seenD = new Set();
    for (const d0 of list) {
      const vh = validHost(d0.domain || d0.comp_domain); if (!vh) continue; const R = reg(vh); if (seenD.has(R)) continue; seenD.add(R);
      const m = best.get(R) || new Map();
      const apps = [...m.entries()].sort((a, b) => a[0] - b[0]).map(([si, v]) => ({ keyword: sd[si].keyword, position: v.pos, url: v.url, title: v.title, type: v.type }));
      let cls = d0.class, cb = d0.class_basis, cc = num(d0.class_confidence), reasons0 = [];
      let ts = num(d0.topic_sim), gm = num(d0.geo_match);
      if (!CLASS_IDS.includes(cls)) { const k = classifyDomain(R, { ...ctx, appearances: apps, cfg: c }); if (!k.store) continue; cls = k.class; cb = k.basis; cc = k.confidence; reasons0 = k.reasons;
        if (ts == null && num(k.topic_sim) != null) ts = num(k.topic_sim); if (gm == null && num(k.geo_match) != null) gm = num(k.geo_match); }
      const credit = [...m.entries()].reduce((x, [si, v]) => x + sd[si].w * ctrAt(v.pos, c), 0);
      const ss = denom > 0 ? clip(credit / denom, 0, 1) : 0;
      const scored = (cls === 'direct' || cls === 'adjacent') && !(ts != null && ts === 0);   // FX-L B2: nothing of its own matches your services -> not counted
      const aiS = num(d0.ai_share);
      const tsU = ts == null, gmU = gm == null;
      const T = tsU ? 0.5 : clip(ts, 0, 1), G = gmU ? 0.5 : clip(gm, 0, 1), A = aiS == null ? 0 : clip(aiS, 0, 1);
      const sc = (t, g, a) => 100 * (W.serp_share * ss + W.topic_sim * t + W.geo_match * g + W.ai_share * a);
      const sp = c.comp_spread;
      const s = scored ? sc(T, G, A) : null;
      const lo = scored ? sc(clip(T - (tsU ? 0.5 : sp), 0, 1), clip(G - (gmU ? 0.5 : 0), 0, 1), aiS == null ? 0 : A) : null;
      const hi = scored ? sc(clip(T + (tsU ? 0.5 : sp), 0, 1), clip(G + (gmU ? 0.5 : 0), 0, 1), aiS == null ? 0.25 : A) : null;
      const enough = m.size >= minSeeds || !!d0.declared;
      const reasons = [];
      const unreadTxt = unread ? ' (' + unread + ' not read)' : '';
      if (read) reasons.push(m.size ? 'in the top 10 for ' + m.size + ' of ' + read + ' of your service searches read' + unreadTxt + (S(c.market_name || ctx.market_name) ? ' in ' + ascii(c.market_name || ctx.market_name) : '') : 'not in the top 10 of the ' + read + ' service searches read' + unreadTxt);
      if (d0.declared) reasons.push('declared by you');
      if (scored && !enough) reasons.push('seen on too few of your searches to count yet');
      reasons.push(...reasons0.map(ascii));
      rows.push({ comp_domain: R, class: cls, class_basis: cb || 'rule', class_confidence: cc == null ? null : r2(cc), scored: scored && enough,
        score: scored && enough ? r1(s) : null, score_low: scored && enough ? r1(lo) : null, score_high: scored && enough ? r1(hi) : null,
        serp_share: r3(ss), topic_sim: tsU ? null : r3(T), geo_match: gmU ? null : r3(G), ai_share: aiS == null ? null : r3(A),
        size_tag: sizeTag(c.client || ctx.client || {}, { keywords: d0.keywords, refdomains: d0.refdomains }, c),
        seeds_seen: m.size, seeds_total: read, seeds_unread: unread, reasons, evidence: apps.slice(0, c.caps.evidence).map(a => ({ seed: a.keyword, position: a.position, url: a.url })),
        declared: !!d0.declared, status: S(d0.status) || (d0.declared ? 'chosen' : 'candidate'), status_by: S(d0.status_by) || (d0.declared ? 'declared' : 'auto') });
    }
    rows.sort((a, b) => (b.score == null ? -1 : b.score) - (a.score == null ? -1 : a.score) || b.serp_share - a.serp_share || a.comp_domain.localeCompare(b.comp_domain));
    return rows;
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // striking distance, page action, gaps, plan
  // ---------------------------------------------------------------------------------------------------------------------------------
  /** KI.striking(row, site, cfg) -> bool: Search Console position 8-20 with >= 100 impressions in 28 days (>= 30 for a small site) */
  const strikingBar = (total, c0) => { const c = C(c0); const t = num(total); const Z = c.striking;
    return t == null || !(t > 0) ? Z.impressions : clip(Math.round(t / (Z.site_divisor || 300)), Z.floor == null ? 20 : Z.floor, Z.impressions); };
  const striking = (row, site, c0) => { const c = C(c0); const r = row || {}; const p = num(r.gsc_position), im = num(r.gsc_impressions);
    if (p == null || im == null) return false;
    return p >= c.striking.min && p <= c.striking.max && im >= strikingBar((site || {}).total_impressions, c); };
  /** KI.pageAction(cluster, site, cfg) -> { action: new | refresh | list | none, page_url, reason, list_hosts, cannibal: [urls] }
   *  cluster: { keyword | head, members: [rows], top10 } (or a head row with top10); site: { domain, model (SM), pages: [{ url, title }], queries } */
  const pageAction = (cl, site, c0) => {
    const c = C(c0); const k = cl || {}; const s = site || {}; const own = validHost(s.domain || s.own_domain);
    const members = Array.isArray(k.members) && k.members.length ? k.members : [k];
    const head = S(k.keyword || k.head || (members[0] || {}).keyword);
    if (S(k.gate) === 'fail' || S(k.verdict) === 'gated') return { action: 'none', page_url: '', reason: 'not for you', list_hosts: [], cannibal: [] };
    const items = (Array.isArray(k.top10) ? k.top10 : jparse(k.top10_json, [])) || [];
    const typed = items.map(x => (x && PAGE_TYPES.includes(S(x.type))) ? x : { ...x, type: pageType(x && x.u ? { ...x, url: x.u } : x, { own_domain: own }) }).filter(x => x && x.type);
    const lists = typed.filter(x => x.type === 'list' || x.type === 'directory');
    // pages of the site that earn impressions for any member (Search Console): two different pages = cannibalisation
    const gp = uniq(members.map(m => S(m.gsc_page)).filter(Boolean).concat((Array.isArray(s.queries) ? s.queries : []).filter(q => q && S(q.page) && num(q.impressions) > 0 && members.some(m => key(m.keyword) === key(q.query))).map(q => S(q.page))));
    const gpKeys = uniq(gp.map(u => urlKey(u) || u));
    const cannibal = gpKeys.length >= 2 ? gp.slice(0, 5) : [];
    const ownItem = own ? typed.find(x => { const h = hostOf(x.u ? { ...x, url: x.u } : (x.host && !x.domain ? { ...x, domain: x.host } : x)); return h && (h === own || reg(h) === reg(own)); }) : null;
    let match = '';
    if (typeof SM === 'object' && SM && s.model && typeof SM.matchPage === 'function') { try { const m = SM.matchPage(s.model, head); match = m ? S(m.url) : ''; } catch (e) { match = ''; } }
    if (!match && Array.isArray(s.pages)) { const kt = ownToks(head); const need = Math.max(2, Math.ceil(kt.length * 0.75));
      const best = s.pages.map(p => { const pt = new Set(ownToks(S(p.title) + ' ' + pathTokens(S(p.url)).join(' ').replace(/-/g, ' '))); return { url: S(p.url), n: kt.filter(t => pt.has(t)).length }; })
        .filter(p => p.url && p.n >= Math.min(need, kt.length) && kt.length).sort((a, b) => b.n - a.n || a.url.localeCompare(b.url))[0];
      match = best ? best.url : ''; }
    // FX-L L5: for a buyer stage (hire / compare / solution) the page is a service page when one exists; a blog post is flagged
    const cand = uniq(gp.concat(ownItem && ownItem.exact !== false ? [S(ownItem.url)] : [], match ? [match] : []).filter(Boolean));
    const isBlog = (u) => GUIDE_P.test('/' + pathTokens(u).join('/'));
    const buyer = ['hire', 'compare', 'solution'].includes(S(k.stage || (members[0] || {}).stage));
    let page = (buyer ? (cand.find(u => !isBlog(u)) || cand[0]) : cand[0]) || '';
    const blogNote = buyer && page && isBlog(page) ? ' (it is a blog post: people searching this want a service page)' : '';
    // KI-ONEURL (2026-11-11, the ladder rules LRU, v5/code/_ladder_rules.js): a "-2" / "-copy" variant of a live page is never the page to work
    // on (the original is), and an address another search already holds (a ladder page, or a stronger cluster of this run) is not taken
    // again unless this page already ranks for this search; then it gets its own page. The same search may always improve its own page.
    let note = '', shared = false, blocked = null;
    const LR = (typeof LRU === 'object' && LRU) ? LRU : null;
    const known = (Array.isArray(s.pages) ? s.pages : []).map(x => ({ url: S(x && x.url), title: S(x && x.title) })).filter(x => x.url);
    if (LR && page) { const orig = LR.copyOf(page, known);
      if (orig) { const abs = /^https?:\/\//i.test(orig) ? orig : ('https://' + LR.urlKey(orig)); note = ' (' + LR.pathOf(page) + ' is a copy of ' + LR.pathOf(abs) + ': improve the original, and redirect the copy to it)'; page = abs; } }
    if (LR && page) { const mine = members.map(m => S(m.keyword)).filter(Boolean);
      const o = LR.ownerOf(page, head, s.owners || [], mine);
      if (o) { const qs = (Array.isArray(s.queries) ? s.queries : []).filter(q => q && LR.urlKey(q.page) === LR.urlKey(page)).map(q => ({ query: q.query, impressions: q.impressions, position: q.position }));
        const ranks = mine.some(kw => LR.ranksFor(page, kw, { pages: [{ url: page, queries: qs }] }));
        const holder = o.by === 'ladder' ? 'your keyword ladder for "' + S(o.keyword) + '"' : 'the stronger search "' + S(o.keyword) + '"';
        // a ladder page for a buyer's search and this buyer's search are one page (a second would compete with it); otherwise its own page
        const sameKind = o.by === 'ladder' && LR.isCommercial(LR.stageOf(S(o.keyword))) && LR.isCommercial(S(k.stage || (members[0] || {}).stage));
        if (ranks) { shared = true; note = ' (that page already ranks for it, so it stays there; it also serves ' + holder + ': one page leads, the other searches link to it)'; }
        else if (sameKind) { shared = true; note = ' (that page is ' + holder + ', a search of the same kind: work this search into it as a section, not a second page that would compete with it)'; }
        else { blocked = { reason: 'your page ' + LR.pathOf(page) + ' already belongs to ' + holder + ': one search, one page, so this search needs a page of its own', owner: S(o.keyword) }; page = ''; } } }
    if (typed.length && lists.length / typed.length >= c.page_action.list_share)
      return { action: 'list', page_url: page, reason: lists.length + ' of the top ' + typed.length + ' results are lists or directories: get onto them' + (page ? ' (and keep your page)' : '') + (blocked ? ' (' + blocked.reason + ')' : note),
        list_hosts: uniq(lists.map(x => hostOf(x.u ? { ...x, url: x.u } : (x.host && !x.domain ? { ...x, domain: x.host } : x))).filter(Boolean)).slice(0, 10), cannibal };
    if (blocked) return { action: 'new', page_url: '', reason: blocked.reason, list_hosts: [], cannibal, owner: blocked.owner };
    if ((gp.length || ownItem) && page) return { action: 'refresh', page_url: page, reason: 'your site already ranks for it' + blogNote + note, list_hosts: [], cannibal, shared };
    if (match && page) return { action: 'refresh', page_url: page, reason: 'your site has a page for it' + blogNote + note, list_hosts: [], cannibal, shared };
    if (gp.length || ownItem) return { action: 'new', page_url: '', reason: 'your site shows for it, but the page could not be identified: a page of its own answers it', list_hosts: [], cannibal };   // FX-L L6: no refresh without a target
    return { action: 'new', page_url: '', reason: 'no page of yours answers it', list_hosts: [], cannibal };
  };
  const credits = (kind, c) => { const usd = num((c.credits.usd || {})[kind]) || 0; if (!(usd > 0)) return 0;
    return Math.max(1, Math.ceil(Math.round(usd * c.credits.markup / c.credits.credit_value_usd * 100) / 100 - 1e-9)); };
  const GAP_ACTION = { missing: 'new_page', untapped: 'new_page', weak: 'refresh', striking: 'refresh', strong: 'defend', topic: 'new_page', page_type: 'new_page', ai_answer: 'pitch', listing: 'list', backlink: 'link' };
  /** KI.gaps(client, chosen, keywordRows, extra) -> gap rows as stored (seo_ki_gaps; JSON columns as strings)
   *  client: { site_id, domain, market, run_id, now }; chosen: [domains]; keywordRows: rows with top10 + client position (gsc_position or
   *  position, or the client in top10) + page_action / cluster_id; extra: { topics, page_types, ai_answers, listings, backlinks, sample: { n, m } } */
  const gaps = (client, chosen, keywordRows, extra, c0) => {
    const c = C(c0); const cl = client || {}; const own = validHost(cl.domain); const G = c.gaps; const x = extra || {};
    const ch = uniq((Array.isArray(chosen) ? chosen : []).map(d => reg(validHost(isObj(d) ? d.comp_domain || d.domain : d) || '')).filter(Boolean));
    const out = []; const seen = new Set(); let unread = 0;
    const sample = isObj(x.sample) && num(x.sample.n) != null && num(x.sample.m) != null && num(x.sample.n) < num(x.sample.m) ? 'sample of ' + num(x.sample.n) + ' of ' + num(x.sample.m) : '';
    const push = (type, kw, o) => { const id = 'g_' + type + '_' + hash([cl.domain, cl.market, type, key(kw), S(o.target)].join('|'));
      if (seen.has(id)) return; seen.add(id);
      const action = o.action || GAP_ACTION[type];
      out.push({ gap_id: id, site_id: S(cl.site_id), domain: S(cl.domain), market: S(cl.market), type, keyword: norm(kw), cluster_id: S(o.cluster_id),
        competitor_domains_json: JSON.stringify(uniq(o.comps || []).slice(0, 10)), client_position: o.pos == null ? null : o.pos, evidence_json: JSON.stringify(o.evidence || []).slice(0, 4000),
        sample_note: o.sample != null ? o.sample : '', action, action_target: S(o.target), credits: credits(action, c), status: 'open', run_id: S(cl.run_id), created_at: S(cl.now || c.now), updated_at: S(cl.now || c.now) }); };
    for (const r of (Array.isArray(keywordRows) ? keywordRows : [])) {
      if (!r || S(r.gate) === 'fail') continue;
      const items = (Array.isArray(r.top10) ? r.top10 : jparse(r.top10_json, [])) || [];
      const inTop = new Map(); let ownPos = null;
      for (const [i, it0] of items.entries()) { const it = it0 && it0.u ? { ...it0, url: it0.u } : (it0 && it0.host && !it0.domain ? { ...it0, domain: it0.host } : it0); const h = hostOf(it); if (!h) continue;
        const p = num(it.pos) || num(it.rank_group) || num(it.position) || (i + 1); if (p > G.top) continue; const R = reg(h);
        if (own && (R === reg(own))) { if (ownPos == null || p < ownPos) ownPos = p; continue; }
        if (ch.includes(R) && !inTop.has(R)) inTop.set(R, p); }
      const pos = num(r.gsc_position) != null ? num(r.gsc_position) : num(r.position) != null ? num(r.position) : ownPos;
      const comps = [...inTop.keys()]; const ev = [...inTop.entries()].map(([d, p]) => ({ domain: d, position: p }));
      // FX-L H6: "missing" / "untapped" need the client MEASURED absent: a known position over 100, or the provider's intersection (it
      // excludes the client's pages), or a results page read with the client not on it while the site's Search Console reading is complete
      // and has no row for it. An unknown position is "not read", never "not in the top 100".
      const srcs = (Array.isArray(r.sources) ? r.sources : jparse(r.sources_json, [])) || [];
      const fromGap = srcs.some(x => S(isObj(x) ? x.source : x) === 'gap');
      const known = pos != null || fromGap || (!!r.serp_read && cl.gsc_complete === true && num(r.gsc_impressions) == null);
      if (!known) { if (comps.length) unread++; continue; }
      const absent = pos == null || pos > G.absent_over;
      const sNote = fromGap ? sample : '';   // FX-L L7: "sample of N of M" is about the provider's intersection only
      const listAct = S(r.page_action) === 'list' ? 'list' : '';
      if (striking(r, cl, c)) push('striking', r.keyword, { pos, comps, evidence: ev, cluster_id: r.cluster_id, target: S(r.gsc_page || r.page_url), action: 'refresh', sample: '' });
      else if (comps.length >= G.missing_min && absent) push('missing', r.keyword, { pos, comps, evidence: ev, cluster_id: r.cluster_id, action: listAct || 'new_page', target: '', sample: sNote });
      else if (comps.length === 1 && absent) push('untapped', r.keyword, { pos, comps, evidence: ev, cluster_id: r.cluster_id, action: listAct || 'new_page', sample: sNote });
      else if (comps.length >= 1 && pos != null && pos >= G.weak_min && pos <= G.weak_max) push('weak', r.keyword, { pos, comps, evidence: ev, cluster_id: r.cluster_id, action: S(r.page_url) ? 'refresh' : (listAct || 'new_page'), target: S(r.page_url), sample: '' });
      else if (pos != null && pos <= G.strong_max && comps.length >= 1) push('strong', r.keyword, { pos, comps, evidence: ev, cluster_id: r.cluster_id, action: 'defend', target: S(r.page_url || r.gsc_page), sample: '' });
    }
    for (const t of (x.topics || [])) if (t && num(t.competitor_pages) >= 2 && !t.client_page) push('topic', t.keyword || t.head, { comps: t.competitors || [], cluster_id: t.cluster_id, evidence: t.evidence || [] });
    for (const t of (x.page_types || [])) if (t && (t.competitors || []).length && !t.client_has) push('page_type', t.keyword || t.service, { comps: t.competitors, evidence: [{ page_type: S(t.type) }], target: S(t.type) });
    for (const t of (x.ai_answers || [])) if (t && (t.competitors || []).some(d => ch.includes(reg(validHost(d) || ''))) && !t.client_named) push('ai_answer', t.keyword || t.question, { comps: t.competitors, evidence: [{ question: ascii(t.question || '').slice(0, 200) }] });
    for (const t of (x.listings || [])) { const h = validHost(t && t.domain); if (h && (t.lists_competitors || []).length && !t.lists_client) push('listing', t.keyword || '', { comps: t.lists_competitors, evidence: [{ list: h }], target: h, action: 'list' }); }
    for (const t of (x.backlinks || [])) { const h = validHost(t && t.domain); if (h && (t.links_to || []).filter(d => ch.includes(reg(validHost(d) || ''))).length >= 2 && !t.links_client) push('backlink', '', { comps: t.links_to, evidence: [{ referring_domain: h }], target: h, action: 'link' }); }
    const sorted = out.sort((a, b) => a.type.localeCompare(b.type) || a.keyword.localeCompare(b.keyword) || a.gap_id.localeCompare(b.gap_id));
    return sorted;
  };
  /** KI.gapsUnread(...same args) -> how many keyword rows with a competitor in the top 10 were left out because the client's position was not read */
  const gapsUnread = (client, chosen, keywordRows, cfg0) => { const c = C(cfg0); const own = validHost((client || {}).domain);
    const ch = uniq((Array.isArray(chosen) ? chosen : []).map(d => reg(validHost(isObj(d) ? d.comp_domain || d.domain : d) || '')).filter(Boolean)); let n = 0;
    for (const r of (Array.isArray(keywordRows) ? keywordRows : [])) { if (!r || S(r.gate) === 'fail') continue; const items = (Array.isArray(r.top10) ? r.top10 : jparse(r.top10_json, [])) || [];
      let ownSeen = false, comp = false; for (const it0 of items) { const it = it0 && it0.host && !it0.domain ? { ...it0, domain: it0.host } : it0; const h = hostOf(it); if (!h) continue; const p = num(it.pos) || 99; if (p > c.gaps.top) continue;
        if (own && reg(h) === reg(own)) ownSeen = true; else if (ch.includes(reg(h))) comp = true; }
      const srcs = (Array.isArray(r.sources) ? r.sources : jparse(r.sources_json, [])) || []; const fromGap = srcs.some(x => S(isObj(x) ? x.source : x) === 'gap');
      const pos = num(r.gsc_position) != null ? num(r.gsc_position) : num(r.position);
      if (comp && !ownSeen && pos == null && !fromGap && !(r.serp_read && (client || {}).gsc_complete === true && num(r.gsc_impressions) == null)) n++; }
    return n; };
  const KIND_TITLE = { refresh: (k) => 'Improve your page for "' + k + '"', new_page: (k) => 'Write a page for "' + k + '"', list: (k) => 'Get onto the lists that rank for "' + k + '"',
    pitch: (k) => 'Get named in AI answers for "' + k + '"', link: (k) => 'Ask ' + k + ' for a link', defend: (k) => 'Keep your place for "' + k + '"' };
  const STAGE_WHY = { hire: 'people searching it are looking to hire', compare: 'people searching it are comparing providers', solution: 'people searching it are looking for a solution',
    problem: 'people searching it have a problem to solve', info: 'people searching it are learning about the topic' };
  /** KI.plan(clusters, gaps, cfg) -> <= 10 actions { action_id, kind, title, why, target, credits, cluster_id | gap_id, ev }, ranked by expected value
   *  clusters: head rows { keyword, cluster_id, score (number or KI.score object), verdict, stage, page_action, page_url, gsc_position,
   *  gsc_impressions, striking, cluster_size, demand_note }; gaps: KI.gaps rows. Plain ASCII words. */
  const plan = (clusters, gapRows, c0) => {
    const c = C(c0); const P = c.plan; const acts = []; const byCluster = new Set();
    for (const h of (Array.isArray(clusters) ? clusters : [])) {
      if (!h || S(h.gate) === 'fail' || S(h.verdict) === 'gated') continue;
      const sc = isObj(h.score) ? h.score : { score: num(h.score), mid: num(h.score_mid) != null ? num(h.score_mid) : num(h.score_low) != null && num(h.score_high) != null ? (num(h.score_low) + num(h.score_high)) / 2 : num(h.score) };
      const mid = num(sc.mid) != null ? num(sc.mid) : num(sc.score); if (!(mid > 0)) continue;
      const pa = S(h.page_action); const kind = pa === 'list' ? 'list' : pa === 'refresh' ? 'refresh' : pa === 'none' ? '' : 'new_page'; if (!kind) continue;
      const v = VERDICT_WORDS[S(h.verdict)] ? S(h.verdict) : 'unknown'; const ev = mid * (P.kind_mult[kind] || 1) * (P.verdict_mult[v] != null ? P.verdict_mult[v] : 0.4) * (h.striking ? 1.2 : 1);
      const kw = norm(h.keyword);
      const why = [];
      if (h.striking && num(h.gsc_position) != null) why.push('your page is at position ' + Math.round(num(h.gsc_position)) + ' in your Search Console' + (num(h.gsc_impressions) != null ? ' with ' + Math.round(num(h.gsc_impressions)) + ' impressions in 28 days' : '') + ', a few places from page one');
      else if (num(h.gsc_position) != null) why.push('you are at position ' + Math.round(num(h.gsc_position)) + ' in your Search Console');
      if (STAGE_WHY[S(h.stage)]) why.push(STAGE_WHY[S(h.stage)]);
      if (kind === 'list') why.push('the results page is mostly lists and directories, so a listing reaches these buyers sooner than a new page');
      if (num(h.cluster_size) > 1) why.push('one page can answer ' + num(h.cluster_size) + ' searches that Google treats as the same');
      if (S(h.demand_note)) why.push(S(h.demand_note));
      why.push('verdict: ' + VERDICT_WORDS[v] + ', score ' + Math.round(mid) + (num(sc.low) != null && num(sc.high) != null ? ' (' + Math.round(num(sc.low)) + '-' + Math.round(num(sc.high)) + ')' : ''));
      const target = kind === 'refresh' ? S(h.page_url) : kind === 'list' ? (Array.isArray(h.list_hosts) ? h.list_hosts.slice(0, 5).join(', ') : '') : kw;
      acts.push({ action_id: 'a_' + hash('c|' + S(h.cluster_id || key(kw)) + '|' + kind), kind, title: ascii(KIND_TITLE[kind](kw)), why: ascii(why.join('; ').replace(/^./, m => m.toUpperCase()) + '.'),
        target: ascii(target), credits: credits(kind, c), cluster_id: S(h.cluster_id), ev: r1(ev) });
      if (h.cluster_id) byCluster.add(S(h.cluster_id));
    }
    for (const g of (Array.isArray(gapRows) ? gapRows : [])) {
      if (!g || S(g.status) === 'dismissed' || S(g.status) === 'done') continue;
      if (g.cluster_id && byCluster.has(S(g.cluster_id))) continue;
      const base = P.gap_ev[S(g.type)]; if (base == null) continue;
      const comps = jparse(g.competitor_domains_json, []) || []; const kind = S(g.action) === 'new_page' ? 'new_page' : S(g.action);
      if (!KIND_TITLE[kind]) continue;
      const ev = base * (P.kind_mult[kind] || 1) * (1 + Math.min(4, comps.length) * 0.1);
      const subj = kind === 'link' ? S(g.action_target) : (S(g.keyword) || S(g.action_target));
      const why = { listing: 'this list or directory ranks for your service searches and names ' + comps.length + ' of your competitors, not you',
        ai_answer: 'AI answers for this question name ' + comps.slice(0, 3).join(', ') + ' and not you', backlink: 'this site links to ' + comps.length + ' of your competitors and not to you',
        page_type: 'your competitors have a ' + S(g.action_target) + ' page for this service and you do not', topic: 'at least two of your competitors rank with a page on this topic and you have none' }[S(g.type)] || '';
      acts.push({ action_id: 'a_' + hash('g|' + S(g.gap_id)), kind, title: ascii(KIND_TITLE[kind](subj)), why: ascii((why.replace(/^./, m => m.toUpperCase()) + '.' + (S(g.sample_note) ? ' (' + S(g.sample_note) + ')' : ''))),
        target: ascii(S(g.action_target)), credits: credits(kind, c), gap_id: S(g.gap_id), ev: r1(ev) });
    }
    const seenT = new Set();
    return acts.sort((a, b) => b.ev - a.ev || a.title.localeCompare(b.title) || a.action_id.localeCompare(b.action_id))
      .filter(a => !(a.kind === 'refresh' && !S(a.target)))   // FX-L L6: an "Improve your page" with no page is not an action
      .filter(a => { const k = a.kind === 'refresh' ? 'refresh|' + (urlKey(S(a.target)) || S(a.target)) : a.kind + '|' + a.title; if (seenT.has(k)) return false; seenT.add(k); return true; }).slice(0, c.caps.plan);
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // the read path and the labels
  // ---------------------------------------------------------------------------------------------------------------------------------
  /** KI.readable(row, ctx) -> bool: the ONE read gate for every consumer (CONTRACTS section 2). Fails closed: false unless ctx.killed is
   *  exactly false and ctx.mode is 'on'; a keyword row that is gated (or fails the fit gate again with ctx.fit, a gate ctx) is never read;
   *  a competitor row is read only with a valid host that is not a search engine, the site itself or a dismissed row. */
  const readable = (row, ctx) => {
    const o = ctx || {}; const r = row || {};
    if (o.killed !== false) return false;
    if (S(o.mode).toLowerCase() !== 'on') return false;
    if (r.comp_domain != null) { if (S(r.status) === 'dismissed') return false; const k = classifyDomain(S(r.comp_domain), { own_domain: o.own_domain || r.domain, services: [], cfg: o.cfg });
      return !!k.valid && k.reject !== 'search_engine' && k.reject !== 'own_site' && CLASS_IDS.includes(S(r.class)); }
    if (S(r.gate) !== 'pass') return false;
    if (o.fit && S(r.keyword)) { const g = gate(r.keyword, o.fit); if (g.gate !== 'pass') return false; }
    return true;
  };
  const LABELS = { measured: 'measured', provider_estimate: 'estimate from <source>', modelled: 'our estimate', inferred: 'our reading of the results' };
  /** KI.label(basis, source?, fetched_at?) -> { basis, text, date }: one of measured / provider_estimate / modelled / inferred, with the words
   *  the app shows (app/shared/src/ki.ts KI_BASIS / kiBasisLabel); anything else -> { basis: 'none', text: 'not available' } */
  const label = (basis, source, fetchedAt) => { const b = S(basis); const d = S(fetchedAt).slice(0, 10);
    if (!LABELS[b]) return { basis: 'none', text: 'not available', date: '' };
    const t = b === 'provider_estimate' ? 'estimate from ' + (ascii(source) || 'our data provider') : LABELS[b];
    return { basis: b, text: t + (d && (b === 'measured' || b === 'provider_estimate') ? ' on ' + d : ''), date: d }; };

  return { VERSION, CONFIG, cfg, norm, key, services, validHost, reg, hostOf, urlKey, classifyDomain, CLASS_IDS, PAGE_TYPES, pageType, top10, stage,
    gate, fit, GATE_TEXT, mergeCandidates, families, prescore, cluster, demand, win, value, gap: gapFactor, score, verdict, VERDICT_WORDS, sizeTag,
    scoreCompetitors, striking, strikingBar, pageAction, gaps, gapsUnread, plan, readable, label, ascii, hash, topicSim, brandDomains };
})();
// ---- KIW (E2, 2026-11-08, docs/keyword-intel-2026-11-08/DESIGN.md §2-§5, §7 + CONTRACTS.md §1-§5): the KI worker's input / output kit ----
// Everything SEOagentKIntel1 does around the analysis kit KI (v5/code/_ki.js, E1): the market, the seeds, the DataForSEO requests (one shape
// per endpoint, the fields R5_DATAFORSEO.md §13 confirmed live), the ki:* cache rows with their lifetimes, the answers read back, the four
// tables' rows (exactly their columns), the sections of a partial run and the callback bodies (CONTRACTS.md §4, app/shared/src/ki.ts).
// Rules it keeps:
//   * money: a request is built only when no stored answer is young enough (KIW.fresh, the TTLs of KI.CONFIG); every request carries its
//     priced estimate (KIW.price) so the plan can be held under the quote; the SERP day cache (SC, serp:*) is read first and costs 0;
//   * evidence: an answer that could not be read twice (`__dfs.unavailable`, the in-200 gate) makes its section `missing` with the reason,
//     never "no demand" / "no competitors"; the later steps go on with what exists;
//   * untrusted text: a competitor's homepage and AI answers are DATA - only words are counted from them, nothing in them is followed;
//   * hosts by regex (the n8n sandbox has no URL constructor); search engines and text fragments are never stored as competitors (R3 #9).
const KIW = (() => {
  const RULE = 'ki-1';
  const S = (x) => (x == null ? '' : String(x));
  const T = (x) => S(x).trim();
  const N = (x) => { if (x === null || x === undefined || x === '') return null; const v = Number(x); return Number.isFinite(v) ? v : null; };
  const J = (x, d) => { if (x && typeof x === 'object') return x; try { const v = JSON.parse(S(x) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const r4 = (v) => Math.round((Number(v) || 0) * 10000) / 10000;
  const r6 = (v) => Math.round((Number(v) || 0) * 1e6) / 1e6;
  const uniq = (a) => a.filter((x, i) => x && a.indexOf(x) === i);
  const BASE = 'https://api.dataforseo.com/v3/';
  // the price of one request (R5 §1-§7 + §13 C1-C11, measured to the 6th decimal on the live answers): Labs $0.012 + $0.00012 a row,
  // Backlinks $0.024 + $0.000036 a row, a live SERP of depth 10 $0.002, autocomplete $0.002, Google Ads volume $0.09 a task
  const PRICE = { serp10: 0.002, serp_std: 0.0006, labs: 0.012, labs_row: 0.00012, bl: 0.024, bl_row: 0.000036, ac: 0.002, ads: 0.09 };
  const QUOTE = {"competitors": 0.35, "keyword_research": 0.9};   // the per-run search-data estimate the app quotes (v5/code/_cost_cal.js DFS_EST), baked by build_ki.py
  const CFG0 = (typeof KI === 'object' && KI && KI.CONFIG) || {};
  // the lifetimes are KI.CONFIG.ttl_days (serp 1, ranked_keywords 7, volume 30, backlinks 7, homepage 14, competitors 30); discovery lists are volume data
  const TTL_NAME = { serp: 'serp', ranked: 'ranked_keywords', volume: 'volume', backlinks: 'backlinks', homepage: 'homepage', discovery: 'volume', competitors: 'competitors' };
  const ttlOf = (k) => { const t = CFG0.ttl_days || {}; return N(t[TTL_NAME[k] || k]) || ({ serp: 1, ranked: 7, volume: 30, backlinks: 7, homepage: 14, discovery: 30 })[k] || 7; };
  const CAPS = { seeds: 20, gsc_seeds: 50, serp_depth: 10, sc_limit: 50, size_targets: 30, cd_limit: 20, cd_min_ranked: 50, cd_rivals: 1,
    rk_limit: 300, chosen_max: 5, home_reads: 8, sitemaps: 5, autocomplete: 10, ideas_limit: 300, sugg_n: 2, sugg_limit: 200, related_n: 1,
    related_limit: 150, pi_limit: 500, pi_rank: 10, top_n: 300, top_m: 60, tp_urls: 60, overview_max: 700, intent_max: 1000, ads_max: 1000,
    home_bytes: 400000, fetch_timeout_ms: 15000, rd_targets: 300,
    ...((CFG0.caps && typeof CFG0.caps === 'object') ? CFG0.caps : {}) };
  // ---- hosts and words ----
  const host = (u) => S(u).toLowerCase().trim().replace(/^https?:\/\//, '').replace(/[\/?#\s].*$/, '').replace(/:\d+$/, '').replace(/^www\./, '').replace(/\.$/, '');
  const HOSTRE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
  // a public host only: no IP literal, no localhost / internal names (the SSRF guard every fetched address passes, as Normalize Input's domainOk)
  // FX-L (REVIEW_PERF_SAFETY H2): also no wildcard-DNS names that resolve to any address you write in them (nip.io, sslip.io ...), no names
  // with an IP inside, no cloud metadata names, no credentials
  const WILDCARD_DNS = /(^|\.)(nip\.io|sslip\.io|xip\.io|traefik\.me|localtest\.me|lvh\.me|vcap\.me|lacolhost\.com|fbi\.com|localhost\.run|ngrok\.io|ngrok-free\.app|1u\.ms|rbndr\.us|burpcollaborator\.net|oastify\.com|interact\.sh)$/;
  const publicHost = (h0) => { if (/@/.test(S(h0).replace(/^https?:\/\//i, '').replace(/[\/?#].*$/, ''))) return false; const h = host(h0); if (!h || h.length > 253 || /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.includes(':')) return false;
    if (/(^|\.)(localhost|local|internal|localdomain|home|lan|corp|intranet|test|example|invalid|arpa|metadata)$/.test(h) || /(^|\.)metadata\.google\.internal$/.test(h) || WILDCARD_DNS.test(h)) return false;
    if (/(^|[.-])(\d{1,3})[.-](\d{1,3})[.-](\d{1,3})[.-](\d{1,3})([.-]|$)/.test(h)) return false; return HOSTRE.test(h); };
  // one redirect hop, checked by us (the HTTP nodes follow none): https only, a public host, the SAME registrable domain as the address
  // asked (apex <-> www, http -> https), no credentials. Anything else is not followed.
  const regOf = (h) => (typeof KI === 'object' && KI && KI.reg) ? KI.reg(host(h)) : host(h).split('.').slice(-2).join('.');
  const hopOf = (askedUrl, answer) => { const a = answer || {}; const code = N(a.statusCode); if (!code || code < 300 || code >= 400) return '';
    const hd = a.headers || {}; let loc = S(hd.location || hd.Location || '').trim(); if (!loc) return '';
    const base = S(askedUrl).match(/^(https?:\/\/[^\/?#]+)/i); if (/^\/(?!\/)/.test(loc) && base) loc = base[1] + loc;
    if (!/^https:\/\/[^\s\/?#@]+(?:[\/?#]\S*)?$/i.test(loc)) return '';
    const h = host(loc); if (!publicHost(h) || regOf(h) !== regOf(host(askedUrl))) return ''; return loc.slice(0, 500); };
  // the text of an HTML page, linear time (no backtracking regex over a page of unclosed tags): script / style / noscript / svg blocks out,
  // tags out, entities out, capped at max characters of the input
  const htmlText = (html, max) => { const src = S(html).slice(0, max || 400000); const low = src.toLowerCase(); let out = '', i = 0;
    const SKIP = ['script', 'style', 'noscript', 'svg'];
    while (i < src.length) { const lt = low.indexOf('<', i); if (lt < 0) { out += src.slice(i); break; } out += src.slice(i, lt) + ' ';
      const tag = SKIP.find(t => low.startsWith('<' + t, lt) && /[\s>\/]/.test(low.charAt(lt + t.length + 1) || '>'));
      if (tag) { const end = low.indexOf('</' + tag, lt + 1); if (end < 0) break; const gt = low.indexOf('>', end); i = gt < 0 ? src.length : gt + 1; continue; }
      const gt = low.indexOf('>', lt + 1); if (gt < 0) break; i = gt + 1; }
    return out.replace(/&[a-z#0-9]{1,10};/gi, ' ').replace(/\s+/g, ' ').trim(); };
  const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia)\.[a-z.]{2,6}$/;
  const isBusinessHost = (h0, client) => { const h = host(h0); return publicHost(h) && !SEARCH.test(h) && h !== host(client); };
  const normKw = (k) => { let s = S(k); try { s = s.normalize('NFKC'); } catch (e) {} return s.toLowerCase().replace(/\s+/g, ' ').trim(); };
  const keyOf = (k) => (typeof KI === 'object' && KI && typeof KI.key === 'function') ? KI.key(k) : normKw(k);
  const hash = (s) => { let h1 = 0x811c9dc5, h2 = 0x7fffffff; const t = S(s); for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = (Math.imul(h2 + c, 2654435761) ^ (h2 >>> 13)) >>> 0; }
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8); };
  // ---- the market (CONTRACTS §3): the site's main country; a different country in the request is refused ----
  const PLACES = { AE: { word: 'uae', cities: ['dubai', 'abu dhabi'] }, SA: { word: 'saudi arabia', cities: ['riyadh', 'jeddah'] }, GB: { word: 'uk', cities: ['london'] },
    US: { word: 'usa', cities: [] }, PK: { word: 'pakistan', cities: ['lahore', 'karachi'] }, IN: { word: 'india', cities: ['bangalore', 'mumbai'] }, SG: { word: 'singapore', cities: [] },
    CA: { word: 'canada', cities: ['toronto'] }, AU: { word: 'australia', cities: ['sydney'] }, DE: { word: 'deutschland', cities: ['berlin'] } };
  const countryOf = (raw, COUNTRIES) => { const r = T(raw); if (!r) return null; const C = COUNTRIES || {};
    const name = Object.keys(C).find(n => n.toLowerCase() === r.toLowerCase()) || Object.keys(C).find(n => S(C[n].iso).toUpperCase() === r.toUpperCase());
    return name ? { name, ...C[name] } : null; };
  const market = (reqCountry, site, COUNTRIES) => {
    const req = countryOf(reqCountry, COUNTRIES); const s = site || {};
    const siteC = countryOf(s.country, COUNTRIES) || (N(s.location_code) ? (() => { const n = Object.keys(COUNTRIES || {}).find(k => COUNTRIES[k].code === N(s.location_code)); return n ? { name: n, ...COUNTRIES[n] } : null; })() : null);
    if (siteC && req && siteC.code !== req.code) return { ok: false, reason: 'market_mismatch', detail: 'this website is measured in ' + siteC.name + '; the request asked for ' + req.name, site_country: siteC.name, asked: req.name };
    const c = siteC || req;
    if (!c) return { ok: false, reason: 'no_market', detail: 'no country is on file for this website and the request named none we know' };
    const lang = T(s.language_code) && siteC ? T(s.language_code).toLowerCase() : c.lang;
    return { ok: true, country: c.name, iso: c.iso, location_code: c.code, language_code: lang, market: c.iso + '-' + lang, from: siteC ? 'site' : 'request' };
  };
  // ---- the services as a list (R3 #4: services_json holds fragments of one sentence) ----
  const PRODUCTS = /\b(microsoft dynamics 365|dynamics 365|business central|finance (?:and|&) operations|dynamics crm|power bi|power platform|copilot studio|sap(?: b1| business one)?|odoo|netsuite|salesforce|zoho|open ?edx|moodle|hubspot|peppol|oracle|sage)\b/i;
  const shortService = (s) => { let t = normKw(s).replace(/\([^)]*\)/g, ' ').replace(/[–—]/g, '-');
    t = t.split(/[:;,]|\s-\s|\bin the\b|\bin\b(?= (?:the )?(?:uae|gcc|dubai|middle east|region|saudi|pakistan))|\bfor\b|\bwith\b|\bacross\b/)[0].trim();
    const w0 = t.split(' ').filter(Boolean); while (w0.length && /^(and|or|the|a|an|we|provide|offer|our|of|to)$/.test(w0[0])) w0.shift();
    const w = w0.slice(0, 5); while (w.length && /^(and|or|the|a|an|of|to|in|for|&)$/.test(w[w.length - 1])) w.pop();
    const out = w.join(' ').replace(/[^\p{L}\p{N}&+.# -]+/gu, ' ').replace(/\s+/g, ' ').trim(); return out.length >= 3 && out.split(' ').length >= 1 ? out : ''; };
  // the services as the confirmed LIST (KI.services: JSON arrays parsed, a sentence never cut), and their short forms for the seeds
  // FX-L B1: every distinct service is kept (devaicon's "Open edX Services" was item 21 of 30 and a cap of 16 cut it); the list is RANKED by
  // evidence - declared by the client, the impressions of the site's own Search Console queries that contain it, a page of the site named
  // for it - and only then capped (60), never cut by position
  const services = (site, req, gsc, pages) => { const s = site || {}; const k = (v) => (typeof KI === 'object' && KI.services) ? KI.services(v) : J(v, []).map(S);
    const declared = k(s.declared_services); const all = []; const seen = new Set();
    for (const x of [...declared, ...k(s.services_json), ...k(S((req || {}).business).split(/[\n;]+/).map(T).filter(x => x.length > 2 && x.length < 160))]) { const kk = keyOf(x); if (!kk || seen.has(kk)) continue; seen.add(kk); all.push(x); }
    const dk = new Set(declared.map(keyOf)); const tok = (x) => keyOf(x).split(' ').filter(t => t.length > 1);
    const ev = (x) => { const t = tok(x); if (!t.length) return 0; const has = (q) => { const qt = new Set(keyOf(q).split(' ')); return t.every(w => qt.has(w)); };
      const imp = (gsc || []).filter(q => has(q.query || q.keyword)).reduce((a, q) => a + (N(q.impressions) || 0), 0);
      const pg = (pages || []).some(p => has(S(p.title) + ' ' + S(p.url).replace(/[\/_-]+/g, ' '))) ? 1 : 0;
      return (dk.has(keyOf(x)) ? 3 : 0) + Math.log10(1 + imp) + pg; };
    return all.map((x, i) => ({ x, i, e: ev(x) })).sort((a, b) => b.e - a.e || a.i - b.i).slice(0, 60).map(o => o.x); };
  const GENERIC1 = /^(services?|solutions?|support|consulting|implementation|development|software|systems?|cloud|automation|it|ai)$/i;
  const seedServices = (svc) => uniq((svc || []).map(x => normKw(x).replace(/[^\p{L}\p{N}&+#. -]+/gu, ' ').replace(/\s+/g, ' ').trim())
    .filter(x => x && x.split(' ').length <= 5 && !GENERIC1.test(x) && !/[.:;!?()]/.test(x.replace(/\b\d+\.\d+\b/g, '')))).slice(0, 12);
  const productsOf = (svc) => uniq((svc || []).map(x => { const m = S(x).match(PRODUCTS); return m ? m[1].toLowerCase() : ''; }));
  // ---- the run plan's seeds (DESIGN §2.1): services x market, GSC, tracked, ladder heads, the request's own; fit-gated, capped ----
  // FX-L H1 (REVIEW_LOGIC H1): the seeds are balanced by evidence inside the cap instead of filled by service phrasings: the request's own
  // (<= 6), the top non-brand Search Console queries (<= 6), tracked keywords and ladder heads (<= 4), then the services x the market (<= 2
  // phrasings each, round robin, so every service gets its turn before any gets a second), then products. A seed must be a plausible
  // search: no punctuation inside, 2-6 words, never a single generic word.
  const plausible = (kw, maxW) => { const w = kw.split(' ').filter(Boolean); if (w.length < 2 || w.length > (maxW || 6)) return false; if (/[.,:;!?()\[\]"]/.test(kw.replace(/\b\d+\.\d+\b/g, ''))) return false; return true; };
  const compSeeds = (o) => {
    const P = PLACES[o.iso] || { word: S(o.country).toLowerCase(), cities: [] }; const city = T(o.city).toLowerCase() || P.cities[0] || P.word;
    const cap = CAPS.seeds; const Q = { seed: 6, gsc: 6, tracked: 4 };
    const kept = [], refused = [], seenK = new Set(), waiting = new Set();
    const take = (k, src, w, quota) => { const kw = normKw(k); if (!kw) return false; const kk = keyOf(kw); if (seenK.has(kk)) return false;
      const maxW = src === 'service' ? 6 : 8;   // a phrase we build from a service: 6 words; a search people typed (Search Console, tracked, ladder, the request): 8
      if (!plausible(kw, maxW)) { refused.push({ keyword: kw, reason: 'not_a_search', detail: 'not a plausible search (punctuation, or under 2 / over ' + maxW + ' words)' }); seenK.add(kk); return false; }
      const g = o.gate ? o.gate(kw) : { gate: 'pass' };
      if (g.gate !== 'pass') { refused.push({ keyword: kw, reason: g.reason, detail: g.text || g.detail }); seenK.add(kk); return false; }
      if (kept.length >= cap || (quota != null && kept.filter(x => x.source === src || (src === 'tracked' && x.source === 'ladder') || (src === 'ladder' && x.source === 'tracked')).length >= quota)) { waiting.add(kk); return false; }
      seenK.add(kk); waiting.delete(kk); kept.push({ keyword: kw, source: src, weight: w }); return true; };
    for (const s0 of (o.seeds || [])) take(s0, 'seed', 1, Q.seed);
    // a Search Console seed needs a few impressions (a query seen once is noise); a service seed needs two words unless it names a product
    const gscOk = (o.gsc || []).slice(0, CAPS.gsc_seeds).filter(q => (N(q.impressions) || 0) >= (CAPS.gsc_seed_min_impr || 3));
    for (const q of gscOk) take(q.query, 'gsc', Math.min(1, 0.4 + Math.log10(1 + (N(q.impressions) || 0)) / 5), Q.gsc);
    for (const k of (o.tracked || [])) take(k, 'tracked', 0.8, Q.tracked);
    for (const k of (o.ladders || [])) take(k, 'ladder', 0.8, Q.tracked);
    const svc = (o.services || []).filter(x => S(x).trim().split(/\s+/).length >= 2 || PRODUCTS.test(S(x))).slice(0, 12); const prods = (o.products || []).slice(0, 3);
    const phr = [(x) => x + ' ' + P.word, (x) => x + ' company ' + city];
    for (let r = 0; r < phr.length && kept.length < cap; r++) for (const x of svc) { if (kept.length >= cap) break; take(phr[r](x), 'service', r ? 0.9 : 1, null); }
    for (const p0 of prods) if (kept.length < cap) take(p0 + ' partner ' + P.word, 'service', 1, null);
    // what is left of the cap goes to the remaining Search Console queries
    for (const q of gscOk) if (kept.length < cap) take(q.query, 'gsc', Math.min(1, 0.4 + Math.log10(1 + (N(q.impressions) || 0)) / 5), null);
    return { seeds: kept.slice(0, cap), refused, dropped: waiting.size };
  };
  // FX-L (REVIEW_PERF_SAFETY M2): the discovery and overlap bundles are keyed on the seeds that do not change week to week (the request's own
  // and the service phrases), never on the weekly Search Console reading, so a repeat inside the 30-day lifetime is free
  const seedHash = (seeds) => hash((seeds || []).filter(x => x && (x.source === 'seed' || x.source === 'service')).map(x => x.keyword).sort().join('|') || 'none');
  // ---- requests (one shape per endpoint; the fields R5 §13 confirmed live) ----
  const req = (call, path, task, est, meta) => ({ ki_call: call, endpoint: BASE + path, body: [task], est_usd: r6(est), ...(meta || {}) });
  const loc = (m) => ({ location_code: m.location_code, language_code: m.language_code });
  const serpBody = (kw, m) => ({ keyword: normKw(kw), ...loc(m), device: 'desktop', depth: CAPS.serp_depth });   // no load_async_ai_overview: it doubles the price (R5 §13 C1)
  const rq = {
    serp: (kw, m) => req('serp', 'serp/google/organic/live/advanced', serpBody(kw, m), PRICE.serp10, { keyword: normKw(kw) }),
    // QUEUE (2026-11-11): the normal-priority queue (priority 1) is the only reading that still gives Google's exact page addresses (live and
    // high priority return every result as a google.com/goto redirect since 2026-10-30; probe on production 2026-11-11: 10 of 10 normal tasks
    // ready in 86-118 s with 0 redirects, 10 of 10 high tasks ready in 18-36 s with every result a redirect). $0.0006 a page, collected free
    // by task id (taskGet). The tag carries the keyword so an answer is matched back even if the order changes.
    serpPost: (kw, m) => req('serp_post', 'serp/google/organic/task_post', { ...serpBody(kw, m), priority: 1, tag: normKw(kw).slice(0, 255) }, PRICE.serp_std, { keyword: normKw(kw) }),
    serpCompetitors: (kws, m) => req('serp_competitors', 'dataforseo_labs/google/serp_competitors/live', { keywords: kws.slice(0, 200), ...loc(m), include_subdomains: true, limit: CAPS.sc_limit }, PRICE.labs + CAPS.sc_limit * PRICE.labs_row),
    trafficTargets: (targets, m, call) => req(call || 'bulk_te', 'dataforseo_labs/google/bulk_traffic_estimation/live', { targets: targets.slice(0, 1000), ...loc(m), item_types: ['organic'] }, PRICE.labs + targets.length * PRICE.labs_row),
    refDomains: (targets) => req('bulk_rd', 'backlinks/bulk_referring_domains/live', { targets: targets.slice(0, 1000) }, PRICE.bl + targets.length * PRICE.bl_row),
    competitorsDomain: (d, m) => req('cd:' + host(d), 'dataforseo_labs/google/competitors_domain/live', { target: host(d), ...loc(m), exclude_top_domains: false, max_rank_group: 20, limit: CAPS.cd_limit }, PRICE.labs + CAPS.cd_limit * PRICE.labs_row, { target: host(d) }),
    ranked: (d, m) => req('rk:' + host(d), 'dataforseo_labs/google/ranked_keywords/live', { target: host(d), ...loc(m), item_types: ['organic'], limit: CAPS.rk_limit,
      order_by: ['ranked_serp_element.serp_item.etv,desc'], filters: [['ranked_serp_element.serp_item.rank_group', '<=', 20]] }, PRICE.labs + CAPS.rk_limit * PRICE.labs_row, { target: host(d) }),
    autocomplete: (kw, m) => req('ac', 'serp/google/autocomplete/live/advanced', { keyword: normKw(kw), ...loc(m), client: 'gws-wiz-serp' }, PRICE.ac, { keyword: normKw(kw) }),
    ideas: (kws, m) => req('labs_ideas', 'dataforseo_labs/google/keyword_ideas/live', { keywords: kws.slice(0, 20), ...loc(m), limit: CAPS.ideas_limit, include_serp_info: false, ignore_synonyms: true }, PRICE.labs + CAPS.ideas_limit * PRICE.labs_row),
    suggestions: (kw, m) => req('labs_suggestions', 'dataforseo_labs/google/keyword_suggestions/live', { keyword: normKw(kw), ...loc(m), limit: CAPS.sugg_limit, include_seed_keyword: true, ignore_synonyms: true }, PRICE.labs + CAPS.sugg_limit * PRICE.labs_row, { keyword: normKw(kw) }),
    related: (kw, m) => req('labs_related', 'dataforseo_labs/google/related_keywords/live', { keyword: normKw(kw), ...loc(m), depth: 2, limit: CAPS.related_limit, include_seed_keyword: true }, PRICE.labs + CAPS.related_limit * PRICE.labs_row, { keyword: normKw(kw) }),
    // `*` after a slash is the live-confirmed wildcard (R5 §13 C4); union keeps a row where any one competitor ranks; rows are cut to the
    // top 10 here, after the answer (the server filter path `intersection_result.$page.*` is not confirmed live, fixes/E2.md)
    intersection: (pages, excl, m) => { const p = {}; pages.slice(0, 20).forEach((u, i) => { p[String(i + 1)] = u; });
      return req('page_intersection', 'dataforseo_labs/google/page_intersection/live', { pages: p, exclude_pages: excl.slice(0, 10), intersection_mode: 'union', ...loc(m), item_types: ['organic'],
        order_by: ['keyword_data.keyword_info.search_volume,desc'], limit: CAPS.pi_limit }, PRICE.labs + CAPS.pi_limit * PRICE.labs_row, { pages: pages.slice(0, 20) }); },
    overview: (kws, m) => req('labs_overview', 'dataforseo_labs/google/keyword_overview/live', { keywords: kws.slice(0, CAPS.overview_max), ...loc(m), include_serp_info: false }, PRICE.labs + kws.length * PRICE.labs_row),
    intent: (kws) => req('labs_intent', 'dataforseo_labs/google/search_intent/live', { keywords: kws.slice(0, CAPS.intent_max) }, PRICE.labs + kws.length * PRICE.labs_row),   // keywords only: location and language are dropped silently (R5 §13 C8)
    adsVolume: (kws, m) => req('ads_volume', 'keywords_data/google_ads/search_volume/live', { keywords: kws.slice(0, CAPS.ads_max), ...loc(m) }, PRICE.ads),
  };
  const taskGet = (id, kw, round) => ({ ki_call: 'serp_get', endpoint: BASE + 'serp/google/organic/task_get/advanced/' + encodeURIComponent(S(id)), task_id: S(id), keyword: normKw(kw), round: round || 1 });
  const price = (reqs) => r6((reqs || []).reduce((s, r) => s + (Number(r.est_usd) || 0), 0));
  // ---- answers ----
  const task0 = (a) => (((a || {}).tasks || [])[0]) || {};
  const result0 = (a) => ((task0(a).result || [])[0]) || {};
  const itemsOf = (a) => { const it = result0(a).items; return Array.isArray(it) ? it : []; };
  const okAnswer = (a) => { if (!a || a.error) return false; if (typeof RT === 'object' && RT && RT.dfs) return RT.dfs(a).ok; const t = task0(a); return Number(t.status_code) === 20000; };
  const whyFailed = (a) => { if (!a) return 'no answer'; if (typeof RT === 'object' && RT && RT.dfs) return RT.dfs(a).why || 'could not be read'; return S(task0(a).status_message || (a.error && (a.error.message || a.error)) || 'could not be read'); };
  // pair a gated call's answers with the requests that went out (both in request order); an index with no answer is a failure
  const paired = (reqs, answers) => (reqs || []).map((q, i) => { const a = (answers || [])[i]; const ok = okAnswer(a); return { q, a: a || null, ok, why: ok ? '' : whyFailed(a) }; });
  // ---- the ki:* cache (seo_cache, kind 'ki', one row per site so a company only ever reads its own rows) ----
  const cacheKey = (siteId, what, ...parts) => 'ki:' + S(siteId) + ':' + what + (parts.length ? ':' + parts.map(S).join(':') : '');
  const cacheRead = (rows, k) => { const r = (rows || []).find(x => x && x.key === k); if (!r) return null; const v = J(r.value, null); return v && typeof v === 'object' ? { ...v, _updated_at: S(r.updated_at) } : null; };
  const fresh = (entry, kind, now, force) => { if (!entry || force) return false; const t = Date.parse(S(entry.fetched_at || entry._updated_at)); if (!Number.isFinite(t)) return false;
    return (Date.parse(S(now)) || Date.now()) - t < ttlOf(kind) * 864e5; };
  const cacheRow = (siteId, k, value) => ({ key: k, kind: 'ki', site_id: S(siteId), value: JSON.stringify(value), updated_at: new Date().toISOString() });
  // ---- SERP readings: the cache first (SC), then this run's answers; every organic / local item through SU (google.com/goto, R5 §13 L-1) ----
  // every answer has passed SU.fixAnswer in its gate's Answers node (the SERP-GOTO hotfix); a cached reading is fixed here the same way (idempotent)
  const fixAnswer = (a) => (a && typeof SU === 'object' && SU && SU.fixAnswer ? SU.fixAnswer(a) : a);
  // the top 10 of a results page: host by KI.hostOf (a redirect still on google.com, or no domain, is "host unknown" and skipped), its page
  // type, title, position, and whether the address is exact (an address rebuilt from a breadcrumb is not: the host is reliable, the page is not)
  const top10Of = (a, ctx) => { const items = ((typeof SU === 'object' && SU && SU.fixItems) ? SU.fixItems(itemsOf(a)) : itemsOf(a)) || [];
    const org = items.filter(x => x && x.type === 'organic').sort((x, y) => (N(x.rank_group) || 99) - (N(y.rank_group) || 99)).filter(x => (N(x.rank_group) || 99) <= 10);
    const out = []; for (const x of org) { const h = KI.hostOf(x); if (!h || SEARCH.test(h)) continue; const exact = x.url_exact !== false && !(SU && SU.isRedirect && SU.isRedirect(x.url));
      out.push({ url: S(x.url), host: h, title: S(x.title).slice(0, 160), pos: N(x.rank_group) || null, exact, url_partial: !!x.url_partial, type: KI.pageType(x, ctx || {}) || 'other' }); }
    return out; };
  const extrasOf = (a) => { const items = itemsOf(a); const out = { paa: [], related: [], forum: [], aio: false, local: false };
    for (const x of items) { if (!x) continue;
      if (x.type === 'people_also_ask') for (const q of (x.items || [])) { const t = T(q && (q.title || q.question)); if (t) out.paa.push(t); }
      if (x.type === 'related_searches') for (const q of (x.items || [])) { const t = T(typeof q === 'string' ? q : (q && (q.title || q.keyword))); if (t) out.related.push(t); }
      if (x.type === 'discussions_and_forums') for (const q of (x.items || [])) { const t = T(q && q.title); if (t) out.forum.push(t); }
      if (x.type === 'ai_overview') out.aio = true; if (x.type === 'local_pack') out.local = true; }
    return out; };
  // ---- table rows: exactly the columns (a Data Table upsert maps every input field) ----
  const COLS = {"KI_RUNS": ["site_id", "domain", "run_id", "request_id", "kind", "market", "location_code", "language_code", "mode", "rule_version", "started_at", "finished_at", "status", "reason", "sections_json", "counts_json", "cost_dfs_usd", "cost_claude_usd", "config_json"], "KI_COMP": ["site_id", "domain", "market", "comp_domain", "class", "class_basis", "class_confidence", "scored", "score", "score_low", "score_high", "serp_share", "topic_sim", "geo_match", "ai_share", "size_tag", "seeds_seen", "seeds_total", "reasons_json", "evidence_json", "declared", "status", "status_by", "first_seen", "last_seen", "misses", "profile_json", "run_id", "updated_at"], "KI_KW": ["site_id", "domain", "market", "keyword", "kw_key", "sources_json", "source_count", "volume", "volume_basis", "volume_source", "cpc", "kd", "trend_json", "gsc_impressions", "gsc_clicks", "gsc_position", "gsc_page", "intent", "stage", "stage_evidence_json", "intent_confidence", "needs_review", "gate", "gate_reason", "gate_detail", "fit", "demand", "win", "value", "gap", "score", "score_low", "score_high", "low_confidence", "verdict", "cluster_id", "is_head", "cluster_size", "cluster_demand", "serp_read_at", "top10_json", "page_action", "page_url", "cannibal_json", "competitors_json", "striking", "run_id", "fetched_at", "updated_at"], "KI_GAPS": ["gap_id", "site_id", "domain", "market", "type", "keyword", "cluster_id", "competitor_domains_json", "client_position", "evidence_json", "sample_note", "action", "action_target", "credits", "status", "run_id", "created_at", "updated_at"]};   // { KI_RUNS: [...], KI_COMP: [...], KI_KW: [...], KI_GAPS: [...] } from ladder_common.py, baked by build_ki.py
  const BOOL = new Set(['scored', 'declared', 'needs_review', 'low_confidence', 'is_head', 'striking']);
  const shape = (table, o) => { const out = {}; for (const c of COLS[table]) { let v = o[c]; if (v === undefined) v = null;
    if (v !== null && typeof v === 'object') v = JSON.stringify(v); if (BOOL.has(c) && v !== null) v = v === true || v === 'true'; out[c] = v; } return out; };
  // ---- sections of a run (CONTRACTS §4: [{key, state: ok|partial|missing|skipped, reason, rows}]) ----
  const sections = () => { const list = []; const api = {
    set: (key, state, reason, rows) => { const i = list.findIndex(s => s.key === key); const v = { key, state, reason: S(reason).slice(0, 300), rows: N(rows) || 0 }; if (i >= 0) list[i] = v; else list.push(v); return api; },
    list: () => list.slice(), status: () => { if (!list.length) return 'failed'; const miss = list.filter(s => s.state === 'missing').length, part = list.filter(s => s.state === 'partial').length, ok = list.filter(s => s.state === 'ok').length;
      if (!ok && !part) return 'failed'; return (miss || part) ? 'partial' : 'ok'; } }; return api; };
  // the state of one gated call for its section: what came back, and why the rest did not
  const callState = (pairs, what) => { const n = pairs.length, okN = pairs.filter(p => p.ok).length;
    if (!n) return { state: 'skipped', reason: what + ': nothing needed asking (stored answers were fresh)' };
    if (!okN) return { state: 'missing', reason: what + ' could not be read: ' + (pairs[0].why || 'no answer') + ' (asked twice; nothing was scored from it)' };
    if (okN < n) return { state: 'partial', reason: what + ': ' + okN + ' of ' + n + ' answers read; ' + (pairs.find(p => !p.ok).why || 'some could not be read') };
    return { state: 'ok', reason: '' }; };
  // ---- the money one gated call measured, each task once by its own id across both attempts (R28) ----
  const measured = (answersNodeItems) => { const ev = ((answersNodeItems || []).find(j => j && j.__dfs) || {}).__dfs; return ev ? (Number(ev.cost_usd) || 0) : 0; };
  const LABELS = { measured: 'measured', provider_estimate: 'estimate from the data provider', modelled: 'our estimate', inferred: 'our reading of the results' };
  const STAGES = { competitors: 'ki_competitors', keyword_research: 'ki_research' };
  const baseBody = (q, status, reason, extra) => ({ stage: STAGES[q.kind] || 'ki_competitors', status, reason: S(reason), request_id: S(q.request_id), run_id: S(q.run_id), domain: S(q.domain),
    market: S(q.market), mode: S(q.ki_mode || 'off'), rule_version: RULE, sections: [], summary: {}, labels: LABELS, run_ledger: null,
    run_cost_estimate_usd: 0, run_cost_estimate_basis: '', run_cost_estimate_state: 'modelled', ...(extra || {}) });
  const emptyLists = (kind) => (kind === 'keyword_research' ? { clusters: [], striking: [], questions: [], gaps_summary: {}, plan: [] } : { competitors: [], listings: [], platforms: [] });
  const refusalBody = (q, reason, note) => ({ ...baseBody(q, 'refused', reason, { note: S(note), run_cost_estimate_usd: 0, run_cost_estimate_state: 'measured',
    run_cost_estimate_basis: 'refused before any paid call: no search data was read and no model was asked' }), ...emptyLists(q.kind) });
  // QUEUE: a reading whose organic results carry their exact page addresses (at least half of the top 10; a live reading since the redirect
  // change has none). Keyword research groups searches by shared pages, so it re-reads a page whose stored reading is not exact.
  const exactEnough = (a) => { const items = ((typeof SU === 'object' && SU && SU.fixItems) ? SU.fixItems(itemsOf(a)) : itemsOf(a)) || [];
    const org = items.filter(x => x && x.type === 'organic' && (N(x.rank_group) || 99) <= 10); if (!org.length) return false;
    return org.filter(x => x.url_exact !== false && !(SU && SU.isRedirect && SU.isRedirect(x.url))).length / org.length >= 0.5; };
  // QUEUE: one collection round: the task items that went in (in order) and what the free task_get answered (same order). A task is ready on
  // 20000 with a result; still queued on 40601 (handed) / 40602 (in queue) or a failed request (asked again next round); anything else is
  // failed (its search is read live instead). -> { ready: [{ keyword, task_id, answer }], pending: [items], failed: [{ keyword, why }] }
  const QUEUED = new Set([40601, 40602]);
  const collectRound = (inputs, answers) => { const ready = [], pending = [], failed = [];
    (inputs || []).forEach((q, i) => { if (!q || !q.task_id) return; const a = (answers || [])[i];
      if (!a || a.error) { pending.push(q); return; }
      const t = task0(a); const code = N(t.status_code);
      if (code === 20000 && (t.result || [])[0]) { ready.push({ keyword: normKw(q.keyword || (t.data && t.data.keyword) || (t.data && t.data.tag)), task_id: q.task_id, answer: a }); return; }
      if (QUEUED.has(code) || !code) { pending.push(q); return; }
      failed.push({ keyword: normKw(q.keyword), why: whyFailed(a) }); });
    return { ready, pending, failed }; };
  // ---- the results pages of a list of searches: this run's answers first, then the day cache (an exact reading only when ctx.need_exact,
  //      with an inexact one kept as the last resort), the requests and answers paired in order ----
  // -> { by: { keyword: { source: cache|live|missing, at, why, top10, extras } }, save: [seo_cache serp rows], pairs, read, missing }
  const serpReadings = (kws, m, cacheRows, reqItems, answers, siteId, now, ctx) => {
    const pr = paired(reqItems, answers); const fr = {}; for (const x of pr) if (x.q && x.q.keyword) fr[normKw(x.q.keyword)] = x;
    const by = {}, save = []; let read = 0, missing = 0;
    for (const kw0 of (kws || [])) { const kw = normKw(kw0); const body = serpBody(kw, m);
      const lk = (typeof SC === 'object' && SC) ? SC.lookup(cacheRows || [], body, { now }) : { hit: false };
      const useCache = lk.hit && (!(ctx && ctx.need_exact) || exactEnough(lk.response));
      if (useCache) { by[kw] = { source: 'cache', at: S(lk.reading.at), why: '', top10: top10Of(lk.response, ctx), extras: extrasOf(lk.response), exact: exactEnough(lk.response) }; read++; continue; }
      const f = fr[kw];
      if (f && f.ok) { const fixed = fixAnswer(f.a); const src = (f.q && f.q.ki_source) || 'live'; by[kw] = { source: src, at: S(now), why: '', top10: top10Of(fixed, ctx), extras: extrasOf(fixed), exact: exactEnough(fixed) }; read++;
        const row = (typeof SC === 'object' && SC) ? SC.rowFor(fixed, body, siteId, { now, path: 'ki' }) : null; if (row) save.push(row); continue; }
      if (lk.hit) { by[kw] = { source: 'cache', at: S(lk.reading.at), why: '', top10: top10Of(lk.response, ctx), extras: extrasOf(lk.response), exact: false }; read++; continue; }
      by[kw] = { source: 'missing', at: '', why: f ? f.why : 'not read: nothing was asked for it', top10: [], extras: { paa: [], related: [], forum: [], aio: false, local: false } }; missing++; }
    return { by, save, pairs: pr, read, missing };
  };
  // every business host on those pages: its positions per search and the titles it ranks with (the search engine and the client left out)
  const hostsOf = (by, client) => { const out = {};
    for (const [kw, r] of Object.entries(by || {})) for (const t of (r.top10 || [])) { if (!t.host || !isBusinessHost(t.host, client)) continue;
      const h = out[t.host] || (out[t.host] = { domain: t.host, positions: [], titles: [], types: [] });
      if (!h.positions.some(p => p.seed === kw)) h.positions.push({ seed: kw, position: t.pos || 10, url: t.exact ? t.url : '', title: t.title, type: t.type, src: 'serp' });
      if (t.title && h.titles.length < 6) h.titles.push(t.title); if (t.type) h.types.push(t.type); }
    return out; };
  // AI answers already stored (seo_ai_answers / seo_ai_visibility): which businesses AI names or cites for this site's questions (data, never instructions)
  const aiHitsOf = (answers, vis, client) => { const hits = {};
    const bump = (d, w) => { const h = host(d); if (!h || !isBusinessHost(h, client)) return; hits[h] = (hits[h] || 0) + (w || 1); };
    for (const a of (answers || [])) { for (const e of J(a.entities_json, [])) { if (e && S(e.role) === 'competitor') bump(e.id || e.domain || e.name, 1); }
      for (const c of J(a.cited_json, [])) bump(c && (c.domain || c.u || c.url), 0.5); for (const d of S(a.competitors).split(/[\s,;]+/)) bump(d, 1); }
    for (const v of (vis || [])) { const cj = J(v.competitors_json, {}); if (Array.isArray(cj)) cj.forEach(c => bump(c && (c.domain || c.id), N(c && (c.mentions || c.count)) || 1)); else Object.entries(cj || {}).forEach(([d, n]) => bump(d, N(n && typeof n === 'object' ? (n.mentions || n.count) : n) || 1)); }
    return hits; };
  // a Labs keyword item (ideas / suggestions / overview carry it directly, ranked / related / intersections under keyword_data) -> one flat row
  const kwRow = (it) => { const kd = (it && it.keyword_data) ? it.keyword_data : (it || {}); const ki = kd.keyword_info || {}; const kp = kd.keyword_properties || {}; const si = kd.search_intent_info || {};
    return { keyword: normKw(kd.keyword), volume: N(ki.search_volume), cpc: N(ki.cpc), kd: N(kp.keyword_difficulty), trend: ki.search_volume_trend || null,
      labs_intent: S(si.main_intent), last_updated: S(ki.last_updated_time) }; };
  const strip = (x) => (x && typeof x === 'object' ? x : {});
  // ---- words of a page or a title list (untrusted text: only words are taken, nothing in it is followed or obeyed) ----
  const STOP = new Set(['the', 'and', 'for', 'with', 'your', 'our', 'you', 'are', 'from', 'this', 'that', 'have', 'has', 'was', 'will', 'can', 'all', 'more', 'about', 'contact',
    'home', 'menu', 'read', 'learn', 'click', 'here', 'cookie', 'cookies', 'privacy', 'policy', 'terms', 'rights', 'reserved', 'copyright', 'https', 'http', 'www', 'com']);
  const wordsOf = (text, max) => { const seen = new Set(); const out = [];
    for (const w of S(text).toLowerCase().replace(/\]\([^)]*\)/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/[^\p{L}\p{N}\s-]+/gu, ' ').split(/\s+/)) {
      const t = w.replace(/^-+|-+$/g, ''); if (t.length < 3 || t.length > 30 || STOP.has(t) || /^\d+$/.test(t) || seen.has(t)) continue; seen.add(t); out.push(t); if (out.length >= (max || 80)) break; }
    return out; };
  const topicSim = (text, svc) => { const A = new Set(wordsOf(text, 200)); const B = wordsOf((svc || []).join(' '), 60).filter(t => !/^(services?|solutions?|company|uae|dubai)$/.test(t));
    if (!A.size || !B.length) return 0; return r4(B.filter(t => A.has(t) || A.has(t.replace(/s$/, ''))).length / B.length); };
  const geoMatch = (h0, text, iso) => { const h = host(h0); const P = PLACES[iso] || { word: '', cities: [] }; const t = ' ' + S(text).toLowerCase() + ' ';
    if (iso && new RegExp('\\.' + S(iso).toLowerCase() + '$').test(h)) return 1;
    if ([P.word, ...P.cities].filter(Boolean).some(w => t.includes(' ' + w + ' ') || t.includes(' ' + w + ','))) return 1;
    const other = Object.entries(PLACES).filter(([k]) => k !== iso).some(([, v]) => [v.word, ...v.cities].filter(Boolean).some(w => t.includes(' ' + w + ' ')));
    return other ? 0.2 : 0.5; };
  // ---- one domain's class (KI.classifyDomain): the client, its services and market, the declared set, what this domain's results on the run's
  // pages are (appearances: seed, position, title, page type) and the words of its homepage when read (untrusted DATA, only words) ----
  const classify = (p, c, home) => KI.classifyDomain(c.domain, { own_domain: host(p.domain), services: p.services || [], declared: p.declared || [], market: S(p.iso),
    appearances: (c.positions || []).filter(x => x.src === 'serp').map(x => ({ keyword: x.seed, position: x.position, url: x.url, title: x.title, type: x.type })),
    pages: home && home.tokens ? [{ title: '', text: S(home.tokens) }] : [] });
  return { RULE, S, T, N, J, r4, r6, uniq, BASE, PRICE, QUOTE, CAPS, ttlOf, host, publicHost, isBusinessHost, SEARCH, normKw, keyOf, hash, PLACES, countryOf, market,
    shortService, services, seedServices, productsOf, compSeeds, seedHash, plausible, hopOf, htmlText, regOf, WILDCARD_DNS, rq, price, task0, result0, itemsOf, okAnswer, whyFailed, paired, cacheKey, cacheRead, fresh, cacheRow,
    fixAnswer, top10Of, extrasOf, serpReadings, exactEnough, collectRound, taskGet, QUEUED, hostsOf, aiHitsOf, kwRow, strip, serpBody, wordsOf, topicSim, geoMatch, classify, COLS, shape, sections, callState, measured, LABELS, STAGES, baseBody, emptyLists, refusalBody };
})();
const g = $('KI Gate').first().json || {};
const rowsOf = (n) => { try { return $(n).all(0).map(i => (i && i.json) || {}).filter(r => r && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const S = KIW.S, N = KIW.N;
const now = new Date().toISOString();
const site = g.site || {}; const mon = g.monitors || {};
const m = { market: g.market, iso: g.iso, location_code: g.location_code, language_code: g.language_code, country: g.country_name };
const cache = rowsOf('Load KI Cache');
const compRows = rowsOf('Load KI Competitors').filter(r => S(r.market) === g.market);
const brandWords = [S(site.business_name), ...S(site.brand_names || mon.brand_names).split(',')].map(x => KIW.normKw(x)).filter(x => x.length >= 3);
// ---- Search Console: the newest 28-day reading, queries with impressions, the brand left out ----
const qh = rowsOf('Load Query History (KI)');
const lastPeriod = qh.map(r => S(r.period_end)).sort().pop() || '';
const gscAll = qh.filter(r => S(r.period_end) === lastPeriod && N(r.impressions) > 0 && S(r.query));
const isBrand = (q) => brandWords.some(b => KIW.normKw(q).includes(b)) || KIW.normKw(q).includes(S(g.domain).split('.')[0]);
const gsc = gscAll.filter(r => !isBrand(r.query)).sort((a, b) => N(b.impressions) - N(a.impressions) || S(a.query).localeCompare(S(b.query)))
  .map(r => ({ query: KIW.normKw(r.query), impressions: N(r.impressions) || 0, clicks: N(r.clicks) || 0, position: N(r.position) || null, page: S(r.page) }));
// FX-L M2: "small site" reads the property's own 28-day total (seo_site_metrics, latest period), not the sum of the ~100 stored query rows
const metrics = rowsOf('Load Site Metrics (KI)').filter(r => N(r.impressions) != null).sort((a, b) => S(b.period_end).localeCompare(S(a.period_end)));
const siteImpr = metrics.length ? N(metrics[0].impressions) : gscAll.reduce((s, r) => s + (N(r.impressions) || 0), 0);
const siteImprBasis = metrics.length ? 'seo_site_metrics ' + S(metrics[0].period_end) : 'sum of the stored query rows';
const pageRows = rowsOf('Load Pages (KI)').filter(r => r.url).slice(0, 400);
// FX-L B1: every distinct service, cleaned (KI.services) and ranked by evidence before any cap (KIW.services)
const services = KIW.services(site, g, gsc, pageRows);
const seedSvc = KIW.seedServices(services);   // their plain short forms, for the seeds
const products = KIW.productsOf(services);
const declared = KIW.uniq([...(g.competitors || []), ...S(mon.competitors || site.competitors).split(/[\s,;]+/)].map(KIW.host).filter(h => KIW.isBusinessHost(h, g.domain))).slice(0, 10);
const maxChosen = Math.min(KIW.CAPS.chosen_max, Math.max(1, N(mon.ki_max_competitors) || KIW.CAPS.chosen_max));
const userChosen = compRows.filter(r => S(r.status) === 'chosen').map(r => KIW.host(r.comp_domain));
const dismissed = compRows.filter(r => S(r.status) === 'dismissed' && S(r.status_by) === 'user').map(r => KIW.host(r.comp_domain));
const chosen = KIW.uniq([...userChosen, ...declared.filter(d => !dismissed.includes(d))]).slice(0, maxChosen);
// FX-L H5: a search naming any business we know competes here is another company's brand (velosio dynamics 365, intwo cloud ...)
const knownRivals = compRows.filter(r => ['direct', 'adjacent'].includes(S(r.class)) && !(S(r.status) === 'dismissed' && S(r.status_by) === 'user')).map(r => KIW.host(r.comp_domain));
// FX-L H4: AVOID verdicts: the request's (the app's checks and content verdicts) and the content runs the check advised against
const clog = rowsOf('Load Content Log (KI)');
// only the engine's own wording for a check that advised against the page (never free text that happens to contain "avoid")
const avoidLog = clog.filter(r => /keyword check advised against/i.test(S(r.publish_note) + ' ' + S(r.qa_reasons))).map(r => KIW.normKw(r.keyword));
const avoid = KIW.uniq([...(g.avoid || []), ...avoidLog].map(KIW.normKw).filter(Boolean)).slice(0, 300);
// ---- the KI write gate (KI.gate: the shared fit gate in the KI vocabulary), written once, used on every seed and every candidate keyword ----
// FX-L N2: only rivals whose name is a brand (KI.brandDomains): an exact-match domain (softwarecompany.ae) never gates "software company in uae"
const brandRivals = KI.brandDomains(KIW.uniq([...declared, ...chosen, ...knownRivals]), { services }).slice(0, 60);
const fitCtx = { own_domain: g.domain, market: g.iso, services, topics: services, competitors: brandRivals, protect: [...(g.seeds || []), ...products], avoid,
  pages: pageRows.slice(0, 150).map(r => ({ title: S(r.title).slice(0, 120), url: S(r.url).slice(0, 200) })) };
const gate = (kw, extra) => KI.gate(kw, { ...fitCtx, ...(extra || {}) });
// ---- the ladder heads, read back through the gate they were written through (FITR, INVARIANTS rule 2) ----
const ladderRows = rowsOf('Load Ladders (KI)');
const heads = KIW.uniq(ladderRows.map(r => KIW.normKw(r.head_keyword)));
const fr = FITR.rungs(heads.map(h => ({ keyword: h })), { ...FITR.ctx({ own_domain: g.domain, services, competitors: fitCtx.competitors, topics: services }), market: g.iso }, { where: 'KI Plan' });   // the website's market: a head stored for another country is set aside
const ladders = fr.keep.map(r => r.keyword);
// KI-ONEURL (2026-11-11): the addresses the ladders hold and the search each holds them for (one search, one page: LRU.ownerOf); a page that
// was set aside, merged into another or stopped holds nothing
const ladderOwners = ladderRows.filter(r => S(r.target_url) && S(r.keyword) && !['set_aside', 'merged', 'stopped', 'failed', 'archived'].includes(S(r.status).toLowerCase()))
  .slice(0, 300).map(r => ({ url: S(r.target_url), keyword: KIW.normKw(r.keyword), supporting: S(r.supporting), ladder_id: S(r.ladder_id), by: 'ladder' }));
const tracked = KIW.uniq(S(site.keywords).split(',').map(KIW.normKw)).slice(0, 20);
const sd = KIW.compSeeds({ iso: g.iso, country: g.country_name, city: (KIW.J(site.nap_json, {}) || {}).city, services: seedSvc, products, seeds: g.seeds || [],
  gsc: gsc.slice(0, KIW.CAPS.gsc_seeds), tracked, ladders, gate: (kw) => gate(kw) });
// ---- what it may cost: every request priced, cache hits free, held under the quote ----
const quote = N(KIW.QUOTE[g.kind]) || 0;
const has = (k, kind) => KIW.fresh(KIW.cacheRead(cache, k), kind, now, g.ki_force);
const ck = (what, ...p) => KIW.cacheKey(g.site_id, what, ...p);
const rkCost = KIW.PRICE.labs + KIW.CAPS.rk_limit * KIW.PRICE.labs_row;
const seedKws = sd.seeds.map(s => s.keyword);
const seedKey = KIW.seedHash(sd.seeds);   // FX-L perf M2: the cache key of the discovery / overlap bundles (no weekly churn)
let base = 0, profileCap = 0, compRkCap = 0;
const notes = [];
if (g.kind === 'competitors') {
  base += seedKws.length * KIW.PRICE.serp10;
  if (!has(ck('sc', g.market, seedKey), 'ranked')) base += KIW.PRICE.labs + KIW.CAPS.sc_limit * KIW.PRICE.labs_row;
  base += KIW.PRICE.labs + (KIW.CAPS.size_targets + 1) * KIW.PRICE.labs_row;   // sizes (bulk traffic estimation)
  base += KIW.PRICE.bl + (KIW.CAPS.size_targets + 1) * KIW.PRICE.bl_row;       // referring domains
  base += (1 + KIW.CAPS.cd_rivals) * (KIW.PRICE.labs + KIW.CAPS.cd_limit * KIW.PRICE.labs_row);
  const need = chosen.filter(d => !has(ck('rk', g.market, d), 'ranked')).length;
  profileCap = Math.max(0, Math.min(need, Math.floor((quote - base + 1e-9) / rkCost)));
  if (need > profileCap) notes.push((need - profileCap) + ' competitor profile(s) wait for the next run: this run is held at the price quoted');
} else {
  base += KIW.CAPS.autocomplete * KIW.PRICE.ac;
  if (!has(ck('disc', g.market, seedKey), 'discovery')) base += (KIW.PRICE.labs + KIW.CAPS.ideas_limit * KIW.PRICE.labs_row) + KIW.CAPS.sugg_n * (KIW.PRICE.labs + KIW.CAPS.sugg_limit * KIW.PRICE.labs_row) + KIW.CAPS.related_n * (KIW.PRICE.labs + KIW.CAPS.related_limit * KIW.PRICE.labs_row);
  if (chosen.length && !has(ck('pi', g.market, KIW.hash(chosen.slice().sort().join('|'))), 'ranked')) base += KIW.PRICE.labs + KIW.CAPS.pi_limit * KIW.PRICE.labs_row;
  base += 2 * (KIW.PRICE.labs + KIW.CAPS.top_n * KIW.PRICE.labs_row) + KIW.PRICE.ads;   // overview + intent for the top N, Google Ads for what Labs does not know
  base += KIW.CAPS.top_m * KIW.PRICE.serp10 + (KIW.PRICE.labs + KIW.CAPS.tp_urls * KIW.PRICE.labs_row);
  base += KIW.PRICE.bl + (KIW.CAPS.rd_targets || 300) * KIW.PRICE.bl_row;   // FX-L H2: the referring domains of the client and the read top-10 hosts (Strength)
  const need = chosen.filter(d => !has(ck('rk', g.market, d), 'ranked')).length;
  compRkCap = Math.max(0, Math.min(need, Math.floor((quote - base + 1e-9) / rkCost)));
  if (need > compRkCap) notes.push((need - compRkCap) + ' competitor keyword list(s) wait for the next run: this run is held at the price quoted');
  if (!chosen.length) notes.push('no competitor is chosen yet: the competitor and gap sections are skipped (run Competitors and pick up to ' + maxChosen + ')');
}
const est = KIW.r6(Math.min(quote || Infinity, base + (g.kind === 'competitors' ? profileCap : compRkCap) * rkCost));
return [{ json: { kind: g.kind, stage: g.stage, site_id: g.site_id, domain: g.domain, canonical_host: S(site.canonical_host) || g.domain, ...m, client_key: g.client_key || '',
  request_id: g.request_id, run_id: g.run_id, callback_url: g.callback_url, ki_mode: g.ki_mode, ki_force: !!g.ki_force, started_at: g.started_at || now, now,
  services, seed_services: seedSvc, products, brand_words: brandWords, declared, chosen, dismissed, max_chosen: maxChosen, seeds: sd.seeds, seeds_refused: sd.refused, seeds_dropped: sd.dropped,
  gsc: gsc.slice(0, 500), gsc_period_end: lastPeriod, site_impressions: siteImpr, site_impressions_basis: siteImprBasis, seed_key: seedKey, avoid, known_rivals: knownRivals, tracked, ladders, ladders_set_aside: fr.set_aside, ladder_owners: ladderOwners, fit_ctx: fitCtx,
  profile_cap: profileCap, comp_rk_cap: compRkCap, quote, notes, business: g.business || '',
  est_dfs_usd: est, est_ai_usd: 0,
  est_basis: 'modelled before the run from the price of every request it may send ($' + est.toFixed(4) + ', every results page counted as not read today; the quote is $' + quote.toFixed(2) + ')' } }];
