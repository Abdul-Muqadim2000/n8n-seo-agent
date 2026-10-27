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

// B-A5 (2026-10-15, build section 62): the day is not the run. `dfsDay` holds the day's settled rows against the account, which says
// nothing about any single run — a run can be 100% out while the day still agrees, and *Load Run Ledger* ran at RESERVE time, so it
// cannot even see the runs that started after this one. *DFS Balance End* takes a second free `appendix/user_data` reading and
// *Load Run Ledger (Settle)* reloads the rows around this run's window, so the move between this run's two readings is attributed to
// this run when no other row was open across it — and the run keeps its per-task figure, saying why, when one was.
const settled_at = new Date().toISOString();
let __endBalance = 0;
try { const __b = $('DFS Balance End').first().json || {}; const __t = (__b.tasks || [])[0] || {}; const __r = (__t.result || [])[0] || {};
  const __v = Number((__r.money || {}).balance); if (Number.isFinite(__v) && __v > 0) __endBalance = +__v.toFixed(6); } catch (e) {}
let __nowRows = [];
try { __nowRows = $('Load Run Ledger (Settle)').all().map(i => i.json).filter(r => r && r.run_id && !r.error); } catch (e) { __nowRows = __ledgerRows; }
const dfs_run = CC.dfsRun({ rows: __nowRows.length ? __nowRows : __ledgerRows, mine: row, end_balance: __endBalance, settled_at,
  engine_usd: dfs.usd, calls: dfsKnown ? num(led.dataforseo_calls) : null });
if (dfs_run.attributed) {
  // the account is the measurement: it supersedes the per-task sum AND the crawl's pro-rata estimate, so nothing of this run's
  // DataForSEO money is an estimate any more.
  dfs.usd = dfs_run.usd; dfs.measured = true; dfs.measured_usd = dfs_run.usd;
  dfs.basis = dfs_run.basis + ' (its own tasks: ' + dfs.basis + ')';
} else if (dfs_run.comparable) {
  dfs.basis = dfs.basis + '. ' + dfs_run.basis;
}

// R81 part 1 (2026-10-16, re-rating C-5): a monitor request is a HAND-OFF. The front door (this run) reserved a row for `ai_visibility` /
// `backlinks`, started the monitor in its own execution (Monitor Start -> Start AI Visibility / Start Backlink Monitor) and spent nothing
// itself — the monitor reserves and settles its own row, whose key names this run (`parent:<this run>`, R77). This row used to settle the
// per-mode reservation ("$0.5000 ESTIMATED (the per-mode reservation: this branch carries no ledger of its own)", row 91) on top of the
// child's measured figure, so the day counted the request twice ($2.89 reported against $1.48 moved). It now settles $0, `done`, says
// where the money is, and teaches the cost calibration nothing.
const __started = first('Monitor Started');
const __handoff = !!__started && ['ai_visibility', 'backlinks'].includes(String(row.mode || req.mode || ''));
if (__handoff) {
  const __ms = first('Monitor Start') || {};
  const __kind = String(__ms.monitor || row.mode || req.mode || '');
  const __wf = __kind === 'ai_visibility' ? 'the AI Visibility Tracker (SEOagentAIVisib1)' : 'the Backlink Monitor (SEOagentBacklnk1)';
  const __ok = __started.started !== false && !__started.error;
  ai.usd = 0; ai.measured = true; ai.basis = 'no model call ran in this run: the work was handed off';
  dfs.usd = 0; dfs.measured = false; dfs.measured_usd = 0;
  dfs.basis = __ok
    ? 'handed off to ' + __wf + ', started from this run: that run reserves and settles its own ledger row (key parent:' + String($execution.id) + ') and carries this request\'s money, so nothing is counted here'
    : 'the monitor could not be started (' + String(__started.error || 'no execution was started').slice(0, 160) + '), so nothing was spent';
}
const split = CC.split(ai, dfs);
// `cost_mode` is "<Claude estimate key>|<DataForSEO estimate key>" — the two keys whose rolling figures this run settles into
// (Cost Calibration Row). It is on the reserved row already; it is rebuilt from the request when an older row has none.
const cost_mode = String(row.cost_mode || (CC.pick('ai', req).key + '|' + CC.pick('dfs', req).key));
// LLM-LIMITS (2026-10-27): an answer the page writer or the editor cut short (and what the run did about it) is written on the row, first,
// so ops see it without opening the run (the guards' own notes: Draft Check (Copywriter) / Edit Check (Editor), every run of each)
const __llmNotes = (() => { const out = [];
  for (const nd of ['Draft Check (Copywriter)', 'Edit Check (Editor)']) for (let r = 0; r < 12; r++) { let a = null; try { a = $(nd).all(0, r); } catch (e) { break; } if (!a || !a.length) break;
    for (const i of a) { const k = i && i.json && i.json.llm_check; if (k && k.note && !out.includes(k.note)) out.push(k.note); } }
  return out; })();
const __llmNote = __llmNotes.length ? 'Claude answer cut short: ' + __llmNotes.join(' ') + ' ' : '';
const __out = {
  run_id: String($execution.id), mode: String(row.mode || req.mode || ''), status: 'done', cost_mode,
  // the guard counts Claude money, so `settled_usd` stays the Claude figure — now the run's own, not a flat per-mode guess
  settled_usd: ai.usd, ai_usd: ai.usd, ai_measured: ai.measured,
  // R115 (2026-10-16): the measured half of the Claude money, so a callback built from this row can split it (v5/code/_ledger_cb.js)
  ai_measured_usd: +Number(ai.measured_usd || 0).toFixed(4),
  dfs_usd: dfs.usd, dfs_measured: dfs.measured,
  measured_usd: split.measured_usd, estimated_usd: split.estimated_usd,
  // the day's reconciliation rides on the row's own basis line, so nobody has to go looking for it
  cost_basis: (__llmNote + (dfs_day.comparable && !dfs_day.within ? split.cost_basis + '. Day check: ' + dfs_day.basis : split.cost_basis)).slice(0, 500),
  dfs_balance: +Number(row.dfs_balance || 0).toFixed(6), dfs_day_reconciled: dfs_day.comparable && dfs_day.within,
  dfs_day: dfs_day,
  // B-A5: the run's own reconciliation — the second free reading, which figure the row carries and whether the account could answer
  // for this run alone
  settled_at, dfs_balance_end: __endBalance, dfs_source: dfs_run.source, dfs_run,
  dfs_run_reconciled: dfs_run.attributed && dfs_run.within, dfs_tasks_usd: dfsM ? r4(led.dataforseo_usd) : 0,
  // R32: what the crawl was quoted, what it crawled and what it was priced at — the three numbers behind the estimated half.
  // B-A5: when the account answered for this run, the crawl's pro-rata estimate is superseded and NO DataForSEO money is an estimate
  // any more; `crawl_cost` stays on the row as the record of what the crawl was quoted and what it did.
  dfs_estimated_usd: dfs_run.attributed ? 0 : dfsEst, crawl_cost: crawl,
  // for the execution, the callback and anyone reading it: never stored as if it were measured
  ai_calls: fig ? Number(fig.calls) || 0 : 0, ai_in_tokens: fig ? Number(fig.in_tokens) || 0 : 0, ai_out_tokens: fig ? Number(fig.out_tokens) || 0 : 0,
  ai_estimated: !ai.measured, ai_basis: ai.basis, ai_source: ai.source, ai_nodes_ran: ai.ran, ai_nodes_checked: ai.checked,
  ai_by_node: fig ? fig.by_node : {}, ai_models: fig ? fig.models : {},
  ai_streaming_nodes: fig ? (fig.streaming_nodes || []) : [],
};
if (__handoff) {
  // R81: the whole row says one thing — $0 here, the money on the child's row — and nothing on it reads as a measurement to learn from
  Object.assign(__out, { settled_usd: 0, ai_usd: 0, ai_measured: true, ai_measured_usd: 0, dfs_usd: 0, dfs_measured: false, measured_usd: 0, estimated_usd: 0,
    dfs_source: 'handoff', dfs_estimated_usd: 0, dfs_tasks_usd: 0, dfs_run_reconciled: false, dfs_day_reconciled: false,
    ai_calls: 0, ai_in_tokens: 0, ai_out_tokens: 0, ai_by_node: {}, ai_models: {},
    cost_basis: ('Claude $0.0000, DataForSEO $0.0000: ' + dfs.basis).slice(0, 500), handed_off: true });
}
return [{ json: __out }];
