// G6: one start item per site whose run continues (Manual Run reads domain / site_id + continue_run; parent_run_id keeps the run guard from
// taking this execution's open ledger row for a twin). The state row is saved first, so the next execution finds what is answered.
const out = $('AI Chunk Handoff').all().map(i => (i.json || {}).next).filter(Boolean);
return out.length ? out.map(j => ({ json: j })) : [{ json: { skip: true } }];