// F2 (2026-10-23, ENGINE_AUDIT.md E1): the ops alerts of a split run that had to stop (its answers were not stored, it reached its money
// ceiling), lost a part, or could not record what it was about to pay for. Exact seo_ops_alerts columns, upserted on alert_key (one key per
// site x run x kind). They are recorded here, BEFORE anything is sent (D25b's rule: the table is the record of last resort), with
// `next_attempt_at` = now, so this execution's own alert sweep (behind the ledger settle: Load Open Alerts -> Alert Retry Plan -> Post Alert
// Retry) delivers them to SEO_ALERT_WEBHOOK_URL and records the delivery on the row.
const rows = $('AI Chunk Handoff').all().flatMap(i => ((i.json || {}).alerts) || []).filter(r => r && r.alert_key);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];
