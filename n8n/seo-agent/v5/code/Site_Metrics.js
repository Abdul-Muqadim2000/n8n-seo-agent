// Joins everything per site: Search Console, GA4, index status, trends and the live SERP checks -> KPIs, alerts, ranked actions (with
// ready-to-send API bodies), and the exact rows for the Data Tables seo_site_metrics / seo_query_history / seo_sites.
// v4.8: pages the publish detection found live this week (`detected_published`, `publish_detection`) count as published pages here.
// G19 (2026-10-12, SITE_MODEL_SPEC.md): the site model resolved earlier in this run - the canonical host every URL uses, the business
// name / NAP / logo, the services and the nav pages. SM.toRow(model) goes back into the seo_sites row, so the next run and every other
// workflow read the same facts; the brief is given the host and the name (never the bare domain).
/*__SITE_MODEL__*/
/*__SITE_STATS__*/
/*__PAGE_WATCH__*/
// G12 / G29 (2026-10-13, FIX_PLAN): the events of the period are marked for every chart (pages published, audit fixes, Google
// updates, data breaks — AN, from v5/data/seo_events.json and the stored rows), and every figure group carries its source, period
// and sample (LN). A figure whose source nobody recorded says "source not recorded" instead of borrowing one.
/*__ANNOTATIONS__*/
/*__LINEAGE__*/
/*__CHANGE_TEST__*/
// G28 (2026-10-12, FIX_PLAN): a traffic alert fires on a STATISTICAL change, not on a fixed 30%. ST.change (two-sample Poisson z, 95% range)
// decides; a large move that is still inside sampling noise is reported as "watch". Google's own update dates are added as context.
const FORM_URL = '__FORM_URL__', API_URL = '__API_URL__';
const sites = $('Resolve Properties').all().map(i => i.json);
const siteModels = (() => { try { return $('Site Model (Site)').all().map(i => i.json).filter(m => m && m.site_id); } catch (e) { return []; } })();
const grab = (name) => { try { return $(name).all().map(i => i.json).filter(j => j && !j.skip && !j.error); } catch (e) { return []; } };
const gscAll = grab('Parse GSC'), ga4All = grab('Parse GA4'), inspAll = grab('Parse Inspection'), trendAll = grab('Parse Trends'), serpAll = grab('Parse Site SERP');
let ga4Reason = ''; try { const r = ($('GA4 Requests').first() || {}).json; if (r && r.skip) ga4Reason = r.reason || ''; } catch (e) {}
const gErr = (r) => { if (!r) return 'no response'; const e = r.error; if (!e) return null; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return String((inner && inner.message) || (ctx.error_description ? String(ctx.error || 'error') + ': ' + ctx.error_description : '') || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200); };   // Google errors: the useful text sits in context.data (invalid_grant: account not found) or in error.message (PERMISSION_DENIED)
let acctErr = ''; try { const a = ($('GA4 Accounts').first() || {}).json || {}; if (a.error) acctErr = gErr(a); } catch (e) {}
const metricsHist = (() => { try { return $('Load Site Metrics').all().map(i => i.json).filter(r => r && r.site_id && !r.error); } catch (e) { return []; } })();
// G11 / G25 (2026-10-13): the daily key-page watch's rows and its site fingerprint, so the weekly report and the app's technical page show
// the same picture (the watch runs in its own workflow, SEO Agent — Page Watch, every morning)
const watchRows = grab('Load Page Watch (Site)').filter(r => r.site_id && r.url);
const watchCacheRows = grab('Load Watch Cache (Site)').filter(r => String(r.key || '').indexOf('watch:') === 0);
// G12: the stored rows the chart marks are computed from — pages that went live (seo_content_log) and the technical audits (seo_audits)
const logRowsAll = (() => { try { return $('Load Content Log').all().map(i => i.json).filter(r => r && r.site_id && !r.error); } catch (e) { return []; } })();
const auditRowsAll = (() => { try { return $('Load Audits (Site)').all().map(i => i.json).filter(r => r && r.site_id && !r.error); } catch (e) { return []; } })();
const queryHist = (() => { try { return $('Load Query History').all().map(i => i.json).filter(r => r && r.site_id && r.tracked && !r.error); } catch (e) { return []; } })();
const now = new Date().toISOString();
const pct = (cur, prev) => prev > 0 ? Math.round((cur - prev) / prev * 100) : (cur > 0 ? null : 0);
const r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
const normD = (x) => String(x || '').toLowerCase().replace(/^www\./, '');
// v4.8 publish detection (Detect Published): pages found live this week, and whether storing them worked (onError nodes: read their output)
const detAll = (() => { try { return $('Detect Published').all().map(i => i.json).filter(x => x && x.site_id && Array.isArray(x.detected)); } catch (e) { return []; } })();
// D11 (2026-10-12): the week's page inventory (Page Inventory (Site)) rides in the site model, so the advice knows what the site already has
const invAll = (() => { try { return $('Page Inventory (Site)').all().map(i => i.json).filter(x => x && x.site_id && Array.isArray(x.pages)); } catch (e) { return []; } })();
const detErrors = (() => { const out = []; for (const nm of ['Save Detected (Log)', 'Mark Case Study Published (Detect)', 'Mark Ladder Published (Detect)']) { try { for (const i of $(nm).all()) if (i.json && i.json.error) out.push(nm + ': ' + gErr(i.json)); } catch (e) {} } return out; })();
const detFail = (() => { for (const nm of ['Publish Candidates', 'Sitemap Children (Detect)', 'Match Slugs (Detect)', 'Detect Published']) { try { const e = $(nm).all().find(i => i.json && i.json.error); if (e) return nm + ': ' + gErr(e.json); } catch (x) {} } return ''; })();   // a failed detection step never stops the report
const ukey = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '');   // host-agnostic
const kwKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
return sites.map((s, idx) => {
  const cfg = s.config || {}; const R = s.ranges;
  const baseModel = (siteModels.find(m => m.site_id === s.site_id) || {}).model || SM.from({ site_id: s.site_id, domain: s.domain }, {});
  const inv = invAll.find(x => x.site_id === s.site_id) || null;
  const model = inv ? SM.withPages(baseModel, inv.pages) : baseModel;
  // a live page that already answers this keyword: never "publish a new page", always "refresh that page" (D11)
  const covered = (kw, notUrl) => { const m = SM.matchPage(model, kw); return (m && ukey(m.url) !== ukey(notUrl)) ? m : null; };
  // P2-3 (2026-10-12, Phase 2 live check; D15): a ladder row stores the target URL with the host it was written with — 17 of techand.ai's 18
  // rows are bare-host — so the report and the brief told the owner to publish at a URL that 308-redirects. Every URL we PROMISE (a page that
  // is not live yet) goes onto the canonical host; a URL we OBSERVED (a published or already existing page, Search Console, the sitemap) keeps
  // the host it really has. The stored rows themselves are rewritten once by fix_ladder_hosts.py.
  const onHost = (u) => { const raw = String(u || '').trim(); if (!raw) return raw; const h = SM.helpers.hostOf(raw);
    return (h && SM.helpers.bare(h) === SM.helpers.bare(s.domain)) ? SM.siteUrl(model, SM.helpers.pathOf(raw)) : raw; };
  const promised = (p) => (p && !(p.page_exists || p.status === 'published')) ? { ...p, url: onHost(p.url) } : p;
  const gsc = gscAll.find(g => g.site_idx === idx) || null;
  const ga4 = ga4All.find(g => g.site_idx === idx) || null;
  const insp = inspAll.filter(x => x.site_idx === idx);
  const trends = trendAll.filter(x => x.site_idx === idx);
  const serpRows = serpAll.filter(x => normD(x.domain) === s.domain);
  const serpNow = { ...(s.serp_positions || {}) }; for (const r of serpRows) serpNow[r.keyword] = { position: Number(r.position), url: r.url, checked_at: r.checked_at };
  const gscKw = new Map(((gsc && gsc.tracked) || []).map(t => [t.keyword, t]));
  const tracked = (s.tracked || []).map(t => { const g = gscKw.get(t.keyword); const sp = serpNow[t.keyword];
    const hist = queryHist.filter(h => h.site_id === s.site_id && h.query === t.keyword).sort((a, b) => String(a.period_end).localeCompare(String(b.period_end))).map(h => r1(h.position)).slice(-12);
    return { ...t, gsc_position: g ? g.position : null, gsc_prev_position: g ? g.prev_position : null, clicks: g ? g.clicks : 0, impressions: g ? g.impressions : 0, prev_clicks: g ? g.prev_clicks : 0, prev_impressions: g ? g.prev_impressions : 0, page: g ? g.page : '',
      serp_position: sp ? sp.position : null, serp_url: sp ? sp.url : '', serp_checked_at: sp ? sp.checked_at : '', history: hist }; });
  // pages found live this week replace their planned entry (live URL, published) or are added; they were inspected in this run
  const det = detAll.find(x => x.site_id === s.site_id) || null; const found = det ? det.detected : [];
  // R92 part 4 (2026-10-16, re-rating 2026-10-15): ONE rule with the Rank Tracker (Tracker_Report.js `coveredBy`): a ladder target that
  // a live page of the site already answers (SM.matchPage over this week's inventory) is reported AS that page. Before, this table read
  // only the ladder row ("/peppol-uae/ | writing | no page was written yet") while the Rank Tracker of the same morning said "the main
  // page is live: improve …/top-peppol-e-invoicing-software-features…". The planned URL and the ladder row's own state travel with it, so
  // a page written for that target is still told "do not publish it as a second URL" (D11) below.
  const coverLive = (p) => { if (!p || p.page_exists || p.status === 'published') return p; const c = covered(p.keyword, p.url); if (!c) return promised(p);
    return { ...p, url: c.url, planned_url: onHost(p.url), ladder_status: p.status, status: 'live (existing page)', page_exists: true, covered_by: c.url, covered_match: c.matched_by || '' }; };
  const basePages = (s.ladder_pages || []).map(p => { const f = found.find(f => kwKey(f.keyword) === kwKey(p.keyword) && (!f.ladder_id || !p.ladder_id || f.ladder_id === p.ladder_id)); return f ? { ...p, url: f.url, status: 'published', page_exists: true, detected: true } : coverLive(p); });
  for (const f of found) if (!basePages.some(p => ukey(p.url) === ukey(f.url))) basePages.push({ url: f.url, keyword: f.keyword, rung: 0, status: 'published', ladder_id: f.ladder_id || '', page_exists: true, detected: true });
  // G25 (2026-10-13): an inspection the quota did not reach, or one that failed, is "not checked" — never "not indexed" (`skipped` / `not_checked`)
  const pages = basePages.map(p => { const i = insp.find(x => x.url === p.url && !x.skipped && !x.inspect_error) || insp.find(x => x.url === p.url); const asked = !!i && !i.skipped && !i.inspect_error;
    return { ...p, inspected: asked, indexed: asked ? !!i.indexed : null, verdict: asked ? i.verdict : '', coverage: asked ? i.coverage : '', last_crawl: asked ? i.last_crawl : '', canonical_ok: asked ? i.canonical_ok : null,
      google_canonical: asked ? i.google_canonical : '', mobile_usable: asked ? i.mobile_usable : null, rich_results: asked ? i.rich_results : [],
      inspect_error: asked ? null : (i ? (i.not_checked || i.inspect_error) : (s.gsc_connected ? 'not inspected' : 'Search Console not connected')) }; });
  // pages not live yet are reported as such, never as 'not indexed'
  // R1 (2026-10-13): "written, not published yet" only when seo_content_log says the page was written (Site Plan's `written`); a ladder row
  // that merely says `writing` is a promise — a refused page run leaves exactly that, and the note says what happened.
  // R111 (2026-10-16): a draft whose last quality round failed is neither "written, not published yet" nor "no page was written yet"
  for (const p of pages) if (!(p.page_exists || p.status === 'published')) { p.inspect_error = (['writing', 'written', 'not_ready'].includes(p.status) && p.written) ? 'written, not published yet' : (['writing', 'written', 'not_ready'].includes(p.status) && p.not_ready) ? ('written, but the draft did not pass the quality check — fix it and run it again' + ((p.qa_reasons || []).length ? ': ' + String(p.qa_reasons[0]).slice(0, 160) : '')) : p.status === 'writing' ? ('no page was written yet' + (p.status_note ? ': ' + String(p.status_note).slice(0, 160) : '')) : 'planned, not written yet'; p.indexed = null; }
  for (const p of pages) if (p.covered_by && !p.inspected) p.inspect_error = 'not inspected this week; this existing page answers the search the ladder planned ' + (p.planned_url || 'a new page') + ' for';
  // ---- alerts ----
  // G28: `drop` is no longer the test, it is the line between a medium and a high alert. The test is ST.change: enough events in the two
  // periods together (min_events), a change beyond 95% sampling noise (|z| >= 1.96) and a size worth reporting (min_pct).
  // G28 follow-up (2026-10-12, FIX_PLAN section 3.8): a big move that is not significant is a **medium** alert worded as "Watch", with the
  // counts of both periods named as "small numbers" — a site with 20 clicks a month still hears that it halved (and the line reaches
  // seo_site_metrics.alerts and the app, which keep medium and high), while never being told as a fact that its traffic fell. It can never
  // reach the high band, however large the percentage: only a statistically real fall does.
  const alerts = []; const drop = cfg.alert_drop_pct || 30; const minPct = cfg.alert_min_pct || 10;
  const upd = ST.updateNote(R.current);
  const stat = { clicks: null, impressions: null, sessions: null };
  const countAlert = (key, label, cur, prev, minEvents, level) => {
    const ch = ST.change(cur, prev, { min_events: minEvents, min_pct: minPct }); stat[key] = ch;
    if (ch.direction !== 'down' || !ch.big) return ch;
    // G28 follow-up (2026-10-13): the figures were already there; the alert now also says WHAT was tested and with WHICH test (ST.tested,
    // without repeating the z and the range the sentence already prints)
    const basis = ST.tested(ch, { stats: false, source: key === 'sessions' ? 'Google Analytics 4 organic sessions' : 'Search Console ' + label.toLowerCase() });
    if (ch.real) alerts.push({ level: Math.abs(ch.pct) >= drop ? 'high' : level, text: label + ' fell ' + Math.abs(ch.pct) + '% (' + prev + ' → ' + cur + ' in 28 days' + (ch.ci ? '; 95% range ' + ch.ci[0] + '% to ' + ch.ci[1] + '%' : '') + ', z ' + ch.z + ')' + basis + upd, stat: key, tested: basis });   // no range when one period is zero (the log-ratio is undefined)
    else if (ch.watch) alerts.push({ level: 'medium', text: 'Watch: ' + label.toLowerCase() + ' are ' + Math.abs(ch.pct) + '% lower (' + prev + ' → ' + cur + ' in 28 days). Small numbers: ' + (prev + cur) + ' ' + label.toLowerCase() + ' over both periods together, so a swing this size happens by chance (z ' + ch.z + ') — worth a look, not a confirmed fall' + basis + upd, stat: key, small_numbers: true, tested: basis });
    return ch;
  };
  if (!s.gsc_connected) alerts.push({ level: 'setup', text: 'Search Console is not connected: ' + (s.gsc_error || 'no property found') });
  if (gsc && gsc.errors.length) alerts.push({ level: 'medium', text: 'Some Search Console requests failed: ' + gsc.errors.slice(0, 3).join('; ') });
  if (gsc) countAlert('clicks', 'Search clicks', gsc.totals.cur.clicks, gsc.totals.prev.clicks, cfg.alert_min_click_events || 40, 'medium');
  if (gsc) countAlert('impressions', 'Impressions', gsc.totals.cur.impressions, gsc.totals.prev.impressions, cfg.alert_min_impression_events || 400, 'medium');
  if (ga4) countAlert('sessions', 'Organic sessions', ga4.organic.cur.sessions, ga4.organic.prev.sessions, cfg.alert_min_session_events || 40, 'medium');
  if (ga4 && ga4.errors.length) alerts.push({ level: 'medium', text: 'Some GA4 requests failed: ' + ga4.errors.slice(0, 3).join('; ') });
  for (const p of pages) if (p.inspected && p.indexed === false && (p.page_exists || p.status === 'published')) alerts.push({ level: p.detected ? 'info' : 'high', text: 'Page not indexed: ' + p.url + ' (' + (p.coverage || p.verdict || 'not indexed') + ')' + (p.detected ? ' — found live this week; request indexing to speed it up' : '') });   // a page that just went live is not alarming yet
  for (const p of pages) if (p.inspected && p.indexed && p.canonical_ok === false) alerts.push({ level: 'medium', text: 'Google picked another canonical for ' + p.url });
  // R59 (2026-10-16, re-rating 2026-10-15; the Site Tracker's path of the audit's defect): the canonical alert above looks only at INDEXED
  // pages, and the inspection's `canonical_ok` is host-AGNOSTIC (_page_watch.js) — so a page Google keeps under the bare host while the
  // site redirects to and names www (exec 634: three pages "Duplicate, Google chose different canonical than user", Google's canonical
  // https://techand.ai/…) could never raise anything here. Every inspected page of this run is read, not only the ladder pages, and the
  // split is named for what it is: Google chose the other host, so the fix is the sitemap and the internal links, not "request indexing".
  const hostSplit = (() => { const own = SM.helpers.bare(model.canonical_host || s.domain); const want = String(model.canonical_host || '').toLowerCase();
    const rows = insp.filter(x => x && x.url && x.google_canonical && !x.skipped && !x.inspect_error).filter(x => {
      const hu = String(SM.helpers.hostOf(x.url) || '').toLowerCase(), hg = String(SM.helpers.hostOf(x.google_canonical) || '').toLowerCase();
      return hu && hg && hu !== hg && SM.helpers.bare(hu) === own && SM.helpers.bare(hg) === own && ukey(x.url) === ukey(x.google_canonical); });
    const hosts = [...new Set(rows.map(x => String(SM.helpers.hostOf(x.google_canonical)).toLowerCase()))];
    const origin = (u) => (String(u || '').match(/^https?:\/\/[^\/?#]+/i) || [''])[0];   // an observed URL's own scheme and host, never rebuilt by hand (D15)
    return rows.length ? { pages: rows.map(x => ({ url: x.url, google_canonical: x.google_canonical, indexed: !!x.indexed, coverage: x.coverage || '' })), google_host: hosts[0], site_host: want || String(SM.helpers.hostOf(rows[0].url)).toLowerCase(),
      google_home: origin(rows[0].google_canonical), site_home: SM.siteUrl(model, '/').replace(/\/$/, ''), checked: insp.filter(x => !x.skipped && !x.inspect_error).length } : null; })();
  if (hostSplit) alerts.push({ level: 'medium', stat: 'host_split', text: 'Google keeps ' + hostSplit.pages.length + ' of the ' + hostSplit.checked + ' pages it was asked about under ' + hostSplit.google_home + ' — the other host — although your site serves and names ' + hostSplit.site_home + ' as canonical (Google chose a different canonical than yours): '
    + hostSplit.pages.slice(0, 3).map(x => x.google_canonical).join(', ') + (hostSplit.pages.length > 3 ? ' and ' + (hostSplit.pages.length - 3) + ' more' : '') + '. Those pages are shown under the other host, not missing from Google.' });
  // G28 follow-up (2026-10-13): the last fixed threshold in the site tracking. Search Console's position is an impression-weighted 28-day
  // average, so "5 places" on 12 impressions is one search, not a drop. ST.position needs min_impressions in BOTH periods before it calls a
  // move real, tests the same keyword's clicks over the same two periods, and the alert says what was tested and how sure it is.
  for (const t of tracked) {
    if (!(t.gsc_position > 0 && t.gsc_prev_position > 0 && t.gsc_prev_position <= 20)) continue;
    const pc = ST.position(t.gsc_position, t.gsc_prev_position, { impressions: t.impressions, prev_impressions: t.prev_impressions, clicks: t.clicks, prev_clicks: t.prev_clicks,
      min_impressions: cfg.alert_min_position_impressions || 50, min_places: cfg.alert_min_places || 5 });
    if (pc.direction !== 'down' || !pc.big) continue;
    const moved = '"' + t.keyword + '" slipped from #' + r1(pc.prev) + ' to #' + r1(pc.cur) + ' (' + pc.places + ' places)';
    if (pc.real) alerts.push({ level: t.gsc_prev_position <= 10 ? 'medium' : 'info', text: moved + '. ' + pc.basis + '.' + ST.tested(pc.clicks, { source: 'Search Console clicks for this search' }) + upd, stat: 'position', keyword: t.keyword, tested: pc.basis });
    else alerts.push({ level: 'info', text: 'Watch: ' + moved + ', measured on too little data to call it a drop. ' + pc.basis + '.' + upd, stat: 'position', keyword: t.keyword, small_numbers: true, tested: pc.basis });
  }
  for (const t of tracked) if (t.serp_position > 0 && t.gsc_position && Math.abs(t.serp_position - t.gsc_position) >= 10) alerts.push({ level: 'info', text: '"' + t.keyword + '": live check #' + t.serp_position + ' vs Search Console average #' + r1(t.gsc_position) + ' — positions vary by location and device' });
  if (!ga4) alerts.push({ level: 'setup', text: 'Google Analytics 4 is not connected: ' + (acctErr || ga4Reason || 'no property id given or detected') });
  const notices = s.console_alerts || []; const ck = s.last_checkin || null;
  for (const n of notices) alerts.push({ level: n.severity === 'critical' ? 'high' : n.severity === 'high' ? 'high' : 'medium', text: 'Search Console notice (' + String(n.received_at).slice(0, 10) + '): ' + n.subject });
  if (ck && ck.manual_action && !notices.some(n => n.kind === 'manual_action')) alerts.push({ level: 'high', text: 'Manual action reported in the ' + ck.month + ' check-in' });
  if (ck && ck.security_issue && !notices.some(n => n.kind === 'security')) alerts.push({ level: 'high', text: 'Security issue reported in the ' + ck.month + ' check-in' });
  if (found.length && detErrors.length) alerts.push({ level: 'medium', text: 'Pages found live on the site could not be recorded (' + detErrors[0] + '); report them with "I published a page"' });
  // B7-2 (2026-10-15, benchmark area 7): a device or a country falling on its own disappears inside a site-wide total. The split is
  // free and first-party (Search Analytics `device` / `country`), the same statistical bar as every other alert applies (ST.change),
  // and a split Google did not answer says so instead of showing an empty table that would read as "no phone traffic".
  const DEVICE_LABEL = { DESKTOP: 'desktop', MOBILE: 'phones', TABLET: 'tablets' };
  for (const d of (((gsc && gsc.devices) || {}).rows || []).filter(d => d.change && d.change.real && d.change.direction === 'down').slice(0, 2))
    alerts.push({ level: d.share >= 25 ? 'medium' : 'info', stat: 'device', key: d.key,
      text: 'Search clicks from ' + (DEVICE_LABEL[d.key] || String(d.key).toLowerCase()) + ' fell ' + Math.abs(d.change.pct) + '% (' + d.prev_clicks + ' \u2192 ' + d.clicks
        + ' in 28 days; ' + d.share + '% of your clicks).' + ST.tested(d.change, { source: 'Search Console clicks on ' + (DEVICE_LABEL[d.key] || String(d.key).toLowerCase()) }),
      tested: ST.tested(d.change, { source: 'Search Console clicks on ' + (DEVICE_LABEL[d.key] || String(d.key).toLowerCase())}) });
  for (const c of (((gsc && gsc.countries) || {}).rows || []).filter(c => c.change && c.change.real && c.change.direction === 'down' && c.share >= 10).slice(0, 1))
    alerts.push({ level: 'info', stat: 'country', key: c.key,
      text: 'Search clicks from ' + String(c.key).toUpperCase() + ' fell ' + Math.abs(c.change.pct) + '% (' + c.prev_clicks + ' \u2192 ' + c.clicks + ' in 28 days; ' + c.share + '% of your clicks).'
        + ST.tested(c.change, { source: 'Search Console clicks from ' + String(c.key).toUpperCase() }) });
  if (detFail) alerts.push({ level: 'info', text: 'Publish detection failed this week (' + detFail.slice(0, 160) + '); report published pages with "I published a page"' });
  if (det && det.candidates && !(det.sitemap || {}).ok) alerts.push({ level: 'info', text: 'Publish detection could not read the sitemap (' + ((det.sitemap || {}).error || 'no sitemap') + '); report published pages with "I published a page"' });
  // ---- actions (deterministic; the AI brief words them for the owner) ----
  const actions = []; const apiBase = { country: s.country || '', domain: s.domain, email: s.email || '' };
  const pageBody = (keyword, url, page_type) => ({ mode: 'keyword', keyword, page_type: page_type || 'Service Page', ...apiBase, existing_page_url: url || '', receive: ['Keyword Report', 'Page Content'] });
  // B4-3: the search a page is really refreshed FOR — the query that brings it the most impressions, from this run's own
  // Search Console rows. A refresh with no search behind it is a rewrite nobody asked for.
  const ukeyQ = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '');
  const topQueryOf = (url) => ((gsc && gsc.queries) || []).filter(q => q.page && ukeyQ(q.page) === ukeyQ(url) && q.query)
    .sort((a, b) => (Number(b.impressions) || 0) - (Number(a.impressions) || 0))[0] || null;
  const sa = cfg.service_account_email || '(the service-account e-mail: ask your administrator)';
  for (const n of notices.filter(n => n.kind === 'manual_action' || n.kind === 'security').slice(0, 2)) actions.push({ priority: 1, type: n.kind, action: (n.kind === 'manual_action' ? 'Resolve the manual action: open Search Console → Security & Manual Actions → Manual actions, fix every page it names, then request a review.' : 'Resolve the security issue: clean the site, update CMS and plugins, change passwords, then request a review under Search Console → Security issues.'), why: n.subject + ' (' + String(n.received_at).slice(0, 10) + ').', keyword: '', url: '' });
  for (const n of notices.filter(n => n.kind === 'coverage' || n.kind === 'cwv' || n.kind === 'rich_results' || n.kind === 'sitemap' || n.kind === 'crawl').slice(0, 2)) actions.push({ priority: 2, type: 'console_' + n.kind, action: 'Open the Search Console report named in "' + n.subject + '" and fix the listed pages, then click Validate fix.', why: 'Google sent this notice on ' + String(n.received_at).slice(0, 10) + '.', keyword: '', url: '' });
  if (ck && ck.csv_kind === 'reasons' && (ck.coverage.reasons || []).length) actions.push({ priority: 2, type: 'coverage_report', action: 'Work through the Pages report from your ' + ck.month + ' check-in: ' + ck.coverage.reasons.slice(0, 3).map(r => r.reason + ' (' + r.pages + ' pages)').join(', ') + '.', why: ck.not_indexed_total + ' pages are not indexed site-wide according to Search Console.', keyword: '', url: '' });
  if (s.checkin_due) actions.push({ priority: 3, type: 'checkin', action: 'Monthly Search Console check-in: open the form, answer two questions (manual action? security issue?) and upload the Pages report export.', why: 'Google offers no API for manual actions, security issues and the site-wide Pages report; the check-in covers them' + (cfg.console_mail_watcher ? ' alongside the notification watcher' : '') + '.', keyword: '', url: '' });
  if (!s.gsc_connected) actions.push({ priority: 1, type: 'connect_gsc', action: 'Add ' + sa + ' as a user (Full) of ' + s.domain + ' in Search Console → Settings → Users and permissions.', why: 'Without it the report has no real query, click or index data.', keyword: '', url: '' });
  for (const p of pages.filter(p => p.inspected && p.indexed === false && (p.page_exists || p.status === 'published')).slice(0, 3)) actions.push({ priority: 1, type: 'index', action: 'Request indexing for ' + p.url + ' in Search Console (URL inspection → Request indexing) and link to it from 2-3 existing pages.', why: (p.rung ? 'Ladder rung ' + p.rung + ' for "' + p.keyword + '"' : 'The page for "' + p.keyword + '"') + ' cannot rank until Google indexes it (' + (p.coverage || p.verdict || 'not indexed') + ').', keyword: p.keyword, url: p.url });
  // D11: a page written for a keyword a LIVE page already answers must not go up as a second page — it is folded into the page that exists
  // R111 (2026-10-16): a draft whose last quality round failed gets `fix_draft` — the reasons, and the body that writes it again —
  // never `publish` (exec 634 put "P1 Publish the written page for \"ai consulting\"" on top with an "I published it" button)
  const fixed = new Set();
  const fixDraft = (keyword, url, reasons, page_type) => { const k = kwKey(keyword); if (!k || fixed.has(k)) return; fixed.add(k);
    actions.push({ priority: 1, type: 'fix_draft', keyword, url: url || '', reasons: (reasons || []).slice(0, 6),
      action: 'Fix the draft for "' + keyword + '" and run it again — it did not pass the quality check' + ((reasons || []).length ? ' (' + reasons.slice(0, 2).join('; ').slice(0, 300) + ')' : '') + '. Do not publish it as it is.',
      why: 'The last quality round found what is listed; a page that fails it is a draft to finish, not a page to put live.', api_body: pageBody(keyword, '', page_type || 'Service Page') }); };
  for (const p of pages.filter(p => ['writing', 'written', 'not_ready'].includes(p.ladder_status || p.status) && p.not_ready && !p.written && !p.covered_by).slice(0, 3)) fixDraft(p.keyword, p.url, p.qa_reasons, '');
  for (const f of (s.needs_fix || []).filter(f => !found.some(x => kwKey(x.keyword) === kwKey(f.keyword))).slice(0, 3)) fixDraft(f.keyword, '', f.reasons, f.page_type);
  for (const p of pages.filter(p => ['writing', 'written', 'not_ready'].includes(p.ladder_status || p.status) && p.written && (p.covered_by || !p.page_exists)).slice(0, 3)) { const c = p.covered_by ? { url: p.covered_by, matched_by: p.covered_match || 'slug' } : covered(p.keyword, p.url);   // R1: only a page the content log says was written
    if (c) actions.push({ priority: 1, type: 'refresh_existing', action: 'Do not publish the new page for "' + p.keyword + '" as a second URL: ' + c.url + ' already answers this search. Use the new text to refresh that page instead.', why: 'Two pages for one search split the signals and neither ranks (the live page was found ' + (c.matched_by === 'query' ? 'in Search Console with ' + c.impressions + ' impressions for this query' : 'in the site\'s page list') + ').', keyword: p.keyword, url: c.url });
    else actions.push({ priority: 1, type: 'publish', action: 'Publish the written page for "' + p.keyword + '" (planned URL ' + p.url + ') and report the link with "I published a page".', why: 'It is written but not live yet; nothing can be indexed or ranked before it is published.', keyword: p.keyword, url: p.url }); }
  // R59: the host split, as one piece of work — the sitemap Google reads and the internal links, never "request indexing" page by page
  if (hostSplit) actions.push({ priority: 2, type: 'host_split', keyword: '', url: SM.siteUrl(model, '/'),
    action: 'Make Google use ' + hostSplit.site_home + ': submit the sitemap on ' + hostSplit.site_home + ' in Search Console (in place of one on ' + hostSplit.google_home + '), change the internal links that still point at ' + hostSplit.google_home + ', keep the redirects, and watch these pages move over.',
    why: hostSplit.pages.length + ' inspected page(s) are shown by Google under ' + hostSplit.google_home + ' (its chosen canonical), e.g. ' + hostSplit.pages[0].google_canonical + '.' });
  for (const q of ((gsc && gsc.striking) || []).slice(0, 3)) actions.push({ priority: 2, type: 'striking', action: 'Push "' + q.query + '" from #' + r1(q.position) + ' into the top 3: expand ' + (q.page || 'the ranking page') + ' with the missing sub-topics, add an FAQ and 2-3 internal links to it.', why: q.impressions + ' impressions in 28 days at position ' + r1(q.position) + ' (' + q.clicks + ' clicks); a top-3 spot typically triples the clicks.', keyword: q.query, url: q.page || '', api_body: pageBody(q.query, q.page, 'Service Page') });
  for (const q of ((gsc && gsc.ctr_gaps) || []).slice(0, 2)) actions.push({ priority: 2, type: 'ctr', action: 'Rewrite the title and meta description of ' + (q.page || 'the ranking page') + ' for "' + q.query + '" (lead with the outcome and a number).', why: 'Position ' + r1(q.position) + ' with ' + q.impressions + ' impressions but CTR ' + (q.ctr * 100).toFixed(1) + '% vs about ' + Math.round(q.expected_ctr * 100) + '% expected.', keyword: q.query, url: q.page || '' });
  // B4-1 / B4-3 (2026-10-15, benchmark area 4): a decaying page is a TESTED, SEASONALLY CHECKED judgement, it is ranked by the
  // clicks actually lost, it says which KIND of fall it is (the work differs), and — unlike before — it ships the body that
  // writes the refresh, so the owner can act on it the way they can act on a striking-distance query.
  for (const p of ((gsc && gsc.decaying_pages) || []).slice(0, 2)) { const q = topQueryOf(p.page);
    actions.push({ priority: 2, type: 'decay',
      action: p.kind === 'clickthrough'
        ? 'Rewrite the title and description of ' + p.page + ' first: it is still shown as often, and fewer people click it. Refresh the page itself only if that does not bring the clicks back.'
        : 'Refresh ' + p.page + ': update the facts and the date, add what the top results cover now, and re-promote it.',
      why: p.lost + ' clicks lost in 28 days (' + p.prev_clicks + ' → ' + p.clicks + ', ' + p.pct + '%). ' + p.basis,
      keyword: q ? q.query : '', url: p.page, ...(q ? { api_body: pageBody(q.query, p.page, 'Guide') } : {}) }); }
  // what the old 25% rule would have called decay, and the evidence says is not: reported, never acted on
  for (const p of ((gsc && gsc.not_decay) || []).slice(0, 2)) actions.push({ priority: 4, type: 'decay_watch',
    action: p.state === 'seasonal' ? 'Leave ' + p.page + ' alone for now: it is down on the last 28 days but not on the same weeks a year ago.' : 'Watch ' + p.page + ': the fall is large but could still be chance at this traffic.',
    why: p.basis, keyword: '', url: p.page });
  for (const t of trends.filter(t => t.direction === 'rising' && (t.rising || []).length).slice(0, 1)) actions.push({ priority: 3, type: 'trend', action: 'Interest in "' + t.keyword + '" is rising (' + (t.change_pct > 0 ? '+' : '') + t.change_pct + '% vs the 12-month average); cover the rising searches: ' + t.rising.slice(0, 3).map(r => r.query).join(', ') + '.', why: 'Google Trends, past 12 months.', keyword: t.rising[0].query, url: '', api_body: { mode: 'verdict', keyword: t.rising[0].query, ...apiBase } });
  for (const t of trends.filter(t => t.direction === 'falling').slice(0, 1)) actions.push({ priority: 4, type: 'trend', action: 'Interest in "' + t.keyword + '" is falling (' + t.change_pct + '% vs the 12-month average)' + (t.peak_date ? '; it peaked around ' + String(t.peak_date).slice(0, 7) : '') + '. Keep the page current but do not over-invest; watch the related rising searches.', why: 'Google Trends, past 12 months.', keyword: t.keyword, url: '' });
  if (!ga4) actions.push({ priority: 4, type: 'connect_ga4', action: 'Add the same service account as a Viewer of the GA4 property (Admin → Property access management), or register the site with its GA4 property ID.', why: 'Connects search visibility to visits and key events (conversions).', keyword: '', url: '' });
  // B7-3 (2026-10-15, benchmark area 7): two of the site's own pages shown for one search, measured by Google. Never "publish
  // another page" — the opposite of D11, and the same rule: one search, one page.
  for (const c of ((gsc && gsc.cannibal) || []).slice(0, 2)) actions.push({ priority: 2, type: 'cannibalisation',
    action: 'Two of your pages compete for "' + c.query + '": ' + c.pages.map(p => p.page).slice(0, 3).join(' and ')
      + '. Decide which one answers this search, point the other one at it with a link (or merge and redirect), and give the second page its own search.',
    why: c.basis + (c.split ? ' Google shows ' + c.preferred + ' most often, but ' + c.best.page + ' ranks better when it is shown — the two are splitting the signals for this search.' : ''),
    keyword: c.query, url: c.preferred });
  actions.sort((a, b) => a.priority - b.priority); const acts = actions.slice(0, 12);   // the brief picks the top 5-6; the full list stays in the callback
  // ---- rows for the Data Tables ----
  const T = gsc ? gsc.totals : null; const G = ga4;
  const prevRuns = metricsHist.filter(m => m.site_id === s.site_id).sort((a, b) => String(a.period_end).localeCompare(String(b.period_end))).slice(-12).map(m => ({ period_end: m.period_end, clicks: Number(m.clicks) || 0, impressions: Number(m.impressions) || 0, position: r1(m.position), sessions: Number(m.sessions) || 0 }));
  // ---- G12 (2026-10-13): the events of the two periods this report compares, marked on every chart ----
  const myLogs = logRowsAll.filter(r => r.site_id === s.site_id || normD(r.domain) === s.domain);
  const publishedLogs = myLogs.filter(r => String(r.published_at || '').slice(0, 10));
  const loggedKw = new Set(publishedLogs.map(r => kwKey(r.keyword)));
  const annotations = AN.marks({ from: R.previous.start, to: R.current.end,
    published: [...publishedLogs.map(r => ({ published_at: r.published_at, keyword: r.keyword, published_url: r.published_url, source: r.source })),
      ...found.filter(f => !loggedKw.has(kwKey(f.keyword))).map(f => ({ published_at: (det && det.checked_at) || now, keyword: f.keyword, published_url: f.url, source: f.ladder_id ? 'ladder' : 'detected' }))],
    notes: s.owner_notes || [],   // B7-7: the owner's dated notes
    // R20 (2026-10-14): the report type travels with every audit row, so a full SEO report between two technical audits is marked as a
    // report of another kind instead of chaining its health score to theirs (three invented moves in one day, live on 2026-10-11)
    audits: auditRowsAll.filter(r => r.site_id === s.site_id || normD(r.domain) === s.domain)
      .map(r => ({ audited_at: r.audited_at, report_type: r.report_type || 'site_audit', health_score: r.health_score, findings: r.findings })) });
  const data_breaks = AN.breakBetween(R.previous.start, R.current.end);
  // ---- B7-6 (W3-D, 2026-10-17): BRAND IN ONE PLACE. Branded Search Console clicks, GA4 direct sessions and AI-assistant referral sessions as
  // one series set, each line with its own source and basis (SEOTesting's Brand Signals draws the same three on one chart). The lines
  // are NOT added together: they count different things (searches for the name, visits typed or untracked, visits from AI answers).
  const brand_series = (() => {
    const opts = { min_events: Number(cfg.alert_min_click_events) || 40, min_pct: Number(cfg.alert_min_pct) || 10 };
    const line = (key, label, source, cur, prev, basis, unit) => ({ key, label, source, unit, read: true, cur, prev, change: ST.change(cur, prev, opts), basis });
    const miss = (key, label, source, reason) => ({ key, label, source, read: false, reason });
    const L = [];
    const bs = gsc && gsc.brand_split;
    L.push(bs && bs.names && bs.names.length ? line('gsc_brand', 'Branded Search Console clicks', 'Search Console', bs.brand.clicks, bs.previous.brand.clicks, 'clicks on searches containing ' + bs.names.slice(0, 4).join(' / ') + '; searches Google withholds are not counted', 'clicks')
      : miss('gsc_brand', 'Branded Search Console clicks', 'Search Console', gsc ? 'no brand name is known for this site, so branded searches cannot be told apart' : 'Search Console is not connected'));
    L.push(ga4 && ga4.direct ? line('ga4_direct', 'GA4 direct sessions', 'Google Analytics 4', ga4.direct.cur.sessions, ga4.direct.prev.sessions, "sessions in GA4's Direct channel: people who typed the address or came from a source GA4 could not name, so it is an upper bound on brand demand", 'sessions')
      : miss('ga4_direct', 'GA4 direct sessions', 'Google Analytics 4', 'Google Analytics is not connected'));
    L.push(ga4 && ga4.ai_referrals ? line('ga4_ai', 'AI-assistant referral sessions', 'Google Analytics 4', ga4.ai_referrals.cur.sessions, ga4.ai_referrals.prev.sessions, 'sessions whose source is an AI assistant (ChatGPT, Perplexity, Gemini, Copilot, Claude and others) or GA4 medium ai-assistant', 'sessions')
      : miss('ga4_ai', 'AI-assistant referral sessions', 'Google Analytics 4', ga4 ? 'Google Analytics did not answer the AI-referral request' : 'Google Analytics is not connected'));
    return { period: 'the last 28 days against the 28 days before', lines: L, note: 'Three measurements of how much people look for the brand, each from its own source. They are shown side by side and never added together.' };
  })();
  // ---- B7-1 (2026-10-15, benchmark area 7 — docs/system-review-2026-10-14/BENCH_AREA7_site_tracking.md): DID THE CHANGE WORK? ----
  // Since G12 this node has inlined the change-test kit (CT) and shipped its METHOD SENTENCE in every weekly callback
  // (`change_method`) while running no test at all: CT.compare was called by the Link Builder and by nobody else. A published
  // method with no measurement behind it is INVARIANTS rule 4 in the one place the rubric scores impact measurement (criterion 3.4,
  // "control group or counterfactual", capped at 3 for links only). This runs it. Each change has its own two windows, bought by
  // GSC Requests: the clicks are read with ST.lift (rate ratio, 95% range, the control group's own noise inside it) and the
  // position with CT.compare (the Link Builder's comparison, "too early" under 6 weeks). Either can refuse without silencing the
  // other, and a change too new to read keeps its row with the date it can first be read — never a quiet absence.
  const change_tests = (() => {
    const method = ST.liftMethod + ' ' + CT.method;
    const planned = (s.changes || []);
    const rows = ((gsc && gsc.change_tests) || []).map(t => {
      const upd = t.window_before && t.window_after ? ST.updatesIn({ start: t.window_before.start, end: t.window_after.end }) : [];
      const brk = t.window_before && t.window_after ? AN.breakBetween(t.window_before.start, t.window_after.end) : [];
      const common = { url: t.url, date: t.date, what: t.what, keyword: t.keyword, joint: !!t.joint,
        window: t.window_before && t.window_after ? (t.window_before.start + ' to ' + t.window_before.end + ' vs ' + t.window_after.start + ' to ' + t.window_after.end) : '',
        google_updates: upd.map(u => u.name + ' (' + u.start + ' to ' + u.end + ')'), data_breaks: brk.map(b => b.name) };
      if (!t.read || !t.page || !t.control) return { ...common, read: false, state: 'unavailable', verdict: 'Not measured', basis: t.reason || 'this change was not measured this week' };
      const lift = ST.lift({ clicks: t.page.clicks, prev_clicks: t.page.prev_clicks, control_clicks: t.control.clicks,
        control_prev_clicks: t.control.prev_clicks, control_pages: t.control.pages,
        period: 'the 28 days after the change against the 28 days before it' });
      const weeks = Math.floor(Math.max(0, Math.round((Date.parse(R.current.end + 'T00:00:00Z') - Date.parse(t.date + 'T00:00:00Z')) / 864e5)) / 7);
      const pos = CT.compare({ kind: 'page', weeks, joint: t.joint ? 1 : 0,
        base: t.page.prev_impressions ? t.page.prev_position : null, now: t.page.impressions ? t.page.position : null, others: t.control.moves || [] });
      return { ...common, read: true, state: lift.state, verdict: lift.verdict, clicks: t.page.clicks, prev_clicks: t.page.prev_clicks,
        expected: lift.expected, lift_pct: lift.lift_pct, ci: lift.ci, z: lift.z, control_pages: t.control.pages,
        position: pos.position, prev_position: pos.base_position, position_verdict: pos.verdict_label, position_effect: pos.effect, position_note: pos.note,
        basis: lift.basis + (upd.length ? ' A Google ' + upd.map(u => u.name).join(' and ') + ' ran inside these windows; it moved the control group too, which is what the control group is for.' : '')
          + (t.joint ? ' Another change to this page within 8 weeks, so the credit is shared.' : '') };
    });
    const pending = planned.filter(c => !c.readable).map(c => ({ url: c.url, date: c.date, what: c.what, keyword: c.keyword, read: false,
      state: 'too_early', verdict: 'Too early to tell', basis: 'Not measured yet: ' + c.not_yet + '.' }));
    const tested = rows.filter(r => r.read);
    return { method, tests: rows.concat(pending).slice(0, 12), measured: tested.length, planned: planned.length,
      helped: tested.filter(r => r.state === 'helped').length, hurt: tested.filter(r => r.state === 'hurt').length,
      no_difference: tested.filter(r => r.state === 'no_difference').length,
      refused: rows.filter(r => !r.read).length + pending.length,
      read: !!(gsc && s.gsc_connected),
      reason: !s.gsc_connected ? 'Search Console is not connected for this site, so no change can be measured.'
        : !planned.length ? 'No page of this site has a published date on record yet, so there is no dated change to measure. Report a page with "I published a page" and the next run reads it.'
        : !rows.length ? 'Every dated change is still too new to read: a change needs 28 complete days of final Search Console data after it.' : '' };
  })();
  // ---- G29 (2026-10-13): where every figure in this report came from, over what period, from how big a sample ----
  const lineage = [];
  const curRange = LN.range(R.current), prevRange = LN.range(R.previous);
  if (gsc) {
    lineage.push(LN.of('Clicks, impressions, CTR and average position', 'gsc', { period: curRange, basis: 'measured',
      sample: LN.sample(gsc.totals.cur.impressions, 'impressions across ' + (gsc.query_count || 0) + ' named queries'), note: 'compared with ' + prevRange }));
    if (gsc.totals.yoy) lineage.push(LN.of('Year-on-year clicks', 'gsc', { period: LN.range(R.yoy), sample: LN.sample(gsc.totals.yoy.impressions, 'impressions'), basis: 'measured' }));
    lineage.push(LN.of('Queries, quick wins, click-through gaps and page lists', 'gsc', { period: curRange, basis: 'measured',
      sample: LN.sample(gsc.rows_read, 'rows read') + ((gsc.truncated || []).length ? ' — Search Console held more rows than this run read (' + gsc.truncated.join(', ') + ')' : ''),
      note: 'the queries Google withholds are reported apart, never spread over the named ones' }));
    lineage.push(LN.of('Expected click-through rate for a position', 'model', { period: 'industry averages, not dated', sample: 'positions 1-10', basis: 'modelled',
      note: 'a published industry curve, not your own measured click-through rate' }));
    // B7-2: the device and country splits say what they are, and say when they are not there at all
    // B7-2: a split Google ANSWERED with nothing is a measured zero; only a request it did not answer has no source at all
    const splitLineage = (blk, figure, unit) => { if (!blk) return;
      lineage.push(blk.failed ? LN.unknown(figure, blk.reason || 'the ' + unit + ' split was not read this week')
        : LN.of(figure, 'gsc', { period: curRange, basis: 'measured',
          sample: LN.sample(blk.total || 0, 'clicks across ' + (blk.rows || []).length + ' ' + ((blk.rows || []).length === 1 ? unit : (unit === 'country' ? 'countries' : unit + 's'))),   // R92 part 3: never "countrys"
          ...(blk.read ? {} : { note: blk.reason }) })); };
    splitLineage(gsc.devices, 'Clicks by device', 'device');
    splitLineage(gsc.countries, 'Clicks by country', 'country');
    // B7-3: observed by Google, not inferred from a ranking check
    if ((gsc.cannibal || []).length) lineage.push(LN.of('Searches two of your pages compete for', 'gsc', { period: curRange, basis: 'measured',
      sample: LN.sample((gsc.cannibal_summary || {}).queries_checked || 0, 'non-brand searches checked'),
      note: 'both pages really were shown for that search; brand searches are left out' }));
    // B7-4 / B7-5 / B7-8 (W3-D)
    const stp = gsc.search_types || {};
    for (const [k, lab] of [['discover', 'Discover clicks'], ['google_news', 'Google News clicks']]) if (stp[k] && stp[k].has_data) lineage.push(LN.of(lab, 'gsc', { period: curRange, basis: 'measured', sample: LN.sample(stp[k].cur.clicks, 'clicks'), note: 'search type ' + (k === 'discover' ? 'discover' : 'googleNews') + ', separate from web search' }));
    const cgp = gsc.content_groups || {};
    if (cgp.configured) lineage.push(LN.of('Clicks by content group', 'gsc', { period: curRange, basis: 'measured', sample: LN.sample((cgp.groups || []).filter(g => g.valid).length, 'content groups'), note: 'a regular expression over page paths; a page can sit in more than one group' }));
    if (gsc.recent && gsc.recent.read) lineage.push(LN.of('Search clicks since the report window', 'gsc', { period: LN.asOf(now), basis: 'reported', sample: LN.sample(gsc.recent.days, 'days'), note: 'preliminary data (dataState all): still being collected and might change; not part of any tested figure' }));
  } else lineage.push(LN.unknown('Search clicks, impressions and positions', 'Search Console is not connected for this site, so this report carries no measured search data'));
  lineage.push(LN.of('Brand series (branded clicks, direct sessions, AI referral sessions)', 'ga4', { period: curRange, basis: 'measured', sample: LN.sample(brand_series.lines.filter(l => l.read).length, 'of 3 lines read'), note: 'three sources side by side, never added together' }));
  if (ga4) lineage.push(LN.of('Organic sessions, engaged sessions and key events', 'ga4', { period: curRange, basis: 'measured',
    sample: LN.sample(ga4.organic.cur.sessions, 'organic sessions of ' + (ga4.total && ga4.total.cur ? ga4.total.cur.sessions : 0) + ' from all channels'), note: 'property ' + ga4.ga4_property_id }));
  else lineage.push(LN.unknown('Visits, engagement and key events', 'Google Analytics is not connected for this site'));
  if (tracked.some(t => t.serp_position != null)) lineage.push(LN.of('Live Google check per tracked keyword', 'serp', { basis: 'one_sample',
    period: LN.asOf((tracked.find(t => t.serp_checked_at) || {}).serp_checked_at), sample: LN.sample(tracked.filter(t => t.serp_position != null).length, 'keywords, one results page each'),
    note: 'one country and one device, so it will differ from the Search Console average' }));
  if (pages.some(p => p.inspected)) lineage.push(LN.of('Index status of your pages', 'inspection', { basis: 'measured',
    period: LN.asOf(now), sample: LN.sample(pages.filter(p => p.inspected).length, 'pages inspected') }));
  if (trends.length) lineage.push(LN.of('Search interest', 'trends', { period: 'the last 12 months', basis: 'reported',
    sample: LN.sample(trends.length, 'keywords'), note: 'a relative index (100 = the peak of the period), not a count of searches' }));
  if (notices.length) lineage.push(LN.of('Search Console notices', 'gsc', { period: 'the last 35 days', sample: LN.sample(notices.length, 'notification e-mails'), basis: 'reported' }));
  if (ck) lineage.push(LN.of('Manual actions, security issues and site-wide index coverage', 'you', { period: 'check-in of ' + String(ck.month || ''), sample: 'one check-in', basis: 'reported',
    note: 'Google offers no API for these, so they come from your monthly check-in' }));
  // B7-1: the counts are measured, the expectation is modelled from the control group, and a change nobody could read says so
  if (change_tests.measured) lineage.push(LN.of('Whether a change helped, against the rest of the site', 'gsc', { basis: 'modelled',
    period: 'each change\'s own 28 days after against the 28 days before', sample: LN.sample(change_tests.measured, 'dated changes measured'),
    note: 'the clicks of both windows are measured; what the page "would have done" is modelled from the site\'s other pages' }));
  else if (change_tests.reason) lineage.push(LN.unknown('Whether a change helped, against the rest of the site', change_tests.reason));
  const metrics_row = { site_id: s.site_id, domain: s.domain, period_start: R.current.start, period_end: R.current.end, checked_at: now, gsc_connected: !!gsc, ga4_connected: !!ga4,
    clicks: T ? T.cur.clicks : 0, impressions: T ? T.cur.impressions : 0, ctr: T ? T.cur.ctr : 0, position: T ? T.cur.position : 0, prev_clicks: T ? T.prev.clicks : 0, prev_impressions: T ? T.prev.impressions : 0, prev_ctr: T ? T.prev.ctr : 0, prev_position: T ? T.prev.position : 0,
    yoy_clicks: T && T.yoy ? T.yoy.clicks : 0, yoy_impressions: T && T.yoy ? T.yoy.impressions : 0, sessions: G ? G.organic.cur.sessions : 0, engaged_sessions: G ? G.organic.cur.engaged : 0, key_events: G ? G.organic.cur.key_events : 0,
    prev_sessions: G ? G.organic.prev.sessions : 0, prev_engaged_sessions: G ? G.organic.prev.engaged : 0, prev_key_events: G ? G.organic.prev.key_events : 0, organic_share: G ? G.organic_share : 0, queries: gsc ? gsc.query_count : 0, striking: gsc ? gsc.striking.length : 0,
    alerts: alerts.filter(a => a.level === 'high' || a.level === 'medium').map(a => a.text).join(' | ').slice(0, 500) };
  const qrow = (q, trackedFlag, serpPos) => ({ site_id: s.site_id, domain: s.domain, period_end: R.current.end, checked_at: now, query: q.query, clicks: q.clicks || 0, impressions: q.impressions || 0, ctr: r1((q.ctr || 0) * 1000) / 1000, position: r1(q.position), prev_clicks: q.prev_clicks || 0, prev_impressions: q.prev_impressions || 0, prev_position: r1(q.prev_position), page: q.page || '', tracked: trackedFlag, serp_position: (serpPos == null) ? -1 : Number(serpPos) });
  const trackedSet = new Set(tracked.map(t => t.keyword));
  const query_rows = [...tracked.map(t => qrow({ query: t.keyword, clicks: t.clicks, impressions: t.impressions, ctr: t.impressions ? t.clicks / t.impressions : 0, position: t.gsc_position || 0, prev_clicks: t.prev_clicks, prev_position: t.gsc_prev_position || 0, page: t.page }, true, t.serp_position)),
    ...((gsc && gsc.queries) || []).filter(q => !trackedSet.has(q.query)).slice(0, 100).map(q => qrow(q, false, null))];
  const site_row = { ...SM.toRow(model), content_groups_json: s.content_groups_json || '', site_id: s.site_id, domain: s.domain, gsc_property: s.gsc_property || s.gsc_property_hint || '', ga4_property_id: ga4 ? String(ga4.ga4_property_id) : (s.ga4_property_id || ''), country: s.country || '', location_code: Number(s.location_code) || 0, language_code: s.language_code || 'en', email: s.email || '', callback_url: s.callback_url || '',
    keywords: (s.keywords || []).join(', '), status: s.status || 'active', source: s.source || 'form', created_at: s.created_at || now, last_run_at: now, last_status: (gsc ? 'gsc:ok' : 'gsc:off') + ' ' + (ga4 ? 'ga4:ok' : 'ga4:off') + (alerts.some(a => a.level === 'high') ? ' alerts' : ''), request_id: s.request_id || '' };
  // ---- G25: what Google thinks of the key pages, with what was not checked said out loud ----
  const mine = insp.filter(x => x.site_id === s.site_id || x.site_idx === idx);
  const askedIns = mine.filter(x => !x.skipped);
  const budget = (mine.find(x => x.budget) || {}).budget || null;
  const index_coverage = s.gsc_connected
    ? { ...PW.coverage(askedIns.map(x => ({ ok: !x.inspect_error, error: x.inspect_error || '', indexed: x.indexed, verdict: x.verdict, coverage: x.coverage, canonical_ok: x.canonical_ok, mobile_usable: x.mobile_usable, rich_results: x.rich_results, not_checked: x.not_checked || '' })),
        { not_checked: mine.filter(x => x.skipped).length, not_checked_reason: mine.filter(x => x.skipped).length ? 'the run\'s share of Google\'s daily quota was used up; they are inspected in the next run, oldest first' : '', quota_note: budget ? budget.note : '' }),
        connected: true, candidates: budget ? budget.candidates : askedIns.length, cap: budget ? budget.cap : null,
        pages: askedIns.filter(x => !x.inspect_error).slice(0, 50).map(x => ({ url: x.url, indexed: x.indexed, verdict: x.verdict, coverage: x.coverage, last_crawl: x.last_crawl, canonical_ok: x.canonical_ok, google_canonical: x.google_canonical, mobile_usable: x.mobile_usable, rich_results: x.rich_results, kind: x.kind })),
        not_checked_pages: mine.filter(x => x.skipped || x.inspect_error).slice(0, 25).map(x => ({ url: x.url, reason: x.not_checked || x.inspect_error || 'not checked' })) }
    : { connected: false, checked: 0, indexed: 0, not_indexed: 0, not_checked: 0, pages: [], not_checked_pages: [], text: 'Search Console is not connected, so Google\'s index view could not be read (not checked).' };
  // ---- G11: the daily key-page watch, as the weekly report sees it ----
  const wmine = watchRows.filter(r => r.site_id === s.site_id);
  const wcache = (() => { try { return JSON.parse(String((watchCacheRows.find(c => String(c.key) === 'watch:' + s.site_id) || {}).value || '') || 'null') || null; } catch (e) { return null; } })();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const watch = wmine.length || wcache
    ? { running: !!wcache, last_checked_at: wcache ? String(wcache.checked_at || '') : wmine.map(r => String(r.checked_at || '')).sort().slice(-1)[0] || '',
        pages_watched: wcache ? Number(wcache.pages_watched) || wmine.length : wmine.length, pages_not_checked: wcache ? Number(wcache.pages_not_checked) || 0 : 0,
        robots_hash: wcache ? String(wcache.robots_hash || '') : '', changed_this_week: wmine.filter(r => String(r.last_change_at || '') >= weekAgo).length,
        changes: wmine.filter(r => String(r.last_change_at || '') >= weekAgo).slice(0, 10).map(r => ({ url: r.url, changes: String(r.changes || ''), at: String(r.last_change_at || '') })),
        noindex: wmine.filter(r => r.noindex === true).map(r => r.url).slice(0, 10), broken: wmine.filter(r => Number(r.status) >= 400).map(r => r.url).slice(0, 10),
        cost_usd: 0 }
    : { running: false, pages_watched: 0, last_checked_at: '', changed_this_week: 0, changes: [], noindex: [], broken: [], pages_not_checked: 0, cost_usd: 0 };
  return { json: { site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '', period: R, checked_at: now, first_run: !!s.first_run, on_demand: !!s.on_demand, source: s.source, country: s.country || '',
    site: { canonical_host: model.canonical_host, home_url: SM.siteUrl(model, '/'), business_name: SM.name(model), name_source: model.name_source || '', services: SM.services(model).slice(0, 12), nav_pages: (model.nav_pages || []).slice(0, 8), nap: SM.nap(model), pages_known: SM.pages(model).length, model_updated_at: model.model_updated_at || '' },
    page_inventory: inv ? { pages: inv.total, with_queries: inv.with_queries, changed: inv.changed, by_source: inv.by_source, sitemap_read: inv.sitemap_read } : null,
    gsc: { connected: !!gsc, property: s.gsc_property || '', permission: s.gsc_permission || '', error: s.gsc_error || null, ...(gsc ? { totals: gsc.totals, deltas: gsc.deltas, daily: gsc.daily, query_count: gsc.query_count, page_count: gsc.page_count ?? null, anonymised: gsc.anonymised || null, brand_split: gsc.brand_split || null, scraper_queries: gsc.scraper_queries || null, rows_read: gsc.rows_read ?? null, paging: gsc.paging || [], truncated: gsc.truncated || [], winners: gsc.winners, losers: gsc.losers, new_queries: gsc.new_queries, lost_queries: gsc.lost_queries, striking: gsc.striking, ctr_gaps: gsc.ctr_gaps, top_pages: gsc.pages.slice(0, 10), decaying_pages: gsc.decaying_pages, not_decay: gsc.not_decay || [], decay_summary: gsc.decay_summary || null, rising_pages: gsc.rising_pages, errors: gsc.errors, cannibal: gsc.cannibal || [], cannibal_summary: gsc.cannibal_summary || null, devices: gsc.devices || null, countries: gsc.countries || null, search_types: gsc.search_types || null, recent: gsc.recent || null, content_groups: gsc.content_groups || null } : {}) },
    ga4: ga4 ? { connected: true, property_id: ga4.ga4_property_id, detected: ga4.ga4_detected, property_name: ga4.ga4_property_name, organic: ga4.organic, total: ga4.total, organic_share: ga4.organic_share, channels: ga4.channels, landing: ga4.landing, daily: ga4.daily, errors: ga4.errors } : { connected: false, error: acctErr || ga4Reason || 'no property id given or detected' },
    console: { notices, last_checkin: ck, checkin_due: !!s.checkin_due },
    significance: stat,   // G28: the Poisson z-test behind every traffic alert (clicks / impressions / sessions)
    index_coverage,       // G25: Google's own view of every key page (URL Inspection within the 2,000-a-day quota, oldest first)
    page_watch: watch,    // G11: the daily key-page watch — what it checks, what changed this week, what it could not read
    annotations, annotation_note: AN.OWN_NOTES_LINE, brand_series, data_breaks, lineage,   // G12 / G29: the events of the period for every chart, and where each figure came from
    // B7-1 (2026-10-15, benchmark area 7): the method sentence used to travel alone — the Site Tracker shipped it and ran no test.
    change_method: change_tests.method, change_tests,
    cannibal: (gsc && gsc.cannibal) || [], cannibal_summary: (gsc && gsc.cannibal_summary) || null,   // B7-3
    devices: (gsc && gsc.devices) || { read: false, rows: [], reason: 'Search Console is not connected for this site' },   // B7-2
    countries: (gsc && gsc.countries) || { read: false, rows: [], reason: 'Search Console is not connected for this site' },
    // B-G3 (2026-10-15): the rungs the read-path fit gate set aside, with the reason, so the report can say why the list is shorter
    set_aside: s.set_aside || [], set_aside_note: s.set_aside_note || '',
    tracked, ladder_pages: pages, pending_publish: (s.pending_publish || []).filter(p => !found.some(f => kwKey(f.keyword) === kwKey(p.keyword))),
    needs_fix: (s.needs_fix || []).filter(p => !found.some(f => kwKey(f.keyword) === kwKey(p.keyword))),   // R111 drafts that failed their last quality round; R59 host_split below: pages Google keeps under the other host
    host_split: hostSplit, ladder_heads: s.ladder_heads || [], trends, alerts, actions: acts, prev_runs: prevRuns, weeks_tracked: prevRuns.length + 1, service_account_email: cfg.service_account_email || '', form_url: FORM_URL, api_url: API_URL,
    detected_published: found.map(f => ({ keyword: f.keyword, url: f.url, ladder_id: f.ladder_id || '', matched_by: f.matched_by, source: f.source })),
    publish_detection: det ? { checked: true, candidates: det.candidates, sitemap_ok: !!(det.sitemap || {}).ok, sitemap_urls: (det.sitemap || {}).urls || 0, sitemap_error: (det.sitemap || {}).error || '', pages_fetched: det.pages_fetched || 0, found: found.length,
      still_waiting: (det.unmatched || []).length, recorded: found.length ? !detErrors.length : null, error: found.length && detErrors.length ? detErrors.slice(0, 3).join('; ').slice(0, 300) : '' } : { checked: false, candidates: 0, found: 0, reason: detFail ? 'detection failed: ' + detFail.slice(0, 200) : 'no written page waiting for publication' },
    metrics_row, query_rows, site_row } };
});
