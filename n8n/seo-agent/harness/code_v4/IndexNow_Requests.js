// Submit through IndexNow when the key file answers with the key (one POST per site, up to 10,000 URLs; 200 / 202 = ACCEPTED —
// B9-1: IndexNow's own FAQ says "Submitting a URL does not guarantee immediate indexing" and each engine "makes its own decision
// about whether to index it" (www.indexnow.org/faq); the participating engines it lists are Amazon, Bing, Naver, Seznam.cz,
// Yandex and Yep — Google is not among them. The report says notified, never indexed.
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let reqs = [], res = []; try { reqs = $('IndexNow Key Requests').all().map(i => i.json); res = $('Fetch IndexNow Key').all().map(i => i.json); } catch (e) {}
const robots = (() => { try { return $('Robots Verdicts (Growth)').all().map(i => i.json).filter(x => x && !x.skip); } catch (e) { return []; } })();
const keyOf = (u) => { const m = String(u || '').trim().match(/^https?:\/\/(?:www\.)?([^\/?#]+)([^?#]*)/i); if (!m) return ''; return m[1].toLowerCase() + ((m[2] || '/').replace(/\/+$/, '') || '/'); };
const out = [];
for (const p of plans) {
  const i = reqs.findIndex(q => q.site_id === p.site_id); if (i < 0) continue;
  const r = res[i] || {}; const body = String(r.body ?? r.data ?? '').trim(); const status = Number(r.statusCode) || 0;
  if (!(status === 200 && body === p.indexnow_key)) continue;
  // B9-3: a page every AI search fetcher is forbidden to read is not notified — no engine could fetch it if it wanted to
  const rb = robots.find(x => x.site_id === p.site_id) || null;
  const blocked = (u) => { const vd = rb && rb.verdicts ? rb.verdicts[keyOf(u)] : null; return !!(vd && vd.checked && vd.blocked_all); };
  const refused = p.submit.filter(x => blocked(x.url)).map(x => ({ url: x.url, reason: 'robots.txt blocks every AI search fetcher' }));
  const urls = p.submit.filter(x => !blocked(x.url)).map(x => x.url);
  if (!urls.length) { if (refused.length) out.push({ json: { site_id: p.site_id, skip: true, refused } }); continue; }
  out.push({ json: { site_id: p.site_id, url: 'https://api.indexnow.org/indexnow', urls, refused, body: { host: p.site_host, key: p.indexnow_key, keyLocation: reqs[i].url, urlList: urls.slice(0, 10000) } } });
}
return out.length ? out : [{ json: { skip: true } }];
