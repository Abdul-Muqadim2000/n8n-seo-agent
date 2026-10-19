// Cycle Dispatcher (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §4.6): which door the sweep came in by. `init` = n8n has just started (a
// job that was running may have been killed: the plan reads its ledger row and its execution, and retries it); `sweep` = the 5-minute
// schedule; `manual` = a test through *Cycle Run* ({ dry_run?, plan_only?, now? }). A test may move the clock, but only a dry run, which
// writes nothing and starts nothing - so the harness and the time-travel rehearsal can ask "what happens next Wednesday" safely.
let entry = 'sweep', input = {};
try { if ($('Instance Started').first()) entry = 'init'; } catch (e) {}
if (entry === 'sweep') { try { const t = $('Cycle Run').first(); if (t) { entry = 'manual'; input = t.json || {}; } } catch (e) {} }
if (input.body && typeof input.body === 'object') input = { ...input, ...input.body };
const yes = (v) => v === true || /^(true|1|yes|on)$/i.test(String(v ?? ''));
const dry_run = entry === 'manual' && yes(input.dry_run);
const plan_only = entry === 'manual' && yes(input.plan_only);
const moved = dry_run && Number.isFinite(Date.parse(String(input.now || ''))) ? new Date(Date.parse(String(input.now))).toISOString() : '';
const refused_now = !dry_run && String(input.now || '') !== '' ? 'now is honoured only together with dry_run: true (a run that writes must use the real clock), so it was ignored' : '';
return [{ json: { entry, now: moved || new Date().toISOString(), clock_moved: !!moved, dry_run, plan_only, note: refused_now } }];
