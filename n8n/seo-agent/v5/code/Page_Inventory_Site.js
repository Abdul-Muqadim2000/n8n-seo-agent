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
const gscAll = grab('Parse GSC');
const aiPages = grab('Load AI Pages (Site)').filter(r => r.site_id && r.url);
const stored = grab('Load Pages (Site)').filter(r => r.site_id && r.url);
const now = new Date().toISOString();
const S = (v) => String(v == null ? '' : v).trim();
const ukey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '');
const sameRow = (a, b) => !!b && S(a.title) === S(b.title) && S(a.h1) === S(b.h1) && S(a.source) === S(b.source) && S(a.lastmod) === S(b.lastmod) && S(a.queries_json) === S(b.queries_json);
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
  for (const r of stored.filter(r => r.site_id === s.site_id)) add.push({ url: r.url, title: r.title, h1: r.h1, source: r.source || 'sitemap', lastmod: r.lastmod, queries_json: r.queries_json });
  const merged = SM.withPages(model, add.slice(0, CONFIG.max_pages * 4));
  merged.pages = merged.pages.slice(0, CONFIG.max_pages);
  merged.model_updated_at = merged.model_updated_at || now;
  const was = new Map(stored.filter(r => r.site_id === s.site_id).map(r => [ukey(r.url), r]));
  const rows = SM.pageRows({ ...merged, site_id: s.site_id, model_updated_at: now }).filter(r => !sameRow(r, was.get(ukey(r.url))));
  const bySource = {}; for (const p of merged.pages) bySource[p.source] = (bySource[p.source] || 0) + 1;
  return { json: { site_id: s.site_id, domain: s.domain, pages: merged.pages, rows, total: merged.pages.length, changed: rows.length, stored: was.size, by_source: bySource,
    sitemap_read: !!(det && (det.sitemap || {}).ok), with_queries: merged.pages.filter(p => (p.queries || []).length).length } };
});
