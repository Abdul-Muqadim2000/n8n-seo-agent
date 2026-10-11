// The drafted sequences merged into the outreach rows (status drafted; wait_days in working days: follow-up 1 after 4, follow-up 2 after 8 more;
// journalist requests: one follow-up after 3), prospects the writer turned down marked not a fit (with its reason), and every table's rows
// passed on per site for the save nodes (exact columns there).
const sites = $('LB Assemble').all().map(i => i.json).filter(s => !s.skip);
let inputs = [], outs = []; try { inputs = $('LB Writer Input').all().map(i => i.json).filter(j => !j.skip); outs = $('Outreach Sequence Writer').all().map(i => i.json); } catch (e) {}
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
const clean = (t, n) => String(t || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
return sites.map(s => {
  const ji = inputs.findIndex(j => j.site_id === s.site_id); const job = ji >= 0 ? inputs[ji] : null; const o = ji >= 0 ? outs[ji] : null;
  const res = o && !o.error ? (parse(o.output) || {}) : {};
  const rows = s.outreach_rows.map(r => ({ ...r })); let drafted = 0, skipped = 0;
  const rowFor = (j) => { let r = rows.find(x => x.prospect_domain === j.prospect_domain && x.type === j.type); if (!r) { const src = s.jobs.find(x => x.prospect_domain === j.prospect_domain && x.type === j.type); if (src) { r = { ...src }; rows.push(r); } } return r; };
  if (job) {
    for (const sq of (res.sequences || [])) { const j = job.jobs.find(x => x.n === Number(sq.n)); if (!j) continue; const r = rowFor(j); if (!r) continue;
      const steps = (sq.steps || []).filter(x => clean(x.body, 10)).sort((a, b) => Number(a.step) - Number(b.step)).slice(0, j.type === 'press' ? 2 : 3);
      if (!steps.length || !clean(steps[0].subject, 5)) continue;
      const waits = j.type === 'press' ? [0, 3] : [0, 4, 8];
      r.sequence_json = JSON.stringify(steps.map((x, i) => ({ step: i, wait_days: waits[i], subject: i === 0 ? clean(x.subject, 90) : '', body: clean(x.body, i === 0 ? 2200 : 900) })));
      r.status = 'drafted'; r.drafted_at = s.checked_at; drafted++; }
    for (const sk of (res.skip || [])) { const j = job.jobs.find(x => x.n === Number(sk.n)); if (!j) continue; const r = rowFor(j); if (!r || r.status === 'drafted') continue; r.status = 'not_fit'; r.fit_reason = 'writer: ' + clean(sk.reason, 200); skipped++; }
  }
  return { json: { site_id: s.site_id, outreach_rows: rows, prospect_rows: s.prospect_rows, listing_rows: s.listing_rows, impact_rows: s.impact_rows, cache_rows: [s.cache_row], drafted, skipped, writer_error: o && o.error ? String(o.error.message || o.error).slice(0, 200) : '' } };
});
