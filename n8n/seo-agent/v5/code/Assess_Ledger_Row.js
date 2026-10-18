// v4.14 (FIX_PLAN D1): the Keyword Check's reservation in the run ledger (seo_run_ledger, exact columns; mode 'assess' keeps it out of the main
// workflow's limits), inserted before Assess Limit counts, so parallel requests see each other. est_usd = the Claude Haiku call (~$0.0033, A-28).
const v = $('Assess Validate').first().json || {};
// P34-5: the row carries the site it is about (`heavy` is false: a keyword check crawls nothing), so every seo_run_ledger row has the same shape.
return [{ json: { run_id: String($execution.id), key: String(v.caller || 'anon').toLowerCase(), mode: 'assess', est_usd: 0.0033, created_at: new Date().toISOString(), status: 'reserved', settled_usd: 0,
  domain: String(v.domain || '').toLowerCase(), heavy: false,
  // R9 (2026-10-13): the DataForSEO estimate beside the AI one -- a keyword check pays for the overview, the site's position and (without a
  // stored reach) the reach measurement. G23 recalibrated it from the money: the three checks of 2026-10-13 cost $0.0761 together, so
  // $0.0254 each, and the estimate may never sit below what the mode has recently cost (it was $0.024, under the measured figure).
  dfs_est_usd: 0.034, dfs_usd: 0,
  // R28 (2026-10-14): the main workflow records the DataForSEO balance here so the day can be reconciled against the account; the Keyword
  // Check does not read it (the request is synchronous and must answer in seconds), so its rows carry 0 = not read.
  dfs_balance: 0,
  // G23: which part of a settled row's cost is measured and which is estimated. Nothing is measured at reservation time.
  cost_mode: 'assess', ai_usd: 0, measured_usd: 0, estimated_usd: 0.0373,
  cost_basis: 'reserved: Claude $0.0033 ESTIMATED (one Haiku call, as n8n measured it on 2026-10-17), DataForSEO $0.0340 ESTIMATED (the per-check figure measured on 2026-10-13) - nothing measured yet',
  // B-A5 (2026-10-15, build section 62): a reserved row has not settled, has taken no second balance reading and carries the cost its
  // own tasks report. `settled_at` is stamped by the settle, and it is what lets ANOTHER run tell whether this one overlapped it:
  // a `done` row with no settled_at is treated as having been open the whole time, which is the safe answer, not the useful one.
  settled_at: '', dfs_balance_end: 0, dfs_source: 'tasks' } }];
