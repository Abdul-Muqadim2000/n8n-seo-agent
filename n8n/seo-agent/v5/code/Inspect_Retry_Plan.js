// R19 (2026-10-14, system review FIX_PLAN.md §3.12): the Search Console calls that failed, sent again once.
// Live (execution 550, docs/system-review-2026-10-14/RESULTS.md §2.4): 31 of 45 URL Inspection calls came back with Google's
// "Internal error encountered." — inside HTTP 200, because *GSC Audit Query* is set to `neverError`, so n8n's retryOnFail never
// saw them. The audit's whole indexing picture then rested on the 14 that answered, and the diff called it an improvement.
//   Only what a second attempt can fix is re-sent (RT.PERMANENT: a permission error, a missing property or an exhausted quota is
// not re-sent, it is reported). Google allows 2,000 inspections a day and 600 a minute per property and the audit asks for at most
// 100, so one more pass stays well inside the quota and costs nothing.
const reqs = (() => { try { return $('GSC Audit Requests').all().map(i => i.json || {}); } catch (e) { return []; } })();
const res = (() => { try { return $('GSC Audit Query').all().map(i => i.json || {}); } catch (e) { return []; } })();
const MAX = 100;
if (!reqs.length || reqs[0].skip || !res.length) return [{ json: { skip: true, reason: 'Search Console was not queried in this run' } }];
const expectOf = (q) => (q && q.kind === 'inspect') ? 'inspectionResult' : '';   // a search-performance query with no data legitimately has no rows
const judged = reqs.map((q, i) => ({ q, i, v: RT.google(res[i], expectOf(q)) }));
const failed = judged.filter(x => !x.v.ok);
const again = failed.filter(x => x.v.retryable).slice(0, MAX);
if (!again.length) return [{ json: { skip: true, reason: failed.length ? 'nothing can be gained by asking again: ' + failed.map(x => x.v.why).slice(0, 2).join('; ') : 'every Search Console call answered',
  failed_total: failed.length, permanent: failed.filter(x => x.v.permanent).map(x => x.v.why).slice(0, 3) } }];
const out = again.map(x => ({ json: { ...x.q, retry_of: x.i, retry_reason: x.v.why, is_retry: true } }));
out[0].json.retry_total = out.length;
out[0].json.failed_total = failed.length;
out[0].json.failed_inspections = failed.filter(x => x.q.kind === 'inspect').length;
return out;
