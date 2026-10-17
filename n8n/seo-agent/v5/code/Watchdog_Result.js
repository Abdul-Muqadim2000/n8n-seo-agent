// C-16: the watchdog's record, one seo_cache row (`catchup:watchdog:<workflow id>`, exact columns): when it last looked, what it found
// (listening / re-activated / not listening, with the reason), the last drop the Error Handler recorded and how many re-activations in a
// row failed. This row is how an owner checks the watcher is listening (HANDOVER.md "Is the mail watcher listening?").
/*__CATCHUP__*/
const d = $('Watchdog Plan').first().json || {};
if (d.test) return [];   // a test run writes nothing
const get = (n) => { try { const x = $(n).first(); return x ? x.json : null; } catch (e) { return null; } };
const now = new Date().toISOString();
const keep = { reactivated_at: '', failures: 0, left_inactive: false, last_try_at: '', last_error: '', ...(d.state || {}) };
const next = d.action === 'none'
  ? { ...keep, last_check_at: now, last_verdict: d.verdict, last_reason: d.reason, last_drop: d.last_drop || keep.last_drop || '', alarm: false }
  : { ...CU.watchdogResult({ state: d.state, decision: d, deactivate: d.action === 'reactivate' ? get('Deactivate Mailbox') : null, activate: get('Activate Mailbox'), now }),
    last_check_at: now, last_verdict: d.verdict, last_reason: d.reason };
return [{ json: { key: d.state_key, kind: 'catchup', site_id: '', value: JSON.stringify(next), updated_at: now } }];
