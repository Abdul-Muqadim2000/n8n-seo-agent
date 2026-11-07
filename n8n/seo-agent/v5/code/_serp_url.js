// ---- SERP-GOTO (2026-11-08, R5 L-1): the real site behind a Google results-page redirect (SU) ----
// Since about 2026-11-05 DataForSEO's LIVE Google organic SERP answers every organic and local-pack item with `domain: "google.com"`,
// `url: "https://google.com/goto?url=CAES..."` (an opaque token nobody can decode), `main_domain` / `relative_url` null and `links[].url`
// wrapped the same way. Google started serving /goto links in August; on 2026-11-02 DataForSEO wrote that Google now throttles how many
// of them can be resolved per results page, so "High priority and Live requests resolve about half" (live probes of 2026-11-08 resolved
// none of 50). Standard-priority tasks (task_post + task_get, about 80 s) still come back with every real URL.
//   Read as it comes, every reader took google.com for the site: the Rank Tracker never found the client (13 of 14 rows of 2026-11-05
// held goto URLs), competitors became google.com, and no two keywords ever shared a result (each token is unique).
//   What survives is `breadcrumb` ("https://www.sage.com › en-ae › erp") and sometimes `website_name` (a host, a brand, or
// "Facebook · <page name>"). The rule, applied as early as possible (every DataForSEO answer node, the SERP cache, the rank kit):
//   * an item is a REDIRECT when its url is a Google redirect (google.<tld>/goto, /url, /search/url, /aclk; or Bing /ck/a) - a normal
//     google.com result (support.google.com/..., about.google/...) is NOT one and passes untouched;
//   * its host comes from the breadcrumb (the text before the first " › "), else from website_name when that is a host, else from a
//     known social network named before " · " ("Facebook · X" -> facebook.com); otherwise the item stays UNRESOLVED: domain null,
//     url null, never google.com;
//   * a recovered url is `https://<host>/<breadcrumb segments joined by "/">` - APPROXIMATE: Google's breadcrumb segments are often the
//     path ("› en-ae › erp") but sometimes page labels ("› Home › Blog"), and a long one is cut ("› best-erp-sof..."). Only a complete
//     breadcrumb of slug segments is a path (`url_path: 'path'`); a cut one, labels or the host alone say `url_partial: true` and the url
//     is then the host's home page (review 2026-11-08, M2);
//   * every rewritten item carries `url_exact: false`, `url_recovered` ('breadcrumb' | 'website_name' | 'social' | null) and the original
//     redirect in `redirect_url`; an item that was not a redirect is returned as the SAME object (old fixtures stay byte-identical).
// What a reader may do with an approximate url (the rule every reader follows):
//   * the SITE (host) is reliable: own-site rank detection matches by host, competitors are counted by host;
//   * the PAGE is not: own-page identification says "page not identified" (url ''), never a guessed page; a cited source needs an exact
//     url; clustering compares `SU.key()` - host + the complete slug path - which is the same for the same result on two pages read
//     the same way, marked `~` so it never equals an exact url key; a partial result has NO key (review H1: two posts of one blog must
//     not look like one page);
//   * own-site rank: -1 only when a result with no site could be ours (`couldBe`: our domain label in its name / title / breadcrumb).
// Regex only: the n8n Code sandbox has no URL constructor. `var` + the guard lets two kits that both inline SU share one copy.
var SU = (typeof SU === 'object' && SU && SU.v === 1) ? SU : (() => {
  const S = (x) => (x == null ? '' : String(x));
  const REDIR = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:google\.[a-z]{2,3}(?:\.[a-z]{2})?\/(?:goto|url|search\/url|aclk)(?=[?\/#]|$)|bing\.com\/ck\/a(?=[?\/#]|$))/i;
  const isRedirect = (u) => REDIR.test(S(u).trim());
  // R-H2 (review 2026-11-08): a host may be Unicode (Google shows IDNs as "müller.de") or punycode, its TLD too ("xn--mgbaam7a8h", the UAE)
  const HOST = /^(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:\p{L}{2,24}|xn--[a-z0-9-]{1,59})$/iu;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);   // R-L1: "constructor" is not a social network
  const SOCIAL = { facebook: 'facebook.com', linkedin: 'linkedin.com', youtube: 'youtube.com', instagram: 'instagram.com', x: 'x.com',
    twitter: 'x.com', reddit: 'reddit.com', quora: 'quora.com', tiktok: 'tiktok.com', medium: 'medium.com', pinterest: 'pinterest.com' };
  const bare = (h) => S(h).toLowerCase().replace(/^www\./, '');
  // R-H2: the scheme is optional ("en.wikipedia.org › wiki › ERP"); a first word with no dot ("3 reactions · 1 month ago") is not a host
  const crumbHost = (b) => { const m = S(b).trim().match(/^(?:https?:\/\/)?([^\/\s›]+)/i); const h = m && !/@/.test(m[1]) ? m[1].toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '') : ''; return HOST.test(h) ? h : ''; };
  // the breadcrumb's path segments, up to (not including) the first cut one; `cut` says whether one was cut
  // R-M2: a segment is a PATH segment only when it looks like a slug (lower case, no spaces); "› Home › Blog" are page labels, not a path
  const SLUG = /^[a-z0-9%._~-]+$/;
  const crumbPath = (b) => {
    const parts = S(b).split(/\s*›\s*/).slice(1).map(x => x.trim()).filter(Boolean); const segs = []; let cut = false, labels = false;
    for (const p of parts) { if (/^(?:\.\.\.|…)$/.test(p) || /(?:\.\.\.|…)$/.test(p)) { cut = true; break; } if (!SLUG.test(p)) labels = true; segs.push(p.replace(/\s+/g, '-').replace(/[?#]/g, '')); }
    return { segs, cut, labels };
  };
  // a redirect that CARRIES its target (google.com/url?q=https://..., ?url=https%3A...) is read as that target, exactly (FU-SV kept this
  // rule for the facts search); the /goto token is opaque, so this finds nothing there
  // R-L2: one host rule for a carried target; userinfo ("https://u:p@host") or no host at all is not a target, and nothing here can throw
  const hostOfUrl = (u) => { const m = S(u).match(/^https?:\/\/([^\/?#\s]+)/i); if (!m || /@/.test(m[1])) return ''; const h = m[1].toLowerCase().replace(/:\d+$/, ''); return HOST.test(h) ? h : ''; };
  const dec = (v) => { let x = S(v); for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(x); i++) { try { x = decodeURIComponent(x); } catch (e) { break; } } return x; };
  const carried = (u) => { const s = S(u).trim(); const q = s.indexOf('?'); if (q < 0) return '';
    for (const n of ['url', 'q', 'u']) for (const p of s.slice(q + 1).replace(/#.*$/, '').split('&')) { const e = p.indexOf('=');
      if (e > 0 && p.slice(0, e).toLowerCase() === n) { const t = dec(p.slice(e + 1)).trim(); if (/^https?:\/\/[^\s\/?#]+\.[^\s<>"]*$/i.test(t) && !isRedirect(t) && hostOfUrl(t)) return t; } }
    return ''; };
  const nameHost = (n) => { const s = S(n).trim().toLowerCase(); if (HOST.test(s)) return s;
    const brand = s.split(/\s*·\s*/)[0].trim(); return has(SOCIAL, brand) ? SOCIAL[brand] : ''; };
  // one item -> the same object when it is not a redirect, else a copy with the real host (or none)
  const fixItem = (it) => {
    if (!it || typeof it !== 'object' || !isRedirect(it.url)) return fixLinks(it);
    const tgt = carried(it.url); const th = tgt ? hostOfUrl(tgt) : '';
    if (tgt && th) { const h = th;
      return fixLinks({ ...it, domain: h, url: tgt, main_domain: bare(h), relative_url: (tgt.match(/^https?:\/\/[^\/?#]+(\/[^?#]*)?/i) || [])[1] || '/', url_recovered: 'redirect', redirect_url: S(it.url) }, true); }   // exact: no url_exact flag
    const ch = crumbHost(it.breadcrumb); const nh = ch ? '' : nameHost(it.website_name);
    const host = ch || nh;
    const how = ch ? 'breadcrumb' : (nh ? (HOST.test(S(it.website_name).trim()) ? 'website_name' : 'social') : null);
    // url_path: 'path' (slug segments, complete), 'labels' (page labels, not a path), 'cut' (Google cut it), 'none' (the host only)
    // url_partial: the PAGE is not known from the breadcrumb (anything but 'path'); its url is then the host's home page
    let url = null, rel = null, partial = true, pathKind = 'none';
    if (host) {
      const p = ch ? crumbPath(it.breadcrumb) : { segs: [], cut: false, labels: false };
      pathKind = p.cut ? 'cut' : p.labels ? 'labels' : p.segs.length ? 'path' : 'none';
      partial = pathKind !== 'path'; const segs = partial ? [] : p.segs;
      rel = '/' + segs.join('/'); url = 'https://' + host + (segs.length ? rel : '/');
    }
    const out = { ...it, domain: host || null, url, main_domain: host ? bare(host) : null, relative_url: rel, url_exact: false,
      url_recovered: how, url_partial: partial, url_path: host ? pathKind : null, redirect_url: S(it.url) };
    return fixLinks(out, true);
  };
  // links / nested items (AI Overview elements, sitelinks): a redirect url there is dropped (null), never kept as google.com
  const fixLinks = (it, copied) => {
    if (!it || typeof it !== 'object') return it;
    let o = it;
    for (const f of ['links', 'items', 'references']) {
      const arr = it[f]; if (!Array.isArray(arr)) continue;
      let changed = false;
      const next = arr.map(x => { if (!x || typeof x !== 'object') return x;
        if (f === 'items' && x.type && (x.type === 'organic' || x.breadcrumb != null)) { const y = fixItem(x); if (y !== x) changed = true; return y; }
        if (isRedirect(x.url)) { changed = true; return { ...x, url: null, domain: (x.domain && !/^(?:www\.)?google\./i.test(S(x.domain))) ? x.domain : null, url_exact: false, redirect_url: S(x.url) }; }
        const y = fixLinks(x); if (y !== x) changed = true; return y; });
      if (changed) { if (o === it && !copied) o = { ...it }; o[f] = next; }   // `copied`: `it` is already this kit's own copy
    }
    return o;
  };
  // a whole DataForSEO answer -> the same object when nothing was a redirect, else a copy (result[].items rewritten, counts on the result)
  const fixAnswer = (res) => {
    if (!res || typeof res !== 'object' || !Array.isArray(res.tasks)) return res;
    let changedAny = false;
    const tasks = res.tasks.map(t => {
      if (!t || !Array.isArray(t.result)) return t;
      let ch = false;
      const result = t.result.map(r => {
        if (!r || !Array.isArray(r.items)) return r;
        let n = 0, rec = 0, unres = 0;
        const items = r.items.map(x => { const y = fixItem(x); if (y !== x) { if (y && y.redirect_url && y.type) { n++; if (y.domain) rec++; else unres++; } } return y; });
        if (!items.some((y, i) => y !== r.items[i])) return r;
        ch = true; return { ...r, items, serp_url: { redirects: n, recovered: rec, unresolved: unres, rule: 'SU (v5/code/_serp_url.js): host from the breadcrumb, url approximate' } };
      });
      if (!ch) return t; changedAny = true; return { ...t, result };
    });
    return changedAny ? { ...res, tasks } : res;
  };
  const fixItems = (items) => (Array.isArray(items) ? items.map(fixItem) : items);
  const exact = (it) => !!it && it.url_exact !== false;
  const unresolved = (it) => !!it && it.url_exact === false && !it.domain;
  // a stored compact reading written before this fix: an item still holding a redirect url with no recovery on it
  const poisoned = (v) => !!v && Array.isArray(v.items) && v.items.some(x => x && (x.type === 'organic' || x.type === 'local_pack') && isRedirect(x.url) && x.url_exact !== false);
  // the clustering key of one result: an exact url as it is (no scheme, no www, no query, no trailing slash); an approximate one as
  // "~host/segments" in lower case (the same result read on two pages gives the same key; it is never equal to an exact key)
  const urlKey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  // R-H1 (review 2026-11-08): only a COMPLETE slug path is a key. A cut, label or host-only breadcrumb has NO key ('') - two different
  // posts of one blog would otherwise share "~host/…" and merge two searches that share no page; with no key such a result neither
  // matches nor counts towards the minimum a results page needs to be compared (Ladder Clusters: "too few to compare")
  const key = (it) => { if (!it) return ''; if (exact(it)) return urlKey(it.url || it.domain);
    if (!it.domain || it.url_partial || !it.relative_url || it.relative_url === '/') return ''; return '~' + urlKey(S(it.domain) + it.relative_url); };
  // R-H2: could this unresolved result be the site's own? Its visible name, title or breadcrumb carries the site's own label
  // ("techand" for techand.ai, "gear up" for gear-up.ae), in any case and spacing
  const flat = (v) => S(v).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const labelOf = (d) => flat(bare(S(d)).replace(/^https?:\/\//, '').split('/')[0].split('.')[0]);
  const couldBe = (it, domain) => { const l = labelOf(domain); if (!it || l.length < 4) return false;
    return [it.website_name, it.title, it.breadcrumb].some(v => flat(v).includes(l)); };
  return { v: 1, REDIR, HOST, isRedirect, carried, hostOfUrl, couldBe, labelOf, fixItem, fixItems, fixAnswer, exact, unresolved, poisoned, key, urlKey, crumbHost, crumbPath, nameHost };
})();
