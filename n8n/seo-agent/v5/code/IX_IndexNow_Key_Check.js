// Index coverage wave 3 (DESIGN_WAVE3.md §2.3): IndexNow (Bing, Yandex, Seznam, Naver, Yep: never Google) - the key check. A website is
// told to IndexNow only when it has a key (seo_cache indexnow:<site_id>, made by AI Growth, which asks the owner to host the key file) AND
// the key file answers the key today: one GET of https://<host>/<key>.txt here, judged in IndexNow Submit Requests (Index). Nothing is asked
// when the build's kill switch is off (SEO_INDEXNOW=off in n8n/.env, baked at build), when the website has no page to send (Index Diagnose:
// nothing new, or a list already sent in the last 20 hours), or when it has no key. A dry run (a test) still checks the key and sends nothing.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const KILL_OFF = '__INDEXNOW__' === 'off';
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const diag = grab('Index Diagnose').filter(x => x && x.site_id && !x.failed);
const cache = grab('Load IndexNow Key (Index)').filter(x => x && !x.error && S(x.key));
const parse = (v) => { if (v && typeof v === 'object') return v; try { return JSON.parse(S(v) || '{}') || {}; } catch (e) { return {}; } };
const out = []; const reasons = {};
for (const d of diag) {
  const inw = d.indexnow || {};
  if (KILL_OFF) { reasons[d.site_id] = 'kill_switch'; continue; }
  if (!(inw.urls || []).length) { reasons[d.site_id] = S(inw.why) || 'nothing_new'; continue; }
  const row = cache.find(c => S(c.key) === 'indexnow:' + d.site_id);
  const key = row ? S(parse(row.value).key) : '';
  if (!IX.indexnowKeyOk(key)) { reasons[d.site_id] = 'no_key'; continue; }
  const host = S(inw.host);
  if (!host) { reasons[d.site_id] = 'no_key'; continue; }
  out.push({ json: { site_id: d.site_id, host, key, url: 'https://' + host + '/' + key + '.txt' } });
}
return out.length ? out.map(o => ({ json: { ...o.json, reasons } })) : [{ json: { skip: true, reasons } }];
