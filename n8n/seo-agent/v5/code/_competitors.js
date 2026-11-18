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
  // KIT-LINEAR (2026-11-18, CodeQL on PR #71): s cut at the first of `chars` with no line break after it, which is exactly
  // s.replace(/[chars].*$/, '') in one pass (that pattern backtracks over every "#" of "####...\n": quadratic on a crafted address)
  const cutTail = (s, chars) => { let i = s.length; while (i > 0 && !'\n\r\u2028\u2029'.includes(s[i - 1])) i--;
    for (; i < s.length; i++) if (chars.includes(s[i])) return s.slice(0, i); return s; };
  const host = (h) => cutTail(S(h).toLowerCase().trim().replace(/^[a-z]+:\/\//, '').replace(/^www\d?\./, ''), '/?#:').replace(/\.$/, '');
  const reg = (h) => { const x = host(h); const p = x.split('.').filter(Boolean); if (p.length <= 2) return x;
    const sl = p.slice(-2).join('.'); return /^(co|com|org|net|gov|ac|edu|ltd|plc|sch|nic|mil|gob|gouv)\.[a-z]{2}$/.test(sl) ? p.slice(-3).join('.') : sl; };
  const LABEL = { you: 'your own site', job: 'job board', directory: 'business directory', marketplace: 'marketplace or freelance platform',
    review: 'review or comparison site', media: 'news or media site', gov: 'government or free-zone authority', search: 'search engine',
    social: 'social network', qa: 'Q&A site or forum', help: 'help, docs or community pages of another product', education: 'course or education provider',
    reference: 'encyclopedia or reference site', platform: 'global software platform', list: 'list of companies, not a seller', business: 'business', unknown: 'unreadable address' };
  // the name, then only a public suffix (indeed.com, uk.indeed.com, indeed.ae, x.co.uk): a business's own subdomain "connect.acme.com" is not "connect"
  // KIT-LINEAR: a host list is read label by label, never built into a pattern: test(h) is true when the host ends in one of `names` as
  // whole labels, then one public ending (SUF_ONE or two letters) and an optional two-letter country. The same answer as the pattern
  // /(^|\.)(names)\.(?:com|net|org|co|io|ai|info|biz|me|tv|ly|app|fyi|news|[a-z]{2})(?:\.[a-z]{2})?$/ it replaces (CR17 CodeQL test).
  const SUF_ONE = new Set(['com', 'net', 'org', 'co', 'io', 'ai', 'info', 'biz', 'me', 'tv', 'ly', 'app', 'fyi', 'news']);
  const cc2 = (l) => /^[a-z]{2}$/.test(l);
  const alt = (names) => { const set = new Set(names); const most = Math.max(1, ...names.map(n => n.split('.').length));
    return { names, test: (h) => { const p = String(h).split('.');
      for (const k of [1, 2]) {   // the ending: one label, or one label plus a two-letter country
        const e = p.length - k; if (e < 1 || !(SUF_ONE.has(p[e]) || cc2(p[e])) || (k === 2 && !cc2(p[e + 1]))) continue;
        for (let j = 1; j <= most && j <= e; j++) if (set.has(p.slice(e - j, e).join('.'))) return true;
      }
      return false; } }; };
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
  const LIST_AR = /(أفضل\s*(?:\d+\s*)?شركات|قائمة)/;   // KIT-LINEAR: \s*\d*\s* (two space runs side by side) backtracked on long space runs
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
  // KIT-LINEAR: the parts of a title around "|" (any spaces) and a spaced " - ", " \u2013 ", " \u2014 ", " : ", exactly what
  // split(/\s+[|\u2013\u2014:-]\s+|\s*\|\s*/) gives, in one pass (that pattern re-read every space of a long run from each space)
  const isWs = (c) => /\s/.test(c);
  const titleParts = (t) => { const out = []; const n = t.length; let seg = '', i = 0;
    const skipWs = (k) => { while (k < n && isWs(t[k])) k++; return k; };
    while (i < n) {
      if (t[i] === '|') { out.push(seg); seg = ''; i = skipWs(i + 1); continue; }
      if (isWs(t[i])) { const j = skipWs(i);
        if (j < n && (t[j] === '|' || ('\u2013\u2014:-'.includes(t[j]) && j + 1 < n && isWs(t[j + 1])))) { out.push(seg); seg = ''; i = skipWs(j + 1); continue; }
        seg += t.slice(i, j); i = j; continue; }
      seg += t[i]; i++;
    }
    out.push(seg); return out; };
  const GOV_NAME_T = { test: (t) => titleParts(S(t)).map(x => x.trim()).filter(Boolean).some(x => GOV_NAME_SEG.test(x)) };
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
  // ---- CR17-F (2026-11-17, client report C5, build section 196): ONE role per site, for every screen and every engine path ----
  // devaicon.com saw LinkedIn, Clutch and edX called "a competing site of yours" (the Link Builder), and SAP, Salesforce and Oracle as the
  // businesses AI recommends instead of it (AI visibility), while the keyword research labelled the same hosts a platform, a directory and an
  // education site. Five kits held five host lists (_ki.js, _rivals.js, _ai_entities.js, _link_kit.js and this one) and the consumers that put
  // the word "competitor" on screen used the weakest. CMP.role is the one answer; every list below is the union of theirs (the harness holds
  // each kit's list to it, scenarios_cr17_f.js CR17F1).
  //  * CMP.role(host, ctx) -> { role, class, by, reason, words }
  //    role: competitor (sells a comparable service, or chosen by the client), listing (directories, review sites, marketplaces: a place to be
  //    listed, never a rival), also_ranks (platforms, social networks, publishers, education portals, Q&A, code hosts: they rank, they compete
  //    for no customer), authority (government, regulators, standards bodies), software (a maker of software the buyer may consider, named by
  //    AI or ranking: SAP, Salesforce, Zapier), your_platform (the maker of the platform the client builds on, named by its own services:
  //    Microsoft for a Dynamics partner, openedx.org for an Open edX shop), not_competitor (the client said so), you, unknown.
  //    ctx: { own_domain, services, topics, principals, chosen, declared, not_competitors, overrides: { host: 'chosen' | 'not_competitor' },
  //           ki: { host: KI class }, url }. The client's word wins (chosen, then not_competitor), then the platform the client builds on,
  //    then the host lists, then the KI class read from evidence, then the host's own name; a host nothing rules out is a business: competitor.
  //  * CMP.partnerDirectory(url) - a principal's partner / marketplace directory (openedx.org/partners, microsoftpartners.microsoft.com,
  //    appsource.microsoft.com): a place to be listed, whoever's site it is on.
  //  * CMP.listPage(title, url) - a page that lists companies ("AI / Automation Agencies in Pakistan", "/agencies/..."), beyond "best" / "top".
  //  * CMP.oneList({ declared, ki_rows, not_competitors, own_domain, max }) - THE competitor list of a site: what the client declared in Site
  //    settings, plus what it chose on the Competitors page, minus what it marked not a competitor (or dismissed there). Monitors and the app
  //    read this one list.
  //  * CMP.LEFT_OUT - the reason codes (and plain words) of a prospect the competitor gate leaves out; the Link Builder stores the code.
  const RX = alt;   // the role lists use the one host-list reader above (KIT-LINEAR)
  const ROLE_LISTS = {
    // makers of software a buyer may consider (KI PLATFORM_HOSTS / PRINCIPALS, AIE PLATFORMS, CMP platform): never a competitor of a services firm
    software: RX(['microsoft', 'dynamics', 'office', 'azure', 'sap', 'oracle', 'netsuite', 'salesforce', 'hubspot', 'zoho', 'odoo', 'infor', 'epicor', 'ifs', 'unit4', 'sage', 'acumatica',
      'syspro', 'xero', 'quickbooks', 'intuit', 'freshbooks', 'tally', 'tallysolutions', 'workday', 'servicenow', 'shopify', 'magento', 'adobe', 'atlassian', 'notion', 'slack', 'zapier', 'make',
      'monday', 'asana', 'trello', 'clickup', 'airtable', 'freshworks', 'freshdesk', 'zendesk', 'pipedrive', 'intercom', 'mailchimp', 'dropbox', 'box', 'docusign', 'stripe', 'paypal',
      'twilio', 'okta', 'bitrix24', 'insightly', 'keap', 'sugarcrm', 'vtiger', 'creatio', 'openai', 'anthropic', 'nvidia', 'ibm', 'aws', 'apple', 'meta', 'canva', 'figma', 'uipath',
      'automationanywhere', 'blueprism', 'n8n', 'moodle', 'openedx', 'axim', 'totara', 'docebo', 'talentlms', 'cornerstoneondemand', 'wave', 'cloudflare', 'mulesoft', 'tableau', 'qlik',
      'snowflake', 'databricks', 'elastic', 'mongodb', 'redhat', 'vmware', 'cisco', 'google']),
    // places to be listed (CMP directory / review / marketplace, KI DIRECTORY_HOSTS, AIE DIRECTORY, RV NOT_RIVAL directories)
    listing: RX(['clutch', 'themanifest', 'goodfirms', 'sortlist', 'designrush', 'techbehemoths', 'topdevelopers', 'itfirms', 'appfutura', 'f6s', 'g2', 'capterra', 'getapp', 'softwareadvice',
      'trustradius', 'trustpilot', 'peerspot', 'softwaresuggest', 'gartner', 'saashub', 'alternativeto', 'producthunt', 'selecthub', 'financesonline', 'softwareworld', 'crozdesk',
      'technologyadvice', 'appvizer', 'softwarefinder', 'softwareconnect', 'top10erp', 'erpfocus', 'upcity', 'agencyspotter', 'expertise', 'yelp', 'yell', 'yellowpages', '2gis', 'crunchbase',
      'zoominfo', 'dnb', 'kompass', 'hidubai', 'uaeyp', 'serchen', 'bark', 'thumbtack', 'rightfirms', 'techreviewer', 'vendorland', 'builtin', 'zoftwarehub', 'sitejabber', 'comparably',
      'reviews', 'owler', 'cbinsights', 'tracxn', 'pitchbook', 'dubaidirectory', 'uaecompanies', 'yello', 'cybo', 'tradeindia', 'europages', 'expertmarket', 'emiratesyellowpages',
      'selectedfirms', 'featuredcustomers', 'justdial', 'sulekha', 'businesslist', 'ensun', 'wadline', 'softwarereviews', 'sourceforge', 'dubizzle', 'upwork', 'fiverr', 'freelancer',
      'toptal', 'peopleperhour', 'guru', 'appsource.microsoft', 'marketplace.microsoft', 'microsoftpartners.microsoft', 'apps.shopify', 'apps.odoo', 'itprofiles', 'brandmentions', 'connect', 'expatwoman']),
    // they rank, they compete for no customer (CMP social / qa / reference / education / media / search / job, KI PLATFORM_HOSTS publishers and
    // code hosts, KI MEDIA_HOSTS, AIE MEDIA / SOCIAL / RESEARCH, LK social, RV NOT_RIVAL social / news)
    also_ranks: RX(['linkedin', 'lnkd', 'facebook', 'fb', 'instagram', 'twitter', 'x', 'tiktok', 'youtube', 'youtu', 'pinterest', 'threads', 'snapchat', 'vimeo', 'telegram', 'whatsapp',
      'slideshare', 'scribd', 'issuu', 'reddit', 'quora', 'stackoverflow', 'stackexchange', 'superuser', 'serverfault', 'discord', 'spiceworks', 'tumblr', 'medium', 'substack',
      'github', 'gitlab', 'bitbucket', 'npmjs', 'readthedocs', 'wordpress', 'blogspot', 'wix', 'weebly', 'squarespace', 'fandom', 'wikipedia', 'wikimedia', 'wikihow', 'wikidata',
      'britannica', 'investopedia', 'merriam-webster', 'dictionary', 'statista', 'researchgate', 'academia', 'sciencedirect', 'springer', 'ieee', 'arxiv', 'mdpi', 'ncbi',
      'forrester', 'idc', 'mckinsey', 'bcg', 'bain', 'business', 'khaleej', 'marketsandmarkets', 'mordorintelligence', 'grandviewresearch', 'frost',
      'coursera', 'udemy', 'edx', 'simplilearn', 'greatlearning', 'mygreatlearning', 'upgrad', 'udacity', 'datacamp', 'skillshare', 'pluralsight', 'edureka', 'intellipaat',
      'futurelearn', 'khanacademy', 'classcentral', 'w3schools', 'emeritus', 'knowledgehut',
      'google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'yandex', 'ecosia', 'brave', 'chatgpt', 'perplexity', 'gemini', 'claude',
      'indeed', 'glassdoor', 'naukri', 'naukrigulf', 'bayt', 'monster', 'gulftalent', 'rozee', 'mustakbil', 'wuzzuf', 'bebee', 'ziprecruiter', 'jooble',
      'gulfnews', 'khaleejtimes', 'thenationalnews', 'thenational', 'zawya', 'arabianbusiness', 'gulfbusiness', 'reuters', 'bloomberg', 'forbes', 'forbesmiddleeast', 'cnbc', 'bbc', 'cnn',
      'ft', 'wsj', 'techcrunch', 'entrepreneur', 'economist', 'businessinsider', 'arabnews', 'timesofindia', 'dawn', 'tribune', 'propakistani', 'techjuice', 'techradar', 'pcmag', 'zdnet',
      'cio', 'computerweekly', 'itpro', 'techtarget', 'wired', 'theverge', 'engadget', 'mashable', 'venturebeat', 'inc', 'fastcompany', 'hbr', 'nytimes', 'theguardian', 'itp',
      'economymiddleeast', 'wamda', 'magnitt', 'cxotoday', 'tahawultech', 'menabytes', 'analyticsinsight', 'towardsdatascience', 'kdnuggets', 'marktechpost', 'erpresearch',
      'erpsoftwareblog', 'msdynamicsworld', 'dynamicscommunity', 'technologyevaluation', 'panorama-consulting', 'erpnews', 'tradearabia', 'emirates247', 'wam', 'albayan', 'alkhaleej',
      'argaam', 'saudigazette', 'nerdwallet', 'aljazeera', 'alarabiya', 'about', 'linktr', 'carrd', 'bio', 'beacons']),
    // regulators and public bodies whose addresses do not end in .gov (KI GOV_HOSTS, AIE GOV, CMP gov)
    authority: RX(['centralbank', 'cbuae', 'ico', 'fca', 'cma', 'sbp', 'secp', 'pta', 'fbr', 'sama', 'zatca', 'rbi', 'sebi', 'ecb', 'europa', 'edpb', 'vara', 'dfsa', 'fsra',
      'tdra', 'citra', 'qcb', 'cbb', 'cbo', 'cbk', 'mas', 'bnm', 'bis', 'imf', 'worldbank', 'oecd', 'who', 'difc', 'adgm', 'dmcc', 'dafz', 'dafza', 'jafza', 'rakez', 'dso', 'ifza', 'shams',
      'kezad', 'dwtc', 'dubaichamber', 'abudhabichamber', 'dubaided', 'saifzone', 'ajmanfreezone', 'fujairahfreezone', 'hamriyahfz', 'mof', 'mohre', 'u', 'ai.gov', 'peppol', 'openpeppol', 'w3', 'iso']),
    // global consultancies and the Big Four: they sell IT and AI consulting, so they compete (class enterprise; owner decision, HANDOFF_F.md)
    enterprise: RX(['deloitte', 'pwc', 'kpmg', 'ey', 'accenture', 'capgemini', 'cognizant', 'infosys', 'wipro', 'tcs', 'hcltech', 'kearney', 'protiviti', 'grantthornton', 'bdo'])
  };
  // the platform a client builds on, named by its own services (the KI table of principals, kept in step by CR17F1)
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
  // a software maker COMPETES with a client that sells the same kind of software (Odoo for a Dynamics 365 ERP partner, SAP and Oracle for an
  // Odoo partner, Zoho Payroll for a payroll firm: harness accuracy set ai_entities.json T06 T13 T30); for anyone else (an AI or software
  // services firm named next to SAP and Salesforce in an AI-automation answer) it is a software maker. A client "sells" a category when two of
  // its services name it (or one of three or fewer); with no services known nothing can be judged and the maker stays a competitor, as before.
  const SOFT_CAT = {
    erp: { client: /\b(?:erp|dynamics 365|d365|business central|navision|nav|great plains|dynamics (?:gp|ax|nav)|finance (?:&|and) operations|odoo|netsuite|sap|acumatica|sage|syspro|epicor|infor|tally|zoho books|erpnext)\b/i,
      makers: RX(['sap', 'oracle', 'netsuite', 'odoo', 'sage', 'xero', 'quickbooks', 'intuit', 'tally', 'tallysolutions', 'infor', 'epicor', 'ifs', 'unit4', 'acumatica', 'syspro', 'workday', 'microsoft', 'dynamics', 'zoho', 'freshbooks']) },
    crm: { client: /\b(?:crm|salesforce|hubspot|customer engagement|dynamics 365 sales|pipedrive|zoho crm|sugarcrm)\b/i,
      makers: RX(['salesforce', 'hubspot', 'pipedrive', 'freshworks', 'zendesk', 'sugarcrm', 'vtiger', 'creatio', 'bitrix24', 'insightly', 'keap', 'zoho', 'microsoft', 'dynamics', 'oracle', 'sap']) },
    lms: { client: /\b(?:lms|open ?edx|moodle|learning management|e-?learning platform|docebo|totara)\b/i,
      makers: RX(['moodle', 'openedx', 'axim', 'docebo', 'totara', 'talentlms', 'cornerstoneondemand']) },
    payroll: { client: /\b(?:payroll|wps|hr software|hrms|hcm)\b/i, makers: RX(['zoho', 'sage', 'xero', 'quickbooks', 'intuit', 'workday', 'sap', 'oracle']) },
    ecommerce: { client: /\b(?:shopify|magento|woocommerce|e-?commerce platform)\b/i, makers: RX(['shopify', 'magento', 'adobe', 'wix', 'squarespace', 'bigcommerce']) }
  };
  const clientCats = (ctx) => { const o = ctx || {}; const sv = [].concat(o.services || []).map(x => S(x && typeof x === 'object' ? (x.name || x.label || '') : x)).filter(Boolean);
    if (!sv.length) return null; const out = new Set();
    for (const [k, c] of Object.entries(SOFT_CAT)) { const n = sv.filter(x => c.client.test(x)).length; if (n >= 2 || (n >= 1 && sv.length <= 3)) out.add(k); }
    return out; };
  const sellsSameSoftware = (h, ctx) => { const cats = clientCats(ctx); if (cats === null) return true; for (const k of cats) if (SOFT_CAT[k].makers.test(h)) return true; return false; };
  const ROLES = ['competitor', 'listing', 'also_ranks', 'authority', 'software', 'your_platform', 'not_competitor', 'you', 'unknown'];
  // the words a client reads for each role (Rankings "Above you", AI visibility, the Link Builder's left-out list)
  const ROLE_WORDS = { competitor: 'a competitor', listing: 'a directory or list where companies are listed', also_ranks: 'a platform or publisher that also ranks',
    authority: 'a government or public body', software: 'a software maker', your_platform: 'the maker of the platform you work with', not_competitor: 'not a competitor (your choice)',
    you: 'your own site', unknown: 'not a web address' };
  // KI classes -> roles (the KI page's evidence, when the caller has it)
  const KI_ROLE = { direct: 'competitor', adjacent: 'competitor', principal: 'your_platform', directory: 'listing', publisher_list: 'listing', platform: 'also_ranks', media: 'also_ranks',
    education: 'also_ranks', job_board: 'also_ranks', government: 'authority' };
  // CMP host kinds -> roles
  const KIND_ROLE = { job: 'also_ranks', directory: 'listing', review: 'listing', marketplace: 'listing', media: 'also_ranks', gov: 'authority', search: 'also_ranks', social: 'also_ranks',
    qa: 'also_ranks', reference: 'also_ranks', education: 'also_ranks', help: 'also_ranks', platform: 'software' };
  const listOfH = (v) => (Array.isArray(v) ? v : S(v).split(/[,;\n]+/)).map(x => host(x && typeof x === 'object' ? (x.domain || x.host || x.comp_domain) : x)).filter(Boolean);
  const sameOrSub = (h, d) => !!d && (h === d || h.endsWith('.' + d) || reg(h) === reg(d));
  const principalHosts = (ctx) => { const o = ctx || {}; const txt = [].concat(o.services || [], o.topics || []).map(x => S(x && typeof x === 'object' ? (x.name || x.label || '') : x)).join(' | ');
    const out = new Set(listOfH(o.principals)); for (const p of PRINCIPALS) if (p.re.test(txt)) p.hosts.forEach(x => out.add(x)); return [...out]; };
  // a principal's partner / app directory: a place to be listed, whoever's site it is on
  const PARTNER_HOST = /^(microsoftpartners\.microsoft\.com|appsource\.microsoft\.com|marketplace\.microsoft\.com|partner\.microsoft\.com|partners\.salesforce\.com|appexchange\.salesforce\.com|ecosystem\.hubspot\.com|apps\.odoo\.com|apps\.shopify\.com|partnerfinder\.sap\.com|aws\.amazon\.com\/partners|marketplace\.zoho\.com)/;
  const PARTNER_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:partners?|partner-directory|find-a-partner|partner-finder|service-providers|providers|marketplace|solution-providers)(?:\/|$|\?)/i;
  const partnerDirectory = (url) => { const u = S(url).toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, ''); if (!u) return false;
    if (PARTNER_HOST.test(u)) return true; const p = u.replace(/^[^\/?#]+/, '') || '/'; return PARTNER_PATH.test(p); };
  // a page that lists companies: CMP's list rule, or a plural seller noun as its head ("AI / Automation Agencies in Pakistan"), or an address
  // made for listings (/agencies/..., /companies/..., /directory/...)
  const SELLERS_HEAD = /(?:^|[|\-:]\s*)(?:[\w&\/.+-]+\s+){0,5}(?:companies|firms|agencies|providers|consultants|consultancies|vendors|partners|developers|integrators|specialists|studios)(?:\s+(?:in|for|near|across)\s+[\w\s,&-]{2,40})?\s*(?:$|[|\-:(])/i;
  const LISTING_PATH = /\/(?:agencies|companies|firms|vendors|providers|directory|directories|listings?|rankings?|top-[\w-]+)\//i;
  const listPage = (title, url) => { const t = S(title); const p = S(url).replace(/^[a-z]+:\/\/[^\/]+/i, '');
    return kindOfResult(url, title, '') === 'list' || SELLERS_HEAD.test(t) || LISTING_PATH.test(p + '/'); };
  /** CMP.role(host, ctx) -> { role, class, by, reason, words } (see above) */
  const role = (h0, ctx) => {
    const o = ctx || {}; const h = host(h0 && typeof h0 === 'object' ? (h0.domain || h0.host) : h0);
    const out = (r, cls, by, reason) => ({ role: r, class: cls, by, reason, words: ROLE_WORDS[r] || r, host: h, reg: h ? reg(h) : '' });
    if (!h || !/\./.test(h)) return out('unknown', '', 'rule', 'not a web address');
    const own = host(o.own_domain); if (own && sameOrSub(h, own)) return out('you', '', 'rule', 'your own site');
    const R = reg(h);
    const ov = o.overrides && typeof o.overrides === 'object' ? (o.overrides[h] || o.overrides[R] || '') : '';
    const inL = (v) => listOfH(v).some(d => sameOrSub(h, d) || reg(d) === R);
    if (ov === 'not_competitor' || inL(o.not_competitors)) return out('not_competitor', 'user', 'user', 'you marked it as not a competitor');
    if (ov === 'chosen' || inL(o.chosen) || inL(o.declared)) return out('competitor', 'user', 'user', 'you chose it as a competitor');
    const pr = principalHosts(o);
    if (pr.some(d => sameOrSub(h, d))) return out('your_platform', 'principal', 'rule', 'the maker of a platform your services are built on');
    if (/(^|\.)(gov|mil|int|gob|gouv|govt|government)(\.[a-z]{2})?$/.test(h) || /\.(gov|mil)\.[a-z]{2}$/.test(h)) return out('authority', 'government', 'rule', 'a government or public body');
    if (/(^|\.)(edu|ac)\.[a-z]{2}$/.test(h) || /\.edu$/.test(h)) return out('also_ranks', 'education', 'rule', 'a school or university');
    if (ROLE_LISTS.authority.test(h)) return out('authority', 'government', 'rule', 'a government, regulator or standards body');
    if (ROLE_LISTS.listing.test(h)) return out('listing', 'directory', 'rule', 'a directory, review site or marketplace where companies are listed');
    if (ROLE_LISTS.software.test(h)) return sellsSameSoftware(h, o) ? out('competitor', 'software_vendor', 'rule', 'it makes software of a kind you sell') : out('software', 'software', 'rule', 'a maker of software buyers may consider');
    if (ROLE_LISTS.also_ranks.test(h)) return out('also_ranks', 'platform', 'rule', 'a platform, network, publisher or course site that ranks for searches but sells no comparable service');
    if (ROLE_LISTS.enterprise.test(h)) return out('competitor', 'enterprise', 'rule', 'a global consultancy that sells IT and AI services');
    const kc = o.ki && typeof o.ki === 'object' ? (o.ki[h] || o.ki[R] || '') : '';
    if (KI_ROLE[kc]) return out(KI_ROLE[kc], kc, 'ki', 'read from its own pages on the Competitors page');
    const k = kindOfHost(h, own);
    if (k === 'you') return out('you', '', 'rule', 'your own site');
    if (KIND_ROLE[k]) return out(KIND_ROLE[k], k, 'rule', LABEL[k] || k);
    return out('competitor', 'business', 'rule', 'a business site');
  };
  const isCompetitor = (h, ctx) => role(h, ctx).role === 'competitor';
  // the left-out reasons of the competitor gate (the Link Builder stores the code in seo_link_outreach.reason_code; the app reads the words)
  const LEFT_OUT = {
    competitor: 'a competitor of yours: it does not link to a competitor',
    competitor_list: 'a competitor of yours: its own list ranks itself, not you',
    listing: 'a directory or list where companies are listed: add yourself to it instead (see Listings)',
    your_platform: 'the maker of the platform you work with, not a competitor: get listed in its partner directory instead',
    software: 'a software maker, not a competitor: its pages link to its own product, not to service providers'
  };
  /** CMP.oneList({ declared, ki_rows, not_competitors, own_domain, max }) -> { list, chosen, declared, removed } - THE competitor list of a site */
  const oneList = (o0) => {
    const o = o0 || {}; const own = host(o.own_domain); const max = Math.max(1, Number(o.max) || 5);
    const rows = (Array.isArray(o.ki_rows) ? o.ki_rows : []).filter(r => r && r.comp_domain && (!o.site_id || !r.site_id || S(r.site_id) === S(o.site_id)));
    const st = (r) => S(r.status).toLowerCase();
    // FX-LINKS (review R2 M3, 2026-11-18): the client's LATEST decision on a domain wins, whichever row holds it (the market-less row of
    // "Not a competitor" on AI visibility, or a market row of the Competitors page). Site Admin now writes every row of the domain at once;
    // this keeps rows written before that consistent too. A domain with no decision of the client keeps the old rule.
    const at = (r) => { const t = Date.parse(S(r.updated_at)); return Number.isFinite(t) ? t : 0; };
    const latest = new Map();
    for (const r of rows) { if (S(r.status_by) !== 'user' || !['chosen', 'watch', 'dismissed', 'not_competitor'].includes(st(r))) continue;
      const d = host(r.comp_domain); const was = latest.get(d); const offR = ['dismissed', 'not_competitor'].includes(st(r));
      if (!was || at(r) > at(was) || (at(r) === at(was) && offR && !['dismissed', 'not_competitor'].includes(st(was)))) latest.set(d, r); }   // same time (or none): "not a competitor" wins, as before
    const decided = (d) => latest.has(d) ? st(latest.get(d)) : '';
    const chosen = [...new Set(rows.filter(r => st(r) === 'chosen').map(r => host(r.comp_domain)))].filter(d => !decided(d) || decided(d) === 'chosen');
    const offOf = (d) => decided(d) ? ['dismissed', 'not_competitor'].includes(decided(d)) : rows.some(r => host(r.comp_domain) === d && st(r) === 'not_competitor');
    const off = new Set([...listOfH(o.not_competitors), ...[...new Set(rows.map(r => host(r.comp_domain)))].filter(offOf)]);   // the undated list (seo_monitors.not_competitors) has no time to compare: it stays off, as before
    const declared = listOfH(o.declared);
    const list = []; for (const d of [...declared, ...chosen]) { if (!d || (own && sameOrSub(d, own)) || off.has(d) || [...off].some(x => reg(x) === reg(d)) || list.includes(d)) continue; list.push(d); }
    return { list: list.slice(0, max), chosen, declared, removed: [...off] };
  };
  return { kindOf, kindOfHost, kindOfResult, govSignal, titleParts, select, weight, host, reg, LABEL, role, isCompetitor, oneList, partnerDirectory, listPage, principalHosts, ROLES, ROLE_WORDS, LEFT_OUT, ROLE_LISTS, PRINCIPALS, KI_ROLE, SOFT_CAT };
})();
