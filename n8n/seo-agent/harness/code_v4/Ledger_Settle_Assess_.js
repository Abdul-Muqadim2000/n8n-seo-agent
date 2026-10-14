// R28 (2026-10-14, system review FIX_PLAN §3.12; RESULTS §0 / §2.11): the Keyword Check told the caller `cost_usd: 0.026` and settled its
// seo_run_ledger row with `dfs_usd: 0` and the flat $0.002 reservation — so the one mode that KNOWS what it spent (DataForSEO reports the
// cost of every task it answers, and the Haiku call is a fixed, tiny amount) was the one that threw the figure away. The row is now settled
// with exactly the money the 200 reported, split the way every other settled row is split: `settled_usd` stays the Claude figure (that is
// what ai_budget_usd guards), `dfs_usd` the measured DataForSEO cost, and measured_usd + estimated_usd add up to the caller's `cost_usd`.
//
// It runs on both ends of the request: after *Respond Assess* (the 200) and after *Respond Assess Upstream Error* (the 502, where
// DataForSEO failed — its tasks still report their cost, usually 0, and no model call was made). P1-1's rule is unchanged: the update
// matches `status = reserved`, so a row settles once and a refused row stays refused.
const first = (name) => { try { const it = $(name).first(); return (it && it.json) || null; } catch (e) { return null; } };
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r4 = (v) => +n0(v).toFixed(4);

const row = first('Run Ledger Row (Assess)') || {};
const res = first('Assess Result') || {};
const ans = (first('Assess Response') || {}).body || null;   // null on the 502 path: the answer was never built

// DataForSEO: measured in every case — Assess Result sums the cost of each task of this request's answers (one answer per endpoint,
// nothing polled, so no task can be counted twice here).
const dfs_usd = r4(res.dfs_cost);
const dfs_measured = res.dfs_cost != null;
// Claude: whatever the caller's figure has left over after the DataForSEO cost, which is the Haiku call (or two, when the plain-text retry
// ran). It is a list-price estimate, not reported usage, and says so.
const reported = ans && Number.isFinite(Number(ans.cost_usd)) ? r4(ans.cost_usd) : null;
const ai_usd = reported == null ? 0 : r4(Math.max(0, reported - dfs_usd));
const total = reported == null ? dfs_usd : reported;

const cost_basis = ('Claude $' + ai_usd.toFixed(4) + ' ' + (ai_usd > 0 ? 'ESTIMATED (the Haiku topic-fit call at the list prices)' : 'nothing spent (no model call was made)')
  + '; DataForSEO $' + dfs_usd.toFixed(4) + ' ' + (dfs_measured ? 'measured (the cost every task reported)' : 'ESTIMATED (no task reported a cost)')
  + '; total $' + r4(total).toFixed(4) + (reported == null ? ' — the request failed upstream, so no answer was sent' : ' — the same figure the 200 reported as cost_usd')).slice(0, 500);

return [{ json: {
  run_id: String($execution.id), mode: String(row.mode || 'assess'), status: 'done',
  cost_mode: String(row.cost_mode || 'assess'),
  settled_usd: ai_usd, ai_usd, dfs_usd, dfs_measured,
  dfs_est_usd: r4(row.dfs_est_usd),
  measured_usd: dfs_measured ? dfs_usd : 0,
  estimated_usd: r4(total - (dfs_measured ? dfs_usd : 0)),
  reported_usd: reported,   // what the caller was told; measured_usd + estimated_usd must equal it
  // B-A5 (2026-10-15, section 62): the Keyword Check takes no balance reading (it has to answer in seconds), so it can never be costed
  // against the account — but it MUST stamp when it settled, or every run whose window it touches is treated as having overlapped an
  // open row and loses its own reconciliation.
  settled_at: new Date().toISOString(), dfs_source: 'tasks',
  cost_basis,
} }];
