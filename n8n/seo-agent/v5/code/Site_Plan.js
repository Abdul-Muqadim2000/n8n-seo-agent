// Site tracker plan: one job per tracked site. Sites come from the Data Table "seo_sites" (registered through the form option
// "Track my site" / API mode "track") plus every domain that has a keyword ladder (registered automatically, e-mail from the ladder).
// Google data is read for the last 28 complete days ending 3 days ago (Search Console data is final after about 3 days),
// against the 28 days before and the same 28 days a year earlier.
// B-G3 (2026-10-15, FIX_PLAN §3.16; INVARIANTS rule 2): every stored rung used to join the tracked keywords with no gate, so a rung set
// aside for being a competitor's brand still bought a live rank check every week and still appeared in the weekly report. The same shared
// read-path gate the Rank Tracker and the Content Cadence use (FITR, _fit_gate.js) runs here, and what it sets aside is named with its reason.
/*__FIT_GATE__*/
const CONFIG = {
  service_account_email: '__SA_EMAIL__',   // filled from n8n/.env (SEO_GOOGLE_SA_EMAIL) at build time; shown in the connect instructions
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
const checkinRows = rowsOf('Load Check-ins').filter(r => r.site_id && r.month);     // monthly owner check-ins (manual action / security / Pages export)
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
const ranges = { current: { start: iso(addDays(end, -27)), end: iso(end) }, previous: { start: iso(addDays(end, -55)), end: iso(addDays(end, -28)) }, yoy: { start: iso(addDays(end, -27 - 364)), end: iso(addDays(end, -364)) } };
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
    serp_positions: serp, pending_publish, needs_fix, console_alerts, last_checkin, checkin_due, ranges, on_demand, checked_at: now, config: CONFIG } };
});
