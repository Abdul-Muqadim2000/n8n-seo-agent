// G11 (2026-10-13): what to send after the serious changes are on record (D25b's rule: record first, then send). One POST with the day's
// digest — `text` works for Slack and Teams, `content` for Discord, `alerts` carries the structured changes for anything else. A change
// already alerted within the dedupe window is on its row as `deduped` and is not re-sent; an unset webhook is simply skipped, and neither
// the record nor the channel can fail the run.
/*__OPS_ALERT__*/
/*__RAN_LATE__*/
const S = (v) => String(v == null ? '' : v).trim();
const rows = (() => { try { return $('Watch Ops Alert').all().map(i => i.json).filter(r => r && !r.skip && S(r.alert_key)); } catch (e) { return []; } })();
const sites = (() => { try { return $('Watch Compare').all().map(i => i.json).filter(s => s && !s.skip); } catch (e) { return []; } })();
const pending = rows.filter(r => S(r.delivered) === 'pending');
const webhook_url = OA.cfgUrl('__ALERT_WEBHOOK_URL__');   // R29 (2026-10-14): the build bakes a placeholder; apply_env.py substitutes the real URL at import time
let recorded = true, record_error = '';
try { const sv = ($('Save Watch Ops Alert').first() || {}).json || {}; if (sv.error) { recorded = false; record_error = String(sv.error.message || sv.error.description || sv.error).slice(0, 200); } }
catch (e) { recorded = false; record_error = 'the alert rows were not written: ' + String(e.message || e).slice(0, 160); }
const lines = pending.map(r => '• ' + S(r.node) + ' — ' + S(r.message));
const subject = pending.length
  ? 'SEO Agent key-page watch: ' + pending.length + ' change' + (pending.length === 1 ? '' : 's') + ' on ' + [...new Set(pending.map(r => S(r.node).split(' · ')[0]))].join(', ')
  : 'SEO Agent key-page watch: nothing new';
// F-L (2026-10-18, C-1 follow-up): a watch the schedule catch-up started for a missed day, or a schedule that fired hours late, says so
const ran_late = RL.of(SCHED, ['Watch Run']);
const subjectL = RL.subjectTag(subject, ran_late);
const plain = [subjectL, ...(ran_late.late ? ['Ran late: ' + ran_late.text] : []), ...lines].join('\n');
return [{ json: {
  send_webhook: !!(webhook_url && pending.length), webhook_url, subject: subjectL, plain, recorded, record_error, ran_late,
  alerts: pending.length, deduped: rows.length - pending.length, sites_checked: sites.length,
  webhook_body: { text: plain, content: plain, summary: subjectL, ...(ran_late.late ? { ran_late } : {}),
    alerts: pending.map(r => ({ key: S(r.alert_key), site: S(r.node), message: S(r.message), severity: S(r.severity), seen_count: Number(r.count) || 1, at: S(r.last_seen_at), source: 'seo-agent-page-watch' })) },
  note: pending.length
    ? (webhook_url ? 'posting the day\'s changes to the alert webhook' : 'no alert webhook is configured (SEO_ALERT_WEBHOOK_URL): the changes are on record in seo_ops_alerts and in the app')
    : 'nothing serious changed, or every change was alerted less than ' + OA.DEDUPE_MINUTES + ' minutes ago',
} }];
