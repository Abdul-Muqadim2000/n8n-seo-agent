// Send new / updated pages and key pages Bing has not crawled to Bing (SubmitUrlBatch, within the site's daily quota). ChatGPT search and Copilot
// draw on Bing's index (Bing's AI Performance guidance: submit changes promptly; IndexNow below covers the other engines).
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let reqs = [], res = []; try { reqs = $('Bing Growth Requests').all().map(i => i.json); res = $('Fetch Bing Growth').all().map(i => i.json); } catch (e) {}
const jsonOf = (r) => { if (!r) return {}; if (r.d !== undefined || r.ErrorCode !== undefined) return r; const b = r.body ?? r.data; if (b && typeof b === 'object') return b; try { return JSON.parse(b || '{}'); } catch (e) { return {}; } };
const dateOf = (v) => { const m = String(v || '').match(/Date\((-?\d+)/); if (!m) return ''; const t = Number(m[1]); return t > 946684800000 ? new Date(t).toISOString() : ''; };   // "/Date(…)/"; year 1 = never
const out = [];
for (const p of plans) {
  const mine = reqs.map((q, i) => ({ q, r: jsonOf(res[i]) })).filter(x => x.q && x.q.site_id === p.site_id);
  if (!mine.length) continue;
  const quota = mine.find(x => x.q.kind === 'quota'); const daily = Number(((quota && quota.r.d) || {}).DailyQuota);
  const never = mine.filter(x => x.q.kind === 'info' && x.r && x.r.d && !dateOf(x.r.d.LastCrawledDate)).map(x => x.q.page);
  const urls = [...new Set([...p.submit.map(s => s.url), ...never])];
  const cap = Number.isFinite(daily) ? Math.max(0, daily) : 10;
  if (!urls.length || !cap) continue;
  out.push({ json: { site_id: p.site_id, site_url: mine[0].q.site_url, url: 'https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlBatch', urls: urls.slice(0, Math.min(cap, 500)), quota: Number.isFinite(daily) ? daily : null,
    body: { siteUrl: mine[0].q.site_url, urlList: urls.slice(0, Math.min(cap, 500)) } } });
}
return out.length ? out : [{ json: { skip: true } }];
