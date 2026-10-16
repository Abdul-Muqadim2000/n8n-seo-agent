// R87 (2026-10-16, re-rating 2026-10-15): the Rank Tracker writes back what its report set aside. Before this node the report could say
// "set aside" about a ladder's main keyword and the row went on saying `planned`, so the Content Cadence of the same Monday queued four of
// that ladder's rungs (exec 638) — "set aside and pursued in the same run". Every refused keyword with no page yet becomes
// `status: 'set_aside'` on its seo_ladders row with the reason in `status_note` (the same two columns the cadence's *Ladder Marks*
// writes, R16), and the head of a paused ladder says the ladder is paused until it is re-planned. A page that is already written is
// never marked (fitStored keeps it and the report only flags it). The rows go to a Data Table update node, so each item carries exactly
// the four fields that node maps.
const items = $input.all().map(i => i.json).filter(j => j && j.ladder_id && Array.isArray(j.ladder_marks));
const seen = new Set(); const out = [];
for (const j of items) for (const m of j.ladder_marks) {
  if (!m || !m.ladder_id || !m.keyword || m.status !== 'set_aside') continue;
  const k = m.ladder_id + '|' + String(m.keyword).toLowerCase();
  if (seen.has(k)) continue; seen.add(k);
  out.push({ json: { ladder_id: String(m.ladder_id), keyword: String(m.keyword), status: 'set_aside', status_note: String(m.status_note || 'set aside by the keyword rule').slice(0, 300) } });
}
return out.length ? out : [{ json: { skip: true } }];
