// Index coverage: round __ROUND__ of each website's sitemap tree (DESIGN §1.1). Round 1 asks robots.txt, /sitemap.xml and the sitemaps the site
// submitted in Search Console; every later round asks the children of the indexes read so far and the Sitemap: lines of robots.txt. At most
// 50 sitemaps and 5,000 page addresses a website (IX.CFG); a compressed (.gz) sitemap is named as not read. Plain GETs, $0.
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
  for (const s of sites) {
    const i = reqs.findIndex(q => q.site_id === s.site_id);
    const ans = i >= 0 ? (lists[i] || {}) : {};
    const gsc = Array.isArray(ans.sitemap) ? ans.sitemap.map(x => S(x.path)).filter(Boolean) : [];
    const roots = IX.sitemapRoots(s, '', gsc);
    // robots.txt first: its Sitemap: lines are read in Sitemap Read 1 and asked in round 2
    out.push({ json: { site_id: s.site_id, url: 'https://' + (S(s.canonical_host).replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '') || s.domain) + '/robots.txt', from: 'robots_txt', robots: true } });
    for (const r of roots) out.push({ json: { site_id: s.site_id, url: r.url, from: r.from } });
  }
} else {
  for (const st of (prev || [])) for (const n of (st.next || [])) out.push({ json: { site_id: st.site_id, url: n.url, from: n.from } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no sitemap left to read in round ' + ROUND } }];
