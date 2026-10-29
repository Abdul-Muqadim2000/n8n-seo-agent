// Index coverage (fix wave 3, R7): a self-start that failed is not silent. "__START__" starts this workflow again (Execute Workflow, not waited
// for, `continueRegularOutput`): when n8n refuses it (the workflow unpublished for a moment during a deploy, an instance error) the node
// answers `{ error }` and the chain - or the day's watch - ends there, in an execution that still reads as a success. This node turns that
// answer into ONE ops alert on the shared path every scheduled workflow uses: a seo_ops_alerts row (OA.plan: the alert key is the workflow,
// this node and the message, so a repeat within OA.DEDUPE_MINUTES is one row and is not re-sent), then posted at once to SEO_ALERT_WEBHOOK_URL
// (Index Start Send / Post Index Start Alert) and settled from the POST's status code (Index Start Delivery, AR.posted); an alert that did not
// arrive is re-tried by the sweep that ends every scheduled run. Nothing is written when the start worked.
/*__OPS_ALERT__*/
const S = (v) => String(v == null ? '' : v).trim();
const items = (() => { try { return $('__START__').all(); } catch (e) { return []; } })();
const bad = items.map(i => (i && i.json) || {}).find(j => j.error);
if (!bad) return [{ json: { skip: true, reason: '__START__ started its execution' } }];
const err = typeof bad.error === 'string' ? bad.error : S(bad.error.message || bad.error.description || JSON.stringify(bad.error));
let t = {}; try { const x = $('Manual Run').first(); t = (x && x.json) || {}; } catch (e) { t = {}; }
if (t.body && typeof t.body === 'object') t = { ...t, ...t.body };
const what = { 'Start Index Part': 'today\'s chain of websites did not start', 'Start Next Index Part': 'the next website of today\'s chain did not start',
  'Restart Index Part': 'a website refused for capacity was not started again', 'Start Index Watch': 'the day\'s watch did not start' }['__START__'] || 'a part did not start';
let prior = []; try { prior = $('Load Start Alerts (__LB__)').all().map(i => i.json).filter(r => r && !r.error && r.alert_key); } catch (e) { prior = []; }
const p = OA.plan({ workflow: 'SEO Agent — Index Coverage', node: '__START__', message: what + ': ' + err.slice(0, 300),
  subject: '[high] Index coverage: ' + what, execution_id: S($execution.id), execution_url: '', mode: S(t.trigger) || 'index_coverage' }, prior, { webhook_url: OA.cfgUrl('__ALERT_WEBHOOK_URL__'), email_to: '' });
return [{ json: p.row }];
