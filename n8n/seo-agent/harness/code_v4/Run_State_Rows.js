// G6: the split runs' state rows for seo_cache (upsert by key; exact columns).
const rows = $('AI Chunk Handoff').all().map(i => (i.json || {}).state_row).filter(Boolean);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];