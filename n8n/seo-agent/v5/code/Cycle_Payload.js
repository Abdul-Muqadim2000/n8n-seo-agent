// Cycle Dispatcher: what the job's workflow receives on its own Manual Run - the §14.2 payload, exactly (SCHEDULING_KEYWORDS_PLAN.md):
// { trigger: 'cycle', domain, site_id, cycle_key, job, monthly, scheduled_for, request_id, light? (backlinks), preview? (the preview) }.
// Scheduled semantics for one website: on_demand false, its switched-off jobs and its pause honoured, the monthly extras only when
// `monthly`, its spend recorded under the ledger key `cycle:<cycle_key>:<job>`. Nothing is started unless:
//  * the record above was saved (no record, no start);
//  * the plan is fresh - a sweep paused between its plan and this start (the VM slept) does not act on what it read then (C-1);
//  * the claim read back is ours - when two sweeps raced, the last writer starts the job and the other one stands down.
// Each refusal leaves the row `starting`: the next sweep finds no run behind it after 10 minutes and starts it again (attempt + 1).
/*__CATCHUP__*/
const STALE_PLAN_MINUTES = __STALE_PLAN_MINUTES__;
const rec = $('Cycle Record Row').first().json || {};
let saved = {}; try { saved = $('Save Cycle Record').first().json || {}; } catch (e) { saved = {}; }
const back = $input.all().map(i => i.json || {}).find(r => r && r.key === rec.key) || null;
const ok = !saved.error && (saved.key === rec.key || Number(saved.id) > 0) && !!rec.workflow_id;
if (!ok) return [{ json: { skip: true, key: rec.key || '', reason: 'the job row could not be saved (' + String((saved.error && (saved.error.message || saved.error)) || 'no row came back').slice(0, 160) + '), so nothing was started' } }];
let plan = {}; try { plan = $('Cycle Plan').first().json || {}; } catch (e) { plan = {}; }
if (CU.stalePlan(plan.now, Date.now(), STALE_PLAN_MINUTES))
  return [{ json: { skip: true, key: rec.key, reason: 'the sweep was paused after it planned (plan of ' + String(plan.now || '?') + ', now ' + new Date().toISOString() + ') - nothing is started from a plan that old; the next sweep decides again' } }];
if (!back) return [{ json: { skip: true, key: rec.key, reason: 'the job row could not be read back after the save, so it is not started (a start nobody can confirm is never made); the next sweep decides again' } }];
if (String(back.run_id || '') !== String(rec.run_id || ''))
  return [{ json: { skip: true, key: rec.key, reason: 'another dispatcher sweep (' + String(back.run_id || '?') + ') claimed this job at the same time, so this one stands down' } }];
const s = (plan.start || []).find(x => x && x.key === rec.key);
if (!s || !s.payload) return [{ json: { skip: true, key: rec.key, reason: 'the plan has no start for this job (it changed between the plan and the start), so nothing was started' } }];
return [{ json: { ...s.payload } }];
