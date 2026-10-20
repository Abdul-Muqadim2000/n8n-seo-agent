// Cycle Dispatcher: seo_cycle_jobs keeps 120 days (plan §7). The rows last written before the cut-off are deleted; a plan-only or dry run
// deletes nothing.
const p = $('Cycle Plan').first().json;
return p.retention && p.retention.run ? [{ json: { before: p.retention.before, days: p.retention.days } }] : [{ json: { skip: true } }];
