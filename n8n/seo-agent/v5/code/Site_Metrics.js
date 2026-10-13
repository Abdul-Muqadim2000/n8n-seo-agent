// Joins everything per site: Search Console, GA4, index status, trends and the live SERP checks -> KPIs, alerts, ranked actions (with
// ready-to-send API bodies), and the exact rows for the Data Tables seo_site_metrics / seo_query_history / seo_sites.
// v4.8: pages the publish detection found live this week (`detected_published`, `publish_detection`) count as published pages here.
// G19 (2026-10-12, SITE_MODEL_SPEC.md): the site model resolved earlier in this run - the canonical host every URL uses, the business
// name / NAP / logo, the services and the nav pages. SM.toRow(model) goes back into the seo_sites row, so the next run and every other
// workflow read the same facts; the brief is given the host and the name (never the bare domain).
/*__SITE_MODEL__*/
/*__SITE_STATS__*/
/*__PAGE_WATCH__*/
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
    return { ...t, gsc_position: g ? g.position : null, gsc_prev_position: g ? g.prev_position : null, clicks: g ? g.clicks : 0, impressions: g ? g.impressions : 0, prev_clicks: g ? g.prev_clicks : 0, page: g ? g.page : '',
      serp_position: sp ? sp.position : null, serp_url: sp ? sp.url : '', serp_checked_at: sp ? sp.checked_at : '', history: hist }; });
  // pages found live this week replace their planned entry (live URL, published) or are added; they were inspected in this run
  const det = detAll.find(x => x.site_id === s.site_id) || null; const found = det ? det.detected : [];
  const basePages = (s.ladder_pages || []).map(p => { const f = found.find(f => kwKey(f.keyword) === kwKey(p.keyword) && (!f.ladder_id || !p.ladder_id || f.ladder_id === p.ladder_id)); return f ? { ...p, url: f.url, status: 'published', page_exists: true, detected: true } : promised(p); });
  for (const f of found) if (!basePages.some(p => ukey(p.url) === ukey(f.url))) basePages.push({ url: f.url, keyword: f.keyword, rung: 0, status: 'published', ladder_id: f.ladder_id || '', page_exists: true, detected: true });
  // G25 (2026-10-13): an inspection the quota did not reach, or one that failed, is "not checked" — never "not indexed" (`skipped` / `not_checked`)
  const pages = basePages.map(p => { const i = insp.find(x => x.url === p.url && !x.skipped && !x.inspect_error) || insp.find(x => x.url === p.url); const asked = !!i && !i.skipped && !i.inspect_error;
    return { ...p, inspected: asked, indexed: asked ? !!i.indexed : null, verdict: asked ? i.verdict : '', coverage: asked ? i.coverage : '', last_crawl: asked ? i.last_crawl : '', canonical_ok: asked ? i.canonical_ok : null,
      google_canonical: asked ? i.google_canonical : '', mobile_usable: asked ? i.mobile_usable : null, rich_results: asked ? i.rich_results : [],
      inspect_error: asked ? null : (i ? (i.not_checked || i.inspect_error) : (s.gsc_connected ? 'not inspected' : 'Search Console not connected')) }; });
  // pages not live yet are reported as such, never as 'not indexed'
  for (const p of pages) if (!(p.page_exists || p.status === 'published')) { p.inspect_error = p.status === 'writing' ? 'written, not published yet' : 'planned, not written yet'; p.indexed = null; }
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
    if (ch.real) alerts.push({ level: Math.abs(ch.pct) >= drop ? 'high' : level, text: label + ' fell ' + Math.abs(ch.pct) + '% (' + prev + ' → ' + cur + ' in 28 days' + (ch.ci ? '; 95% range ' + ch.ci[0] + '% to ' + ch.ci[1] + '%' : '') + ', z ' + ch.z + ')' + upd, stat: key });   // no range when one period is zero (the log-ratio is undefined)
    else if (ch.watch) alerts.push({ level: 'medium', text: 'Watch: ' + label.toLowerCase() + ' are ' + Math.abs(ch.pct) + '% lower (' + prev + ' → ' + cur + ' in 28 days). Small numbers: ' + (prev + cur) + ' ' + label.toLowerCase() + ' over both periods together, so a swing this size happens by chance (z ' + ch.z + ') — worth a look, not a confirmed fall' + upd, stat: key, small_numbers: true });
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
  for (const t of tracked) if (t.gsc_position && t.gsc_prev_position && t.gsc_prev_position <= 10 && t.gsc_position - t.gsc_prev_position >= 5) alerts.push({ level: 'medium', text: '"' + t.keyword + '" slipped from #' + r1(t.gsc_prev_position) + ' to #' + r1(t.gsc_position) + ' (Search Console average)' });
  for (const t of tracked) if (t.serp_position > 0 && t.gsc_position && Math.abs(t.serp_position - t.gsc_position) >= 10) alerts.push({ level: 'info', text: '"' + t.keyword + '": live check #' + t.serp_position + ' vs Search Console average #' + r1(t.gsc_position) + ' — positions vary by location and device' });
  if (!ga4) alerts.push({ level: 'setup', text: 'Google Analytics 4 is not connected: ' + (acctErr || ga4Reason || 'no property id given or detected') });
  const notices = s.console_alerts || []; const ck = s.last_checkin || null;
  for (const n of notices) alerts.push({ level: n.severity === 'critical' ? 'high' : n.severity === 'high' ? 'high' : 'medium', text: 'Search Console notice (' + String(n.received_at).slice(0, 10) + '): ' + n.subject });
  if (ck && ck.manual_action && !notices.some(n => n.kind === 'manual_action')) alerts.push({ level: 'high', text: 'Manual action reported in the ' + ck.month + ' check-in' });
  if (ck && ck.security_issue && !notices.some(n => n.kind === 'security')) alerts.push({ level: 'high', text: 'Security issue reported in the ' + ck.month + ' check-in' });
  if (found.length && detErrors.length) alerts.push({ level: 'medium', text: 'Pages found live on the site could not be recorded (' + detErrors[0] + '); report them with "I published a page"' });
  if (detFail) alerts.push({ level: 'info', text: 'Publish detection failed this week (' + detFail.slice(0, 160) + '); report published pages with "I published a page"' });
  if (det && det.candidates && !(det.sitemap || {}).ok) alerts.push({ level: 'info', text: 'Publish detection could not read the sitemap (' + ((det.sitemap || {}).error || 'no sitemap') + '); report published pages with "I published a page"' });
  // ---- actions (deterministic; the AI brief words them for the owner) ----
  const actions = []; const apiBase = { country: s.country || '', domain: s.domain, email: s.email || '' };
  const pageBody = (keyword, url, page_type) => ({ mode: 'keyword', keyword, page_type: page_type || 'Service Page', ...apiBase, existing_page_url: url || '', receive: ['Keyword Report', 'Page Content'] });
  const sa = cfg.service_account_email || '(the service-account e-mail: ask your administrator)';
  for (const n of notices.filter(n => n.kind === 'manual_action' || n.kind === 'security').slice(0, 2)) actions.push({ priority: 1, type: n.kind, action: (n.kind === 'manual_action' ? 'Resolve the manual action: open Search Console → Security & Manual Actions → Manual actions, fix every page it names, then request a review.' : 'Resolve the security issue: clean the site, update CMS and plugins, change passwords, then request a review under Search Console → Security issues.'), why: n.subject + ' (' + String(n.received_at).slice(0, 10) + ').', keyword: '', url: '' });
  for (const n of notices.filter(n => n.kind === 'coverage' || n.kind === 'cwv' || n.kind === 'rich_results' || n.kind === 'sitemap' || n.kind === 'crawl').slice(0, 2)) actions.push({ priority: 2, type: 'console_' + n.kind, action: 'Open the Search Console report named in "' + n.subject + '" and fix the listed pages, then click Validate fix.', why: 'Google sent this notice on ' + String(n.received_at).slice(0, 10) + '.', keyword: '', url: '' });
  if (ck && ck.csv_kind === 'reasons' && (ck.coverage.reasons || []).length) actions.push({ priority: 2, type: 'coverage_report', action: 'Work through the Pages report from your ' + ck.month + ' check-in: ' + ck.coverage.reasons.slice(0, 3).map(r => r.reason + ' (' + r.pages + ' pages)').join(', ') + '.', why: ck.not_indexed_total + ' pages are not indexed site-wide according to Search Console.', keyword: '', url: '' });
  if (s.checkin_due) actions.push({ priority: 3, type: 'checkin', action: 'Monthly Search Console check-in: open the form, answer two questions (manual action? security issue?) and upload the Pages report export.', why: 'Google offers no API for manual actions, security issues and the site-wide Pages report; the check-in covers them' + (cfg.console_mail_watcher ? ' alongside the notification watcher' : '') + '.', keyword: '', url: '' });
  if (!s.gsc_connected) actions.push({ priority: 1, type: 'connect_gsc', action: 'Add ' + sa + ' as a user (Full) of ' + s.domain + ' in Search Console → Settings → Users and permissions.', why: 'Without it the report has no real query, click or index data.', keyword: '', url: '' });
  for (const p of pages.filter(p => p.inspected && p.indexed === false && (p.page_exists || p.status === 'published')).slice(0, 3)) actions.push({ priority: 1, type: 'index', action: 'Request indexing for ' + p.url + ' in Search Console (URL inspection → Request indexing) and link to it from 2-3 existing pages.', why: (p.rung ? 'Ladder rung ' + p.rung + ' for "' + p.keyword + '"' : 'The page for "' + p.keyword + '"') + ' cannot rank until Google indexes it (' + (p.coverage || p.verdict || 'not indexed') + ').', keyword: p.keyword, url: p.url });
  // D11: a page written for a keyword a LIVE page already answers must not go up as a second page — it is folded into the page that exists
  for (const p of pages.filter(p => p.status === 'writing' && !p.page_exists).slice(0, 3)) { const c = covered(p.keyword, p.url);
    if (c) actions.push({ priority: 1, type: 'refresh_existing', action: 'Do not publish the new page for "' + p.keyword + '" as a second URL: ' + c.url + ' already answers this search. Use the new text to refresh that page instead.', why: 'Two pages for one search split the signals and neither ranks (the live page was found ' + (c.matched_by === 'query' ? 'in Search Console with ' + c.impressions + ' impressions for this query' : 'in the site\'s page list') + ').', keyword: p.keyword, url: c.url });
    else actions.push({ priority: 1, type: 'publish', action: 'Publish the written page for "' + p.keyword + '" (planned URL ' + p.url + ') and report the link with "I published a page".', why: 'It is written but not live yet; nothing can be indexed or ranked before it is published.', keyword: p.keyword, url: p.url }); }
  for (const q of ((gsc && gsc.striking) || []).slice(0, 3)) actions.push({ priority: 2, type: 'striking', action: 'Push "' + q.query + '" from #' + r1(q.position) + ' into the top 3: expand ' + (q.page || 'the ranking page') + ' with the missing sub-topics, add an FAQ and 2-3 internal links to it.', why: q.impressions + ' impressions in 28 days at position ' + r1(q.position) + ' (' + q.clicks + ' clicks); a top-3 spot typically triples the clicks.', keyword: q.query, url: q.page || '', api_body: pageBody(q.query, q.page, 'Service Page') });
  for (const q of ((gsc && gsc.ctr_gaps) || []).slice(0, 2)) actions.push({ priority: 2, type: 'ctr', action: 'Rewrite the title and meta description of ' + (q.page || 'the ranking page') + ' for "' + q.query + '" (lead with the outcome and a number).', why: 'Position ' + r1(q.position) + ' with ' + q.impressions + ' impressions but CTR ' + (q.ctr * 100).toFixed(1) + '% vs about ' + Math.round(q.expected_ctr * 100) + '% expected.', keyword: q.query, url: q.page || '' });
  for (const p of ((gsc && gsc.decaying_pages) || []).slice(0, 2)) actions.push({ priority: 3, type: 'decay', action: 'Refresh ' + p.page + ': update facts and dates, add what the top results cover now, re-promote it.', why: 'Clicks fell from ' + p.prev_clicks + ' to ' + p.clicks + ' in 28 days.', keyword: '', url: p.page });
  for (const t of trends.filter(t => t.direction === 'rising' && (t.rising || []).length).slice(0, 1)) actions.push({ priority: 3, type: 'trend', action: 'Interest in "' + t.keyword + '" is rising (' + (t.change_pct > 0 ? '+' : '') + t.change_pct + '% vs the 12-month average); cover the rising searches: ' + t.rising.slice(0, 3).map(r => r.query).join(', ') + '.', why: 'Google Trends, past 12 months.', keyword: t.rising[0].query, url: '', api_body: { mode: 'verdict', keyword: t.rising[0].query, ...apiBase } });
  for (const t of trends.filter(t => t.direction === 'falling').slice(0, 1)) actions.push({ priority: 4, type: 'trend', action: 'Interest in "' + t.keyword + '" is falling (' + t.change_pct + '% vs the 12-month average)' + (t.peak_date ? '; it peaked around ' + String(t.peak_date).slice(0, 7) : '') + '. Keep the page current but do not over-invest; watch the related rising searches.', why: 'Google Trends, past 12 months.', keyword: t.keyword, url: '' });
  if (!ga4) actions.push({ priority: 4, type: 'connect_ga4', action: 'Add the same service account as a Viewer of the GA4 property (Admin → Property access management), or register the site with its GA4 property ID.', why: 'Connects search visibility to visits and key events (conversions).', keyword: '', url: '' });
  actions.sort((a, b) => a.priority - b.priority); const acts = actions.slice(0, 12);   // the brief picks the top 5-6; the full list stays in the callback
  // ---- rows for the Data Tables ----
  const T = gsc ? gsc.totals : null; const G = ga4;
  const prevRuns = metricsHist.filter(m => m.site_id === s.site_id).sort((a, b) => String(a.period_end).localeCompare(String(b.period_end))).slice(-12).map(m => ({ period_end: m.period_end, clicks: Number(m.clicks) || 0, impressions: Number(m.impressions) || 0, position: r1(m.position), sessions: Number(m.sessions) || 0 }));
  const metrics_row = { site_id: s.site_id, domain: s.domain, period_start: R.current.start, period_end: R.current.end, checked_at: now, gsc_connected: !!gsc, ga4_connected: !!ga4,
    clicks: T ? T.cur.clicks : 0, impressions: T ? T.cur.impressions : 0, ctr: T ? T.cur.ctr : 0, position: T ? T.cur.position : 0, prev_clicks: T ? T.prev.clicks : 0, prev_impressions: T ? T.prev.impressions : 0, prev_ctr: T ? T.prev.ctr : 0, prev_position: T ? T.prev.position : 0,
    yoy_clicks: T && T.yoy ? T.yoy.clicks : 0, yoy_impressions: T && T.yoy ? T.yoy.impressions : 0, sessions: G ? G.organic.cur.sessions : 0, engaged_sessions: G ? G.organic.cur.engaged : 0, key_events: G ? G.organic.cur.key_events : 0,
    prev_sessions: G ? G.organic.prev.sessions : 0, prev_engaged_sessions: G ? G.organic.prev.engaged : 0, prev_key_events: G ? G.organic.prev.key_events : 0, organic_share: G ? G.organic_share : 0, queries: gsc ? gsc.query_count : 0, striking: gsc ? gsc.striking.length : 0,
    alerts: alerts.filter(a => a.level === 'high' || a.level === 'medium').map(a => a.text).join(' | ').slice(0, 500) };
  const qrow = (q, trackedFlag, serpPos) => ({ site_id: s.site_id, domain: s.domain, period_end: R.current.end, checked_at: now, query: q.query, clicks: q.clicks || 0, impressions: q.impressions || 0, ctr: r1((q.ctr || 0) * 1000) / 1000, position: r1(q.position), prev_clicks: q.prev_clicks || 0, prev_impressions: q.prev_impressions || 0, prev_position: r1(q.prev_position), page: q.page || '', tracked: trackedFlag, serp_position: (serpPos == null) ? -1 : Number(serpPos) });
  const trackedSet = new Set(tracked.map(t => t.keyword));
  const query_rows = [...tracked.map(t => qrow({ query: t.keyword, clicks: t.clicks, impressions: t.impressions, ctr: t.impressions ? t.clicks / t.impressions : 0, position: t.gsc_position || 0, prev_clicks: t.prev_clicks, prev_position: t.gsc_prev_position || 0, page: t.page }, true, t.serp_position)),
    ...((gsc && gsc.queries) || []).filter(q => !trackedSet.has(q.query)).slice(0, 100).map(q => qrow(q, false, null))];
  const site_row = { ...SM.toRow(model), site_id: s.site_id, domain: s.domain, gsc_property: s.gsc_property || s.gsc_property_hint || '', ga4_property_id: ga4 ? String(ga4.ga4_property_id) : (s.ga4_property_id || ''), country: s.country || '', location_code: Number(s.location_code) || 0, language_code: s.language_code || 'en', email: s.email || '', callback_url: s.callback_url || '',
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
    gsc: { connected: !!gsc, property: s.gsc_property || '', permission: s.gsc_permission || '', error: s.gsc_error || null, ...(gsc ? { totals: gsc.totals, deltas: gsc.deltas, daily: gsc.daily, query_count: gsc.query_count, page_count: gsc.page_count ?? null, anonymised: gsc.anonymised || null, brand_split: gsc.brand_split || null, scraper_queries: gsc.scraper_queries || null, rows_read: gsc.rows_read ?? null, paging: gsc.paging || [], truncated: gsc.truncated || [], winners: gsc.winners, losers: gsc.losers, new_queries: gsc.new_queries, lost_queries: gsc.lost_queries, striking: gsc.striking, ctr_gaps: gsc.ctr_gaps, top_pages: gsc.pages.slice(0, 10), decaying_pages: gsc.decaying_pages, rising_pages: gsc.rising_pages, errors: gsc.errors } : {}) },
    ga4: ga4 ? { connected: true, property_id: ga4.ga4_property_id, detected: ga4.ga4_detected, property_name: ga4.ga4_property_name, organic: ga4.organic, total: ga4.total, organic_share: ga4.organic_share, channels: ga4.channels, landing: ga4.landing, daily: ga4.daily, errors: ga4.errors } : { connected: false, error: acctErr || ga4Reason || 'no property id given or detected' },
    console: { notices, last_checkin: ck, checkin_due: !!s.checkin_due },
    significance: stat,   // G28: the Poisson z-test behind every traffic alert (clicks / impressions / sessions)
    index_coverage,       // G25: Google's own view of every key page (URL Inspection within the 2,000-a-day quota, oldest first)
    page_watch: watch,    // G11: the daily key-page watch — what it checks, what changed this week, what it could not read
    tracked, ladder_pages: pages, pending_publish: (s.pending_publish || []).filter(p => !found.some(f => kwKey(f.keyword) === kwKey(p.keyword))), ladder_heads: s.ladder_heads || [], trends, alerts, actions: acts, prev_runs: prevRuns, weeks_tracked: prevRuns.length + 1, service_account_email: cfg.service_account_email || '', form_url: FORM_URL, api_url: API_URL,
    detected_published: found.map(f => ({ keyword: f.keyword, url: f.url, ladder_id: f.ladder_id || '', matched_by: f.matched_by, source: f.source })),
    publish_detection: det ? { checked: true, candidates: det.candidates, sitemap_ok: !!(det.sitemap || {}).ok, sitemap_urls: (det.sitemap || {}).urls || 0, sitemap_error: (det.sitemap || {}).error || '', pages_fetched: det.pages_fetched || 0, found: found.length,
      still_waiting: (det.unmatched || []).length, recorded: found.length ? !detErrors.length : null, error: found.length && detErrors.length ? detErrors.slice(0, 3).join('; ').slice(0, 300) : '' } : { checked: false, candidates: 0, found: 0, reason: detFail ? 'detection failed: ' + detFail.slice(0, 200) : 'no written page waiting for publication' },
    metrics_row, query_rows, site_row } };
});
