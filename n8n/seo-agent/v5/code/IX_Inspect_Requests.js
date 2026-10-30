// Index coverage: the rest of today's inspections, for websites whose probe answered. A probe that hit Google's DAILY quota or a missing
// access stops that website's inspections for the day (never stored as "not indexed"). Fix wave 1 (E13): a per-minute limit does not - the
// rest goes on, and every page that got the per-minute answer is asked once more a minute later (Inspect Retry Requests).
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const inv = $('Index Inventory').all().map(i => i.json).filter(x => x && x.site_id && !x.failed && !x.no_access);
let pq = []; try { pq = $('Index Probe Requests').all().map(i => i.json).filter(q => q && !q.skip); } catch (e) { pq = []; }
let pr = []; try { pr = $('Inspect URL (Probe)').all().map(i => i.json); } catch (e) { pr = []; }
const stopped = new Set();
pq.forEach((q, i) => { const r = IX.readInspection(pr[i] || {}); if (!r.ok && (r.error_kind === 'quota' || r.error_kind === 'access')) stopped.add(q.site_id); });
const probed = new Set(pq.map(q => q.site_id));
const out = [];
for (const v of inv) {
  if (stopped.has(v.site_id) || !probed.has(v.site_id)) continue;
  for (const t of (v.take || []).slice(IX.CFG.probe_per_site))
    out.push({ json: { site_id: v.site_id, inspect_url: t.url, bucket: t.bucket, body: { inspectionUrl: t.url, siteUrl: v.site.gsc_property, languageCode: 'en-US' } } });
}
return out.length ? out : [{ json: { skip: true, reason: 'nothing more to inspect today', stopped: [...stopped] } }];
