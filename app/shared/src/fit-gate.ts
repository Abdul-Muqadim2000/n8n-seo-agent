// The engine's fit gate (n8n/seo-agent/v5/code/_fit_gate.js), ported rule for rule so the app's mirror of the Content Cadence
// (server/src/services/cadence.ts) refuses exactly the keywords the engine refuses: the website's own brand, another company's brand,
// a public body or an identity document, a login / portal / status task, a job search, and, with the website's topics on file, a
// keyword that is off topic or too broad. Both suites run the same fixture (n8n/seo-agent/harness/fixtures/cadence_levels.json), so a
// difference between this file and the engine's kit fails a test. Change the two together.
//
// fitGate(keyword, ctx) -> { ok: true } or { ok: false, reason, detail }; fitTopic(keyword, topics, opts) -> the topic share;
// fitStored(row, ctx) -> the same gate for a row stored before the gate existed (a written page is kept and only flagged).

export type FitReason = 'own brand' | 'navigational' | 'government' | 'portal' | 'job search' | 'other brand' | 'off topic' | 'too broad' | 'empty';

export interface FitResult {
  ok: boolean;
  reason?: FitReason | string;
  detail?: string;
}

export interface FitContext {
  intent?: string;
  own_domain?: string;
  /** domains the website declared as competitors */
  competitors?: string[];
  /** domains on the keyword's results page (or the ladder's) */
  serp_domains?: string[];
  /** this keyword's own top domains, in rank order */
  serp?: string[];
  /** brand name -> domain, learned from AI answers */
  brands?: Record<string, string>;
  /** words of the head terms / services that never count as a brand */
  protect?: string[];
  /** what the website sells and the keywords chosen: with them, off topic and too broad are judged */
  topics?: string[] | string | null;
  topic_label?: string;
  topic_bar?: number;
  topic_min_words?: number;
  /** fitStored: the row's page is already written */
  written?: boolean;
}

const FIT_CFG = { min_label: 4, serp_top: 5, serp_hold: 3 };
const FIT_STOP = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'my', 'your', 'our', 'is', 'are', 'what', 'how', 'me']);
const FIT_GEO = new Set(['uae', 'u.a.e', 'dubai', 'abu', 'dhabi', 'sharjah', 'ajman', 'fujairah', 'ras', 'al', 'khaimah', 'umm', 'quwain', 'emirates', 'gcc', 'saudi', 'arabia', 'ksa', 'riyadh', 'jeddah', 'qatar', 'doha', 'oman', 'muscat', 'bahrain', 'kuwait', 'egypt', 'india', 'pakistan', 'uk', 'usa', 'us', 'online', 'portal']);
const FIT_GENERIC = new Set(['ai', 'software', 'softwares', 'services', 'service', 'erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'tax', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll', 'finance', 'financial', 'cloud', 'digital', 'online', 'web', 'data', 'tech', 'technology', 'technologies', 'solutions', 'solution', 'systems', 'system', 'business', 'company', 'group', 'global', 'international', 'gulf', 'arab', 'arabia', 'emirates', 'national', 'consulting', 'consultants', 'consultancy', 'partners', 'partner', 'network', 'news', 'blog', 'guide', 'guides', 'info', 'best', 'top', 'free', 'app', 'apps', 'shop', 'store', 'market', 'media', 'academy', 'institute', 'university', 'school', 'bank', 'pay', 'pro', 'plus', 'hub', 'one', 'first', 'smart', 'easy', 'get', 'go', 'ae', 'com', 'net', 'org', 'home', 'house', 'world', 'city', 'daily', 'times', 'post', 'review', 'reviews', 'compare', 'comparison', 'list', 'directory', 'jobs', 'careers', 'businesses', 'companies', 'firms', 'wiki', 'wikipedia', 'youtube', 'linkedin', 'facebook', 'instagram', 'twitter', 'reddit', 'quora', 'medium', 'google', 'microsoft', 'amazon', 'apple']);
const FIT_GOV_WORDS = /\b(ministry|ministries|authority|authorities|federal|government|govt|municipality|municipal|embassy|consulate|police|courts?|customs|immigration|department of|public prosecution|parliament|chamber of commerce|free zone authority)\b/;
const FIT_GOV_NAMES = /\b(fta|emaratax|emara ?tax|tax authority|mohre|mohap|mofa|moec|gdrfa|icp|ica|rta|dewa|sewa|fewa|addc|aadc|dha|doh|ded|tdra|adjd|ejari|dubai land department|dld|dubai economy|dubai courts|zatca|gazt|gosi|qiwa|absher|muqeem|mudad|hrsd|misa|nafath|tawtheeq|uae pass|smart pass|amer cent(er|re)|tasheel|tawjeeh|emirates id|emirates identity|national id|i ?d card|identity card|labou?r card|work permit status|visa status|visa check|passport status|establishment card|golden visa status|trn verification|trn check|trn lookup|tax registration number check)\b/;
const FIT_PORTAL = /\b(log ?in|logins|sign ?in|sign ?up|password|passwords|portal|portals|e ?services?|customer care|customer service number|helpline|toll ?free|contact number|phone number|status|status check|check status|status enquiry|application status|track(ing)? (status|application|order)|renewal|renew|verification|verify|apply online|online application|download (the )?app|app download|complaint|complaints|fine check|traffic fines?|balance check|otp)\b/;
const FIT_CONTENT = /\b(best|top|vs|versus|compar(e|ison)|review|reviews|alternatives?|how to|guide|guides|checklist|requirements?|pricing|price|prices|cost|costs|quote|quotes|hire|consultan(t|ts|cy|cies)|consulting|partner|partners|provider|providers|vendor|vendors|agency|agencies|accredited|approved|certified|compliant|compliance|implementation|integration|integrations|training|course|courses|template|templates|examples?|explained|meaning|benefits|registration|register|filing|return|returns|refund|refunds|deadline|deadlines|penalt(y|ies)|rules?|regulations?|free trial|demo|tutorial|steps|process|procedure)\b/;
const FIT_PARTNER = /\b(partner|partners|partnership|reseller|resellers|implementation|implement|implementer|implementers|consultan(t|ts|cy|cies)|consulting|integration|integrations|integrate|migration|migrate|support|training|developer|developers|development|customi[sz]ation|customi[sz]e|add-?ons?|plugins?|specialist|specialists|expert|experts|agency|agencies|services?)\b/;
const FIT_GOV_SERVICE = /^(attestation|attestations|attest|attested|legali[sz]ation|legali[sz]e|apostille|notari[sz]ation|passport|passports|visa|visas|residency|iqama|renewal|renew|renewing|fines?|penalty|appointment|appointments|booking|stamp|stamping|medical|fitness|typing|cancellation|cancel|replacement|lost|reprint|fees?|charges?|timings?|working|hours|office|offices|centre|center|centres|centers|near|location|locations|track|tracking|apply|application|form|forms|download|print|copy|expiry|expired|validity|valid|enquiry|inquiry|document|documents|certificate|certificates|degree|degrees|diploma|marriage|birth|educational|personal)$/;
const FIT_DOC_SERVICE = /^(attestation|attestations|attest|attested|attesting|apostille|legali[sz]ation|legali[sz]e|notari[sz]ation|notari[sz]e|notary)$/;
const FIT_JOBS = /\b(jobs?|careers?|vacanc(y|ies)|salary|salaries|internships?|walk ?in interviews?|job openings?|cv|resume)\b/;
const FIT_PRODUCT = /\b(software|system|systems|platform|platforms|tool|tools|app|apps|module|modules|solution|solutions|crm|erp|hrms|hcm|ats|portal software)\b/;
const FIT_COMMON = new Set(['management', 'manager', 'document', 'documents', 'processing', 'process', 'processes', 'intelligent', 'intelligence', 'central', 'operations', 'operation', 'operational',
  'project', 'projects', 'field', 'customer', 'customers', 'client', 'clients', 'sales', 'human', 'resources', 'resource', 'commerce', 'commercial', 'supply', 'chain', 'identity', 'model', 'models',
  'predictive', 'virtual', 'desktop', 'studio', 'builder', 'factory', 'pipeline', 'pipelines', 'modernization', 'modernisation', 'enterprise', 'enterprises', 'advanced', 'modern', 'integrated',
  'unified', 'professional', 'premium', 'standard', 'basic', 'core', 'general', 'public', 'private', 'social', 'mobile', 'facility', 'facilities', 'experience', 'insights', 'transformation',
  'innovation', 'value', 'impact', 'productivity', 'efficiency', 'assets', 'asset', 'people', 'team', 'teams', 'growth', 'performance']);
const FIT_COMPARE = /\b(vs|versus|compare|comparison|alternatives?|instead of|better than|difference between|against)\b/;
const FIT_TOPIC_BAR = 0.25;
const FIT_WIDE = new Set(['business', 'businesses', 'company', 'companies', 'firms', 'finance', 'financial', 'tax', 'data', 'digital', 'online', 'web', 'technology', 'technologies', 'tech',
  'solutions', 'solution', 'services', 'service', 'systems', 'system', 'global', 'group', 'national', 'international', 'best', 'top', 'free', 'news', 'jobs', 'careers', 'smart', 'consulting',
  'consultants', 'consultancy', 'partners', 'partner', 'network', 'info', 'guide', 'guides', 'blog', 'list', 'directory', 'review', 'reviews', 'compare', 'comparison', 'pro', 'plus', 'one', 'first',
  'get', 'go', 'easy', 'home', 'world', 'city', 'market', 'media', 'shop', 'store', 'gulf', 'arab', 'arabia', 'emirates', 'google', 'microsoft', 'amazon', 'apple']);

export const fitTokens = (s: unknown): string[] =>
  String(s || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ''))
    .filter((t) => t.length > 1 && !FIT_STOP.has(t));
export const fitHost = (d: unknown): string =>
  String(d || '')
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^(www|m|app|en|ar)\./, '');
const fitGovHost = (d: unknown) => {
  const h = fitHost(d);
  return /(^|\.)gov(\.[a-z]{2,3})?$/.test(h) || /(^|\.)(gouv|gob|go|gv)\.[a-z]{2}$/.test(h) || /(^|\.)mil(\.[a-z]{2})?$/.test(h) || /(^|\.)(u\.ae|government\.ae|dubai\.ae|abudhabi\.ae|sharjah\.ae|ajman\.ae|rak\.ae|tax\.gov\.ae|europa\.eu)$/.test(h);
};
/** the brand label(s) of a domain: "facts.ae" -> ["facts"], "northwind-erp.com" -> ["northwind"] */
export const fitLabels = (domain: unknown, protect: string[] = []): string[] => {
  const h = fitHost(domain);
  if (!h) return [];
  const first = h.split('.')[0];
  const parts = [...new Set([first, ...first.split(/[-_]/)])];
  return parts.map((p) => p.replace(/[^a-z0-9]/g, '')).filter((p) => p.length >= FIT_CFG.min_label && !FIT_GENERIC.has(p) && !FIT_GEO.has(p) && !protect.includes(p));
};
/** the learned "name -> domain" map from seo_cache rows (key ai_brands:<site_id>) */
export const fitLearnedBrands = (rows: unknown[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const r of rows || []) {
    const j = (r && typeof r === 'object' && 'json' in (r as object) ? (r as { json: unknown }).json : r) as { key?: unknown; value?: unknown } | null;
    if (!j || typeof j !== 'object' || !/^ai_brands:/.test(String(j.key || ''))) continue;
    let v: unknown = j.value;
    if (typeof v === 'string') {
      try {
        v = JSON.parse(v);
      } catch {
        v = null;
      }
    }
    if (v && typeof v === 'object') for (const [name, d] of Object.entries(v as Record<string, unknown>)) if (name && d) out[String(name)] = String(d);
  }
  return out;
};

const fitStem = (w: string) => (w.length > 5 ? w.replace(/(ingly|ings|ing|ments|ment|ations|ation|ions|ion|ies|ers|er|ed|es|s|e)$/, '') : w);
const topicList = (topics: string[] | string | null | undefined): string[] => (Array.isArray(topics) ? topics.filter(Boolean).map(String) : [String(topics || '')]);
const fitTopicWords = (topics: string[] | string | null | undefined) =>
  new Set(
    (Array.isArray(topics) ? topics.filter(Boolean).join(' ') : String(topics || ''))
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !FIT_STOP.has(t) && !FIT_GEO.has(t))
      .map(fitStem),
  );
const fitTopicPhrases = (topics: string[] | string | null | undefined) =>
  topicList(topics)
    .map((t) => {
      const w = t.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 2 && !FIT_STOP.has(x) && !FIT_GEO.has(x) && !/^\d+$/.test(x));
      return { dist: [...new Set(w.filter((x) => !FIT_GENERIC.has(x)).map(fitStem))], words: [...new Set(w.map(fitStem))] };
    })
    .filter((p) => p.dist.length)
    .map((p) => ({ ...p, prose: p.dist.length > 6 }));

export interface TopicResult {
  ok: boolean;
  reason: '' | 'off topic' | 'too broad';
  detail: string;
  /** null when nothing was judged (too few topic words on file) */
  share: number | null;
}

/** What share of a keyword's own distinctive words the website's topics carry (the engine's fitTopic). */
export function fitTopic(keyword: string, topics: string[] | string | null | undefined, opts: Pick<FitContext, 'topic_bar' | 'topic_label' | 'topic_min_words'> = {}): TopicResult {
  const bar = typeof opts.topic_bar === 'number' ? opts.topic_bar : FIT_TOPIC_BAR;
  const label = String(opts.topic_label || 'what this website sells');
  const T = fitTopicWords(topics);
  const PH = fitTopicPhrases(topics);
  if (T.size < (typeof opts.topic_min_words === 'number' ? opts.topic_min_words : 12))
    return { ok: true, reason: '', detail: T.size ? `too few topic words on file (${T.size}) to judge topic distance` : 'no topics on file, so topic distance was not judged', share: null };
  const toks = fitTokens(keyword);
  const own = toks.filter((t) => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t));
  const known = [...T];
  const stemHit = (s: string, x: string) => x === s || (x.length >= 5 && s.length >= 5 && (s.indexOf(x) === 0 || x.indexOf(s) === 0));
  const matches = (t: string) => {
    const s = fitStem(t);
    return T.has(s) || known.some((x) => stemHit(s, x));
  };
  const ownStems = toks.filter((t) => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t)).map(fitStem);
  const allStems = toks.filter((t) => t.length > 2 && !FIT_GEO.has(t)).map(fitStem);
  const viaName = (t: string) => {
    const s = fitStem(t);
    return PH.some(
      (ph) =>
        !ph.prose &&
        ph.dist.some((x) => stemHit(s, x)) &&
        (ph.dist.every((x) => ownStems.some((k) => stemHit(k, x))) || ph.words.filter((x) => allStems.some((k) => stemHit(k, x))).length >= 2),
    );
  };
  const matchOwn = (t: string) => (FIT_COMMON.has(t) ? viaName(t) : matches(t));
  if (!own.length) {
    const cats = toks.filter((t) => FIT_GENERIC.has(t) && !FIT_WIDE.has(t)).filter(matches);
    const hasPlace = toks.some((t) => FIT_GEO.has(t));
    if (cats.length >= 2 || (cats.length >= 1 && hasPlace)) return { ok: true, reason: '', detail: `a category you sell (${cats.join(', ')})${hasPlace ? ' in your market' : ''}`, share: 1 };
    return { ok: false, reason: 'too broad', detail: `only category or place words, so it says nothing about ${label} ("${String(keyword || '').trim()}")`, share: cats.length ? 0.5 : 0 };
  }
  const hits = own.filter(matchOwn);
  const share = Math.round((100 * hits.length) / own.length) / 100;
  if (share < bar)
    return {
      ok: false,
      reason: 'off topic',
      detail: `${Math.round(share * 100)}% of its own words match ${label} (${Math.round(bar * 100)}% is the bar): ${own.filter((t) => hits.indexOf(t) < 0).slice(0, 4).join(', ')}. Add it to your services if you do sell it`,
      share,
    };
  return { ok: true, reason: '', detail: `${Math.round(share * 100)}% of its own words match ${label}`, share };
}

const hasTopics = (t: FitContext['topics']) => !!t && (Array.isArray(t) ? t.length > 0 : String(t).trim() !== '');

/** ONE rule for keywords no page of this website should target (the engine's fitGate). */
export function fitGate(keyword: string, ctx: FitContext = {}): FitResult {
  const kw = String(keyword || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const toks = fitTokens(kw);
  const squashed = toks.join('');
  if (!toks.length) return { ok: false, reason: 'empty', detail: 'no keyword' };
  const protect = [...new Set((ctx.protect || []).flatMap((p) => fitTokens(p)))];
  const has = (re: RegExp) => re.test(' ' + kw + ' ');
  const contentWord = has(FIT_CONTENT), partnerWord = has(FIT_PARTNER), compareWord = has(FIT_COMPARE), portalWord = has(FIT_PORTAL);
  for (const l of fitLabels(ctx.own_domain, [])) if (toks.includes(l) || squashed.includes(l)) return { ok: false, reason: 'own brand', detail: `names the website itself (${l})` };
  if (String(ctx.intent || '').toLowerCase() === 'navigational') return { ok: false, reason: 'navigational', detail: 'the search data classifies it as navigational (people look for one particular website)' };
  const govWord = (' ' + kw + ' ').match(FIT_GOV_WORDS);
  if (govWord && !contentWord) return { ok: false, reason: 'government', detail: `a public body, not a topic (${String(govWord[1] || govWord[0]).trim()})` };
  const govName = (' ' + kw + ' ').match(FIT_GOV_NAMES);
  if (govName) {
    const body = String(govName[1] || govName[0]).trim();
    const rest = toks.filter((t) => !fitTokens(body).includes(t) && !FIT_GEO.has(t) && !/^(check|checking|card|number|no|online|status)$/.test(t));
    if (!rest.length || (portalWord && !contentWord)) return { ok: false, reason: 'government', detail: `a public body or an identity document, not a topic (${body})` };
    if (rest.every((t) => FIT_GOV_SERVICE.test(t))) return { ok: false, reason: 'government', detail: `a service a public body provides to a person, not a topic for this website (${body}: ${rest.join(' ')})` };
  }
  const serp = (ctx.serp || []).map(fitHost).filter(Boolean).slice(0, FIT_CFG.serp_top);
  if (serp.length >= FIT_CFG.serp_hold && serp.filter(fitGovHost).length >= FIT_CFG.serp_hold)
    return { ok: false, reason: 'government', detail: `the results page belongs to government sites (${[...new Set(serp.filter(fitGovHost))].slice(0, 3).join(', ')})` };
  const topicT = hasTopics(ctx.topics) ? fitTopicWords(ctx.topics) : null;
  const sells = (re: RegExp) => !!topicT && [...topicT].some((w) => re.test(w));
  const docSvc = toks.filter((t) => FIT_DOC_SERVICE.test(t));
  if (docSvc.length && !sells(/^(attest|apostill|legali|notar)/)) {
    const restD = toks.filter(
      (t) =>
        !FIT_GEO.has(t) &&
        !FIT_DOC_SERVICE.test(t) &&
        !FIT_GOV_SERVICE.test(t) &&
        !FIT_GOV_NAMES.test(' ' + t + ' ') &&
        !/^(online|services?|centre|center|centres|centers|near|price|prices|cost|costs|company|companies|agency|agencies|best|top|cheap|fast|same|day|requirements?|procedure|process|steps)$/.test(t),
    );
    if (!restD.length) return { ok: false, reason: 'government', detail: `a document service public bodies (a ministry, an embassy, a notary) provide to a person (${docSvc.join(' ')}), not a topic for this website` };
  }
  if (portalWord && !contentWord) return { ok: false, reason: 'portal', detail: "a login, portal, status or application task: people want the owner's own site" };
  if (has(FIT_JOBS) && !has(FIT_PRODUCT) && !sells(/^(recruit|staff|hiring|job|career|headhunt|talent)/)) return { ok: false, reason: 'job search', detail: 'people looking for work, not buyers of what this website sells' };
  const rescue = partnerWord || compareWord;
  const leads = (l: string) => {
    const i = toks.indexOf(l);
    return i === 0 || (i > 0 && i + 1 < toks.length && (FIT_GENERIC.has(toks[i + 1]) || protect.includes(toks[i + 1])));
  };
  for (const d of ctx.competitors || []) for (const l of fitLabels(d, protect)) if ((toks.includes(l) || squashed.includes(l)) && !compareWord) return { ok: false, reason: 'other brand', detail: `names a competitor: ${l} (${fitHost(d)})` };
  for (const d of ctx.serp_domains || []) for (const l of fitLabels(d, protect)) if (toks.includes(l) && leads(l) && !rescue) return { ok: false, reason: 'other brand', detail: `names another company on the results page: ${l} (${fitHost(d)})` };
  for (const [name, d] of Object.entries(ctx.brands || {})) {
    const nt = fitTokens(name).filter((t) => !FIT_GENERIC.has(t) && !protect.includes(t));
    if (!nt.length || rescue) continue;
    const phrase = nt.join(' ');
    if ((' ' + toks.join(' ') + ' ').includes(' ' + phrase + ' ') || fitLabels(d, protect).some((l) => toks.includes(l))) return { ok: false, reason: 'other brand', detail: `a brand AI names for another company: ${name} (${fitHost(d)})` };
  }
  if (serp.length >= FIT_CFG.serp_hold) {
    const count: Record<string, number> = {};
    for (const h of serp) count[h] = (count[h] || 0) + 1;
    for (const [h, n] of Object.entries(count)) if (n >= FIT_CFG.serp_hold && fitLabels(h, protect).some((l) => toks.includes(l))) return { ok: false, reason: 'other brand', detail: `${h} holds ${n} of the top ${serp.length} results: a brand query` };
  }
  if (hasTopics(ctx.topics)) {
    const t = fitTopic(kw, ctx.topics, ctx);
    if (!t.ok) return { ok: false, reason: t.reason, detail: t.detail };
  }
  return { ok: true };
}

export interface StoredFit {
  ok: boolean;
  live: boolean;
  flagged: boolean;
  reason: string;
  detail: string;
  note: string;
}

const storedLive = (r: Record<string, unknown>) => {
  const st = String(r.status || '').toLowerCase();
  return st === 'writing' || st === 'written' || st === 'not_ready' || st === 'published' || r.page_exists === true || r.page_exists === 'true' || !!String(r.published_url || '').trim();
};

/** The gate over a row stored before the gate existed: a row whose page is already written is kept, only flagged (the engine's fitStored). */
export function fitStored(row: Record<string, unknown>, ctx: FitContext = {}): StoredFit {
  const kw = String(row.keyword || '').trim();
  const live = storedLive(row) || ctx.written === true;
  if (!kw) return { ok: false, live, flagged: false, reason: 'empty', detail: 'the row has no keyword', note: 'a stored row with no keyword' };
  const g = fitGate(kw, ctx);
  if (g.ok) return { ok: true, live, flagged: false, reason: '', detail: '', note: '' };
  const why = `"${kw}" is not a search this website should target: ${g.detail} (${g.reason})`;
  if (live) return { ok: true, live: true, flagged: true, reason: String(g.reason), detail: String(g.detail), note: `${why}. Its page is already written, so it stays tracked; decide whether to keep it` };
  return { ok: false, live: false, flagged: true, reason: String(g.reason), detail: String(g.detail), note: `${why}. It was planned before this rule existed, so it is set aside instead of written` };
}
