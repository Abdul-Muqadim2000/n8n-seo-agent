// R1 (2026-10-13, re-rating RESULTS §3.2): a page run the day's AI budget guard refused left its seo_ladders row saying "writing", and three
// features then reported a page that does not exist. Live: execution 500 was refused (ledger row 40 `refused`) while row 19 ("service
// industry erp software") stayed `writing`, so within 90 seconds the ladder plan promised the page, the Rank Tracker said "already written —
// publish it" and the Content Cadence counted it among the 6 pages waiting for publication and paused itself on the pile-up limit.
// On the refusal path the row goes back to `planned` with the reason, so the next weekly run writes the page instead of waiting for it.
// The run is a ladder page run when it was started by *Spawn Page Runs* (`client_ip: 'ladder:<id>'`) or carries a ladder id.
const d = $('Refused Input').first().json || {};
const ip = String(d.client_ip || '');
const m = ip.match(/^ladder:\s*(.+)$/i);
const ladder_id = String((m ? m[1] : d.ladder_id) || '').trim();
const keyword = String(d.keyword || '').trim();
const mode = String(d.mode || '');
if (!ladder_id || !keyword || !['keyword', 'ladder'].includes(mode)) return [{ json: { skip: true, reason: 'not a ladder page run: nothing claims a page' } }];
const why = String(d.validation_error || 'the run was refused').replace(/\s+/g, ' ').trim();
// the note is what the ladder detail, the cadence note and the Rank Tracker show instead of a page nobody wrote
return [{ json: { ladder_id, keyword, status: 'planned',
  status_note: ('refused ' + new Date().toISOString().slice(0, 10) + ': ' + why + ' The page was not written; it is planned again.').slice(0, 480) } }];
