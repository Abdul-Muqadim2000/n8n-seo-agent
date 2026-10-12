// D25b (2026-10-12, system review FIX_PLAN.md): the seo_ops_alerts row for this failure (exact columns - the Data Table node auto-maps every
// field it is given). The row is written BEFORE anything is sent, so a failed run is on record even when every channel is down.
/*__OPS_ALERT__*/
const alert = $('Format Alert').first().json;
let rows = []; try { rows = $('Load Ops Alerts').all().map(i => i.json).filter(r => r && !r.error); } catch (e) {}
const CFG = { webhook_url: '__ALERT_WEBHOOK_URL__', email_to: '__OPS_EMAIL__' };   // baked from n8n/.env at build time ($env is blocked in nodes)
return [{ json: OA.plan(alert, rows, CFG).row }];
