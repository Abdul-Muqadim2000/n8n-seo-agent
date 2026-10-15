// B-A6: is this the first delivery of this request, or a repeat of one already running?
// Insert-then-read-back, lowest id wins (the idiom D1 put on the run ledger, for the same concurrency reason). Everything below is
// written to FAIL OPEN: when it cannot be certain this is a repeat, it starts the run.
const q = $('Quick Validate').first().json || {};
let mine = {}; try { mine = $('Record Request').first().json || {}; } catch (e) {}
let rows = []; try { rows = $('Load Requests').all().map(i => i.json).filter(r => r && r.key && !r.error); } catch (e) {}
const myKey = String(($('Request Row').first().json || {}).key || '');
const myId = Number(mine.id);

// every row under my own key that was written before mine. The Data Table read is already bounded to the window
// (updated_at >= now - idem_window_min), so anything that comes back is recent enough to be a retry of this request.
const before = (myId > 0 && myKey && !/^idem:none:/.test(myKey))
  ? rows.filter(r => String(r.key) === myKey && Number(r.id) > 0 && Number(r.id) < myId).sort((a, b) => Number(a.id) - Number(b.id))
  : [];
let first = null;
for (const r of before) {
  let v = null;
  try { v = JSON.parse(String(r.value || '')); } catch (e) { v = null; }
  // a row whose stored request id cannot be read is no use: the whole point is to answer with the FIRST run's id, and inventing one
  // would be worse than starting a second run.
  if (v && v.request_id) { first = { row: r, at: String(r.updated_at || ''), request_id: String(v.request_id) }; break; }
}

const win = Number(q.idem_window_min) || 5;
const out = { ...q, duplicate: false, first_seen_at: null, note: '', idem_rows_before: before.length };
if (first) {
  out.duplicate = true;
  out.first_seen_at = first.at || null;
  out.request_id = first.request_id;   // the caller gets the id of the run that is already doing this work
  out.note = 'This request was already received' + (first.at ? ' at ' + first.at : '')
    + ' and is being worked on, so it was not started a second time. `request_id` is that first run\'s id, and its result will be '
    + 'delivered as agreed. Send a different `request_id` (or `force_new: true`) to ask for a genuinely new run of the same analysis.';
} else {
  out.note = 'Accepted. A repeat of this exact request within ' + win + ' minutes returns this same run instead of starting another.';
}
return [{ json: out }];