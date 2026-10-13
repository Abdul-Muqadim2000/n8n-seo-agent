// G11 (2026-10-13, system review FIX_PLAN.md): what the daily key-page watch fetches today. Per tracked site: the key pages of the one site
// model (home page, the pages in the menu, the pages Search Console brings impressions for, the pages the keyword ladders and the AI growth
// loop own — all of them already in `seo_pages`, never a fresh crawl) plus `/robots.txt`. One plain GET each, no paid API, nothing rendered.
// A site with nothing to watch makes no request. The re-check queue ("I fixed this" in the app: seo_audit_findings.recheck_state = requested)
// is carried on every item of its site, so the same fetches answer it (G11's second half).
/*__SITE_MODEL__*/
/*__PAGE_WATCH__*/
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
  for (const c of cand.sort((a, b) => b.weight - a.weight || S(b.lastmod).localeCompare(S(a.lastmod)))) {
    const u = S(c.url); if (!/^https?:\/\//i.test(u)) continue;
    if (SM.helpers.bare(PW.helpers.hostOf(u)) !== SM.helpers.bare(s.domain)) continue;   // only the site's own pages are watched
    const k = ukey(u); if (seen.has(k)) continue; seen.add(k);
    pages.push({ url: u, kind: c.kind, weight: c.weight });
    if (pages.length >= CONFIG.max_watch_pages) break;
  }
  const cache = (() => { try { return JSON.parse(S((cacheRows.find(c => S(c.key) === 'watch:' + s.site_id) || {}).value) || 'null') || {}; } catch (e) { return {}; } })();
  const rechecks = findingRows.filter(f => f.site_id === s.site_id && (!S(trigger.finding_key) || S(f.finding_key) === S(trigger.finding_key)))
    .slice(0, CONFIG.max_rechecks_per_site)
    .map(f => ({ audit_id: S(f.audit_id), finding_key: S(f.finding_key), title: S(f.title), category: S(f.category), severity: S(f.severity), requested_at: S(f.recheck_requested_at) }));
  const site = { site_id: s.site_id, domain: s.domain, canonical_host: S(model.canonical_host) || s.domain, email: S(s.email), callback_url: S(s.callback_url),
    on_demand, pages_watched: pages.length, pages_known: SM.pages(model).length, rechecks, robots_hash_prev: S(cache.robots_hash), robots_status_prev: Number(cache.robots_status) || 0,
    last_checked_at: S(cache.checked_at), max_watch_pages: CONFIG.max_watch_pages };
  const prevOf = (u) => watchRows.find(r => r.site_id === s.site_id && ukey(r.url) === ukey(u)) || null;
  out.push({ json: { site_idx, site_id: s.site_id, domain: s.domain, url: SM.siteUrl(model, '/robots.txt'), kind: 'robots', weight: 0, site, prev: null } });
  for (const p of pages) out.push({ json: { site_idx, site_id: s.site_id, domain: s.domain, url: p.url, kind: p.kind, weight: p.weight, site, prev: prevOf(p.url) } });
});
return out.length ? out : [{ json: { skip: true, reason: 'no key page to watch (the page inventory is empty and no site model is stored yet)' } }];
