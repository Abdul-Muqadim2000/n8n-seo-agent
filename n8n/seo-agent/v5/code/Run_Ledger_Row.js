// v4.14 (2026-10-11, FIX_PLAN D1): this execution's reservation in the run ledger (seo_run_ledger, exact columns), inserted BEFORE Rate Limit
// counts. Parallel executions used to overwrite each other's static-data counters (8 app runs and 3 spawns counted as 5, $0.67 of ≈ $3.0);
// with one appended row per run, Rate Limit counts every row with a lower id than this one. The key and the Claude estimate below are the
// Rate Limit's own lines, copied in by build_v4.py at build time (one source: a mode added there reaches this node automatically).
const d = $('Normalize Input').first().json || {};
/*__KEY__*/
/*__EST__*/
return [{ json: { run_id: String($execution.id), key, mode: String(d.mode || ''), est_usd: +Number(est || 0).toFixed(4), created_at: new Date().toISOString(), status: 'reserved', settled_usd: 0 } }];
