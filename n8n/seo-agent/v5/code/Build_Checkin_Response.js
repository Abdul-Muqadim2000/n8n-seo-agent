// API answer for mode "checkin" (POSTed to callback_url).
const p = $input.first().json;
return [{ json: { status: 'completed', stage: 'console_checkin', request_id: p.request_id || null, domain: p.domain, month: p.checkin_month, manual_action: !!p.checkin_row.manual_action, security_issue: !!p.checkin_row.security_issue, coverage: p.coverage, summary: p.summary_lines, stored: p.stored, store_error: p.store_error, callback_url: p.callback_url } }];
