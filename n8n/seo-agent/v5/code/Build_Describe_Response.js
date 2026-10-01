// API delivery for "describe my website": the description goes to the callback instead of a form page
const d = $input.first().json;
return [{ json: { status: 'completed', stage: 'site_description', request_id: d.request_id || null, execution_id: $execution.id, domain: d.domain || null,
  site_description: d.site_description || null, site_read_failed: !!d.site_read_failed, html: d.result_html || null, run_ledger: d.run_ledger || null, callback_url: d.callback_url || '' } }];
