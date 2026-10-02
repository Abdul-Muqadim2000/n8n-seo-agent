// Rows affected by the admin action (0 = no site / row with that id or keyword).
const a = $('Admin Action').first().json; const rows = $input.all().map(i => i.json).filter(r => r && typeof r === 'object');
const err = rows.find(r => r.error);
return [{ json: { ...a, affected: rows.filter(r => r.site_id || r.ladder_id).length, error: err ? String((err.error.message || err.error.description || err.error)).slice(0, 200) : null } }];
