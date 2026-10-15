// G11 (2026-10-13): a key page that is gone, noindexed, blocked or whose canonical moved is not something to find out next month, so the
// serious changes take the alert path D25b built: recorded in seo_ops_alerts first (the record of last resort, exact columns) and then
// pushed to SEO_ALERT_WEBHOOK_URL (Slack / Teams / any POST endpoint, no SMTP involved). The same change within OA.DEDUPE_MINUTES is
// counted on its row and not re-sent, so a site that breaks at 03:00 cannot flood the channel.
/*__OPS_ALERT__*/
const sites = $('Watch Compare').all().map(i => i.json).filter(s => s && !s.skip);
let prior = []; try { prior = $('Load Ops Alerts (Watch)').all().map(i => i.json).filter(r => r && !r.error); } catch (e) {}
// R29 / R30 (2026-10-14): a placeholder is baked, never the URL (it is a secret and this repository is public); apply_env.py substitutes
// the real value at import time and an un-substituted placeholder reads as "no webhook configured" (OA.cfgUrl).
const CFG = { webhook_url: '__ALERT_WEBHOOK_URL__', email_to: '' };   // the watch does not e-mail: the customer sees it in the app
const S = (v) => String(v == null ? '' : v).trim();
const rows = [];
const seen = new Set();
for (const s of sites) {
  for (const c of (s.changes || []).filter(c => c.severity === 'critical' || c.severity === 'high').slice(0, 5)) {
    const alert = { workflow: 'SEO Agent — Page Watch', node: s.domain + (c.url ? ' · ' + S(c.url).replace(/^https?:\/\//, '') : ''),
      message: S(c.label) + ': ' + S(c.text), subject: '[' + S(c.severity) + '] ' + s.domain + ': ' + S(c.label),
      execution_id: S($execution.id), execution_url: '', mode: 'page_watch' };
    const p = OA.plan(alert, [...prior, ...rows], CFG);
    if (seen.has(p.row.alert_key)) continue;
    seen.add(p.row.alert_key);
    rows.push({ ...p.row, severity: S(c.severity) });   // the change decides how loud it is, not the message text
  }
}
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'no serious change to alert about' } }];
