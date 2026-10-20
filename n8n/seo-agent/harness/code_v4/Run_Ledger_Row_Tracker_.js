// R9 (2026-10-13, re-rating RESULTS §3.2): the daily spend guard saw only the main workflow and the Keyword Check. seo_run_ledger had no row at
// all for the AI Pulse, the Rank Tracker, the Content Cadence, the Link Builder, AI Growth or the Site Tracker (execs 502, 505, 506, 508, 511,
// 515), although the pulse alone cost $0.084 and the monitors accounted for about $0.18 of that run's $0.578 of DataForSEO — so two
// customer-facing runs were refused for AI estimates while the measured money went out unguarded.
// This is the same reservation the main workflow makes (one appended row per execution, settled at the end), hung BESIDE the plan node: a Data
// Table node answers with the row it wrote, not with its input, so the ledger must never sit in the monitor's own data path. The row is for the
// record and for the main workflow's guard, which now sees what the schedules spend; a monitor is never refused by it.
// MODE / EST / HEAVY are written in by the builder at build time (one source: build_monitors.py's WF.run_ledger).
const PLAN = 'Tracker Plan';
const MODE = 'rank_tracker';
const EST = {"ai": 0.0, "dfs": 0.015};   // { ai: <usd per site>, dfs: <usd per site>, dfs_full?: <usd per site for a full run> }
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
let rows = [];
try { rows = $(PLAN).all().map(i => i.json || {}).filter(r => !r.nothing_to_do && !r.skip && (r.domain || r.site_id)); } catch (e) { rows = []; }
const full = (r) => EST.dfs_full != null && (String(r.mode || '') === 'full' || r.full === true || r.full_report === true);
// R31 (2026-10-14, FIX_PLAN §3.13): a `free_only` run calls no paid API and no model at all — it uses the free sources and our own link
// check ($0, and the callback tells the caller `cost_usd: 0`). It used to reserve the full per-site figure anyway ($0.05 Claude + $0.45
// DataForSEO on exec 586) and then settle the Claude half, so the guard held back money the run could not spend and the ledger said it
// had. A free run reserves nothing.
const free = (r) => r.free_only === true || r.free === true || String(r.mode || '') === 'free';
const paid = rows.filter(r => !free(r));
const freeRows = rows.length - paid.length;
// G6 (2026-10-18): a plan that prices its own sites (the AI Visibility Tracker and the AI Pulse: the exact estimate of THIS panel — up to 500
// questions on up to 9 engines — minus what earlier executions of a split run already spent) is reserved at that figure, not at a flat per-site
// one; the run guard's balance floor then refuses a run the account cannot pay for. Every other plan keeps the per-site figure.
const own = (r, k) => r[k] !== undefined && r[k] !== null && r[k] !== '' && Number.isFinite(Number(r[k]));
const priced = paid.filter(r => own(r, 'est_dfs_usd') || own(r, 'est_ai_usd')).length;
const ai = +paid.reduce((s, r) => s + (own(r, 'est_ai_usd') ? n0(r.est_ai_usd) : n0(EST.ai)), 0).toFixed(4);
const dfs = +paid.reduce((s, r) => s + (own(r, 'est_dfs_usd') ? n0(r.est_dfs_usd) : (full(r) ? n0(EST.dfs_full) : n0(EST.dfs))), 0).toFixed(4);
// one site in the run: name it, as the main workflow's reservation does (P34-5 reads `domain` to refuse a second heavy crawl of the same site).
// 2026-10-19: one site even when the plan emits one item per CHECK (the Rank Tracker of one website: every item carries the same domain), and
// a cycle / on-demand run names its site from the trigger when its plan had nothing to do - the run guard's twin rule is per site now
// (RG.gate `site`) and the Cycle Dispatcher reads the row of a job that ran nothing like any other.
const __doms = [...new Set(rows.map(r => String(r.domain || '').toLowerCase().trim()).filter(Boolean))];
let __trig0 = {};
for (const __n of ['Manual Run', 'Watch Run']) { try { const __t = $(__n).first(); if (__t && __t.json) { __trig0 = __t.json; break; } } catch (e) {} }
if (__trig0.body && typeof __trig0.body === 'object') __trig0 = { ...__trig0, ...__trig0.body };
const __trigDom = String(__trig0.domain || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const domain = __doms.length === 1 ? __doms[0] : (!__doms.length ? __trigDom : '');
// R32: the account balance at the moment this row is reserved, from the free appendix/user_data probe on the ledger chain.
let dfs_balance = 0;
try { const __b = $('DFS Balance (Tracker)').first().json || {}; const __t = (__b.tasks || [])[0] || {}; const __r = (__t.result || [])[0] || {};
  const __v = Number((__r.money || {}).balance); if (Number.isFinite(__v) && __v > 0) dfs_balance = +__v.toFixed(6); } catch (e) {}
// R77 (2026-10-16, re-rating C-1): an on-demand run started by the main workflow's front door carries that run's execution id as
// `parent_run_id` on its trigger item (Monitor Start). The row names it in its key — `parent:<id>` instead of `schedule:<mode>` — so the gate
// (RG.parentOf) does not count the parent's own reserved row as a twin, and the two rows of one request are linked in the table (R81: the
// parent settles $0 as handed off; the money is on this row). A scheduled run has no trigger item and keeps `schedule:<mode>`.
let __trig = {};
for (const __n of ['Manual Run', 'Watch Run']) { try { const __t = $(__n).first(); if (__t && __t.json) { __trig = __t.json; break; } } catch (e) {} }
if (__trig.body && typeof __trig.body === 'object') __trig = { ...__trig, ...__trig.body };
const parent_run_id = String(__trig.parent_run_id == null ? '' : __trig.parent_run_id).trim();
// 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.5 / §14.2 / §15): a run of a website's weekly cycle is keyed `cycle:<cycle_key>:<job>` - the
// Cycle Dispatcher reads exactly that row to know the job is done (settled), refused for capacity (retried without spending an attempt) or
// failed. It is autopilot spend, like `schedule:`. A job that runs in several executions (the AI Visibility Tracker's split run) settles that
// key only in its FINAL execution; every earlier part is `cycle:<cycle_key>:<job>:part<n>`, so a part that finished is never read as the job
// finished. The parent of a continuation is still known to the run guard by the trigger's `parent_run_id`.
const JOB_OF = { ai_visibility: 'ai_visibility', backlinks: 'backlinks', rank_tracker: 'rank_tracker', site_tracker: 'site_tracker', ai_growth: 'ai_growth',
  content_cadence: 'content_cadence', link_builder: 'link_builder', audit_schedule: 'audit', ai_pulse: 'ai_pulse', page_watch: 'page_watch' };
const __cycKey = String(__trig.trigger || '') === 'cycle' ? String(__trig.cycle_key || '').trim() : '';
const __job = String(__trig.job || '').trim() || JOB_OF[MODE] || MODE;
const __part = (() => { const c = (rows[0] || {}).chunk; return c && typeof c === 'object' && c.final_expected === false ? Math.max(1, Number(c.no) || 1) : 0; })();
const __key = __cycKey ? 'cycle:' + __cycKey + ':' + __job + (__part ? ':part' + __part : '') : (parent_run_id ? 'parent:' + parent_run_id : 'schedule:' + MODE);
return [{ json: { run_id: String($execution.id), key: __key, mode: MODE, est_usd: ai, created_at: new Date().toISOString(),
  status: 'reserved', settled_usd: 0, domain, heavy: false, dfs_est_usd: dfs, dfs_usd: 0,
  // R28 (2026-10-14): the DataForSEO balance at reservation time, read for free from appendix/user_data so the day's reported spend can be
  // held against the account. R32 (2026-10-14, FIX_PLAN §3.13): a scheduled run takes the reading too — until now only main-workflow runs
  // did, so a Monday of monitor spend reconciled against nothing at all. One free call per run (not per site); 0 = the probe did not answer.
  dfs_balance,
  // G23 (2026-10-13): a row must say which part of its money was measured and which estimated; at reservation time none of it is measured.
  // `cost_mode` is the key of the self-correcting rolling figure in seo_cache (`cost:<kind>:<mode>`) this run will settle into.
  cost_mode: MODE, ai_usd: 0, measured_usd: 0, estimated_usd: +(ai + dfs).toFixed(4),
  // R31 (2026-10-14): $0 is never called an estimate - a run that reserves nothing says so, with the reason.
  cost_basis: ((ai + dfs) > 0
    ? (priced ? 'reserved: Claude $' + ai.toFixed(4) + ' ESTIMATED (' + priced + ' site(s) priced from their own panel and engines' + (paid.length > priced ? ', ' + (paid.length - priced) + ' at the per-site figure' : '') + '), DataForSEO $' + dfs.toFixed(4) + ' ESTIMATED - nothing measured yet'
      : 'reserved: Claude $' + ai.toFixed(4) + ' ESTIMATED (' + paid.length + ' keyword check(s) x the measured per-check price), DataForSEO $' + dfs.toFixed(4) + ' ESTIMATED - nothing measured yet')
    : 'reserved: nothing - this run spends no model and no paid API money'
    ) + (freeRows ? '; ' + freeRows + ' free-only site(s) reserve nothing (no paid API, no model call)' : ''),
  // B-A5 (2026-10-15, build section 62): filled in by the settle — when it settled, what the account read then, and whether the figure
  // the row carries is the account's ('account') or the run's own tasks' ('tasks').
  settled_at: '', dfs_balance_end: 0, dfs_source: 'tasks' } }];
