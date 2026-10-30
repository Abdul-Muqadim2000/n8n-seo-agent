// Index coverage: what round __ROUND__ of the sitemap reading found, carried per website to the next round (urls, sitemaps read, the sitemaps
// still to read, errors). The home page's answer is read first: the host it ends on is the site's host when the site model has none (E5),
// and its own links say which pages the home page and its menu point to (X8). robots.txt answers give the Sitemap: lines and Google's rules
// (kept, at most 50 KB, for the "allow it in robots.txt" fix check, X7). A redirect is followed only to the site's own domain, by queueing
// its target for the next round (E11). A sitemap that failed is named with its reason; whether the whole tree was read is decided after the
// last round (IX.sitemapComplete, E1) and a partial tree never turns a page into "not in the sitemap".
// N7 (fix wave 2): a round reads a bounded batch, so what was queued and not asked this round stays queued for the next one; round 1 queues
// the roots it did not ask. The answers are files the HTTP node wrote to disk (read here, at most 8 MB of one: a longer sitemap is read in
// part and the tree is marked capped), so no sitemap body is kept in the run's saved data; only the addresses found travel on.
// Wave 2 (DESIGN_WAVE2.md §2.1): the home page's links are also kept as addresses (home_link_urls, resolved against the page, bounded) with
// `home_read` / `home_url` / `home_title`, so the run knows which pages the website itself links to; a home page that could not be read (no
// 2xx answer, a bot wall) leaves home_read false and nothing is concluded from it. Sitemaps read as real sitemaps are listed in `ok` (§2.5).
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const ROUND = __ROUND__;
const S = (v) => String(v == null ? '' : v).trim();
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const sites = $('Index Sites').all().map(i => i.json).filter(s => s && s.site_id && s.gsc_connected);
const prev = (() => { if (ROUND === 1) return []; try { return $('Sitemap Read ' + (ROUND - 1)).all().map(i => i.json).filter(x => x && x.site_id); } catch (e) { return []; } })();
let reqs = []; try { reqs = $('Sitemap Requests ' + ROUND).all().map(i => i.json).filter(q => q && !q.skip); } catch (e) { reqs = []; }
let fetched = true; let res = []; try { res = $('Fetch Sitemaps ' + ROUND).all().map(i => i.json); } catch (e) { res = []; fetched = false; }
// the files: this node's own input is the fetch node's output when it ran (one item per request, in order)
const ins = (() => { try { return fetched ? $input.all() : []; } catch (e) { return []; } })();
const helpers = (typeof this !== 'undefined' && this && this.helpers) ? this.helpers : null;
// R3 / R6 (fix wave 3): each answer is read when it is used and dropped after it, one at a time (wave 2 read every answer of the round
// first and held all of them), and a file above IX.CFG.sitemap_read_bytes is not read at all (IX.answerText: the size is known first)
const bodyOf = async (i) => IX.answerText(res[i] || {}, ins.length === res.length ? ins[i] : null, i, helpers, IX.CFG.sitemap_read_bytes);
const hdr = (r, name) => { const h = (r && r.headers) || {}; const k = Object.keys(h).find(x => x.toLowerCase() === name); return k ? S(h[k]) : ''; };
const locOf = (r, asked) => { const l = hdr(r, 'location'); return /^\//.test(l) && !/^\/\//.test(l) ? 'https://' + IX.hostOf(asked) + l : l; };
let roots = new Map();
if (ROUND === 1) {
  let lists = []; try { lists = $('GSC Sitemaps List').all().map(i => i.json); } catch (e) { lists = []; }
  let lreqs = []; try { lreqs = $('Sitemaps List Requests').all().map(i => i.json).filter(q => q && !q.skip); } catch (e) { lreqs = []; }
  for (const s of sites) { const i = lreqs.findIndex(q => q.site_id === s.site_id); const ans = i >= 0 ? (lists[i] || {}) : {};
    roots.set(s.site_id, (IX.sitemapsListOf(ans) || []).map(x => x.path)); }   // W2: a full response now (status code read); only a real list
}
const out = [];
for (const s of sites) {
  let st = prev.find(x => x.site_id === s.site_id);
  const mine = reqs.map((q, i) => ({ q, i })).filter(x => x.q.site_id === s.site_id);
  const answer = async (x) => { const b = await bodyOf(x.i); return { r: { ...(res[x.i] || {}), data: b.text }, b }; };
  const asked = new Set(mine.map(x => IX.key(x.q.url) + (x.q.robots ? '#r' : x.q.home ? '#h' : '')));
  // N7: what was queued and not asked in this round stays queued
  const carry = st ? (st.next || []).filter(n => !asked.has(IX.key(n.url) + (n.robots ? '#r' : n.home ? '#h' : ''))) : [];
  st = st ? { ...st, next: carry } : { site_id: s.site_id, fetched: [], urls: [], next: [], errors: [], read: 0, sets: 0, robots_status: 0, robots_txt: '', home_host: '', home_links: [], home_hops: 0,
    home_read: false, home_url: '', home_title: '', home_link_urls: [], ok: [] };
  const site = () => ({ ...s, home_host: st.home_host || S(s.home_host_prev) });
  try {
    // the home page first: the host decides how every sitemap address is stored
    for (const x of mine.filter(x => x.q.home)) {
      const q = x.q; const status = n0((res[x.i] || {}).statusCode ?? (res[x.i] || {}).status);
      const r = status >= 200 && status < 300 ? (await answer(x)).r : (res[x.i] || {});
      if (status >= 300 && status < 400) {
        const to = IX.safe(locOf(r, q.url), s);
        if (to) { st.home_host = IX.hostOf(to); if (n0(st.home_hops) < 2 && to !== q.url) { st.home_hops = n0(st.home_hops) + 1; st.next.push({ url: to, from: 'home', home: true }); } }
      } else if (status >= 200 && status < 300) {
        if (!st.home_host) st.home_host = IX.hostOf(q.url);
        st.home_links = IX.homeLinks(S(r.data), q.url, site());
        // wave 2 (§2.1): a challenge page or a bot wall is not the home page: nothing is concluded from its links
        const rf = IX.readFetch(q.url, { statusCode: status, headers: r.headers || {}, data: S(r.data) }, null);
        if (rf.ok && !rf.blocked) { st.home_read = true; st.home_url = q.url; st.home_title = IX.titleOf(S(r.data)); st.home_link_urls = IX.pageLinks(S(r.data), q.url, site()); }
      }
    }
    for (const x of mine.filter(x => !x.q.home)) {
      const q = x.q; const r0 = res[x.i] || {}; const status0 = n0(r0.statusCode ?? r0.status);
      // the address cap is reached: a sitemap answer is no longer read (nothing it holds could be kept), the tree is capped
      if (!q.robots && (st.urls || []).length >= IX.CFG.urls_max) { const k = IX.key(q.url); st.fetched = st.fetched || []; if (!st.fetched.includes(k)) st.fetched.push(k); st.capped = true; continue; }
      const a = status0 >= 200 && status0 < 300 ? await answer(x) : { r: r0, b: { text: '', cut: false } };
      const r = a.r; const cut = !!a.b.cut;
      // R6: a file above the read limit was not read: the sitemap is named with its reason and the tree is partial (never a crash, never "empty")
      if (a.b.too_large) { const k = IX.key(q.url); st.fetched = st.fetched || []; if (!q.robots && !st.fetched.includes(k)) st.fetched.push(k);
        st.errors = (st.errors || []).concat([{ url: q.url, error: 'larger than we read (' + Math.round(IX.CFG.sitemap_read_bytes / 1e6) + ' MB): not read' }]); continue; }
      if (q.robots) {
        const status = n0(r.statusCode ?? r.status);
        if (status >= 300 && status < 400 && n0(st.robots_hops) < 2) { const to = IX.safe(locOf(r, q.url), s); if (to) { st.robots_hops = n0(st.robots_hops) + 1; st.next.push({ url: to, from: 'robots_txt', robots: true }); continue; } }
        st.robots_status = status;
        if (status >= 200 && status < 300) {
          const text = S(r.data).slice(0, IX.CFG.robots_max); st.robots_txt = text;
          for (const u of IX.robotsSitemaps(text)) {
            if (reqs.some(x => x.site_id === s.site_id && IX.same(x.url, u))) continue;
            IX.sitemapQueue(st, u, 'robots', s);
          }
        }
        continue;
      }
      st = IX.sitemapAccept(st, q, r, site());
      if (cut) st.capped = true;   // a sitemap longer than we read: the tree is partial
    }
    // N7: the roots round 1 did not ask (more than one batch of submitted sitemaps) are queued for the next rounds
    if (ROUND === 1) for (const r of IX.sitemapRoots(site(), '', roots.get(s.site_id) || [])) if (!asked.has(IX.key(r.url))) IX.sitemapQueue(st, r.url, r.from, s);
  } catch (e) { st.errors = (st.errors || []).concat([{ url: '', error: 'sitemap reading failed: ' + S(e && e.message).slice(0, 120) }]); }
  st.errors = (st.errors || []).slice(0, 20);
  out.push({ json: st });
}
return out.length ? out : [{ json: { skip: true, reason: 'no website' } }];
