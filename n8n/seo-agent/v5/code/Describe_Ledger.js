// R115 (2026-10-16, re-rating 2026-10-15 D-19): "Describe my website" sent its callback with `run_ledger: null` — the describe branch
// carries no report builder, so nothing priced it before the POST, while *Run Ledger Settle* priced its Haiku call a moment later
// (exec 606: $0.0039 settled, nothing on the callback). The describe branch now goes through the settle first: *Build Description Page*
// feeds the settle chain, and this node — behind *Run Ledger Settle* — hands the description back to *Via Webhook (Describe)?* with the
// settled figure as `run_ledger` (v5/code/_ledger_cb.js). Every other branch of the workflow passes through here with nothing to hand
// back, and returns nothing.
/*__LEDGER_CB__*/
const ran = (n) => { try { const p = $(n); if (p && typeof p.isExecuted === 'boolean') return p.isExecuted; return ((p && p.all()) || []).length > 0; } catch (e) { return false; } };
if (ran('Via Webhook (Describe)?')) return [];
let items = [];
try { items = $('Build Description Page').all() || []; } catch (e) { items = []; }
if (!items.length) return [];
let settled = null;
try { settled = $('Run Ledger Settle').first().json || null; } catch (e) { settled = null; }
const led = settled ? LCB.fromSettle(settled) : null;
return items.map((it) => {
  const j = (it && it.json) || {};
  const out = { json: { ...j, run_ledger: led ? { ...((j.run_ledger && typeof j.run_ledger === 'object') ? j.run_ledger : {}), ...led } : (j.run_ledger || null) } };
  if (it && it.binary) out.binary = it.binary;
  return out;
});
