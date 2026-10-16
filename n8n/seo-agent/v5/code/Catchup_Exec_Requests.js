// R94: the executions read, one per scheduled workflow, in the order of *Catch-up Targets* (the workflow reads just replaced the items)
return $('Catch-up Targets').all().map(i => ({ json: { workflow_id: i.json.workflow_id, url: i.json.ex_url } }));
