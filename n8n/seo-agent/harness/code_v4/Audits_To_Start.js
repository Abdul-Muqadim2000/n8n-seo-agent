// Only the audits that are due; the others are listed with the reason they were skipped.
const plan = $('Audit Schedule Plan').all().map(i => i.json); const due = plan.filter(p => p.run && p.body);
return due.length ? due.map(p => ({ json: { body: p.body, domain: p.domain, why: p.why } })) : [{ json: { nothing_to_do: true, skipped: plan.map(p => p.domain + ': ' + p.why) } }];