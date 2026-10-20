// G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): the hand-off between the executions of one split weekly run. Runs in EVERY execution of the AI
// Visibility Tracker, after this execution's answers are stored (seo_ai_answers, keyed by the run's id), so the next execution — or a resume
// after a crash — can see exactly which questions x engines are answered.
// Per site of this execution it writes the run's state row (seo_cache `ai_run:<site_id>`, kind ai): the run id and kind, when it started,
// which chunk this was, how many of the run's requests are answered, the money spent so far (DataForSEO measured from the tasks; Claude from
// this execution's model calls as the settle prices them — the state only uses it to reserve what is left), and every execution id.
//  * a site whose run is NOT finished gets a start item for the next execution (`continue_run`, its own site, and `parent_run_id` = this
//    execution, so the run guard does not take this execution's open ledger row for a twin) and its execution's DataForSEO money as
//    `cost_usd` (the ledger settles each execution's own spend; AI Metrics states the money of the sites that finish);
//  * a site whose run finishes in this execution keeps status `running` until AI Metrics has written the week, which marks it `done` —
//    a crash between the two leaves a run that the next start resumes (every request is answered, so the resume only computes the week).
/*__AI_PANEL__*/
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do && !p.pulse_run && p.chunk);
if (!plans.length) return [{ json: { skip: true, reason: 'nothing to hand off' } }];
let info = []; try { info = ($('AI Requests').first().json || {}).chunks || []; } catch (e) {}
let rows = []; try { rows = $('Apply Analysis').all().map(i => i.json).filter(r => !r.skip && r.engine); } catch (e) {}
if (!rows.length) { try { rows = $('Parse AI Answers').all().map(i => i.json).filter(r => !r.skip && r.engine); } catch (e) {} }
let dreq = [], dres = []; try { dreq = $('Discovery Requests').all().map(i => i.json); dres = $('Run Discovery').all().map(i => i.json || {}); } catch (e) {}
const task0 = (r) => ((r || {}).tasks || [])[0] || {};
const dCost = (r) => { const v = Number((r || {}).__dfs_cost_usd); return Number.isFinite(v) ? v : (Number(task0(r).cost) || 0); };
let analyst = 0, writer = 0; try { analyst = $('Analyst Jobs').all().filter(i => !(i.json || {}).skip).length; } catch (e) {} try { writer = $('Prompt Jobs').all().filter(i => !(i.json || {}).skip).length; } catch (e) {}
const now = new Date().toISOString();
const out = [];
for (const p of plans) {
  const ci = info.find(x => x.site_id === p.site_id) || { total: p.chunk.total_est, done_before: p.chunk.done, asked_now: 0, left_after: Math.max(0, p.chunk.total_est - p.chunk.done) };
  const mine = rows.filter(r => r.site_id === p.site_id);
  // a request the in-200 gate could not get an answer for, even on its retry, is still a request of the run that was ASKED (it is not asked
  // again — a failed task is billed nothing, and asking it every execution would never end a run); the state counts it apart, and the
  // week's report names it as could not be read
  const failed = mine.filter(r => r.error).length;
  const dfs = +(mine.reduce((s, r) => s + (Number(r.cost) || 0), 0) + dreq.reduce((s, q, i) => s + (q.site_id === p.site_id ? dCost(dres[i]) : 0), 0)).toFixed(4);
  const aiEst = +((analyst * 0.02 + writer * 0.04) / Math.max(1, plans.length)).toFixed(4);   // modelled, only to size what is left to reserve
  const final = !!p.chunk.final_expected;
  const sb = p.spent_before || { dfs: 0, ai: 0 };
  // 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §15, split jobs): a run of a website's weekly cycle keeps its cycle in its state and in the start
  // of its next execution, so that execution is a cycle run of the SAME cycle (trigger, key, job, monthly, due time) and only the run's last
  // execution settles `cycle:<cycle_key>:ai_visibility`; every earlier part is `…:part<n>` (Monitor_Ledger_Row).
  const cyc = p.cycle && p.cycle.key ? { key: p.cycle.key, date: p.cycle.date || '', job: p.cycle.job || 'ai_visibility', monthly: !!p.cycle.monthly, scheduled_for: p.cycle.scheduled_for || '', request_id: p.cycle.request_id || p.request_id || '', label: p.cycle.label || '' } : null;
  const cycStart = cyc ? { trigger: 'cycle', cycle_key: cyc.key, job: cyc.job, monthly: cyc.monthly, scheduled_for: cyc.scheduled_for } : {};
  const st = { run_id: p.run_id, run_kind: p.run_kind, on_demand: !!p.on_demand, full_due: !!p.full_due, request_id: p.request_id || '', email: p.email || '', callback_url: p.callback_url || '', cycle: cyc,
    site_id: p.site_id, domain: p.domain, started_at: p.checked_at, updated_at: now, chunk: p.chunk.no, status: 'running', finishing: final,
    asked: Number(ci.done_before || 0) + Number(ci.asked_now || 0), total: Number(ci.total) || p.chunk.total_est, left: final ? 0 : Number(ci.left_after) || 0,
    unavailable: Number(((p.state_before || {}).unavailable) || 0) + failed,
    spent_dfs_usd: +(Number(sb.dfs || 0) + dfs).toFixed(4), spent_ai_usd: +(Number(sb.ai || 0) + aiEst).toFixed(4),
    executions: [...(p.chunk.executions || []), String($execution.id)].slice(-60), resumed: !!p.chunk.resumed };
  out.push({ json: { site_id: p.site_id, domain: p.domain, final, state_row: { ...AIP.stateRow(p.site_id, st, now) },
    // the next execution's trigger: Manual Run reads domain / site_id like any on-demand start, plus the run it continues
    next: final ? null : { continue_run: p.run_id, site_id: p.site_id, domain: p.domain, email: p.email || '', callback_url: p.callback_url || '', request_id: p.request_id || '', parent_run_id: String($execution.id), ...cycStart },
    note: (final ? 'the last part of run ' + p.run_id + ' (' + st.asked + ' of ' + st.total + ' requests asked over ' + st.executions.length + ' execution(s))'
      : 'part ' + p.chunk.no + ' of run ' + p.run_id + ': ' + st.asked + ' of ' + st.total + ' requests asked; the next execution asks the rest')
      + (st.unavailable ? '; ' + st.unavailable + ' could not be read, even when sent again' : ''),
    // the DataForSEO money of a site that continues is stated here (AI Metrics states it for a site that finishes) — the settle sums both
    ...(final ? {} : { cost_usd: dfs }) } });
}
return out;
