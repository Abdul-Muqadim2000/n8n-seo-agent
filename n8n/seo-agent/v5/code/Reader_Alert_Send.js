// W07-A (2026-10-31): what to post once the refusal is on record. A first sighting (`delivered: pending`) goes to the alert webhook
// (SEO_ALERT_WEBHOOK_URL: Slack, Teams or anything that takes a POST; no SMTP involved); a repeat within the dedupe window was counted on
// its row and is not sent again; with no webhook configured the row waits for the retry sweep of the next scheduled run (it books its own
// next attempt) and the run goes on. Nothing here can fail the run.
/*__OPS_ALERT__*/
const S = (v) => String(v == null ? '' : v).trim();
const row = (() => { try { return $('Reader Alert Plan').last().json || {}; } catch (e) { return {}; } })();
const a = (() => { try { return $('Reader Refusals').last().json || {}; } catch (e) { return {}; } })();
let recorded = true, record_error = '';
try { const sv = ($input.first() || {}).json || {}; if (sv.error) { recorded = false; record_error = S(sv.error.message || sv.error.description || sv.error).slice(0, 200); } }
catch (e) { recorded = false; record_error = 'the alert row was not written: ' + S(e.message || e).slice(0, 160); }
const webhook_url = OA.cfgUrl('__ALERT_WEBHOOK_URL__');   // R29: the build bakes a placeholder; apply_env.py substitutes the real URL at import time
const fresh = S(row.delivered) === 'pending';
const subject = S((a.alert || {}).subject) || '[critical] The page reader refused reads';
const plain = [subject, 'Workflow: ' + S(row.workflow), 'Execution ' + (S(row.execution_id) || '?') + ' (page reader)', S(row.message)].filter(Boolean).join('\n');
return [{ json: {
  send_webhook: !!(webhook_url && fresh && S(row.alert_key)), webhook_url, alert_key: S(row.alert_key), recorded, record_error,
  webhook_body: { text: plain, content: plain, summary: subject,
    alert: { key: S(row.alert_key), workflow: S(row.workflow), node: S(row.node), message: S(row.message), execution_id: S(row.execution_id), severity: 'critical',
      seen_count: Number(row.count) || 1, at: S(row.last_seen_at), source: 'seo-agent-page-reader' } },
  note: !fresh ? 'the same refusal was alerted less than ' + OA.DEDUPE_MINUTES + ' minutes ago: counted on its row, not sent again'
    : webhook_url ? 'posting the refusal to the alert webhook' : 'no alert webhook is configured (SEO_ALERT_WEBHOOK_URL): the refusal is on record in seo_ops_alerts'
} }];
