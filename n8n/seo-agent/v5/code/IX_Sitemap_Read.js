// Index coverage: what round __ROUND__ of the sitemap reading found, carried per website to the next round (urls, sitemaps read, the children
// still to read, errors). robots.txt answers give the Sitemap: lines; a sitemap that failed is named with its reason and never turns the pages
// it would have listed into "not in the sitemap" (`read` counts the documents that were really read).
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const ROUND = __ROUND__;
const S = (v) => String(v == null ? '' : v).trim();
const sites = $('Index Sites').all().map(i => i.json).filter(s => s && s.site_id && s.gsc_connected);
const prev = (() => { if (ROUND === 1) return []; try { return $('Sitemap Read ' + (ROUND - 1)).all().map(i => i.json).filter(x => x && x.site_id); } catch (e) { return []; } })();
let reqs = []; try { reqs = $('Sitemap Requests ' + ROUND).all().map(i => i.json).filter(q => q && !q.skip); } catch (e) { reqs = []; }
let res = []; try { res = $('Fetch Sitemaps ' + ROUND).all().map(i => i.json); } catch (e) { res = []; }
const out = [];
for (const s of sites) {
  let st = prev.find(x => x.site_id === s.site_id);
  st = st ? { ...st, next: [] } : { site_id: s.site_id, fetched: [], urls: [], next: [], errors: [], read: 0, robots_status: 0 };
  try {
    reqs.forEach((q, i) => {
      if (q.site_id !== s.site_id) return;
      const r = res[i] || {};
      if (q.robots) {
        const status = Number(r.statusCode ?? r.status) || 0; st.robots_status = status;
        if (status >= 200 && status < 300) {
          const fetched = new Set(st.fetched);
          for (const u of IX.robotsSitemaps(S(r.body ?? r.data))) {
            if (!IX.own(u, s) || fetched.has(IX.key(u)) || reqs.some(x => x.site_id === s.site_id && IX.same(x.url, u)) || st.next.some(x => IX.same(x.url, u))) continue;
            if (st.fetched.length + st.next.length >= IX.CFG.sitemaps_max) { st.capped_sitemaps = true; break; }
            st.next.push({ url: u, from: 'robots' });
          }
        }
        return;
      }
      st = IX.sitemapAccept(st, q, r, s);
    });
  } catch (e) { st.errors = (st.errors || []).concat([{ url: '', error: 'sitemap reading failed: ' + S(e && e.message).slice(0, 120) }]); }
  st.errors = (st.errors || []).slice(0, 20);
  out.push({ json: st });
}
return out.length ? out : [{ json: { skip: true, reason: 'no website' } }];
