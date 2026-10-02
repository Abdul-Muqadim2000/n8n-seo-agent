// The audit's row in seo_audits (exact columns).
const d = $('Audit Diff').first().json; const a = d.site_audit || {}; const c = a.issue_counts || {};
return [{ json: { site_id: d.site_id, domain: a.domain || d.domain, audit_id: d.audit_id, audited_at: d.audited_at, report_type: a.audit_level || 'site_audit', health_score: Number(a.health_score) || 0, grade: a.grade || '', pages_crawled: Number(a.pages_crawled) || 0,
  findings: (a.findings || []).filter(f => f.scoring !== false && f.severity !== 'Info').length, critical: c.Critical || 0, high: c.High || 0, medium: c.Medium || 0, low: c.Low || 0, scheduled: !!d.scheduled, request_id: d.request_id || '' } }];
