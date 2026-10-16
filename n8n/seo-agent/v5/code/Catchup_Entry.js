// R94 (2026-10-16): which door the catch-up came in by. `init` = n8n has just started (every schedule was re-armed for its NEXT time,
// so a fire that was due and not delivered is certainly lost); `sweep` = the hourly check (a fire may only be late); `manual` = a test
// through *Catch-up Run* ({ dry_run?, plan_only?, now? }). A test may move the clock, but only for a plan that starts nothing.
let entry = 'sweep', input = {};
try { if ($('Instance Started').first()) entry = 'init'; } catch (e) {}
if (entry === 'sweep') { try { const t = $('Catch-up Run').first(); if (t) { entry = 'manual'; input = t.json || {}; } } catch (e) {} }
if (input.body && typeof input.body === 'object') input = { ...input, ...input.body };
const yes = (v) => v === true || /^(true|1|yes|on)$/i.test(String(v ?? ''));
const plan_only = entry === 'manual' && yes(input.plan_only);
const moved = plan_only && Number.isFinite(Date.parse(String(input.now || ''))) ? new Date(Date.parse(String(input.now))).toISOString() : '';
return [{ json: { entry, now: moved || new Date().toISOString(), clock_moved: !!moved, dry_run: entry === 'manual' && yes(input.dry_run), plan_only } }];
