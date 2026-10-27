/*__COMPLETE__*/
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
//
// B-A5 (2026-10-15, build section 62): the day was reconciled against the account, the RUN never was — and a run cannot say what it
// truly cost unless it happens to be the only one in flight. *DFS Balance End (…)* takes a second free `appendix/user_data` reading on
// the settle chain and *Load Run Ledger (…)* loads the rows around this run's window, so CC.dfsRun can attribute the move between the
// two readings to this run when no other row was open across it — and say so plainly when one was.
//
// B-C2 (2026-10-15, build section 84): and the Claude half stops being a reservation in the clothes of a measurement. R31 settled
// `row.est_usd` whenever any model node had run, which is the GUARD's figure and not this run's. Anthropic's free
// `/v1/messages/count_tokens` now sits on the MAIN path behind every agent of this workflow (*Prompt For Count (…)* →
// *Count Prompt (…)* → *Count Answer (…)* → *After Count (…)*), and AI_CALLS below — baked from this workflow's own agent nodes —
// says how to price each one. See the block itself for what stays modelled and why.
// MEASURED / ROW / AI_NODES / BAL_END / LEDGER / AI_CALLS / CAL are written in by the builder at build time.
/*__COST_CAL__*/
const ROW = '__ROW__';
const MEASURED = '__MEASURED__';   // '' when this workflow has no measured figure
const AI_NODES = __AI_NODES__;     // every Claude node of this workflow (the agents a model node is wired to), '[]' when it calls none
const BAL_END = '__BAL_END__';     // the free balance probe on the settle chain
const LEDGER = '__LEDGER__';       // the run-ledger rows around this run's window
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
let row = {}; try { row = $(ROW).first().json || {}; } catch (e) { row = {}; }
// R82 (2026-10-16, re-rating C-6): MEASURED may name several nodes ('A|B'), and a leading '!' says they are EVERY paid DataForSEO call of
// this workflow — so a run in which none of them ran sent no paid task and settles $0, instead of the per-mode reservation (the Site
// Tracker settled $0.0100 "ESTIMATED" while its SERP checks and Trends lookups reported $0.0310, row 98). A gated call's *… Answers* node
// carries the call's whole cost on every item's `__dfs` (`cost_usd`: both attempts, each task once by its own id), so that figure is read
// ONCE per node — never added up per item, and never read as one item's cost.
const MEASURED_ALL = MEASURED.charAt(0) === '!';
const MEASURED_NODES = MEASURED.replace(/^!/, '').split('|').map(s => s.trim()).filter(Boolean);
const costOf = (x) => {
  if (!x || typeof x !== 'object') return null;
  const direct = n0(x.cost_usd); if (direct != null) return direct;
  for (const k of Object.keys(x)) { if (k === '__dfs') continue; const v = x[k]; if (v && typeof v === 'object' && !Array.isArray(v)) { const n = n0(v.cost_usd); if (n != null) return n; } }
  return null;
};
let measured = null;
for (const __mn of MEASURED_NODES) {
  let __items = null;
  try { __items = $(__mn).all().map(i => i.json || {}); } catch (e) { __items = null; }   // this call did not run in this execution
  if (!__items) continue;
  // a node that states its own cost (AI Metrics, Pulse Metrics, Parse Backlinks, Growth Metrics) is read as it always was
  const __direct = __items.map(costOf).filter(v => v != null);
  const __gate = __items.find(j => j && j.__dfs && typeof j.__dfs === 'object' && n0(j.__dfs.cost_usd) != null);
  const vals = __direct.length ? __direct : (__gate ? [n0(__gate.__dfs.cost_usd)] : []);
  if (vals.length) measured = +((measured || 0) + vals.reduce((s, v) => s + v, 0)).toFixed(4);
}
if (measured == null && MEASURED_ALL && MEASURED_NODES.length) measured = 0;   // none of this workflow's paid calls ran: it sent no paid task
// which Claude nodes actually ran in THIS execution (a node that never ran has no data and throws)
const ranAi = AI_NODES.filter(n => { try { return ($(n).all() || []).length > 0; } catch (e) { return false; } });

// ---- B-C2: what Claude really cost this run, counted by the tokeniser that bills it ----------------------------------------------
// Until today a monitor settled the per-mode RESERVATION whenever a model node had run: a guard figure, labelled ESTIMATED, standing
// in for a measurement nobody took. AI_CALLS is this workflow's own Claude agents, baked from the model nodes at build time (so a
// renamed or added agent reaches the money), and for each one the two FREE probes on the main path behind it: the prompt the run really
// rendered, and that prompt plus the answer it really got. The difference is the answer's own tokens.
//   * a monitor agent answers once per SITE (one job item each), so every call is counted and the counts are SUMMED; `rounds` says how
//     many calls the sum covers, and `callCost` refuses a pair that does not cover the same number of calls — their difference would
//     not be this node's answer tokens.
//   * the THINKING a model does before answering is billed as output and is never returned by any counter. It stays modelled from the
//     node's effort budget and is the only estimate left in a counted call (INVARIANTS rule 1: the basis says exactly that).
//   * a probe that did not answer leaves its call on prompt/answer CHARACTERS with that basis — a count that failed is never a
//     measurement, and the counter can never fail the run (neverError + continueRegularOutput + the retry rule).
// With no table at all (a workflow whose builder has not been taught this) AI_CALLS is `[]`, nothing is priced and the settle keeps the
// reservation exactly as R31 left it.
const AI_CALLS = /*__AI_CALLS__*/[];
const CAL = /*__CAL__*/'';   // the stored per-model correction factors the monthly reconciliation writes ('' when this workflow reads none)
const __jsonOf = (n, idx) => { try { return ((idx == null ? $(n).all() : $(n).all(idx)) || []).map(i => (i && i.json) || {}); } catch (e) { return null; } };
const __chars = (v) => v == null ? 0 : (typeof v === 'string' ? v.length : JSON.stringify(v).length);
const __at = (o, p) => String(p).split('.').reduce((v, k) => (v == null ? v : v[k]), o);
const __countOf = (n) => { let sum = 0, k = 0; for (const j of (__jsonOf(n) || [])) { const v = Number((j || {}).input_tokens); if (Number.isFinite(v) && v > 0) { sum += v; k++; } } return { sum: sum, n: k }; };
// R57 (2026-10-16, re-rating A-24): an agent n8n re-ran after a failed answer (its parser refused the format; `retryOnFail`) called its model
// twice and kept ONE answer, so `answers.length` priced one call. The model node itself records every call it made as a run of its own;
// a Code node cannot read that node's data (it rides `ai_languageModel`, not `main`), but `$node[…].runIndex` is the index of its last run.
const __modelRuns = (n) => { try { if (!n || typeof $node === 'undefined') return 0; const r = Number($node[n].runIndex); return Number.isFinite(r) && r >= 0 ? r + 1 : 0; } catch (e) { return 0; } };
const __costCalls = [];
// LLM-LIMITS (2026-10-27): an answer that stopped before its end (its JSON cut off) or that could not be read even after n8n's one retry is
// never a silent empty answer: every one is named on the row's basis line, first, so ops see it (CK.answer, v5/code/_complete.js)
const __llmCut = [];
for (const c of AI_CALLS) {
  const answers = __jsonOf(c.node);
  if (!answers || !answers.length) continue;   // this agent did not run in this execution
  { let bad = 0, why = ''; for (const a of answers) { const k = CK.answer(a, 'json'); if (!k.complete) { bad++; why = why || k.reason; } }
    if (bad) __llmCut.push(c.node + ' ' + bad + ' of ' + answers.length + ' (' + why + ')'); }
  // an n8n agent answers once per input item, and these are fed one job per site — plus any retry its model node recorded (R57)
  const __answered = answers.length, __runs = __modelRuns(c.model_node);
  const calls = Math.max(__answered, __runs);
  // the characters are the FALLBACK, and they are read per call: the job items differ per site, so one item's fields are not the run's.
  // The output index is spelled out — `$('X').all()` would otherwise default to the output the ACTIVE node is connected to, and the
  // settle is connected to none of these (the trap that caught build section 62 out with *Keyword Seeds* on output 1).
  const fed = c.input ? (__jsonOf(c.input, c.branch) || []) : [];
  let prompt_chars = 0;
  for (let k = 0; k < __answered; k++) {
    let pc = c.template_chars;
    const own = fed[k] || fed[0] || {};
    for (const f of (c.fields || [])) pc += __chars(__at(own, f));
    prompt_chars += pc;
  }
  for (const p of (c.from || [])) prompt_chars += __chars(__at((__jsonOf(p[0]) || [])[0] || {}, p[1])) * __answered;
  const output_chars = answers.reduce((s, j) => s + (typeof j.output === 'string' ? j.output.length : __chars(j)), 0);
  let counted = null;
  if (c.count_prompt && c.count_answer) {
    const p = __countOf(c.count_prompt), t = __countOf(c.count_answer), cap = Number(c.count_rounds || 0);
    if (p.n > 0 && p.n === t.n && p.sum > 0 && t.sum > p.sum && (!cap || p.n <= cap))
      counted = { prompt_tokens: p.sum, total_tokens: t.sum, rounds: p.n, source: 'Anthropic /v1/messages/count_tokens' };
  }
  __costCalls.push({ node: c.node, model: c.model, max_tokens: c.max_tokens, think_model: c.think_model, effort: c.effort, streaming: c.streaming,
    prompt_chars, output_chars, counted, calls, retries: Math.max(0, calls - __answered) });
}
// the same per-model correction factors the main workflow prices with, so one engine reports one price (seo_cache `cost:factor:claude`,
// written by reconcile_claude_cost.py). Unreadable or absent, the list prices stand.
let __factors = {};
if (CAL) { try { __factors = CC.readCal(($(CAL).all() || []).map(i => i.json).filter(r => r && r.key && !r.error)).factors; } catch (e) { __factors = {}; } }
const aiFig = __costCalls.length ? CC.runCost(__costCalls, __factors) : null;
// G23 (2026-10-13): the settled row says which part of its money was measured and which is an estimate.
const ai = CC.aiRun({ figure: aiFig, reserved: row.est_usd, ran: ranAi, checked: AI_NODES.length });
const ai_usd = ai.usd;
const taskUsd = measured == null ? (n0(row.dfs_est_usd) || 0) : measured;

// ---- B-A5: this run against the account, when the account can answer for this run alone ----
const settled_at = new Date().toISOString();
let endBalance = 0;
try { const b = $(BAL_END).first().json || {}; const t = (b.tasks || [])[0] || {}; const r = (t.result || [])[0] || {};
  const v = Number((r.money || {}).balance); if (Number.isFinite(v) && v > 0) endBalance = +v.toFixed(6); } catch (e) {}
let ledgerRows = [];
try { ledgerRows = $(LEDGER).all().map(i => i.json).filter(r => r && r.run_id && !r.error); } catch (e) { ledgerRows = []; }
// `calls`: this workflow reports a measured figure only when it sent paid tasks, so a measured $0 means it sent none and the account
// cannot be charged to it. A workflow with no measured figure at all passes null and the other guards decide.
const dfsAtt = CC.dfsRun({ rows: ledgerRows, mine: row, end_balance: endBalance, settled_at, engine_usd: taskUsd,
  calls: measured == null ? null : (measured > 0 ? 1 : 0) });

const dfs_usd = dfsAtt.attributed ? dfsAtt.usd : taskUsd;
const taskBasis = measured == null ? 'this workflow reports no cost of its own' : 'the cost of every task it sent';
// the reconciliation only speaks when it has something to say: both readings taken. Nothing is added to the row when the account was
// never read, because "we could not check" is not information the customer needs on every free run.
const dfs = { usd: dfs_usd, measured: dfsAtt.attributed || measured != null,
  basis: dfsAtt.attributed ? dfsAtt.basis + ' (its own tasks: ' + taskBasis + ')'
    : dfsAtt.comparable ? taskBasis + '. ' + dfsAtt.basis : taskBasis };
const split = CC.split(ai, dfs);
return [{ json: { run_id: String($execution.id), mode: String(row.mode || ''), status: 'done',
  settled_usd: ai_usd, ai_usd, ai_measured: ai.measured, ai_basis: ai.basis, ai_source: ai.source,
  ai_nodes_ran: ranAi, ai_nodes_checked: AI_NODES.length,
  // B-C2: what the counter answered for, so a reader can tell a measurement from a model without reading the basis
  ai_calls: aiFig ? aiFig.calls : 0, ai_counted_nodes: aiFig ? aiFig.counted_nodes : [],
  ai_measured_usd: ai.measured_usd, ai_measured_share: aiFig ? aiFig.measured_share : null,
  ai_think_usd: aiFig ? aiFig.think_usd : 0, ai_by_node: aiFig ? aiFig.by_node : {},
  cost_mode: String(row.cost_mode || row.mode || ''),
  dfs_usd: +Number(dfs_usd).toFixed(4), dfs_measured: dfs.measured, dfs_est_usd: +Number(row.dfs_est_usd || 0).toFixed(4),
  // B-A5: what the account said about THIS run, and which figure the row therefore carries
  settled_at, dfs_balance_end: endBalance, dfs_source: dfsAtt.source, dfs_run: dfsAtt, dfs_tasks_usd: +Number(taskUsd).toFixed(4),
  measured_usd: split.measured_usd, estimated_usd: split.estimated_usd, cost_basis: (__llmCut.length ? 'Claude answer incomplete: ' + __llmCut.join('; ') + '. ' : '') + split.cost_basis } }];
