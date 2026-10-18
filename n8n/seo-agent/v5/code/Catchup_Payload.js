// R94: what the missed workflow receives on its own manual entry. No domain and no site_id, so its plan runs every site exactly as
// its schedule does (monitorSites, Site Plan, Cadence Plan, Watch Plan: `on_demand` is false); `trigger` and `scheduled_for` say
// which fire this is. Nothing is started unless the record above was saved: no record, no start.
// C-1 (re-rating 2026-10-17): two more refusals, both leaving the record "starting" so the next sweep decides again (the planner retries a
// "starting" record no run followed - CU.plan):
//  * the plan is stale - the VM was paused between the plan and this start (exec 728 sat 44 minutes in one short node); what the plan read
//    (who fired, what is running) may no longer be true, so it is not acted on;
//  * the claim is not ours - *Confirm Claim* read the record back after the save, and another sweep's execution id is on it (two sweeps
//    racing: the last writer starts the fire, the other one stands down).
// The payload also carries `why` and `late_min`, so the started run's report can say it ran late and why (CU.lateRun, Callback Ledger).
/*__CATCHUP__*/
const rec = $('Catch-up Record Row').first().json || {};
let saved = {}; try { saved = $('Save Catch-up Record').first().json || {}; } catch (e) { saved = {}; }
const back = $input.all().map(i => i.json || {}).find(r => r && r.key === rec.key) || null;
let v = {}; try { v = JSON.parse(rec.value || '{}'); } catch (e) { v = {}; }
const ok = !saved.error && (saved.key === rec.key || Number(saved.id) > 0) && !!v.workflow_id;
if (!ok) return [{ json: { skip: true, key: rec.key || '', reason: 'the catch-up record could not be saved (' + String((saved.error && (saved.error.message || saved.error)) || 'no row came back').slice(0, 160) + '), so nothing was started' } }];
let plan = {}; try { plan = $('Catch-up Plan').first().json || {}; } catch (e) { plan = {}; }
if (CU.stalePlan(plan.now, Date.now(), CU.DEFAULTS.stale_plan_minutes))
  return [{ json: { skip: true, key: rec.key, reason: 'the sweep was paused after it planned (plan of ' + String(plan.now || '?') + ', now ' + new Date().toISOString() + '; the computer slept) - nothing is started from a plan that old; the next sweep decides again' } }];
let bv = {}; try { bv = back ? JSON.parse(back.value || '{}') : {}; } catch (e) { bv = {}; }
if (back && bv.claim && String(bv.claim) !== String(v.claim))
  return [{ json: { skip: true, key: rec.key, reason: 'another catch-up sweep (execution ' + bv.claim + ') claimed this fire at the same time, so this one stands down' } }];
const payload = { workflow_id: v.workflow_id, trigger: 'catchup', scheduled_for: v.scheduled_for, catchup_key: rec.key, why: v.why || '', late_min: Number(v.late_min) || 0,
  started_at: new Date().toISOString() };
if (v.dry_run) payload.dry_run = true;   // only the workflows with a dry-run switch are ever started this way (AI Growth, Content Cadence)
return [{ json: payload }];
