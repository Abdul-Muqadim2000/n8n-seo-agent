// Index coverage: round __ROUND__ of each website's sitemap tree (DESIGN §1.1). Round 1 asks the home page (the host it really ends on, E5,
// and its own links), robots.txt, /sitemap.xml and the sitemaps the site submitted in Search Console; every later round asks the children of
// the indexes read so far, the Sitemap: lines of robots.txt, and the target of a redirect on the site's own domain. Nothing is ever fetched
// from another domain or from an address that does not parse strictly (E11: every URL is rebuilt from its parse, and no fetch follows a
// redirect by itself). No child is asked once the 5,000-address cap is reached (E10). Plain GETs, $0.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const ROUND = __ROUND__;
const S = (v) => String(v == null ? '' : v).trim();
const prev = (() => { if (ROUND === 1) return null; try { return $('Sitemap Read ' + (ROUND - 1)).all().map(i => i.json).filter(x => x && x.site_id); } catch (e) { return null; } })();
const sites = $('Index Sites').all().map(i => i.json).filter(s => s && s.site_id && s.gsc_connected);
const out = [];
if (ROUND === 1) {
  let lists = []; try { lists = $('GSC Sitemaps List').all().map(i => i.json); } catch (e) { lists = []; }
  let reqs = []; try { reqs = $('Sitemaps List Requests').all().map(i => i.json).filter(q => q && !q.skip); } catch (e) { reqs = []; }
  for (const s0 of sites) {
    const s = { ...s0, home_host: S(s0.home_host_prev) };
    const i = reqs.findIndex(q => q.site_id === s.site_id);
    const ans = i >= 0 ? (lists[i] || {}) : {};
    const gsc = Array.isArray(ans.sitemap) ? ans.sitemap.map(x => S(x.path)).filter(Boolean) : [];
    const host = IX.siteHost(s);
    out.push({ json: { site_id: s.site_id, url: 'https://' + host + '/', from: 'home', home: true } });
    out.push({ json: { site_id: s.site_id, url: 'https://' + host + '/robots.txt', from: 'robots_txt', robots: true } });
    for (const r of IX.sitemapRoots(s, '', gsc)) out.push({ json: { site_id: s.site_id, url: r.url, from: r.from } });
  }
} else {
  for (const st of (prev || [])) for (const n of (st.next || [])) {
    if (!n.robots && !n.home && (st.urls || []).length >= IX.CFG.urls_max) continue;   // E10: the tree stops at the address cap
    out.push({ json: { site_id: st.site_id, url: n.url, from: n.from, ...(n.robots ? { robots: true } : {}), ...(n.home ? { home: true } : {}) } });
  }
}
return out.length ? out : [{ json: { skip: true, reason: 'no sitemap left to read in round ' + ROUND } }];
