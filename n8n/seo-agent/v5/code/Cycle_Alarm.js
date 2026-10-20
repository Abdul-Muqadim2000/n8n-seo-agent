// Cycle Dispatcher: a job that gave up this sweep (three failed attempts, 24 h of capacity refusals, or an account that cannot pay) is
// the owner's to know about - and so is a run that FINISHED with its ledger row left reserved (F-ENG 2026-10-20: its settle failed, so its
// money is not on record; the job is marked done and never run again, and this is the one place that says so, the sweep its job turns done).
// The run fails with the reason, so the Error Handler raises the ops alert on its two channels (seo_ops_alerts first, then the webhook and
// the e-mail, deduped for 30 minutes) - the same path the catch-up's watchdog uses. It is the last node of the sweep: every row is written
// and every start made by then. A plan-only or dry run never alarms.
const p = $('Cycle Plan').first().json;
const g = (p.gave_up || []), u = (p.unsettled || []);
if ((g.length || u.length) && p.mode === 'start' && !p.dry_run) {
  const parts = [];
  if (g.length) parts.push(g.length + ' cycle job(s) gave up and will not run this cycle: '
    + g.slice(0, 5).map(x => x.domain + ' ' + x.job + ' (' + String(x.reason || '').slice(0, 160) + ')').join('; ') + (g.length > 5 ? '; and ' + (g.length - 5) + ' more' : '')
    + '. The rest of each cycle carries on; seo_cycle_jobs has the full reasons.');
  if (u.length) parts.push(u.length + ' cycle run(s) finished but left their run-ledger row unsettled, so their spend is not on record (check the run\'s settle node and the provider\'s usage): '
    + u.slice(0, 5).map(x => (x.domain || x.site_id) + ' ' + x.job + ' (execution ' + x.run_id + ', ' + x.ledger_key + ', reserved ' + x.reserved_at + ')').join('; ') + (u.length > 5 ? '; and ' + (u.length - 5) + ' more' : '')
    + '. Each is marked done and not run again; its reservation was released.');
  throw new Error('Cycle Dispatcher: ' + parts.join(' '));
}
return [{ json: { gave_up: 0, unsettled: 0, counts: p.counts || {} } }];
