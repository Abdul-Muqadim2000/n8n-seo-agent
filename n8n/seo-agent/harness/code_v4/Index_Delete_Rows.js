// Index coverage (fix wave 1, E4 / X16; fix wave 2, N1 / N10): the seo_index_pages rows to delete - the old address of a row that moved
// (slash, case, www: the page itself is kept under its new address), rows pruned as long gone (404 / 410, in no source, untouched for 120
// days) and a second row of the same address on another form. One item per row: { site_id, url }.
// N1: a moved row's old address is deleted ONLY when its new row is in Save Index Pages' answer (the upsert answers with the rows it saved);
// a save that failed or did not answer keeps the old row, and the next run moves it again. An address that is a row of this run is never
// deleted (Index Diagnose filters those).
const S = (v) => String(v == null ? '' : v).trim();
const rows = $('Index Diagnose').all().map(i => i.json).filter(x => x && x.site_id).flatMap(x => x.deletes || []);
let saved = []; try { saved = $('Save Index Pages').all().map(i => i.json).filter(r => r && !r.error && S(r.url)); } catch (e) { saved = []; }
const savedKeys = new Set(saved.map(r => S(r.site_id) + '|' + S(r.url)));
const seen = new Set(); const out = [];
for (const r of rows) {
  const k = r.site_id + '|' + r.url; if (!r.url || seen.has(k)) continue;
  if (S(r.why) === 'move' && !savedKeys.has(r.site_id + '|' + S(r.keep))) continue;   // no row is deleted before its successor is saved
  seen.add(k); out.push({ json: { site_id: r.site_id, url: r.url } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no row to delete' } }];
