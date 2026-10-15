// R6 (2026-10-13, re-rating RESULTS §3.2): no ops alert had ever recorded a delivery. All three rows in seo_ops_alerts sat at
// `delivered: "pending"` — including the two of 2026-10-12 18:34 whose e-mail Gmail had **accepted** (execs 464/465) — because nothing wrote
// the result back after *Post Alert Webhook* / *Email Ops*. A delivery rate (G21) cannot be measured from rows that never leave "pending".
// This node runs after whichever channel branch finished (both have onError: continueRegularOutput, so a failure arrives as an item with
// `error`) and writes back what carried the alert. It may run twice — once per branch — and the later run sees both channels, so the last
// write is the complete one; the update matches on alert_key, so repeating it is harmless.
// B-A7 (2026-10-15, build section 64): and it now books the next attempt. Two things changed with it:
//   * the webhook is judged on its STATUS CODE. *Post Alert Webhook* is `neverError`, so a 404 from a revoked Slack hook used to arrive as
//     an item with no `error` and was written down as a delivery. `fullResponse` puts the code on the item and AR.posted reads it: a row is
//     marked delivered only on evidence of delivery (INVARIANTS rule 4), never on the attempt having been made.
//   * every attempt is on the row — the number, the time, the one-line outcome in `attempt_log`, and `next_attempt_at`, which is what the
//     sweep in every scheduled workflow looks for. A failure that reaches no human is not handled (rule 3).
/*__OPS_ALERT__*/
/*__ALERT_RETRY__*/
const alert = $('Format Alert').first().json;
let rows = []; try { rows = $('Load Ops Alerts').all().map(i => i.json).filter(r => r && !r.error); } catch (e) {}
// R29 / R30 (2026-10-14): a placeholder is baked, never the URL (it is a secret and this repository is public); apply_env.py substitutes
// the real value at import time and an un-substituted placeholder reads as "no webhook configured" (OA.cfgUrl).
const CFG = { webhook_url: '__ALERT_WEBHOOK_URL__', email_to: '__OPS_EMAIL__' };
const p = OA.plan(alert, rows, CFG);
// a node that did not run in this execution throws when it is referenced
const state = (name, judge) => {
  let items = null;
  try { items = ($(name).all() || []).map(i => (i && i.json) || {}); } catch (e) { return { ran: false, ok: null, detail: 'not attempted' }; }
  if (!items.length) return { ran: false, ok: null, detail: 'not attempted' };
  return judge(items);
};
// the webhook: a status code, or nothing that proves anything
const wh = state('Post Alert Webhook', (items) => {
  const bad = items.map(x => AR.posted(x)).find(r => !r.ok);
  if (bad) return { ran: true, ok: false, detail: bad.detail };
  const first = AR.posted(items[0]);
  return { ran: true, ok: true, detail: first.detail === 'HTTP 200' ? 'sent' : first.detail };
});
// the e-mail: n8n's Send Email answers with the recipients the server accepted
const em = state('Email Ops', (items) => {
  const bad = items.find(x => x && x.error);
  if (bad) return { ran: true, ok: false, detail: String((bad.error && (bad.error.message || bad.error.description)) || bad.error).replace(/\s+/g, ' ').slice(0, 200) };
  const accepted = items.flatMap(x => Array.isArray(x.accepted) ? x.accepted : []);
  return { ran: true, ok: true, detail: accepted.length ? 'accepted by ' + accepted.length + ' recipient(s)' : 'sent' };
});
const carried = [wh.ok ? 'webhook' : '', em.ok ? 'email' : ''].filter(Boolean);
const failed = [wh.ran && !wh.ok ? 'webhook failed (' + wh.detail + ')' : '', em.ran && !em.ok ? 'email failed (' + em.detail + ')' : ''].filter(Boolean);
const delivered = carried.length ? carried.join(',') : failed.length ? 'failed' : p.notify ? 'not_sent' : 'deduped';
// B-A7: this execution made an attempt whenever a channel ran at all; it is the next one in the row's own history, so the escalation
// ladder keeps counting across sightings instead of restarting at 1 every time the same failure comes back.
const tried = wh.ran || em.ran;
const attempts = AR.attemptsOf(p.row) + (tried ? 1 : 0);
const nowIso = new Date().toISOString();
// one line, one attempt: which channels were tried, and what each of them said
const channels_tried = [wh.ran ? 'webhook' : '', em.ran ? 'email' : ''].filter(Boolean).join('+');
const log = tried ? AR.addAttempt(p.row, attempts, nowIso, channels_tried, carried.length > 0,
  [wh.ran ? 'webhook ' + wh.detail : '', em.ran ? 'email ' + em.detail : ''].filter(Boolean).join('; ')) : String(p.row.attempt_log || '');
const settled = carried.length > 0;
const giveUp = !settled && tried && attempts >= AR.MAX_ATTEMPTS;
const notes = [carried.length ? 'delivered by ' + carried.map(c => c + ' (' + (c === 'webhook' ? wh.detail : em.detail) + ')').join(' and ') : '', ...failed,
  carried.length || failed.length ? '' : 'no channel ran: the alert is only on record in ' + 'seo_ops_alerts',
  'recorded in seo_ops_alerts (sighting ' + p.row.count + ', delivery attempt ' + attempts + ')',
  settled || !tried ? '' : giveUp ? 'given up after ' + attempts + ' attempts' : 'the next run of any workflow tries again after ' + AR.RETRY_MINUTES + ' minutes'
  ].filter(Boolean).join('; ').slice(0, 500);
return [{ json: { alert_key: p.alert_key, delivered: giveUp ? 'abandoned' : delivered, channels: p.channels.join(','), notes,
  // B-A7: the retry state the sweep reads. A delivered alert books no next attempt; one nobody has books the next one.
  severity: settled ? p.severity : AR.severityFor(p.row, attempts), attempts,
  last_attempt_at: tried ? nowIso : String(p.row.last_attempt_at || ''),
  next_attempt_at: settled || giveUp ? '' : new Date(Date.now() + AR.RETRY_MINUTES * 60000).toISOString(),
  attempt_log: log,
  // not written to the table, but visible in the execution and useful to a person reading it
  carried_by: carried, failed_channels: failed, workflow: p.row.workflow, node: p.row.node } }];
