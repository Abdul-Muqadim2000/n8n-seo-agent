// Index status per inspected URL: verdict PASS = indexed; coverage state, last crawl, canonical mismatch, robots.txt state.
const reqs = $('Inspect Requests').all().map(i => i.json);
const res = $input.all().map(i => i.json);
const gErr = (r) => { if (!r) return 'no response'; const e = r.error; if (!e) return null; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return String((inner && inner.message) || (ctx.error_description ? String(ctx.error || 'error') + ': ' + ctx.error_description : '') || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200); };   // Google errors: the useful text sits in context.data (invalid_grant: account not found) or in error.message (PERMISSION_DENIED)
return reqs.filter(q => !q.skip).map((q, i) => {
  const r = res[i] || {}; const ir = (r.inspectionResult || {}).indexStatusResult || null;
  const err = r.error ? gErr(r) : (ir ? null : 'no inspection result');
  return { json: { site_idx: q.site_idx, site_id: q.site_id, url: q.inspect_url, keyword: q.keyword, rung: q.rung, status: q.status, error: err,
    verdict: ir ? ir.verdict || '' : '', indexed: ir ? ir.verdict === 'PASS' : null, coverage: ir ? ir.coverageState || '' : '', indexing_state: ir ? ir.indexingState || '' : '', robots: ir ? ir.robotsTxtState || '' : '',
    last_crawl: ir ? ir.lastCrawlTime || '' : '', canonical_ok: ir ? (!ir.googleCanonical || !ir.userCanonical || ir.googleCanonical === ir.userCanonical) : null, google_canonical: ir ? ir.googleCanonical || '' : '' } };
});
