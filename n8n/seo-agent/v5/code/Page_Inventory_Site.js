// D11 (2026-10-12, system review FIX_PLAN; SITE_MODEL_SPEC.md §6): the week's page inventory per site — what the website already has, so
// nothing recommends writing a page that would cannibalise a live one. Built from what this run already read, with no extra request:
//   * the sitemap URLs of the publish detection (`Detect Published`.inventory, with their <lastmod>), plus the <title> / <h1> of the pages it fetched,
//   * the Search Console pages and, per page, the queries it gets impressions for (`Parse GSC`: pages_cur + the query x page rows),
//   * AI Growth's key pages (seo_ai_pages: url + title),
//   * the pages found live this week (publish detection),
//   * the rows already stored in seo_pages (a page that left the sitemap is still live until proven otherwise).
// The merged list goes into the site model (SM.withPages) for Site Metrics and, as SM.pageRows, into seo_pages — only the rows that are new
// or changed, so a weekly run writes almost nothing. SM.matchPage() reads it everywhere else.
/*__SITE_MODEL__*/
const CONFIG = { max_pages: 2000, queries_per_page: 10, min_impressions: 1 };
const sites = $('Resolve Properties').all().map(i => i.json);
const siteModels = (() => { try { return $('Site Model (Site)').all().map(i => i.json).filter(m => m && m.site_id); } catch (e) { return []; } })();
const grab = (name) => { try { return $(name).all().map(i => i.json).filter(j => j && !j.skip && !j.error); } catch (e) { return []; } };
const detAll = grab('Detect Published').filter(x => x.site_id);
const grabAll = (name) => { try { return $(name).all().map(i => i.json || {}); } catch (e) { return []; } };   // R34: Match Slugs' first item carries the per-site state (and `skip` when nothing was fetched)
const gscAll = grab('Parse GSC');
const aiPages = grab('Load AI Pages (Site)').filter(r => r.site_id && r.url);
const stored = grab('Load Pages (Site)').filter(r => r.site_id && r.url);
// RV-1 (2026-10-21): what the pages Google shows outside the sitemap answered this run (Status Targets (Site) -> Fetch Page Status (Site),
// redirects followed, paired by position). A bot wall, a rate limit or no answer is NOT a status: the row keeps what it had.
const stReq = grabAll('Status Targets (Site)').filter(x => x && x.url && !x.skip), stRes = grabAll('Fetch Page Status (Site)');
const statusBy = new Map(); stReq.forEach((q, i) => { const r = stRes[i] || {}; const st = Number(r.statusCode != null ? r.statusCode : r.status) || 0;
  if (!st || st === 401 || st === 403 || st === 429) return; statusBy.set(q.site_id + '|' + String(q.url || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, ''), { url: q.url, status: st }); });
const now = new Date().toISOString();
const S = (v) => String(v == null ? '' : v).trim();
const ukey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '');
// B4-2 (2026-10-15, benchmark area 4): the measurement columns count as a change too — a page that went from steady to decaying
// must reach the Content Cadence this week, not next time its title changes.
const PERF = ['clicks', 'impressions', 'position', 'prev_clicks', 'yoy_clicks', 'decay_state', 'decay_pct', 'decay_lost', 'decay_kind', 'decay_basis'];
const sameRow = (a, b) => !!b && S(a.title) === S(b.title) && S(a.h1) === S(b.h1) && S(a.source) === S(b.source) && S(a.lastmod) === S(b.lastmod) && S(a.queries_json) === S(b.queries_json)
  && PERF.every(k => S(a[k]) === S(b[k])) && (Number(a.http_status) || 0) === (Number(b.http_status) || 0);   // RV-1: a page that went from live to gone (or back) is written
// the empty measurement: a page Search Console said nothing about this week keeps the columns it already had, and a page that was
// never measured carries zeros with `decay_state: ''` — never a "steady" that nothing stood behind.
const EMPTY_PERF = { clicks: 0, impressions: 0, position: 0, prev_clicks: 0, yoy_clicks: 0, decay_state: '', decay_pct: 0, decay_lost: 0, decay_kind: '', decay_basis: '', measured_at: '' };
return sites.map((s, idx) => {
  const model = (siteModels.find(m => m.site_id === s.site_id) || {}).model || SM.from({ site_id: s.site_id, domain: s.domain }, {});
  const det = detAll.find(x => x.site_id === s.site_id) || null;
  const gsc = gscAll.find(g => g.site_idx === idx) || null;
  const add = [];
  // 1. the sitemap this run read (newest information about what the site publishes)
  for (const u of (det && det.inventory) || []) add.push({ url: u.url, lastmod: u.lastmod || '', source: 'sitemap' });
  // 2. Search Console: every page with impressions, and the queries it gets them for
  const qByPage = new Map();
  for (const q of (gsc && gsc.queries) || []) { const p = S(q.page); if (!p || !(Number(q.impressions) >= CONFIG.min_impressions)) continue;
    if (!qByPage.has(p)) qByPage.set(p, []); qByPage.get(p).push({ query: q.query, impressions: Number(q.impressions) || 0, clicks: Number(q.clicks) || 0, position: Number(q.position) || 0 }); }
  for (const [p, qs] of qByPage) qs.sort((a, b) => b.impressions - a.impressions).splice(CONFIG.queries_per_page);
  for (const p of (gsc && gsc.pages) || []) if (S(p.page)) add.push({ url: p.page, source: 'gsc', queries: qByPage.get(S(p.page)) || [] });
  for (const [p, qs] of qByPage) add.push({ url: p, source: 'gsc', queries: qs });
  // 3. the pages found live this week, and the titles the detection read
  for (const f of (det && det.detected) || []) add.push({ url: f.url, source: 'detected' });
  for (const t of (det && det.page_titles) || []) add.push({ url: t.url, title: t.title, h1: t.h1, source: 'sitemap' });
  // 4. AI Growth's key pages (they already carry the page title)
  for (const r of aiPages.filter(r => r.site_id === s.site_id)) add.push({ url: r.url, title: r.title, source: 'ai_pages' });
  // 5. what is already stored (a page that left the sitemap is still live until our own check says otherwise)
  for (const r of stored.filter(r => r.site_id === s.site_id)) add.push({ url: r.url, title: r.title, h1: r.h1, source: r.source || 'sitemap', lastmod: r.lastmod, queries_json: r.queries_json, http_status: r.http_status, status_at: r.status_at });
  // 6. RV-1: this run's answers win over what was stored (SM.withPages keeps the newest reading)
  for (const [k, v] of statusBy) if (k.indexOf(s.site_id + '|') === 0) add.push({ url: v.url, source: 'gsc', http_status: v.status, status_at: now });
  const merged = SM.withPages(model, add.slice(0, CONFIG.max_pages * 4));
  merged.pages = merged.pages.slice(0, CONFIG.max_pages);
  merged.model_updated_at = merged.model_updated_at || now;
  const was = new Map(stored.filter(r => r.site_id === s.site_id).map(r => [ukey(r.url), r]));
  // B4-2: this week's Search Console measurement and decay judgement per page (Parse GSC `page_perf`, ST.decay). It is attached to
  // the inventory row rather than kept in the report, because a verdict nothing stores is a verdict nothing can act on: the
  // Content Cadence reads these columns and writes the refresh (B4-3).
  const perfBy = new Map(((gsc && gsc.page_perf) || []).map(p => [ukey(p.page), p]));
  const perfOf = (url) => { const p = perfBy.get(ukey(url)); if (!p) return null;
    return { clicks: Number(p.clicks) || 0, impressions: Number(p.impressions) || 0, position: Number(p.position) || 0,
      prev_clicks: Number(p.prev_clicks) || 0, yoy_clicks: p.yoy_clicks == null ? 0 : (Number(p.yoy_clicks) || 0),
      decay_state: S(p.state), decay_pct: p.pct == null ? 0 : (Number(p.pct) || 0), decay_lost: Number(p.lost) || 0,
      // the sentence is kept only where something is being claimed. `Load Pages (Cadence)` reads EVERY row of EVERY site, and a
      // 500-character basis on 2,000 steady pages is a megabyte the cadence has to carry to make one decision.
      decay_kind: S(p.kind), decay_basis: ['decaying', 'seasonal', 'watch'].indexOf(S(p.state)) >= 0 ? S(p.basis).slice(0, 600) : '', measured_at: now }; };
  const rows = SM.pageRows({ ...merged, site_id: s.site_id, model_updated_at: now })
    .map(r => { const old = was.get(ukey(r.url)) || {}; const fresh = perfOf(r.url);
      // no measurement this week = keep what was measured before, with the date it was measured on. Never a stale number
      // wearing today's date, and never a blank where a judgement stood last week.
      const kept = {}; for (const k of Object.keys(EMPTY_PERF)) kept[k] = old[k] == null || old[k] === '' ? EMPTY_PERF[k] : old[k];
      return { ...r, ...(fresh || kept) }; })
    .filter(r => !sameRow(r, was.get(ukey(r.url))));
  const bySource = {}; for (const p of merged.pages) bySource[p.source] = (bySource[p.source] || 0) + 1;
  // R34 (2026-10-16): the pages whose title is still not on file are NAMED, with the reason, never left to slug-only matching in silence.
  // The detection reads them a batch a week (Match Slugs (Detect) `title_fill`); what is left is what SM.titleGap reports to every reader.
  const gap = SM.titleGap(merged);
  const fillState = ((((grabAll('Match Slugs (Detect)')[0] || {}).sites) || []).find(x => x && x.site_id === s.site_id) || {}).title_fill || null;
  const title_unknown = { count: gap.untitled, of: gap.pages, urls: SM.pages(merged).filter(p => !S(p.title) && !S(p.h1)).map(p => p.url).slice(0, 50),
    note: gap.untitled ? 'title unknown for ' + gap.untitled + ' of ' + gap.pages + ' page(s): their <title> could not be read this week'
      + (fillState && fillState.left ? ' (' + fillState.left + ' left for the next weekly read, ' + fillState.cap + ' a week)' : ' (the page did not answer, or the weekly read reaches it next time)')
      + ' — until then a search is matched to them on their address alone' : '' };
  // RV-1: the pages that no longer answer, as the inventory knows them now (read this run or before), and what was read this run
  const gone = SM.gonePages(merged).map(p => ({ url: p.url, http_status: p.http_status, status_at: p.status_at }));
  const stPlan = ((grabAll('Status Targets (Site)')[0] || {}).status_plan || []).find(x => x && x.site_id === s.site_id) || null;
  const status_check = { read: [...statusBy.keys()].filter(k => k.indexOf(s.site_id + '|') === 0).length, planned: stPlan ? stPlan.planned : 0, left: stPlan ? stPlan.left : 0, gone: gone.length,
    note: stPlan ? 'the pages Google shows that the sitemap does not list are read each week (redirects followed), the most impressions first' + (stPlan.left ? '; ' + stPlan.left + ' are left for next week' : '') : 'not read in this run' };
  return { json: { site_id: s.site_id, domain: s.domain, pages: merged.pages, rows, total: merged.pages.length, changed: rows.length, stored: was.size, by_source: bySource, title_unknown, gone, status_check,
    measured: perfBy.size, decaying: [...perfBy.values()].filter(p => p.state === 'decaying').length,
    decay_summary: (gsc && gsc.decay_summary) || null,
    sitemap_read: !!(det && (det.sitemap || {}).ok), with_queries: merged.pages.filter(p => (p.queries || []).length).length } };
});
