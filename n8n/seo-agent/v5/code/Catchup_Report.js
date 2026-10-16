// R94: the run's record, kept in seo_cache (`catchup:last`; a dry run or a plan-only test writes `catchup:last_test` so it never hides
// the real one). One line per schedule: its last due time and what became of it - fired (and how late), caught up, late but still
// held by the schedule, missed and started, missed and waiting, or not readable - with the reason. The executions of this workflow
// are not kept on success (it runs every hour), so this row is where an owner or the app reads what the catch-up did.
const p = $('Catch-up Plan').first().json;
const parse = (s) => { try { return JSON.parse(s || '{}'); } catch (e) { return {}; } };
const results = $input.all().map(i => i.json || {}).filter(r => String(r.key || '').startsWith('catchup') && r.value)
  .map(r => ({ key: r.key, ...parse(r.value) })).map(v => ({ key: v.key, workflow_id: v.workflow_id, scheduled_for: v.scheduled_for, status: v.status, error: v.error || '', attempts: v.attempts }));
const skipped = $input.all().map(i => i.json || {}).filter(r => r.skip && r.reason).map(r => ({ key: r.key || '', status: 'not_started', error: r.reason }));
const summary = { entry: p.entry, now: p.now, tz: p.tz, armed_at: p.armed_at, instance_started_at: p.instance_started_at, dry_run: p.dry_run, plan_only: p.plan_only,
  clock_moved: !!p.clock_moved, open_runs: p.open_runs, room: p.room, counts: p.counts, basis: p.basis, started: [...results, ...skipped],
  schedules: (p.rows || []).map(r => ({ workflow_id: r.workflow_id, label: r.label, due: r.due, verdict: r.verdict, reason: r.reason })) };
const test = p.dry_run || p.plan_only || p.clock_moved;
return [{ json: { key: test ? 'catchup:last_test' : 'catchup:last', kind: 'catchup', site_id: '', value: JSON.stringify(summary).slice(0, 30000), updated_at: new Date().toISOString() } }];
