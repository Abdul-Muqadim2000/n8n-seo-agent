// C-16: after three re-activations in a row failed (and every fourth after that, so the owner is not paged every 15 minutes) the run
// fails with the reason, so the Error Handler raises the ops alert on its two channels: the mail watcher is not listening and the engine
// could not bring it back. It is the last node of the sweep, so every catch-up start of the run has already happened.
// F-ENG (2026-10-20): the Cycle Dispatcher's watchdog alarms here too (inactive, or no sweep for 20 minutes; at most every 6 hours): no
// website's cycle is being started. Both reasons go into one failure, so neither hides the other.
let v = {}; try { v = JSON.parse(($('Watchdog Result').first().json || {}).value || '{}'); } catch (e) { v = {}; }
let d = {}; try { d = $('Dispatcher Watchdog').first().json || {}; } catch (e) { d = {}; }
const parts = [];
if (d.alarm) parts.push('The Cycle Dispatcher (SEO Agent — Cycle Dispatcher) is not starting any website\'s cycle: ' + (d.reason || 'no reason') + (d.down_since ? ' (down since ' + d.down_since + ')' : '')
  + '. Publish the workflow (POST /api/v1/workflows/SEOagentCycleDsp/activate) and check its last failed execution.');
if (v.alarm) parts.push('The Search Console mail watcher (SEO Agent — Console Alerts) is not listening: ' + v.failures + ' re-activation(s) in a row failed (' + (v.last_error || 'no reason') + '). Check the IMAP credential and the network, then activate the workflow.');
if (parts.length) throw new Error(parts.join(' '));
return [{ json: { watchdog: v.last_verdict || '', failures: v.failures || 0, dispatcher: d.verdict || '' } }];
