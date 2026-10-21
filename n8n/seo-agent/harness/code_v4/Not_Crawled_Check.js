// B5-5 (2026-10-15, benchmark area 5 — BENCH_AREA5_technical_audit.md §5(a) a5): what the known URLs the crawl never reached
// actually answer. One free plain GET each (*Fetch Not Crawled*, redirects NOT followed, so a redirect is itself the answer), read
// with the same parser the rest of the audit uses: status, the address it redirects to, `noindex` (meta or X-Robots-Tag), the
// canonical it names, and its title.
// The rule this node exists to keep: **a page we could not fetch is reported as not fetched, with the reason — never as a finding.**
// This audit once shipped seven findings with an empty evidence string; a new check that cannot say what it saw is worse than no
// check. So a timeout, a DNS failure and a bot wall are all `not_fetched`, counted apart and named, and every count below says how
// many of how many it was measured on (`checked` / `checked_of`).
// Nothing here can fail the audit, and nothing here costs anything.
// RV-1 / RV-2 (2026-10-21, pre-launch run on techand.ai): a redirect is followed to its end (*Not Crawled Hops -> Fetch Not Crawled (Final)*).
// The bare host 308s to www and www answers 404 for 34 old addresses Google still shows; they were filed as Low "redirect somewhere else"
// with the evidence "/x -> /x (308)". An address that ends in 404 / 410 is GONE, wherever the redirects led, and every gone address is one
// finding with the redirect each needs (v5/code/_gone.js, the same words in every report). The earlier Search Console findings stop
// advising on them ("add them to the sitemap", "rewrite the titles"), and a complete crawl is not called a crawl limit.
// ---- RV-1 (2026-10-21, pre-launch run on techand.ai): PAGES THAT ARE GONE, ONE MESSAGE EVERYWHERE (inlined where a node asks for the GONE kit marker) ----
// The site was rebuilt: Search Console still showed ~34 old addresses (2-3k of 5.7k impressions) that answer 404 (the bare host 308s to
// www, which 404s) and nothing redirects them. The audit filed some as "redirect somewhere else" (Low), the weekly site report told the
// owner to make one of them "the single page" for a search, the AI visibility brief said "build on your existing D365 pages" and AI
// Growth sent them to Bing. The first thing the owner has to hear is one sentence: these addresses are gone, redirect each to this page.
// This kit holds that sentence, the suggested target of each redirect and the redirect files, so every report says the same thing:
//   GONE.isGone(status)            404 / 410 after following redirects (a bot wall, a timeout or a 5xx is NOT gone: not known)
//   GONE.plan(dead, live, home)    [{ from_url, from, to, to_url, status, impressions, clicks, match }] most impressions first
//   GONE.finding(plan, o)          the audit finding (one title, one fix) with the full list in `redirects`
//   GONE.action(plan)              the weekly / AI report action (priority 1)
//   GONE.files(plan, today)        { csv, nginx, htaccess } for the fix pack
//   GONE.keyOf(u) / GONE.drop(list, set, pick)   host-agnostic address key, and "leave the gone addresses out of this list"
// Customer text: plain words, no dashes used as punctuation, no ellipsis.
const GONE = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const isGone = (st) => { const n = n0(st); return n === 404 || n === 410; };
  const keyOf = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const pathOf = (u) => S(u).replace(/^https?:\/\/[^\/]+/i, '').replace(/[?#].*$/, '').replace(/(.)\/+$/, '$1') || '/';
  const fmt = (v) => n0(v).toLocaleString('en-GB');
  // words that say nothing about which page an old address was about (places, filler, the generic page words of every site)
  const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'your', 'our', 'what', 'how', 'why', 'who', 'are', 'you', 'its', 'into', 'about', 'uae', 'dubai', 'abu', 'dhabi',
    'sharjah', 'emirates', 'united', 'arab', 'html', 'htm', 'php', 'aspx', 'page', 'pages', 'index', 'www', 'com', 'new', 'best', 'top', 'guide', 'complete', 'every', 'must']);
  const stem = (t) => t.length >= 5 ? t.replace(/(ations?|ings?|ants?|ers?)$/, '').replace(/s$/, '').replace(/e$/, '') : t;   // services = service, operations = operation
  const words = (s) => [...new Set(S(s).toLowerCase().replace(/&/g, ' and ').split(/[^a-z0-9]+/).filter(t => t.length > 2 && !STOP.has(t)).map(stem))];
  // the closest live page: the one sharing the most specific words with the old address (a word most live pages carry counts for little);
  // without one, the section page the old address sat under when that page is live, else the home page, and the match says which it was
  const plan = (dead, live, home) => {
    const deadKeys = new Set((Array.isArray(dead) ? dead : []).map(d => keyOf(d.url || d.from_url)));
    const L = (Array.isArray(live) ? live : []).map(p => ({ url: S(p.url), path: pathOf(p.url), title: S(p.title || p.h1), status: p.status != null ? p.status : p.http_status }))
      .filter(p => p.url && !isGone(p.status) && !deadKeys.has(keyOf(p.url)));
    const homeUrl = S(home) || (L.find(p => p.path === '/') || {}).url || '/';
    const docs = L.filter(p => p.path !== '/').map(p => ({ p, w: new Set([...words(p.path.replace(/[\/_-]+/g, ' ')), ...words(p.title)]) }));
    const df = new Map(); for (const d of docs) for (const w of d.w) df.set(w, (df.get(w) || 0) + 1);
    const idf = (w) => Math.log(1 + (docs.length + 1) / (1 + (df.get(w) || 0)));
    const seen = new Set(); const out = [];
    for (const d0 of (Array.isArray(dead) ? dead : [])) {
      const url = S(d0.url || d0.from_url); const k = keyOf(url); if (!url || seen.has(k)) continue; seen.add(k);
      const path = pathOf(url); const want = words(path.replace(/[\/_-]+/g, ' '));
      let best = null;
      for (const d of docs) { const shared = want.filter(w => d.w.has(w)); if (!shared.length) continue;
        const score = shared.reduce((s, w) => s + idf(w), 0);
        if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && d.p.path.length < best.p.path.length)) best = { p: d.p, score, shared }; }
      const strong = best && (best.shared.length >= 2 || best.score >= 1.2);
      const parent = path.split('/').filter(Boolean).slice(0, -1).join('/');
      const section = parent ? L.find(p => p.path === '/' + parent) : null;
      const to = strong ? best.p : section || null;
      out.push({ from_url: url, from: path, to_url: to ? to.url : homeUrl, to: to ? to.path : '/', status: n0(d0.status || d0.http_status), impressions: n0(d0.impressions), clicks: n0(d0.clicks),
        match: strong ? 'same topic (shares "' + best.shared.slice(0, 3).join('", "') + '")' : section ? 'its section page' : 'home page (no live page matches it by name: use a better page if you have one)' });
    }
    return out.sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks || a.from.localeCompare(b.from));
  };
  const totals = (pl) => (pl || []).reduce((t, r) => ({ impressions: t.impressions + n0(r.impressions), clicks: t.clicks + n0(r.clicks) }), { impressions: 0, clicks: 0 });
  const line = (r) => r.from + (r.impressions ? ' (' + fmt(r.impressions) + ' impressions)' : '') + ' to ' + r.to;
  const TITLE = 'Pages Google still shows no longer answer: redirect them';
  const TITLE_UNSEEN = 'Known URLs outside the crawl no longer answer';
  const FIX = 'Add a permanent (301) redirect from each old address to the page suggested for it (redirects.csv in the fix pack lists every one, with nginx and Apache versions; use a better page where you have one), then take the old addresses out of the sitemap and the internal links.';
  // the audit finding: one title and one fix wherever a gone page is found; `o.note` is the sample the reading came from
  const finding = (pl, o) => {
    const x = o || {}; const t = totals(pl); const seen = (pl || []).filter(r => r.impressions > 0 || r.clicks > 0);
    const codes = [...new Set((pl || []).map(r => r.status).filter(Boolean))].map(c => 'HTTP ' + c).join(' / ') || 'HTTP 404';
    return { category: 'Crawlability & Indexing', severity: seen.length ? 'High' : 'Medium', title: seen.length ? TITLE : TITLE_UNSEEN,
      evidence: (pl || []).length + ' address(es) answer ' + codes + (x.via_redirect ? ' (' + x.via_redirect + ' of them only after a redirect to the main host)' : '') + ': '
        + (pl || []).slice(0, 5).map(r => r.from + ': HTTP ' + (r.status || 404) + (r.impressions ? ', ' + fmt(r.impressions) + ' impressions' : '')).join('; ')
        + ((pl || []).length > 5 ? '; and ' + ((pl || []).length - 5) + ' more' : '') + (x.note ? '. ' + x.note : '')
        + (seen.length ? '; ' + seen.length + ' of them still earn impressions in Search Console (' + fmt(t.impressions) + ' impressions and ' + fmt(t.clicks) + ' clicks in the last 28 days)' : ''),
      why: seen.length ? 'Google still shows these addresses in search, and every visitor who clicks them, and every link that points at them, lands on an error page. Until they redirect, the visibility they earned is lost, and Google drops them one by one.'
        : 'These addresses are in your sitemap or were known before, but they return an error. Visitors and crawlers that follow them hit a dead end, and the link value pointing at them is lost.',
      fix: FIX, sample_urls: (pl || []).slice(0, 5).map(r => r.from_url), affected_urls: (pl || []).slice(0, 200).map(r => r.from_url), affected_count: (pl || []).length || null,
      scope: 'page', scoring: true, source: x.source || 'gone', figure: '', redirects: (pl || []).slice(0, 200) };
  };
  const action = (pl) => { const t = totals(pl); if (!(pl || []).length) return null;
    return { priority: 1, type: 'redirect_gone', keyword: '', url: (pl[0] || {}).from_url || '',
      action: 'Redirect the ' + pl.length + ' old address(es) that now answer 404 (301 to the closest live page): ' + pl.slice(0, 4).map(line).join('; ') + (pl.length > 4 ? '; and ' + (pl.length - 4) + ' more' : '') + '.',
      why: 'Google still shows them (' + fmt(t.impressions) + ' impressions and ' + fmt(t.clicks) + ' clicks in the last 28 days), and every visit and every link to them ends on an error page. Do not work on these pages: they no longer exist.',
      redirects: pl.slice(0, 60) }; };
  const q = (v) => '"' + S(v).replace(/"/g, '""') + '"';
  const files = (pl, today) => { const L = (pl || []).filter(r => r.from && r.to && r.from !== r.to); if (!L.length) return null; const d = S(today) || new Date().toISOString().slice(0, 10);
    return { count: L.length,
      csv: 'from,to,http_status_now,impressions_28d,match\n' + L.map(r => [r.from, r.to, r.status || 404, r.impressions, r.match].map(q).join(',')).join('\n') + '\n',
      nginx: '# 301 redirects for addresses that no longer answer, found by the SEO audit on ' + d + '\n' + L.map(r => 'location = ' + r.from + ' { return 301 ' + r.to + '; }').join('\n') + '\n',
      htaccess: '# 301 redirects for addresses that no longer answer, found by the SEO audit on ' + d + '\n' + L.map(r => 'Redirect 301 ' + r.from + ' ' + r.to).join('\n') + '\n' }; };
  // leave the gone addresses out of a list (pick reads the address from an entry); returns { kept, dropped }
  const drop = (list, set, pick) => { const kept = [], dropped = []; const get = pick || ((x) => (x && typeof x === 'object') ? (x.url || x.page || x.u) : x);
    for (const x of (Array.isArray(list) ? list : [])) (set && set.has(keyOf(get(x))) ? dropped : kept).push(x); return { kept, dropped }; };
  return { isGone, keyOf, pathOf, plan, finding, action, files, drop, totals, TITLE, TITLE_UNSEEN, FIX };
})();
let prev = {};
try { prev = $('Render Diff').first().json || {}; } catch (e) {}
if (!prev.probe) { try { const i = $input.first().json || {}; if (i.probe || i.skip) prev = i; } catch (e2) {} }

let reqs = [];
try { reqs = $('Not Crawled Targets').all().map(i => i.json || {}); } catch (e) {}
let res = [];
try { res = $('Fetch Not Crawled').all().map(i => i.json || {}); } catch (e) {}
// the end of each redirect: the same address asked again with the redirects followed (paired by position with the hop list)
let hopReq = [], hopRes = [];
try { hopReq = $('Not Crawled Hops').all().map(i => i.json || {}).filter(h => h && h.url && !h.no_hops); } catch (e) {}
try { hopRes = $('Fetch Not Crawled (Final)').all().map(i => i.json || {}); } catch (e) {}

const S = (v) => String(v == null ? '' : v).trim();
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pathOf = (u) => S(u).replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '') || '/';
const bodyOf = (r) => { const b = r && (r.body != null ? r.body : r.data); return typeof b === 'string' ? b : (b ? String(b) : ''); };
const headerOf = (r, name) => { const h = (r && r.headers) || {}; const k = Object.keys(h).find(x => String(x).toLowerCase() === name); const v = k ? h[k] : ''; return S(Array.isArray(v) ? v.join(', ') : v); };
// host-agnostic: a crawl reports www. while a canonical may use the bare host, and that is not a mismatch (D15 / G14)
const ukey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '');
const sameUrl = (a, b) => !!ukey(a) && ukey(a) === ukey(b);
const finalOf = new Map(); hopReq.forEach((h, i) => { const r = hopRes[i] || {}; const st = n0(r.statusCode != null ? r.statusCode : r.status); if (st) finalOf.set(ukey(h.url), st); });
const attr = (tag, name) => { const m = S(tag).match(new RegExp(name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? S(m[2] || m[3] || m[4]) : ''; };

const targets = reqs.filter(r => r && r.url && !r.skip);
const planned = (reqs.find(r => r && r.not_crawled_plan) || {}).not_crawled_plan || null;
const skipped = reqs.find(r => r && r.skip) || null;

const findings = [];
const works = [];
const F = (severity, title, evidence, why, fix, urls, pct, scoring) => findings.push({ category: 'Crawlability & Indexing', severity, title, evidence, why, fix,
  sample_urls: (urls || []).slice(0, 5), affected_count: (urls || []).length || null, affected_pct: pct == null ? null : Math.max(1, Math.min(100, Math.round(pct))),
  affected_of: pct == null ? null : checked.length, affected_unit: 'known URLs read outside the crawl',   // R72: the share is of the URLs read, not of the crawl
  scope: 'page', scoring: scoring !== false, source: 'not_crawled', figure: '' });

// ---- read every answer (paired by position: the fetch node keeps one answer per request) ----
const pages = targets.map((t, i) => {
  const r = res[i] || {};
  const out = { url: S(t.url), path: pathOf(t.url), source: S(t.source), impressions: n0(t.impressions), clicks: n0(t.clicks),
    changed_at: S(t.changed_at), changed_label: S(t.changed_label),
    checked: false, not_checked: '', status: 0, state: '', redirect_to: '', noindex: false, canonical: '', title: '' };
  const status = n0(r.statusCode != null ? r.statusCode : r.status);
  const errText = r && r.error ? S((r.error.message || r.error.description || r.error)).slice(0, 160) : '';
  if (!status) { out.not_checked = errText ? 'the request failed: ' + errText : 'the page gave no answer (timeout or no connection)'; return out; }
  out.status = status;
  if (status === 401 || status === 403 || status === 429) {
    out.not_checked = 'the server refused our request (HTTP ' + status + '): a bot wall or a rate limit, which says nothing about the page itself';
    return out;
  }
  out.checked = true;
  if (status >= 300 && status < 400) { out.redirect_to = headerOf(r, 'location'); out.state = 'redirect';
    // RV-2: where the redirect ends decides what the address is. Ending in 404 / 410 it is gone; in another error it is an error; in a
    // page it is a working redirect. Not followed (no answer) it stays "redirect", as it was before.
    const fin = finalOf.get(ukey(t.url)) || 0; out.final_status = fin; out.first_status = status;
    out.host_only = !!out.redirect_to && ukey(out.redirect_to) === ukey(t.url);
    if (GONE.isGone(fin)) { out.state = 'gone'; out.status = fin; out.via_redirect = true; }
    else if (fin >= 400 && fin !== 401 && fin !== 403 && fin !== 429) { out.state = 'error'; out.status = fin; out.via_redirect = true; }
    return out; }
  if (status === 404 || status === 410) { out.state = 'gone'; return out; }
  if (status >= 400) { out.state = 'error'; return out; }
  const html = bodyOf(r);
  const xrobots = headerOf(r, 'x-robots-tag');
  const metaRobots = (html.match(/<meta[^>]+>/gi) || []).filter(t2 => /name\s*=\s*["']?(robots|googlebot)["']?/i.test(t2)).map(t2 => attr(t2, 'content')).join(', ');
  out.noindex = /\bnoindex\b/i.test(xrobots) || /\bnoindex\b/i.test(metaRobots);
  out.robots_rule = S([metaRobots, xrobots].filter(Boolean).join(' / ')).slice(0, 120);
  const canonTag = (html.match(/<link[^>]+>/gi) || []).find(t2 => /rel\s*=\s*["']?canonical["']?/i.test(t2)) || '';
  out.canonical = canonTag ? attr(canonTag, 'href') : '';
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  out.title = titleM ? S(titleM[1].replace(/\s+/g, ' ')).slice(0, 160) : '';
  out.state = out.noindex ? 'noindex'
    : (out.canonical && !sameUrl(out.canonical, out.url)) ? 'canonical_elsewhere'
      : 'live';
  return out;
});

const checked = pages.filter(p => p.checked);
const notChecked = pages.filter(p => !p.checked);
const by = (st) => checked.filter(p => p.state === st);
const states = {};
for (const p of checked) states[p.state] = (states[p.state] || 0) + 1;
const share = (n) => checked.length ? (n / checked.length) * 100 : null;
const seen = (list) => list.filter(p => p.impressions > 0);
const totalNotCrawled = planned ? n0(planned.not_crawled_total) : targets.length;
const sampleNote = checked.length
  ? checked.length + ' of the ' + (totalNotCrawled || checked.length) + ' known URL(s) the crawl never reached were read'
    + (notChecked.length ? ', ' + notChecked.length + ' more could not be read' : '')
  : 'none of the known URLs the crawl never reached could be read';

const available = checked.length > 0;
// RV-1: the live pages the crawl read (redirect targets for the gone addresses) and whether the crawl finished under its limit
const crawlComplete = !!(((prev.site_structure || {}).crawl_coverage || {}).crawl_complete === true);
let livePages = [];
try { livePages = (($('Get Crawled Pages').first().json || {}).tasks?.[0]?.result?.[0]?.items || [])
  .filter(p => p && p.resource_type === 'html' && Number(p.status_code) === 200).map(p => ({ url: p.url, title: (((p.meta || {}).htags || {}).h1 || [])[0] || (p.meta || {}).title || '' })); } catch (e) {}
livePages = [...livePages, ...by('live').map(p => ({ url: p.url, title: p.title }))];
const homeUrl = (livePages.find(p => pathOf(p.url) === '/') || {}).url || '';
let redirectPlan = [];
const not_available = available ? '' : (!planned && skipped) ? S(skipped.reason)
  : notChecked.length ? 'none of the ' + notChecked.length + ' URL(s) tried could be read: ' + [...new Set(notChecked.map(p => p.not_checked))].slice(0, 2).join('; ')
    : 'no known URL outside the crawl was read in this run';

if (available) {
  const gone = by('gone'), errs = by('error');
  const dead = [...gone, ...errs];
  if (gone.length) {
    // RV-1: ONE finding for every gone address, with the page each one should redirect to (the crawl's live pages are the candidates)
    redirectPlan = GONE.plan(gone.map(p => ({ url: p.url, status: p.status, impressions: p.impressions, clicks: p.clicks })), livePages, homeUrl);
    const viaR = gone.filter(p => p.via_redirect).length;
    findings.push({ ...GONE.finding(redirectPlan, { note: sampleNote, via_redirect: viaR, source: 'not_crawled' }),
      affected_pct: Math.max(1, Math.min(100, Math.round(share(gone.length)))), affected_of: checked.length, affected_unit: 'known URLs read outside the crawl' });
  }
  if (errs.length) {
    const hurt = seen(errs);
    F(hurt.length ? 'High' : 'Medium', 'Known URLs outside the crawl answer with a server error',
      errs.slice(0, 5).map(p => p.path + ': HTTP ' + p.status).join('; ') + '. ' + sampleNote
        + (hurt.length ? '; ' + hurt.length + ' of them still earn impressions in Search Console' : ''),
      'These addresses are in your sitemap or Google still shows them, but they return an error. Visitors and crawlers that follow them hit a dead end, and the link value pointing at them is lost.',
      'Fix the error, or restore each page or 301-redirect it to the closest live page, then remove the address from the sitemap.',
      errs.map(p => p.url), share(errs.length));
  }
  const live = by('live');
  if (live.length) {
    F('Medium', 'Live, indexable pages the crawl never reached',
      live.length + ' of the ' + checked.length + ' URL(s) read answer 200 and are indexable, and this audit judged nothing about them: '
        + live.slice(0, 4).map(p => p.path).join(', ') + (live.length > 4 ? ' …' : '') + '. ' + sampleNote + '.',
      'Every share and count in this report is a share of the pages that were crawled. These pages exist and can rank, but no finding here covers them — the crawl stopped before it reached them, or nothing on the site links to them.',
      crawlComplete ? 'Link to them from the pages that already rank: the crawl finished under its limit, so no internal link leads to them (the crawler follows links, and so do visitors).'
        : 'Raise the crawl limit for this site so the next audit covers them, and link to them from the pages that already rank (the crawler follows links, and so do visitors).',
      live.map(p => p.url), share(live.length));
  }
  const noidx = by('noindex');
  if (noidx.length) {
    const hurt = seen(noidx);
    F(hurt.length ? 'Medium' : 'Low', 'Known URLs outside the crawl are set to noindex',
      noidx.slice(0, 5).map(p => p.path + (p.robots_rule ? ' (' + p.robots_rule + ')' : '')).join(' · ') + ' — ' + sampleNote
        + (hurt.length ? '; ' + hurt.length + ' of them still earn impressions' : ''),
      'A page marked noindex cannot rank. When it is in the sitemap as well, the sitemap is telling Google to index exactly what the page tells it not to.',
      'Decide which it is: remove the noindex if the page should rank, or take it out of the sitemap if it should not.',
      noidx.map(p => p.url), share(noidx.length));
  }
  const redir = by('redirect');
  if (redir.length) {
    F('Low', 'Known URLs outside the crawl redirect somewhere else',
      redir.slice(0, 5).map(p => p.path + ' to ' + (p.host_only ? 'the same address on the main host' : (pathOf(p.redirect_to) || p.redirect_to || 'an unnamed address')) + ' (' + p.status + (p.final_status ? ', ends in ' + p.final_status : '') + ')').join('; ') + '. ' + sampleNote,
      'A redirected address in the sitemap wastes crawl budget and makes the sitemap less trustworthy; Google is told to fetch a URL that is not the real one.',
      'List only the final 200-status addresses in the sitemap.',
      redir.map(p => p.url), share(redir.length));
  }
  const canon = by('canonical_elsewhere');
  if (canon.length) {
    F('Low', 'Known URLs outside the crawl point their canonical at another page',
      canon.slice(0, 5).map(p => p.path + ' → ' + (pathOf(p.canonical) || p.canonical)).join(' · ') + ' — ' + sampleNote,
      'These pages answer 200 but tell Google that another page is the real one, so they will not rank on their own.',
      'Leave them out of the sitemap, or make each one distinct and set its canonical to itself.',
      canon.map(p => p.url), share(canon.length));
  }
  if (!dead.length && !noidx.length && !redir.length && !canon.length) {
    works.push('Every one of the ' + checked.length + ' known URL(s) read outside the crawl answers 200 and is indexable — the gap in the crawl is a crawl limit, not a broken part of the site');
  }
}
// a page we could not fetch is NEVER a finding about the page: it is counted, named and left alone
if (notChecked.length) {
  F('Info', notChecked.length + ' known URL(s) outside the crawl could not be read',
    notChecked.slice(0, 4).map(p => p.path + ': ' + p.not_checked).join(' · '),
    'A request that failed says nothing about the page. It is reported as not read rather than as a problem, and nothing in this report counts it.',
    notChecked.some(p => /refused|bot wall|rate limit/i.test(p.not_checked))
      ? 'Allow our checker through the bot protection if you want these addresses judged; otherwise nothing to do.'
      : 'Nothing to do if the address answers for visitors; the next audit tries again.',
    notChecked.map(p => p.url), null, false);
}

const not_crawled_check = {
  available, not_available,
  checked: checked.length, checked_of: targets.length, not_checked: notChecked.length,
  not_crawled_total: totalNotCrawled || null,
  known_urls: planned ? planned.known_urls : null, coverage_pct: planned ? planned.coverage_pct : null, cap: planned ? planned.cap : null,
  states, order_note: planned ? S(planned.order_note) : '', changed_first: planned ? n0(planned.changed_first) : 0,
  changed: planned ? planned.changed : null,
  method: planned ? S(planned.method) : 'Up to 25 of the known URLs the crawl never reached are read with one free plain GET each (status, redirect, robots rule, canonical, title).',
  basis: available
    ? 'measured: ' + sampleNote + '. Each one was read with a single plain GET, '
      + (planned && planned.changed && planned.changed.read && n0(planned.changed_first) ? 'the pages we submitted or wrote this week first, then ' : '') + 'the pages Google shows most often'
    : 'not available: ' + not_available,
  pages: pages.slice(0, 25).map(p => ({ url: p.url, path: p.path, source: p.source, status: p.status, state: p.state, checked: p.checked,
    not_checked: p.not_checked, redirect_to: p.redirect_to, canonical: p.canonical, title: p.title, noindex: p.noindex,
    impressions: p.impressions, changed_at: p.changed_at, changed_label: p.changed_label, final_status: p.final_status || 0, via_redirect: !!p.via_redirect })),
  // RV-1: the gone addresses and the page each should redirect to (the fix pack writes redirects.csv from it)
  gone: by('gone').length, redirects: redirectPlan.slice(0, 200),
};

// ---- RV-3 / RV-5: the Search Console findings made before the addresses were read stop advising on the gone ones ----
// "Add them to the sitemap" and "rewrite the titles" for pages that answer 404 are work on pages that no longer exist; the gone ones move
// to the redirect finding. The coverage line called a complete crawl a crawl limit when every address it missed is gone or redirects.
const goneKeys = new Set(by('gone').map(p => ukey(p.url)));
const RECONCILE = { 'Pages Google shows in search are missing from the sitemap': { min: 3, unit: 'page(s) with impressions are not in sitemap.xml' },
  'Pages shown in Google but never clicked': { min: 1, unit: 'page(s) with 50+ impressions and 0 clicks in 28 days' } };
const earlier = [];
for (const f of (prev.extra_findings || [])) {
  const rule = f && RECONCILE[f.title];
  if (rule && goneKeys.size && Array.isArray(f.urls_all) && f.urls_all.length) {
    const keep = f.urls_all.filter(u => !goneKeys.has(ukey(u))); const moved = f.urls_all.length - keep.length;
    if (!moved) { earlier.push(f); continue; }
    if (keep.length < rule.min) continue;   // what is left is not worth the finding: the gone pages are in the redirect finding
    earlier.push({ ...f, urls_all: keep, sample_urls: keep.slice(0, 5), affected_count: keep.length,
      evidence: keep.length + ' ' + rule.unit + ' (' + moved + ' more no longer answer and are in the redirect finding, not here)' });
    continue;
  }
  if (f && f.title === 'The crawl covered only part of the site' && crawlComplete && available && checked.length) {
    const explained = checked.filter(p => p.state === 'gone' || p.state === 'redirect').length;
    if (explained === checked.length && checked.length >= Math.ceil(0.8 * (totalNotCrawled || checked.length))) {
      earlier.push({ ...f, severity: 'Info', scoring: false, title: 'The crawl reached every page that still answers',
        evidence: S(f.evidence).split(';')[0] + '; the crawl finished under its limit, and every one of the ' + checked.length + ' known URL(s) it did not reach that could be read no longer answers or redirects elsewhere (' + sampleNote + ')',
        why: 'The addresses the crawl missed are old ones, not pages it failed to reach: there is no crawl limit to raise.',
        fix: 'Nothing to raise. Redirect the addresses that no longer answer (see that finding).' });
      continue;
    }
  }
  earlier.push(f);
}

return [{ json: { ...prev, skip: undefined, not_crawled_check,
  extra_findings: [...earlier, ...findings],
  extra_works: [...(prev.extra_works || []), ...works] } }];
