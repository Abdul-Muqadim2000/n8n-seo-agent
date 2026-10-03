// Restores the ladder report item (json + PDF/Word binaries) after the Data Table steps and records whether the rows were stored.
const src = $('Attach PDF Ladder').first();
let stored_rows = 0, store_error = null;
if ((src.json.ladder || {}).planned === false) return [{ json: { ...src.json, stored_rows: 0, store_error: null, tracking_registered: false, settings_registered: false, settings_error: null }, binary: src.binary || {} }];   // v4.8: refused, nothing to store
try {
  const rows = $('Save Ladder Rows').all();
  stored_rows = rows.filter(i => i.json && !i.json.error && Object.keys(i.json).length).length;
  const err = rows.find(i => i.json && i.json.error);
  if (err) store_error = String((err.json.error && (err.json.error.message || err.json.error.description)) || err.json.error).slice(0, 200);
} catch (e) { store_error = 'Data Table step did not run: ' + String(e.message || e).slice(0, 160); }
// v4.8: the ladder's seo_ladder_settings row (plan type, reach, priority, mode) — an error here must be visible, not swallowed
let settings_registered = false, settings_error = null;
try {
  const srows = $('Save Ladder Settings').all().map(i => i.json || {});
  const serr = srows.find(r => r.error);
  if (serr) settings_error = String((serr.error && (serr.error.message || serr.error.description)) || serr.error).slice(0, 200);
  settings_registered = !serr && srows.some(r => r && Object.keys(r).length);
} catch (e) { settings_error = stored_rows ? 'settings step did not run' : null; }
return [{ json: { ...src.json, stored_rows, store_error, tracking_registered: stored_rows > 0, settings_registered, settings_error }, binary: src.binary || {} }];
