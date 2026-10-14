// R6 (2026-10-13, re-rating RESULTS §3.2): no ops alert had ever recorded a delivery. All three rows in seo_ops_alerts sat at
// `delivered: "pending"` — including the two of 2026-10-12 18:34 whose e-mail Gmail had **accepted** (execs 464/465) — because nothing wrote
// the result back after *Post Alert Webhook* / *Email Ops*. A delivery rate (G21) cannot be measured from rows that never leave "pending".
// This node runs after whichever channel branch finished (both have onError: continueRegularOutput, so a failure arrives as an item with
// `error`) and writes back what carried the alert. It may run twice — once per branch — and the later run sees both channels, so the last
// write is the complete one; the update matches on alert_key, so repeating it is harmless.
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
const alert = $('Format Alert').first().json;
let rows = []; try { rows = $('Load Ops Alerts').all().map(i => i.json).filter(r => r && !r.error); } catch (e) {}
// R29 / R30 (2026-10-14): a placeholder is baked, never the URL (it is a secret and this repository is public); apply_env.py substitutes
// the real value at import time and an un-substituted placeholder reads as "no webhook configured" (OA.cfgUrl).
const CFG = { webhook_url: '__SEO_ALERT_WEBHOOK_URL__', email_to: 'kinnngahmed@gmail.com' };
const p = OA.plan(alert, rows, CFG);
// a node that did not run in this execution throws when it is referenced
const state = (name) => {
  let items = null;
  try { items = ($(name).all() || []).map(i => (i && i.json) || {}); } catch (e) { return { ran: false, ok: null, detail: 'not attempted' }; }
  if (!items.length) return { ran: false, ok: null, detail: 'not attempted' };
  const bad = items.find(x => x && x.error);
  if (bad) return { ran: true, ok: false, detail: String((bad.error && (bad.error.message || bad.error.description)) || bad.error).replace(/\s+/g, ' ').slice(0, 200) };
  const accepted = items.flatMap(x => Array.isArray(x.accepted) ? x.accepted : []);
  return { ran: true, ok: true, detail: accepted.length ? 'accepted by ' + accepted.length + ' recipient(s)' : 'sent' };
};
const wh = state('Post Alert Webhook'), em = state('Email Ops');
const carried = [wh.ok ? 'webhook' : '', em.ok ? 'email' : ''].filter(Boolean);
const failed = [wh.ran && !wh.ok ? 'webhook failed (' + wh.detail + ')' : '', em.ran && !em.ok ? 'email failed (' + em.detail + ')' : ''].filter(Boolean);
const delivered = carried.length ? carried.join(',') : failed.length ? 'failed' : p.notify ? 'not_sent' : 'deduped';
const notes = [carried.length ? 'delivered by ' + carried.map(c => c + ' (' + (c === 'webhook' ? wh.detail : em.detail) + ')').join(' and ') : '', ...failed,
  carried.length || failed.length ? '' : 'no channel ran: the alert is only on record in ' + 'seo_ops_alerts',
  'recorded in seo_ops_alerts (attempt ' + p.row.count + ')'].filter(Boolean).join('; ').slice(0, 500);
return [{ json: { alert_key: p.alert_key, delivered, channels: p.channels.join(','), notes,
  // not written to the table, but visible in the execution and useful to a person reading it
  carried_by: carried, failed_channels: failed, severity: p.severity, workflow: p.row.workflow, node: p.row.node } }];
