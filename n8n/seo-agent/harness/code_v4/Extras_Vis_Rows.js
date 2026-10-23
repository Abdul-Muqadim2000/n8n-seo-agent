// W2-E3: the stored visibility row's update per site (only the columns AI Extras carries: notes_json, cost_usd, and fanout_gap_json / demand_json when read).
const rows = $('AI Extras').all().map(i => (i.json || {}).vis_update).filter(Boolean);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];