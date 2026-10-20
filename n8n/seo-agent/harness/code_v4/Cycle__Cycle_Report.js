// Cycle Dispatcher: the sweep's record, kept in seo_cache (`cycle:last`; a dry run, a plan-only test or a moved clock writes
// `cycle:last_test` so it never hides the real one). One line per website - its cycle, what each job is doing and why, the next due time
// and preview - plus what this sweep started (or, in plan_only mode, would have started). The dispatcher's successful executions are not
// kept (it runs every 5 minutes), so this row is where an owner reads what it did; seo_cycles / seo_cycle_jobs are what the app reads.
const p = $('Cycle Plan').first().json;
const items = $input.all().map(i => i.json || {});
const started = items.filter(r => r && r.key && r.status && r.run_id).map(r => ({ key: r.key, status: r.status, attempts: r.attempts, reason: String(r.reason || '').slice(0, 200) }));
const skipped = items.filter(r => r && r.skip && r.reason).map(r => ({ key: r.key || '', status: 'not_started', reason: String(r.reason).slice(0, 200) }));
const summary = { entry: p.entry, now: p.now, mode: p.mode, configured_mode: p.configured_mode, mode_reason: p.mode_reason, dry_run: p.dry_run, clock_moved: !!p.clock_moved,
  note: p.note || '', engine_tz: p.engine_tz, counts: p.counts, basis: p.basis, open_jobs: p.open_jobs, live_runs: p.live_runs, room: p.room, adopted: p.adopted,
  started: [...started, ...skipped], would_start: p.would ? (p.would.start || []).map(s => ({ key: s.key, why: s.why })) : [], gave_up: p.gave_up || [],
  unsettled: p.unsettled || [], skipped_init: p.skipped_init || '', exec_reads: p.exec_reads || null,
  // F-REH: other runs' reservations released because n8n says their run is dead (in plan_only: found, not released)
  ghosts: (p.ghosts && p.ghosts.length ? p.ghosts : (p.would && p.would.ghosts) || []).map(g => ({ run_id: g.run_id, mode: g.mode, domain: g.domain, status: g.status, released: !(p.would && p.would.ghosts && p.would.ghosts.length) })),
  sites: (p.sites || []).map(s => ({ site_id: s.site_id, domain: s.domain, verdict: s.verdict, reason: s.reason, cycle_key: s.cycle_key, next_due_at: s.next_due_at,
    next_preview_at: s.next_preview_at, monthly: s.monthly, cycle0: s.cycle0, opened: s.opened || null, skipped_cycle: s.skipped_cycle || null,
    jobs: (s.jobs || []).map(j => ({ job: j.job, verdict: j.verdict, reason: String(j.reason || '').slice(0, 160) })) })) };
const test = p.dry_run || p.plan_only_input || p.clock_moved;
// F-ENG (2026-10-20): an Instance Started door that stood down (a sweep had just finished) keeps its own record, so cycle:last stays the
// last real sweep - the catch-up's watchdog reads its age to know the dispatcher is alive
return [{ json: { key: test ? 'cycle:last_test' : p.skipped_init ? 'cycle:last_init_skip' : 'cycle:last', kind: 'cycle', site_id: '', value: JSON.stringify(summary).slice(0, 30000), updated_at: new Date().toISOString() } }];
