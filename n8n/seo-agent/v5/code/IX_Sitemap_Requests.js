// Index coverage: round __ROUND__ of each website's sitemap tree (DESIGN §1.1). Round 1 asks the home page (the host it really ends on, E5,
// and its own links), robots.txt and the first sitemaps of the roots (/sitemap.xml and the sitemaps the site submitted in Search Console);
// every later round asks what is still queued: the other roots, the children of the indexes read so far, the Sitemap: lines of robots.txt,
// and the target of a redirect on the site's own domain. Nothing is ever fetched from another domain or from an address that does not parse
// strictly (E11: every URL is rebuilt from its parse, and no fetch follows a redirect by itself). Plain GETs, $0.
// N7 (fix wave 2): the sitemaps of one round are a BOUNDED batch (IX.sitemapBatch: 2 while nothing is known of their size, then sized by
// what the sitemaps read so far held, at most 10), nothing is asked once the 5,000-address cap is reached, and the answers are files on
// disk (the HTTP node writes them; Sitemap Read reads at most 8 MB of one), so no sitemap body is kept in the run's saved data.
// R3 (fix wave 3): a queued child carries its depth in the tree (roots 0), so Sitemap Read knows when an index of indexes was read and the
// next batch of unknown leaves is larger (IX.sitemapBatch); the rounds spent on indexes no longer leave a three-level tree partial.
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
    const gsc = (IX.sitemapsListOf(ans) || []).map(x => x.path);   // W2: a full response now (status code read); only a real list
    const host = IX.siteHost(s);
    out.push({ json: { site_id: s.site_id, url: 'https://' + host + '/', from: 'home', home: true } });
    out.push({ json: { site_id: s.site_id, url: 'https://' + host + '/robots.txt', from: 'robots_txt', robots: true } });
    // the rest of the roots are queued by Sitemap Read 1 (it lists the same roots) and read in the next rounds
    for (const r of IX.sitemapRoots(s, '', gsc).slice(0, IX.CFG.sitemap_batch_first)) out.push({ json: { site_id: s.site_id, url: r.url, from: r.from } });
  }
} else {
  for (const st of (prev || [])) {
    let room = IX.sitemapBatch(st);
    for (const n of (st.next || [])) {
      const hop = !!(n.robots || n.home);
      if (!hop) { if (room <= 0) continue; room--; }   // E10 / N7: the tree stops at the address cap, and a round reads a bounded batch
      out.push({ json: { site_id: st.site_id, url: n.url, from: n.from, ...(n.robots ? { robots: true } : {}), ...(n.home ? { home: true } : {}),
        ...(n.redirected_from ? { redirected_from: n.redirected_from } : {}), ...(n.gsc ? { gsc: true } : {}), ...(n.depth ? { depth: n.depth } : {}) } });
    }
  }
}
return out.length ? out : [{ json: { skip: true, reason: 'no sitemap left to read in round ' + ROUND } }];
