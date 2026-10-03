// Publish detection, step 3: every URL of the site's sitemap (index children included) against the written pages. URLs compare host-agnostically
// (www. or not, http or https), without query / fragment, case or trailing slash; only the site's own host and its subdomains count.
//   (a) slug: the URL's path equals the planned path of the ladder row, or its last segment equals the planned slug or the keyword's slug
//       ("e invoicing in uae" -> e-invoicing-in-uae). Score: planned path 100, planned slug 95, keyword slug 90, one point less per folder.
//       A page that improves an EXISTING URL matches that URL only when its sitemap lastmod is on or after the day the page was written.
//   (b) title, for at most 10 candidates still unmatched (newest first, 2+ significant words): the URLs whose slug holds >= 60% of the keyword's
//       significant words (the web app's word rules, _reach.js: stop words out, light stem; words of 5+ letters also match by prefix) are
//       fetched next — at most 5 per candidate, 15 per site, 100 per run — and Detect Published accepts a <title> or first <h1> holding >= 80%.
//   Never claimed: URLs of other pages of the site (published, or existing before), URLs last changed before the page was written (lastmod;
//   one day of slack for time zones). One URL per candidate and one candidate per URL, best score first.
const CONFIG = { max_urls_per_site: 20000, max_body_chars: 5000000, title_candidates: 10, options_per_candidate: 5, max_fetches_per_site: 15, max_fetches_per_run: 100, slug_share: 0.6 };
/*__OVERLAP__*/
const sites = $('Publish Candidates').all().map(i => i.json).filter(s => s && !s.skip);
const grab = (name) => { try { return $(name).all().map(i => i.json || {}); } catch (e) { return []; } };
const mainRes = grab('Fetch Sitemap (Detect)');
const kidReq = grab('Sitemap Children (Detect)').filter(k => !k.skip), kidRes = grab('Fetch Child Sitemaps (Detect)');
const bodyOf = (r) => { const b = r && (r.body != null ? r.body : r.data); return typeof b === 'string' ? b : (b ? JSON.stringify(b) : ''); };   // text responses come under `data`
const statusOf = (r) => Number(r.statusCode) || (r.error ? 0 : 200);
const errOf = (r) => r.error ? String(r.error.message || r.error.description || r.error).slice(0, 160) : '';
const tagOf = (blk, t) => { const m = blk.match(new RegExp('<' + t + '>\\s*(?:<!\\[CDATA\\[)?\\s*([^<\\]\\s]+)', 'i')); return m ? m[1].replace(/&amp;/g, '&').trim() : ''; };
const parseU = (u) => { const m = String(u || '').trim().match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)(?::\d+)?([^?#]*)/i); if (!m) return null; let p = m[2] || ''; try { p = decodeURIComponent(p); } catch (e) {}
  return { host: m[1].toLowerCase().replace(/^www\./, ''), path: p.toLowerCase().replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '') }; };   // no URL constructor in the n8n Code sandbox
const keyOf = (u) => { const x = parseU(u); return x ? x.host + '/' + x.path : ''; };
const lastSeg = (p) => String(p || '').split('/').pop().replace(/\.(html?|php|aspx?)$/i, '');
const slugOf = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const day = (s) => String(s || '').slice(0, 10);
const dayBefore = (s) => { const t = Date.parse(day(s)); return isNaN(t) ? '' : new Date(t - 864e5).toISOString().slice(0, 10); };
const tokHit = (t, set) => set.some(x => x === t || (t.length >= 5 && x.length >= 5 && (x.startsWith(t) || t.startsWith(x))));
const shareOf = (kwT, other) => kwT.length ? kwT.filter(t => tokHit(t, other)).length / kwT.length : 0;
let runFetches = 0;
const state = sites.map((s, i) => {
  const d = s.domain;
  // ---- the sitemap: /sitemap.xml, or the children of its index ----
  const files = [{ url: s.sitemap_url, r: mainRes[i] || {} }, ...kidReq.map((k, j) => ({ k, r: kidRes[j] || {} })).filter(x => x.k.site_idx === s.site_idx).map(x => ({ url: x.k.url, r: x.r }))];
  const urls = new Map(); let read = 0, index = false; const errors = [];
  for (const f of files) {
    const st = statusOf(f.r), body = bodyOf(f.r).slice(0, CONFIG.max_body_chars);
    if (st !== 200) { errors.push(f.url + ': ' + (errOf(f.r) || 'HTTP ' + st)); continue; }
    if (/<sitemapindex/i.test(body)) { index = true; continue; }
    if (!/<urlset/i.test(body)) { errors.push(f.url + ': not an XML sitemap'); continue; }
    read++;
    for (const m of body.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)) {
      if (urls.size >= CONFIG.max_urls_per_site) break;
      const loc = tagOf(m[1], 'loc'); const x = parseU(loc); if (!x || !(x.host === d || x.host.endsWith('.' + d))) continue;
      const k = x.host + '/' + x.path; if (!urls.has(k)) urls.set(k, { url: loc, key: k, path: x.path, last: lastSeg(x.path), lastmod: tagOf(m[1], 'lastmod') });
    }
  }
  const sitemap = { ok: read > 0, index, files_read: read, urls: urls.size, error: read ? '' : (errors[0] || (index ? 'the sitemap index lists no readable sitemap' : 'empty sitemap')) };
  // ---- (a) slug ----
  const known = new Set((s.known || []).map(keyOf).filter(Boolean));
  const list = [...urls.values()]; const byPath = new Map(), byLast = new Map();
  for (const u of list) { if (!byPath.has(u.path)) byPath.set(u.path, []); byPath.get(u.path).push(u); if (!byLast.has(u.last)) byLast.set(u.last, []); byLast.get(u.last).push(u); }
  const fresh = (u, c) => !u.lastmod || !c.written_at || day(u.lastmod) >= dayBefore(c.written_at);
  const pairs = [], notes = {};
  for (const c of s.candidates || []) {
    if (c.existing_url) {
      const u = urls.get(keyOf(c.existing_url));
      if (u && u.lastmod && c.written_at && day(u.lastmod) >= day(c.written_at)) pairs.push({ key: c.key, url: u.url, ukey: u.key, score: 100, matched_by: 'slug', updated: true });
      else notes[c.key] = !u ? 'the existing page is not in the sitemap' : !u.lastmod ? 'existing page: the sitemap gives no change date' : 'the existing page has not changed since the new version was written';
      continue;
    }
    const pl = c.planned_url ? parseU(c.planned_url) : null; const pPath = pl ? pl.path : '', pLast = pl ? lastSeg(pl.path) : '', kSlug = slugOf(c.keyword);
    const seen = new Set();
    const consider = (u, score) => { if (seen.has(u.key) || known.has(u.key) || !fresh(u, c)) return; seen.add(u.key); pairs.push({ key: c.key, url: u.url, ukey: u.key, score: score - (u.path.split('/').length - 1), matched_by: 'slug' }); };
    if (pPath) for (const u of byPath.get(pPath) || []) consider(u, 100);
    if (pLast) for (const u of byLast.get(pLast) || []) consider(u, 95);
    if (kSlug) for (const u of byLast.get(kSlug) || []) consider(u, 90);
  }
  pairs.sort((a, b) => b.score - a.score);
  const matched = new Map(), claimed = new Set();
  for (const p of pairs) if (!matched.has(p.key) && !claimed.has(p.ukey)) { matched.set(p.key, p); claimed.add(p.ukey); }
  // ---- (b) the pages to read for the title check ----
  const slugTok = new Map(); const tokOf = (u) => { if (!slugTok.has(u.key)) slugTok.set(u.key, overlapTokens(u.last.replace(/[-_]+/g, ' '))); return slugTok.get(u.key); };
  const title_checks = (s.candidates || []).filter(c => !c.existing_url && !matched.has(c.key)).map(c => ({ c, kwT: overlapTokens(c.keyword) })).filter(x => x.kwT.length >= 2).slice(0, CONFIG.title_candidates).map(({ c, kwT }) => {
    const opts = list.filter(u => !claimed.has(u.key) && !known.has(u.key) && fresh(u, c)).map(u => ({ u, sh: shareOf(kwT, tokOf(u)), j: overlapScore(kwT, tokOf(u)) }))
      .filter(o => o.sh >= CONFIG.slug_share).sort((a, b) => (b.sh - a.sh) || (b.j - a.j) || (a.u.path.length - b.u.path.length)).slice(0, CONFIG.options_per_candidate);
    return { key: c.key, keyword: c.keyword, tokens: kwT, options: opts.map(o => ({ url: o.u.url, ukey: o.u.key, slug_share: Math.round(o.sh * 100) / 100 })) };
  });
  const fetches = [], fset = new Set();   // round robin: every candidate gets its best page read before any gets a second one
  for (let round = 0; round < CONFIG.options_per_candidate; round++) for (const ch of title_checks) {
    const o = ch.options[round]; if (!o || fset.has(o.ukey)) continue;
    if (fetches.length >= CONFIG.max_fetches_per_site || runFetches >= CONFIG.max_fetches_per_run) break;
    fset.add(o.ukey); fetches.push(o.url); runFetches++;
  }
  return { site_idx: s.site_idx, site_id: s.site_id, domain: d, candidates: s.candidates || [], sitemap, slug_matches: [...matched.values()], title_checks, fetches, notes };
});
const items = state.flatMap(st => st.fetches.map(url => ({ fetch: true, site_idx: st.site_idx, site_id: st.site_id, url })));
// the per-site state rides on the first item for Detect Published (the HTTP node only reads `url`)
return items.length ? items.map((it, i) => ({ json: i === 0 ? { ...it, sites: state } : it })) : [{ json: { skip: true, sites: state } }];
