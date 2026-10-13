// R9 (2026-10-13): settles this monitor run's seo_run_ledger reservation. `settled_usd` is the AI estimate the row reserved (Claude streams and
// reports no usage — G23), and `dfs_usd` is the DataForSEO cost the run really measured where it knows it: the monitors add up the `cost` of
// every DataForSEO task they sent (AI Metrics / Pulse Metrics / Growth Metrics / Parse Backlinks all carry it as `cost_usd`). A run that
// measures nothing settles its own estimate, and says so, so the figure is never silently invented.
// MEASURED / ROW are written in by the builder at build time.
const ROW = 'Run Ledger Row (Growth)';
const MEASURED = 'Growth Metrics';   // '' when this workflow has no measured figure
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
return [{ json: { run_id: String($execution.id), mode: String(row.mode || ''), status: 'done',
  settled_usd: +Number(row.est_usd || 0).toFixed(4),
  dfs_usd: measured == null ? +Number(row.dfs_est_usd || 0).toFixed(4) : measured,
  dfs_measured: measured != null, dfs_est_usd: +Number(row.dfs_est_usd || 0).toFixed(4) } }];
