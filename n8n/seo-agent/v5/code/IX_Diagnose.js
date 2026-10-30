// Index coverage: one cause per page (DESIGN §4), its action class and the client's sentence, the history of every state change, drop-outs,
// "needs a person" after 4 unchanged re-checks, internal-link suggestions for pages Google has not found or crawled, and the run's figures.
// Readings, in order of trust: today's inspection, a Site Tracker inspection of the last 3 days (reused), impressions in the last 28 days of
// data, the stored reading. A failed inspection is "not checked": a page with an earlier reading keeps it (and is tried again tomorrow), a
// page with none is `error / not_checked` - never "not indexed".
// Fix wave 1 (FIX_CONTRACT.md): Google's documented fields beat our read, and a blocked read is nothing (E2); a same-site redirect that only
// changes the slash, the case or the www moves the row to the final address, never a drop-out or a site step (E4); a drop-out is a page that
// was indexed and is now left out with something to do (X4: not a redirect the client made, not a removed page, not an intended noindex);
// `fix_seen_at` when our read shows the step done while Google still shows the old reason (X7: action `wait`, re-checked within a day);
// `ask_google` on at most 5 pages a week (X8); the first run and Google news older than the site's first run send no same-day callback (X13).
// Wave 2 (DESIGN_WAVE2.md §2.2 / §2.3): every page Google does not have goes through IX.refine - a page with its own title that names
// another page as its canonical is a step on the site (canonical_elsewhere, in the sitemap or not); a policy / utility page is left out
// (low_value, never "improve", never "ask Google"); a page Google has not visited that the website already links to waits (action `wait`, no
// link suggestions; 'unread' keeps what was stored). Link suggestions only with a real topic overlap, at most 3. "I asked Google"
// (asked_google_at, the app's) is checked back: Google's crawl after it is google_read_after_ask_at, and the page is offered again after 28 days.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const now = Date.now(); const nowIso = new Date(now).toISOString();
const TZ = '__ENGINE_TZ__';
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const inv = grab('Index Inventory').filter(x => x && x.site_id);
const g = grab('Google Events')[0] || {};
const fr = g.freeze || { freeze: false };
const pq = grab('Index Probe Requests').filter(q => q && !q.skip);
const fresh = IX.readingsOf([[pq, grab('Inspect URL (Probe)').slice(0, pq.length)], [grab('Index Inspect Requests').filter(q => q && !q.skip), grab('Inspect URL (Index)')],
  [grab('Inspect Retry Requests').filter(q => q && !q.skip), grab('Inspect URL (Retry)'), true]]);
const fetches = new Map(); for (const x of grab('Page Signals')) if (x && x.site_id && x.f) fetches.set(x.site_id + '|' + IX.key(x.url), x.f);
let saved = []; try { saved = $('Save Index Reservation').all().map(i => i.json); } catch (e) { saved = []; }
const dow = (() => { try { return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(new Date(now)); } catch (e) { return new Date(now).toUTCString().slice(0, 3); } })();
const monday = dow === 'Mon';
const out = [];
for (const v of inv) {
  const s = v.site || {}; const base = { site_id: v.site_id, domain: v.domain, callback_url: S(s.callback_url), request_id: S(s.request_id), on_demand: !!s.on_demand, cap: n0(s.cap), run_at: S(s.run_at) };
  if (v.no_access || v.failed) {
    // E14: the stored rows stand as they are (the figures of the last check), the run says it could not check, nothing is written
    const all = (v.pages || []).map(r => ({ url: S(r.url), state: S(r.state) || 'unknown', cause: S(r.cause), action: S(r.action) || 'none', lane: S(r.lane), needs_person: r.needs_person === true || r.needs_person === 'true',
      note: S(r.note), merge_into: S(r.merge_into), final_url: S(r.final_url), http_status: n0(r.http_status), fix_seen_at: S(r.fix_seen_at), ask_google: r.ask_google === true || r.ask_google === 'true' }));
    out.push({ json: { ...base, upserts: [], history: [], deletes: [], history_moves: [], all, dropped: [], counts: { inspected: 0, reused: 0, fetched: 0, errors: 0 }, failed: true,
      why: IX.plainWhy(v.why), why_detail: S(v.why_detail), plan: {}, freeze: fr, news_today: 0, submit: v.submit || null } });   // R5: plain words only; the raw error stays internal
    continue;
  }
  try {
    const smComplete = (v.sitemap || {}).complete === true;
    const site = v.site || {};
    const ctx = { now, freeze: fr, sitemap_complete: smComplete, has_sitemap: (v.sitemap || {}).urls > 0, site };
    const robots = v.robots || {};
    // wave 2 (§2.2): the titles we know of the website's pages (stored, read today, the parents read), for the canonical check
    const titles = new Map();
    for (const p of (v.pages || [])) if (S(p.title)) titles.set(IX.key(p.url), S(p.title));
    for (const [kk, f0] of fetches) if (kk.indexOf(v.site_id + '|') === 0 && f0 && f0.ok && !f0.blocked && S(f0.title)) titles.set(kk.slice(v.site_id.length + 1), S(f0.title));
    for (const [kk, t] of Object.entries(v.link_titles || {})) if (S(t) && !titles.has(kk)) titles.set(kk, S(t));
    const rctx = { titles, site };
    const reserved = saved.some(r => r && !r.error && S(r.site_id) === v.site_id);
    const rows = []; const dropped = []; const c = { inspected: 0, reused: 0, fetched: 0, errors: 0, quota: false, access: false, rate: 0, blocked: 0, moved: 0 };
    let movesLeft = IX.CFG.moves_max - (v.moves || []).length;
    // the fields of a Google reading: a reading of an address that turned out to redirect says nothing about the address it redirects to (N1)
    const READING = ['verdict', 'coverage', 'google_canonical', 'last_crawl', 'inspect_at', 'evidence', 'indexing_state', 'robots_state', 'page_fetch_state', 'crawled_as',
      'user_canonical', 'referring_count', 'google_sitemaps'];
    for (const p of (v.pages || [])) {
      const k = IX.key(p.url); const prev = p._prev || null; const prevState = S(prev && prev.state);
      const fi = fresh.get(v.site_id + '|' + k) || null; const reuse = !fi && p._reuse ? p._reuse : null; const f = fetches.get(v.site_id + '|' + k) || null;
      const row = { ...p };
      if (fi) { c.inspected++; if (!fi.ok) { c.errors++; if (fi.error_kind === 'quota') c.quota = true; if (fi.error_kind === 'access') c.access = true; if (fi.error_kind === 'rate') c.rate++; } }
      if (reuse) c.reused++;
      if (f) { c.fetched++; if (f.blocked) c.blocked++; }
      const reading = (fi && fi.ok) ? fi : reuse;
      if (reading) {
        Object.assign(row, { verdict: S(reading.verdict), coverage: S(reading.coverage), google_canonical: S(reading.google_canonical), last_crawl: S(reading.last_crawl),
          inspect_at: fi ? nowIso : S(reading.at), evidence: fi ? 'inspection' : 'site_tracker' });
        if (fi) Object.assign(row, { indexing_state: S(fi.indexing_state), robots_state: S(fi.robots), page_fetch_state: S(fi.page_fetch_state), crawled_as: S(fi.crawled_as),
          user_canonical: S(fi.user_canonical), referring_count: n0(fi.referring_count), google_sitemaps: n0(fi.google_sitemaps) });
      }
      if (f) Object.assign(row, { fetch_at: nowIso, ...(f.ok && !f.blocked ? { http_status: f.http_status, final_url: f.final_url, noindex: f.noindex, page_canonical: f.page_canonical, words: f.words,
        title: S(f.title) || S(row.title) } : {}) });
      // E4 / N1: the same page under another form of its address (slash, case, www): the row moves to where the redirect ENDS (the final URL
      // wins; the `final` source keeps the sitemap's form mapped onto it, so tomorrow's merge does not move it back), gets a fresh plan
      // (inspected on the next run) and keeps its history; the reading of the redirecting form is not kept as the page's reading
      const gMove = reading && /^page with redirect/i.test(S(reading.coverage)) && S(reading.google_canonical) && IX.same(reading.google_canonical, row.url) && IX.safe(reading.google_canonical, site) !== row.url ? IX.safe(reading.google_canonical, site) : '';
      const moveTo = (f && f.ok && !f.blocked && S(f.moved_to) && IX.safe(f.moved_to, site) !== row.url) ? IX.safe(f.moved_to, site) : gMove;
      let d = null; let moved = false;
      if (moveTo && movesLeft > 0) {
        movesLeft--; row.url = moveTo; moved = true; c.moved++;
        for (const kk of READING) row[kk] = prev ? p[kk] : (kk === 'referring_count' || kk === 'google_sitemaps' ? 0 : '');
        if (!prev) Object.assign(row, { state: 'unknown', cause: '', action: 'none' });   // nothing is concluded from the old address's reading
        row.sources = [...new Set(S(row.sources).split(',').filter(Boolean).concat(['final']))].join(',');
        row.next_check_at = prev ? nowIso : '';   // a fresh plan: due on the next run (a page never read is planned as never inspected)
      } else if (fi && !fi.ok) {
        if (prevState && !/^(unknown|error)$/.test(prevState)) { row.next_check_at = new Date(now + IX.DAY).toISOString(); row._why = S(fi.not_checked); }
        else d = { state: 'error', cause: 'not_checked', action: 'none', merge_into: '' };
        if (d) row._why = S(fi.not_checked);
      } else if (reading || (f && f.ok && !f.blocked)) {
        const basis = reading || IX.storedReading(row);
        if (!(row._evidence_search && !reading)) d = IX.diagnose(row, basis, f && f.ok && !f.blocked ? f : null, ctx);
      }
      // wave 2: the canonical with its own title, utility pages, pages already linked (IX.refine) - before `checks`, so a refined cause counts its re-checks
      if (d) { const rf = IX.refine({ ...row, ...d }, { ...rctx, prev }); d = { ...d, cause: rf.cause, action: rf.action, state: rf.state }; row._own_title = rf.own_title; }
      else if (!moved && S(row.cause) && !(fi && !fi.ok && !prevState)) {
        const rf = IX.refine(row, { ...rctx, prev }); row._own_title = rf.own_title;
        if (rf.changed) { const cc = rf.cause !== S(row.cause); Object.assign(row, { cause: rf.cause, action: rf.action, state: rf.state }); if (cc) { row.fix_seen_at = ''; row.fix_failed_at = ''; } }
      }
      if (d) {
        Object.assign(row, { state: d.state, cause: d.cause, action: d.action, merge_into: S(d.merge_into), host_only: !!d.host_only });
        if (reading) row.checks = (prev && S(prev.cause) === d.cause && S(prev.inspect_at)) ? n0(prev.checks) + 1 : 1;
        if (row.state === 'indexed') row.indexed_since = prevState === 'indexed' ? (S(prev.indexed_since) || nowIso) : nowIso; else row.indexed_since = '';
      } else if (!S(row.action)) row.action = 'none';
      // X7 / N3 / N4: the fix state of a page with a step on the client's site (IX.fixState holds THE SHARED RULE: fix_seen_at set = fixed on
      // the site, waiting for Google, whatever inspect_at says; cleared when Google's reason changes, when our read sees the problem again, or
      // when Google crawled the page after the fix and still reports it - then fix_failed_at, and the step is the client's again, with a note)
      const fixBefore = S(row.fix_seen_at);
      const siteFix = row.action === 'site_fix' || (S(row.fix_seen_at) && row.action === 'wait');
      if (siteFix && !moved) {
        const allows = S(row.cause) === 'robots_blocked' ? IX.robotsAllows(robots.text, robots.status, IX.pathOf(row.url)) : null;
        const seen = IX.fixSeen(row, f, allows, ctx);
        const sameCause = !!prev && S(prev.cause) === S(row.cause);
        const fx = IX.fixState({ prev: sameCause ? prev : null, seen, fresh: reading || null, now_iso: nowIso });
        row.fix_seen_at = fx.fix_seen_at; row.fix_failed_at = fx.fix_failed_at;
        // R4 (fix wave 3): back to the client's step only when THIS run did not re-diagnose the page (wave 1's `&& !d`): a fixed page whose
        // new Google reading is "new, not crawled yet" (wait_new, action wait) is waiting for Google, not a site step
        if (S(row.fix_seen_at)) row.action = 'wait'; else if (row.action === 'wait' && !d) row.action = 'site_fix';   // the fix was not seen again: the step is back
      } else if (d || moved) { row.fix_seen_at = ''; row.fix_failed_at = ''; }
      if (row.state === 'indexed') { row.fix_seen_at = ''; row.fix_failed_at = ''; if (row.action === 'wait' && !S(row.cause)) row.action = 'none'; }   // N4: nothing waits for an indexed page
      // X4: a drop-out is an indexed page Google now leaves out with something to do (never one left out on purpose, a move, or a wait)
      if (d && !moved && prevState === 'indexed' && (row.state === 'not_indexed' || row.state === 'excluded') && reading && !['leave_out', 'wait'].includes(row.action)) {
        row.dropped_at = nowIso; dropped.push({ url: row.url, at: nowIso, cause: row.cause });
      }
      // N2: the next inspection moves only after a GOOGLE reading (an inspection, or the Site Tracker's reused one) - never on a day our own
      // read alone re-diagnosed the page, or the date would slide forward on every read and the page would never be inspected again. A fix
      // newly seen on the site only brings the next inspection forward (re-checked within a day), it never pushes it back.
      if (!moved) {
        if (reading && d) row.next_check_at = IX.nextCheck(row, ctx);
        else if (d && fi && !fi.ok) row.next_check_at = IX.nextCheck(row, ctx);
        else if (S(row.fix_seen_at) && S(row.fix_seen_at) !== fixBefore) { const nc = IX.nextCheck(row, ctx); if (!S(row.next_check_at) || Date.parse(nc) < Date.parse(row.next_check_at)) row.next_check_at = nc; }
      }
      row.needs_person = ['site_fix', 'links', 'quality', 'duplicate'].includes(S(row.action)) && n0(row.checks) > IX.CFG.person_after;
      // wave 2 (§2.3): the client asked Google to read it (asked_google_at, written by the app): Google's first crawl after that ask
      if (S(row.asked_google_at)) row.google_read_after_ask_at = IX.readAfterAsk(row);
      rows.push(row);
    }
    // internal links for the pages Google has not found or crawled: existing indexed pages on the same topic
    for (const r of rows) r.link_from = r.action === 'links' ? JSON.stringify(IX.linkSuggestions(r, rows, { site, linked_from: IX.linkedList(r.linked_by) })) : '';
    for (const r of rows) { if (r.state === 'indexed' && !S(r.cause)) r.action = 'none'; }
    // X8: "ask Google to read it" - at most 5 a site; chosen again on the engine's Monday
    const asked = IX.askGoogle(rows, { now, home_keys: new Set(v.home_links || []), freeze: fr, reselect: monday });
    for (const r of rows) { r.note = IX.noteOf(r, { freeze: fr, now, site }); r.updated_at = nowIso; }
    const upserts = [], history = [];
    for (const r of rows) {
      const o = IX.rowOut(r);
      const movedNet = !!r._prev && S(r._prev.url) !== o.url;
      if (IX.changed(movedNet ? null : r._prev, o)) upserts.push(o);
      const pr = r._prev;
      if ((!pr && o.state !== 'unknown') || (pr && (S(pr.state) !== o.state || S(pr.cause) !== o.cause)))
        history.push({ site_id: o.site_id, url: o.url, at: nowIso, state: o.state, cause: o.cause, evidence: o.evidence, verdict: o.verdict, coverage: o.coverage });
    }
    // E4 / N1 / X16 / N10: the NET moves (the stored address -> where the row is now; a row moved by the merge and back by the redirect did
    // not move), each deleted only once its new row is saved (Index Delete Rows checks Save Index Pages); long-gone and duplicate rows are
    // pruned; an address that is a row of this run is never deleted
    const live = new Set(rows.map(r => r.url));
    const netMoves = rows.filter(r => r._prev && S(r._prev.url) && S(r._prev.url) !== r.url).map(r => ({ site_id: v.site_id, from: S(r._prev.url), to: r.url }));
    const deletes = netMoves.map(m => ({ site_id: v.site_id, url: m.from, why: 'move', keep: m.to }))
      .concat((v.prune || []).map(x => ({ site_id: v.site_id, url: x.url, why: S(x.why) || 'gone', keep: S(x.keep) })))
      .filter(x => x.url && !live.has(x.url));
    const history_moves = netMoves.filter(m => !live.has(m.from));
    const all = rows.map(r => ({ url: r.url, state: S(r.state), cause: S(r.cause), action: S(r.action), lane: S(r.lane), needs_person: !!r.needs_person, note: S(r.note),
      merge_into: S(r.merge_into), final_url: S(r.final_url), http_status: n0(r.http_status), fix_seen_at: S(r.fix_seen_at), ask_google: !!r.ask_google, fix_failed_at: S(r.fix_failed_at),
      own_title: !!r._own_title, linked: IX.linkedList(r.linked_by).length > 0 }));
    // X13: no same-day callback for news on the site's first run, nor for an update that started before the site was first checked
    const firstRun = !(v.pages || []).some(p => p._prev);
    const since = S(v.watch_since);
    const newsFor = (list) => (list || []).filter(e => !firstRun && (!since || S(e.started_at) >= since.slice(0, 10))).length;
    const news_today = newsFor(g.started) + newsFor(g.completed) + (g.policy_news && !firstRun ? 1 : 0);
    out.push({ json: { ...base, upserts, history, deletes: deletes.slice(0, IX.CFG.moves_max * 2), history_moves, all, dropped: dropped.slice(0, IX.CFG.dropped_max), counts: c, plan: v.plan || {},
      freeze: fr, sitemap: v.sitemap || {}, gsc_sitemaps: v.gsc_sitemaps, search: v.search || {}, quota_stop: !!v.quota_stop || c.quota, access_lost: c.access, capped: !!v.capped,
      reserved, ask_google: asked, first_run: firstRun, news_today, failed: false, submit: v.submit || null, links: v.links || null } });
  } catch (e) {
    out.push({ json: { ...base, upserts: [], history: [], deletes: [], history_moves: [], all: [], dropped: [], counts: { inspected: 0, reused: 0, fetched: 0, errors: 0 }, failed: true,
      why: IX.PLAIN_FAIL, why_detail: 'diagnosis failed: ' + S(e && e.message).slice(0, 160), plan: {}, freeze: fr, news_today: 0, submit: v.submit || null } });   // R5
  }
}
return out.length ? out.map(o => ({ json: { ...o.json, monday } })) : [{ json: { skip: true, reason: 'no website' } }];
