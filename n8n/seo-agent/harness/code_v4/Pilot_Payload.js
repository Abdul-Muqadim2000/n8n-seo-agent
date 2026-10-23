// The pilot's input (its Manual Run): only the fields it reads. `confirm` is true only when the caller sent the literal true.
const v = $('Pilot API Validate').first().json;
return [{ json: { domain: v.domain, site_id: v.site_id, confirm: v.confirm === true, callback_url: v.callback_url, email: '', request_id: v.request_id } }];