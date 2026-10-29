// Index coverage: the first URL Inspection requests of each website (IX.CFG.probe_per_site). Google's quota and access answers come back on the
// first call, so a website whose probe says "quota used up" or "no access" asks nothing more today (Inspect Requests), and the rest of its plan
// is reported as not checked. 150 ms between calls (at most 400 a minute, under Google's 600).
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const inv = $('Index Inventory').all().map(i => i.json).filter(x => x && x.site_id && !x.failed && !x.no_access);
const out = [];
for (const v of inv) for (const t of (v.take || []).slice(0, IX.CFG.probe_per_site))
  out.push({ json: { site_id: v.site_id, inspect_url: t.url, bucket: t.bucket, body: { inspectionUrl: t.url, siteUrl: v.site.gsc_property, languageCode: 'en-US' } } });
return out.length ? out : [{ json: { skip: true, reason: 'nothing to inspect today' } }];
