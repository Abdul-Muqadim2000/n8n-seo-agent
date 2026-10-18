/*__SITE_MODEL__*/
/*__SERP_OBS__*/
/*__RANK_SERP__*/
// R16 (2026-10-13, FIX_PLAN §3.11): the fit gate also reads the rows stored before it existed. A planned rung that names a competitor
// ("facts erp" -> facts.ae) or a government portal is set aside: no check is bought for it and the report names it with the reason
// instead of listing it as a page to write. A rung whose page is already written or published keeps its check (fitStored).
/*__FIT_GATE__*/
// Rank tracker: one SERP check (Google top 50) per tracked keyword: the primary keyword of every ladder page, plus the head term.
// Reads the ladders and the history from the Data Tables, skips finished ladders and caps the spend per run.
// v4.6 (no repeated checks): live pages, the head term and any keyword the site already ranks for are checked every week; pages not written /
// published yet that do not rank are checked once a month ("do we rank with another page now?") and carried in the report with their last check.
// v4.8: a WON ladder (the main keyword in the top 3 in each of its last 4 checks; failed checks skipped) is no longer dropped: its main keyword
// and its published pages are checked once a month, so a drop is noticed (a drop below the top 3 brings the ladder back to weekly checks).
// v4.16 (G6, 2026-10-12 system review): every check says which device it is for and carries the site's competitor list, so Parse Positions can
// record the competitors' positions and the share of voice from the same answer. The ladder's MAIN keywords (the top rung and the main page) also
// get a MOBILE check once a week — only 13% of sites hold the same position on both devices (Semrush, 50k keywords), so a desktop-only tracker
// reports a position most visitors never see. Cost: one more depth-50 call per main keyword, the measured $0.015, at most 2 per ladder a week
// (about $0.13 a month for a ladder, on top of the ~$0.60 it costs today).
// B6-7 (2026-10-15, benchmark area 6 - docs/system-review-2026-10-14/BENCH_AREA6_rank_tracking.md gap G6-8, register row B6-7):
// the tracker also watches the keywords the CUSTOMER named. max_watch_per_site / max_watch_per_run bound what one week may buy for them
// (the measured $0.015 a check, so 10 a site is $0.15 a week); watch_own_days is our own weekly rhythm (6, not 7, for the same reason the
// mobile check uses 6); watch_site_days is how recent a reading from the weekly SITE check has to be for the tracker to read it instead of
// buying a second one of the same results page on the same morning.
const LIMITS = { max_keywords_per_ladder: 15, max_checks_per_run: 120, stop_after_top3_checks: 4, unpublished_every_days: 28, won_every_days: 28,
  mobile: true, max_mobile_per_ladder: 2, mobile_every_days: 6,   // 6, not 7: a run started by hand on the day of the weekly run must not pay for the same mobile check twice
  max_watch_per_site: 10, max_watch_per_run: 30, watch_own_days: 6, watch_site_days: 10, max_watch_listed: 40 };
const daysSince = (iso) => iso ? (Date.now() - new Date(iso).getTime()) / 864e5 : 1e9;
const deferred = [];
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const rows = $('Load Ladders').all().map(i => i.json).filter(r => r && r.ladder_id);
let history = []; try { history = $('Load History').all().map(i => i.json).filter(r => r && r.ladder_id); } catch (e) { history = []; }
const isMobile = (h) => String((h || {}).device || '') === 'mobile';   // rows written before G6 have no device: they are desktop checks
const deskHist = history.filter(h => !isMobile(h));
// G6: who else we watch on these results pages — the one site model (SITE_MODEL_SPEC.md) merges seo_monitors.competitors with the
// seo_sites model column, so the tracker names the same competitors as the AI and backlink monitors. No rows stored = no competitor list.
const siteRows = rowsOf('Load Sites (Tracker)').filter(r => r.domain);
const monRows = rowsOf('Load Monitors (Tracker)').filter(r => r.site_id || r.domain);
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const competitorsFor = (domain) => {
  const d = normD(domain); if (!d) return [];
  const site = siteRows.find(r => normD(r.domain) === d) || { site_id: 'site_' + d.replace(/[^a-z0-9]+/g, '-'), domain: d };
  const mon = monRows.find(r => r.site_id === site.site_id || normD(r.domain) === d) || {};
  try { return SM.from(site, { monitors: mon }).competitors; } catch (e) { return []; }
};
// R16: the fit gate's context for one site — its own domain, its declared competitors, and the ladder heads plus the site's services as
// protected words (so the ladder's own topic can never be read as a brand).
// R90 (2026-10-16, re-rating 2026-10-15): a stored rung is judged with the evidence the gate needs and the plan never gave it. "facts erp"
// (rung 2 of "erp software uae") names facts.ae, which stands on the HEAD's own stored results page (#6 on 2026-10-14) — but the plan
// gave the gate only the declared competitors, `brands: {}` and no results page, and the rung is checked monthly, so it was planned and
// printed for another month. Now every stored rung of a ladder sees (a) the domains of its ladder's stored results pages (head and rungs,
// the last `serp_days`, the newest desktop reading of each keyword) as `serp_domains`, (b) its own newest stored page as `serp` (one entry
// per position, RS.serpHosts), and (c) the names AI uses for other companies (seo_cache ai_brands:<site>). Protected, so the site's own
// subject can never read as a brand: EVERY ladder head of the site and its services (the gate's own safety valve).
const SERP_DAYS = 60;
const aiBrandRows = rowsOf('Load AI Brands (Tracker)');
const nowIso = new Date().toISOString();
const storedRead = (domain, kw) => { const h = RS.prevReading(deskHist, { keyword: kw, domain, before: nowIso, withSnapshot: true });
  return (h && daysSince(h.checked_at) <= SERP_DAYS) ? h : null; };
const fitCtxFor = (domain, pages) => {
  const d = normD(domain);
  const site = siteRows.find(r => normD(r.domain) === d) || { site_id: 'site_' + d.replace(/[^a-z0-9]+/g, '-'), domain: d };
  const mon = monRows.find(r => r.site_id === site.site_id || normD(r.domain) === d) || {};
  let services = [];
  try { services = SM.from(site, { monitors: mon }).services || []; } catch (e) { services = []; }
  const heads = rows.filter(r => normD(r.domain) === d).map(r => String(r.head_keyword || ''));
  const serp_domains = [...new Set((pages || []).flatMap(p => RS.serpHosts(storedRead(d, p.keyword), 10)))].filter(h => normD(h) !== d);
  return { own_domain: d, brands: fitLearnedBrands(aiBrandRows.filter(r => String(r.key || '') === 'ai_brands:' + site.site_id)), competitors: competitorsFor(domain), serp_domains,
    protect: [...new Set([...heads, ...(pages || []).map(p => String(p.head_keyword || '')), ...services].filter(Boolean))] };
};
const byLadder = new Map();
for (const r of rows) { if (!byLadder.has(r.ladder_id)) byLadder.set(r.ladder_id, []); byLadder.get(r.ladder_id).push(r); }
const checks = []; const skipped = []; const setAside = []; const pausedLadders = [];
const serpBody = (p, device) => [{ keyword: p.keyword, location_code: Number(p.location_code), language_code: p.language_code || 'en', depth: 50,
  device, os: device === 'mobile' ? 'android' : 'windows' }];   // the device was never set before G6 (DataForSEO's default is desktop/windows)
for (const [id, pages] of byLadder) {
  const top = pages.find(p => Number(p.rung) === 4) || pages[0];
  const topHist = deskHist.filter(h => h.ladder_id === id && h.keyword === top.keyword && h.position !== '' && h.position != null && Number(h.position) >= 0).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));   // -1 = failed check: check again
  const last = topHist.slice(0, LIMITS.stop_after_top3_checks);
  const won = last.length >= LIMITS.stop_after_top3_checks && last.every(h => Number(h.position) > 0 && Number(h.position) <= 3);
  if (won && daysSince(last[0].checked_at) < LIMITS.won_every_days) {
    skipped.push({ ladder_id: id, reason: 'won: the top rung has held the top 3 for ' + last.length + ' checks — checked monthly, next after ' + new Date(new Date(last[0].checked_at).getTime() + LIMITS.won_every_days * 864e5).toISOString().slice(0, 10), won: true }); continue;
  }
  const competitors = competitorsFor(top.domain);
  const fitCtx = fitCtxFor(top.domain, pages);
  // R87 (2026-10-16): a ladder whose MAIN keyword is set aside is paused — its rungs exist only to climb towards it. Set aside means the
  // head row says `set_aside` (the Rank Tracker report and the cadence write it back with the reason) or the gate refuses the head now on
  // its own stored results page. Pages of the ladder that are live keep their weekly check (they are real pages); nothing else is bought.
  const headRow = pages.find(p => Number(p.rung) === 4) || null;
  const headFit = headRow ? fitStored(headRow, { ...fitCtx, serp: RS.serpHosts(storedRead(top.domain, headRow.keyword), 10) }) : { ok: true };
  const headAside = headRow && (String(headRow.status || '') === 'set_aside' || (headFit.flagged && !headFit.ok))
    ? { ladder_id: id, domain: top.domain, head_keyword: headRow.keyword, reason: String(headRow.status || '') === 'set_aside' ? 'set aside' : headFit.reason,
        detail: String(headRow.status || '') === 'set_aside' ? String(headRow.status_note || 'its main keyword was set aside') : headFit.detail,
        note: String(headRow.status || '') === 'set_aside' ? String(headRow.status_note || '') : headFit.note, held: [] } : null;
  if (headAside) pausedLadders.push(headAside);
  const sorted = [...pages].sort((a, b) => Number(a.rung) - Number(b.rung) || Number(a.page_no) - Number(b.page_no)).slice(0, LIMITS.max_keywords_per_ladder);
  const mobileWanted = [];   // the ladder's main keywords: the top rung and the main page (page 1), at most max_mobile_per_ladder
  for (const p of sorted) {
    if (checks.length >= LIMITS.max_checks_per_run) break;
    const live = Number(p.rung) === 4 || p.status === 'published' || p.page_exists === true || p.page_exists === 'true';
    // R16: a rung stored before the fit gate that nobody should write — no check is bought and the report names it with the reason
    const realPage = p.status === 'published' || p.page_exists === true || p.page_exists === 'true';
    if (headAside && Number(p.rung) === 4 && String(p.status || '') === 'set_aside') continue;   // R87: a head already set aside is not bought again
    if (headAside && Number(p.rung) !== 4 && !realPage) { headAside.held.push(p.keyword); continue; }   // R87: paused, so nothing is bought for a page that is not live
    const fit = fitStored(p, { ...fitCtx, serp: RS.serpHosts(storedRead(p.domain, p.keyword), 10) });
    if (fit.flagged) setAside.push({ ladder_id: id, domain: p.domain, head_keyword: p.head_keyword, rung: Number(p.rung) || 0, page_no: Number(p.page_no) || 0, keyword: p.keyword,
      target_url: p.target_url || '', status: p.status || '', reason: fit.reason, detail: fit.detail, note: fit.note, written: !!fit.live, dropped: !fit.ok });
    if (!fit.ok) continue;
    if (won && !live) continue;   // won ladder, monthly check: the main keyword and the published pages only
    const lastH = deskHist.filter(h => h.ladder_id === id && h.keyword === p.keyword).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0];
    if (!live && lastH && Number(lastH.position) === 0 && daysSince(lastH.checked_at) < LIMITS.unpublished_every_days) {   // only 'not in the top 50' (0); a page that ranks (published but not reported) or a failed check (-1) stays weekly
      deferred.push({ ladder_id: id, domain: p.domain, head_keyword: p.head_keyword, rung: Number(p.rung), page_no: Number(p.page_no), keyword: p.keyword, page_type: p.page_type || '', target_url: p.target_url || '', status: p.status || '',
        last_position: Number(lastH.position), last_url: lastH.url || '', last_checked: lastH.checked_at, device: 'desktop' }); continue; }
    const base = { ladder_id: id, domain: p.domain, head_keyword: p.head_keyword, rung: Number(p.rung), page_no: Number(p.page_no), keyword: p.keyword, page_type: p.page_type || '', target_url: p.target_url || '', status: p.status || '',
      location_code: Number(p.location_code), language_code: p.language_code || 'en', email: p.email || '', callback_url: p.callback_url || '', request_id: p.request_id || '', country: p.country || '', won_monthly: won, competitors };
    checks.push({ ...base, device: 'desktop', endpoint: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced', body: serpBody(p, 'desktop') });   // depth 50: ~$0.015 per check (depth 100 measured at $0.028); positions below 50 add little for a ladder
    if (LIMITS.mobile && (Number(p.rung) === 4 || Number(p.page_no) === 1) && mobileWanted.length < LIMITS.max_mobile_per_ladder && !mobileWanted.some(m => m.keyword === p.keyword)) mobileWanted.push(base);
  }
  // one mobile check per main keyword, after the desktop ones (so the desktop series keeps its order and the cap is spent on it first)
  for (const m of mobileWanted) {
    if (checks.length >= LIMITS.max_checks_per_run) break;
    const lastM = history.filter(h => isMobile(h) && h.ladder_id === id && h.keyword === m.keyword).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0];
    const every = won ? LIMITS.won_every_days : LIMITS.mobile_every_days;
    if (lastM && daysSince(lastM.checked_at) < every) { deferred.push({ ladder_id: id, domain: m.domain, head_keyword: m.head_keyword, rung: m.rung, page_no: m.page_no, keyword: m.keyword, page_type: m.page_type, target_url: m.target_url, status: m.status,
      last_position: Number(lastM.position), last_url: lastM.url || '', last_checked: lastM.checked_at, device: 'mobile' }); continue; }
    checks.push({ ...m, device: 'mobile', endpoint: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced', body: serpBody(m, 'mobile') });
  }
}
// ---- B6-7 (2026-10-15, benchmark area 6 - BENCH_AREA6_rank_tracking.md section 7): the keywords the CUSTOMER named ----
// Until now `Tracker Plan` read `seo_ladders` and nothing else, so the thirty searches a business names when it sets tracking up were
// invisible to the tracker that exists for exactly that question (gap G6-8: "a tracker tracks whatever keyword list you give it").
// Their list is already stored - `seo_sites.keywords`, written by the tracking form and by "Track my site" - and the weekly Site
// Tracker already BUYS a live check for much of it an hour later and stores the reading in THIS table (ladder_id = site_id, rung 0).
// So the rule here is read first, buy second:
//   * a reading the weekly site check made less than `watch_site_days` ago is READ, never bought again - the two workflows share one
//     series instead of each paying for the same results page on the same morning (R28's rule one step up: money is counted once
//     because it is spent once). Our own reading counts for `watch_own_days`, so the series stays weekly;
//   * what is bought is bounded - `max_watch_per_site` a site and `max_watch_per_run` a run, oldest reading first - and every keyword
//     the cap does not reach is NAMED with the cap and its last reading, never silently dropped (INVARIANTS rule 1);
//   * INVARIANTS rule 2: a stored keyword is read through the same fit gate the stored rungs pass. A competitor's brand typed into a
//     form is still a competitor's brand. Unlike the Site Tracker's own read path, the customer's keywords are deliberately NOT put
//     in `protect` here - protecting them would mean the gate could never judge them, which is the whole point of running it;
//   * the rows are written under `watch_<site_id>`, so a reading of ours is told apart from the site check's own (that is what makes
//     "somebody already buys this one weekly" a measurement and not a guess) while both halves stay one series for the report.
const kwList = (v) => [...new Set(String(v || '').split(/[\n,;]+/).map(k => k.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean))];
const already = new Set();   // what the ladders of this run already cost money for, or deliberately did not: a keyword is counted once
for (const c of checks) already.add(normD(c.domain) + '|' + String(c.keyword).toLowerCase());
for (const d of deferred) already.add(normD(d.domain) + '|' + String(d.keyword).toLowerCase());
for (const a of setAside) already.add(normD(a.domain) + '|' + String(a.keyword).toLowerCase());
const watchChecks = []; const watchCarried = []; const watchHeld = []; const watchAside = []; const watchSites = [];
let watchBudget = LIMITS.max_watch_per_run;
for (const s of siteRows) {
  if (String(s.status || 'active') === 'paused') continue;
  const d = normD(s.domain); if (!d) continue;
  const kws = kwList(s.keywords); if (!kws.length) continue;
  const sid = String(s.site_id || ('site_' + d.replace(/[^a-z0-9]+/g, '-')));
  const wid = 'watch_' + sid;
  const mon = monRows.find(m => m.site_id === sid || normD(m.domain) === d) || {};
  let services = []; try { services = SM.from(s, { monitors: mon }).services || []; } catch (e) { services = []; }
  const fitCtx = FITR.ctx({ own_domain: d, competitors: competitorsFor(d), heads: rows.filter(r => normD(r.domain) === d).map(r => r.head_keyword), services });
  const gated = FITR.rungs(kws.map(k => ({ keyword: k, domain: d, ladder_id: wid })), fitCtx, { where: 'the weekly rank tracker' });
  for (const a of gated.set_aside) watchAside.push({ site_id: sid, domain: d, keyword: a.keyword, reason: a.reason, detail: a.detail, dropped: !!a.dropped,
    note: '"' + a.keyword + '" is on your tracking list, but no position is checked for it: ' + a.detail + ' (' + a.reason + '). Take it off the list, or tell us it is deliberate.' });
  const kept = gated.keep.map(r => r.keyword);
  const site = { site_id: sid, domain: d, email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '',
    country: s.country || '', total: kws.length, checked: 0, carried: 0, held: 0, set_aside: gated.set_aside.filter(x => x.dropped).length };
  const loc = Number(s.location_code) || 0;
  if (!(loc > 0)) {   // rule 1: a keyword nobody can buy a country-level check for is named, not quietly missing
    for (const k of kept) watchHeld.push({ site_id: sid, domain: d, keyword: k, last_position: null, last_checked: '',
      reason: 'no market (country) is stored for this website, so a position cannot be checked for it - set the country in your tracking settings' });
    site.held = kept.length; watchSites.push(site); continue;
  }
  const competitors = competitorsFor(d);
  const newest = (kw, who) => deskHist.filter(h => String(h.keyword).toLowerCase() === kw && (who ? h.ladder_id === who : (h.ladder_id === wid || h.ladder_id === sid || normD(h.domain) === d))
    && h.position !== '' && h.position != null && h.checked_at).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0] || null;
  const cand = [];
  for (const k of kept) {
    const theirs = newest(k, sid), ours = newest(k, wid), any = newest(k, '');
    if (already.has(d + '|' + k)) {
      watchCarried.push({ site_id: sid, domain: d, keyword: k, source: 'ladder', last_checked: any ? any.checked_at : '',
        reason: 'it is also a rung of one of your keyword ladders, so the check bought there is the one reported - it is never bought twice' });
      site.carried++; continue;
    }
    if (theirs && daysSince(theirs.checked_at) < LIMITS.watch_site_days) {
      watchCarried.push({ site_id: sid, domain: d, keyword: k, source: 'site_check', last_checked: theirs.checked_at,
        reason: 'the weekly site check already read this results page on ' + String(theirs.checked_at).slice(0, 10) + ', so the tracker reads that reading instead of buying a second one' });
      site.carried++; continue;
    }
    if (ours && daysSince(ours.checked_at) < LIMITS.watch_own_days) {
      watchCarried.push({ site_id: sid, domain: d, keyword: k, source: 'own', last_checked: ours.checked_at,
        reason: 'it was checked on ' + String(ours.checked_at).slice(0, 10) + ', less than ' + LIMITS.watch_own_days + ' days ago - a position is checked once a week, not once a run' });
      site.carried++; continue;
    }
    cand.push({ keyword: k, last_at: any ? String(any.checked_at) : '', last_position: any ? Number(any.position) : null });
  }
  // oldest reading first, and a keyword nobody has ever checked before all of them: the cap buys the readings that are missing most
  cand.sort((a, b) => (a.last_at ? 1 : 0) - (b.last_at ? 1 : 0) || String(a.last_at).localeCompare(String(b.last_at)) || a.keyword.localeCompare(b.keyword));
  const room = Math.max(0, Math.min(LIMITS.max_watch_per_site, watchBudget, LIMITS.max_checks_per_run - checks.length - watchChecks.length));
  cand.forEach((c, i) => {
    if (i < room) {
      watchChecks.push({ ladder_id: wid, watch_keyword: true, site_id: sid, domain: d, head_keyword: '', rung: 0, page_no: 0, keyword: c.keyword,
        page_type: '', target_url: '', status: '', location_code: loc, language_code: s.language_code || 'en', email: s.email || '',
        callback_url: s.callback_url || '', request_id: s.request_id || '', country: s.country || '', won_monthly: false, competitors,
        device: 'desktop', endpoint: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
        body: serpBody({ keyword: c.keyword, location_code: loc, language_code: s.language_code || 'en' }, 'desktop') });
      site.checked++;
    } else {
      watchHeld.push({ site_id: sid, domain: d, keyword: c.keyword, last_position: c.last_position, last_checked: c.last_at,
        reason: 'the tracker buys at most ' + LIMITS.max_watch_per_site + ' checks a week for your own keyword list (oldest reading first, about $0.015 each), so this one waits for a week when an older reading does not need it more' });
      site.held++;
    }
  });
  watchBudget -= site.checked;
  watchSites.push(site);
}
const watch = { sites: watchSites, limits: { per_site: LIMITS.max_watch_per_site, per_run: LIMITS.max_watch_per_run, own_days: LIMITS.watch_own_days, site_days: LIMITS.watch_site_days },
  carried: watchCarried.slice(0, LIMITS.max_watch_listed), held: watchHeld.slice(0, LIMITS.max_watch_listed), set_aside: watchAside.slice(0, LIMITS.max_watch_listed),
  carried_total: watchCarried.length, held_total: watchHeld.length, set_aside_total: watchAside.length, checked_total: watchChecks.length };
const all = [...checks, ...watchChecks];
if (!all.length) return [{ json: { nothing_to_do: true, ladders: byLadder.size, skipped, deferred, set_aside: setAside, paused_ladders: pausedLadders, watch } }];
return all.map(c => ({ json: { ...c, skipped_ladders: skipped, deferred_pages: deferred, set_aside_pages: setAside, paused_ladders: pausedLadders, watch } }));
