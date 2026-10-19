// Cycle Dispatcher: one read of n8n's own public API per workflow that has a cycle job starting or running - its recent executions say
// whether the run we started appeared, and whether n8n stopped it (crashed / canceled). The ledger row is the first evidence; this is the
// second, for a run that has not reserved its row yet or died without settling it. Only the cycle's own workflows are ever read.
const API = 'http://localhost:5678/api/v1';
const LIMIT = 100;
const KNOWN = new Set(["SEOagentAIGrow1", "SEOagentAIVisib1", "SEOagentAuditSc1", "SEOagentBacklnk1", "SEOagentCadence1", "SEOagentLinkBld1", "SEOagentSiteTrk1", "SEOagentTracker1"]);
let rows = []; try { rows = $('Load Cycle Jobs').all().map(i => i.json || {}); } catch (e) { rows = []; }
const ids = [...new Set(rows.filter(r => r && !r.error && String(r.job || '') !== 'cycle' && ['starting', 'running'].includes(String(r.status || '')))
  .map(r => String(r.workflow_id || '')).filter(id => KNOWN.has(id)))].sort();
return ids.length ? ids.map(id => ({ json: { workflow_id: id, url: API + '/executions?workflowId=' + id + '&limit=' + LIMIT } })) : [{ json: { skip: true } }];
