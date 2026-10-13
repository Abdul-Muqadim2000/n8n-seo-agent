// G11 (2026-10-13), the second half: "I fixed this" in the app marks the finding (seo_audit_findings.recheck_state = requested); the next
// daily watch answers it on the key pages it just read and writes the answer back on that row — `fixed`, `still_open`, or `not_checked`
// with the reason it cannot be judged without the full audit. Nothing waits for the monthly audit any more.
const sites = $('Watch Compare').all().map(i => i.json).filter(s => s && !s.skip);
const S = (v) => String(v == null ? '' : v).trim();
const rows = [];
for (const s of sites) for (const r of (s.rechecks || [])) {
  if (!S(r.finding_key)) continue;
  rows.push({ site_id: s.site_id, domain: s.domain, audit_id: S(r.audit_id), finding_key: S(r.finding_key),
    recheck_state: S(r.state), recheck_at: s.checked_at, recheck_rule: S(r.rule), recheck_note: S(r.note).slice(0, 500),
    title: S(r.title), severity: S(r.severity) });
}
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'nobody asked for a re-check' } }];
