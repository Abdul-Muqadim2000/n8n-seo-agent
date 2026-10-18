// R115 (2026-10-16, re-rating 2026-10-15 D-19 / C-4 / C-5): what a run's SETTLED ledger row says, in the shape a callback carries it.
// A monitor's callback used to carry only the report item's `cost_usd` — DataForSEO money alone — and the app showed it as the run's
// complete "actual" cost (623: "$0.78 · actual" for a run whose Claude calls the ledger priced at $0.0678 more). The settle is the one
// place that knows both halves, measured and estimated, so the callback carries what the settle computed, in the field names the main
// workflow's callbacks already use (`run_ledger.dataforseo_usd`, `ai_usd`, `ai_cost`, `ai_cost_estimated`):
//   { dataforseo_usd, dataforseo_estimated_usd, ai_usd, ai_cost: { usd, measured_usd, estimated_usd, estimated }, ai_cost_estimated,
//     cost_basis, settled: true }
// Rule 1 (INVARIANTS.md): a run whose model calls were NOT priced (the settle fell back to the per-mode reservation) omits `ai_usd` and
// says so in `ai_cost.basis` — 0 would read as "no model call", which is a different statement. A run with genuinely no model call
// sends `ai_usd: 0`.
const LCB = (() => {
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const r4 = (v) => +(num(v) || 0).toFixed(4);
  const fromSettle = (s) => {
    const x = s || {};
    const dfs = r4(x.dfs_usd);
    // the estimated half of the DataForSEO money: all of it when the settle could not measure it (a reservation), else the part the
    // settle marked estimated (a crawl priced pro rata), never more than the whole
    const dfsEst = x.dfs_measured === false ? dfs : Math.min(dfs, r4(x.dfs_estimated_usd));
    const src = String(x.ai_source || '');
    const reported = src === 'priced' || src === 'none';
    const ai = r4(x.ai_usd);
    const aiMeasured = Math.min(ai, r4(x.ai_measured_usd != null ? x.ai_measured_usd : (x.ai_measured === true ? ai : 0)));
    const out = { dataforseo_usd: dfs, dataforseo_estimated_usd: r4(dfsEst) };
    if (reported) {
      const est = r4(ai - aiMeasured);
      out.ai_usd = ai;
      out.ai_cost = { usd: ai, measured_usd: aiMeasured, estimated_usd: est, estimated: est > 0, basis: String(x.ai_basis || '').slice(0, 400) };
      out.ai_cost_estimated = est > 0;
    } else {
      out.ai_cost = { measured_usd: 0, estimated: true, reported: false,
        basis: ('not priced: the model calls of this run could not be priced here (' + String(x.ai_basis || 'no figure') + '), so no Claude figure is given').slice(0, 400) };
      out.ai_cost_estimated = true;
    }
    out.cost_basis = String(x.cost_basis || '').slice(0, 500);
    out.settled = true;
    out.settled_at = String(x.settled_at || '');
    out.dfs_source = String(x.dfs_source || '');
    out.run_id = String(x.run_id || '');
    return out;
  };
  return { fromSettle };
})();
