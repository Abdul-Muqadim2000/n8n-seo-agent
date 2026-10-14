// G11 (2026-10-13): what to send after the serious changes are on record (D25b's rule: record first, then send). One POST with the day's
// digest — `text` works for Slack and Teams, `content` for Discord, `alerts` carries the structured changes for anything else. A change
// already alerted within the dedupe window is on its row as `deduped` and is not re-sent; an unset webhook is simply skipped, and neither
// the record nor the channel can fail the run.
// ---- the ops alert and its channels (D25b, 2026-10-12, system review FIX_PLAN.md) ----
// The Error Handler had a single channel: *Email Ops*. On 2026-10-10 and again on 2026-10-12 it failed with a connection error (the Console
// Alerts watcher triggers the handler), so a failed run told nobody. Now every alert is **recorded first** in the Data Table
// seo_ops_alerts - the record of last resort, which survives both channels being down - and then sent to two independent channels: a webhook
// (SEO_ALERT_WEBHOOK_URL: Slack, Teams or anything that takes a POST; no SMTP involved) and the e-mail. Repeats of the same failure within
// OA.DEDUPE_MINUTES are recorded (count + 1) but not re-sent, so one broken credential cannot flood either channel. An unset channel is
// simply skipped, and neither channel can fail the run.
const OA = (() => {
  const DEDUPE_MINUTES = 30;
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  // the identity of a failure: the workflow, the node and the message with numbers, ids and quoted values removed, so "timeout after 30012ms"
  // and "timeout after 31004ms" at the same node are one alert
  const keyOf = (a) => [S(a.workflow) || 'unknown workflow', S(a.node) || 'unknown node',
    S(a.message).toLowerCase().replace(/\d[\d.,:]*/g, '#').replace(/["'`][^"'`]*["'`]/g, '"x"').replace(/\s+/g, ' ').slice(0, 160)].join(' | ');
  const severityOf = (a) => /credential|unauthor|forbidden|payment|credit|quota|balance/i.test(S(a.message)) ? 'critical' : 'high';
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
      delivered: notify ? 'pending' : 'deduped',
      notes: (repeat ? 'repeat within ' + DEDUPE_MINUTES + ' minutes (' + Math.round(sinceMin) + ' min after the last one), recorded but not re-sent' : count > 1 ? 'seen ' + count + ' times, last alert more than ' + DEDUPE_MINUTES + ' minutes ago' : 'first time').slice(0, 500)
    };
    // the webhook payload: `text` works for Slack and Teams, `content` for Discord, and `alert` carries the structured fields for anything else
    const body = {
      text: S(a.subject) + '\n' + plain, content: S(a.subject) + '\n' + plain, summary: S(a.subject),
      alert: { key: alert_key, workflow: row.workflow, node: row.node, message: row.message, execution_id: row.execution_id,
        execution_url: row.execution_url, mode: row.mode, severity: row.severity, seen_count: count, at: nowIso, source: 'seo-agent-error-handler' }
    };
    return { row, notify, repeat, channels, webhook_url, email_to, webhook_body: body, plain, alert_key, severity: row.severity, DEDUPE_MINUTES };
  };

  return { plan, keyOf, severityOf, cfgUrl, DEDUPE_MINUTES };
})();
const S = (v) => String(v == null ? '' : v).trim();
const rows = (() => { try { return $('Watch Ops Alert').all().map(i => i.json).filter(r => r && !r.skip && S(r.alert_key)); } catch (e) { return []; } })();
const sites = (() => { try { return $('Watch Compare').all().map(i => i.json).filter(s => s && !s.skip); } catch (e) { return []; } })();
const pending = rows.filter(r => S(r.delivered) === 'pending');
const webhook_url = OA.cfgUrl('__SEO_ALERT_WEBHOOK_URL__');   // R29 (2026-10-14): the build bakes a placeholder; apply_env.py substitutes the real URL at import time
let recorded = true, record_error = '';
try { const sv = ($('Save Watch Ops Alert').first() || {}).json || {}; if (sv.error) { recorded = false; record_error = String(sv.error.message || sv.error.description || sv.error).slice(0, 200); } }
catch (e) { recorded = false; record_error = 'the alert rows were not written: ' + String(e.message || e).slice(0, 160); }
const lines = pending.map(r => '• ' + S(r.node) + ' — ' + S(r.message));
const subject = pending.length
  ? 'SEO Agent key-page watch: ' + pending.length + ' change' + (pending.length === 1 ? '' : 's') + ' on ' + [...new Set(pending.map(r => S(r.node).split(' · ')[0]))].join(', ')
  : 'SEO Agent key-page watch: nothing new';
const plain = [subject, ...lines].join('\n');
return [{ json: {
  send_webhook: !!(webhook_url && pending.length), webhook_url, subject, plain, recorded, record_error,
  alerts: pending.length, deduped: rows.length - pending.length, sites_checked: sites.length,
  webhook_body: { text: plain, content: plain, summary: subject,
    alerts: pending.map(r => ({ key: S(r.alert_key), site: S(r.node), message: S(r.message), severity: S(r.severity), seen_count: Number(r.count) || 1, at: S(r.last_seen_at), source: 'seo-agent-page-watch' })) },
  note: pending.length
    ? (webhook_url ? 'posting the day\'s changes to the alert webhook' : 'no alert webhook is configured (SEO_ALERT_WEBHOOK_URL): the changes are on record in seo_ops_alerts and in the app')
    : 'nothing serious changed, or every change was alerted less than ' + OA.DEDUPE_MINUTES + ' minutes ago',
} }];
