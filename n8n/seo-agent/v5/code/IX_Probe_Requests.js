// Index coverage: the first URL Inspection requests of this website (IX.CFG.probe_per_site). Google's daily-quota and access answers come
// back on the first call, so a website whose probe says "daily quota used up" or "no access" asks nothing more today (Inspect Requests).
// Fix wave 1 (E6): nothing is asked unless this run's reservation row was saved first (Save Index Reservation) - a run that could not record
// what it spends does not spend. 150 ms between calls (at most 400 a minute, under Google's 600).
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const inv = $('Index Inventory').all().map(i => i.json).filter(x => x && x.site_id && !x.failed && !x.no_access);
let saved = []; try { saved = $('Save Index Reservation').all().map(i => i.json); } catch (e) { saved = []; }
const reserved = (sid) => saved.some(r => r && !r.error && String(r.site_id || '') === sid);
const out = [];
for (const v of inv) {
  if (!reserved(v.site_id)) continue;
  for (const t of (v.take || []).slice(0, IX.CFG.probe_per_site))
    out.push({ json: { site_id: v.site_id, inspect_url: t.url, bucket: t.bucket, body: { inspectionUrl: t.url, siteUrl: v.site.gsc_property, languageCode: 'en-US' } } });
}
return out.length ? out : [{ json: { skip: true, reason: inv.some(v => (v.take || []).length && !reserved(v.site_id)) ? 'the reservation row could not be saved: nothing is inspected' : 'nothing to inspect today' } }];
