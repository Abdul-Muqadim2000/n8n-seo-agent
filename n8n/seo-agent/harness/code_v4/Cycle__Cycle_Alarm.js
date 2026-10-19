// Cycle Dispatcher: a job that gave up this sweep (three failed attempts, 24 h of capacity refusals, or an account that cannot pay) is
// the owner's to know about. The run fails with the reason, so the Error Handler raises the ops alert on its two channels (seo_ops_alerts
// first, then the webhook and the e-mail, deduped for 30 minutes) - the same path the catch-up's watchdog uses. It is the last node of the
// sweep: every row is written and every start made by then. A plan-only or dry run never alarms.
const p = $('Cycle Plan').first().json;
const g = (p.gave_up || []);
if (g.length && p.mode === 'start' && !p.dry_run)
  throw new Error('Cycle Dispatcher: ' + g.length + ' cycle job(s) gave up and will not run this cycle: '
    + g.slice(0, 5).map(x => x.domain + ' ' + x.job + ' (' + String(x.reason || '').slice(0, 160) + ')').join('; ') + (g.length > 5 ? '; and ' + (g.length - 5) + ' more' : '')
    + '. The rest of each cycle carries on; seo_cycle_jobs has the full reasons.');
return [{ json: { gave_up: 0, counts: p.counts || {} } }];
