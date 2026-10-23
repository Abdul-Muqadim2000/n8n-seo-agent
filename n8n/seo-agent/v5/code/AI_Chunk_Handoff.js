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
// F2 (2026-10-23, ENGINE_AUDIT.md E1 / E11 / E17): this node now also decides when a run must STOP, so that it can never pay twice:
//  * the answers *Save AI Answers* was given (AI Answer Rows) are counted against what it answered: a part whose answers were not all
//    stored stops the run (`failed_store`) - the next part would otherwise find nothing stored and the old code asked the same keys again;
//  * a plan that arrived stopped (a lost part seen twice, or the money ceiling) is written as stopped;
//  * after this part's money the run's ceiling is checked again; a run at its ceiling with questions left stops (`stopped_ceiling`);
//  * a part whose record could not be saved (AI Requests Go) asked nothing; it is alerted and left for the resume.
// Every stop carries an ops alert row (`alerts`, exact seo_ops_alerts columns; recorded before anything is sent and delivered by this
// execution's own alert sweep) and, for an on-demand run, a `rejected` notice to its caller. The state row carries what the next part
// needs: every key sent (`asked_keys`), no `pending` (this part reached its hand-off), the part's wall time and the seconds per request it
// measured (the next part is sized by them), what was lost and whether the next part must be halved.
/*__AI_PANEL__*/
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do && !p.pulse_run && p.chunk);
let go = {}; try { go = ($('AI Requests Go').first() || {}).json || {}; } catch (e) { go = {}; }
const notRecorded = new Set(Array.isArray(go.not_recorded) ? go.not_recorded : []);
let sentRows = [], savedRows = [], saveRan = false; try { sentRows = $('AI Answer Rows').all().map(i => i.json).filter(r => r && !r.skip && r.engine); } catch (e) {}
try { savedRows = $('Save AI Answers').all().map(i => i.json || {}); saveRan = true; } catch (e) { saveRan = false; }
let asking = []; try { asking = $('AI Asking State').all().map(i => i.json).filter(r => r && r.key && !r.skip); } catch (e) {}
const askedAt = (site_id) => { const r = asking.find(x => x.site_id === site_id); const v = r ? AIP.stateOf([r], site_id) : null; return v && v.pending ? Date.parse(v.pending.at) || 0 : 0; };
let reqItems = []; try { reqItems = $('AI Requests').all().map(i => i.json).filter(r => r && r.engine && !r.skip && !/^(market|index)/.test(String(r.prompt_id))); } catch (e) {}
const WF = 'SEO Agent — AI Visibility Tracker';
const alertRow = (p, kind, message, severity) => ({ alert_key: 'ai_run | ' + p.site_id + ' | ' + p.run_id + ' | ' + kind, workflow: WF, node: 'AI Chunk Handoff', message: String(message).slice(0, 800),
  execution_id: String($execution.id), execution_url: '', mode: 'ai_visibility', severity, first_seen_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), count: 1,
  channels: 'data_table', delivered: 'pending', notes: (p.domain + ': run ' + p.run_id + ', part ' + p.chunk.no).slice(0, 500), attempts: 0, last_attempt_at: '', next_attempt_at: new Date().toISOString(), attempt_log: '' });
const callerNotice = (p, sentence) => (p.on_demand && p.callback_url) ? { callback_url: p.callback_url, body: { stage: 'rejected', status: 'rejected', reason: 'run_stopped', error: sentence, request_id: p.request_id || '', domain: p.domain, mode: 'ai_visibility', on_demand: true, run_id: p.run_id, cost_usd: 0 } } : null;
if (!plans.length) return [{ json: { skip: true, reason: 'nothing to hand off' } }];
let info = []; try { info = ($('AI Requests').first().json || {}).chunks || []; } catch (e) {}
let rows = []; try { rows = $('Apply Analysis').all().map(i => i.json).filter(r => !r.skip && r.engine); } catch (e) {}
if (!rows.length) { try { rows = $('Parse AI Answers').all().map(i => i.json).filter(r => !r.skip && r.engine); } catch (e) {} }
let dreq = [], dres = []; try { dreq = $('Discovery Requests').all().map(i => i.json); dres = $('Run Discovery').all().map(i => i.json || {}); } catch (e) {}
const task0 = (r) => ((r || {}).tasks || [])[0] || {};
const dCost = (r) => { const v = Number((r || {}).__dfs_cost_usd); return Number.isFinite(v) ? v : (Number(task0(r).cost) || 0); };
let analyst = 0, writer = 0; try { analyst = $('Analyst Jobs').all().filter(i => !(i.json || {}).skip).length; } catch (e) {}
const analystHere = (site_id) => { try { return $('Analyst Jobs').all().filter(i => !(i.json || {}).skip && (i.json || {}).site_id === site_id).length; } catch (e) { return 0; } }; try { writer = $('Prompt Jobs').all().filter(i => !(i.json || {}).skip).length; } catch (e) {}
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
  let final = !!p.chunk.final_expected;
  const sb = p.spent_before || { dfs: 0, ai: 0 };
  const now0 = Date.now();
  // F2: what this part sent, what it stored, and whether the run must stop
  const sentHere = sentRows.filter(r => r.site_id === p.site_id).length;
  const okSaved = savedRows.filter(r => r && !r.error);
  const savedHere = okSaved.some(r => r.site_id) ? okSaved.filter(r => r.site_id === p.site_id).length : (sentRows.length && okSaved.length >= sentRows.length ? sentHere : 0);
  const keysHere = reqItems.filter(r => r.site_id === p.site_id).map(r => AIP.reqKey(r.prompt_id, r.engine));
  const prevState = p.state_before || {};
  const sentAll = AIP.unpackKeys(prevState.asked_keys); for (const k of keysHere) sentAll.add(k);
  let stop = p.stop ? { ...p.stop } : null;
  const alerts = [], notices = [];
  if (notRecorded.has(p.site_id)) {
    alerts.push(alertRow(p, 'not_recorded', 'AI visibility run ' + p.run_id + ' (' + p.domain + '): ' + (go.reason || 'the run\'s record could not be saved') + '. The part is started again by the next resume.', 'high'));
    out.push({ json: { site_id: p.site_id, domain: p.domain, final: false, state_row: null, next: null, alerts, notices, note: 'part ' + p.chunk.no + ' of run ' + p.run_id + ' asked nothing: its record could not be saved', cost_usd: 0 } });
    continue;
  }
  const saveErr = (savedRows.find(r => r && r.error) || {}).error;
  if (!stop && sentHere > 0 && (!saveRan || savedHere < sentHere))
    stop = { status: 'failed_store', lost: sentHere - savedHere, reason: (sentHere - savedHere) + ' of the ' + sentHere + ' answers of part ' + p.chunk.no + ' could not be stored (seo_ai_answers'
      + (saveErr ? ': ' + String(saveErr.message || saveErr).slice(0, 160) : '') + '). They were paid for and are not asked again (that would pay twice); the run is stopped. Check the Data Table size (N8N_DATA_TABLES_MAX_SIZE_BYTES), then clear ai_run:' + p.site_id + ' to let a new run start.' };
  // 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §15, split jobs): a run of a website's weekly cycle keeps its cycle in its state and in the start
  // of its next execution, so that execution is a cycle run of the SAME cycle (trigger, key, job, monthly, due time) and only the run's last
  // execution settles `cycle:<cycle_key>:ai_visibility`; every earlier part is `…:part<n>` (Monitor_Ledger_Row).
  const cyc = p.cycle && p.cycle.key ? { key: p.cycle.key, date: p.cycle.date || '', job: p.cycle.job || 'ai_visibility', monthly: !!p.cycle.monthly, scheduled_for: p.cycle.scheduled_for || '', request_id: p.cycle.request_id || p.request_id || '', label: p.cycle.label || '' } : null;
  const cycStart = cyc ? { trigger: 'cycle', cycle_key: cyc.key, job: cyc.job, monthly: cyc.monthly, scheduled_for: cyc.scheduled_for } : {};
  const spentDfs = +(Number(sb.dfs || 0) + dfs).toFixed(4);
  const ceiling = Number(p.ceiling_dfs_usd) || Number(prevState.ceiling_dfs_usd) || 0;
  const left = final ? 0 : Number(ci.left_after) || 0;
  if (!stop && !final && ceiling > 0 && left > 0 && spentDfs >= ceiling)
    stop = { status: 'stopped_ceiling', lost: 0, reason: 'the run has spent $' + spentDfs.toFixed(2) + ' of DataForSEO against its ceiling of $' + ceiling.toFixed(2) + ' (1.5 x its own estimate) with ' + left + ' request(s) still to ask. Nothing more is asked; check the prices in the run\'s ledger rows before clearing ai_run:' + p.site_id + '.' };
  if (stop) final = false;
  // the part's wall time (from its record before paying to here) and the seconds one request cost it, the analyst's share taken out
  const t0 = askedAt(p.site_id); const wall_s = t0 ? Math.max(0, Math.round((now0 - t0) / 1000)) : null;
  const asked_now = Number(ci.asked_now || 0);
  const spr = wall_s != null && asked_now >= 20 ? +Math.max(0.3, (wall_s - analystHere(p.site_id) * AIP.TIME.analyst_job_s - AIP.TIME.retry_wait_s) / asked_now).toFixed(2) : (Number(prevState.sec_per_request) || null);
  const st = { ...AIP.baseState(p), cycle: cyc, ceiling_dfs_usd: ceiling || null,
    updated_at: now, chunk: p.chunk.no, status: stop ? stop.status : 'running', finishing: final, stop_reason: stop ? stop.reason : '',
    asked: Number(ci.done_before || 0) + asked_now, total: Number(ci.total) || p.chunk.total_est, left,
    unavailable: Number(((p.state_before || {}).unavailable) || 0) + failed + Number(p.chunk.lost_now || 0),
    lost: Number(p.chunk.lost_total || 0) + (stop && stop.status === 'failed_store' ? Number(stop.lost) || 0 : 0), lost_parts: Number(p.chunk.lost_parts || 0),
    halve_next: false, last_size: Number(p.chunk.size) || null, chunk_wall_s: wall_s, sec_per_request: spr,
    spent_dfs_usd: spentDfs, committed_dfs_usd: spentDfs, spent_ai_usd: +(Number(sb.ai || 0) + aiEst).toFixed(4),
    asked_keys: AIP.packKeys(sentAll), pending: null,
    executions: [...(p.chunk.executions || []), String($execution.id)].slice(-60), resumed: !!p.chunk.resumed };
  if (stop) {
    alerts.push(alertRow(p, stop.status, 'AI visibility run ' + p.run_id + ' (' + p.domain + ') was STOPPED: ' + stop.reason, 'critical'));
    const n = callerNotice(p, 'The AI visibility check of ' + p.domain + ' stopped before it finished: ' + stop.reason.split('. ')[0] + '. Nothing more is charged for it; the team has been alerted.'); if (n) notices.push(n);
  } else if (p.chunk.lost_now) {
    alerts.push(alertRow(p, 'lost_part', 'AI visibility run ' + p.run_id + ' (' + p.domain + '): ' + p.chunk.lost_now + ' request(s) of an earlier part were paid for but never stored (the part stopped before its save: the 60-minute limit or a restart). They are not asked again; this part was halved (' + p.chunk.size + ' requests). A second loss stops the run.', 'high'));
  }
  out.push({ json: { site_id: p.site_id, domain: p.domain, final, state_row: { ...AIP.stateRow(p.site_id, st, now) }, alerts, notices, stopped: !!stop,
    // the next execution's trigger: Manual Run reads domain / site_id like any on-demand start, plus the run it continues
    next: (final || stop) ? null : { continue_run: p.run_id, site_id: p.site_id, domain: p.domain, email: p.email || '', callback_url: p.callback_url || '', request_id: p.request_id || '', parent_run_id: String($execution.id), ...cycStart },
    note: stop ? 'run ' + p.run_id + ' STOPPED (' + stop.status + '): ' + stop.reason : (final ? 'the last part of run ' + p.run_id + ' (' + st.asked + ' of ' + st.total + ' requests asked over ' + st.executions.length + ' execution(s))'
      : 'part ' + p.chunk.no + ' of run ' + p.run_id + ': ' + st.asked + ' of ' + st.total + ' requests asked; the next execution asks the rest')
      + (st.unavailable ? '; ' + st.unavailable + ' could not be read, even when sent again' : ''),
    // the DataForSEO money of a site that continues is stated here (AI Metrics states it for a site that finishes) — the settle sums both
    ...(final ? {} : { cost_usd: dfs }) } });
}
return out;
