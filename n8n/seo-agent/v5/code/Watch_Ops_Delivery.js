// B-A7 (2026-10-15, build section 64): the Page Watch posted its digest and wrote nothing back, so every row it raised stayed
// `delivered: "pending"` for ever — indistinguishable from a post that never arrived. R6 gave the Error Handler a delivery record; the
// watch never got one, and the retry sweep would have re-sent a digest that had already landed.
// The POST is `neverError` + `fullResponse`, so the status code is on the item: a 2xx is the evidence, anything else is a failure with its
// reason, and the row books the next attempt (INVARIANTS rule 4 — delivered only when it was delivered).
/*__OPS_ALERT__*/
/*__ALERT_RETRY__*/
const S = (v) => String(v == null ? '' : v).trim();
const ch = (() => { try { return $('Watch Ops Channels').first().json || {}; } catch (e) { return {}; } })();
const rows = (() => { try { return $('Watch Ops Alert').all().map(i => i.json).filter(r => r && !r.skip && S(r.alert_key)); } catch (e) { return []; } })();
const sent = ((ch.webhook_body || {}).alerts || []).map(a => S(a.key)).filter(Boolean);
if (!sent.length) return [{ json: { skip: true, reason: 'nothing was posted' } }];
const res = AR.posted($input.first());
const now = new Date().toISOString();
return sent.map(key => {
  const r = rows.find(x => S(x.alert_key) === key) || { alert_key: key };
  const attempt = AR.attemptsOf(r) + 1;
  const giveUp = !res.ok && attempt >= AR.MAX_ATTEMPTS;
  return { json: {
    // R79 (2026-10-16): the row is written back under the key it is STORED with (the digest carries the trimmed form), so the update
    // matches it byte for byte even for a row written before OA.keyOf trimmed its keys
    alert_key: r.alert_key == null ? key : AR.storedKey(r),
    delivered: res.ok ? 'webhook' : giveUp ? 'abandoned' : 'failed',
    channels: AR.withChannel(r.channels, 'webhook'),   // R105: the channel this digest went to, beside what the row already said
    severity: res.ok ? (S(r.severity) || 'high') : AR.severityFor(r, attempt),
    attempts: attempt,
    last_attempt_at: now,
    next_attempt_at: res.ok || giveUp ? '' : new Date(Date.now() + AR.RETRY_MINUTES * 60000).toISOString(),
    attempt_log: AR.addAttempt(r, attempt, now, 'webhook', res.ok, res.detail),
    notes: (res.ok ? 'delivered by webhook with the day\'s key-page digest (' + res.detail + ')'
      : giveUp ? 'given up after ' + attempt + ' attempts — this change reached nobody and is on record here and in the app only (' + res.detail + ')'
      : 'the key-page digest did not arrive (' + res.detail + '); the next run of any workflow tries again after ' + AR.RETRY_MINUTES + ' minutes').slice(0, 500)
  } };
});
