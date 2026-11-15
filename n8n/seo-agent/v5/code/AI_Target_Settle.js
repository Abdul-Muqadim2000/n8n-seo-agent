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
/*__FIT_GATE__*/
/*__LADDER_RULES__*/
/*__AI_QUESTION__*/
// client reports 2026-11-16 (devaicon.com, INV1 F7 / F8 / F11): this node now also runs when the week writes nothing (the cadence's idle branch,
// *AI Target Settle (Idle)*): devaicon's question 41 said "being written" for days after its page went live because the only exit ran only on
// the branch that starts pages. A run that FAILED puts its question back in the queue at once; a ladder page of ANOTHER search that the
// question had been folded into (question 37: "agentic ai development companies uae" written as "ai app development companies") is not its
// page, so the question is queued again for a page of its own. The stored reason is plain words, with a reason code for the app.
const now = new Date().toISOString();
// Each node is read by name and not through a helper that hides it: `state_lint.py` asks of a node's OWN code which other node
// it took its evidence from, and a `$(name)` behind a variable is evidence nothing can see (INVARIANTS rule 4, check A).
const itemsOf = (get) => { try { return get().all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const writing = itemsOf(() => $('Load AI Targets Writing (Cadence)')).filter(t => t.target_id && String(t.status || '') === 'writing');
const logs = itemsOf(() => $('Load Content Log'));
// the strongest evidence on record per run: published beats written beats started (a run can leave more than one row over time)
// R111 (2026-10-16): `not_ready` is a draft whose last quality round failed — evidence that the run ended, never that a page exists
const RANK = { started: 1, not_ready: 1.5, written: 2, published: 3 };
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
  const tk = String(t.keyword || ''), lk = String((l && l.keyword) || '');
  // INV1 F7: a LADDER page of another search is not this question's page (the same search, or every word of that page's keyword in the question, is)
  if (l && String(l.source || '') === 'ladder' && tk && lk && !LRU.sameQuestion(tk, lk) && !LRU.coversHead(tk, lk)) {
    out.push({ json: { target_id: t.target_id, status: 'queued', request_id: '', written_at: '', at: now, reason_code: 'new_page', reason_args: JSON.stringify({ keyword: lk }),
      reason: 'The page written last time was for another search ("' + lk + '"), so the question is queued for a page of its own.' } });
    continue; }
  if (st === 'failed') {   // INV1 F8: the run stopped (the app's failure watcher, a page reader that refused): queued again now, not after 14 days
    out.push({ json: { target_id: t.target_id, status: 'queued', request_id: '', written_at: '', at: now, reason_code: 'run_failed', reason_args: JSON.stringify({}), reason: AQ.reason('run_failed', {}) } });
    continue; }
  if (st !== 'written' && st !== 'published') continue;   // no page on record (or R111: only a draft that failed its quality check): the row stays `writing`
  const args = st === 'published' ? { page_url: String(l.published_url || ''), date: String(l.published_at || '').slice(0, 10) } : {};
  out.push({ json: { target_id: t.target_id, status: 'written', at: now, request_id: rid,
    // the moment the page existed is the moment its run was logged, not the moment we read the row back
    written_at: String(l.started_at || t.written_at || now),
    reason_code: st === 'published' ? 'live' : 'written', reason_args: JSON.stringify(args),
    reason: AQ.reason(st === 'published' ? 'live' : 'written', args) + ' Checked against the page on record on ' + now.slice(0, 10) + '.' } });
}
return out.length ? out : [{ json: { skip: true } }];
