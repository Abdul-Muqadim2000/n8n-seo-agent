// Cycle Dispatcher: one item per job to start this sweep, most overdue first (at most max_starts; reads the plan explicitly: the node
// before it saved Data Table rows)
const p = $('Cycle Plan').first().json;
return (p.start || []).length ? p.start.map(s => ({ json: s })) : [{ json: { skip: true } }];
