// URL Inspection (Search Console): what Google thinks of the site's key pages — indexed or not, which canonical it chose, when it last
// crawled them, mobile usability and rich results. Free, but Google's quota is 2,000 inspections a day and 600 a minute per property.
// G25 (2026-10-13, system review FIX_PLAN): it used to ask about the ladder pages only (max 20), so most of the site was never seen through
// Google's eyes. Now every key page rotates through it — the ladder pages and the pages found live this week, the home page and the menu,
// the pages Search Console brings impressions for, the AI pages — ordered **never inspected first, then the oldest inspection**
// (`seo_page_watch.inspect_at`), within the run's share of the quota (PW.PER_RUN). What the budget does not reach rides along as
// `budget.skipped` and is reported as "not checked", never as fine.
// v4.8: pages found live this week by the publish detection (Detect Published) are inspected in the same run.
/*__SITE_MODEL__*/
/*__PAGE_WATCH__*/
const sites = $('Resolve Properties').all().map(i => i.json);
const grab = (name) => { try { return $(name).all().map(i => i.json).filter(j => j && !j.skip && !j.error); } catch (e) { return []; } };
let found = []; try { found = $('Detect Published').all().map(i => i.json).filter(x => x && x.site_id && Array.isArray(x.detected)); } catch (e) { found = []; }
const models = grab('Site Model (Site)').filter(m => m.site_id);
const pageRows = grab('Load Pages (Site)').filter(r => r.site_id && r.url);
const watchRows = grab('Load Page Watch (Site)').filter(r => r.site_id && r.url);
const S = (v) => String(v == null ? '' : v).trim();
const ukey = PW.helpers.ukey;
const out = [];
sites.forEach((s, idx) => {
  if (!s.gsc_connected) return;
  const model = (models.find(m => m.site_id === s.site_id) || {}).model || SM.from({ site_id: s.site_id, domain: s.domain }, {});
  const cand = [];
  const add = (url, weight, extra) => { const u = S(url); if (/^https?:\/\//i.test(u)) cand.push({ url: u, weight, ...(extra || {}) }); };
  // only pages that exist on the site (published, or existing before the ladder); planned and written-but-unpublished pages are not live yet (live finding 2026-10-02)
  const live = (s.ladder_pages || []).filter(p => p.page_exists || p.status === 'published');
  for (const f of ((found.find(x => x.site_id === s.site_id) || {}).detected || [])) if (!live.some(p => ukey(p.url) === ukey(f.url))) live.push({ url: f.url, keyword: f.keyword, rung: 0, status: 'published' });
  for (const p of live) add(p.url, 90, { keyword: p.keyword, rung: p.rung, status: p.status, ladder: true });
  add(SM.siteUrl(model, '/'), 100, { kind: 'home' });
  for (const p of (model.nav_pages || [])) add(p.url, 70, { kind: 'nav' });
  for (const r of pageRows.filter(r => r.site_id === s.site_id)) {
    let imp = 0; try { imp = (JSON.parse(S(r.queries_json) || '[]') || []).reduce((m, q) => m + (Number((q || {}).impressions) || 0), 0); } catch (e) { imp = 0; }
    add(r.url, imp > 0 ? Math.min(65, 25 + Math.round(Math.log10(1 + imp) * 10)) : /^ai/.test(S(r.source)) ? 50 : 15, { kind: /^ai/.test(S(r.source)) ? 'ai' : imp > 0 ? 'search' : 'page' });
  }
  const seen = new Set(); const list = [];
  for (const c of cand.sort((a, b) => b.weight - a.weight)) {
    if (SM.helpers.bare(PW.helpers.hostOf(c.url)) !== SM.helpers.bare(s.domain)) continue;   // only this site's own pages
    const k = ukey(c.url); if (seen.has(k)) continue; seen.add(k);
    const w = watchRows.find(r => r.site_id === s.site_id && ukey(r.url) === ukey(c.url));
    list.push({ ...c, inspect_at: w ? S(w.inspect_at) : '' });
  }
  const cap = Number((s.config || {}).max_inspections) || PW.PER_RUN;
  const b = PW.inspectBudget(list, cap);
  const budget = { note: b.note, cap: b.limit, quota: b.quota, candidates: list.length, asked: b.take.length,
    skipped: b.skipped.slice(0, 25).map(p => ({ url: p.url, inspect_at: p.inspect_at })), skipped_total: b.skipped.length };
  for (const p of b.take) out.push({ json: { site_idx: idx, site_id: s.site_id, keyword: S(p.keyword), rung: Number(p.rung) || 0, status: S(p.status),
    kind: S(p.kind) || (p.ladder ? 'ladder' : 'page'), weight: p.weight, inspect_at: p.inspect_at, inspect_url: p.url, budget,
    body: { inspectionUrl: p.url, siteUrl: s.gsc_property, languageCode: 'en-US' } } });
});
return out.length ? out : [{ json: { skip: true, reason: 'no key page to inspect on a connected property' } }];
