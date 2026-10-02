// What was started (each audit delivers its own report, diff and fix pack by e-mail / callback).
const plan = $('Audit Schedule Plan').all().map(i => i.json);
return [{ json: { started: plan.map(p => p.domain), skipped: (plan[0] || {}).skipped || [], at: new Date().toISOString() } }];