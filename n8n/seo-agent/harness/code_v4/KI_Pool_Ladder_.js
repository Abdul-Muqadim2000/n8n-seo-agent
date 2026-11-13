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
// F-10 (production review 2026-11-12, section 189): a search for one website by its ADDRESS ("zylo com", "zylo.com", "www zylo", "zylo co uk")
// is navigational whatever the search data says: people want that site, not a page of yours (the Recommendations told a client to move
// "otherbrand com" into the top 3). The same rule as the web app's addressSearchLabel (app/shared/src/search-advice.ts). "net" is left out
// ("asp net" is a subject), and so are "node.js" / "asp.net" (js and net are not a top-level domain people type here).
// Kept identical in effect to the app's addressSearchLabel after its review (2026-11-12): the whole search is a host ("zylo.com"); a name
// followed by com / net / org (org only after one word) or by "co" and a country ("zylo com pk", "zylo co uk"); "www" and one name. "info",
// "io" and "ai" as a separate word never ("vat info", "generative ai"); the label must be a distinctive name (4+ letters, the gate's own
// label rule), so "erp com", "company info", "non profit org" and "socket.io developers" are subjects, not addresses.
const FIT_CC = 'uk|ae|in|za|nz|au|pk|sa|qa|om|kw|bh|eg|jp|sg|my';
const FIT_HOST_ONLY = new RegExp('^(?:https?://)?(?:www\\.)?([a-z0-9-]+)\\.(?:com|net|org|io|ai|co|ae|sa|pk|qa|om|kw|bh|eg|in|uk|us|de|fr)(?:\\.(?:' + FIT_CC + '))?(?:/\\S*)?$');
const FIT_NAME_TAIL = new RegExp('^(\\S+(?:\\s\\S+)?)\\s(com|net|org|co)(?:\\s(' + FIT_CC + '))?$');
/** a search for one website by its address: the label typed ("zylo"), or '' (own = the site's own label, always an address of it) */
const fitAddressLabel = (query, own) => {
  let q = String(query == null ? '' : query).replace(/\s+/g, ' ').trim().toLowerCase();
  if (!q) return '';
  const www = /^www(\s|\.)/.test(q) && !/^www\.[a-z0-9-]+\.[a-z]/.test(q) ? (q = q.replace(/^www[\s.]+/, ''), true) : false;
  let label = '';
  const host = q.match(FIT_HOST_ONLY);
  if (host) label = host[1];
  else {
    const t = q.match(FIT_NAME_TAIL);
    if (t) { const words = t[1].split(' '); const tld = t[2]; if ((tld === 'co' && t[3]) || (tld !== 'co' && (tld !== 'org' || words.length === 1))) label = words.join(''); }
    else if (www && /^[a-z0-9-]+$/.test(q)) label = q;
  }
  if (!label) return '';
  if (own && own.length >= 4 && label.startsWith(own)) return label;
  return label.replace(/-/g, '').length >= 4 && fitOwnLabels(label + '.example', [], []).length ? label : '';
};
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
  // 1b. F-10 (section 189): a search for a website by its address (the website's own, or another one)
  { const own = fitHost(ctx.own_domain).split('.')[0]; const al = fitAddressLabel(kw, own); if (al) {
    return (own && (al === own || (own.length >= 4 && al.includes(own))))
      ? { ok: false, reason: 'own brand', detail: 'people looking for your own website by its address (' + kw + ')' }
      : { ok: false, reason: 'navigational', detail: 'people looking for one website by its address (' + kw + '), not for what you sell' }; } }
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
    practitioner: 'someone already using the product, looking for its documentation or settings', not_a_search: 'not a search people make', off_topic: 'not something you sell', too_broad: 'too broad to point to what you sell', empty: 'no keyword', low_fit: 'too far from what you sell', avoid: 'you or our check said not to write it' };
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
  // KI-JUDGE (2026-11-12): a word rule about WHO is searching is a second opinion (soft): keyword research hands the search to the judge with
  // its results page and the judge decides; another market or language is final (hard)
  const fail = (reason, detail, text) => ({ gate: 'fail', reason, text: text || GATE_TEXT[reason], detail: ascii(detail), soft: reason !== 'other_market' });
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
    // KI-JUDGE: "not something you sell" / "too broad" read from the words alone are a second opinion; another market, a brand, a portal,
    // a government service, a navigational or an own-brand search are final
    return { gate: 'fail', reason, text: GATE_TEXT[reason], detail: ascii((g || {}).detail || ''), soft: reason === 'off_topic' || reason === 'too_broad' };
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
// ---- LADDER PACKAGE (2026-11-09, docs/keyword-intel-2026-11-08/fixes/LADDER.md): the five ladder rules, ONE copy ----
// Production (2026-10-22 .. 11-08, R3_PROD_OUTPUTS.md F1 F6 F7 F9): three rungs of techand.ai's ERP ladder, the main page included, were written onto
// ONE blog address (/insights/is-microsoft-dynamics-365-an-erp-system); the CRM ladder's main page pointed at "/dynamics-365-crm-uae-2", a copy
// of the live CRM page; a rung the verdict called AVOID was written and published because ladder page runs carry force_content; a rung sat
// in "writing" for days after its run died; devaicon.com's "ai automation solutions gcc" was measured in Pakistan. The rules:
//   1. one search, one address: two rungs never share a target, a rung whose address already answers its search improves that page, and the
//      main page is never a blog / insights address or a "-2" / "-copy" variant of a live page (addresses compared without scheme / www);
//   2. the rungs step towards the main keyword (stage: problem, solution, compare, hire); a plan with no compare / hire rung before the main
//      page is re-planned from its own pool, and a pure definition ("what is a crm company") is a rung only when its results page is
//      informational (guides) and it links to the main page;
//   3. the market is the website's market, or the market the keyword names ("gcc", "uae", "dubai" -> AE); never another country;
//   4. an AVOID verdict, or a score clearly under the line (40), stops the rung: no page is written until the client says "Write it anyway";
//   5. a rung "writing" for longer than three times its expected time (at least 60 minutes) with nothing of its run still alive is closed as
//      failed with its reason, so the next rung can go.
// Inlined into Ladder Plan, Ladder Duplicate (Words), Parse Verdict's ladder stop (Ladder Row Written), Cadence Plan, Publish Candidates and
// Publish Check (through _publish_rows.js); the app runs the same source (app/shared/src/ladder-rules.generated.js, ladder_rules_app.py) for
// its warnings, its rung reasons and its stuck-rung watcher. Pure: no clock (pass `now`), no table, no network. Needs fitPlaces
// (_fit_gate.js) only for the market rule; everything else stands alone.
const LRU = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const low = (v) => S(v).toLowerCase();
  const CFG = {
    stuck_min_minutes: 60, stuck_eta_factor: 3, page_eta_minutes: 20,   // page runs take 15-19 minutes on production (2026-11-08)
    clear_score: 40,                                                    // Parse Verdict's "clearly low" line (HOLD CFG.clear)
    rank_keep_position: 30, rank_keep_impressions: 10,                  // review H5: a page that ranks for the main keyword keeps it
    blog_dirs: ['blog', 'blogs', 'insights', 'insight', 'articles', 'article', 'news', 'resources', 'resource', 'posts', 'post', 'learn', 'guides', 'guide', 'knowledge', 'academy', 'stories', 'magazine'],
    // the measurable markets (Normalize Input COUNTRIES): ISO-2 -> the country name the engine and the app use
    countries: { US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia', NZ: 'New Zealand', IE: 'Ireland', PK: 'Pakistan', IN: 'India',
      AE: 'United Arab Emirates', SA: 'Saudi Arabia', SG: 'Singapore', ZA: 'South Africa', DE: 'Germany', FR: 'France', ES: 'Spain', IT: 'Italy',
      NL: 'Netherlands', BR: 'Brazil', MX: 'Mexico' },
  };
  const STAGES = ['problem', 'solution', 'compare', 'hire', 'info'];
  const COMMERCIAL = ['compare', 'hire'];

  // ---- addresses (rule 1) ----
  /** the comparable form of an address: no scheme, no www., no query / fragment, no trailing slash, lower case ('' for nothing) */
  const urlKey = (u) => low(u).replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const pathOf = (u) => { const k = urlKey(u); const i = k.indexOf('/'); return i < 0 ? '' : k.slice(i); };
  const segs = (u) => pathOf(u).split('/').filter(Boolean);
  // a language prefix (/en/, /ar-ae/) is not the first folder that says what the page is
  const LOCALE = /^[a-z]{2}(?:-[a-z]{2})?$/;
  /** a blog / insights / news ... address: its first folder (after a language prefix) is one of CFG.blog_dirs */
  const isBlog = (u) => { let s = segs(u); if (s.length > 2 && LOCALE.test(s[0])) s = s.slice(1); return s.length > 1 && CFG.blog_dirs.includes(s[0]); };
  // review L1 (2026-11-10): only suffixes that mean "another copy of the same page"; -new, -v9, a bare word like /windows-11 are not copies
  const COPY_RE = /^(.+?)-(copy(?:-\d+)?|\d|old|draft|backup|bak)$/;
  // a page title's own words: the brand after "|" / " - " dropped, joining words out, plurals folded (re-review N3: production's "-2" copy of
  // "Dynamics 365 CRM in Dubai & UAE: Sales and Service | Tech&" is titled "Dynamics 365 CRM Services UAE | Tech")
  const titleWords = (t) => { const x = low(t).split(/\s[|\u2013\u2014]\s|\s-\s/)[0] || ''; return wordsKey(x).split(' ').filter(Boolean); };
  const sameTitle = (a, b) => { const A = titleWords(a), Bw = new Set(titleWords(b)); if (!A.length || !Bw.size) return true;
    const short = A.length <= Bw.size ? A : [...Bw]; const long = A.length <= Bw.size ? Bw : new Set(A); return short.filter(w => long.has(w)).length >= Math.ceil(0.6 * short.length); };
  /** a "-2" / "-copy" / "-old" variant of another address of the site: -> the original's address, or ''. `known`: the site's pages, as
   *  addresses or { url, title }. A one-digit suffix counts only when the address without it is a page the site has AND, when both titles
   *  are known, they are the same page title (so /step-2 beside a different /step is not a copy); "-copy" always counts. */
  const copyOf = (u, known) => {
    const s = segs(u); if (!s.length) return '';
    const m = s[s.length - 1].match(COPY_RE); if (!m) return '';
    const base = urlKey(u).replace(/[^/]+$/, m[1]);
    const list = (Array.isArray(known) ? known : []).map(x => x && typeof x === 'object' ? { k: urlKey(x.url), url: S(x.url), title: S(x.title) } : { k: urlKey(x), url: S(x), title: '' }).filter(x => x.k);
    const orig = list.find(x => x.k === base), self = list.find(x => x.k === urlKey(u));
    // a one-digit suffix is a copy unless both titles are known and share under 60% of the shorter title's words (a different page)
    if (orig) { if (/^\d$/.test(m[2]) && orig.title && self && self.title && !sameTitle(orig.title, self.title)) return ''; return orig.url || base; }
    return /^copy/.test(m[2]) ? base : '';
  };
  // the same search in other words: every word kept, joining words dropped, a plural folded (the H2 target_guard rule of Ladder_Plan.js)
  const JOIN = new Set(['in', 'the', 'a', 'an', 'of', 'for', 'to', 'on', 'at', 'and', 'with', 'by', 'from']);
  const wordsKey = (kw) => [...new Set(low(kw).split(/[^a-z0-9؀-ۿ]+/).filter(t => t && !JOIN.has(t)).map(t => t.length > 3 ? t.replace(/ies$/, 'y').replace(/([^s])s$/, '$1') : t))].sort().join(' ');
  const sameSearch = (a, b) => { const x = low(a), y = low(b); if (!x || !y) return false; if (x === y) return true; const wa = wordsKey(x); return !!wa && wa === wordsKey(y); };
  /** who already holds an address: owners [{ url, keyword, supporting?: [..], ladder_id?, by? }] -> the owner of `url` whose search is NOT
   *  `keyword` (nor one of its supporting keywords), or null. The same search may always improve its own page. */
  const ownerOf = (url, keyword, owners, mine) => {
    const k = urlKey(url); if (!k) return null;
    const kws = [keyword, ...(Array.isArray(mine) ? mine : [])].map(low).filter(Boolean);
    for (const o of (Array.isArray(owners) ? owners : [])) {
      if (!o || urlKey(o.url) !== k || !S(o.keyword)) continue;
      const theirs = [o.keyword, ...(Array.isArray(o.supporting) ? o.supporting : String(o.supporting || '').split(','))].map(low).filter(Boolean);
      if (kws.some(a => theirs.some(b => sameSearch(a, b)))) continue;   // the same search: its own page (another owner may still hold it)
      return o;
    }
    return null;
  };
  /** the address a new page gets on the site: home + slug(keyword), with the site's trailing-slash form */
  const plannedUrl = (home, keyword, slash) => { const h = S(home).replace(/\/+$/, ''); const sl = low(keyword).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return h && sl ? h + '/' + sl + (slash ? '/' : '') : ''; };
  /** review H5: does this address already rank for the main keyword? o: { rank: { position, url } (the rank check or the ranked pull),
   *  pages: [{ url, queries: [{ query, impressions, position }] }] (Search Console per page) } -> true when the rank reading puts this
   *  address at position <= 30, or Search Console shows it for a search holding every word of the keyword at position <= 30 or with
   *  10+ impressions. A page that ranks is improved, never left for a competing new page. */
  const ranksFor = (url, keyword, o) => {
    const x = o || {}; const k = urlKey(url); if (!k) return false;
    const r = x.rank || null; const rp = r ? Number(r.position) : NaN;
    if (r && Number.isFinite(rp) && rp >= 1 && rp <= CFG.rank_keep_position && (!S(r.url) || urlKey(r.url) === k)) return true;
    const want = wordsKey(keyword).split(' ').filter(Boolean); if (!want.length) return false;
    for (const p of (Array.isArray(x.pages) ? x.pages : [])) {
      if (!p || urlKey(p.url) !== k) continue;
      for (const q of (Array.isArray(p.queries) ? p.queries : [])) {
        const have = new Set(wordsKey((q || {}).query || (q || {}).keyword).split(' '));
        if (!want.every(w => have.has(w))) continue;
        const pos = Number((q || {}).position), imp = Number((q || {}).impressions) || 0;
        if ((Number.isFinite(pos) && pos >= 1 && pos <= CFG.rank_keep_position) || imp >= CFG.rank_keep_impressions) return true;
      }
    }
    return false;
  };
  /** rule 1 for the MAIN page: a blog address, or a copy of a live page, is never its target. -> null (fine) or { reason, was, to, exists }:
   *  a copy points back to the original page (improve it); a blog address gets the commercial page the site has (`commercial`, a URL
   *  found by the caller among non-blog pages), else a new page at `planned`. */
  const headTarget = (url, o) => {
    const opt = o || {}; const u = S(url); if (!u) return null;
    // production review 2026-11-12 (F-05): the home page is never a ladder's main page (it would be rewritten): a new page at `planned`
    if (/^(?:\/[a-z]{2}(?:-[a-z]{2})?)?$/.test(pathOf(u))) return { reason: 'home', was: u, to: S(opt.planned), exists: false, text: 'the home page is never rewritten as the main page of a ladder: it gets its own page at ' + S(opt.planned).replace(/^https?:\/\/[^\/]+/i, '') };
    const orig = copyOf(u, opt.known || []);
    if (orig) return { reason: 'copy', was: u, to: S(orig).startsWith('http') ? S(orig) : (S(opt.home).replace(/\/+$/, '') + pathOf(orig)), exists: true,
      text: u.replace(/^https?:\/\/[^\/]+/i, '') + ' is a copy of ' + pathOf(orig) + ', a page your website already has: the main page improves that page instead of a second copy' };
    if (isBlog(u)) { const c = S(opt.commercial);
      return c ? { reason: 'blog', was: u, to: c, exists: true, text: 'the main page is a page people choose a provider on, not a blog post: ' + c.replace(/^https?:\/\/[^\/]+/i, '') + ' improves instead of ' + u.replace(/^https?:\/\/[^\/]+/i, '') }
        : { reason: 'blog', was: u, to: S(opt.planned), exists: false, text: 'the main page is a page people choose a provider on, not a blog post (' + u.replace(/^https?:\/\/[^\/]+/i, '') + '): it gets its own page at ' + S(opt.planned).replace(/^https?:\/\/[^\/]+/i, '') }; }
    return null;
  };
  /** rule 1 inside one plan: pages [{ keyword, target_url, exists, rung, supporting }] in plan order (the main page first) -> { pages, moved }.
   *  Two pages on one address: the first keeps it; a later page of the SAME search joins it as a supporting keyword, any other gets its own
   *  new address (`planned(keyword)`). */
  const oneUrl = (pages, planned) => {
    const seen = new Map(); const out = []; const moved = [];
    for (const p of (Array.isArray(pages) ? pages : [])) {
      const k = urlKey(p && p.target_url); if (!p || !k) { out.push(p); continue; }
      const o = seen.get(k);
      if (!o) { seen.set(k, p); out.push(p); continue; }
      if (sameSearch(o.keyword, p.keyword)) { o.supporting = [...new Set([...(o.supporting || []), p.keyword, ...(p.supporting || [])])]; moved.push({ keyword: p.keyword, to: o.keyword, url: o.target_url, how: 'joined', text: '"' + p.keyword + '" is the same search as "' + o.keyword + '", so it is a supporting keyword of that page' }); continue; }
      const nu = typeof planned === 'function' ? S(planned(p.keyword)) : '';
      if (!nu || seen.has(urlKey(nu))) { moved.push({ keyword: p.keyword, to: o.keyword, url: o.target_url, how: 'dropped', text: '"' + p.keyword + '" had the same address as "' + o.keyword + '" and no address of its own could be made, so it waits' }); continue; }
      moved.push({ keyword: p.keyword, from: p.target_url, url: nu, how: 'own address', text: '"' + p.keyword + '" had the same address as "' + o.keyword + '" (' + pathOf(p.target_url) + '): one search, one page, so it gets its own page at ' + pathOf(nu) });
      Object.assign(p, { target_url: nu, exists: false, status: 'new', existing_source: null, existing_confidence: null, existing_evidence: '' });
      seen.set(urlKey(nu), p); out.push(p);
    }
    return { pages: out, moved };
  };

  // ---- the buyer's stage (rule 2) ----
  const Q_START = /^(?:what|who|why|when|where|which|is|are|does|do|can|should|will|how)\b/;
  const W_COMPARE = /\b(?:best|top|vs|versus|alternatives?|compare|comparison|comparing|pricing|prices?|costs?|fees?|quotes?|reviews?|rated|cheapest|affordable|rankings?|list of)\b/;
  const W_HIRE = /\b(?:compan(?:y|ies)|agenc(?:y|ies)|firms?|providers?|partners?|consultants?|consultanc(?:y|ies)|contractors?|developers?|vendors?|integrators?|resellers?|specialists?|experts?|freelancers?|hire|hiring|near me|services|consulting)\b|\b(?:consulting|implementation|development|support|migration|integration|outsourcing) services?\b/;
  const W_PROBLEM = /\b(?:deadlines?|penalt(?:y|ies)|fines?|mandate|mandatory|requirements?|compliance|compliant|regulations?|law|laws|problems?|issues?|errors?|not working|fix|risks?|challenges?|obligations?)\b/;
  const W_SOLUTION = /\b(?:software|system|systems|platform|platforms|tools?|solutions?|apps?|applications?|modules?|features?|implementation|migration|integration|upgrade|automation|development|hosting|cloud|erp|crm|hrms|lms|setup|service)\b/;
  const W_DEFINE = /^(?:what (?:is|are|does)|what's|whats|define|definition of|meaning of)\b/;
  const W_SELLER_NOUN = /\b(?:compan(?:y|ies)|agenc(?:y|ies)|firms?|providers?|partners?|consultants?|consultanc(?:y|ies)|vendors?|integrators?|specialists?)\b/;
  /** the stage of a search: a stored KI stage when there is one, else the words, else the intent the research gave -> one of STAGES */
  const stageOf = (keyword, intent, stored) => {
    const st = low(stored); if (STAGES.includes(st)) return st;
    const k = low(keyword).replace(/[^a-z0-9؀-ۿ&]+/g, ' ').trim();
    if (!k) return 'info';
    if (W_COMPARE.test(k)) return 'compare';
    if (Q_START.test(k)) return W_PROBLEM.test(k) ? 'problem' : 'info';
    if (W_HIRE.test(k)) return 'hire';
    if (W_PROBLEM.test(k)) return 'problem';
    if (W_SOLUTION.test(k)) return 'solution';
    const i = low(intent);
    return i === 'commercial' || i === 'transactional' ? 'solution' : 'info';
  };
  const isCommercial = (stage) => COMMERCIAL.includes(low(stage));
  /** a pure definition of a seller ("what is a crm company", "meaning of erp partner"): a page for people learning a word, not buyers */
  const isDefinitional = (keyword) => { const k = low(keyword); return W_DEFINE.test(k) && W_SELLER_NOUN.test(k); };
  /** rule 2: may a definitional rung stay? only when its results page was read and is informational (guides lead) and it links to the main page */
  const definitionalOk = (o) => { const x = o || {}; return !!x.serp_informational && !!x.links_up; };
  const STAGE_WORDS = { problem: 'people with a problem to solve', solution: 'people looking for a solution', compare: 'people comparing providers or options', hire: 'people ready to choose a provider', info: 'people learning about the topic' };
  const stageText = (stage) => STAGE_WORDS[low(stage)] || STAGE_WORDS.info;

  // ---- the market (rule 3) ----
  const placesOf = (s) => { try { return typeof fitPlaces === 'function' ? fitPlaces(s) : []; } catch (e) { return []; } };
  const countryName = (iso) => CFG.countries[S(iso).toUpperCase()] || '';
  /** -> { iso, country, source: 'keyword' | 'site' | 'request', named: [place words], keyword_iso, ok (the request market is the lock), changed,
   *  measurable, note }. o: { keyword, site_iso (the website's market), request_iso (what the run was sent with) }.
   *  A keyword that names places stands for those places: the website's market when it is among them ("gcc" for a UAE website), else the
   *  first measurable country it names (a region: its first country, "gcc" -> AE); a keyword that names no place is the website's market.
   *  Never a third country: the request's market is used only when there is neither a place in the keyword nor a website market. */
  const market = (o) => {
    const x = o || {}; const site = S(x.site_iso).toUpperCase(), req = S(x.request_iso).toUpperCase();
    const places = placesOf(x.keyword); const named = places.map(p => p.word);
    let iso = '', source = '', keyword_iso = '';
    if (places.length) {
      const isos = [...new Set(places.flatMap(p => p.iso || []))];
      keyword_iso = site && isos.includes(site) ? site : (isos.find(i => CFG.countries[i]) || isos[0] || '');
      iso = keyword_iso; source = site && iso === site ? 'site' : 'keyword';
    } else if (site) { iso = site; source = 'site'; }
    else { iso = req; source = 'request'; }
    const unmeasured = !CFG.countries[iso] && !!site;
    if (unmeasured) { iso = site; source = 'site'; }   // a named market we cannot measure (Qatar): the website's own, said so
    // review M1: a request for a measurable country INSIDE the places the keyword names is that market ("erp software gcc" sent with Saudi Arabia)
    const namedIsos = [...new Set(places.flatMap(p => p.iso || []))];
    if (req && req !== iso && namedIsos.includes(req) && CFG.countries[req]) { iso = req; source = 'keyword'; }
    const ok = !req || req === iso;
    const nm = (i) => countryName(i) || i;
    const note = !iso ? '' : source === 'keyword'
      ? 'The keyword names ' + named.join(', ') + ', so this ladder is measured in ' + nm(iso) + (site ? ', not in your website\'s market (' + nm(site) + ')' : '') + '.'
      : places.length && keyword_iso && keyword_iso !== iso ? 'The keyword names ' + named.join(', ') + ', which we cannot measure, so this ladder is measured in your website\'s market (' + nm(iso) + ').'
      : places.length ? 'The keyword names ' + named.join(', ') + ', which includes your website\'s market (' + nm(iso) + '), so it is measured there.'
      : source === 'site' ? 'Measured in your website\'s market (' + nm(iso) + ').' : '';
    return { iso, country: nm(iso), source, named, keyword_iso, request_iso: req, ok, changed: !!req && req !== iso, measurable: !!CFG.countries[iso], note };
  };
  /** the sentence a refused run carries when its market contradicts the lock (Ladder Duplicate (Words), before anything is paid) */
  const marketRefusal = (m, keyword) => !m || m.ok ? '' : 'This ladder was sent to be measured in ' + (countryName(m.request_iso) || m.request_iso) + ', but "' + S(keyword) + '" '
    + (m.source === 'keyword' ? 'names ' + m.named.join(', ') + ' (' + m.country + ')' : 'names no place and your website\'s market is ' + m.country)
    + '. A ladder is measured in one market, so nothing was planned and nothing was charged: start it again in ' + m.country
    + (m.source === 'site' && !m.named.length ? ', or confirm that you want it measured in ' + (countryName(m.request_iso) || m.request_iso) + ' on purpose.' : '.');

  // ---- verdicts (rule 4) ----
  /** o: { verdict: 'GO' | 'GO_WITH_CHANGES' | 'AVOID' | ..., score: 0-100 | null, ack: the client said "Write it anyway" } -> { stop, reason, band } */
  const verdictStop = (o) => {
    const x = o || {}; const v = S(x.verdict).toUpperCase(); const sc = x.score === '' || x.score == null || !Number.isFinite(Number(x.score)) ? null : Math.round(Number(x.score));
    const band = v === 'AVOID' ? 'avoid' : sc != null && sc < CFG.clear_score ? 'clearly_low' : '';
    if (!band) return { stop: false, reason: '', band: '' };
    if (x.ack) return { stop: false, reason: 'you chose to write it anyway', band, overridden: true };
    return { stop: true, band, score: sc,
      reason: band === 'avoid' ? 'our check advised against this page (AVOID' + (sc != null ? ', score ' + sc : '') + ')' : 'our check scored it ' + sc + ' out of 100, clearly under the ' + CFG.clear_score + ' we write without asking' };
  };

  // ---- stuck rungs (rule 5) ----
  /** o: { status, since (ISO: when it went to writing / was started), eta_minutes, live: true | false | null (null = could not be asked), now (ISO or ms) }
   *  -> { stuck, minutes, limit, reason } */
  const stuck = (o) => {
    const x = o || {}; const st = low(x.status);
    const eta = Number.isFinite(Number(x.eta_minutes)) && Number(x.eta_minutes) > 0 ? Number(x.eta_minutes) : CFG.page_eta_minutes;
    const limit = Math.max(CFG.stuck_min_minutes, CFG.stuck_eta_factor * eta);
    const t = Date.parse(S(x.since)); const now = typeof x.now === 'number' ? x.now : Date.parse(S(x.now));
    if (!['writing', 'started'].includes(st) || !Number.isFinite(t) || !Number.isFinite(now)) return { stuck: false, minutes: null, limit, reason: '' };
    const minutes = Math.max(0, Math.round((now - t) / 60000));
    if (minutes < limit) return { stuck: false, minutes, limit, reason: '' };
    if (x.live !== false) return { stuck: false, minutes, limit, reason: x.live === true ? 'still running' : 'the engine could not be asked whether it is still running' };
    return { stuck: true, minutes, limit, reason: 'the page run stopped without a result: it was being written for ' + minutes + ' minutes (more than ' + limit + ') and nothing of it is still running' };
  };

  // ---- what a rung row tells the client (the app's ladder page) ----
  /** row: a seo_ladders row; o: { next: the keyword the ladder writes next, now } -> { state, label, why, url } */
  const rungState = (row, o) => {
    const r = row || {}; const st = low(r.status || 'planned'); const url = S(r.target_url); const note = S(r.status_note);
    const exists = r.page_exists === true || r.page_exists === 'true';
    const path = url.replace(/^https?:\/\/[^\/]+/i, '') || '/';
    const tw = S(r.target_why);
    if (st === 'stopped') return { state: 'stopped', label: 'Stopped', why: note.replace(/^stopped:\s*/i, '') || 'our check advised against this page', url };
    if (st === 'failed') return { state: 'failed', label: 'Stopped without a result', why: note.replace(/^failed:\s*/i, '') || 'the page run stopped without a result', url };
    if (st === 'merged') return { state: 'merged', label: 'Part of another page', why: note.replace(/^merged:\s*/i, '') || 'it is a section of another page of this ladder', url };
    if (st === 'set_aside') return { state: 'set_aside', label: 'Set aside', why: note || 'it is not a search for this website', url };
    if (st === 'published') return { state: 'published', label: 'Live', why: 'published at ' + path, url };
    if (st === 'written' || st === 'not_ready') return { state: st, label: st === 'written' ? 'Written, waiting to be published' : 'Written, needs a fix', why: note || (exists ? 'improves ' + path : 'a new page at ' + path), url };
    if (st === 'writing') return { state: 'writing', label: 'Being written', why: exists ? 'improves ' + path : 'a new page at ' + path, url };
    const nxt = (o || {}).next ? sameSearch((o || {}).next, r.keyword) : false;
    return { state: exists ? 'improve' : 'new', label: exists ? 'Improves an existing page' : 'New page', why: (tw || (exists ? 'your page ' + path + ' already answers this search, so it is improved, not written twice' : 'a page you do not have yet, at ' + path))
      + (nxt ? '' : note ? ' (' + note + ')' : ''), url, waiting: !nxt };
  };

  // ---- rule 6: keyword intelligence as the ladder's pool ----
  /** o: { mode (seo_monitors.ki_mode), killed (true | false | null = unread: counts as killed), rows (seo_ki_keywords of the site), runs
   *  (seo_ki_runs of the site), market ('AE-en'), min (default 3) } -> { used, reason, run_id, rows (one head per cluster, gate pass, not
   *  gated), avoid (keywords the client's checks advised against), note }. Read only when the site's mode is exactly 'on' and the kill
   *  switch reads off (fails closed, KI.readable's rule); only the rows of the latest finished keyword-research run of this market
   *  (CONTRACTS KI_ROW_CURRENT). Fewer than `min` usable heads: not used, and the ladder keeps its own research, said so. */
  const kiPool = (o) => {
    const x = o || {}; const mode = low(x.mode); const mk = S(x.market);
    const off = (reason, note) => ({ used: false, reason, run_id: '', rows: [], avoid: [], note: note || '' });
    if (mode !== 'on') return off(mode ? 'ki_' + mode : 'ki_off');
    if (x.killed !== false) return off('killed', 'Keyword intelligence is paused for every website, so this ladder used its own keyword research.');
    const runs = (Array.isArray(x.runs) ? x.runs : []).filter(r => r && low(r.kind) === 'keyword_research' && ['ok', 'partial'].includes(low(r.status)) && (!mk || S(r.market) === mk))
      .sort((a, b) => S(b.finished_at || b.started_at).localeCompare(S(a.finished_at || a.started_at)));
    const cur = runs[0] ? S(runs[0].run_id) : '';
    if (!cur) return off('no_run', 'Keyword intelligence is on, but no finished keyword research is on file for ' + (mk || 'this market') + ', so this ladder used its own keyword research.');
    const all = (Array.isArray(x.rows) ? x.rows : []).filter(r => r && S(r.keyword) && S(r.run_id) === cur && (!mk || S(r.market) === mk));
    const yes = (v) => v === true || v === 'true';
    const pass = all.filter(r => low(r.gate) === 'pass' && low(r.verdict) !== 'gated');
    const anyHead = pass.some(r => yes(r.is_head));
    const heads = pass.filter(r => !anyHead || yes(r.is_head));
    const avoid = all.filter(r => low(r.gate_reason) === 'avoid').map(r => S(r.keyword));
    const min = Number(x.min) > 0 ? Number(x.min) : 3;
    if (heads.length < min) return { ...off('too_few', 'Keyword intelligence holds only ' + heads.length + ' usable search' + (heads.length === 1 ? '' : 'es') + ' for ' + (mk || 'this market') + ' (at least ' + min + ' are needed), so this ladder used its own keyword research.'), run_id: cur, avoid };
    return { used: true, reason: '', run_id: cur, rows: heads, avoid,
      note: 'The supporting pages come from keyword intelligence: ' + heads.length + ' search groups of its last keyword research (' + cur + '), one search per group, with its verdict, page action and Search Console position.' };
  };

  return { CFG, STAGES, COMMERCIAL, kiPool, ranksFor, urlKey, pathOf, isBlog, copyOf, wordsKey, sameSearch, ownerOf, plannedUrl, headTarget, oneUrl,
    stageOf, isCommercial, isDefinitional, definitionalOk, stageText, countryName, market, marketRefusal, verdictStop, stuck, rungState };
})();
// LADDER PACKAGE (2026-11-09, rule 6; build_v4.py section 183): keyword intelligence's stored picture as the ladder's pool, read ONCE here and
// through KI's own read gate (KI.readable: the kill switch, the website's mode exactly 'on', a row that passed the gate; fails closed), then
// narrowed to the latest finished keyword research of this market (LRU.kiPool, CONTRACTS KI_ROW_CURRENT). Ladder Requests (which pulls to
// skip) and Ladder Pool (the pool itself) read this node's answer, never the table. A website in `trial` or off keeps its own research.
const d = $('Parse Verdict').first().json || {};
const rowsOf = (n) => { try { return $(n).all().map(i => i.json || {}).filter(r => r && !r.error && Object.keys(r).length); } catch (e) { return null; } };
const sid = 'site_' + String(d.domain || '').toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9]+/g, '-');
const mons = rowsOf('Load Monitors (Ladder)'); const kill = rowsOf('Load KI Kill (Ladder)');
const mon = (mons || []).find(r => String(r.site_id || '') === sid) || {};
const killed = kill === null ? null : kill.some(r => String(r.key || '') === 'ki:kill' && /^(1|true|on|yes)$/i.test(String(r.value || '').trim()));
const mode = String(mon.ki_mode || '').trim().toLowerCase();
const ctx = { killed: killed === null ? true : killed, mode, own_domain: String(d.domain || '') };
const all = rowsOf('Load KI Keywords (Ladder)') || [];
const readable = all.filter(r => String(r.site_id || '') === sid && KI.readable(r, ctx));
const avoid = all.filter(r => String(r.site_id || '') === sid && String(r.gate_reason || '').toLowerCase() === 'avoid').map(r => String(r.keyword || ''));
let iso = ''; try { iso = String($('Normalize Input').first().json.country_iso || d.country_iso || ''); } catch (e) { iso = String(d.country_iso || ''); }
const P = LRU.kiPool({ mode, killed, rows: readable, runs: rowsOf('Load KI Runs (Ladder)') || [], market: iso.toUpperCase() + '-' + String(d.language_code || 'en') });
// the AVOID rows are gated, so KI.readable never hands them out: they are kept apart, only to STOP a rung (rule 4), and only from the current run
const cur = P.run_id;
const avoidCur = cur ? all.filter(r => String(r.site_id || '') === sid && String(r.run_id || '') === cur && String(r.gate_reason || '').toLowerCase() === 'avoid').map(r => String(r.keyword || '')) : [];
return [{ json: { ki_pool: { ...P, avoid: P.used ? avoidCur.slice(0, 200) : [], mode, rows_read: all.length, rows_readable: readable.length } } }];
