// An API request failed validation inside the main run. Tell the caller through callback_url;
// with no callback_url, fail loudly so the error workflow alerts ops.
const d = $input.first().json;
if (!d.callback_url) throw new Error('API request rejected (no callback_url to notify): ' + d.validation_error);
return [{ json: { status: 'rejected', request_id: d.request_id || null, execution_id: $execution.id, error: d.validation_error, callback_url: d.callback_url } }];