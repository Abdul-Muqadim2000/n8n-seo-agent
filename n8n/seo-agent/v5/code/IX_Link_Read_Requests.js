// Index coverage wave 2 (2026-10-30, docs/indexing-2026-10-29/DESIGN_WAVE2.md §2.1): the website's own links. The home page was read by the
// first sitemap round (its links are in the sitemap state); this node asks for the PARENT pages: for each page Google does not have (or we
// have not checked yet) whose parent path is a page we know (/industries/bfsi -> /industries, /careers/data-engineer -> /careers), that
// parent - the parents with the most such children first, at most IX.CFG.parents_max (10) a website a run. Own domain only, every address
// rebuilt from its strict parse (IX.safe), read without following redirects and as files, like every other page read of this workflow. $0.
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
  const known = stored.filter(r => r.site_id === s.site_id).map(r => ({ url: r.url, state: S(r.state) }))
    .concat((st.urls || []).map(u => ({ url: u.loc, state: '' }))).concat((st.home_link_urls || []).map(u => ({ url: u, state: '' })));
  const homeKey = IX.key('https://' + IX.siteHost(site) + '/');
  for (const p of IX.parentPlan(known, site)) if (IX.key(p.url) !== homeKey) out.push({ json: { site_id: s.site_id, url: p.url, children: p.children } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no parent page to read' } }];
