// R94: one item per scheduled workflow, with the two reads of n8n's own public API that decide whether its last fire happened —
// the workflow (is it on, when was it last published = when its schedule was last re-armed) and its executions (mode `trigger` =
// fired by its own schedule). The schedule table is baked by build_catchup.py from the generated workflows, so it cannot drift.
const SCHEDULES = [{"id": "SEOagentAIPulse1", "label": "AI Pulse", "mode": "ai_pulse", "cron": "30 6 * * *", "kind": "daily", "tz": "America/New_York", "entry_node": "Manual Run", "dry_run_ok": false}, {"id": "SEOagentIndexCv1", "label": "Index Coverage", "mode": "index_coverage", "cron": "15 5 * * *", "kind": "daily", "tz": "America/New_York", "entry_node": "Manual Run", "dry_run_ok": false}, {"id": "SEOagentPageWch1", "label": "Page Watch", "mode": "page_watch", "cron": "45 5 * * *", "kind": "daily", "tz": "America/New_York", "entry_node": "Watch Run", "dry_run_ok": false}];
const API = 'http://localhost:5678/api/v1';
const LIMIT = 250;
return SCHEDULES.map(s => ({ json: { workflow_id: s.id, label: s.label, wf_url: API + '/workflows/' + s.id + '?excludePinnedData=true',
  ex_url: API + '/executions?workflowId=' + s.id + '&limit=' + LIMIT } }));
