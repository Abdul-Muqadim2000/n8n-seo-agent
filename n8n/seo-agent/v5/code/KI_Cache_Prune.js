// KI Cache Prune (FX-L 2026-11-08, REVIEW_PERF_SAFETY M2): the ki:* rows of this website that can no longer be read - a discovery or overlap
// bundle keyed on another seed set than this run's, or any ki:* row older than twice its lifetime - are deleted by key, so Load KI Cache
// does not read a growing pile on every run. Only this website's own rows (kind ki, its site_id) are ever named.
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
let cache = []; try { cache = $('Load KI Cache').all().map(i => i.json).filter(r => r && r.key && KIW.S(r.kind) === 'ki' && KIW.S(r.site_id) === KIW.S(p.site_id)); } catch (e) { cache = []; }
const now = Date.parse(p.now || new Date().toISOString());
const KIND = { disc: 'discovery', sc: 'ranked', size: 'ranked', rd: 'backlinks', cd: 'ranked', rk: 'ranked', pi: 'ranked', home: 'homepage', pace: 'homepage', vol: 'volume', tp: 'ranked' };
const pre = 'ki:' + KIW.S(p.site_id) + ':';
const out = [];
for (const r of cache) { const k = KIW.S(r.key); if (!k.startsWith(pre)) continue; const parts = k.slice(pre.length).split(':'); const what = parts[0];
  const age = now - Date.parse(KIW.S(r.updated_at)); const ttl = KIW.ttlOf(KIND[what] || 'ranked') * 864e5;
  const oldSeedSet = (what === 'disc' || what === 'sc') && parts[1] === KIW.S(p.market) && parts[2] && parts[2] !== KIW.S(p.seed_key);
  if ((Number.isFinite(age) && age > 2 * ttl) || oldSeedSet) out.push({ json: { key: k, site_id: KIW.S(p.site_id), kind: 'ki' } }); }
return out.length ? out.slice(0, 200) : [{ json: { skip: true, reason: 'no stale ki:* row' } }];
