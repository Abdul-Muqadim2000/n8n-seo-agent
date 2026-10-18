// C-16: after three re-activations in a row failed (and every fourth after that, so the owner is not paged every 15 minutes) the run
// fails with the reason, so the Error Handler raises the ops alert on its two channels: the mail watcher is not listening and the engine
// could not bring it back. It is the last node of the sweep, so every catch-up start of the run has already happened.
let v = {}; try { v = JSON.parse(($('Watchdog Result').first().json || {}).value || '{}'); } catch (e) { v = {}; }
if (v.alarm) throw new Error('The Search Console mail watcher (SEO Agent — Console Alerts) is not listening: ' + v.failures + ' re-activation(s) in a row failed (' + (v.last_error || 'no reason') + '). Check the IMAP credential and the network, then activate the workflow.');
return [{ json: { watchdog: v.last_verdict || '', failures: v.failures || 0 } }];
