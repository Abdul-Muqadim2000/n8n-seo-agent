// Index coverage (fix wave 3, R7): the self-start alert's delivery, judged on the POST's status code (AR.posted: Post Index Start Alert __G__
// is neverError with fullResponse, so a 404 from a revoked webhook is a failure, never a delivery) and written back on its seo_ops_alerts
// row; a failure books the next attempt, which the retry sweep at the end of every scheduled run makes.
/*__OPS_ALERT__*/
/*__ALERT_RETRY__*/
const S = (v) => String(v == null ? '' : v).trim();
const ch = (() => { try { return $('Index Start Send (__G__)').first().json || {}; } catch (e) { return {}; } })();
const rows = (() => { try { return $('Any Start Alert (__G__)?').all().map(i => i.json).filter(r => r && !r.skip && S(r.alert_key)); } catch (e) { return []; } })();
const sent = ((ch.webhook_body || {}).alerts || []).map(a => S(a.key)).filter(Boolean);
if (!sent.length) return [{ json: { skip: true, reason: 'nothing was posted' } }];
const res = AR.posted($input.first());
const now = new Date().toISOString();
return sent.map(key => {
  const r = rows.find(x => S(x.alert_key) === key) || { alert_key: key };
  const attempt = AR.attemptsOf(r) + 1;
  const giveUp = !res.ok && attempt >= AR.MAX_ATTEMPTS;
  return { json: { alert_key: r.alert_key == null ? key : AR.storedKey(r), delivered: res.ok ? 'webhook' : giveUp ? 'abandoned' : 'failed',
    channels: AR.withChannel(r.channels, 'webhook'), severity: res.ok ? (S(r.severity) || 'high') : AR.severityFor(r, attempt), attempts: attempt, last_attempt_at: now,
    next_attempt_at: res.ok || giveUp ? '' : new Date(Date.now() + AR.RETRY_MINUTES * 60000).toISOString(),
    attempt_log: AR.addAttempt(r, attempt, now, 'webhook', res.ok, res.detail),
    notes: (res.ok ? 'delivered by webhook (' + res.detail + ')' : giveUp ? 'given up after ' + attempt + ' attempts (' + res.detail + ')'
      : 'the alert did not arrive (' + res.detail + '); the next run of any workflow tries again after ' + AR.RETRY_MINUTES + ' minutes').slice(0, 500) } };
});
