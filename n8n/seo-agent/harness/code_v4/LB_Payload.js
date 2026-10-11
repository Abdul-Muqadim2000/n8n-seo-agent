// The run's input (Manual Run of the Link Builder): only the fields it reads.
const v = $('LB API Validate').first().json;
return [{ json: { domain: v.domain, site_id: v.site_id, free_only: v.free_only, callback_url: v.callback_url, email: '', request_id: v.request_id } }];