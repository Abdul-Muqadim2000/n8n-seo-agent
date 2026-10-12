// The checked sequences merged into the outreach rows (LB Draft QA decided: `drafted` when every check passed, `needs_edit` with the reasons
// when one did not — the owner edits it in the app and automatic mode skips it; wait_days in working days: follow-up 1 after 4, follow-up 2
// after 8 more, journalist requests one after 3), prospects the writer turned down marked not a fit (with its reason), and every table's rows
// passed on per site for the save nodes (exact columns there).
const sites = $('LB Assemble').all().map(i => i.json).filter(s => !s.skip);
let qas = []; try { qas = $('LB Draft QA').all().map(i => i.json).filter(q => !q.skip); } catch (e) {}
const clean = (t, n) => String(t || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
return sites.map(s => {
  const qa = qas.find(q => q.site_id === s.site_id) || null;
  const rows = s.outreach_rows.map(r => ({ ...r })); let drafted = 0, skipped = 0, held = 0;
  const rowFor = (j) => { let r = rows.find(x => x.prospect_domain === j.prospect_domain && x.type === j.type); if (!r) { const src = s.jobs.find(x => x.prospect_domain === j.prospect_domain && x.type === j.type); if (src) { r = { ...src }; rows.push(r); } } return r; };
  if (qa) {
    for (const v of (qa.verdicts || [])) { const r = rowFor(v); if (!r || !(v.steps || []).length) continue;
      r.sequence_json = JSON.stringify(v.steps); r.drafted_at = s.checked_at;
      if (v.ok) { r.status = 'drafted'; drafted++; }
      else { r.status = 'needs_edit'; r.fit_reason = 'held for your edit: ' + (v.held || []).join('; ').slice(0, 400); held++; } }
    for (const sk of (qa.writer_skip || [])) { const r = rowFor(sk); if (!r || ['drafted', 'needs_edit'].includes(r.status)) continue; r.status = 'not_fit'; r.fit_reason = 'writer: ' + clean(sk.reason, 200); skipped++; }
  }
  return { json: { site_id: s.site_id, outreach_rows: rows, prospect_rows: s.prospect_rows, listing_rows: s.listing_rows, impact_rows: s.impact_rows, cache_rows: [s.cache_row], drafted, skipped, held, writer_error: qa ? qa.writer_error : '' } };
});
