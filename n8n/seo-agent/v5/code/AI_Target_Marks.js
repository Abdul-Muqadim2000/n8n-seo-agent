// v4.12: the AI targets whose page run was started this week -> status `writing` (the AI Growth loop marks them `won` once AI
// names the business for the question).
//
// B9-6 (2026-10-15, benchmark area 9 / INVARIANTS rule 4 — the WRITE half; the read half landed in build section 82):
// `writing` was a promise nobody kept. This node marked every planned target `writing` whatever the spawn did, and nothing ever
// wrote the row forward again, so a question could sit "being written" for ever and never be queued a second time — R1's class
// in the one table R1 did not cover. Two things change here, and both are evidence, not optimism:
//   * a target whose content run could NOT BE STARTED goes back to `queued` with the reason, so the next run picks it up. That is
//     the way back check B of `state_lint.py` now requires of every table a run moves to `writing`.
//   * the row that IS marked says in its own `reason` that nothing has been written yet. `written_at` is the moment the attempt
//     was made — it is what the read half (`Growth_Plan.js`) measures its 14-day staleness from, and the only thing that moves
//     this row to `written` is *AI Target Settle*, against a `seo_content_log` row for the same run.
// What this node CANNOT see: a run that starts and is then refused inside the main workflow (the budget guard, a failed step).
// `Start Content Runs` is an Execute Workflow node with `waitForSubWorkflow: false`, so the outcome never comes back here. That
// gap is exactly what the read half's evidence rule is for; it is not papered over with a guess.
const now = new Date().toISOString();
// the plan items that really went to *Start Content Runs*: `Any Pages?` drops `nothing_to_do` and `Dry Run?` drops a dry run,
// in this order, so index i here is item i there (the node runs in `each` mode).
const items = $('Cadence Plan').all().map(i => i.json).filter(p => p && !p.nothing_to_do && !p.dry_run);
let spawned = null;
try { spawned = $('Start Content Runs').all(); } catch (e) { spawned = null; }
// only trust the index when the two lists line up — a length that differs means something filtered in between, and guessing
// which page failed would be worse than marking as before
const aligned = Array.isArray(spawned) && spawned.length === items.length;
const errOf = (it) => { if (!it) return ''; const e = it.error || (it.json && it.json.error); if (!e) return '';
  return String((e && (e.message || e.description)) || e).slice(0, 160); };
const rows = [];
items.forEach((p, i) => {
  if (!p.target_id) return;
  const rid = (p.body && p.body.request_id) || p.request_id || '';
  const err = aligned ? errOf(spawned[i]) : '';
  if (err) {
    rows.push({ json: { target_id: p.target_id, status: 'queued', request_id: '', written_at: '', at: now,
      reason: 'the page run could not be started on ' + now.slice(0, 10) + ' (' + err + '): the question is queued again rather than left saying "being written"' } });
    return;
  }
  rows.push({ json: { target_id: p.target_id, status: 'writing', request_id: rid, written_at: now, at: now,
    reason: 'a page run (' + rid + ') was started on ' + now.slice(0, 10) + '; nothing has been written yet — this row moves to "written" only against a seo_content_log row for that run' } });
});
return rows.length ? rows : [{ json: { skip: true } }];
