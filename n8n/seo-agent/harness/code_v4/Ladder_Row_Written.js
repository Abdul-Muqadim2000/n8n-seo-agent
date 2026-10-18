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
if (row.skip || !['written', 'not_ready'].includes(String(row.status || ''))) return [{ json: { skip: true, reason: 'no page was written in this run, so the ladder row keeps its state' } }];
let saved = false; try { saved = $('Save Content Log (Run)').all().some(i => i.json && !i.json.error && Object.keys(i.json).length > 0); } catch (e) { saved = false; }
if (!saved) return [{ json: { skip: true, reason: 'the content-log row was not saved, so nothing proves the page exists: the ladder row keeps its state' } }];
const notReady = row.status === 'not_ready';
return [{ json: { ladder_id, keyword, from_status: 'writing', status: notReady ? 'not_ready' : 'written',
  status_note: notReady ? ('written ' + new Date().toISOString().slice(0, 10) + ', did not pass the quality check: ' + String(row.qa_reasons || 'see the page report')).slice(0, 480) : '' } }];
