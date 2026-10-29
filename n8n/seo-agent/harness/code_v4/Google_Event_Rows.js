// Index coverage: the seo_google_events rows that are new or changed (exact columns: the upsert maps every input field).
const g = ($('Google Events').first() || {}).json || {};
const rows = g.rows || [];
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'no event changed' } }];
