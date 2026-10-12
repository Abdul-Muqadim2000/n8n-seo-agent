// API answer for mode "checkin" (POSTed to callback_url).
const p = $input.first().json;
// D25c (2026-10-12): is_test says whether this check-in counts as the month's answer (a test never does, so the reminder keeps asking).
return [{ json: { status: 'completed', stage: 'console_checkin', request_id: p.request_id || null, domain: p.domain, month: p.checkin_month, manual_action: !!p.checkin_row.manual_action, security_issue: !!p.checkin_row.security_issue, is_test: !!p.checkin_is_test, test_reason: p.checkin_test_reason || '', counts_for_month: !p.checkin_is_test, coverage: p.coverage, summary: p.summary_lines, stored: p.stored, store_error: p.store_error, callback_url: p.callback_url } }];
