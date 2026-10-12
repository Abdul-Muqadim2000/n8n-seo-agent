// 2026-10-12 (FIX_PLAN G9): the next pages of Search Console rows. The first round asked for 25,000 rows per query / page kind; any kind that
// came back FULL has more rows waiting, so this node emits the following pages (startRow = page x 25,000) for it, up to `max_pages` per kind.
// A kind that came back short, or failed, is finished — no request is made for it. Everything is free (Google quota).
const reqs = $('GSC Requests').all().map(i => i.json);
const res = $('GSC Query').all().map(i => i.json);
const out = [];
reqs.forEach((q, i) => {
  if (!q || q.skip || !q.paged) return;
  const r = res[i] || {};
  if (r.error) return;                                     // a failed page is reported by Parse GSC; asking for page 2 of nothing is pointless
  const rows = Array.isArray(r.rows) ? r.rows.length : 0;
  const limit = Number((q.body || {}).rowLimit) || Number(q.page_rows) || 25000;
  if (rows < limit) return;                                // not full: these are all the rows Search Console has
  const maxPages = Math.max(1, Number(q.max_pages) || 4);
  for (let page = 2; page <= maxPages; page++) out.push({ json: { ...q, page, body: { ...q.body, startRow: (page - 1) * limit } } });
});
return out.length ? out : [{ json: { skip: true, reason: 'every Search Console kind returned fewer rows than the page limit' } }];
