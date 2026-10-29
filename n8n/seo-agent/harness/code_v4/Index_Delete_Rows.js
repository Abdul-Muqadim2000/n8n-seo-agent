// Index coverage (fix wave 1, E4 / X16): the seo_index_pages rows to delete - the old address of a row that moved to its final form (slash,
// case, www: the page itself is kept under its new address, written by Save Index Pages first), and rows pruned as long gone (404 / 410, in
// no source, untouched for 120 days) or as a second copy of the same address. One item per row: { site_id, url }.
const rows = $('Index Diagnose').all().map(i => i.json).filter(x => x && x.site_id).flatMap(x => x.deletes || []);
const seen = new Set(); const out = [];
for (const r of rows) { const k = r.site_id + '|' + r.url; if (!r.url || seen.has(k)) continue; seen.add(k); out.push({ json: { site_id: r.site_id, url: r.url } }); }
return out.length ? out : [{ json: { skip: true, reason: 'no row to delete' } }];
