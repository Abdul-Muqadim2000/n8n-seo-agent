// One seo_audit_findings row per scored finding (exact columns); the key ignores numbers so "7 pages ..." and "5 pages ..." are the same issue.
const d = $('Audit Diff').first().json; const a = d.site_audit || {};
const keyOf = (f) => String(f.category || '') + '|' + String(f.title || '').toLowerCase().replace(/\d[\d,.%]*/g, '#').replace(/["'“”‘’]/g, '').replace(/\s+/g, ' ').trim();
const rows = (a.findings || []).filter(f => f.scoring !== false && f.severity !== 'Info').map(f => ({ site_id: d.site_id, domain: a.domain || d.domain, audit_id: d.audit_id, audited_at: d.audited_at, finding_key: keyOf(f), category: f.category || '', severity: f.severity || '', title: String(f.title || '').slice(0, 200), affected_count: Number(f.affected_count) || 0 }));
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];
