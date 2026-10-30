// Index coverage (fix wave 3, R7): what to post for the self-start alert of this run (Index Start Alert __G__ wrote its seo_ops_alerts row
// first: the record of last resort). Posted only when the row is new or older than OA.DEDUPE_MINUTES (`pending`) and a webhook is set
// (SEO_ALERT_WEBHOOK_URL: the build bakes a placeholder, apply_env.py writes the real URL at import time; R29).
/*__OPS_ALERT__*/
const S = (v) => String(v == null ? '' : v).trim();
const rows = (() => { try { return $('Any Start Alert (__G__)?').all().map(i => i.json).filter(r => r && !r.skip && S(r.alert_key)); } catch (e) { return []; } })();
const pending = rows.filter(r => S(r.delivered) === 'pending');
const webhook_url = OA.cfgUrl('__ALERT_WEBHOOK_URL__');
const plain = pending.map(r => 'SEO Agent — Index Coverage failed at "' + S(r.node) + '"\nExecution ' + S(r.execution_id) + '\n' + S(r.message)).join('\n\n');
return [{ json: { send_webhook: !!(webhook_url && pending.length), webhook_url,
  webhook_body: { text: plain, content: plain, summary: 'Index coverage: a part did not start',
    alerts: pending.map(r => ({ key: S(r.alert_key), workflow: S(r.workflow), node: S(r.node), message: S(r.message), severity: S(r.severity), seen_count: Number(r.count) || 1, at: S(r.last_seen_at), source: 'seo-agent-index-coverage' })) },
  note: pending.length ? (webhook_url ? 'posting the alert' : 'no alert webhook is configured: the alert is on record in seo_ops_alerts') : 'the same alert was sent less than ' + OA.DEDUPE_MINUTES + ' minutes ago' } }];
