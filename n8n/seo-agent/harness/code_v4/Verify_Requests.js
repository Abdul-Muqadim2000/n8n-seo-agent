// What the link check fetches this run (v4.10; free: a plain GET of each page, $0). Our own crawler, because an index only knows a link as of
// its last visit (DataForSEO's full cycle is up to 90 days) and a lost link reported by an index may still be there (Ahrefs documents false
// "lost" reports). Per site, in this order:
// 1. links to re-check: missed once (a loss is confirmed only after two misses in a row), reported lost by DataForSEO, won prospects, new
//    referrers, then the valuable ones (SEO value 40+ or visits), then the rest by oldest check — 60 on light runs, 220 on full runs;
// 2. pages that name the brand (news, web search, Content Analysis): with a link they join the ledger, without one they are the warmest
//    outreach (15 / 40);
// 3. "best X" list pages from web search (full runs, 8): which competitors they name and whether they name you;
// 4. the site's own most-linked pages (full runs, 30): a linked page that now answers 404 loses its links (reclaim with a 301).
// Social networks, Wikipedia and Hacker News are not fetched (their APIs already say whether the link is there; social pages block bots).
const merged = $('Link Merge').all().map(i => i.json).filter(m => !m.skip);
let lreqs = [], lresps = []; try { lreqs = $('Locate Requests').all().map(i => i.json); lresps = $('Fetch Locate').all().map(i => i.json || {}); } catch (e) {}
let prospects = []; try { prospects = $('Load Link Prospects').all().map(i => i.json).filter(x => x && x.prospect_domain); } catch (e) {}
let dreqs = [], dresps = []; try { dreqs = $('BL Requests').all().map(i => i.json); dresps = $('Run BL Requests').all().map(i => i.json || {}); } catch (e) {}
const host = (u) => { const m = String(u || '').match(/^(?:https?:)?\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
const same = (h, d) => !!h && (h === d || h.endsWith('.' + d));
const parse = (r) => { if (!r) return {}; if (r.body && typeof r.body === 'object') return r.body; if (r.results) return r; try { return JSON.parse(String(r.body ?? r.data ?? '')); } catch (e) { return {}; } };
const days = (d) => d ? (Date.now() - new Date(d).getTime()) / 864e5 : 1e4;
const DOC = /\.(pdf|docx?|xlsx?|pptx?|odt|rtf|zip|rar|7z|gz|csv|mp4|mp3|mov|jpe?g|png|gif|webp|svg)(?:[?#]|$)/i;   // documents and media are not fetched (a 16 MB PDF stalled the live run)
const out = [];
for (const m of merged) {
  const full = m.mode === 'full'; const add = (x) => out.push({ json: { site_id: m.site_id, domain: m.domain, ...x } });
  const located = new Map(); lreqs.forEach((r, i) => { if (r.site_id !== m.site_id || r.skip) return; const hit = (parse(lresps[i]).results || []).find(x => same(host(x.url), r.ref_domain)); if (hit) located.set(r.ref_domain, hit.url); });
  const won = new Set(prospects.filter(x => x.site_id === m.site_id && x.status === 'won').map(x => x.prospect_domain));
  const urlOf = (e) => (e.dfs_lost && e.dfs_lost.url) || (e.prev && e.prev.verify === 'found' && e.prev.from_url) || located.get(e.ref_domain) || e.from_url || (e.pages[0] || {}).url || '';
  const links = m.entries.filter(e => e.kind === 'web' && !e.sources.every(s => s === 'wiki' || s === 'hn') && !['en.wikipedia.org', 'news.ycombinator.com'].includes(e.ref_domain) && !/wikipedia\.org$/.test(e.ref_domain)).map(e => {
    const pv = e.prev || {}; const miss = Number(pv.miss_count) || 0; const val = Number(pv.seo_value) || 0;
    const prio = miss > 0 ? 1000 : e.dfs_lost ? 900 : won.has(e.ref_domain) ? 800 : !e.prev ? 700 + Math.min(99, (e.authority || 0) / 10) : (val >= 40 || e.visits > 0) ? 500 + val : Math.min(400, days(pv.verified_at));
    return { e, url: urlOf(e), prio, why: miss > 0 ? 'missed_once' : e.dfs_lost ? 'reported_lost' : won.has(e.ref_domain) ? 'won' : !e.prev ? 'new' : (val >= 40 || e.visits > 0) ? 'valuable' : 'rotation' };
  }).filter(x => /^https?:\/\//i.test(x.url) && !DOC.test(x.url) && (full || x.prio >= 500)).sort((a, b) => b.prio - a.prio).slice(0, full ? 220 : 60);
  for (const x of links) add({ purpose: 'link', ref_domain: x.e.ref_domain, url: x.url, why: x.why, located: located.get(x.e.ref_domain) === x.url, authority: x.e.authority || 0, spam: x.e.spam || 0 });
  const fetched = new Set(links.map(x => x.url));
  for (const mp of (m.mention_pages || []).filter(x => !fetched.has(x.url)).sort((a, b) => ((b.source === 'news') - (a.source === 'news')) || ((b.authority || 0) - (a.authority || 0))).slice(0, full ? 40 : 15)) { add({ purpose: 'mention', ref_domain: mp.domain, url: mp.url, source: mp.source, title: mp.title, date: mp.date || '' }); fetched.add(mp.url); }
  if (full) for (const lp of (m.list_pages || []).filter(x => !fetched.has(x.url)).slice(0, 8)) { add({ purpose: 'list', ref_domain: lp.domain, url: lp.url, title: lp.title, topic: lp.topic }); fetched.add(lp.url); }
  if (full) {   // own pages with links: DataForSEO's most-linked pages + the targets the sources named
    const targets = new Map();
    dreqs.forEach((r, i) => { if (r.site_id !== m.site_id || r.kind !== 'pages') return; const t = (((dresps[i] || {}).tasks || [])[0] || {}); for (const it of (((t.result || [])[0] || {}).items || [])) if (it.page) targets.set(it.page, Math.max(targets.get(it.page) || 0, Number((it.page_summary || {}).referring_domains) || 0)); });
    for (const e of m.entries) if (e.to_url && same(host(e.to_url), m.domain)) targets.set(e.to_url, (targets.get(e.to_url) || 0) + 1);
    for (const [u, n] of [...targets].sort((a, b) => b[1] - a[1]).slice(0, 30)) if (/^https?:\/\//.test(u)) add({ purpose: 'target', ref_domain: m.domain, url: u, referring: n });
  }
}
return out.length ? out : [{ json: { skip: true } }];
