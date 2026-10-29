// Index coverage: every page we know per website, and which of them Google is asked about today (DESIGN §1.1-§1.4, §3). Merged from the stored
// index rows, the full sitemap tree, the Site Tracker's inventory (seo_pages), the pages we wrote and published (seo_content_log)
// and Search Console's pages with impressions (seo_ladders is not read: publish detection writes every published ladder page to the content log); evidence that costs no quota first (impressions in the last 28 days; a Site Tracker inspection
// of the same URL in the last 3 days, reused); then the plan inside the day's cap. One item per website; a website that failed here is reported
// with its reason and the others go on.
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
let smState = []; try { smState = $('Sitemap Read 3').all().map(i => i.json).filter(x => x && x.site_id); } catch (e) { smState = []; }
let saReqs = []; try { saReqs = $('Pages Query Requests').all().map(i => i.json).filter(q => q && !q.skip); } catch (e) { saReqs = []; }
let saRes = []; try { saRes = $('GSC Pages Query').all().map(i => i.json); } catch (e) { saRes = []; }
let smLists = []; try { smLists = $('GSC Sitemaps List').all().map(i => i.json); } catch (e) { smLists = []; }
let smReqs = []; try { smReqs = $('Sitemaps List Requests').all().map(i => i.json).filter(q => q && !q.skip); } catch (e) { smReqs = []; }
const out = [];
for (const s of sites) {
  if (!s.gsc_connected) { out.push({ json: { site_id: s.site_id, domain: s.domain, site: s, failed: false, no_access: true, why: S(s.gsc_error), pages: [], take: [], reuse: [] } }); continue; }
  try {
    const st = smState.find(x => x.site_id === s.site_id) || { urls: [], read: 0, errors: [] };
    const si = saReqs.findIndex(q => q.site_id === s.site_id);
    const sa = si >= 0 ? (saRes[si] || {}) : {};
    const saOk = si >= 0 && !sa.error && Array.isArray(sa.rows || []) && !(sa.error);
    const ev = IX.searchEvidence(saOk ? (sa.rows || []) : [], s, { now, row_limit: 25000 });
    const li = smReqs.findIndex(q => q.site_id === s.site_id);
    const gl = li >= 0 ? (smLists[li] || {}) : {};
    const gscSitemaps = Array.isArray(gl.sitemap) ? gl.sitemap.map(x => ({ path: S(x.path), errors: Number(x.errors) || 0, warnings: Number(x.warnings) || 0, pending: !!x.isPending, last_downloaded: S(x.lastDownloaded) })) : null;
    const dom = IX.bare(s.domain);
    const ours = logs.filter(l => S(l.published_url) && (S(l.site_id) === s.site_id || IX.bare(S(l.domain)) === dom) && /^published$/i.test(S(l.status)))
      .map(l => ({ url: S(l.published_url), published_at: S(l.published_at) }));
    const m = IX.merge({ site: s, now, stored: stored.filter(r => r.site_id === s.site_id), inventory: inventory.filter(r => r.site_id === s.site_id),
      sitemap: { read: (st.read || 0) > 0, urls: st.urls || [] }, ours, search: { read: saOk, by: ev.by }, watch: watch.filter(r => r.site_id === s.site_id) });
    // a Site Tracker inspection of the same URL in the last 3 days is reused, not repeated
    for (const p of m.pages) { const r = IX.reuseOf(p._watch, now); if (r && (!p.inspect_at || Date.parse(p.inspect_at) < Date.parse(r.at))) p._reuse = r; }
    const quota_stop = !!s.quota_hit;
    const pl = IX.plan(m.pages, { cap: s.cap, used_today: s.used_today, now, stop: quota_stop, search_read: saOk, watch_since: m.watch_since });
    out.push({ json: { site_id: s.site_id, domain: s.domain, site: s, pages: m.pages.map(p => ({ ...p, _watch: undefined })), watch_since: m.watch_since, capped: m.capped,
      take: pl.take.map(p => ({ url: p.url, bucket: p._bucket })), reuse: m.pages.filter(p => p._reuse).map(p => p.url), plan: { limit: pl.limit, due: pl.due, backlog_left: pl.backlog_left, by_bucket: pl.by_bucket },
      sitemap: { read: st.read || 0, fetched: (st.fetched || []).length, urls: (st.urls || []).length, errors: (st.errors || []).slice(0, 10), capped: !!(st.capped || st.capped_sitemaps), robots_status: st.robots_status || 0 },
      gsc_sitemaps: gscSitemaps, search: { read: saOk, rows: ev.rows, end: ev.end, truncated: ev.truncated, why: saOk ? '' : S((sa.error && (sa.error.message || sa.error)) || (si < 0 ? 'not asked' : 'no answer')).slice(0, 160) },
      quota_stop, failed: false } });
  } catch (e) { out.push({ json: { site_id: s.site_id, domain: s.domain, site: s, failed: true, why: 'inventory failed: ' + S(e && e.message).slice(0, 160), pages: [], take: [], reuse: [] } }); }
}
return out.length ? out : [{ json: { skip: true, reason: 'no website' } }];
