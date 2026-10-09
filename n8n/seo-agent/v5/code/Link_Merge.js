// One list of who links to the site, from every source (v4.10, BACKLINKS_SPEC.md §3): DataForSEO (referring domains + one link per domain with
// its details, new / lost), Bing Webmaster Tools (its own crawl, verified sites), the Search Console link exports the person uploaded (Google's
// own sample), GA4 referrals (links that send visits), Wikipedia and Hacker News, the Common Crawl web graph (133M domains, refreshed monthly by
// the linkgraph job: seo_link_graph), and the ledger of earlier runs. Keyed by referring site
// (registrable domain; platform subdomains such as x.blogspot.com stay separate). E-mail, chat, search, payment and AI hosts from GA4 are not
// links on the web and are dropped; social networks are kept and marked. Also collects the pages to check for mentions (news, web search,
// Content Analysis) and the "best X" list pages. Per site one item; *Verify Requests* decides what to fetch.
/*__LINK_KIT__*/
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const all = (n) => { try { return $(n).all().map(i => i.json || {}); } catch (e) { return []; } };
const reqs = all('BL Requests'), resps = all('Run BL Requests');
const sreqs = all('Source Requests'), sresps = all('Fetch Sources');
const nreqs = all('News Requests'), nresps = all('Fetch News');
const bcreqs = all('Bing Requests'), bcresps = all('Fetch Bing Counts'), breqs = all('Bing Link Requests'), bresps = all('Fetch Bing');
const bingSites = (() => { try { const r = $('Fetch Bing Sites').first().json || {}; const j = (r.body && typeof r.body === 'object') ? r.body : (r.d ? r : JSON.parse(String(r.body ?? r.data ?? '{}'))); return { ok: Array.isArray(j.d), urls: (j.d || []).map(x => String(x.Url || '')), error: j.Message || j.message || (r.error && (r.error.message || r.error)) || '' }; } catch (e) { return { ok: false, urls: [], error: '' }; } })();
const greqs = all('Referral Requests'), gresps = all('GA4 Referrals');
const ledger = all('Load Backlinks').filter(r => r && r.site_id && r.ref_domain);
const imports = all('Load Link Imports').filter(r => r && r.site_id && (r.ref_domain || r.from_url));
const prospects = all('Load Link Prospects').filter(r => r && r.site_id && r.prospect_domain);
const graph = all('Load Link Graph').filter(r => r && r.site_id && r.ref_domain);
const dfsRes = (r) => { const t = ((r || {}).tasks || [])[0] || {}; return t.status_code === 20000 ? ((t.result || [])[0] || {}) : null; };
const json = (r) => { if (!r) return null; if (r.body && typeof r.body === 'object') return r.body; const raw = r.body ?? r.data; if (raw && typeof raw === 'object') return raw; try { return JSON.parse(String(raw || '')); } catch (e) { return (r.query || r.articles || r.hits || r.results || r.d || r.rows) ? r : null; } };
const ymd = (s) => String(s || '').slice(0, 10);
const SEM = { main: 'content', article: 'content', section: 'content', '': 'body', header: 'nav', nav: 'nav', footer: 'footer', aside: 'sidebar', details: 'body', summary: 'body' };
const BIG = /(^|\.)(google|youtube|facebook|linkedin|wikipedia|amazon|apple|microsoft|reddit|quora|instagram|twitter|x|tiktok|medium|github|pinterest|blogspot|wordpress|tumblr)\.[a-z.]+$/i;
const DOC = /\.(pdf|docx?|xlsx?|pptx?|odt|rtf|zip|rar|7z|gz|csv|mp4|mp3|mov|jpe?g|png|gif|webp|svg)(?:[?#]|$)/i;   // documents and media: no links to check, and a 16 MB PDF stalled the live run (2026-10-08)
const LISTY = /\b(best|top|leading|\d{1,3}\b.*\b(companies|providers|vendors|tools|software|solutions|firms|agencies|platforms)|vs\.?|versus|compar|alternativ|review|list of|directory|ranking)/i;   // a "best X" page, not a product or FAQ page
const out = [];
for (const p of plans) {
  const M = new Map(); const now = p.checked_at; const today = ymd(now);
  const get = (host) => { const kind = LK.domainKind(host, p.domain); if (['self', 'mail', 'tool', 'search', 'ai'].includes(kind)) return null; const k = LK.refKey(host); if (!k || LK.sameSite(k, p.domain)) return null;
    if (!M.has(k)) M.set(k, { ref_domain: k, kind, sources: new Set(), from_url: '', to_url: '', anchor: '', rel: '', placement: '', first_seen: '', last_seen: '', authority: 0, page_keywords: 0, spam: 0, original: null, sitewide: 0, links: 0, visits: 0, visits_28d: 0, key_events: 0, dfs_lost: null, pages: [] });
    return M.get(k); };
  const seen = (e, src, d) => { e.sources.add(src); const x = ymd(d) || today; if (!e.first_seen || x < e.first_seen) e.first_seen = x; if (!e.last_seen || x > e.last_seen) e.last_seen = x; };
  const page = (e, url, src) => { if (url && !e.pages.some(x => x.url === url)) e.pages.push({ url, src }); if (url && !e.from_url) e.from_url = url; };
  const mine = (arr, list) => list.map((r, i) => [r, arr[i]]).filter(([r]) => r && r.site_id === p.site_id);
  // ---- DataForSEO
  for (const [r, resp] of mine(resps, reqs)) {
    const res = dfsRes(resp); if (!res) continue; const items = res.items || [];
    if (r.kind === 'refdomains') for (const x of items) { const e = get(x.domain); if (!e) continue; seen(e, 'dfs', x.first_seen); e.authority = Math.max(e.authority, Number(x.rank) || 0); e.spam = Number(x.backlinks_spam_score) || e.spam; e.sitewide = Math.max(e.sitewide, Number(x.backlinks) || 0); e.links = Math.max(e.links, Number(x.backlinks) || 0); }
    if (r.kind === 'links' || r.kind === 'new') for (const x of items) { const e = get(x.domain_from); if (!e) continue; seen(e, 'dfs', x.first_seen); e.last_seen = ymd(x.last_seen) > e.last_seen ? ymd(x.last_seen) : e.last_seen;
      page(e, x.url_from, 'dfs'); if (!e.to_url) e.to_url = x.url_to || ''; if (!e.anchor) e.anchor = String(x.anchor || (x.alt ? '[image] ' + x.alt : '')).slice(0, 160);
      if (!e.rel) e.rel = x.dofollow ? 'follow' : ((x.attributes || []).includes('sponsored') ? 'sponsored' : (x.attributes || []).includes('ugc') ? 'ugc' : 'nofollow');
      e.placement = e.placement || SEM[String(x.semantic_location || '')] || 'body'; e.authority = Math.max(e.authority, Number(x.domain_from_rank) || 0); e.spam = Math.max(e.spam, Number(x.backlink_spam_score) || 0);
      e.page_keywords = Math.max(e.page_keywords, Number(((x.ranked_keywords_info || {}).page_from_keywords_count_top_100)) || 0); if (x.original === false) e.original = false; else if (e.original === null && x.original === true) e.original = true;
      e.outbound = Number(x.page_from_external_links) || e.outbound || 0; if (r.kind === 'new') e.dfs_new = true; }
    if (r.kind === 'lost') for (const x of items) { const e = get(x.domain_from); if (!e) continue; e.sources.add('dfs'); e.dfs_lost = { url: x.url_from || '', last_seen: ymd(x.last_seen) }; page(e, x.url_from, 'dfs_lost');
      e.authority = Math.max(e.authority, Number(x.domain_from_rank) || 0); if (!e.anchor) e.anchor = String(x.anchor || '').slice(0, 160); if (!e.to_url) e.to_url = x.url_to || ''; if (!e.rel) e.rel = x.dofollow ? 'follow' : 'nofollow'; }
  }
  // ---- Bing Webmaster Tools (GetUrlLinks per linked page; when the API key is set and the site is in the key's Bing account)
  const inBing = bingSites.urls.some(u => LK.hostOf(u) === p.domain);
  const bing = { connected: false, in_account: inBing, error: p.bing && !bingSites.ok ? String(bingSites.error || 'Bing Webmaster API did not answer').slice(0, 160) : '', pages: 0, links: 0 };
  for (const [r, resp] of [...mine(bcresps, bcreqs), ...mine(bresps, breqs)]) {
    const j = json(resp) || {}; const d = j.d;
    if (!d) { const msg = String(j.Message || j.message || (resp && resp.error && (resp.error.message || resp.error)) || '').slice(0, 160); if (msg && !bing.error) bing.error = msg; continue; }
    bing.connected = true;
    if (r.kind === 'bing_counts') bing.pages += (d.Links || []).length;
    if (r.kind === 'bing_links') for (const x of (d.Details || [])) { const e = get(LK.hostOf(x.Url)); if (!e) continue; seen(e, 'bing', today); page(e, x.Url, 'bing'); if (!e.to_url) e.to_url = r.link || ''; if (!e.anchor && x.AnchorText) e.anchor = String(x.AnchorText).slice(0, 160); bing.links++; }
  }
  // ---- Search Console exports uploaded in the app (latest upload per kind)
  const myImp = imports.filter(x => x.site_id === p.site_id); const latestAt = {};
  for (const x of myImp) if (!latestAt[x.source] || String(x.imported_at) > latestAt[x.source]) latestAt[x.source] = String(x.imported_at);
  const gsc = { rows: 0, domains: new Set(), uploaded_at: Object.values(latestAt).sort().pop() || '' };
  for (const x of myImp) { if (String(x.imported_at) !== latestAt[x.source]) continue; const host = x.ref_domain || LK.hostOf(x.from_url); const e = get(host); if (!e) continue;
    const src = String(x.source || '').startsWith('gsc') ? 'gsc' : 'import'; seen(e, src, x.last_crawled || x.imported_at); if (x.from_url) page(e, x.from_url, src); if (x.to_url && !e.to_url) e.to_url = x.to_url; e.links = Math.max(e.links, Number(x.links) || 0); gsc.rows++; if (src === 'gsc') gsc.domains.add(e.ref_domain); }
  // ---- GA4 referrals
  const ga4 = { connected: false, error: '', sources: 0, visits: 0, key_events: 0, excluded: [] };
  for (const [r, resp] of mine(gresps, greqs)) {
    const j = json(resp) || {}; if (j.error || (resp && resp.error)) { ga4.error = String((j.error && j.error.message) || (resp.error && (resp.error.message || resp.error)) || '').slice(0, 160); continue; }
    ga4.connected = true; const rows = j.rows || [];
    if (r.kind === 'ref_sources') for (const row of rows) { const host = String(row.dimensionValues[0].value || ''); const range = (row.dimensionValues[1] || {}).value || 'year'; const m = row.metricValues.map(v => Number(v.value) || 0);
      const kind = LK.domainKind(host, p.domain); if (['self', 'mail', 'tool', 'search', 'ai'].includes(kind)) { if (range === 'year' && kind !== 'self') ga4.excluded.push(host); continue; }
      const e = get(host); if (!e) continue; if (range === 'year') { seen(e, 'ga4', today); e.visits += m[0]; e.key_events += m[2]; ga4.visits += m[0]; ga4.key_events += m[2]; ga4.sources++; } else e.visits_28d += m[0]; }
    if (r.kind === 'ref_pages') for (const row of rows) { const ref = String(row.dimensionValues[0].value || ''); const host = LK.hostOf(ref) || String(row.dimensionValues[1].value || ''); const e = M.get(LK.refKey(host)); if (!e) continue;
      if (/^https?:\/\/[^\/]+\/[^?#]+/.test(ref)) page(e, ref, 'ga4'); }
  }
  // ---- Wikipedia, Hacker News (free APIs) and the mention / list candidates
  const mentionPages = [], listPages = [];
  const wiki = { pages: 0 }, hn = { stories: 0 };
  for (const [r, resp] of mine(sresps, sreqs)) {
    const j = json(resp) || {};
    if (r.kind === 'wiki') for (const x of ((j.query || {}).exturlusage || [])) { if (Number(x.ns) !== 0 || !LK.sameSite(LK.hostOf(x.url), p.domain)) continue; const host = r.lang + '.wikipedia.org'; const e = get(host); if (!e) continue; seen(e, 'wiki', today); e.rel = 'nofollow'; e.placement = 'content';
      page(e, 'https://' + host + '/wiki/' + encodeURIComponent(String(x.title || '').replace(/ /g, '_')), 'wiki'); if (!e.to_url) e.to_url = x.url; e.anchor = e.anchor || String(x.title || '').slice(0, 160); e.link_type = 'resource'; wiki.pages++; }
    if (r.kind === 'hn') for (const x of (j.hits || [])) { if (!LK.sameSite(LK.hostOf(x.url), p.domain)) continue; const e = get('news.ycombinator.com'); if (!e) continue; seen(e, 'hn', x.created_at); page(e, 'https://news.ycombinator.com/item?id=' + x.objectID, 'hn'); if (!e.to_url) e.to_url = x.url; e.anchor = e.anchor || String(x.title || '').slice(0, 160); e.link_type = 'forum'; hn.stories++; }
    if (r.kind === 'searx_mention' || r.kind === 'searx_list') for (const x of (j.results || []).slice(0, 20)) { const host = LK.hostOf(x.url); if (!host || LK.sameSite(host, p.domain) || LK.domainKind(host, p.domain) !== 'web' || LK.isScraper(host) || DOC.test(x.url) || /^\[pdf\]/i.test(String(x.title || '')) || (p.competitors || []).some(c => LK.sameSite(host, c))) continue;
      if (r.kind === 'searx_list' && !LISTY.test(String(x.title || '') + ' ' + String(x.url || ''))) continue;
      (r.kind === 'searx_list' ? listPages : mentionPages).push({ url: x.url, domain: LK.refKey(host), title: String(x.title || '').slice(0, 160), source: r.kind === 'searx_list' ? 'web_list' : 'web', topic: r.topic || '' }); }
  }
  for (const [r, resp] of mine(nresps, nreqs)) { const j = json(resp) || {}; for (const a of (j.articles || [])) { const host = LK.hostOf(a.url); if (!host || LK.sameSite(host, p.domain) || DOC.test(a.url) || LK.isScraper(host)) continue;
    mentionPages.push({ url: a.url, domain: LK.refKey(host), title: String(a.title || '').slice(0, 160), source: 'news', date: String(a.seendate || '').replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3'), language: a.language || '' }); } }
  for (const [r, resp] of mine(resps, reqs)) { if (r.kind !== 'mentions') continue; const res = dfsRes(resp); for (const x of ((res || {}).items || [])) { const host = String(x.domain || ''); if (!host || LK.sameSite(host, p.domain) || BIG.test(host)) continue;
    if (DOC.test(x.url || '') || LK.isScraper(host) || (p.competitors || []).some(c => LK.sameSite(host, c))) continue;
    mentionPages.push({ url: x.url || '', domain: LK.refKey(host), title: String((x.content_info || {}).title || '').slice(0, 160), source: 'dfs_mention', authority: Number(x.domain_rank) || 0 }); } }
  // ---- Common Crawl web graph (domain level; no anchors, dates or nofollow — the link check fills them): referring domains and a free
  // authority rank for every domain (harmonic centrality position among 133M domains)
  const myGraph = graph.filter(r => r.site_id === p.site_id); const release = (myGraph.filter(r => r.release).sort((a, b) => String(b.checked_at || '').localeCompare(String(a.checked_at || '')))[0] || {}).release || '';   // the job's newest write (release names do not sort: jun-jul-aug > jul-aug-sep)
  const ccRank = new Map(); const ccGap = [];
  for (const r of myGraph) { if (release && r.release !== release) continue; const k = LK.refKey(r.ref_domain); if (Number(r.hc_pos) > 0) ccRank.set(k, Number(r.hc_pos));
    if (r.kind === 'link') { const e = get(r.ref_domain); if (e) { seen(e, 'cc', r.checked_at); e.cc_rank = Number(r.hc_pos) || 0; } }
    if (r.kind === 'gap' && !LK.isInfra(r.ref_domain) && !LK.isWire(r.ref_domain)) ccGap.push({ domain: k, cc_rank: Number(r.hc_pos) || 0, links_to: String(r.links_to || '').split(',').map(x => x.trim()).filter(Boolean) }); }
  // ---- the ledger of earlier runs (kept: sources seen before, verification history, analyst labels)
  const prev = new Map(ledger.filter(r => r.site_id === p.site_id).map(r => [r.ref_domain, r]));
  for (const [k, r] of prev) { if (M.has(k)) continue; if (['mail', 'tool', 'search', 'ai', 'self'].includes(r.kind)) continue; M.set(k, { ref_domain: k, kind: r.kind || 'web', sources: new Set(), from_url: r.from_url || '', to_url: r.to_url || '', anchor: r.anchor || '', rel: '', placement: '', first_seen: ymd(r.first_seen), last_seen: ymd(r.last_seen), authority: Number(r.authority) || 0, page_keywords: Number(r.page_keywords) || 0, spam: Number(r.spam_score) || 0, original: r.original === false || r.original === 'false' ? false : null, sitewide: Number(r.sitewide) || 0, links: Number(r.links) || 0, visits: 0, visits_28d: 0, key_events: 0, dfs_lost: null, pages: r.from_url ? [{ url: r.from_url, src: 'ledger' }] : [], carried: true }); }
  const linkedDomains = new Set([...M.values()].filter(e => !e.carried || (prev.get(e.ref_domain) || {}).status !== 'lost').map(e => e.ref_domain));
  const dedupe = (arr) => arr.filter((x, i) => x.url && arr.findIndex(y => y.url === x.url) === i);
  const ai_sources = new Set(prospects.filter(x => x.site_id === p.site_id && x.type === 'ai_source').map(x => LK.refKey(x.prospect_domain)));
  const entries = [...M.values()].map(e => ({ ...e, sources: [...e.sources], prev: prev.get(e.ref_domain) || null, ai_cited: ai_sources.has(e.ref_domain), cc_rank: e.cc_rank || ccRank.get(e.ref_domain) || 0 }));
  const counts = {}; for (const e of entries) for (const s of e.sources) counts[s] = (counts[s] || 0) + 1;
  out.push({ json: { site_id: p.site_id, domain: p.domain, mode: p.mode, entries, mention_pages: dedupe(mentionPages).filter(m => !linkedDomains.has(m.domain) || m.source === 'news').slice(0, 120), list_pages: dedupe(listPages).slice(0, 20),
    cc_gap: ccGap.filter(g => !linkedDomains.has(g.domain)).sort((a, b) => (b.links_to.length - a.links_to.length) || (a.cc_rank - b.cc_rank)).slice(0, 60), cc_rank: Object.fromEntries([...ccRank].slice(0, 3000)),
    sources: { cc: { release, links: myGraph.filter(r => r.kind === 'link' && r.release === release).length, checked_at: myGraph.map(r => String(r.checked_at || '')).sort().pop() || '' }, counts, bing: { ...bing, enabled: !!p.bing }, gsc: { rows: gsc.rows, domains: gsc.domains.size, uploaded_at: gsc.uploaded_at }, ga4: { ...ga4, property: p.ga4_property_id || '', excluded: [...new Set(ga4.excluded)].slice(0, 10) }, wiki, hn } } });
}
return out.length ? out : [{ json: { skip: true } }];
