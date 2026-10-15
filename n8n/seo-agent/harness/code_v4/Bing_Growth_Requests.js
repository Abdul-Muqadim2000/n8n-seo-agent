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
  const asked = new Set();
  const ask = (url, why, extra = {}) => { const k = String(url || '').toLowerCase(); if (!url || asked.has(k)) return; asked.add(k);
    out.push({ json: { site_id: p.site_id, kind: 'info', why, site_url: site.Url, page: url, ...extra, url: API + 'GetUrlInfo?siteUrl=' + encodeURIComponent(site.Url) + '&url=' + encodeURIComponent(url) } }); };
  for (const a of p.audit) ask(a.url, 'checked this week');
  // B9-2 (2026-10-15, INVARIANTS rule 4): a page we SENT to Bing is not a page Bing has crawled. Every page submitted in the last
  // weeks that Bing has still not crawled is asked about again, so the run can say what became of its submissions.
  for (const f of (p.follow_up || [])) ask(f.url, 'submitted ' + f.days + ' day(s) ago', { submitted_at: f.submitted_at, submitted_via: f.submitted_via, submitted_days: f.days });
}
return out.length ? out : [{ json: { skip: true } }];
