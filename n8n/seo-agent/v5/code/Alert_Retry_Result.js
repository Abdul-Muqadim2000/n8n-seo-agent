// B-A7 (2026-10-15, build section 64): what the re-send actually did, written back on the same seo_ops_alerts row — the attempt number, the
// time, the next time it may be tried, the whole attempt history and, from AR.ESCALATE_AFTER attempts, a severity of `critical`.
// The row is marked delivered ONLY on a 2xx (Rule 4 of INVARIANTS.md: a record says a thing exists only when it exists). The POST node is
// `neverError` + `fullResponse`, so a 404 from a revoked webhook arrives as an item with a status code, not as a success.
/*__OPS_ALERT__*/
/*__ALERT_RETRY__*/
let planned = [];
try { planned = $('__PLAN__').all().map(i => i.json).filter(j => j && j.alert_key && !j.skip); } catch (e) { planned = []; }
if (!planned.length) return [{ json: { skip: true, reason: 'nothing was re-sent' } }];
const rows = AR.settle(planned, $input.all());
// the Data Table update auto-maps every field it is given, so only the columns it writes may travel
return rows.map(r => ({ json: { alert_key: r.alert_key, delivered: r.delivered, channels: r.channels, severity: r.severity,
  attempts: r.attempts, last_attempt_at: r.last_attempt_at, next_attempt_at: r.next_attempt_at, attempt_log: r.attempt_log, notes: r.notes } }));
