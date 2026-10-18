// The audit's row in seo_audits (exact columns).
const d = $('Audit Diff').first().json; const a = d.site_audit || {};
// R67 (2026-10-16): the row counts exactly the findings Finding Rows stores (scored, not Info) — the severity columns used to come from `issue_counts`, which also
// counts the full report's content-review findings (scoring: false), so the row said 17 High while its own 51 rows held 14 and the two sums disagreed.
const stored = (a.findings || []).filter(f => f.scoring !== false && f.severity !== 'Info'); const sev = (k) => stored.filter(f => f.severity === k).length;
return [{ json: { site_id: d.site_id, domain: a.domain || d.domain, audit_id: d.audit_id, audited_at: d.audited_at, report_type: a.audit_level || 'site_audit', health_score: Number(a.health_score) || 0, grade: a.grade || '', pages_crawled: Number(a.pages_crawled) || 0,
  findings: stored.length, critical: sev('Critical'), high: sev('High'), medium: sev('Medium'), low: sev('Low'), scheduled: !!d.scheduled, request_id: d.request_id || '',
  crawl_js: !!a.crawl_js, checks_version: String(a.checks_version || ''), not_fixed_json: JSON.stringify((a.not_fixed || []).slice(0, 60)).slice(0, 4000) } }];   // B-5 + rule 1
