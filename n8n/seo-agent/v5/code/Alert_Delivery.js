// R6 (2026-10-13, re-rating RESULTS §3.2): no ops alert had ever recorded a delivery. All three rows in seo_ops_alerts sat at
// `delivered: "pending"` — including the two of 2026-10-12 18:34 whose e-mail Gmail had **accepted** (execs 464/465) — because nothing wrote
// the result back after *Post Alert Webhook* / *Email Ops*. A delivery rate (G21) cannot be measured from rows that never leave "pending".
// This node runs after whichever channel branch finished (both have onError: continueRegularOutput, so a failure arrives as an item with
// `error`) and writes back what carried the alert. It may run twice — once per branch — and the later run sees both channels, so the last
// write is the complete one; the update matches on alert_key, so repeating it is harmless.
/*__OPS_ALERT__*/
const alert = $('Format Alert').first().json;
let rows = []; try { rows = $('Load Ops Alerts').all().map(i => i.json).filter(r => r && !r.error); } catch (e) {}
const CFG = { webhook_url: '__ALERT_WEBHOOK_URL__', email_to: '__OPS_EMAIL__' };   // baked from n8n/.env at build time ($env is blocked in nodes)
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
