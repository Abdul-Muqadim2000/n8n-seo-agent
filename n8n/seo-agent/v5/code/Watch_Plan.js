// G11 (2026-10-13, system review FIX_PLAN.md): what the daily key-page watch fetches today. Per tracked site: the key pages of the one site
// model (home page, the pages in the menu, the pages Search Console brings impressions for, the pages the keyword ladders and the AI growth
// loop own — all of them already in `seo_pages`, never a fresh crawl) plus `/robots.txt`. One plain GET each, no paid API, nothing rendered.
// A site with nothing to watch makes no request. The re-check queue ("I fixed this" in the app: seo_audit_findings.recheck_state = requested)
// is carried on every item of its site, so the same fetches answer it (G11's second half).
// Build section 194 (client report 2026-11-17, devaicon.com F5 / F10): a key page whose stored row says it MOVED (seo_page_watch.moved_to, a
// permanent redirect to a working page seen on two reads) is watched at its new address, and the old address is listed in `moved` so its open
// alerts close with the move; the stored robots.txt reading (state, parsed rules, last good copy) rides on the site for the state machine; the
// moves Steps on your website asked for (seo_index_pages improved_to / merge_into) mark a redirect "as asked"; the pages we published in the
// last 14 days make a title change Info ("your new title is live"); and the site's open Page Watch alerts come along so the alert lifecycle
// updates or resolves them instead of writing a new row a day.
/*__SITE_MODEL__*/
/*__PAGE_WATCH__*/
/*__MOVES__*/
const CONFIG = { max_sites_per_run: 40, max_watch_pages: 25, max_rechecks_per_site: 10, queries_min_impressions: 1 };
let trigger = {}; try { const t = $('Watch Run').first(); trigger = (t && t.json) || {}; } catch (e) {}
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const S = (v) => String(v == null ? '' : v).trim();
const normD = (x) => S(x).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const ukey = PW.helpers.ukey;
const sites = rowsOf('Load Sites (Watch)').filter(r => r.site_id && r.domain);
const ladders = rowsOf('Load Ladders (Watch)').filter(r => r.ladder_id && r.domain);
const pageRows = rowsOf('Load Pages (Watch)').filter(r => r.site_id && r.url);
const watchRows = rowsOf('Load Page Watch').filter(r => r.site_id && r.url);
const cacheRows = rowsOf('Load Watch Cache').filter(r => S(r.key).indexOf('watch:') === 0);
const findingRows = rowsOf('Load Recheck Requests').filter(r => r.site_id && r.finding_key);
const indexRows = rowsOf('Load Index Pages (Watch)').filter(r => r.site_id && r.url);
const logRows = rowsOf('Load Content Log (Watch)').filter(r => r.keyword);
const alertRows = rowsOf('Load Console Alerts (Watch)').filter(r => r.message_id && S(r.source || 'page_watch') === 'page_watch' && S(r.status) !== 'resolved' && !S(r.resolved_at));
const OWN_TITLE_DAYS = 14;
// CR17-FX-INDEX (review R1 L2 / L3): the pages read beside the key pages, outside the cap of 25. TARGETS: the address a stored permanent redirect
// points at (not confirmed yet), read without following, so the move is confirmed only where the redirects end (a chain /a -> /b -> /c never
// moves our rows onto /b). MOVE_CHECKS: an address that moved, read again once a week, so a redirect the client removed is noticed and the
// address is watched again (our rows stay where they are: the watch says so, a person decides).
const EXTRA = { targets_per_site: 5, move_checks_per_site: 3, move_check_days: 7 };

// ---- the sites: registered ones plus every domain that has a keyword ladder (as the weekly Site Tracker counts them) ----
const byDomain = new Map();
for (const s of sites) { const d = normD(s.domain); if (d && !byDomain.has(d)) byDomain.set(d, { ...s, domain: d }); }
for (const l of ladders) { const d = normD(l.domain); if (d && !byDomain.has(d)) byDomain.set(d, { site_id: SM.helpers.siteIdFor(d), domain: d, email: S(l.email), callback_url: S(l.callback_url), status: 'active', source: 'ladder' }); }
const want = normD(trigger.domain) || S(trigger.site_id);
const on_demand = !!want || !!S(trigger.finding_key);
let list = [...byDomain.values()];
if (want) list = list.filter(s => s.domain === want || s.site_id === want);
else list = list.filter(s => S(s.status || 'active') !== 'paused');
list = list.slice(0, CONFIG.max_sites_per_run);
if (!list.length) return [{ json: { skip: true, reason: want ? 'no tracked site matches "' + want + '"' : 'no tracked site to watch yet', sites: byDomain.size } }];

const out = [];
list.forEach((s, site_idx) => {
  const row = sites.find(r => r.site_id === s.site_id) || {};
  const model = SM.withPages(SM.stored(row) || SM.from({ site_id: s.site_id, domain: s.domain }, {}), pageRows.filter(p => p.site_id === s.site_id));
  const home = SM.siteUrl(model, '/');
  // what makes a page a key page, strongest first: the home page, the menu, the searches it already earns impressions for, a ladder or
  // AI page we promised, then the newest pages of the inventory.
  const cand = [{ url: home, kind: 'home', weight: 100 }];
  for (const p of (model.nav_pages || [])) cand.push({ url: S(p.url), kind: 'nav', weight: 70 });
  for (const l of ladders.filter(l => normD(l.domain) === s.domain && S(l.target_url) && (l.page_exists === true || S(l.status) === 'published'))) cand.push({ url: S(l.target_url), kind: 'ladder', weight: 80 });
  for (const p of SM.pages(model)) {
    const imp = (p.queries || []).reduce((m, q) => m + (Number((q || {}).impressions) || 0), 0);
    const kind = /^ai/.test(S(p.source)) ? 'ai' : imp >= CONFIG.queries_min_impressions ? 'search' : 'page';
    cand.push({ url: S(p.url), kind, weight: kind === 'search' ? Math.min(60, 20 + Math.round(Math.log10(1 + imp) * 10)) : kind === 'ai' ? 50 : 10, lastmod: S(p.lastmod) });
  }
  const seen = new Set(); const pages = [];
  // section 194: the confirmed moves of this site (old address -> new); a candidate that moved is watched at its new address
  const movedRows = watchRows.filter(r => r.site_id === s.site_id && S(r.moved_to));
  const moves = MV.fromWatch(movedRows);
  const moved = [];
  for (const c of cand.sort((a, b) => b.weight - a.weight || S(b.lastmod).localeCompare(S(a.lastmod)))) {
    // R92 part 5 (2026-10-16, re-rating defect C-16): menu links point at sections ("/industries#bfsi", "/capabilities#ai"); a fragment is
    // never sent to a server, so it is no page of its own — those two took 2 of the 25 slots and were inspected as "URL is unknown to
    // Google". The fragment is dropped and the page counted once with the page it belongs to.
    let u = S(c.url).replace(/#.*$/, ''); if (!/^https?:\/\//i.test(u)) continue;
    const fin = MV.finalOf(u, moves);
    if (fin) { if (!moved.some(m => ukey(m.from) === ukey(u))) moved.push({ from: u, to: fin }); u = fin; }
    if (SM.helpers.bare(PW.helpers.hostOf(u)) !== SM.helpers.bare(s.domain)) continue;   // only the site's own pages are watched
    const k = ukey(u); if (seen.has(k)) continue; seen.add(k);
    pages.push({ url: u, kind: c.kind, weight: c.weight });
    if (pages.length >= CONFIG.max_watch_pages) break;
  }
  // CR17-FX-INDEX (L2): the target of a permanent redirect we saw yesterday, read today without following (is it the end of the redirects?)
  // (the list grows as it is walked, so the next link of a chain is read too; a target already confirmed as moved is read at its end)
  let nT = 0;
  for (let i = 0; i < pages.length && nT < EXTRA.targets_per_site; i++) {
    const p = pages[i];
    const r = watchRows.find(w => w.site_id === s.site_id && ukey(w.url) === ukey(p.url));
    if (!r || S(r.moved_to) || !MV.PERMANENT.includes(Number(r.status) || 0)) continue;
    const to0 = MV.abs(r.location, p.url); const to = (to0 && MV.finalOf(to0, moves)) || to0;
    if (!to || !MV.helpers.sameSite(to, p.url) || MV.helpers.isHome(to) || MV.localeRedirect(p.url, to) || seen.has(ukey(to))) continue;
    seen.add(ukey(to)); pages.push({ url: to, kind: 'page', weight: 5 }); nT += 1;
  }
  // CR17-FX-INDEX (L3): a moved address read again once a week (oldest first)
  const dueMs = Date.now() - EXTRA.move_check_days * 864e5;
  for (const r of movedRows.filter(r => !(Date.parse(S(r.checked_at)) > dueMs)).sort((a, b) => S(a.checked_at).localeCompare(S(b.checked_at))).slice(0, EXTRA.move_checks_per_site)) {
    const u = S(r.url); if (!/^https?:\/\//i.test(u) || seen.has(ukey(u))) continue;
    seen.add(ukey(u)); pages.push({ url: u, kind: S(r.kind) || 'page', weight: Number(r.weight) || 0, move_check: true });
  }
  const cache = (() => { try { return JSON.parse(S((cacheRows.find(c => S(c.key) === 'watch:' + s.site_id) || {}).value) || 'null') || {}; } catch (e) { return {}; } })();
  const rechecks = findingRows.filter(f => f.site_id === s.site_id && (!S(trigger.finding_key) || S(f.finding_key) === S(trigger.finding_key)))
    .slice(0, CONFIG.max_rechecks_per_site)
    .map(f => ({ audit_id: S(f.audit_id), finding_key: S(f.finding_key), title: S(f.title), category: S(f.category), severity: S(f.severity), requested_at: S(f.recheck_requested_at) }));
  // section 194: what robots.txt was at the last check, as the state machine reads it (an older fingerprint has no `robots_v` and is a baseline)
  const robots_prev = { v: Number(cache.robots_v) || 0, hash: S(cache.robots_hash), state: S(cache.robots_state), status: Number(cache.robots_status) || 0,
    text: S(cache.robots_text), facts: Array.isArray(cache.robots_facts) ? cache.robots_facts : null, last_good_hash: S(cache.robots_last_good_hash),
    last_good_at: S(cache.robots_last_good_at), last_good_text: S(cache.robots_last_good_text), bad_runs: Number(cache.robots_bad_runs) || 0 };
  // the moves Steps on your website asked for: the Index coverage row of the old address names where the improved page lives
  const expected_moves = indexRows.filter(r => r.site_id === s.site_id && (S(r.improved_to) || S(r.merge_into)))
    .map(r => ({ from: S(r.url), to: S(r.improved_to) || S(r.merge_into) })).slice(0, 100);
  const nowMs = Date.now();
  const own_titles = logRows.filter(l => (S(l.site_id) === s.site_id || normD(l.domain) === s.domain) && S(l.published_url) && Date.parse(S(l.published_at)) > nowMs - OWN_TITLE_DAYS * 864e5)
    .map(l => ukey(l.published_url)).slice(0, 100);
  const open_alerts = alertRows.filter(a => S(a.site_id) === s.site_id || normD(a.domain) === s.domain).slice(0, 200)
    .map(a => ({ message_id: S(a.message_id), condition_key: S(a.condition_key), severity: S(a.severity), subject: S(a.subject), summary: S(a.summary), received_at: S(a.received_at),
      status: S(a.status), source: S(a.source), kind: S(a.kind), last_seen_at: S(a.last_seen_at), count: Number(a.count) || 0, ack_by: S(a.ack_by), ack_at: S(a.ack_at) }));
  const site = { site_id: s.site_id, domain: s.domain, canonical_host: S(model.canonical_host) || s.domain, email: S(s.email), callback_url: S(s.callback_url),
    on_demand, pages_watched: pages.length, pages_known: SM.pages(model).length, rechecks, robots_hash_prev: S(cache.robots_hash), robots_status_prev: Number(cache.robots_status) || 0,
    robots_prev, expected_moves, own_titles, open_alerts, moved,
    // CR17-FX-INDEX (L2): the confirmed moves of this site, so a move is confirmed at the end of a known chain
    moves_known: movedRows.map(r => ({ from: S(r.url), to: S(r.moved_to) })).slice(0, 200),
    last_checked_at: S(cache.checked_at), max_watch_pages: CONFIG.max_watch_pages };
  const prevOf = (u) => watchRows.find(r => r.site_id === s.site_id && ukey(r.url) === ukey(u)) || null;
  out.push({ json: { site_idx, site_id: s.site_id, domain: s.domain, url: SM.siteUrl(model, '/robots.txt'), kind: 'robots', weight: 0, site, prev: null } });
  for (const p of pages) out.push({ json: { site_idx, site_id: s.site_id, domain: s.domain, url: p.url, kind: p.kind, weight: p.weight, site, prev: prevOf(p.url), ...(p.move_check ? { move_check: true } : {}) } });
});
return out.length ? out : [{ json: { skip: true, reason: 'no key page to watch (the page inventory is empty and no site model is stored yet)' } }];
