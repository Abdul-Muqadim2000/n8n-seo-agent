// Submit through IndexNow when the key file answers with the key (one POST per site, up to 10,000 URLs; 200 / 202 = accepted).
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let reqs = [], res = []; try { reqs = $('IndexNow Key Requests').all().map(i => i.json); res = $('Fetch IndexNow Key').all().map(i => i.json); } catch (e) {}
const out = [];
for (const p of plans) {
  const i = reqs.findIndex(q => q.site_id === p.site_id); if (i < 0) continue;
  const r = res[i] || {}; const body = String(r.body ?? r.data ?? '').trim(); const status = Number(r.statusCode) || 0;
  if (!(status === 200 && body === p.indexnow_key)) continue;
  const urls = p.submit.map(s => s.url); if (!urls.length) continue;
  out.push({ json: { site_id: p.site_id, url: 'https://api.indexnow.org/indexnow', urls, body: { host: p.site_host, key: p.indexnow_key, keyLocation: reqs[i].url, urlList: urls.slice(0, 10000) } } });
}
return out.length ? out : [{ json: { skip: true } }];
