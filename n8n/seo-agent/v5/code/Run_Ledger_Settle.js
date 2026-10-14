// G23 (2026-10-13, FIX_PLAN; RESULTS §2.10): what this run really cost, split into measured and estimated money, in one place before the
// seo_run_ledger row is settled. Until now `settled_usd` stored the per-mode RESERVATION and every reader — the guard, the app, the
// re-rating — took it for a measured cost; the three Opus nodes stream, so no token usage is reported at all and Claude's spend could be
// stated no closer than "$1.6-3.0". The report builders now price every Claude call from the characters its prompt really interpolated, the
// characters it answered with and the thinking budget of its effort level (v5/code/_cost_cal.js, on `run_ledger.ai_cost`), and this node
// writes that figure, the measured DataForSEO cost, the split and the one line that says which half is which.
/*__COST_CAL__*/
const ENDS = __ENDS__;   // the nodes that carry run_ledger (the five report builders), written in at build time
const first = (name) => { try { const it = $(name).first(); return (it && it.json) || null; } catch (e) { return null; } };
const row = first('Run Ledger Row') || {};
const req = first('Rate Limit') || first('Normalize Input') || {};
let led = null;
for (const n of ENDS) { const j = first(n); if (j && j.run_ledger) { led = j.run_ledger; break; } }
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const r4 = (v) => +Number(num(v) || 0).toFixed(4);

// ---- Claude: the per-call figure where the run produced one, otherwise the reservation (and it says so) ----
const fig = led && led.ai_cost ? led.ai_cost : null;
// Part of a content run IS measured (the Sonnet calls report usage) while its three streaming Opus nodes can only be estimated, so the
// run figure's own split travels through rather than the whole amount being labelled one or the other.
const ai = fig && (num(fig.calls) > 0)
  ? { usd: r4(fig.usd), measured: fig.estimated === false, measured_usd: r4(fig.measured_usd), basis: String(fig.basis || '') }
  : { usd: r4(row.est_usd), measured: false, measured_usd: 0, basis: 'the per-mode reservation: this branch priced no model call of its own' };

// ---- DataForSEO: measured whenever a paid node answered with a cost, otherwise the reservation ----
const dfsM = !!(led && num(led.dataforseo_usd) != null && num(led.dataforseo_calls) > 0);
const dfs = { usd: dfsM ? r4(led.dataforseo_usd) : r4(row.dfs_est_usd), measured: dfsM,
  basis: dfsM ? 'the cost every DataForSEO task reported' : 'the per-mode reservation: no DataForSEO task reported a cost in this run' };

const split = CC.split(ai, dfs);
// `cost_mode` is "<Claude estimate key>|<DataForSEO estimate key>" — the two keys whose rolling figures this run settles into
// (Cost Calibration Row). It is on the reserved row already; it is rebuilt from the request when an older row has none.
const cost_mode = String(row.cost_mode || (CC.pick('ai', req).key + '|' + CC.pick('dfs', req).key));
return [{ json: {
  run_id: String($execution.id), mode: String(row.mode || req.mode || ''), status: 'done', cost_mode,
  // the guard counts Claude money, so `settled_usd` stays the Claude figure — now the run's own, not a flat per-mode guess
  settled_usd: ai.usd, ai_usd: ai.usd, ai_measured: ai.measured,
  dfs_usd: dfs.usd, dfs_measured: dfs.measured,
  measured_usd: split.measured_usd, estimated_usd: split.estimated_usd, cost_basis: split.cost_basis,
  // for the execution, the callback and anyone reading it: never stored as if it were measured
  ai_calls: fig ? Number(fig.calls) || 0 : 0, ai_in_tokens: fig ? Number(fig.in_tokens) || 0 : 0, ai_out_tokens: fig ? Number(fig.out_tokens) || 0 : 0,
  ai_estimated: !ai.measured, ai_basis: ai.basis, ai_by_node: fig ? fig.by_node : {}, ai_models: fig ? fig.models : {},
  ai_streaming_nodes: fig ? (fig.streaming_nodes || []) : [],
} }];
