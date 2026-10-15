// R116 (2026-10-16, re-rating D-20 / C-1): a refused on-demand run tells the caller that is waiting for it.
// The gate (After Run Ledger) refuses a run before it spends anything and *Refuse Run Ledger* marks the row `refused`. Until now that was
// the end of it: the app had already received "Backlink check started … ready in ~5 min" from the front door, and nothing else ever came
// (request 621, exec 624). Three hours later the app's expiry marked the run failed with "the run may have failed in n8n (ops were
// e-mailed)" — both untrue. Now the refusal sentence reaches the caller as a `rejected` callback, which the app renders and which closes
// the run with that sentence. A scheduled run has nobody waiting (its trigger carries no callback): it posts nothing, and the ledger row
// keeps the reason.
// The Data Table update in front of this node answers with the row it wrote, so the refusal is read from the gate node by name.
let g = {};
try { g = $('After Run Ledger (Cadence)').first().json || {}; } catch (e) { g = {}; }
const S = (v) => String(v == null ? '' : v).trim();
if (!g.run_refused) return [{ json: { skip: true, reason: 'the run was not refused' } }];
if (!S(g.callback_url)) return [{ json: { skip: true, reason: 'a scheduled run was refused: nobody is waiting for it, the ledger row keeps the reason (' + S(g.reason) + ')' } }];
return [{ json: {
  callback_url: S(g.callback_url),
  body: {
    stage: 'rejected', status: 'rejected', error: S(g.refusal), request_id: S(g.request_id),
    domain: S(g.domain), mode: S(g.monitor) || S(g.mode), on_demand: true,
    reason: S(g.reason), basis: S(g.basis), execution_id: S(g.run_id), parent_run_id: S(g.parent_run_id),
    // a refusal happens before the first paid call: nothing was spent, and the callback says so in the field the app reads
    cost_usd: 0, refused_at: S(g.refused_at)
  }
} }];
