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
  const UPDATES = [].concat(/*__GOOGLE_UPDATES__*/);
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
