// R94: what the missed workflow receives on its own manual entry. No domain and no site_id, so its plan runs every site exactly as
// its schedule does (monitorSites, Site Plan, Cadence Plan, Watch Plan: `on_demand` is false); `trigger` and `scheduled_for` say
// which fire this is. Nothing is started unless the record above was saved: no record, no start.
const rec = $('Catch-up Record Row').first().json || {};
const saved = $input.first().json || {};
let v = {}; try { v = JSON.parse(rec.value || '{}'); } catch (e) { v = {}; }
const ok = !saved.error && (saved.key === rec.key || Number(saved.id) > 0) && !!v.workflow_id;
if (!ok) return [{ json: { skip: true, key: rec.key || '', reason: 'the catch-up record could not be saved (' + String((saved.error && (saved.error.message || saved.error)) || 'no row came back').slice(0, 160) + '), so nothing was started' } }];
const payload = { workflow_id: v.workflow_id, trigger: 'catchup', scheduled_for: v.scheduled_for, catchup_key: rec.key };
if (v.dry_run) payload.dry_run = true;   // only the workflows with a dry-run switch are ever started this way (AI Growth, Content Cadence)
return [{ json: payload }];
