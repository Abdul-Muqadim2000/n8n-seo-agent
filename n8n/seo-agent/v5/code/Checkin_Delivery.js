// Restores the check-in item after the Data Table steps and records whether the row was stored.
const p = $('Parse Check-in').first().json; let stored = true, store_error = null;
try { const s = ($('Save Check-in').first() || {}).json || {}; if (s.error) { stored = false; store_error = String((s.error.message || s.error.description || s.error)).slice(0, 200); } } catch (e) { stored = false; store_error = 'Data Table step did not run: ' + String(e.message || e).slice(0, 160); }
return [{ json: { ...p, stored, store_error } }];
