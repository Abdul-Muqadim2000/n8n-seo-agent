// D25b (2026-10-12, system review FIX_PLAN.md): decides what to send after the alert is on record. Two independent channels - a webhook
// (no SMTP involved: it is the one that still works when the mail server refuses the connection, as it did on 2026-10-10 and 2026-10-12) and
// the ops e-mail. A channel that is not configured is skipped, a repeat within OA.DEDUPE_MINUTES is not re-sent, and neither can fail the run.
/*__OPS_ALERT__*/
const alert = $('Format Alert').first().json;
let rows = []; try { rows = $('Load Ops Alerts').all().map(i => i.json).filter(r => r && !r.error); } catch (e) {}
// R29 / R30 (2026-10-14): the webhook URL is a SECRET and this repository is public, so the build bakes a placeholder and apply_env.py
// substitutes the real value into the JSON it imports; an un-substituted placeholder reads as "no webhook configured" (OA.cfgUrl), so no
// build can produce a node that posts to a customer's Slack. The ops address is not a secret and is baked as before ($env is blocked in nodes).
const CFG = { webhook_url: '__ALERT_WEBHOOK_URL__', email_to: '__OPS_EMAIL__' };
const p = OA.plan(alert, rows, CFG);
// did the row reach the table? (a Data Table node with onError: continueRegularOutput answers with an error item instead of failing)
let recorded = true, record_error = '';
try { const s = ($('Save Ops Alert').first() || {}).json || {}; if (s.error) { recorded = false; record_error = String(s.error.message || s.error.description || s.error).slice(0, 200); } }
catch (e) { recorded = false; record_error = 'the alert row was not written: ' + String(e.message || e).slice(0, 160); }
return [{ json: {
  subject: alert.subject, html: alert.html, plain: p.plain, alert_key: p.alert_key, severity: p.severity,
  notify: p.notify, repeat: p.repeat, seen_count: p.row.count, channels: p.channels, channels_text: p.channels.join(', '),
  webhook_url: p.webhook_url, webhook_body: p.webhook_body, email_to: p.email_to,
  send_webhook: !!(p.notify && p.webhook_url), send_email: !!(p.notify && p.email_to),
  recorded, record_error,
  note: p.notify
    ? (p.channels.filter(c => c !== 'data_table').length ? 'sending to ' + p.channels.filter(c => c !== 'data_table').join(' and ') : 'no channel is configured - the alert is only on record in seo_ops_alerts')
    : 'the same failure was alerted less than ' + p.DEDUPE_MINUTES + ' minutes ago: recorded (' + p.row.count + 'x), not re-sent'
} }];
