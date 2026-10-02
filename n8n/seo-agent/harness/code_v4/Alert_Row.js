// Row for the Data Table seo_console_alerts (upserted by message id, so a re-read mail never duplicates).
const a = $('Classify Notification').first().json;
return [{ json: { site_id: a.site_id, domain: a.domain, kind: a.kind, severity: a.severity, subject: a.subject, summary: a.summary, received_at: a.received_at, message_id: a.message_id, status: 'new', source: 'mail' } }];
