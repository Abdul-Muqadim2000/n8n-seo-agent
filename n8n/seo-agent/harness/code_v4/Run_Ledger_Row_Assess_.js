// v4.14 (FIX_PLAN D1): the Keyword Check's reservation in the run ledger (seo_run_ledger, exact columns; mode 'assess' keeps it out of the main
// workflow's limits), inserted before Assess Limit counts, so parallel requests see each other. est_usd = the Claude Haiku call (~$0.002).
const v = $('Assess Validate').first().json || {};
// P34-5: the row carries the site it is about (`heavy` is false: a keyword check crawls nothing), so every seo_run_ledger row has the same shape.
return [{ json: { run_id: String($execution.id), key: String(v.caller || 'anon').toLowerCase(), mode: 'assess', est_usd: 0.002, created_at: new Date().toISOString(), status: 'reserved', settled_usd: 0,
  domain: String(v.domain || '').toLowerCase(), heavy: false } }];
