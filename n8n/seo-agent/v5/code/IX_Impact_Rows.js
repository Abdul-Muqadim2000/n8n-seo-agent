// Index coverage: one seo_update_impact row per website and finished update (exact columns): dropped / stable / gained pages, the pages that
// moved (dropped first, at most 30) with their state and cause today, and one plain sentence. A side that could not be read writes nothing.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const nowIso = new Date().toISOString();
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const reqs = grab('Update Impact Requests').filter(q => q && !q.skip);
const res = grab('GSC Impact Query');
const events = (grab('Google Events')[0] || {}).events || [];
const sites = grab('Index Sites').filter(s => s && s.site_id);
const diag = grab('Index Diagnose').filter(x => x && x.site_id);
const pairs = new Map();
reqs.forEach((q, i) => { const k = q.site_id + '|' + q.event_id; const e = pairs.get(k) || { q }; const r = res[i] || {}; e[q.side] = (r.error || !r) ? null : (r.rows || []); pairs.set(k, e); });
const out = [];
for (const e of pairs.values()) {
  if (!e.before || !e.after) continue;
  const q = e.q; const ev = events.find(x => x.event_id === q.event_id) || {}; const site = sites.find(s => s.site_id === q.site_id) || {};
  const rows = (diag.find(d => d.site_id === q.site_id) || {}).all || [];
  const cmp = IX.impactCompare(e.before, e.after, site, rows);
  const w = q.windows;
  out.push({ json: { site_id: q.site_id, domain: S(site.domain), event_id: q.event_id, event_title: S(ev.title), compared_at: nowIso, before_from: w.before_from, before_to: w.before_to,
    after_from: w.after_from, after_to: w.after_to, pages: cmp.pages, dropped: cmp.dropped, stable: cmp.stable, gained: cmp.gained,
    pages_json: JSON.stringify(cmp.pages_json), note: IX.impactNote(ev, cmp, w) } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no comparison this run' } }];
