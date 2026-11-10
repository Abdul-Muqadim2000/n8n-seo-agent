// One row per ladder page for the "seo_ladders" Data Table (the rank tracker reads these every week).
const d = $('Attach PDF Ladder').first().json;
const L = d.ladder || {};
if (L.planned === false) return [{ json: { skip: true, reason: (L.refusal || {}).reason || 'no pages planned' } }];   // v4.8: a refused ladder (duplicate / not realistic) stores nothing
const pages = [...(L.rungs || []).flatMap(r => (r.pages || []).map(p => ({ ...p, months: r.months }))), L.top].filter(Boolean);
// LADDER PACKAGE (2026-11-09, rule 4): a rung the website's own checks advised against is stored STOPPED with its reason, so the ladder page shows
// it and the Content Cadence (which writes `planned` rows only) never writes it; "Write it anyway" in the app is the only way past it
const stoppedRows = (L.stopped || []).filter(p => p && p.keyword).map(p => ({ ...p, months: null, status_override: 'stopped', note: ('stopped: ' + String((p.stop || {}).reason || 'our check advised against this page')).slice(0, 480) }));
const now = new Date().toISOString();
// R1 (2026-10-13): only the pages this run really starts are marked `writing` — *Spawn Page Runs* takes at most 3, and a page run the
// day's budget guard refuses sets its row back to `planned` with the reason (*Refused Ladder Row*), so no feature reports a page nobody wrote.
const startedNow = Math.min(3, Math.max(1, Number(d.pages_now) || 1));
const writing = new Set((L.write_now || []).slice(0, startedNow).map(w => w.keyword));
// F-KW (2026-10-20, finding 9): who chose this ladder's keyword, on every row (the settings row is written after these rows and may fail);
// the same rule as Ladder Settings Rows: the request's chooser, else the plan's, else client_typed (a ladder started through the API)
const CHOSEN = ['client_typed', 'client_picked', 'system_announced'];
const lcC = (v) => String(v == null ? '' : v).toLowerCase().trim();
let reqC = {}; try { reqC = $('Normalize Input').first().json || {}; } catch (e) { reqC = {}; }
const chosen_by = CHOSEN.includes(lcC(reqC.chosen_by)) ? lcC(reqC.chosen_by) : CHOSEN.includes(lcC(d.chosen_by)) ? lcC(d.chosen_by) : 'client_typed';
return [...pages, ...stoppedRows].map(p => ({ json: {
  ladder_id: String(L.ladder_id || ''), domain: String(L.domain || d.domain || ''), head_keyword: String((L.head || {}).keyword || d.keyword || ''),
  rung: Number(p.rung) || 4, page_no: Number(p.page_no) || 0, keyword: String(p.keyword || ''), supporting: (p.supporting || []).join(', '),
  page_type: String(p.page_type || ''), target_url: String(p.target_url || ''), page_exists: !!p.exists, status: p.status_override || (writing.has(p.keyword) ? 'writing' : 'planned'),
  target_words: Number(p.target_words) || 0,   // P2-7: the length the verdict asked for (main page); R8: a rung page gets its own measured target
  status_note: p.note || '',   // R1: filled only when something moved the row (a refused page run sets it back to planned with the reason); LADDER PACKAGE: a stopped rung's reason
  months: Array.isArray(p.months) ? p.months.join('-') : '', start_date: now, country: String(d.country || ''), location_code: Number(d.location_code) || 0,
  language_code: String(d.language_code || 'en'), email: String(d.email || ''), callback_url: String(d.callback_url || ''), request_id: String(d.request_id || ''),
  chosen_by,
  stage: String(p.stage || ''),
  // review H5: a main page moved off an address that did not rank says where from, so the app asks for the redirect once it is live
  // (site task indexing:merge, app/server/src/services/siteTasks.ts ladderMovesOf); target_why is written only here, so it survives
  target_why: ((p === L.top && L.ladder_rules && L.ladder_rules.head_guard && L.ladder_rules.head_guard.moved_from ? 'moved from ' + L.ladder_rules.head_guard.moved_from + ': ' : '') + String(p.target_why || '')).slice(0, 300)   // LADDER PACKAGE (2026-11-09): the buyer's stage and why the page sits at its address (ladder_common LADDER_COLS)
} }));
