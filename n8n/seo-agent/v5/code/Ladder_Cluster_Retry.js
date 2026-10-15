/*__DFS_RETRY__*/
// B2-4 / INVARIANTS rule 3 (2026-10-15): DataForSEO reports most of its failures INSIDE an HTTP 200 (`status_code` 40101,
// "Internal SE Server Error."), which n8n's retryOnFail never sees - that is R18, the hole a whole ladder was once planned through.
// Every answer here is judged by the shared kit (v5/code/_dfs_retry.js) and what a second attempt can fix is sent once more.
// The retry is itself a paid call, so it is bounded too: at most RETRY_MAX of them, and never a permanent failure (a wrong field, a
// used-up balance), which asking again cannot mend. A keyword whose second attempt fails as well is NOT clustered - `Ladder Clusters`
// names it as "could not be compared" and the plan prints the count.
const RETRY_MAX = 12;
const reqs = $('Ladder Cluster Requests').all().map(i => i.json).filter(r => r && r.cluster_check);
const answers = $input.all().map(i => i.json);
const plan = RT.plan(reqs, answers, { max: RETRY_MAX });
if (!plan.items.length) return [{ json: { no_retry: true, failed: plan.failed, retryable: plan.retryable, skipped: plan.skipped,
  permanent: plan.permanent, reasons: plan.reasons, retry_max: RETRY_MAX } }];
return plan.items.map(q => ({ json: { ...q, retry_max: RETRY_MAX, retry_cost_usd: 0 } }));
