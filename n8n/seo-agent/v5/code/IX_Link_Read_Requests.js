// Index coverage wave 2 (2026-10-30, docs/indexing-2026-10-29/DESIGN_WAVE2.md §2.1): the website's own links. The home page was read by the
// first sitemap round (its links are in the sitemap state); this node asks for the PARENT pages: for each page Google does not have (or we
// have not checked yet) whose parent path is a page we know (/industries/bfsi -> /industries, /careers/data-engineer -> /careers), that
// parent - the parents with the most such children first, at most IX.CFG.parents_max (10) a website a run. Own domain only, every address
// rebuilt from its strict parse (IX.safe), read without following redirects and as files, like every other page read of this workflow. $0.
// Wave 2 review W11: what is left of the 10-page budget (parents first) reads the pages we suggested as link sources (`links` rows'
// link_from, IX.sourcePlan), so a link the client adds where we asked is seen and the page moves to `wait` (kind 'source').
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const sites = rowsOf('Index Sites').filter(s => s.site_id && s.gsc_connected);
const stored = rowsOf('Load Index Pages').filter(r => r.site_id && r.url);
let smState = []; for (let r = IX.CFG.sitemap_rounds; r >= 1 && !smState.length; r--) { try { smState = $('Sitemap Read ' + r).all().map(i => i.json).filter(x => x && x.site_id); } catch (e) { smState = []; } }
const out = [];
for (const s of sites) {
  const st = smState.find(x => x.site_id === s.site_id) || {};
  const site = { ...s, home_host: S(st.home_host) || S(s.home_host_prev) };
  // what we know of the website: the stored rows (with their state), then the sitemap's and the home page's addresses (not checked yet)
  const mine = stored.filter(r => r.site_id === s.site_id);
  const known = IX.parentKnown(mine, st);
  const homeKey = IX.key('https://' + IX.siteHost(site) + '/');
  const parents = IX.parentPlan(known, site).filter(p => IX.key(p.url) !== homeKey);
  for (const p of parents) out.push({ json: { site_id: s.site_id, url: p.url, children: p.children, kind: 'parent' } });
  for (const p of IX.sourcePlan(mine, site, parents.map(x => x.url).concat([st.home_url || 'https://' + IX.siteHost(site) + '/']), IX.CFG.parents_max - parents.length))
    out.push({ json: { site_id: s.site_id, url: p.url, children: 0, kind: 'source' } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no parent page to read' } }];
