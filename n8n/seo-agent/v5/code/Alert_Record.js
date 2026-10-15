// D25b (2026-10-12, system review FIX_PLAN.md): the seo_ops_alerts row for this failure (exact columns - the Data Table node auto-maps every
// field it is given). The row is written BEFORE anything is sent, so a failed run is on record even when every channel is down.
/*__OPS_ALERT__*/
const alert = $('Format Alert').first().json;
let rows = []; try { rows = $('Load Ops Alerts').all().map(i => i.json).filter(r => r && !r.error); } catch (e) {}
// R29 / R30 (2026-10-14): a placeholder is baked, never the URL (it is a secret and this repository is public); apply_env.py substitutes
// the real value at import time and an un-substituted placeholder reads as "no webhook configured" (OA.cfgUrl).
const CFG = { webhook_url: '__ALERT_WEBHOOK_URL__', email_to: '__OPS_EMAIL__' };
return [{ json: OA.plan(alert, rows, CFG).row }];
