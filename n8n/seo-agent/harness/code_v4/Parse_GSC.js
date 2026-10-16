// Consolidates the Search Analytics responses per site: totals for both periods and a year ago, daily clicks, query movers
// (winners, losers, new, lost), striking-distance queries, CTR gaps, page movers and decaying pages, tracked keyword positions.
// 2026-10-12 (FIX_PLAN G9): every row, not a top-500 sample — the first 25,000-row page of each kind plus the pages GSC More Requests fetched
// are merged here; the queries Search Console withholds are reported as the anonymised share (the period totals minus the sum of the rows);
// brand and non-brand are split with the site model's / seo_monitors' brand names; scraper queries (search operators) are counted apart with
// the same rule the audit uses (GQ, v5/code/_gsc_queries.js, shared with D24 / P1-3) and never shown as customer searches.
// 2026-10-15 (B4-1, benchmark area 4): a decaying page is now a TESTED and SEASONAL judgement (ST.decay), not a 25% threshold.
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
        if (rest && rest.every(x => tld.includes(x) || x === 'com' || x === 'www')) return true; }
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
  return { isScraper, brandKeys, brandTest, anonymised };
})();
// ---- site-tracking statistics (2026-10-12, FIX_PLAN G28): an alert must mean "this really changed", not "a number moved by 30%".
// Clicks, impressions and sessions are counts over two periods of the same length, so the honest test is the two-sample Poisson test
// (normal approximation, the same idea as the z-tests the AI Pulse uses in v5/code/_ai_stats.js):
//     z = (cur - prev) / sqrt(cur + prev),  |z| >= 1.96  =  outside 95% sampling noise.
// 28 clicks against 20 is a 40% "fall" that any week could produce by chance (z = -1.18); 1,400 against 1,600 is a 13% fall that is real
// (z = -3.65). A change therefore needs three things: enough volume to measure, statistical significance, and a size worth telling the owner.
// Anything large but not significant is reported as "watch", never as a fall — and Google's update dates are named when one ran in the period.
// 2026-10-13 (G28 follow-up): `tested()` puts the source, the period, the test and the confidence into every alert's own words, and
// `position()` replaces the last fixed threshold in the site tracking — "5 places" on a keyword with 12 impressions is not a drop.
const ST = (() => {
  const num = (v) => Number(v) || 0;
  const z = (cur, prev) => { const s = num(cur) + num(prev); return s > 0 ? (num(cur) - num(prev)) / Math.sqrt(s) : 0; };
  // 95% interval for the relative change (log-ratio, Poisson counts); null when either side is zero
  const band = (cur, prev) => { const c = num(cur), p = num(prev); if (c <= 0 || p <= 0) return null;
    const se = Math.sqrt(1 / c + 1 / p), lo = Math.log(c / p) - 1.96 * se, hi = Math.log(c / p) + 1.96 * se;
    return [Math.round((Math.exp(lo) - 1) * 100), Math.round((Math.exp(hi) - 1) * 100)]; };
  // cur vs prev over equal periods. opts: { min_events, min_pct } — the events both periods must carry together before anything is claimed,
  // and the size of change worth telling the owner about
  const change = (cur, prev, opts) => {
    const o = opts || {}; const c = num(cur), p = num(prev);
    const minEvents = o.min_events == null ? 0 : o.min_events, minPct = o.min_pct == null ? 0 : o.min_pct;
    const pct = p > 0 ? Math.round((c - p) / p * 100) : (c > 0 ? null : 0);
    const zz = Math.round(z(c, p) * 100) / 100;
    const measurable = (c + p) >= minEvents;                     // both periods together carry enough events to say anything
    const significant = measurable && Math.abs(zz) >= 1.96;
    const big = pct != null && Math.abs(pct) >= minPct;
    return { cur: c, prev: p, pct, z: zz, ci: band(c, p), measurable, significant, big,
      real: significant && big, watch: !significant && big && p > 0,   // large but inside sampling noise: something to watch, not a fall
      direction: pct == null ? 'new' : pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
      text: (pct == null ? 'new' : (pct > 0 ? 'up ' : 'down ') + Math.abs(pct) + '%') + ' (' + p + ' → ' + c + (band(c, p) ? ', 95% range ' + band(c, p)[0] + '% to ' + band(c, p)[1] + '%' : '') + ')' };
  };
  // Google's confirmed ranking updates: context for a real fall, never a cause ("correlation, not proof").
  // G12 (2026-10-13): the list is no longer written here. It is inlined from `v5/data/seo_events.json` — the one dated place to add
  // an update, shared with the chart annotations (`_annotations.js`) and with the app (`app/shared/src/seo-events.generated.ts`).
  const UPDATES = [].concat([{"name": "March 2025 core update", "start": "2025-03-13", "end": "2025-03-26"}, {"name": "June 2025 core update", "start": "2025-06-30", "end": "2025-07-16"}, {"name": "August 2025 spam update", "start": "2025-08-26", "end": "2025-09-21"}, {"name": "December 2025 core update", "start": "2025-12-11", "end": "2025-12-29"}, {"name": "February 2026 Discover update", "start": "2026-02-05", "end": "2026-02-26"}, {"name": "March 2026 spam update", "start": "2026-03-24", "end": "2026-03-24"}, {"name": "March 2026 core update", "start": "2026-03-27", "end": "2026-04-08"}, {"name": "May 2026 core update", "start": "2026-05-21", "end": "2026-06-01"}, {"name": "June 2026 spam update", "start": "2026-06-24", "end": "2026-06-26"}, {"name": "August 2026 spam update", "start": "2026-08-18", "end": "2026-08-20"}, {"name": "September 2026 spam update", "start": "2026-09-24", "end": "2026-10-07"}]);
  const updatesIn = (range) => { const r = range || {}; const a = String(r.start || ''), b = String(r.end || '');
    if (!a || !b) return []; return UPDATES.filter(u => u.start <= b && u.end >= a); };
  const updateNote = (range) => { const hits = updatesIn(range); return hits.length ? ' A Google ' + hits.map(u => u.name + ' (' + u.start + ' to ' + u.end + ')').join(' and ') + ' ran inside this period — it may be part of the cause, which cannot be proven from these numbers.' : ''; };
  // ---- G28 follow-up (2026-10-13): an alert must say WHAT was tested, over WHAT period, and HOW SURE it is ----
  // One sentence, from the test itself, so no caller can print a number without its basis. `o`: { source, period, test }.
  // `stats: false` leaves the z value and the range out of this sentence, for a text that already prints them.
  const tested = (ch, o) => { const x = o || {}; const c = ch || {};
    const src = String(x.source || 'Search Console'), per = String(x.period || 'the last 28 days against the 28 days before'),
      test = String(x.test || 'two-sample Poisson z-test (counts over two equal periods)');
    const zz = x.stats === false ? '' : ' (z ' + c.z + ')';
    const sure = c.significant === true ? 'outside 95% sampling noise' + zz
      : c.measurable === false ? 'not enough events to test (' + ((Number(c.cur) || 0) + (Number(c.prev) || 0)) + ' over both periods together)'
      : 'inside 95% sampling noise' + zz + ', so it may be chance';
    return ' Tested: ' + src + ', ' + per + ', ' + test + '; ' + sure + (x.stats === false || !c.ci ? '' : '; 95% range ' + c.ci[0] + '% to ' + c.ci[1] + '%') + '.'; };
  // ---- a MOVE IN AVERAGE POSITION, which is not a count and must not be tested like one ----
  // Search Console's position is the impression-weighted average of the best position per impression over 28 days. With a handful of
  // impressions one search moves it several places, so the old rule ("5 places and the keyword was in the top 10") fired on noise for a
  // small site. There is no published variance for that average, so nothing is claimed about significance: the move is reported only when
  // BOTH periods carry min_impressions, and the clicks of the same two periods are tested (Poisson) so the alert can say how sure it is.
  // o: { impressions, prev_impressions, clicks, prev_clicks, min_impressions, min_places, min_click_events }
  const position = (cur, prev, o) => {
    const x = o || {}; const c = num(cur), p = num(prev);
    const minImp = x.min_impressions == null ? 50 : num(x.min_impressions), minPlaces = x.min_places == null ? 5 : num(x.min_places);
    const imp = num(x.impressions), impPrev = num(x.prev_impressions);
    const places = Math.round((c - p) * 10) / 10;                       // positive = slipped down the page
    const clicks = change(x.clicks, x.prev_clicks, { min_events: x.min_click_events == null ? 20 : num(x.min_click_events), min_pct: 0 });
    const measurable = c > 0 && p > 0 && imp >= minImp && impPrev >= minImp;
    const big = c > 0 && p > 0 && Math.abs(places) >= minPlaces;
    return { cur: c, prev: p, places, impressions: imp, prev_impressions: impPrev, clicks, measurable, big,
      real: measurable && big, watch: big && !measurable,               // a big move on too few impressions: worth a look, never a fact
      direction: places > 0 ? 'down' : places < 0 ? 'up' : 'flat',
      basis: 'Search Console average position, the last 28 days against the 28 days before, on ' + impPrev + ' then ' + imp + ' impressions'
        + (measurable ? '' : ' (under ' + minImp + ' impressions in a period one search can move the average several places)') };
  };
  // ---- B4-1 (2026-10-15, benchmark area 4 — docs/system-review-2026-10-14/BENCH_AREA4_cadence.md): IS THIS PAGE REALLY LOSING
  // TRAFFIC, OR ARE THESE WEEKS QUIET EVERY YEAR? Clearscope's Content Decay view compares a page's clicks over 90 days against
  // THE SAME 90 DAYS A YEAR EARLIER and names the two figures "seasonal difference" and "seasonal growth"
  // (https://www.clearscope.io/support/content-decay); Ahrefs tells you to flag pages down more than 20% YEAR OVER YEAR
  // (https://ahrefs.com/blog/content-decay/). Ours compared 28 days with the 28 before and called any 25% fall on 10 earlier
  // clicks a "decaying page" — the one window that cannot tell a decay from a seasonal dip, at a volume this file's own test
  // rejects (10 -> 7 clicks is z = -0.73, well inside chance). decay() tests the fall first and then, when the year-ago figure
  // was read, refuses to call a fall "decay" that the same page also had a year ago.
  // Two falls are NOT the same thing and need different work, so they are told apart here and nowhere else: clicks down while
  // impressions held is a click-through loss (title and snippet), clicks down WITH impressions is lost visibility (the page).
  // o: { clicks, prev_clicks, yoy_clicks, impressions, prev_impressions, min_events, min_pct, period, yoy_period }
  const decay = (o) => {
    const x = o || {}; const cur = num(x.clicks), prev = num(x.prev_clicks);
    const yoy = (x.yoy_clicks === '' || x.yoy_clicks == null) ? null : num(x.yoy_clicks);
    const minEvents = x.min_events == null ? 40 : num(x.min_events), minPct = x.min_pct == null ? 20 : num(x.min_pct);
    const per = String(x.period || 'the last 28 days against the 28 days before');
    const yper = String(x.yoy_period || 'the same 28 days a year earlier');
    const ch = change(cur, prev, { min_events: minEvents, min_pct: minPct });
    const imps = change(num(x.impressions), num(x.prev_impressions), { min_events: minEvents * 10, min_pct: minPct });
    const yc = yoy == null ? null : change(cur, yoy, { min_events: minEvents, min_pct: minPct });
    const lost = Math.max(0, prev - cur);
    const kind = ch.direction === 'down' ? ((imps.direction === 'down' && imps.significant) ? 'visibility' : 'clickthrough') : null;
    const kindNote = kind === 'visibility' ? ' Impressions fell with the clicks (' + imps.text + '), so the page is being shown less often: this is lost visibility, not a snippet problem.'
      : kind === 'clickthrough' ? ' Impressions held (' + imps.text + '), so the page is still being shown and fewer people click it: look at the title and the description before rewriting the page.' : '';
    const base = (state, note) => ({ state, lost, pct: ch.pct, kind: (state === 'decaying' || state === 'watch') ? kind : null,
      clicks: cur, prev_clicks: prev, yoy_clicks: yoy, change: ch, yoy_change: yc, impressions: imps,
      basis: 'Search Console clicks for this page, ' + per + ' (' + prev + ' → ' + cur + ')'
        + (yoy == null ? '; ' + yper + ' was not read, so a seasonal dip cannot be ruled out' : '; ' + yper + ': ' + yoy + ' clicks')
        + '.' + note });
    if (!ch.measurable) return base('too_small', ' Not enough clicks to test: ' + (cur + prev) + ' over both periods together, against the ' + minEvents + ' this test needs. No fall is claimed.');
    if (ch.direction !== 'down') return base('steady', ' No fall to explain (' + ch.text + ').');
    if (ch.real) {
      if (yc && yc.measurable && yc.direction !== 'down')
        return base('seasonal', ' But against ' + yper + ' the page is ' + yc.text + ', so these weeks are simply quieter than the ones before them every year. Not decay.'
          + tested(yc, { source: 'Search Console', period: 'the last 28 days against ' + yper }));
      return base('decaying', kindNote + tested(ch, { source: 'Search Console', period: per })
        + (yc ? ' Against ' + yper + ' it is ' + yc.text + '.' : ''));
    }
    if (ch.watch) return base('watch', ' Large but inside 95% sampling noise (z ' + ch.z + '), so it is something to watch, not a fall.' + kindNote);
    return base('steady', ' The fall is smaller than the ' + minPct + '% worth acting on (' + ch.text + ').');
  };
  // ---- B7-1 (2026-10-15, benchmark area 7 — docs/system-review-2026-10-14/BENCH_AREA7_site_tracking.md): DID THE CHANGE WORK,
  // OR DID THE WHOLE SITE MOVE? "We published the page and its clicks are up 40%" is not a result on a site that is up 45%.
  // SEOTesting's split test is exactly this comparison — a test group against a control group of similar pages, so that
  // "algorithm updates or seasonal shifts" hit both sides (https://seotesting.com/features/); its group builder balances the two
  // groups on 90 days of Search Console clicks and throws out pages more than 2 standard deviations from the mean and pages with
  // no clicks on more than half the days (https://support.seotesting.com/en/article/split-test-group-configuration-tool-1reabjb/).
  // The arithmetic here is CausalImpact's idea in plain form (P1, Brodersen et al. 2015, https://arxiv.org/abs/1506.00356): what
  // the page WOULD have done had it followed the rest of the site, against what it did.
  //     expected = prev_clicks x (control_clicks / control_prev_clicks)        <- MODELLED, never measured
  //     d = ln(cur/prev) - ln(control_cur/control_prev),  SE = sqrt(1/cur + 1/prev + 1/cc + 1/cp)
  //     lift = exp(d) - 1,  95% range = exp(d +- 1.96 SE) - 1,  z = d / SE
  // The rate-ratio form carries the CONTROL group's own sampling error into the range; a ratio of two percentages does not, and
  // that is how a quiet control group turns into a confident claim. A Google update inside the window is NOT a reason to refuse:
  // it moves the control group too, which is the whole point of having one. Nothing here ever says a change CAUSED anything —
  // a control group narrows the alternatives (the shared wording is CT, v5/code/_change_test.js).
  // Five refusals, because a lift computed on nothing reads as "no effect": no clicks before, no clicks after, too few events over
  // both periods together, fewer control pages than min_control_pages, and a control group with too little traffic to be a baseline.
  const LIFT_LABEL = { helped: 'Likely helped', hurt: 'Likely hurt', watch: 'Possibly moved', no_difference: 'No measurable difference',
    too_small: 'Can\'t tell yet', no_before: 'Can\'t tell', no_after: 'Can\'t tell', no_control: 'Can\'t tell' };
  const liftMethod = 'Every change is dated and read against a control group: the page\'s own clicks before and after, divided by what '
    + 'the site\'s OTHER pages did over the same two periods. The expected figure is modelled from that control group, not measured, and '
    + 'the 95% range carries the control group\'s own sampling error. A Google update inside the window moves the control group too — '
    + 'that is what the control group is for. A control group narrows the alternatives; it never proves a cause.';
  const lift = (o) => {
    const x = o || {};
    const cur = num(x.clicks), prev = num(x.prev_clicks), cc = num(x.control_clicks), cp = num(x.control_prev_clicks);
    const pagesN = Math.max(0, Math.round(num(x.control_pages)));
    const minEvents = x.min_events == null ? 20 : num(x.min_events);
    const minControl = x.min_control_events == null ? 40 : num(x.min_control_events);
    const minPages = x.min_control_pages == null ? 3 : num(x.min_control_pages);
    const minPct = x.min_pct == null ? 20 : num(x.min_pct);
    const per = String(x.period || 'the last 28 days against the 28 days before');
    const what = String(x.label || 'clicks');
    const ch = change(cur, prev, { min_events: minEvents, min_pct: 0 });
    const ctrl = change(cc, cp, { min_events: minControl, min_pct: 0 });
    const out = (state, note, extra) => Object.assign({ state, verdict: LIFT_LABEL[state] || state,
      clicks: cur, prev_clicks: prev, control_clicks: cc, control_prev_clicks: cp, control_pages: pagesN,
      expected: null, lift: null, lift_pct: null, ci: null, z: null, significant: false, change: ch, control_change: ctrl,
      basis: 'Search Console ' + what + ' for this page, ' + per + ' (' + prev + ' → ' + cur + '), against the site\'s other '
        + pagesN + ' page' + (pagesN === 1 ? '' : 's') + ' over the same two periods (' + cp + ' → ' + cc + '). ' + note }, extra || {});
    if (pagesN < minPages) return out('no_control', 'Fewer than ' + minPages + ' other pages of this site carried Search Console clicks, so there is no control group and no lift is claimed.');
    if (cp < minControl) return out('no_control', 'The rest of the site carried ' + cp + ' clicks in the earlier period, under the ' + minControl + ' this comparison needs for a baseline, so no lift is claimed.');
    if (prev <= 0) return out('no_before', 'The page had no clicks in the earlier period, so there is nothing to compare it with: this is a page new to Search Console, not an improved one.');
    if (cur <= 0) return out('no_after', 'The page has no clicks in the current period (it had ' + prev + '), so the ratio cannot be computed. That fall is reported on its own, never as a lift.');
    if ((cur + prev) < minEvents) return out('too_small', 'Only ' + (cur + prev) + ' clicks over both periods together, against the ' + minEvents + ' this comparison needs. No lift is claimed.');
    const ratio = cc / cp;
    const expected = Math.round(prev * ratio * 10) / 10;
    const d = Math.log(cur / prev) - Math.log(ratio);
    const se = Math.sqrt(1 / cur + 1 / prev + 1 / cc + 1 / cp);
    const zz = Math.round((d / se) * 100) / 100;
    const pctOf = (v) => Math.round((Math.exp(v) - 1) * 100);
    const liftPct = pctOf(d), ci = [pctOf(d - 1.96 * se), pctOf(d + 1.96 * se)];
    const sig = Math.abs(zz) >= 1.96;
    const state = sig ? (d > 0 ? 'helped' : 'hurt') : (Math.abs(liftPct) >= minPct ? 'watch' : 'no_difference');
    const rest = 'The rest of the site went ' + ctrl.text + ', so a page that had simply followed it would have about ' + expected
      + ' clicks; this page has ' + cur + '.';
    const size = (liftPct >= 0 ? 'up ' : 'down ') + Math.abs(liftPct) + '% against that expectation (95% range ' + ci[0] + '% to ' + ci[1] + '%, z ' + zz + ')';
    const note = rest + ' That is ' + size + '. '
      + (sig ? 'Outside 95% sampling noise.' : Math.abs(liftPct) >= minPct ? 'Inside 95% sampling noise, so it is something to watch and not yet a result.' : 'Inside 95% sampling noise and smaller than the ' + minPct + '% worth acting on.')
      + ' The expected figure is modelled from the control group, not measured.';
    return out(state, note, { expected, lift: Math.round((cur - expected) * 10) / 10, lift_pct: liftPct, ci, z: zz, significant: sig });
  };
  return { z, band, change, position, decay, tested, updatesIn, updateNote, UPDATES, lift, LIFT_LABEL, liftMethod };
})();
const reqs = $('GSC Requests').all().map(i => i.json);
const res = (() => { try { return $('GSC Query').all().map(i => i.json); } catch (e) { return $input.all().map(i => i.json); } })();
const moreReqs = (() => { try { return $('GSC More Requests').all().map(i => i.json).filter(q => q && !q.skip); } catch (e) { return []; } })();
const moreRes = (() => { try { return $('GSC Query (More)').all().map(i => i.json); } catch (e) { return []; } })();
const sites = $('Resolve Properties').all().map(i => i.json);
const models = (() => { try { return $('Site Model (Site)').all().map(i => i.json).filter(m => m && m.site_id); } catch (e) { return []; } })();
const EXPECTED_CTR = [0.28, 0.15, 0.11, 0.08, 0.07, 0.05, 0.04, 0.035, 0.03, 0.025];   // typical organic CTR by position (industry averages)
const rowsOf = (r) => (r && Array.isArray(r.rows)) ? r.rows.map(x => ({ keys: x.keys || [], clicks: Number(x.clicks) || 0, impressions: Number(x.impressions) || 0, ctr: Number(x.ctr) || 0, position: Number(x.position) || 0 })) : [];
const gErr = (r) => { if (!r) return 'no response'; const e = r.error; if (!e) return null; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return String((inner && inner.message) || (ctx.error_description ? String(ctx.error || 'error') + ': ' + ctx.error_description : '') || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200); };   // Google errors: the useful text sits in context.data (invalid_grant: account not found) or in error.message (PERMISSION_DENIED)
const errOf = gErr;
const sum = (rows) => { const t = rows.reduce((a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions, pw: a.pw + r.position * r.impressions }), { clicks: 0, impressions: 0, pw: 0 }); return { clicks: t.clicks, impressions: t.impressions, ctr: t.impressions ? +(t.clicks / t.impressions).toFixed(4) : 0, position: t.impressions ? +(t.pw / t.impressions).toFixed(1) : 0 }; };
const pct = (cur, prev) => prev > 0 ? Math.round((cur - prev) / prev * 100) : (cur > 0 ? null : 0);
const acc = new Map();
const take = (q, r) => {
  if (!q || q.skip) return;
  if (!acc.has(q.site_idx)) acc.set(q.site_idx, { site_idx: q.site_idx, site_id: q.site_id, errors: [], by_date: [], yoy: null, queries_cur: [], queries_prev: [], pages_cur: [], pages_prev: [], pages_yoy: [], kw: {}, paging: {}, tests: {}, test_err: {} });   // B7-1: tests / test_err hold each dated change's two windows
  const a = acc.get(q.site_idx); const e = errOf(r);
  if (e) { a.errors.push(q.kind + (q.keyword ? ' "' + q.keyword + '"' : '') + (q.page > 1 ? ' page ' + q.page : '') + ': ' + e); if (q.test_key) a.test_err[q.kind + '|' + q.test_key] = e; return; }
  const rows = rowsOf(r);
  if (q.paged) { const pg = a.paging[q.kind] || (a.paging[q.kind] = { pages: 0, rows: 0, page_rows: Number(q.page_rows) || 25000, max_pages: Number(q.max_pages) || 4, truncated: false });
    pg.pages += 1; pg.rows += rows.length; if (q.page >= pg.max_pages && rows.length >= pg.page_rows) pg.truncated = true; }
  if (q.test_key) { a.tests[q.kind + '|' + q.test_key] = rows; return; }   // B7-1: a change's own before / after window, kept whole for the control group
  if (q.kind === 'kw_cur' || q.kind === 'kw_prev') { const k = a.kw[q.keyword] || (a.kw[q.keyword] = { keyword: q.keyword, cur: null, prev: null }); const top = [...rows].sort((x, y) => y.impressions - x.impressions)[0]; k[q.kind === 'kw_cur' ? 'cur' : 'prev'] = { ...sum(rows), page: top ? top.keys[0] : '' }; }
  else if (q.kind === 'yoy') a.yoy = sum(rows);
  else a[q.kind] = (a[q.kind] || []).concat(rows);   // G9: one kind, several 25,000-row pages
};
reqs.forEach((q, i) => take(q, res[i]));
moreReqs.forEach((q, i) => take(q, moreRes[i]));
const out = [];
for (const a of acc.values()) {
  const s = sites[a.site_idx] || {}; const R = s.ranges || {}; const cfg = s.config || {};
  const inR = (d, r) => !!r && d >= r.start && d <= r.end;
  const daily = a.by_date.map(r => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: +r.position.toFixed(1) })).sort((x, y) => String(x.date).localeCompare(String(y.date)));
  const cur = sum(a.by_date.filter(r => inR(r.keys[0], R.current))), prev = sum(a.by_date.filter(r => inR(r.keys[0], R.previous)));
  // queries: current rows are query x page -> one row per query with its strongest page
  const qmapAll = new Map();
  for (const r of a.queries_cur) { const q = r.keys[0]; const m = qmapAll.get(q) || { query: q, rows: [], page: '', pageImp: -1 }; m.rows.push(r); if (r.impressions > m.pageImp) { m.pageImp = r.impressions; m.page = r.keys[1] || ''; } qmapAll.set(q, m); }
  // G9 / D24: a query typed by an SEO tool (site:, inurl:, capital booleans) is not a customer search — counted apart, never listed
  const qmap = new Map([...qmapAll.entries()].filter(([q]) => !GQ.isScraper(q)));
  const scraperRows = [...qmapAll.entries()].filter(([q]) => GQ.isScraper(q)).map(([q, m]) => ({ query: q, ...sum(m.rows) })).sort((x, y) => y.impressions - x.impressions);
  const prevQ = new Map(a.queries_prev.filter(r => !GQ.isScraper(r.keys[0])).map(r => [r.keys[0], r]));
  const queries = [...qmap.values()].map(m => { const t = sum(m.rows); const p = prevQ.get(m.query); return { query: m.query, page: m.page, ...t, prev_clicks: p ? p.clicks : 0, prev_impressions: p ? p.impressions : 0, prev_position: p ? +p.position.toFixed(1) : 0, clicks_delta: t.clicks - (p ? p.clicks : 0), position_delta: (p && p.position > 0 && t.position > 0) ? +(p.position - t.position).toFixed(1) : null }; }).sort((x, y) => y.impressions - x.impressions);
  const lost = [...prevQ.values()].filter(p => p.clicks >= 5 && !qmap.has(p.keys[0])).map(p => ({ query: p.keys[0], prev_clicks: p.clicks, prev_position: +p.position.toFixed(1) })).sort((x, y) => y.prev_clicks - x.prev_clicks).slice(0, 10);
  const winners = queries.filter(q => q.clicks_delta >= 5 && q.prev_clicks > 0 && q.clicks_delta / q.prev_clicks >= 0.3).sort((x, y) => y.clicks_delta - x.clicks_delta).slice(0, 10);
  const losers = queries.filter(q => q.clicks_delta <= -5 && q.prev_clicks > 0 && -q.clicks_delta / q.prev_clicks >= 0.3).sort((x, y) => x.clicks_delta - y.clicks_delta).slice(0, 10);
  // G9 (2026-10-12): brand vs non-brand uses every name of the business (seo_monitors.brand_names and the site model) and the domain label as
  // the fallback ('techand' matches 'techand', 'tech and', 'techand ai'; live finding 2026-10-02)
  const model = (models.find(m => m.site_id === a.site_id) || {}).model || null;
  const brandNames = [...((model && model.brand_names) || []), (model && model.business_name) || '', ...((s.config || {}).brand_names || [])].filter(Boolean);
  const BR = GQ.brandTest(s.domain, brandNames); const isBrand = BR.is;
  const newQ = queries.filter(q => !prevQ.has(q.query) && q.impressions >= 20 && !isBrand(q.query)).slice(0, 10);
  const striking = queries.filter(q => q.position >= 4 && q.position <= 20 && q.impressions >= (cfg.striking_min_impressions || 30) && !isBrand(q.query)).slice(0, 15);
  const ctrGaps = queries.filter(q => q.position > 0 && q.position <= 10 && q.impressions >= (cfg.ctr_gap_min_impressions || 100) && !isBrand(q.query)).map(q => ({ ...q, expected_ctr: EXPECTED_CTR[Math.max(0, Math.min(9, Math.round(q.position) - 1))] })).filter(q => q.ctr < q.expected_ctr * 0.5).sort((x, y) => (y.impressions * (y.expected_ctr - y.ctr)) - (x.impressions * (x.expected_ctr - x.ctr))).slice(0, 10);
  // ---- R92 part 2 (2026-10-16, re-rating defect C-16): an `sc-domain:` property reports https://techand.ai/ AND https://www.techand.ai/
  // as two pages, and the report printed two "/" rows (14 clicks and 3). One page is one row: the host variants of a path are merged
  // onto the site model's canonical host (clicks and impressions summed, the position weighted by impressions). The row keeps the URL on
  // the canonical host when Google reported one there; when Google only reported the other host, the row keeps THAT full URL, so a
  // reader printing paths can still show the host differs (A2's rule in the audit), and `hosts` lists every variant with its numbers.
  const canonHost = String((model && model.canonical_host) || '').toLowerCase().replace(/\.$/, '');
  const hostOfU = (u) => { const m0 = String(u || '').match(/^https?:\/\/([^\/?#]+)/i); return m0 ? m0[1].toLowerCase() : ''; };
  const pathKeyU = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/#.*$/, '').replace(/\/+$/, '');
  const mergeHosts = (rowsIn) => { const g = new Map();
    for (const r of (rowsIn || [])) { const u = String((r.keys || [])[0] || ''); const k = pathKeyU(u); const e = g.get(k) || { variants: [] }; e.variants.push(r); g.set(k, e); }
    return [...g.values()].map(({ variants }) => { if (variants.length === 1 && (!canonHost || hostOfU(variants[0].keys[0]) === canonHost)) return variants[0];
      const clicks = variants.reduce((n, r) => n + (Number(r.clicks) || 0), 0), impressions = variants.reduce((n, r) => n + (Number(r.impressions) || 0), 0);
      const pw = variants.reduce((n, r) => n + (Number(r.position) || 0) * (Number(r.impressions) || 0), 0);
      const onCanon = variants.find(r => hostOfU(r.keys[0]) === canonHost);
      const lead = onCanon || [...variants].sort((x, y) => (Number(y.impressions) || 0) - (Number(x.impressions) || 0))[0];
      return { ...lead, keys: [lead.keys[0], ...(lead.keys || []).slice(1)], clicks, impressions, ctr: impressions ? clicks / impressions : 0,
        position: impressions ? pw / impressions : (Number(lead.position) || 0),
        hosts: variants.length > 1 ? variants.map(r => ({ host: hostOfU(r.keys[0]), url: r.keys[0], clicks: Number(r.clicks) || 0, impressions: Number(r.impressions) || 0 })) : undefined,
        other_host: !onCanon && !!canonHost }; }); };
  a.pages_cur = mergeHosts(a.pages_cur); a.pages_prev = mergeHosts(a.pages_prev); a.pages_yoy = mergeHosts(a.pages_yoy);
  const prevP = new Map(a.pages_prev.map(r => [pathKeyU(r.keys[0]), r]));
  // B4-1: the same 28 days a year earlier, per page. `yoy_read` says whether Google answered at all, so a page missing from the
  // year-ago rows is "0 clicks a year ago" when the request worked and "not read" when it did not — the two mean opposite things.
  const yoyP = new Map(a.pages_yoy.map(r => [pathKeyU(r.keys[0]), r]));
  const yoy_read = !a.errors.some(e => /^pages_yoy/.test(String(e))) && reqs.concat(moreReqs).some(q => q.site_idx === a.site_idx && q.kind === 'pages_yoy');
  const pages = a.pages_cur.map(r => { const p = prevP.get(pathKeyU(r.keys[0])), y = yoyP.get(pathKeyU(r.keys[0]));
    return { page: r.keys[0], ...(r.hosts ? { hosts: r.hosts } : {}), ...(r.other_host ? { other_host: true } : {}), clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: +r.position.toFixed(1), prev_clicks: p ? p.clicks : 0, prev_impressions: p ? p.impressions : 0, clicks_delta: r.clicks - (p ? p.clicks : 0),
      prev_position: p && p.impressions ? +p.position.toFixed(1) : 0,   // B7-1: the control group's own position move needs both readings; 0 = the page had no impressions then, not position zero
      yoy_clicks: yoy_read ? (y ? y.clicks : 0) : null, yoy_impressions: yoy_read ? (y ? y.impressions : 0) : null }; }).sort((x, y) => y.clicks - x.clicks);
  // B4-1: a page is "decaying" only when the fall survives the two-sample Poisson test AND is not the dip the same weeks had a
  // year ago (ST.decay). Ranked by the clicks actually lost, which is what Clearscope sorts its Content Decay report by
  // (https://www.clearscope.io/blog/content-decay-report). Everything the old 25% rule would have called decay is still reported,
  // under the state the evidence supports, so nothing goes quiet: `seasonal`, `watch` and `too_small` each say why.
  const decayCfg = { min_events: Number(cfg.decay_min_click_events) || 40, min_pct: Number(cfg.decay_min_pct) || 20,
    period: 'the last 28 days against the 28 days before', yoy_period: 'the same 28 days a year earlier' };
  const judged = pages.map(p => ({ ...p, decay: ST.decay({ clicks: p.clicks, prev_clicks: p.prev_clicks, yoy_clicks: p.yoy_clicks, impressions: p.impressions, prev_impressions: p.prev_impressions, ...decayCfg }) }));
  const byLost = (x, y) => y.decay.lost - x.decay.lost;
  const decaying = judged.filter(p => p.decay.state === 'decaying').sort(byLost).slice(0, 10)
    .map(p => ({ page: p.page, ...(p.other_host ? { other_host: true } : {}), clicks: p.clicks, prev_clicks: p.prev_clicks, yoy_clicks: p.yoy_clicks, impressions: p.impressions, prev_impressions: p.prev_impressions, lost: p.decay.lost, pct: p.decay.pct, kind: p.decay.kind, basis: p.decay.basis, state: 'decaying' }));
  const not_decay = judged.filter(p => p.decay.state === 'seasonal' || (p.decay.state === 'watch' && p.decay.lost > 0)).sort(byLost).slice(0, 10)
    .map(p => ({ page: p.page, clicks: p.clicks, prev_clicks: p.prev_clicks, yoy_clicks: p.yoy_clicks, lost: p.decay.lost, pct: p.decay.pct, state: p.decay.state, basis: p.decay.basis }));
  // every page Search Console reported anything for, with its judgement — the Site Tracker stores this in seo_pages so the
  // Content Cadence can write the refresh instead of only recommending it (B4-2 / B4-3)
  const page_perf = judged.filter(p => p.clicks > 0 || p.prev_clicks > 0 || p.impressions > 0).sort((x, y) => (y.clicks + y.prev_clicks) - (x.clicks + x.prev_clicks)).slice(0, 500)
    .map(p => ({ page: p.page, clicks: p.clicks, impressions: p.impressions, position: p.position, prev_position: p.prev_position, prev_clicks: p.prev_clicks, prev_impressions: p.prev_impressions, yoy_clicks: p.yoy_clicks, state: p.decay.state, pct: p.decay.pct, lost: p.decay.lost, kind: p.decay.kind, basis: p.decay.basis }));
  const decay_summary = { tested: judged.length, decaying: judged.filter(p => p.decay.state === 'decaying').length,
    seasonal: judged.filter(p => p.decay.state === 'seasonal').length, watch: judged.filter(p => p.decay.state === 'watch').length,
    too_small: judged.filter(p => p.decay.state === 'too_small').length, yoy_read, min_click_events: decayCfg.min_events, min_pct: decayCfg.min_pct,
    note: yoy_read ? 'Every page with clicks was tested against the 28 days before and the same 28 days a year earlier.'
      : 'The year-ago page rows could not be read this week, so a seasonal dip cannot be ruled out for any page.' };
  const rising = pages.filter(p => p.clicks_delta >= 5 && (p.prev_clicks === 0 || p.clicks_delta / p.prev_clicks >= 0.3)).sort((x, y) => y.clicks_delta - x.clicks_delta).slice(0, 10);
  // ---- B7-3 (2026-10-15, benchmark area 7 — docs/system-review-2026-10-14/BENCH_AREA7_site_tracking.md): TWO OF YOUR OWN PAGES
  // IN ONE SEARCH. Criterion 2.10 names cannibalisation and nothing in this system computed it; SEOTesting ships a Keyword
  // Cannibalization report (https://seotesting.com/features/) and Semrush a Cannibalization tab. The proof has been inside this
  // node all along: `queries_cur` is read with dimensions ['query','page'], so every page Google showed for a search is already
  // here and we kept the strongest one and threw the rest away. This is OBSERVED, not inferred — both pages really were shown for
  // that search in the last 28 days. Refusals: a brand search SHOULD return several of your pages, so brand (and scraper) queries
  // are out; a query under `cannibal_min_impressions` is out; a second page holding under `cannibal_min_share` of the query's
  // impressions is noise, not a competing page; and URLs differing only by scheme, www, trailing slash or query string are ONE page.
  const cnbMinImp = Number(cfg.cannibal_min_impressions) || 50, cnbMinShare = Number(cfg.cannibal_min_share) || 10;
  const cnbKey = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '');
  const cannibal = [...qmap.values()].filter(m => !isBrand(m.query)).map(m => {
    const byPage = new Map();
    for (const r of m.rows) { const u = String(r.keys[1] || ''); if (!u) continue; const k = cnbKey(u);
      const e = byPage.get(k) || { page: u, clicks: 0, impressions: 0, pw: 0 };
      e.clicks += r.clicks; e.impressions += r.impressions; e.pw += r.position * r.impressions; byPage.set(k, e); }
    const tot = sum(m.rows);
    const list = [...byPage.values()].map(e => ({ page: e.page, clicks: e.clicks, impressions: e.impressions,
      position: e.impressions ? +(e.pw / e.impressions).toFixed(1) : 0,
      share: tot.impressions ? Math.round(e.impressions / tot.impressions * 1000) / 10 : 0 })).sort((x, y) => y.impressions - x.impressions);
    const competing = list.filter(e => e.share >= cnbMinShare && e.impressions >= 10);
    const best = [...competing].sort((x, y) => (x.position || 99) - (y.position || 99))[0] || null;
    return { query: m.query, impressions: tot.impressions, clicks: tot.clicks, pages: competing, page_count: list.length,
      preferred: competing[0] ? competing[0].page : '', preferred_share: competing[0] ? competing[0].share : 0, best };
  }).filter(c => c.impressions >= cnbMinImp && c.pages.length >= 2)
    .map(c => ({ ...c, split: !!(c.best && cnbKey(c.best.page) !== cnbKey(c.preferred)),
      basis: 'Search Console showed ' + c.pages.length + ' of your pages for "' + c.query + '" over the last 28 days ('
        + c.impressions + ' impressions): ' + c.pages.map(p => p.page + ' ' + p.share + '% of them at #' + p.position).join(', ')
        + '. Measured by Google, not inferred from a ranking check.' }))
    .sort((x, y) => y.impressions - x.impressions).slice(0, 10);
  const cannibal_summary = { found: cannibal.length, queries_checked: qmap.size, min_impressions: cnbMinImp, min_share: cnbMinShare,
    note: qmap.size ? 'Every non-brand search of the last 28 days was checked for a second page of yours holding at least '
        + cnbMinShare + '% of its impressions; brand searches are left out because several of your pages SHOULD answer those.'
      : 'No query rows were read this week, so nothing could be checked for cannibalisation.' };
  // ---- B7-2 (2026-10-15, benchmark area 7): THE DEVICE AND THE COUNTRY, from the same free request budget. The Search Analytics
  // API has answered `device` and `country` since it existed (https://developers.google.com/webmaster-tools/v1/searchanalytics/query);
  // Looker Studio's Search Console connector exposes both and SEOTesting filters its dashboards by country. We asked for neither, so
  // a site whose mobile clicks halved while desktop held read as "search clicks down 18%" and nothing else. A kind Google did not
  // answer is `read: false` with the reason — never an empty table that reads as "no mobile traffic" (INVARIANTS rule 1 / rule 3).
  const splitOf = (kind, prevKind, label) => {
    const curRows = a[kind] || [], prevRows = a[prevKind] || [];
    const failed = a.errors.some(e => String(e).indexOf(kind + ':') === 0 || String(e).indexOf(prevKind + ':') === 0);
    // a request Google did not answer is UNAVAILABLE; a request Google answered with nothing is a measured zero. The two read the
    // same in an empty table and mean opposite things, so they are told apart here (INVARIANTS rule 1).
    if (failed || !curRows.length) return { read: false, failed, rows: [], total: 0, prev_total: 0,
      reason: failed ? 'Search Console did not answer the ' + label + ' request this week, so the ' + label + ' split is not available'
        : 'Search Console answered the ' + label + ' request with no rows: it recorded no search impressions for this site in this period' };
    const pm = new Map(prevRows.map(r => [String(r.keys[0]), r]));
    const tot = curRows.reduce((n, r) => n + r.clicks, 0), ptot = prevRows.reduce((n, r) => n + r.clicks, 0);
    const rows = curRows.map(r => { const k = String(r.keys[0]); const p = pm.get(k);
      return { key: k, clicks: r.clicks, impressions: r.impressions, ctr: +(r.ctr * 100).toFixed(1), position: +r.position.toFixed(1),
        prev_clicks: p ? p.clicks : 0, prev_impressions: p ? p.impressions : 0, share: tot ? Math.round(r.clicks / tot * 1000) / 10 : 0,
        change: ST.change(r.clicks, p ? p.clicks : 0, { min_events: Number(cfg.alert_min_click_events) || 40, min_pct: Number(cfg.alert_min_pct) || 10 }) }; })
      .sort((x, y) => y.clicks - x.clicks);
    return { read: true, failed: false, rows: rows.slice(0, 10), total: tot, prev_total: ptot, reason: '',
      basis: 'Search Console ' + label + ' rows, the last 28 days against the 28 days before (' + ptot + ' → ' + tot + ' clicks across ' + rows.length + ' ' + label + ' values)' };
  };
  const devices = splitOf('device_cur', 'device_prev', 'device');
  const countries = splitOf('country_cur', 'country_prev', 'country');
  // ---- B7-1 (2026-10-15, benchmark area 7): each dated change, reduced to the two numbers its judgement needs ----
  // Both windows come back as the WHOLE site's pages, so the page under test and the control group — every other page of the site
  // over exactly the same days — are measured together and nothing has to be assumed about either. The judgement itself is made in
  // Site Metrics (ST.lift for the clicks, CT.compare for the position); this node only reduces, and a window Google did not answer
  // is `read: false` with the reason (INVARIANTS rule 1 / rule 3) instead of a zero that would read as "the change did nothing".
  const testReqs = reqs.filter(q => q && q.site_idx === a.site_idx && q.test_key && q.kind === 'test_after');
  const change_tests = testReqs.map(q => {
    const base = { key: q.test_key, url: q.test_url, date: q.change_date, what: q.change_what, keyword: q.change_keyword,
      joint: !!q.change_joint, window_before: q.window_before, window_after: q.window_after };
    const bRaw = a.tests['test_before|' + q.test_key], aRaw = a.tests['test_after|' + q.test_key];
    const bRows = bRaw ? mergeHosts(bRaw) : bRaw, aRows = aRaw ? mergeHosts(aRaw) : aRaw;   // R92 part 2: one page, one row, in both windows
    const bErr = a.test_err['test_before|' + q.test_key], aErr = a.test_err['test_after|' + q.test_key];
    if (!bRows || !aRows) return { ...base, read: false, page: null, control: null,
      reason: 'Search Console did not answer the ' + (!aRows ? 'window after' : 'window before') + ' this change ('
        + (aErr || bErr || 'no rows came back') + '), so it was not measured this week.' };
    const tk = cnbKey(q.test_url);
    const bMap = new Map(bRows.map(r => [cnbKey(r.keys[0]), r]));
    const pb = bMap.get(tk) || null, pa = aRows.find(r => cnbKey(r.keys[0]) === tk) || null;
    const ctrlB = bRows.filter(r => cnbKey(r.keys[0]) !== tk), ctrlA = aRows.filter(r => cnbKey(r.keys[0]) !== tk);
    const cB = sum(ctrlB), cA = sum(ctrlA);
    const moves = [];
    for (const r of ctrlA) { const b = bMap.get(cnbKey(r.keys[0])); if (!b || !b.impressions || !r.impressions) continue; moves.push(+(b.position - r.position).toFixed(2)); }
    return { ...base, read: true, reason: '',
      page: { clicks: pa ? pa.clicks : 0, impressions: pa ? pa.impressions : 0, position: pa ? +pa.position.toFixed(1) : 0,
        prev_clicks: pb ? pb.clicks : 0, prev_impressions: pb ? pb.impressions : 0, prev_position: pb ? +pb.position.toFixed(1) : 0 },
      control: { clicks: cA.clicks, prev_clicks: cB.clicks, impressions: cA.impressions, prev_impressions: cB.impressions,
        pages: ctrlA.length, prev_pages: ctrlB.length, moves: moves.slice(0, 300), moves_pages: moves.length } };
  });
  // ---- B7-4 (W3-D, 2026-10-17): DISCOVER AND GOOGLE NEWS. `type: web` never contains them; a property with no Discover traffic answers with
  // no rows. That is "this property has no Discover data" -- said as such -- and a request Google did not answer is "not read".
  // Never an empty section that reads as a measured zero for a property that was not asked.
  const typeBlock = (kind, label) => {
    const asked = reqs.some(q => q.site_idx === a.site_idx && q.kind === kind);
    const failed = a.errors.some(e => String(e).indexOf(kind + ':') === 0);
    const rows = a[kind] || [];
    if (!asked) return { read: false, has_data: false, reason: label + ' was not requested this week' };
    if (failed) return { read: false, has_data: false, reason: 'Search Console did not answer the ' + label + ' request this week, so ' + label + ' is not available' };
    const c = sum(rows.filter(r => inR(r.keys[0], R.current))), p0 = sum(rows.filter(r => inR(r.keys[0], R.previous)));
    if (!rows.length || (c.clicks + c.impressions + p0.clicks + p0.impressions) === 0) return { read: true, has_data: false, reason: 'This property has no ' + label + ' data: Search Console returned no ' + label + ' rows for the last 56 days' };
    return { read: true, has_data: true, reason: '', cur: { clicks: c.clicks, impressions: c.impressions, position: c.position }, prev: { clicks: p0.clicks, impressions: p0.impressions, position: p0.position },
      change: ST.change(c.clicks, p0.clicks, { min_events: Number(cfg.alert_min_click_events) || 40, min_pct: Number(cfg.alert_min_pct) || 10 }),
      basis: 'Search Console, search type ' + (kind === 'discover_daily' ? 'discover' : 'googleNews') + ', the last 28 days against the 28 before (' + p0.clicks + ' → ' + c.clicks + ' clicks)' };
  };
  const search_types = { discover: typeBlock('discover_daily', 'Discover'), google_news: typeBlock('news_daily', 'Google News') };
  // ---- B7-8: the days since the final-data window, from PRELIMINARY data. Shown on its own line; never summed into `totals` or tested ----
  const recent = (() => {
    const asked = reqs.find(q => q.site_idx === a.site_idx && q.kind === 'recent');
    if (!asked) return { read: false, reason: 'the days after the report window were not requested' };
    if (a.errors.some(e => String(e).indexOf('recent:') === 0)) return { read: false, reason: 'Search Console did not answer the request for the latest days' };
    const rows = (a.recent || []).map(r => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions })).filter(r => r.date > (R.current || {}).end).sort((x, y) => String(x.date).localeCompare(String(y.date)));
    const t = rows.reduce((o, r) => ({ clicks: o.clicks + r.clicks, impressions: o.impressions + r.impressions }), { clicks: 0, impressions: 0 });
    const winDays = (R.current && R.current.start) ? 28 : 0;
    return { read: true, start: rows.length ? rows[0].date : asked.body.startDate, end: rows.length ? rows[rows.length - 1].date : asked.body.endDate, days: rows.length, rows, clicks: t.clicks, impressions: t.impressions,
      window_daily_clicks: winDays ? +(cur.clicks / winDays).toFixed(1) : null,
      label: 'Preliminary: Google says this data is "still being collected and might change". It is not part of the tested figures above.' };
  })();
  // ---- B7-5 (W3-D): CONTENT GROUPS. One regex per group over the page rows already read (path, case-insensitive); each group is tested on
  // the same bar as every other alert (ST.change). A page can sit in more than one group; the report says so. Pages in no group are
  // reported as one line, so "the blog against the service pages" always has the rest of the site beside it. ----
  const content_groups = (() => {
    const defs = Array.isArray(s.content_groups) ? s.content_groups : [];
    if (!defs.length) return { configured: false, groups: [], note: 'No content groups are set for this site, so pages are not grouped. Set them in Site Admin (content_groups: a name and a regular expression over the page path).' };
    const pathOf = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/i, '') || '/';
    const opts = { min_events: Number(cfg.alert_min_click_events) || 40, min_pct: Number(cfg.alert_min_pct) || 10 };
    const prevByKey = new Map(a.pages_prev.map(r => [pathKeyU(r.keys[0]), r]));
    const used = new Set();
    const groups = defs.map(d => {
      let re = null, bad = '';
      if (/(\+|\*|\})\)?[+*{]/.test(d.pattern)) bad = 'pattern refused: nested repetition can hang the run';
      else { try { re = new RegExp(d.pattern, 'i'); } catch (e) { bad = 'not a valid regular expression'; } }
      if (!re) return { name: d.name, pattern: d.pattern, valid: false, reason: bad };
      const cur0 = a.pages_cur.filter(r => re.test(pathOf(r.keys[0])));
      cur0.forEach(r => used.add(pathKeyU(r.keys[0])));
      const prow = a.pages_prev.filter(r => re.test(pathOf(r.keys[0])));
      prow.forEach(r => used.add(pathKeyU(r.keys[0])));
      const c = sum(cur0), p0 = sum(prow);
      return { name: d.name, pattern: d.pattern, valid: true, pages: cur0.length, clicks: c.clicks, impressions: c.impressions, position: +c.position.toFixed(1),
        prev_clicks: p0.clicks, prev_impressions: p0.impressions, change: ST.change(c.clicks, p0.clicks, opts),
        basis: cur0.length + ' pages whose path matches /' + d.pattern + '/i, Search Console, the last 28 days against the 28 before (' + p0.clicks + ' → ' + c.clicks + ' clicks)' };
    });
    const restCur = a.pages_cur.filter(r => !used.has(pathKeyU(r.keys[0]))), restPrev = a.pages_prev.filter(r => !used.has(pathKeyU(r.keys[0])));
    const rc = sum(restCur), rp = sum(restPrev);
    return { configured: true, groups, ungrouped: { pages: restCur.length, clicks: rc.clicks, prev_clicks: rp.clicks, change: ST.change(rc.clicks, rp.clicks, opts) },
      note: 'A page that matches several groups counts in each of them. Each group is judged on the same bar as the site-wide alerts: at least ' + opts.min_events + ' clicks across both periods and a ' + opts.min_pct + '% move that survives the significance test.' };
  })();
  // ---- G9: what Search Console does not name, and who searched the brand ----
  const anonymised = { current: GQ.anonymised(cur, [...qmapAll.values()].flatMap(m => m.rows)), previous: GQ.anonymised(prev, a.queries_prev) };
  const brandSum = (list, want) => { const picked = list.filter(q => isBrand(q.query) === want); const t = sum(picked.map(q => ({ clicks: q.clicks, impressions: q.impressions, position: q.position }))); return { queries: picked.length, clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position, top: picked.slice(0, 5).map(q => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, position: q.position })) }; };
  const prevList = [...prevQ.values()].map(r => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: r.position }));
  const brand_split = { names: BR.keys, brand: brandSum(queries, true), non_brand: brandSum(queries, false),
    previous: { brand: brandSum(prevList, true), non_brand: brandSum(prevList, false) },
    note: BR.keys.length ? 'Brand = the query contains ' + BR.keys.join(' / ') + '. Non-brand clicks are the ones SEO wins.' : 'No brand name known for this site: every query counts as non-brand.' };
  brand_split.brand_clicks_pct = cur.clicks ? Math.round(brand_split.brand.clicks / cur.clicks * 1000) / 10 : 0;
  const scraper_queries = { count: scraperRows.length, clicks: scraperRows.reduce((n, q) => n + q.clicks, 0), impressions: scraperRows.reduce((n, q) => n + q.impressions, 0), sample: scraperRows.slice(0, 3).map(q => q.query) };
  const paging = Object.entries(a.paging).map(([kind, pg]) => ({ kind, pages: pg.pages, rows: pg.rows, truncated: pg.truncated }));
  const rows_read = paging.reduce((n, x) => n + x.rows, 0); const truncated = paging.filter(x => x.truncated).map(x => x.kind);
  const tracked = Object.values(a.kw).map(k => ({ keyword: k.keyword, position: k.cur && k.cur.impressions ? k.cur.position : 0, prev_position: k.prev && k.prev.impressions ? k.prev.position : 0, clicks: k.cur ? k.cur.clicks : 0, impressions: k.cur ? k.cur.impressions : 0, prev_clicks: k.prev ? k.prev.clicks : 0, prev_impressions: k.prev ? k.prev.impressions : 0, ctr: k.cur ? k.cur.ctr : 0, page: k.cur ? k.cur.page : '' }));
  out.push({ json: { site_idx: a.site_idx, site_id: a.site_id, errors: a.errors, totals: { cur, prev, yoy: a.yoy || null },
    deltas: { clicks_pct: pct(cur.clicks, prev.clicks), impressions_pct: pct(cur.impressions, prev.impressions), position: (prev.position && cur.position) ? +(prev.position - cur.position).toFixed(1) : null, ctr_pts: +((cur.ctr - prev.ctr) * 100).toFixed(2), yoy_clicks_pct: a.yoy ? pct(cur.clicks, a.yoy.clicks) : null },
    daily, query_count: queries.length, queries: queries.slice(0, 100), winners, losers, new_queries: newQ, lost_queries: lost, striking, ctr_gaps: ctrGaps, pages: pages.slice(0, 20), decaying_pages: decaying, not_decay, decay_summary, page_perf, rising_pages: rising, tracked,
    anonymised, brand_split, scraper_queries, page_count: pages.length, rows_read, paging, truncated,
    cannibal, cannibal_summary, devices, countries, change_tests, search_types, recent, content_groups } });   // G9: every row read, the anonymised share, brand vs non-brand, scraper queries apart; B7-2 / B7-3: the device and country splits, and your own pages competing for one search
}
return out.length ? out : [{ json: { skip: true, reason: 'no Search Console data came back' } }];
