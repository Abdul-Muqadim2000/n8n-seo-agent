// Fix pack for every audit: ready-to-deploy files built from the audit's own data — robots.txt (current rules kept, sitemap line, AI search
// crawlers allowed, blocking "Disallow: /" removed for search engines), llms.txt (site summary + key pages by section), a redirect map for broken
// pages (CSV + nginx + Apache), Organization / LocalBusiness / WebSite schema from the business profile, Google Business Profile and homepage,
// internal links to add (CSV) and a README. Files are binaries (zipped by the next node for the e-mail) and plain text in fix_pack for the API.
// RV-1 (2026-10-21): the redirect map also carries every known address that no longer answers (the not-crawled check's gone list, with the
// page suggested for each), and the crawl's broken pages are read from every item (DataForSEO files a 404 under resource_type "broken",
// so the html-only list never held one and the README promised redirects that were not in the pack).
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
const d = $('Audit Diff').first().json; const a = d.site_audit || {};
const base = $('Check Crawl').first().json; const domain = base.domain;
const m = a.measurements || {}; const host = m.canonical_host || domain; const home = 'https://' + host + '/';
const crawlItems = ($('Get Crawled Pages Answers').first().json.tasks?.[0]?.result?.[0]?.items || []).filter(p => p && p.url);
const pages = crawlItems.filter(p => p.resource_type === 'html');
const E = a.entity || {}; const P = (() => { try { return $('Load Profile (Audit)').all().map(i => i.json).find(x => x && x.site_id === d.site_id) || {}; } catch (e) { return {}; } })();
const pathOf = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/i, '') || '/';
const files = [];
const add = (name, prop, mime, purpose, content) => files.push({ name, prop, mime, purpose, content });
const today = new Date().toISOString().slice(0, 10);
// ---- robots.txt (D17, 2026-10-11: the live file is EDITED, never rebuilt around an "Allow: /" group — a crawler named in its own group ignores
// the * group, so an allow-only group for the AI search bots opened /api/, /admin/ and /private/ to them) ----
// Rules: a site-wide "Disallow: /" for * is removed; an AI search crawler that a group blocks gets its own group WITH the * group's path rules
// copied in; a missing Sitemap line is added; anything else stays as it is. No change needed = the live file back, with a comment on top.
const cur = String(m.robots_txt || '').replace(/\r/g, '');
const AI_SEARCH = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User'];
const TRAINING = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot'];
const isAiSearch = (agent) => AI_SEARCH.some(b => b.toLowerCase() === String(agent).trim().toLowerCase());
const isUA = (line) => /^\s*user-agent\s*:/i.test(line);
const blocks = []; let grp = null, prevUA = false;   // a group = its consecutive User-agent lines + the rules until the next group (the old split cut multi-agent groups apart)
for (const line of (cur ? cur.split('\n') : [])) { const ua = isUA(line); if (ua && !prevUA) { grp = []; blocks.push(grp); } if (!grp) { grp = []; blocks.push(grp); } grp.push(line); prevUA = ua || (prevUA && !line.trim()); }
const agentsOf = (b) => b.filter(isUA).map(x => x.split(':').slice(1).join(':').trim());
const rulesOf = (b) => b.filter(l => !isUA(l)).map(l => l.trim()).filter(l => l && !/^#/.test(l) && !/^\s*sitemap\s*:/i.test(l));
const blocksAll = (b) => b.some(l => /^\s*disallow\s*:\s*\/\s*$/i.test(l));
const star = blocks.find(b => agentsOf(b).includes('*'));
const starRules = star ? rulesOf(star).filter(l => /^(dis)?allow\s*:/i.test(l) && !/^disallow\s*:\s*\/\s*$/i.test(l)) : [];   // the * group's path rules (crawl-delay, host etc. stay with *)
const changes = []; const keep = []; const freed = [];
for (const b of blocks) { const agents = agentsOf(b); const text = b.join('\n');
  if (!agents.length) { if (!/^\s*sitemap\s*:/im.test(text) || b.some(l => l.trim() && !/^\s*(sitemap\s*:|#)/i.test(l))) keep.push(text.replace(/^\s*sitemap\s*:.*$/gim, '').trim()); continue; }   // lines before the first group (comments, Host); sitemap lines are re-added at the end
  if (blocksAll(b) && agents.includes('*')) { keep.push(text.replace(/^\s*disallow\s*:\s*\/\s*$/gim, '# Disallow: /   <- removed: it blocked every search engine').trim()); changes.push('removed "Disallow: /" for all crawlers'); continue; }
  const blockedAi = blocksAll(b) ? agents.filter(isAiSearch) : [];
  if (!blockedAi.length) { keep.push(text.replace(/^\s*sitemap\s*:.*$/gim, '').trim()); continue; }
  freed.push(...blockedAi);
  const rest = agents.filter(x => !isAiSearch(x));
  if (rest.length) keep.push(rest.map(x => 'User-agent: ' + x).join('\n') + '\n' + b.filter(l => !isUA(l)).join('\n').replace(/^\s*sitemap\s*:.*$/gim, '').trim());   // the other crawlers of that group keep their rules (training bots stay blocked)
}
const freedList = [...new Set(freed)];
if (freedList.length) changes.push('AI search crawler(s) ' + freedList.join(', ') + ' were blocked: they now get the same rules as every other crawler (' + (starRules.length ? starRules.length + ' path rule(s) copied from User-agent: *' : 'no path restrictions') + ')');
const sitemapLines = [...new Set((cur.match(/^\s*sitemap\s*:\s*(\S+)/gim) || []).map(x => x.split(/:\s*/).slice(1).join(':').trim()))];
if (!cur) changes.push('created robots.txt (the site has none)');
if (!sitemapLines.length) { sitemapLines.push(home + 'sitemap.xml'); if (cur) changes.push('added the Sitemap line'); }
const header = '# robots.txt for ' + host + ' — reviewed by the SEO audit on ' + today + '\n# Changes: ' + (changes.length ? changes.join('; ') : 'none needed') + '\n\n';
const aiGroup = freedList.length ? '# AI search crawlers: they fetch a page when a user asks, so your pages can be cited in ChatGPT, Perplexity and Claude answers.\n# They get the same path rules as User-agent: * (a crawler named in its own group ignores the * group).\n' + freedList.map(b => 'User-agent: ' + b).join('\n') + '\n' + (starRules.length ? starRules.join('\n') : 'Allow: /') + '\n\n' : '';
const robots = changes.length
  ? header + (keep.filter(Boolean).length ? keep.filter(Boolean).join('\n\n') + '\n\n' : 'User-agent: *\nAllow: /\n\n') + aiGroup + '# AI training crawlers (' + TRAINING.join(', ') + ') are left as they were. To opt out of model training, add:\n# User-agent: GPTBot\n# Disallow: /\n\n' + sitemapLines.map(s => 'Sitemap: ' + s).join('\n') + '\n'
  : header + cur.trim() + '\n';
add('robots.txt', 'fix_robots', 'text/plain', changes.length ? 'Replace /robots.txt (' + changes.length + ' change(s): ' + changes.join('; ') + ')' : 'Keep /robots.txt as it is (no change needed; this copy only adds a comment on top)', robots);
// ---- llms.txt ----
const titleOf = (p) => String(((p.meta || {}).htags || {}).h1?.[0] || (p.meta || {}).title || '').replace(/\s+[|–—-]\s+[^|–—]+$/, '').trim();
const good = pages.filter(p => p.status_code === 200 && !(p.checks || {}).is_redirect && (p.meta || {}).canonical !== undefined && !/(\?|\/(tag|category|author|page|feed)\b|privacy|terms|cookie|login|cart|checkout)/i.test(p.url))
  .sort((x, y) => (Number(x.click_depth) || 9) - (Number(y.click_depth) || 9) || (Number((y.meta || {}).inbound_links_count) || 0) - (Number((x.meta || {}).inbound_links_count) || 0)).slice(0, 60);
const homePage = good.find(p => pathOf(p.url) === '/') || pages.find(p => pathOf(p.url) === '/') || {};
const siteName = P.business_name || (E.homepage_org && E.homepage_org.name) || E.business_name || titleOf(homePage) || domain;
const summary = String((homePage.meta || {}).description || '').trim() || 'Website of ' + siteName + '.';
const sections = new Map();
for (const p of good) { if (pathOf(p.url) === '/') continue; const seg = (pathOf(p.url).split('/').filter(Boolean)[0] || 'pages'); const key = /blog|news|insight|article|resource|guide/i.test(seg) ? 'Guides and articles' : /service|solution|product|offer/i.test(seg) ? 'Services' : /case|work|project|client/i.test(seg) ? 'Case studies' : /about|team|contact|career/i.test(seg) ? 'Company' : 'Pages';
  if (!sections.has(key)) sections.set(key, []); const t = titleOf(p); if (t && sections.get(key).length < 15) sections.get(key).push('- [' + t.replace(/[\[\]]/g, '') + '](' + p.url + ')' + ((p.meta || {}).description ? ': ' + String(p.meta.description).replace(/\s+/g, ' ').slice(0, 160) : '')); }
const ORDER = ['Services', 'Guides and articles', 'Case studies', 'Pages', 'Company'];
const llms = '# ' + siteName + '\n\n> ' + summary.replace(/\s+/g, ' ') + '\n\n' + (P.city || P.phone ? (P.city ? 'Based in ' + [P.city, P.country_code].filter(Boolean).join(', ') + '. ' : '') + (P.phone ? 'Phone: ' + P.phone + '. ' : '') + 'Website: ' + home + '\n\n' : '') +
  ORDER.filter(k => (sections.get(k) || []).length).map(k => '## ' + k + '\n\n' + sections.get(k).join('\n')).join('\n\n') + '\n';
add('llms.txt', 'fix_llms', 'text/markdown', m.llms_txt_present ? 'A refreshed /llms.txt (you already have one: compare first)' : 'Publish at /llms.txt (a clean map of the site for AI tools)', llms);
// ---- redirect map for broken pages ----
const live = good.filter(p => pathOf(p.url) !== '/');
const toks = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length > 2);
const broken = crawlItems.filter(p => (p.resource_type === 'html' || p.resource_type === 'broken') && ((p.checks || {}).is_broken || Number(p.status_code) >= 400)).slice(0, 100);
const map = broken.map(b => { const bt = new Set(toks(pathOf(b.url))); let best = home, score = 0; for (const l of live) { const s = toks(pathOf(l.url)).filter(t => bt.has(t)).length; if (s > score) { score = s; best = l.url; } } return { from: pathOf(b.url), to: pathOf(best), status: b.status_code, match: score ? 'same topic' : 'homepage (no close match: pick a better page if you have one)' }; });
// RV-1: the known addresses that no longer answer (Search Console still shows most of them), each with the page suggested for it
for (const r of (((a.not_crawled_check || {}).redirects) || [])) { const from = GONE.pathOf(r.from_url || r.from); if (!from || from === '/' || map.some(m => GONE.pathOf(m.from) === from)) continue;
  map.push({ from, to: GONE.pathOf(r.to_url || r.to || '/'), status: r.status || 404, match: r.match || '' }); }
if (map.length) {
  add('redirects.csv', 'fix_redirects_csv', 'text/csv', map.length + ' broken URL(s) → closest live page (301)', 'from,to,http_status_now,match\n' + map.map(r => [r.from, r.to, r.status, r.match].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n') + '\n');
  add('redirects-nginx.conf', 'fix_redirects_nginx', 'text/plain', 'The same map for nginx (server block)', '# 301 redirects for broken URLs found by the audit on ' + today + '\n' + map.map(r => 'location = ' + r.from.replace(/\?.*$/, '') + ' { return 301 ' + r.to + '; }').join('\n') + '\n');
  add('redirects.htaccess', 'fix_redirects_htaccess', 'text/plain', 'The same map for Apache / .htaccess', '# 301 redirects for broken URLs found by the audit on ' + today + '\n' + map.map(r => 'Redirect 301 ' + r.from.replace(/\?.*$/, '') + ' ' + r.to).join('\n') + '\n');
}
// ---- schema: Organization (+ LocalBusiness when an address exists) and WebSite ----
// 2026-10-13 (re-rating §3.2 "Also seen"): the fix pack asked the owner to add a `sameAs` profile the homepage already carries — the
// same LinkedIn page in two spellings (the schema's and the footer link's) survived the exact-string Set, and the purpose line counted
// both. Profiles are now deduped by identity (host without www, path without its trailing slash) in the spelling the page already uses,
// and the line says which are already on the page and which are genuinely new, so nothing is offered "to add" that is already there.
const profKey = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const onPageSame = [...((E.homepage_org || {}).sameAs || [])].filter(u => /^https?:\/\//.test(u));
const offPageSame = [...(E.homepage_social || []), ...(E.gbp && E.gbp.cid ? ['https://maps.google.com/?cid=' + E.gbp.cid] : [])].filter(u => /^https?:\/\//.test(u));
const sameAs = []; const sameSeen = new Set();
for (const u of [...onPageSame, ...offPageSame]) { const k = profKey(u); if (!k || sameSeen.has(k)) continue; sameSeen.add(k); sameAs.push(u); }
const onPageKeys = new Set(onPageSame.map(profKey));
const sameAs_new = sameAs.filter(u => !onPageKeys.has(profKey(u)));          // what this block really adds
const sameAs_kept = sameAs.filter(u => onPageKeys.has(profKey(u)));          // already in the homepage's Organization schema: kept, not "to add"
const sameNote = !sameAs.length ? 'fill in the sameAs placeholders'
  : sameAs_new.length ? sameAs_new.length + ' official profile(s) to add in sameAs' + (sameAs_kept.length ? ', ' + sameAs_kept.length + ' kept from the schema your homepage already has' : '')
  : 'the ' + sameAs_kept.length + ' official profile(s) your homepage already lists, unchanged — nothing new to add there';
const org = { '@context': 'https://schema.org', '@type': 'Organization', '@id': home + '#organization', name: siteName, url: home, ...(P.logo_url || (E.homepage_org || {}).logo ? { logo: P.logo_url || E.homepage_org.logo } : { logo: '[Logo URL, 112x112 px or larger]' }),
  ...(P.phone || (E.gbp || {}).phone || (E.homepage_org || {}).telephone ? { contactPoint: { '@type': 'ContactPoint', telephone: P.phone || (E.gbp || {}).phone || E.homepage_org.telephone, contactType: 'customer service', ...(P.public_email ? { email: P.public_email } : {}) } } : {}), sameAs: sameAs.length ? sameAs : ['[LinkedIn company page URL]', '[Google Business Profile URL]'] };
add('organization.jsonld', 'fix_schema_org', 'application/ld+json', 'Organization schema for the homepage (' + sameNote + ')', '<script type="application/ld+json">\n' + JSON.stringify(org, null, 2) + '\n</script>\n');
const HA = (E.homepage_org && E.homepage_org.address && typeof E.homepage_org.address === 'object') ? E.homepage_org.address : {};
if (P.street_address || (E.gbp && E.gbp.address) || HA.streetAddress) {
  const lb = { '@context': 'https://schema.org', '@type': 'LocalBusiness', '@id': home + '#business', name: siteName, url: home, telephone: P.phone || (E.gbp || {}).phone || (E.homepage_org || {}).telephone || '[Phone]', address: { '@type': 'PostalAddress', streetAddress: P.street_address || HA.streetAddress || (E.gbp || {}).address || '[Street address]', addressLocality: P.city || HA.addressLocality || '[City]', ...((P.region || HA.addressRegion) ? { addressRegion: P.region || HA.addressRegion } : {}), ...((P.postal_code || HA.postalCode) ? { postalCode: P.postal_code || HA.postalCode } : {}), addressCountry: P.country_code || HA.addressCountry || base.country_iso || '[Country code]' },
    ...(P.opening_hours ? { openingHours: P.opening_hours } : {}), ...(sameAs.length ? { sameAs } : {}), parentOrganization: { '@id': home + '#organization' } };
  add('localbusiness.jsonld', 'fix_schema_local', 'application/ld+json', 'LocalBusiness schema for the contact / location page (name, address and phone must match Google Business Profile)', '<script type="application/ld+json">\n' + JSON.stringify(lb, null, 2) + '\n</script>\n');
}
add('website.jsonld', 'fix_schema_website', 'application/ld+json', 'WebSite schema for the homepage (site name shown in Google results)', '<script type="application/ld+json">\n' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', '@id': home + '#website', name: siteName, url: home, publisher: { '@id': home + '#organization' } }, null, 2) + '\n</script>\n');
// ---- internal links ----
const il = a.internal_links || [];
if (il.length) add('internal-links.csv', 'fix_internal_links', 'text/csv', il.length + ' internal links to add (from page → to page, with an anchor)', 'from_page,to_page,anchor_text,why\n' + il.map(l => [l.from_url, l.to_url, l.anchor, l.reason].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n') + '\n');
const readme = 'FIX PACK for ' + domain + ' (SEO audit of ' + today + ')\n\n' + files.map(f => '* ' + f.name + ': ' + f.purpose).join('\n') + '\n\nHow to use: robots.txt and llms.txt go to the site root; ' + (map.length ? 'add the redirects in your server or CDN (test a few URLs afterwards); ' : '') + 'paste the .jsonld blocks into the page <head> (organization + website on the homepage, localbusiness on the contact page), replace any [placeholder]; add the internal links in the page copy, with the anchor text or a natural variant. The next audit checks the result and lists what was fixed.\n';
add('README.txt', 'fix_readme', 'text/plain', 'What each file is and how to deploy it', readme);
const binary = {}; for (const f of files) binary[f.prop] = { data: Buffer.from(f.content, 'utf8').toString('base64'), mimeType: f.mime, fileName: f.name, fileExtension: f.name.split('.').pop() };
return [{ json: { ...d, site_audit: { ...a, fix_pack: { files: files.map(f => ({ name: f.name, purpose: f.purpose, bytes: Buffer.byteLength(f.content, 'utf8') })), robots_changes: changes } }, fix_pack: { generated_at: today, files: files.map(f => ({ name: f.name, purpose: f.purpose, content: f.content })) }, fix_props: files.map(f => f.prop) }, binary }];
