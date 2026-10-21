// ---- shared Search Console query rules (2026-10-12, FIX_PLAN G9 + D24 / P1-3): inlined by the build (the GSC_QUERIES placeholder) into
// Parse GSC (the Site Tracker) and GSC Audit Findings (the audit), so the weekly report and the audit judge a query the same way.
//   * GQ.isScraper(q)  — a query typed by an SEO tool or a scraper, not by a customer (search operators, capital booleans, quoted groups).
//   * GQ.brandTest(..) — brand vs non-brand, from seo_monitors.brand_names / the site model's names, with the domain label as the fallback;
//                        whole tokens only, never a substring (R89, below).
//   * GQ.anonymised(..)— what Search Console withholds: the totals minus the sum of the query rows ("anonymised for privacy").
// D24 (2026-10-11) found scraper queries among techand.ai's top queries; P1-3 (2026-10-12) added the leading minus ("-site:csc.gov.ae") and
// the lower-case booleans Search Console reports. Prose alone never counts: "erp software and accounting for distributors" has no quotes,
// no brackets and no capitals, so it stays a customer query.
const GQ = (() => {
  const OPERATOR = /(^|\s)[-+]?(site|inurl|intitle|intext|inanchor|allintitle|allinurl|allintext|filetype|ext|related|cache|link|before|after|daterange):\S/i;
  const BOOL_CAPS = /(^|[\s")])(AND|OR|\|)([\s("]|$)/;
  const BOOL_ANY = /(^|[\s")])(and|or|\|)([\s("]|$)/i;
  const GROUPED = /"[^"]+"|\([^)]+\)/;   // a quoted phrase or a bracketed group
  const isScraper = (q) => { const s = String(q || ''); return OPERATOR.test(s) || BOOL_CAPS.test(s) || (GROUPED.test(s) && BOOL_ANY.test(s)); };
  const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  // every brand form worth matching: the monitor / model names, the business name and the domain's label ('techand' matches 'tech and', 'techand ai')
  const brandKeys = (domain, names) => {
    const keys = [];
    const push = (x) => { const k = squash(x); if (k.length >= 4 && !keys.includes(k)) keys.push(k); };
    push(String(domain || '').split('.')[0]);
    for (const n of (names || [])) { const s = String(n || '').trim(); if (!s) continue; push(/\./.test(s) ? s.split('.')[0] : s); }
    return keys;
  };
  // ---- R89 (2026-10-16, re-rating defect C-13): the brand test squashed the query ("technology and analytics" -> "technologyandanalytics")
  // and looked for a key INSIDE it, and "Tech&" squashed to the key "tech" — so "technology & data", "tech and software" and
  // "techandkey com" were all counted as searches for the business (exec 634: "brand = techand, tech"). The outreach kit solved the same
  // problem for "Tech&" on 2026-10-12 (MIN_NAME_RUN); this is that rule for search queries:
  //   * a key is matched as WHOLE tokens of the query: one token equal to it ("techand"), or consecutive tokens that join to it with no
  //     filler word between them ("northwind erp" -> "northwinderp") — never a substring, so "techandkey" is another word; a join
  //     ACROSS a filler word ("tech and" -> "techand") is the name spoken, and counts only as the whole query ("tech and ai" yes,
  //     "tech and software" no);
  //   * a name whose letters are shorter than MIN_NAME_RUN once its punctuation is gone ("Tech&") is never a key on its own: it counts
  //     only written or spoken as itself ("tech&", "tech and"), and only as the whole query (with the site's own domain ending at most),
  //     because "tech and software" is a description, not a search for the business.
  const MIN_NAME_RUN = 5;
  const FILLER = new Set(['and', 'the', 'of', 'for', 'to', 'in', 'on', 'at', 'a', 'an', 'or', 'by', 'with', 'vs', 'near', 'me', 'from']);
  const qTokens = (q) => String(q || '').toLowerCase().replace(/&/g, ' and ').split(/[^a-z0-9]+/).filter(Boolean);
  // A-26: optimal string alignment distance (a swap of two neighbouring letters is one edit: "techadn" = "techand" misspelt once)
  const FUZZY_MIN = 6;
  const editDistance = (a, b) => { const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) { const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); }
    return d[m][n]; };
  const brandTest = (domain, names) => {
    const keys = brandKeys(domain, names);
    const tld = String(domain || '').toLowerCase().split('.').slice(1).filter(Boolean);
    const long = keys.filter(k => k.length >= MIN_NAME_RUN || !/[^a-z0-9\s.]/i.test(String((names || []).find(n => squash(n) === k) || '')));
    // the short punctuated names ("Tech&"): their own written / spoken forms, matched as the whole query
    const spoken = [];
    for (const n of (names || [])) { const s = String(n || '').trim(); if (!s || /\./.test(s)) continue; const k = squash(s);
      if (k.length >= MIN_NAME_RUN || !/[^a-z0-9\s]/i.test(s)) continue; const toks = qTokens(s); if (toks.length && !spoken.some(x => x.join(' ') === toks.join(' '))) spoken.push(toks); }
    const longKeys = long;
    const is = (q) => {
      const t = qTokens(q); if (!t.length) return false;
      const onlyDomain = (rest) => rest.every(x => tld.includes(x) || x === 'com' || x === 'www');
      for (const k of longKeys) {
        if (k.length < 4) continue;
        for (let i = 0; i < t.length; i++) { let j = i, acc = '', filler = false;
          while (j < t.length && acc.length < k.length) { if (j > i && FILLER.has(t[j])) filler = true; acc += t[j]; j++;
            // a join across a filler word ("tech and" -> "techand") is the name SPOKEN, so it counts only as the whole query
            if (acc === k && (!filler || (i === 0 && onlyDomain(t.slice(j))))) return true; } } }
      for (const sp of spoken) { const rest = t.slice(0, sp.length).join(' ') === sp.join(' ') ? t.slice(sp.length) : null;
        // RV-15 (2026-10-21): the name followed only by its own words ("tech and tech", typed for "Tech&") is still the name, not a search for
        // something else; it was reported as two of the site's pages competing for one search
        if (rest && rest.every(x => tld.includes(x) || x === 'com' || x === 'www' || sp.includes(x))) return true; }
      // A-26 (2026-10-17, exec 764): "techandf cc" — the brand typed with one slip — was taken as a customer search, used as a discovery
      // seed and reported as a page mismatch ("aim that page at it"). A token (or two adjacent tokens with no filler word between them)
      // within one edit of a brand key of 6+ letters (two edits from 10 letters), starting with the same two letters, is the brand misspelt.
      for (const k of longKeys) {
        if (k.length < FUZZY_MIN) continue;
        const lim = k.length >= 10 ? 2 : 1;
        for (let i = 0; i < t.length; i++) {
          const cands = [t[i]]; if (i + 1 < t.length && !FILLER.has(t[i + 1]) && !FILLER.has(t[i])) cands.push(t[i] + t[i + 1]);
          for (const w of cands) if (w.length >= 5 && w !== k && w.slice(0, 2) === k.slice(0, 2) && Math.abs(w.length - k.length) <= lim && editDistance(w, k) <= lim) return true;
        }
      }
      return false; };
    const shown = [...longKeys, ...spoken.map(t => t.join(' '))];
    return { keys: shown, is: shown.length ? is : () => false };
  };
  // Search Console never names the queries of rare searches: the dimensionless/date totals hold them, the query rows do not
  const anonymised = (totals, rows) => {
    const t = totals || {}; const sum = (rows || []).reduce((a, r) => ({ clicks: a.clicks + (Number(r.clicks) || 0), impressions: a.impressions + (Number(r.impressions) || 0) }), { clicks: 0, impressions: 0 });
    const ti = Number(t.impressions) || 0, tc = Number(t.clicks) || 0;
    const im = Math.max(0, ti - sum.impressions), cl = Math.max(0, tc - sum.clicks);
    return { clicks: cl, impressions: im, clicks_pct: tc ? Math.round(cl / tc * 1000) / 10 : 0, impressions_pct: ti ? Math.round(im / ti * 1000) / 10 : 0,
      named_clicks: sum.clicks, named_impressions: sum.impressions, note: 'Search Console withholds the queries of rare searches; these clicks and impressions are real but belong to queries it does not name.' };
  };
  // ---- C-6 (re-rating 2026-10-17): a search for ANOTHER website is not a quick win ----
  // "techandkey com" (411 impressions; techandkey.com is "TechAndKey - Latest Tech News") was correctly not a brand search (R89) and was then
  // recommended as a striking-distance quick win, a low-CTR "rewrite titles" item and a cannibalisation pair. A navigational search for a
  // site that is not this one - one name followed by a domain ending ("techandkey com"), or a written domain ("techandkey.com") - is set
  // aside like a scraper query: counted in the totals, never in a list of things to do. Returns that site, or ''.
  const NAV_TLD = new Set(['com', 'net', 'org', 'io', 'co', 'ae', 'ai', 'app', 'info', 'biz', 'me', 'dev', 'tech', 'online', 'store', 'site', 'xyz', 'us', 'uk', 'sa', 'in']);
  const otherSite = (q, domain, keys) => {
    const s = String(q || '').toLowerCase().trim(); let name = '', tld = '';
    const m = s.match(/(?:^|\s|www\.)([a-z0-9-]{3,})\.(com|net|org|io|co|ae|ai|app|info|biz|me|dev|tech|online|store|site|xyz)(?:\.[a-z]{2})?(?:\/\S*)?(?:\s|$)/);
    if (m) { name = m[1].replace(/-/g, ''); tld = m[2]; }
    else { const t = qTokens(s).filter(x => x !== 'www'); if (t.length !== 2 || !NAV_TLD.has(t[1])) return ''; name = t[0]; tld = t[1]; }
    if (name.length < 3) return '';
    const own = String(domain || '').toLowerCase().split('.')[0].replace(/[^a-z0-9]/g, '');
    if (name === own || (keys || []).some(k => squash(k) === name)) return '';
    return name + '.' + tld;
  };
  return { isScraper, brandKeys, brandTest, anonymised, editDistance, otherSite };
})();
