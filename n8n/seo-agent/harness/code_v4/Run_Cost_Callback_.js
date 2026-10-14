// B-R3 (2026-10-15, build section 63): the engine's own calibrated figure for this run, put on the callback.
// Until today it reached nobody: `run_cost_estimate_usd` existed only inside *Rate Limit* and a sticky note, while the app was built
// to prefer the engine's figure over its own pre-flight table and had nothing to prefer. Every `Build … Response` node builds its
// payload field by field and funnels through *Has Callback?*, so this is the one node that reaches all eleven of them — and the
// twelfth, whenever somebody writes it.
// Rule 1 (INVARIANTS.md): measured, modelled, or not available, and it says which. This figure is MODELLED by definition — what the
// run really spent is `run_ledger`, settled at the end from the tasks it paid for and the model calls it made. It is never called
// anything else here, and when the guard did not price this run the amount is null and the reason travels in its place.
const item = $input.first();
const out = { ...(item.json || {}) };
let rl = null;
try { rl = $('Rate Limit').first().json || null; } catch (e) { rl = null; }
const usd = rl ? Number(rl.run_cost_estimate_usd) : NaN;
if (Number.isFinite(usd) && usd >= 0) {
  out.run_cost_estimate_usd = +usd.toFixed(2);
  out.run_cost_estimate_state = 'modelled';
  out.run_cost_estimate_basis = String(rl.run_cost_estimate_basis || '').slice(0, 400)
    || 'modelled before the run, from what runs of this kind have recently cost';
} else {
  // never a 0 here: 0 is a run that costs nothing, and "we did not price it" is a different statement.
  out.run_cost_estimate_usd = null;
  out.run_cost_estimate_state = 'not_available';
  out.run_cost_estimate_basis = 'not available: this run was never priced by the spend guard'
    + (rl ? ' (it reached the guard but carried no estimate)' : ' (the guard did not run for it)');
}
// files ride on the binary, not the json (the PDF and the Word document of a report): a Code node drops them unless they are returned.
return [{ json: out, binary: item.binary }];