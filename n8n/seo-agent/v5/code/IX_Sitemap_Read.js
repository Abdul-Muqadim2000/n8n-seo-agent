// Index coverage: what round __ROUND__ of the sitemap reading found, carried per website to the next round (urls, sitemaps read, the children
// still to read, errors). The home page's answer is read first: the host it ends on is the site's host when the site model has none (E5),
// and its own links say which pages the home page and its menu point to (X8). robots.txt answers give the Sitemap: lines and Google's rules
// (kept, at most 50 KB, for the "allow it in robots.txt" fix check, X7). A redirect is followed only to the site's own domain, by queueing
// its target for the next round (E11). A sitemap that failed is named with its reason; whether the whole tree was read is decided after the
// last round (IX.sitemapComplete, E1) and a partial tree never turns a page into "not in the sitemap".
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const ROUND = __ROUND__;
const S = (v) => String(v == null ? '' : v).trim();
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const sites = $('Index Sites').all().map(i => i.json).filter(s => s && s.site_id && s.gsc_connected);
const prev = (() => { if (ROUND === 1) return []; try { return $('Sitemap Read ' + (ROUND - 1)).all().map(i => i.json).filter(x => x && x.site_id); } catch (e) { return []; } })();
let reqs = []; try { reqs = $('Sitemap Requests ' + ROUND).all().map(i => i.json).filter(q => q && !q.skip); } catch (e) { reqs = []; }
let res = []; try { res = $('Fetch Sitemaps ' + ROUND).all().map(i => i.json); } catch (e) { res = []; }
const hdr = (r, name) => { const h = (r && r.headers) || {}; const k = Object.keys(h).find(x => x.toLowerCase() === name); return k ? S(h[k]) : ''; };
const locOf = (r, asked) => { const l = hdr(r, 'location'); return /^\//.test(l) && !/^\/\//.test(l) ? 'https://' + IX.hostOf(asked) + l : l; };
const out = [];
for (const s of sites) {
  let st = prev.find(x => x.site_id === s.site_id);
  st = st ? { ...st, next: [] } : { site_id: s.site_id, fetched: [], urls: [], next: [], errors: [], read: 0, robots_status: 0, robots_txt: '', home_host: '', home_links: [], home_hops: 0 };
  const site = () => ({ ...s, home_host: st.home_host || S(s.home_host_prev) });
  try {
    const mine = reqs.map((q, i) => ({ q, r: res[i] || {} })).filter(x => x.q.site_id === s.site_id);
    // the home page first: the host decides how every sitemap address is stored
    for (const { q, r } of mine.filter(x => x.q.home)) {
      const status = n0(r.statusCode ?? r.status);
      if (status >= 300 && status < 400) {
        const to = IX.safe(locOf(r, q.url), s);
        if (to) { st.home_host = IX.hostOf(to); if (n0(st.home_hops) < 2 && to !== q.url) { st.home_hops = n0(st.home_hops) + 1; st.next.push({ url: to, from: 'home', home: true }); } }
      } else if (status >= 200 && status < 300) {
        if (!st.home_host) st.home_host = IX.hostOf(q.url);
        st.home_links = IX.homeLinks(S(r.body ?? r.data), q.url, site());
      }
    }
    for (const { q, r } of mine.filter(x => !x.q.home)) {
      if (q.robots) {
        const status = n0(r.statusCode ?? r.status);
        if (status >= 300 && status < 400 && n0(st.robots_hops) < 2) { const to = IX.safe(locOf(r, q.url), s); if (to) { st.robots_hops = n0(st.robots_hops) + 1; st.next.push({ url: to, from: 'robots_txt', robots: true }); continue; } }
        st.robots_status = status;
        if (status >= 200 && status < 300) {
          const text = S(r.body ?? r.data).slice(0, IX.CFG.robots_max); st.robots_txt = text;
          for (const u of IX.robotsSitemaps(text)) {
            if (reqs.some(x => x.site_id === s.site_id && IX.same(x.url, u))) continue;
            IX.sitemapQueue(st, u, 'robots', s);
          }
        }
        continue;
      }
      st = IX.sitemapAccept(st, q, r, site());
    }
  } catch (e) { st.errors = (st.errors || []).concat([{ url: '', error: 'sitemap reading failed: ' + S(e && e.message).slice(0, 120) }]); }
  st.errors = (st.errors || []).slice(0, 20);
  out.push({ json: st });
}
return out.length ? out : [{ json: { skip: true, reason: 'no website' } }];
