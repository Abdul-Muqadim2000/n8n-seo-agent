// What was started (each audit delivers its own report, diff and fix pack) and what was skipped, with the reason.
const plan = $('Audit Schedule Plan').all().map(i => i.json);
return [{ json: { started: plan.filter(p => p.run).map(p => p.domain + ': ' + p.why), skipped: plan.filter(p => !p.run).map(p => p.domain + ': ' + p.why), at: new Date().toISOString() } }];