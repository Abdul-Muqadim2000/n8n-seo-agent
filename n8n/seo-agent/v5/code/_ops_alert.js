// ---- the ops alert and its channels (D25b, 2026-10-12, system review FIX_PLAN.md) ----
// The Error Handler had a single channel: *Email Ops*. On 2026-10-10 and again on 2026-10-12 it failed with a connection error (the Console
// Alerts watcher triggers the handler), so a failed run told nobody. Now every alert is **recorded first** in the Data Table
// seo_ops_alerts - the record of last resort, which survives both channels being down - and then sent to two independent channels: a webhook
// (SEO_ALERT_WEBHOOK_URL: Slack, Teams or anything that takes a POST; no SMTP involved) and the e-mail. Repeats of the same failure within
// OA.DEDUPE_MINUTES are recorded (count + 1) but not re-sent, so one broken credential cannot flood either channel. An unset channel is
// simply skipped, and neither channel can fail the run.
const OA = (() => {
  const DEDUPE_MINUTES = 30;
  // B-A7 (2026-10-15): the moment a first attempt may be re-tried if nothing records a delivery. It must equal AR.RETRY_MINUTES — the
  // sweep (v5/code/_alert_retry.js) is what acts on it — and build section 64 fails if the two ever drift apart.
  const RETRY_MINUTES = 30;
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  // the identity of a failure: the workflow, the node and the message with numbers, ids and quoted values removed, so "timeout after 30012ms"
  // and "timeout after 31004ms" at the same node are one alert
  const keyOf = (a) => [S(a.workflow) || 'unknown workflow', S(a.node) || 'unknown node',
    S(a.message).toLowerCase().replace(/\d[\d.,:]*/g, '#').replace(/["'`][^"'`]*["'`]/g, '"x"').replace(/\s+/g, ' ').slice(0, 160)].join(' | ');
  const severityOf = (a) => /credential|unauthor|forbidden|payment|credit|quota|balance/i.test(S(a.message)) ? 'critical' : 'high';
  // B-A7: a row is "carried" when `delivered` NAMES the channel that took it ('webhook', 'email', 'webhook,email'). Everything else -
  // pending, failed, not_sent, deduped - means the same thing to a human: nobody has it. The same rule as AR.carried.
  const carried = (r) => S(r && r.delivered).toLowerCase().split(',').map(x => x.trim()).some(x => x === 'webhook' || x === 'email');
  // R29 (2026-10-14, FIX_PLAN §3.12, secret handling): SEO_ALERT_WEBHOOK_URL is a bearer URL, so the build bakes a PLACEHOLDER and
  // apply_env.py substitutes the real value into the JSON it imports — the public repository never carries the secret. A node still
  // holding the placeholder (an un-applied build, and every harness run) has no webhook configured: it is not a URL, and posting to it
  // would be a request to nowhere. Anything that still looks like __A_PLACEHOLDER__ therefore reads as unset.
  const cfgUrl = (v) => { const s = S(v); return !s || /^__[A-Z0-9_]+__$/.test(s) ? '' : s; };

  const plan = (alert, rows, cfg) => {
    const a = alert || {}, c = cfg || {};
    const now = new Date();
    const nowIso = now.toISOString();
    const alert_key = keyOf(a);
    const prior = (rows || []).filter(r => r && S(r.alert_key) === alert_key)
      .sort((x, y) => S(y.last_seen_at).localeCompare(S(x.last_seen_at)))[0] || null;
    const sinceMin = prior && S(prior.last_seen_at) ? (now - new Date(S(prior.last_seen_at))) / 60000 : Infinity;
    const repeat = !!prior && Number.isFinite(sinceMin) && sinceMin < DEDUPE_MINUTES;
    const count = prior ? n0(prior.count) + 1 : 1;
    const webhook_url = cfgUrl(c.webhook_url);   // R29: an un-substituted placeholder is not a channel
    const email_to = S(c.email_to);
    const channels = [webhook_url ? 'webhook' : '', email_to ? 'email' : '', 'data_table'].filter(Boolean);
    const notify = !repeat;
    const plain = [S(a.workflow) + ' failed at "' + S(a.node) + '"', 'Execution ' + (S(a.execution_id) || '?') + (S(a.mode) ? ' (' + S(a.mode) + ')' : ''),
      S(a.execution_url), S(a.message)].filter(Boolean).join('\n');
    const row = {
      alert_key, workflow: S(a.workflow).slice(0, 200), node: S(a.node).slice(0, 200), message: S(a.message).slice(0, 800),
      execution_id: S(a.execution_id), execution_url: S(a.execution_url), mode: S(a.mode), severity: severityOf(a),
      first_seen_at: prior && S(prior.first_seen_at) ? S(prior.first_seen_at) : nowIso, last_seen_at: nowIso, count,
      channels: channels.join(','),
      // B-A7 (2026-10-15): a repeat used to write `deduped` over whatever the row said, including over the channels that had CARRIED the
      // alert — so a delivered alert looked undelivered and an undelivered one looked handled. A repeat of an alert something carried
      // keeps that state; only an alert nobody has is marked deduped.
      delivered: notify ? 'pending' : (prior && carried(prior) ? S(prior.delivered) : 'deduped'),
      notes: (repeat ? 'repeat within ' + DEDUPE_MINUTES + ' minutes (' + Math.round(sinceMin) + ' min after the last one), recorded but not re-sent' : count > 1 ? 'seen ' + count + ' times, last alert more than ' + DEDUPE_MINUTES + ' minutes ago' : 'first time').slice(0, 500),
      // B-A7: the retry state. `attempts` is 0 here on purpose — this row is written BEFORE anything is sent, and an attempt exists when it
      // is made, not when it is planned (INVARIANTS rule 4). *Alert Delivery* writes the real count and the log a moment later; if the
      // execution dies before it does, `next_attempt_at` has already booked the row for the next sweep, so the failure is not stranded.
      attempts: n0(prior && prior.attempts),
      last_attempt_at: S(prior && prior.last_attempt_at),
      next_attempt_at: notify ? new Date(now.getTime() + RETRY_MINUTES * 60000).toISOString() : S(prior && prior.next_attempt_at),
      attempt_log: S(prior && prior.attempt_log)
    };
    // the webhook payload: `text` works for Slack and Teams, `content` for Discord, and `alert` carries the structured fields for anything else
    const body = {
      text: S(a.subject) + '\n' + plain, content: S(a.subject) + '\n' + plain, summary: S(a.subject),
      alert: { key: alert_key, workflow: row.workflow, node: row.node, message: row.message, execution_id: row.execution_id,
        execution_url: row.execution_url, mode: row.mode, severity: row.severity, seen_count: count, at: nowIso, source: 'seo-agent-error-handler' }
    };
    return { row, notify, repeat, channels, webhook_url, email_to, webhook_body: body, plain, alert_key, severity: row.severity, DEDUPE_MINUTES };
  };

  return { plan, keyOf, severityOf, cfgUrl, carried, DEDUPE_MINUTES, RETRY_MINUTES };
})();
