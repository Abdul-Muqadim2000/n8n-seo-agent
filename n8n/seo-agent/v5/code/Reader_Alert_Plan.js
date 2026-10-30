// W07-A (2026-10-31): the page reader's refusal on record FIRST (D25b's rule: seo_ops_alerts is the record of last resort), as the DataForSEO
// and run failures are: OA.plan counts a repeat within OA.DEDUPE_MINUTES on the same row and does not send it again, so a run whose ten steps
// all meet the refusal (and every run of the next half hour) raises one alert, not ten. The row carries exactly the table's columns.
/*__OPS_ALERT__*/
const S = (v) => String(v == null ? '' : v).trim();
const a = (() => { try { return $('Reader Refusals').last().json || {}; } catch (e) { return {}; } })();
const rows = $input.all().map(i => (i && i.json) || {}).filter(r => r && !r.error && S(r.alert_key));
const p = OA.plan(a.alert || {}, rows, { webhook_url: '__ALERT_WEBHOOK_URL__', email_to: '' });
return [{ json: { ...p.row, severity: 'critical', message: (S((a.alert || {}).message) + '. ' + S(a.detail)).slice(0, 800) } }];
