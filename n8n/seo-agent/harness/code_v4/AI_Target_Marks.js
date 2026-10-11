// v4.12: the AI targets written this week -> status writing (the AI Growth loop marks them won once AI names the business for the question).
const now = new Date().toISOString();
const rows = $('Cadence Plan').all().map(i => i.json).filter(p => !p.nothing_to_do && !p.dry_run && p.target_id).map(p => ({ json: { target_id: p.target_id, request_id: (p.body && p.body.request_id) || '', at: now } }));
return rows.length ? rows : [{ json: { skip: true } }];