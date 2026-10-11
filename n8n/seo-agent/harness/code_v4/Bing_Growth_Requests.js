// Per site the Bing account manages: today's URL submission quota and Bing's crawl state of the pages checked this week (GetUrlInfo).
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const jsonOf = (r) => { if (!r) return {}; if (r.d !== undefined) return r; const b = r.body ?? r.data; if (b && typeof b === 'object') return b; try { return JSON.parse(b || '{}'); } catch (e) { return {}; } };
let sites = []; try { sites = (jsonOf($('Fetch Bing Sites (Growth)').first().json).d || []).filter(s => s && s.Url); } catch (e) {}
const hostOf = (u) => { const m = String(u || '').match(/^https?:\/\/([^\/?#:]+)/i); return m ? m[1].toLowerCase() : ''; };
const API = 'https://ssl.bing.com/webmaster/api.svc/json/';
const out = [];
for (const p of plans) {
  const site = sites.find(s => hostOf(s.Url) === p.site_host) || sites.find(s => hostOf(s.Url).replace(/^www\./, '') === p.domain);
  if (!site) continue;
  out.push({ json: { site_id: p.site_id, kind: 'quota', site_url: site.Url, url: API + 'GetUrlSubmissionQuota?siteUrl=' + encodeURIComponent(site.Url) } });
  for (const a of p.audit) out.push({ json: { site_id: p.site_id, kind: 'info', site_url: site.Url, page: a.url, url: API + 'GetUrlInfo?siteUrl=' + encodeURIComponent(site.Url) + '&url=' + encodeURIComponent(a.url) } });
}
return out.length ? out : [{ json: { skip: true } }];
