// R94: one item per scheduled workflow, with the two reads of n8n's own public API that decide whether its last fire happened —
// the workflow (is it on, when was it last published = when its schedule was last re-armed) and its executions (mode `trigger` =
// fired by its own schedule). The schedule table is baked by build_catchup.py from the generated workflows, so it cannot drift.
const SCHEDULES = __SCHEDULES__;
const API = '__N8N_API__';
const LIMIT = __EXEC_LIMIT__;
return SCHEDULES.map(s => ({ json: { workflow_id: s.id, label: s.label, wf_url: API + '/workflows/' + s.id + '?excludePinnedData=true',
  ex_url: API + '/executions?workflowId=' + s.id + '&limit=' + LIMIT } }));
