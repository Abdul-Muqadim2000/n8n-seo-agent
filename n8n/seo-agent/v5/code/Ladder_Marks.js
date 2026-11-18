// Ladder rows of the pages started this week -> status "writing" (so the Rank Tracker and the next cadence know).
// R16 (2026-10-13, FIX_PLAN §3.11): and the rungs the fit gate set aside -> status "set_aside", so the row stops saying "planned" to
// everything that reads it (the next cadence run, the Rank Tracker, the app's ladder page). A dry run writes nothing, and a rung whose
// page is already written is never marked (fitStored keeps it; the report flags it instead).
const items = $('Cadence Plan').all().map(i => i.json).filter(p => p && !p.dry_run);
// review R5 (M1, client report 2026-11-17): the row takes the address its page is being written at. Cadence Plan writes a rung planned at the
// root of a site that keeps that kind of page in a folder at the folder address (LRU.folderAddress), and a rung whose address belongs to
// another search at its own new address; the row kept the old address until publish detection found the page, so the hub's links, the
// siblings' links and the app's "Write now" still pointed at an address that will never exist. Every item carries the address (the page's,
// or the row's own, unchanged: Cadence Plan moves only a row that has an address, so an empty one stays empty) and whether a page already
// lives there (the page run improves `existing_page_url`), because the update writes both columns on every row it marks.
const m = items.filter(p => p.ladder_id && !p.nothing_to_do).map(p => ({ json: { ladder_id: p.ladder_id, keyword: p.keyword, status: 'writing', status_note: '',
  target_url: String((p.body || {}).ladder_target_url || '').trim(), page_exists: !!String(p.existing_page_url || '').trim() } }));
const seen = new Set(m.map(x => x.json.ladder_id + '|' + String(x.json.keyword).toLowerCase()));
const aside = [];
for (const p of items) for (const x of (p.set_aside || [])) {
  if (!x || !x.dropped || !x.ladder_id || !x.keyword) continue;
  const k = x.ladder_id + '|' + String(x.keyword).toLowerCase();
  if (seen.has(k)) continue;
  seen.add(k);
  // review R5 (M1): the update writes the address columns too: the row's own, unchanged (Cadence Plan's set_aside entry carries them)
  aside.push({ json: { ladder_id: x.ladder_id, keyword: x.keyword, status: 'set_aside', target_url: String(x.target_url || ''), page_exists: x.page_exists === true,
    status_note: String(x.note || x.detail || x.reason || 'set aside by the fit gate').slice(0, 300) } });   // R1 + R16: the row carries its own reason
}
const out = [...m, ...aside];
return out.length ? out : [{ json: { skip: true } }];
