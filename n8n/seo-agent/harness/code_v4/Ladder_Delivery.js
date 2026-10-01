// Restores the ladder report item (json + PDF/Word binaries) after the Data Table steps and records whether the rows were stored.
const src = $('Attach PDF Ladder').first();
let stored_rows = 0, store_error = null;
try {
  const rows = $('Save Ladder Rows').all();
  stored_rows = rows.filter(i => i.json && !i.json.error).length;
  const err = rows.find(i => i.json && i.json.error);
  if (err) store_error = String((err.json.error && (err.json.error.message || err.json.error.description)) || err.json.error).slice(0, 200);
} catch (e) { store_error = 'Data Table step did not run: ' + String(e.message || e).slice(0, 160); }
return [{ json: { ...src.json, stored_rows, store_error, tracking_registered: stored_rows > 0 }, binary: src.binary || {} }];
