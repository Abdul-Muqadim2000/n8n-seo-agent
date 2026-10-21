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
      'u', 'zatca', 'mof', 'mohre', 'dubai', 'abudhabi', 'investindubai', 'gdrfad', 'moec', 'tdra'])],
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
  const kindOf = (domain, url, title, snippet, own) => {
    const hk = kindOfHost(domain || url, own);
    if (hk !== 'business') return { kind: hk, label: LABEL[hk] || hk, by: 'host' };
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
    serps.forEach((s, si) => {
      const kw = S(s.keyword).trim();
      const seenHere = new Set();
      for (const it of s.items) {
        if (!it || (it.type && it.type !== 'organic')) continue;
        const h = host(it.domain || it.url); if (!h) continue;
        const pos = Number(it.rank_group || it.rank_absolute || it.rank || it.position) || 99;
        const k = kindOf(h, it.url, it.title, it.description || it.snippet, own);
        const d = k.by === 'host' ? h : reg(h);
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
  return { kindOf, kindOfHost, kindOfResult, select, weight, host, reg, LABEL };
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
  // the compact form of one item: enough for every reader of this codebase (organic order and owners, page titles, PAA, related searches,
  // forum threads, the featured snippet, the AI Overview and its cited sources, which features were on the page), nothing else
  const compactItem = (x) => {
    const t = S(x && x.type); const o = { type: t, rank_group: Number(x.rank_group) || null, rank_absolute: Number(x.rank_absolute) || null };
    if (t === 'organic') { o.url = cut(x.url, 300); o.domain = cut(x.domain, 100); o.title = cut(x.title, CFG.title_len); o.description = cut(x.description, CFG.desc_len); return o; }
    if (t === 'people_also_ask') { o.items = (x.items || []).slice(0, 10).map(q => ({ title: cut(q && (q.title || q.question), 200) })).filter(q => q.title); return o; }
    if (t === 'related_searches') { o.items = (x.items || []).slice(0, 12).map(q => cut(typeof q === 'string' ? q : (q && (q.title || q.keyword)), 120)).filter(Boolean); return o; }
    if (t === 'discussions_and_forums') { o.items = (x.items || []).slice(0, 6).map(q => ({ title: cut(q && q.title, CFG.title_len), domain: cut(q && (q.domain || q.source), 80), url: cut(q && q.url, 240) })); return o; }
    if (t === 'featured_snippet') { o.domain = cut(x.domain, 100); o.url = cut(x.url, 300); o.title = cut(x.title, CFG.title_len); o.description = cut(x.description || x.text, 400); return o; }
    if (t === 'ai_overview') {
      o.asynchronous_ai_overview = x.asynchronous_ai_overview === true;
      o.references = (x.references || []).slice(0, 12).map(ref);
      let left = CFG.aio_text_len;
      o.items = (x.items || []).slice(0, 8).map(y => { const tx = cut(y && (y.text || y.markdown), Math.max(0, left)); left -= tx.length;
        return { title: cut(y && y.title, CFG.title_len), text: tx, references: ((y && y.references) || []).slice(0, 6).map(ref) }; });
      return o;
    }
    if (t === 'local_pack' || t === 'map') { o.domain = cut(x.domain, 100); o.url = cut(x.url, 300); o.title = cut(x.title, CFG.title_len); return o; }
    return o;
  };
  // a fresh answer -> the reading to store (null when it is not a reading: a failed read is never stored)
  const reading = (res, body, opts) => {
    const st = status(res); if (st === 'failed') return null;
    const o = opts || {}; const t = task0(res); const r0 = ((t.result || [])[0]) || {};
    const b = body || (t.data || {}); const id = ident({ ...(t.data || {}), ...b }); const nd = need(b);
    const at = isoOf(r0.datetime) || isoOf(o.now) || new Date().toISOString();
    const items = Array.isArray(r0.items) ? r0.items : [];
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
// B2-4 (2026-10-15, benchmark area 2, criterion K7): the rung candidates' results pages, read once, turned into clusters of searches
// Google answers with the SAME pages. Keyword Insights, whose convention this is, compares the TOP 7 at a 40% threshold - "the overlap
// setting was originally 1-10, it now runs from 1-7 because Google no longer reliably shows 10 traditional links" - which is B2-6, and
// which the owner approved on 2026-10-15; `KWI.serpClusters` takes both numbers as options so discovery keeps the shape it was measured
// on. This node also passes the pool item through unchanged, so everything downstream of it is untouched.
//   INVARIANTS rule 1: a keyword whose results page could not be read twice is `not_compared` WITH ITS REASON. It is not clustered, it
// is not scored on, and it is not dropped either - it keeps its own group in the plan, and the plan prints how many could not be
// compared. A cluster built from fewer keywords than were asked for says so (`compared` against `asked`).
const pool = $('Ladder Pool').first().json;
const reqs = (() => { try { return $('Ladder Cluster Requests').all().map(i => i.json); } catch (e) { return []; } })();
const asked = reqs.filter(r => r && r.cluster_check);
const plan0 = reqs[0] || {};
const first = (() => { try { return $('Run Ladder Cluster SERP').all().map(i => i.json); } catch (e) { return []; } })();
const retryItems = (() => { try { return $('Ladder Cluster Retry').all().map(i => i.json).filter(x => x && x.is_retry); } catch (e) { return []; } })();
const retryAnswers = (() => { try { return $('Run Ladder Cluster SERP (Retry)').all().map(i => i.json); } catch (e) { return []; } })();
// KW-SERP (RV-12, 2026-10-21): the keywords whose results page was read earlier today (by any path) were not sent; their reading is used
// as it is, at no cost. `sent` is what went to DataForSEO, in the order of its answers; without the split node every asked keyword was sent.
const lowQ = (q) => String((q || {}).keyword || '').toLowerCase().trim();
const sent = (() => { try { return $('Ladder SERP Cache Split').all().map(i => i.json).filter(r => r && r.cluster_check); } catch (e) { return asked; } })();
const sentAt = new Map(sent.map((q, i) => [lowQ(q), i]));
const cacheRows = (() => { try { return $('Load SERP Cache (Ladder)').all().map(i => i.json).filter(r => r && r.key); } catch (e) { return []; } })();
const hitOf = (q) => (sentAt.has(lowQ(q)) ? null : SC.lookup(cacheRows, { keyword: q.keyword, location_code: q.location_code, language_code: q.language_code || 'en', depth: 30, load_async_ai_overview: true }));

const out = { available: false, asked: asked.filter(r => !r.supporting_check).length, supporting_asked: asked.filter(r => r.supporting_check).length, compared: 0, failed: 0, retried: retryItems.length, retry_answered: 0,
  cap: plan0.cap ?? KWI.CFG.ladder_serp_checks, cap_basis: plan0.cap_basis || '', candidates: plan0.candidates || 0, on_topic: plan0.on_topic || 0,
  left_uncompared: plan0.left_uncompared || 0, price_usd: KWI.CFG.serp_check_usd, cost_usd: 0, cost_basis: '', top_n: 7, min_overlap_pct: 40,
  min_shared_urls: 3, clusters: [], of_keyword: {}, not_compared: [], skip_reason: String(plan0.skip_reason || ''), note: '', read_today: 0, read_today_note: '' };

// KW-COMP (2026-10-21, RV-6): who this ladder competes with, from the results pages the run already bought (the main keyword's own page
// and every rung keyword's page read below): a business that ranks on several of them, weighted by position, the declared ones first;
// job boards, directories, authorities, help subdomains and the rest are passed over with their kind (CMP). Nothing new is bought.
const cmpSerps = [];
const headSerp = (pool.competitors_summary || []).filter(c => c && (c.domain || c.url)).map(c => ({ type: 'organic', domain: c.domain, url: c.url, title: c.title, description: c.snippet, rank_group: Number(c.rank) || null }));
if (headSerp.length) cmpSerps.push({ keyword: String(pool.keyword || ''), items: headSerp });
const ladderCompetitors = () => { const r = CMP.select({ serps: cmpSerps, declared: pool.competitors || ((pool.site_model || {}).competitors) || [], own_domain: pool.domain, n: 5 });
  return { picked: r.picked, excluded: r.excluded.slice(0, 12), too_few: r.too_few.slice(0, 5), serps_read: r.serps_read, min_serps: r.min_serps, note: r.note }; };
if (!asked.length) {
  out.competitors = ladderCompetitors();
  out.cost_basis = 'no results page was bought on this run, so nothing was spent on comparing the rungs';
  out.note = out.skip_reason ? 'The rung keywords were not compared on their results pages: ' + out.skip_reason + '.' : '';
  return [{ json: { ...pool, serp_clusters: out } }];
}

// the two attempts, judged by the one shared rule (R18): a task error inside an HTTP 200 is a failure, whatever its number
const stats = RT.stats(first, {}, retryItems, retryAnswers);
const answers = stats.answers || [];
out.failed = stats.failed; out.retry_answered = stats.retry_answered;

// R28: a task's cost counts once, by its own id - the figure the plan prints is money that moved, never the price it was quoted
const seen = new Set(); let spent = 0; let noId = 0;
for (const a of [...first, ...retryAnswers]) {
  for (const t of (Array.isArray((a || {}).tasks) ? a.tasks : [])) {
    const c = Number((t || {}).cost || 0); if (!c) continue;
    const id = String((t || {}).id || '');
    if (!id) { noId++; spent += c; continue; }
    if (seen.has(id)) continue;
    seen.add(id); spent += c;
  }
}
out.cost_usd = +spent.toFixed(4);
out.tasks = seen.size + noId;
const hits = asked.map(q => hitOf(q)).filter(h => h && h.hit);
out.read_today = hits.length;
out.read_today_note = hits.length ? hits.length + ' results page(s) were ' + hits[0].text + ' and used again at no cost' : '';
out.cost_basis = 'measured: ' + out.tasks + ' results-page call(s) at what each task reported, counted once by task id'
  + (noId ? ' (' + noId + ' with no task id of their own)' : '') + '; the cap for this run was ' + out.cap + ' keyword(s)'
  + (out.cap_basis ? ' - ' + out.cap_basis : '') + (out.read_today ? '; ' + out.read_today_note : '') + '.';

const organicItems = (res) => { try {
  const items = ((((res || {}).tasks || [])[0] || {}).result || [])[0].items || [];
  return items.filter(x => x && x.type === 'organic' && (x.url || x.domain)).sort((a, b) => (Number(a.rank_group) || 99) - (Number(b.rank_group) || 99)).slice(0, 10);
} catch (e) { return []; } };
const organic = (res) => organicItems(res).map(x => String(x.url || x.domain || '')).filter(Boolean);   // the item's own URL; a bare domain is left bare (KWI.urlKey normalises either)

const entries = [];
// F-A1 / A-10: the main page's supporting keywords (asked with `supporting_check`) are read, never clustered with the rungs - they are
// compared with the main keyword's own results page in Ladder Plan, by the same rule (urls_of carries every list at the compared depth)
const supportingEntries = []; out.supporting_not_compared = [];
// F-A1 / A-11: what KIND of page Google ranks for each rung keyword, from the titles and addresses this call already bought (KWI.serpPageTypes)
out.types_of = {}; out.titles_of = {};
asked.forEach((q) => {
  const h = hitOf(q); const i = sentAt.has(lowQ(q)) ? sentAt.get(lowQ(q)) : -1;
  const a = h && h.hit ? h.response : (i >= 0 ? answers[i] : undefined);
  const v = RT.check(a, {});
  const miss = { push: (x) => { if (q.supporting_check) out.supporting_not_compared.push(x); else out.not_compared.push(x); } };
  if (!v.ok) { miss.push({ keyword: q.keyword, reason: v.why || 'no answer', retried: retryItems.some(r => Number(r.retry_of) === i) }); return; }
  const urls = organic(a);
  if (urls.length < KWI.CFG.min_urls) { miss.push({ keyword: q.keyword, reason: 'its results page carried only ' + urls.length + ' ordinary result(s), too few to compare', retried: false }); return; }
  const its = organicItems(a);
  out.types_of[String(q.keyword).toLowerCase()] = (({ read, dominant, dominant_count, dominant_share, counts }) => ({ read, dominant, dominant_count, dominant_share, counts }))(KWI.serpPageTypes(its.slice(0, out.top_n).map(x => ({ url: x.url || x.domain, title: x.title || '' })), {}));
  out.titles_of[String(q.keyword).toLowerCase()] = its.slice(0, 4).map(x => String(x.title || '').replace(/\s+/g, ' ').trim().slice(0, 90)).filter(Boolean);
  (q.supporting_check ? supportingEntries : entries).push({ keyword: q.keyword, urls, weight: Number(q.weight) || 0, volume: q.volume });
  if (String(q.keyword || '').toLowerCase() !== String(pool.keyword || '').toLowerCase()) cmpSerps.push({ keyword: q.keyword, items: its });
});
out.compared = entries.length;
out.competitors = ladderCompetitors();
out.supporting_compared = supportingEntries.length;

const overlap = KWI.serpClusters(entries, { top_n: out.top_n, min_overlap: out.min_overlap_pct / 100 });
out.min_shared_urls = overlap.min_shared_urls;
out.clusters = overlap.clusters;
out.clustered = overlap.clustered;
out.compared_keywords = overlap.compared_keywords || entries.map(e => String(e.keyword).toLowerCase());   // R40: compared BY NAME, so the plan never assumes it
out.urls_of = { ...(overlap.urls_of || {}) };
for (const e of supportingEntries) out.urls_of[String(e.keyword).toLowerCase()] = [...new Set(e.urls.map(KWI.urlKey).filter(Boolean))].slice(0, out.top_n);
for (const cl of overlap.clusters) for (const m of (cl.keywords || []))
  out.of_keyword[m.keyword] = { head_keyword: cl.head_keyword, shared_urls: m.shared_urls, keyword_count: cl.keyword_count, urls_compared: cl.urls_compared,
    ...(m.via ? { via: m.via, shared_with_head: m.shared_with_head } : {}) };
out.available = out.compared >= 2;
out.partial = out.compared > 0 && out.compared < out.asked;
out.note = !out.available
  ? out.compared + ' of the ' + out.asked + ' rung keyword(s) could have their results page read, which is too few to compare, so the rungs are grouped by topic instead.'
  : 'The results pages of ' + out.compared + ' of the ' + out.asked + ' rung keyword(s) were read and compared: searches sharing '
    + out.min_shared_urls + ' of their top ' + out.top_n + ' pages (' + out.min_overlap_pct + '%) are one page, not two'
    + (out.clusters.length ? ' - ' + out.clusters.length + ' group(s) covering ' + out.clustered + ' keyword(s)' : ' - no two of them share one')
    + '. ' + out.cost_basis;
if (out.supporting_compared || out.supporting_not_compared.length) out.note += ' ' + out.supporting_compared + ' supporting keyword(s) the verdict proposed for the main page were read as well'
  + (out.supporting_not_compared.length ? ' (' + out.supporting_not_compared.length + ' could not be)' : '') + ', so each one is kept on the main page only if Google answers it with the main keyword\'s own pages.';
if (out.not_compared.length) out.note += ' ' + out.not_compared.length + ' keyword(s) could not be compared and were left in their own group: '
  + out.not_compared.slice(0, 5).map(x => '"' + x.keyword + '" (' + x.reason + ')').join(', ') + (out.not_compared.length > 5 ? ' …' : '') + '.';
return [{ json: { ...pool, serp_clusters: out } }];
