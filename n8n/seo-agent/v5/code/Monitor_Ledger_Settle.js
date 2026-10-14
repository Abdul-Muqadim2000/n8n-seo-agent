// R9 (2026-10-13): settles this monitor run's seo_run_ledger reservation. `dfs_usd` is the DataForSEO cost the run really measured where it
// knows it: the monitors add up the `cost` of every DataForSEO task they sent (AI Metrics / Pulse Metrics / Growth Metrics / Parse Backlinks
// all carry it as `cost_usd`). A run that measures nothing says so, so the figure is never silently invented.
//
// R31 (2026-10-14, FIX_PLAN §3.13): the Claude figure used to be `row.est_usd` unconditionally — so the `free_only` backlink check of
// exec 586 settled $0.05 of Claude although **no model node ran at all** (the Link Analyst's queue was empty), while telling the caller
// `cost_usd: 0`. The ledger and the customer-facing figure have to be the same number. AI_NODES is every Claude node of this workflow,
// written in at build time from the workflow itself; when none of them produced anything in this execution the run settles **nothing**
// for Claude and says why (CC.aiRun). When one did run, the figure is still the reservation and is still labelled an ESTIMATE: a monitor's
// agents report no token usage, which is the whole reason _cost_cal.js exists.
// MEASURED / ROW / AI_NODES are written in by the builder at build time.
/*__COST_CAL__*/
const ROW = '__ROW__';
const MEASURED = '__MEASURED__';   // '' when this workflow has no measured figure
const AI_NODES = __AI_NODES__;     // every Claude node of this workflow (the agents a model node is wired to), '[]' when it calls none
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
let row = {}; try { row = $(ROW).first().json || {}; } catch (e) { row = {}; }
const costOf = (x) => {
  if (!x || typeof x !== 'object') return null;
  const direct = n0(x.cost_usd); if (direct != null) return direct;
  for (const k of Object.keys(x)) { const v = x[k]; if (v && typeof v === 'object' && !Array.isArray(v)) { const n = n0(v.cost_usd); if (n != null) return n; } }
  return null;
};
let measured = null;
if (MEASURED) {
  try {
    const vals = $(MEASURED).all().map(i => costOf(i.json)).filter(v => v != null);
    if (vals.length) measured = +vals.reduce((s, v) => s + v, 0).toFixed(4);
  } catch (e) { measured = null; }
}
// which Claude nodes actually ran in THIS execution (a node that never ran has no data and throws)
const ranAi = AI_NODES.filter(n => { try { return ($(n).all() || []).length > 0; } catch (e) { return false; } });
// G23 (2026-10-13): the settled row says which part of its money was measured and which is an estimate.
const ai = CC.aiRun({ figure: null, reserved: row.est_usd, ran: ranAi, checked: AI_NODES.length });
const ai_usd = ai.usd;
const dfs_usd = measured == null ? (n0(row.dfs_est_usd) || 0) : measured;
const dfs = { usd: dfs_usd, measured: measured != null,
  basis: measured == null ? 'this workflow reports no cost of its own' : 'the cost of every task it sent' };
const split = CC.split(ai, dfs);
return [{ json: { run_id: String($execution.id), mode: String(row.mode || ''), status: 'done',
  settled_usd: ai_usd, ai_usd, ai_measured: ai.measured, ai_basis: ai.basis, ai_source: ai.source,
  ai_nodes_ran: ranAi, ai_nodes_checked: AI_NODES.length,
  cost_mode: String(row.cost_mode || row.mode || ''),
  dfs_usd: +Number(dfs_usd).toFixed(4), dfs_measured: measured != null, dfs_est_usd: +Number(row.dfs_est_usd || 0).toFixed(4),
  measured_usd: split.measured_usd, estimated_usd: split.estimated_usd, cost_basis: split.cost_basis } }];
