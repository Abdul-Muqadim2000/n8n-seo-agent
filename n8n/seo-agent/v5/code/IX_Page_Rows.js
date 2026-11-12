// Index coverage: the seo_index_pages rows that changed in this run, exact columns (the upsert maps every input field). Unchanged rows are not
// written again.
// Wave 3 (DESIGN_WAVE3.md §2.3): when IndexNow accepted today's list for a website (200 / 202 from Submit IndexNow (Index)), every page of
// that list gets indexnow_at = now (a page that did not change otherwise is written for that alone); any other answer records nothing.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const diag = grab('Index Diagnose').filter(x => x && x.site_id);
const reqs = grab('IndexNow Submit Requests (Index)').filter(q => q && !q.skip && q.site_id);
const ans = grab('Submit IndexNow (Index)');
const nowIso = new Date().toISOString();
const rows = [];
for (const d of diag) {
  const up = (d.upserts || []).map(r => ({ ...r }));
  const i = reqs.findIndex(q => q.site_id === d.site_id);
  if (i >= 0 && IX.indexnowAccepted(ans[i])) {
    const sent = new Set((reqs[i].urls || []).map(S));
    const byUrl = new Map(up.map(r => [S(r.url), r]));
    for (const r of ((d.indexnow || {}).rows || [])) if (sent.has(S(r.url)) && !byUrl.has(S(r.url))) { const c = { ...r }; up.push(c); byUrl.set(S(c.url), c); }
    for (const u of sent) { const r = byUrl.get(u); if (r) { r.indexnow_at = nowIso; r.updated_at = nowIso; } }
  }
  rows.push(...up.map(r => { const o = {}; for (const k of IX.PAGE_COLS) o[k] = r[k]; return o; }));
}
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'no page changed' } }];
