// G23 (2026-10-13, FIX_PLAN; RESULTS §2.10): what this run really cost, split into measured and estimated money, in one place before the
// seo_run_ledger row is settled. Until now `settled_usd` stored the per-mode RESERVATION and every reader — the guard, the app, the
// re-rating — took it for a measured cost; the three Opus nodes stream, so no token usage is reported at all and Claude's spend could be
// stated no closer than "$1.6-3.0". The report builders now price every Claude call from the characters its prompt really interpolated, the
// characters it answered with and the thinking budget of its effort level (v5/code/_cost_cal.js, on `run_ledger.ai_cost`), and this node
// writes that figure, the measured DataForSEO cost, the split and the one line that says which half is which.
//
// R33 (2026-10-14, FIX_PLAN §3.13): that pricing reached only the five report builders, so every other branch settled its RESERVATION —
// `describe` (exec 591) settled $0.06 where its own Haiku node reported 4,874 / 1,306 tokens = $0.0114, with `ai_measured: false` and
// "this branch priced no model call of its own". The same per-call pricing now runs HERE, over this run's own Claude nodes, so `describe`,
// `track`, `profile`, `published`, `checkin` and `case_study` settle what they used. R31: a run in which no model node ran at all settles
// **nothing** for Claude instead of the figure it reserved (CC.aiRun).
/*__COST_CAL__*/
const ENDS = __ENDS__;   // the nodes that carry run_ledger (the five report builders), written in at build time
const first = (name) => { try { const it = $(name).first(); return (it && it.json) || null; } catch (e) { return null; } };
const row = first('Run Ledger Row') || {};
const req = first('Rate Limit') || first('Normalize Input') || {};
let led = null;
for (const n of ENDS) { const j = first(n); if (j && j.run_ledger) { led = j.run_ledger; break; } }
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const r4 = (v) => +Number(num(v) || 0).toFixed(4);

// ---- Claude: this run's own calls, priced from what the run can see ----
// R33: the block below is written in by build_v4.py section 59 — the same call table the report builders use, baked from the real model
// nodes, so a branch that ends anywhere else still prices every Claude node that ran in it.
let __ownAi = null, __aiRan = [], __aiChecked = 0;
/*__RUN_AI_COST__*/
// Part of a content run IS measured (the Sonnet calls report usage) while its three streaming Opus nodes can only be estimated, so the
// run figure's own split travels through rather than the whole amount being labelled one or the other.
const fig = (led && led.ai_cost && num(led.ai_cost.calls) > 0) ? led.ai_cost : (__ownAi && num(__ownAi.calls) > 0 ? __ownAi : (led && led.ai_cost) || null);
const ai = CC.aiRun({ figure: fig, reserved: row.est_usd, ran: __aiRan, checked: __aiChecked });

// ---- DataForSEO: measured whenever a paid node answered with a cost, except the crawl, which is only ever quoted ----
// R32 (2026-10-14, FIX_PLAN §3.13): the on_page crawl is billed for the pages it crawls and DataForSEO reports only the quote for the
// pages it was ASKED for, so the report builders price it pro rata (CC.crawlCost) and hand the estimated part over as
// `run_ledger.dataforseo_estimated_usd`. Everything else in the figure is the cost each task reported.
// R31's shape on the DataForSEO side: a run whose ledger says no paid node ran spent nothing, and settles nothing — the reservation is
// only fallen back on where this branch carries no ledger at all and the run therefore cannot know.
const dfsKnown = !!(led && num(led.dataforseo_calls) != null);
const dfsM = dfsKnown && num(led.dataforseo_calls) > 0 && num(led.dataforseo_usd) != null;
const dfsEst = dfsM ? r4(led.dataforseo_estimated_usd) : 0;
const crawl = (led && led.crawl_cost) || null;
const dfs = { usd: dfsM ? r4(led.dataforseo_usd) : (dfsKnown ? 0 : r4(row.dfs_est_usd)), measured: dfsKnown && dfsEst <= 0,
  measured_usd: dfsM ? Math.max(0, r4(r4(led.dataforseo_usd) - dfsEst)) : 0,
  basis: dfsM
    ? ('the cost every DataForSEO task reported' + (dfsEst > 0 && crawl ? '; the crawl is priced from the pages it crawled — ' + String(crawl.basis || '') : ''))
    : dfsKnown ? 'no DataForSEO call ran in this run, so nothing is settled against the $' + r4(row.dfs_est_usd).toFixed(4) + ' it reserved'
    : r4(row.dfs_est_usd) > 0 ? 'the per-mode reservation: this branch carries no ledger of its own' : 'no DataForSEO money was reserved or spent' };

// R28 (2026-10-14, FIX_PLAN §3.12): the engine's own "measured" DataForSEO figures did not reconcile with the account — +73% in one window
// of the 2026-10-14 run, +11.6% in another. Every reservation now records the free `appendix/user_data` balance reading (*DFS Balance* ->
// seo_run_ledger.dfs_balance), so the day's settled rows can be held against the only measurement that cannot be argued with: how far the
// balance actually fell. Nothing is corrected automatically; when the two disagree the row says so and names the account as the truth.
let __ledgerRows = []; try { __ledgerRows = $('Load Run Ledger').all().map(i => i.json).filter(r => r && r.run_id && !r.error); } catch (e) {}
const dfs_day = CC.dfsDay(__ledgerRows, row);

const split = CC.split(ai, dfs);
// `cost_mode` is "<Claude estimate key>|<DataForSEO estimate key>" — the two keys whose rolling figures this run settles into
// (Cost Calibration Row). It is on the reserved row already; it is rebuilt from the request when an older row has none.
const cost_mode = String(row.cost_mode || (CC.pick('ai', req).key + '|' + CC.pick('dfs', req).key));
return [{ json: {
  run_id: String($execution.id), mode: String(row.mode || req.mode || ''), status: 'done', cost_mode,
  // the guard counts Claude money, so `settled_usd` stays the Claude figure — now the run's own, not a flat per-mode guess
  settled_usd: ai.usd, ai_usd: ai.usd, ai_measured: ai.measured,
  dfs_usd: dfs.usd, dfs_measured: dfs.measured,
  measured_usd: split.measured_usd, estimated_usd: split.estimated_usd,
  // the day's reconciliation rides on the row's own basis line, so nobody has to go looking for it
  cost_basis: (dfs_day.comparable && !dfs_day.within ? split.cost_basis + '. Day check: ' + dfs_day.basis : split.cost_basis).slice(0, 500),
  dfs_balance: +Number(row.dfs_balance || 0).toFixed(6), dfs_day_reconciled: dfs_day.comparable && dfs_day.within,
  dfs_day: dfs_day,
  // R32: what the crawl was quoted, what it crawled and what it was priced at — the three numbers behind the estimated half
  dfs_estimated_usd: dfsEst, crawl_cost: crawl,
  // for the execution, the callback and anyone reading it: never stored as if it were measured
  ai_calls: fig ? Number(fig.calls) || 0 : 0, ai_in_tokens: fig ? Number(fig.in_tokens) || 0 : 0, ai_out_tokens: fig ? Number(fig.out_tokens) || 0 : 0,
  ai_estimated: !ai.measured, ai_basis: ai.basis, ai_source: ai.source, ai_nodes_ran: ai.ran, ai_nodes_checked: ai.checked,
  ai_by_node: fig ? fig.by_node : {}, ai_models: fig ? fig.models : {},
  ai_streaming_nodes: fig ? (fig.streaming_nodes || []) : [],
} }];
