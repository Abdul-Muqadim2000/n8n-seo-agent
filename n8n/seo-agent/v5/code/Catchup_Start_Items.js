// R94: one item per missed fire to start, in due order (reads the plan explicitly: the node before it saved a Data Table row)
const p = $('Catch-up Plan').first().json;
return (p.start || []).length ? p.start.map(s => ({ json: s })) : [{ json: { skip: true } }];
