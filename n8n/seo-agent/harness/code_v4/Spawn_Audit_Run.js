// Audit requested through the form: the audit itself runs as a separate execution (API Entry, e-mail delivery) so the
// "Your audit has started" page can be shown at once — a form completion page ends the execution it is in.
const d = $input.first().json;
return [{ json: { body: { mode: 'audit', domain: d.domain, country: d.country, report_type: d.include_full_report ? 'Full SEO Report' : 'Site Audit (technical issues only)',
  competitors: (d.competitors || []).join(', '), email: d.email || '', callback_url: d.callback_url || '', request_id: d.request_id || $execution.id, client_ip: 'form-audit:' + $execution.id } } }];
