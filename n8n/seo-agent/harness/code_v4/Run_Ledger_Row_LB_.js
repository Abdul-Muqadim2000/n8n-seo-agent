// R9 (2026-10-13, re-rating RESULTS §3.2): the daily spend guard saw only the main workflow and the Keyword Check. seo_run_ledger had no row at
// all for the AI Pulse, the Rank Tracker, the Content Cadence, the Link Builder, AI Growth or the Site Tracker (execs 502, 505, 506, 508, 511,
// 515), although the pulse alone cost $0.084 and the monitors accounted for about $0.18 of that run's $0.578 of DataForSEO — so two
// customer-facing runs were refused for AI estimates while the measured money went out unguarded.
// This is the same reservation the main workflow makes (one appended row per execution, settled at the end), hung BESIDE the plan node: a Data
// Table node answers with the row it wrote, not with its input, so the ledger must never sit in the monitor's own data path. The row is for the
// record and for the main workflow's guard, which now sees what the schedules spend; a monitor is never refused by it.
// MODE / EST / HEAVY are written in by the builder at build time (one source: build_monitors.py's WF.run_ledger).
const PLAN = 'LB Plan';
const MODE = 'link_builder';
const EST = {"ai": 0.3, "dfs": 0.05};   // { ai: <usd per site>, dfs: <usd per site>, dfs_full?: <usd per site for a full run> }
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
let rows = [];
try { rows = $(PLAN).all().map(i => i.json || {}).filter(r => !r.nothing_to_do && !r.skip && (r.domain || r.site_id)); } catch (e) { rows = []; }
const full = (r) => EST.dfs_full != null && (String(r.mode || '') === 'full' || r.full === true || r.full_report === true);
const ai = +(n0(EST.ai) * rows.length).toFixed(4);
const dfs = +rows.reduce((s, r) => s + (full(r) ? n0(EST.dfs_full) : n0(EST.dfs)), 0).toFixed(4);
// one site in the run: name it, as the main workflow's reservation does (P34-5 reads `domain` to refuse a second heavy crawl of the same site)
const domain = rows.length === 1 ? String(rows[0].domain || '').toLowerCase() : '';
return [{ json: { run_id: String($execution.id), key: 'schedule:' + MODE, mode: MODE, est_usd: ai, created_at: new Date().toISOString(),
  status: 'reserved', settled_usd: 0, domain, heavy: false, dfs_est_usd: dfs, dfs_usd: 0,
  // G23 (2026-10-13): a row must say which part of its money was measured and which estimated; at reservation time none of it is measured.
  // `cost_mode` is the key of the self-correcting rolling figure in seo_cache (`cost:<kind>:<mode>`) this run will settle into.
  cost_mode: MODE, ai_usd: 0, measured_usd: 0, estimated_usd: +(ai + dfs).toFixed(4),
  cost_basis: 'reserved: Claude $' + ai.toFixed(4) + ' ESTIMATED (' + rows.length + ' site(s) x the per-site figure), DataForSEO $' + dfs.toFixed(4) + ' ESTIMATED - nothing measured yet' } }];
