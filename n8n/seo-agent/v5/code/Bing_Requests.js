// Bing: the site's pages that have inbound links (GetLinkCounts, two result pages), for the sites the Bing account can read. A site Bing
// does not know is reported ("add it to Bing Webmaster Tools") and costs nothing.
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do && p.bing);
let sites = []; try { const r = $('Fetch Bing Sites').first().json || {}; const j = (r.body && typeof r.body === 'object') ? r.body : (typeof r.data === 'string' ? JSON.parse(r.data) : (r.d ? r : {})); sites = (j.d || []).filter(s => s && s.Url); } catch (e) {}
const host = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const out = [];
for (const p of plans) {
  const s = sites.find(x => host(x.Url) === p.domain && x.IsVerified !== false) || sites.find(x => host(x.Url) === p.domain);
  if (!s) continue;
  for (const page of [0, 1]) out.push({ json: { site_id: p.site_id, domain: p.domain, kind: 'bing_counts', site_url: s.Url, url: 'https://ssl.bing.com/webmaster/api.svc/json/GetLinkCounts?siteUrl=' + encodeURIComponent(s.Url) + '&page=' + page } });
}
return out.length ? out : [{ json: { skip: true, sites: sites.length } }];
