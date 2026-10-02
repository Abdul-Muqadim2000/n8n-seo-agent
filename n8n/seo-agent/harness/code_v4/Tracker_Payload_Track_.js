// What the Site Tracker receives through its "Manual Run" trigger: run this one site now (first report in a few minutes).
const r = $('Site Row (Track)').first().json; let saved = {}; try { saved = ($('Save Site (Track)').first() || {}).json || {}; } catch (e) {}
return [{ json: { site_id: r.site_id, domain: r.domain, on_demand: true, request_id: r.request_id || '', stored: !saved.error, store_error: saved.error ? String((saved.error.message || saved.error.description || saved.error)).slice(0, 200) : null } }];
