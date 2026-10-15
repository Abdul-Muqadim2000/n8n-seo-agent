// B9-6 (2026-10-15, benchmark area 9 / INVARIANTS rule 4 — the WRITE half): the state `writing` had no exit. Nothing in the
// system ever set an AI target to `written`, so `Growth_Metrics` counted `written: 0` every week of its life, a win was decided
// on a row that still claimed to be in progress, and a question whose page had been written months ago was never counted as
// answered.
//
// This node is the exit, and it follows R1's precedent exactly: **a page counts as written only on a `written` content-log
// row**. The row is advanced for one reason only — the `seo_content_log` row for the very run this target started says the page
// exists (`written`, or `published` once the owner reported the link). *Content Log Row* in the main workflow writes that status
// from the page text itself, so the proof is the artefact, one hop away.
//
// What it deliberately does NOT do: time out a row. A `writing` row with no content-log row is left exactly as it is, and the
// read half (`Growth_Plan.js`, build section 82) queues the question again after 14 days with its reason and a medium alert.
// One rule, one place: a second timeout here would be a second answer to the same question.
const now = new Date().toISOString();
// Each node is read by name and not through a helper that hides it: `state_lint.py` asks of a node's OWN code which other node
// it took its evidence from, and a `$(name)` behind a variable is evidence nothing can see (INVARIANTS rule 4, check A).
const itemsOf = (get) => { try { return get().all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const writing = itemsOf(() => $('Load AI Targets Writing (Cadence)')).filter(t => t.target_id && String(t.status || '') === 'writing');
const logs = itemsOf(() => $('Load Content Log'));
// the strongest evidence on record per run: published beats written beats started (a run can leave more than one row over time)
const RANK = { started: 1, written: 2, published: 3 };
const byReq = new Map();
for (const l of logs) {
  const rid = String(l.request_id || ''); if (!rid) continue;
  const cur = byReq.get(rid);
  if (!cur || (RANK[String(l.status || '')] || 0) > (RANK[String(cur.status || '')] || 0)) byReq.set(rid, l);
}
const out = [];
for (const t of writing) {
  const rid = String(t.request_id || '');
  const l = rid ? byReq.get(rid) : null;
  const st = l ? String(l.status || '') : '';
  if (st !== 'written' && st !== 'published') continue;   // no page on record: the row stays `writing` and says so
  out.push({ json: { target_id: t.target_id, status: 'written', at: now,
    // the moment the page existed is the moment its run was logged, not the moment we read the row back
    written_at: String(l.started_at || t.written_at || now),
    reason: 'the page exists: the seo_content_log row for run ' + rid + ' says "' + st + '"'
      + (l.published_url ? ' (' + String(l.published_url).slice(0, 120) + ')' : '') + ', read on ' + now.slice(0, 10) } });
}
return out.length ? out : [{ json: { skip: true } }];
