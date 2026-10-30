// W07-A (2026-10-31): the page reader alert's delivery, judged on the POST's status code (`fullResponse` + `neverError`): a 2xx is the
// evidence, anything else is a failure with its reason and books the next attempt for the retry sweep (INVARIANTS rule 4: delivered only
// when it was delivered; the same write-back as *Watch Ops Delivery*).
/*__OPS_ALERT__*/
/*__ALERT_RETRY__*/
const S = (v) => String(v == null ? '' : v).trim();
const row = (() => { try { return $('Reader Alert Plan').last().json || {}; } catch (e) { return {}; } })();
const key = S(row.alert_key);
if (!key) return [{ json: { skip: true, reason: 'nothing was posted' } }];
const res = AR.posted($input.first());
const now = new Date().toISOString();
const attempt = AR.attemptsOf(row) + 1;
const giveUp = !res.ok && attempt >= AR.MAX_ATTEMPTS;
return [{ json: {
  alert_key: AR.storedKey(row),
  delivered: res.ok ? 'webhook' : giveUp ? 'abandoned' : 'failed',
  channels: AR.withChannel(row.channels, 'webhook'),
  severity: res.ok ? 'critical' : AR.severityFor({ severity: 'critical' }, attempt),
  attempts: attempt,
  last_attempt_at: now,
  next_attempt_at: res.ok || giveUp ? '' : new Date(Date.now() + AR.RETRY_MINUTES * 60000).toISOString(),
  attempt_log: AR.addAttempt(row, attempt, now, 'webhook', res.ok, res.detail),
  notes: (res.ok ? 'delivered by webhook (' + res.detail + ')'
    : giveUp ? 'given up after ' + attempt + ' attempts: this alert reached nobody and is on record here only (' + res.detail + ')'
    : 'the post did not arrive (' + res.detail + '); the next run of any scheduled workflow tries again after ' + AR.RETRY_MINUTES + ' minutes').slice(0, 500)
} }];
