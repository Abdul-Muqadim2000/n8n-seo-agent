// Ladder rows of the pages started this week -> status "writing" (so the Rank Tracker and the next cadence know).
// R16 (2026-10-13, FIX_PLAN §3.11): and the rungs the fit gate set aside -> status "set_aside", so the row stops saying "planned" to
// everything that reads it (the next cadence run, the Rank Tracker, the app's ladder page). A dry run writes nothing, and a rung whose
// page is already written is never marked (fitStored keeps it; the report flags it instead).
const items = $('Cadence Plan').all().map(i => i.json).filter(p => p && !p.dry_run);
const m = items.filter(p => p.ladder_id && !p.nothing_to_do).map(p => ({ json: { ladder_id: p.ladder_id, keyword: p.keyword, status: 'writing' } }));
const seen = new Set(m.map(x => x.json.ladder_id + '|' + String(x.json.keyword).toLowerCase()));
const aside = [];
for (const p of items) for (const x of (p.set_aside || [])) {
  if (!x || !x.dropped || !x.ladder_id || !x.keyword) continue;
  const k = x.ladder_id + '|' + String(x.keyword).toLowerCase();
  if (seen.has(k)) continue;
  seen.add(k);
  aside.push({ json: { ladder_id: x.ladder_id, keyword: x.keyword, status: 'set_aside' } });
}
const out = [...m, ...aside];
return out.length ? out : [{ json: { skip: true } }];
