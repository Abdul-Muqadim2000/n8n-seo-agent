// Bing: the linking pages and anchors for the site's most-linked pages (GetUrlLinks, first result page each; up to 15 pages per site on
// full runs, 5 on light runs). Bing gives no dates and no nofollow flag: the link check reads both from the page itself.
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do && p.bing);
let reqs = [], resps = []; try { reqs = $('Bing Requests').all().map(i => i.json); resps = $('Fetch Bing Counts').all().map(i => i.json || {}); } catch (e) {}
const parse = (r) => { if (!r) return {}; if (r.body && typeof r.body === 'object') return r.body; if (r.d) return r; try { return JSON.parse(String(r.body ?? r.data ?? '')); } catch (e) { return {}; } };
const out = [];
for (const p of plans) {
  const counts = []; reqs.forEach((r, i) => { if (r.site_id === p.site_id && r.kind === 'bing_counts') { const d = parse(resps[i]).d; for (const l of ((d || {}).Links || [])) counts.push({ url: l.Url, count: Number(l.Count) || 0, site_url: r.site_url }); } });
  const top = counts.filter((c, i, a) => c.url && a.findIndex(x => x.url === c.url) === i).sort((a, b) => b.count - a.count).slice(0, p.mode === 'full' ? 15 : 5);
  for (const c of top) out.push({ json: { site_id: p.site_id, domain: p.domain, kind: 'bing_links', link: c.url, count: c.count, url: 'https://ssl.bing.com/webmaster/api.svc/json/GetUrlLinks?siteUrl=' + encodeURIComponent(c.site_url) + '&link=' + encodeURIComponent(c.url) + '&page=0' } });
}
return out.length ? out : [{ json: { skip: true } }];
