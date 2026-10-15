// B-A7 (2026-10-15, build section 64): the sweep. Every run of every scheduled workflow, and every run of the Error Handler, ends by asking
// one question — is there an alert that has reached nobody and is due another try? That is what "re-attempted by the next run of any
// workflow" means: the retry needs no scheduler of its own, because ten schedules and every failure already run.
// The node names are written in at build time (__LOAD__ = the Data Table read in front of this node, __WHERE__ = the workflow doing the
// sweeping, so the row records who re-sent it).
/*__OPS_ALERT__*/
/*__ALERT_RETRY__*/
let rows = [];
try { rows = $('__LOAD__').all().map(i => i.json).filter(r => r && !r.error && r.alert_key); } catch (e) { rows = []; }
// R29 / R30 (2026-10-14): a placeholder is baked, never the URL (it is a secret and this repository is public); apply_env.py substitutes
// the real value at import time and an un-substituted placeholder reads as "no webhook configured".
const p = AR.plan(rows, { webhook_url: '__ALERT_WEBHOOK_URL__', where: '__WHERE__' });
if (!p.posting) return [{ json: { skip: true, reason: p.reason, open: p.open, due: p.due, spent: p.spent, where: p.where } }];
return p.items.map(it => ({ json: it }));
