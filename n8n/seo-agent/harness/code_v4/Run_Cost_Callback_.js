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
// F-L (2026-10-18, re-rating 2026-10-17 C-1 follow-up): a scheduled audit the Audit Scheduler started late carries `ran_late` (CU.lateRun,
// computed in the scheduler; Normalize Input keeps it for a scheduled request only), and its report says so the way every monitor's
// Callback Ledger does: `ran_late` on the callback (the app titles it "ran late"), the box first in the HTML, the tag on the subject.
let __late = null; try { __late = ($('Normalize Input').first().json || {}).ran_late || null; } catch (e) { __late = null; }
if (__late && __late.late === true) {
  out.ran_late = __late;
  const __esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const __box = '<div class="ran-late" style="border:1px solid #b45309;background:#fffbeb;color:#78350f;padding:10px 14px;margin:0 0 14px;font:14px/1.5 sans-serif"><strong>Ran late.</strong> ' + __esc(__late.text) + '</div>';
  for (const k of ['html', 'report_html']) if (typeof out[k] === 'string' && out[k]) out[k] = /<body[^>]*>/i.test(out[k]) ? out[k].replace(/<body[^>]*>/i, (b) => b + __box) : __box + out[k];
  if (typeof out.subject === 'string' && out.subject && !/\(ran late/.test(out.subject)) out.subject = out.subject + ' (ran late — due ' + String(__late.due || '').slice(0, 10) + ')';
}
// files ride on the binary, not the json (the PDF and the Word document of a report): a Code node drops them unless they are returned.
return [{ json: out, binary: item.binary }];