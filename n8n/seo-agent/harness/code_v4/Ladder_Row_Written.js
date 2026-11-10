// F-A1 / A-20 (2026-10-17, re-rating exec 771): one state machine for a ladder page. The page run of "it consulting dubai" wrote its
// seo_content_log row as `not_ready` (the last quality round failed) while the seo_ladders row the ladder had set to `writing` stayed
// `writing` - two tables, two answers for one page. INVARIANTS rule 4: planned -> writing -> written / not_ready -> published, each step on
// evidence. The evidence here is the content-log row this run has just SAVED (*Save Content Log (Run)* answered with a row, not an error):
// the ladder row takes the same state, with the quality reasons in `status_note` when it failed. Only a row that is `writing` moves (the
// update matches status 'writing'), so a published page that is being refreshed is never set back, and a row nobody started is not touched.
const d = $('Normalize Input').first().json || {};
let row = {}; try { row = ($('Content Log Row').first() || {}).json || {}; } catch (e) { row = {}; }
const m = String(d.client_ip || '').match(/^ladder:\s*(.+)$/i);
const ladder_id = String(d.ladder_id || (m ? m[1] : '') || '').trim();
const keyword = String(d.keyword || '').trim();
if (!ladder_id || !keyword) return [{ json: { skip: true, reason: 'not a ladder page run: no ladder row to follow' } }];
// LADDER PACKAGE (2026-11-09, rule 4): a ladder page run Parse Verdict HELD (an AVOID or clearly-low verdict stops a ladder page, automatic or
// not; a person-started run also waits on a duplicate) wrote no page. Its row used to stay `writing` for ever (techand.ai "what is a crm
// company", 11-05): it goes to `stopped` with the reason, on the evidence of the saved `held` content-log row, and only "Write it anyway"
// (a run with hold_ack) writes it.
let PVL = {}; try { PVL = ($('Parse Verdict').first() || {}).json || {}; } catch (e) { PVL = {}; }
// review M3 (2026-11-10): a ladder stop is its own evidence that nothing was written (the hold IS the decision), so the row moves even when
// the content log kept an older row for the keyword (Content Log Row skips a held run when the keyword already had a page); any other hold
// still needs its saved `held` content-log row
const ladderStopL = PVL.verdict_hold === true && !!(PVL.hold && PVL.hold.ladder_stop);
if ((!row.skip && String(row.status || '') === 'held' && PVL.verdict_hold === true && PVL.hold) || ladderStopL) {
  let savedH = false; try { savedH = $('Save Content Log (Run)').all().some(i => i.json && !i.json.error && Object.keys(i.json).length > 0); } catch (e) { savedH = false; }
  if (!savedH && !ladderStopL) return [{ json: { skip: true, reason: 'the held content-log row was not saved: the ladder row keeps its state' } }];
  const why = ((PVL.hold.ladder_stop && PVL.hold.ladder_stop.reason) || (PVL.hold.reasons || [])[0] || 'our check held this page for your OK').replace(/\s+/g, ' ');
  return [{ json: { ladder_id, keyword, from_status: 'writing', status: 'stopped',
    status_note: ('stopped: ' + why + ' (checked ' + new Date().toISOString().slice(0, 10) + '). Nothing was written; choose "Write it anyway" to write it.').slice(0, 480) } }];
}
if (row.skip || !['written', 'not_ready'].includes(String(row.status || ''))) return [{ json: { skip: true, reason: 'no page was written in this run, so the ladder row keeps its state' } }];
let saved = false; try { saved = $('Save Content Log (Run)').all().some(i => i.json && !i.json.error && Object.keys(i.json).length > 0); } catch (e) { saved = false; }
if (!saved) return [{ json: { skip: true, reason: 'the content-log row was not saved, so nothing proves the page exists: the ladder row keeps its state' } }];
const notReady = row.status === 'not_ready';
const doneL = { ladder_id, keyword, status: notReady ? 'not_ready' : 'written',
  status_note: notReady ? ('written ' + new Date().toISOString().slice(0, 10) + ', did not pass the quality check: ' + String(row.qa_reasons || 'see the page report')).slice(0, 480) : '' };
// review H1 (2026-11-10): a page run the app's stuck-rung watcher closed (`failed`) that finished after all moves its row on too: one item
// per state it can be in (the update matches the row's status, so only the one that is there moves)
return [{ json: { ...doneL, from_status: 'writing' } }, { json: { ...doneL, from_status: 'failed' } }];
