// C-16 (re-rating 2026-10-17): is the Search Console mail watcher really listening? Its IMAP trigger dropped four times in 22 hours and
// n8n's own re-activation failed each time (ENOTFOUND imap.gmail.com right after the Mac woke), while the public API kept saying
// `active: true`. This node reads what the flag cannot: the Error Handler's record of the drop (seo_ops_alerts) against the last time the
// watcher was (re)armed, and decides - through the pure kit CU.watchdog - whether to re-activate it. A test run (plan only / dry run)
// never touches it. Runs at the end of every catch-up sweep, after the catch-up's own record is saved.
/*__CATCHUP__*/
const WATCH = __WATCH__;
const API = '__N8N_API__';
const e = $('Catch-up Entry').first().json;
const all = (n) => { try { return $(n).all().map(i => i.json || {}); } catch (x) { return []; } };
const body = (r) => { const b = r && (r.body ?? r.data); if (b && typeof b === 'object') return b; try { return JSON.parse(String(b || '{}')); } catch (x) { return {}; } };
const stateKey = 'catchup:watchdog:' + WATCH.id;
if (e.plan_only || e.dry_run) return [{ json: { skip: true, test: true, action: 'none', verdict: 'test', reason: 'a test run of the catch-up does not touch the mail watcher', state_key: stateKey } }];
const w = all('Read Mailbox Workflow (Watchdog)')[0] || {}, wb = body(w);
const wf = Number(w.statusCode) === 200 && wb && wb.id === WATCH.id ? { ok: true, active: wb.active !== false, updatedAt: String(wb.updatedAt || '') }
  : { ok: false, error: Number(w.statusCode) ? 'HTTP ' + Number(w.statusCode) : String((w.error && (w.error.message || w.error)) || 'no answer').slice(0, 160) };
const rec = all('Load Catch-up Records').find(r => r && r.key === stateKey) || {};
let state = {}; try { state = JSON.parse(rec.value || '{}'); } catch (x) { state = {}; }
const alerts = all('Load Mailbox Alerts (Watchdog)').filter(r => r && r.workflow);
const now = new Date().toISOString();
const d = CU.watchdog({ wf, alerts, state, now, trigger_node: WATCH.trigger_node, workflow_name: WATCH.name });
return [{ json: { ...d, skip: d.action === 'none', workflow_id: WATCH.id, workflow_name: WATCH.name, state_key: stateKey, state, now,
  deactivate_url: API + '/workflows/' + WATCH.id + '/deactivate', activate_url: API + '/workflows/' + WATCH.id + '/activate' } }];
