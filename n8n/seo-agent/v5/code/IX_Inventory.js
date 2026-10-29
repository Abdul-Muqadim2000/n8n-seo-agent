// Index coverage: every page we know of this website, and which of them Google is asked about today (DESIGN §1.1-§1.4, §3). Merged from the
// stored index rows, the sitemap tree, the Site Tracker's inventory (seo_pages), the pages we wrote and published (seo_content_log) and
// Search Console's pages with impressions (seo_ladders is not read: publish detection writes every published ladder page to the content
// log); evidence that costs no quota first (impressions in the last 28 days; a Site Tracker inspection of the same URL in the last 3 days,
// reused); then the plan inside the day's cap. Fix wave 1: the sitemap tree counts only when read COMPLETELY (E1); the site's host is the
// canonical host or the home page's final host (E5); Search Console by page per window with truncation known (E8); our own and the
// sitemap's pages first when the 6,000 cap is reached (E12); stored rows on another form of an address move (E4), long-gone rows are pruned
// (X16); only addresses inside a URL-prefix property are asked (E5). A website with no Search Console access keeps its stored rows (E14).
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const now = Date.now();
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const sites = rowsOf('Index Sites').filter(s => s.site_id);
const stored = rowsOf('Load Index Pages').filter(r => r.site_id && r.url);
const inventory = rowsOf('Load Pages (Index)').filter(r => r.site_id && r.url);
const watch = rowsOf('Load Page Watch (Index)').filter(r => r.site_id && r.url);
const logs = rowsOf('Load Content Log (Index)');
// the sitemap tree as the LAST round left it (N7: IX.CFG.sitemap_rounds rounds; every round's node runs, a round with nothing to read passes it on)
let smState = []; for (let r = IX.CFG.sitemap_rounds; r >= 1 && !smState.length; r--) { try { smState = $('Sitemap Read ' + r).all().map(i => i.json).filter(x => x && x.site_id); } catch (e) { smState = []; } }
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const saReqs = grab('Pages Query Requests').filter(q => q && !q.skip), saRes = grab('GSC Pages Query');
const saReqs2 = grab('Pages Query More').filter(q => q && !q.skip), saRes2 = grab('GSC Pages Query 2');
let smLists = []; try { smLists = $('GSC Sitemaps List').all().map(i => i.json); } catch (e) { smLists = []; }
let smReqs = []; try { smReqs = $('Sitemaps List Requests').all().map(i => i.json).filter(q => q && !q.skip); } catch (e) { smReqs = []; }
const slimStored = (r) => { const o = {}; for (const k of IX.PAGE_COLS) o[k] = r[k]; return o; };
const out = [];
for (const s of sites) {
  const mineStored = stored.filter(r => r.site_id === s.site_id);
  if (!s.gsc_connected) {
    // E14: nothing is checked, nothing is called zero: the stored rows stand, the run says why
    out.push({ json: { site_id: s.site_id, domain: s.domain, site: s, failed: false, no_access: true, why: S(s.gsc_error), pages: mineStored.map(slimStored), take: [], reuse: [] } });
    continue;
  }
  try {
    const st = smState.find(x => x.site_id === s.site_id) || { urls: [], read: 0, errors: [], robots_status: 0 };
    const complete = IX.sitemapComplete(st);
    const site = { ...s, home_host: S(st.home_host) || S(s.home_host_prev) };
    // Search Console: one answer per window (page 1, and page 2 when page 1 was full); any page-1 failure = not read (nothing erased)
    const win = { truncated: {} }; let saOk = saReqs.length > 0, saWhy = saReqs.length ? '' : 'not asked';
    saReqs.forEach((q, i) => { if (q.site_id !== s.site_id) return; const r = saRes[i] || {};
      if (r.error || !(Array.isArray(r.rows) || r.rows === undefined)) { saOk = false; saWhy = saWhy || S((r.error && (r.error.message || r.error)) || 'no answer').slice(0, 160); return; }
      win[q.days] = (win[q.days] || []).concat(r.rows || []); });
    saReqs2.forEach((q, i) => { if (q.site_id !== s.site_id) return; const r = saRes2[i] || {};
      if (r.error || !Array.isArray(r.rows)) { win.truncated[q.days] = true; return; }   // the second page did not come: the window is cut
      win[q.days] = (win[q.days] || []).concat(r.rows);
      if (r.rows.length >= IX.CFG.sa_rows) win.truncated[q.days] = true; });   // 50,000 rows: the hard stop
    win.end = IX.saWindows(now)[0].end;
    const ev = IX.searchEvidence(saOk ? win : {}, site, { now });
    const li = smReqs.findIndex(q => q.site_id === s.site_id);
    const gl = li >= 0 ? (smLists[li] || {}) : {};
    const gscSitemaps = Array.isArray(gl.sitemap) ? gl.sitemap.map(x => ({ path: S(x.path), errors: Number(x.errors) || 0, warnings: Number(x.warnings) || 0, pending: !!x.isPending, last_downloaded: S(x.lastDownloaded) })) : null;
    const dom = IX.bare(s.domain);
    const ours = logs.filter(l => S(l.published_url) && (S(l.site_id) === s.site_id || IX.bare(S(l.domain)) === dom) && /^published$/i.test(S(l.status)))
      .map(l => ({ url: S(l.published_url), published_at: S(l.published_at) }));
    const m = IX.merge({ site, now, stored: mineStored, inventory: inventory.filter(r => r.site_id === s.site_id),
      sitemap: { read: (st.read || 0) > 0, complete, urls: st.urls || [] }, ours, search: { read: saOk, by: ev.by, truncated: ev.truncated },
      watch: watch.filter(r => r.site_id === s.site_id), prev_complete: !!s.prev_complete, prev_complete_at: S(s.prev_complete_at) });
    // a Site Tracker inspection of the same URL in the last 3 days is reused, not repeated
    for (const p of m.pages) { const r = IX.reuseOf(p._watch, now); if (r && (!p.inspect_at || Date.parse(p.inspect_at) < Date.parse(r.at))) p._reuse = r; }
    const quota_stop = !!s.quota_hit;
    const pl = IX.plan(m.pages, { cap: s.cap, used_today: s.used_today, now, stop: quota_stop, search_read: saOk, property: s.gsc_property });
    out.push({ json: { site_id: s.site_id, domain: s.domain, site, pages: m.pages.map(p => ({ ...p, _watch: undefined })), watch_since: m.watch_since, capped: m.capped,
      moves: m.moves, prune: m.prune, home_links: (st.home_links || []).slice(0, IX.CFG.home_links_max), robots: { status: Number(st.robots_status) || 0, text: S(st.robots_txt).slice(0, IX.CFG.robots_max) },
      take: pl.take.map(p => ({ url: p.url, bucket: p._bucket })), reuse: m.pages.filter(p => p._reuse).map(p => p.url),
      plan: { limit: pl.limit, due: pl.due, backlog_left: pl.backlog_left, by_bucket: pl.by_bucket, outside: pl.outside },
      sitemap: { read: st.read || 0, fetched: (st.fetched || []).length, urls: (st.urls || []).length, errors: (st.errors || []).slice(0, 10), capped: !!(st.capped || st.capped_sitemaps),
        complete, left: (st.next || []).length, robots_status: st.robots_status || 0, home_host: S(site.home_host) },
      gsc_sitemaps: gscSitemaps, search: { read: saOk, rows: ev.rows, end: ev.end, truncated: ev.truncated, truncated_windows: ev.truncated_windows, why: saOk ? '' : saWhy },
      quota_stop, failed: false } });
  } catch (e) { out.push({ json: { site_id: s.site_id, domain: s.domain, site: s, failed: true, why: 'inventory failed: ' + S(e && e.message).slice(0, 160), pages: mineStored.map(slimStored), take: [], reuse: [] } }); }
}
return out.length ? out : [{ json: { skip: true, reason: 'no website' } }];
