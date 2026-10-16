// R115 (2026-10-16, re-rating 2026-10-15 D-19): the callback waits for the settle and carries what it settled.
// *Ledger Join (…)* (a Merge node, append) holds the callback items that reached it (input 0) until the settle's answer (input 1) is there
// too — n8n's v1 order runs a two-input node only when both inputs have data — so this node runs after the settle and puts the settled
// figure on every callback item as `run_ledger` (v5/code/_ledger_cb.js has the shape).
// Each run of the Join carries exactly the callback items of ONE arrival, so every item is posted once: the Content Cadence has two
// builders (Cadence Note, Cadence Status) that one weekly run can both use, and a branch that reaches the settle twice sends a second
// settle answer with no callback items behind it — that run posts nothing. When n8n has nothing else left to run it releases a Join that
// still waits for the settle (the settle failed): the report still goes out, saying it carries no settled figure.
// SETTLE / PREDS / HAS_CALLBACK are written in by monitor_cost.callback_after_settle() at build time.
/*__LEDGER_CB__*/
const SETTLE = '__SETTLE__';
const PREDS = __PREDS__;          // [[node, output index], …] — the nodes that build the callback items (recorded for the build's proof)
const HAS_CALLBACK = '__HAS_CALLBACK__';
// the settle's own answer rides input 1; a callback item never carries these two ledger columns
const isSettle = (j) => !!j && Object.prototype.hasOwnProperty.call(j, 'settled_usd') && Object.prototype.hasOwnProperty.call(j, 'cost_mode');
const all = $input.all();
const items = all.filter((it) => !isSettle((it && it.json) || null));
if (!items.length) return [];
let settled = (all.find((it) => isSettle((it && it.json) || null)) || {}).json || null;
if (!settled) { try { settled = $(SETTLE).first().json || null; } catch (e) { settled = null; } }
const run_ledger = settled ? LCB.fromSettle(settled)
  : { settled: false, cost_basis: 'this run could not be settled, so no cost figure is given (see the run ledger row)' };
return items.map((it) => {
  const out = { json: { ...((it && it.json) || {}), run_ledger } };
  if (it && it.binary) out.binary = it.binary;
  return out;
});
