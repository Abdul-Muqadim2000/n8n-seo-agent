// One row per ladder page for the "seo_ladders" Data Table (the rank tracker reads these every week).
const d = $('Attach PDF Ladder').first().json;
const L = d.ladder || {};
if (L.planned === false) return [{ json: { skip: true, reason: (L.refusal || {}).reason || 'no pages planned' } }];   // v4.8: a refused ladder (duplicate / not realistic) stores nothing
const pages = [...(L.rungs || []).flatMap(r => (r.pages || []).map(p => ({ ...p, months: r.months }))), L.top].filter(Boolean);
const now = new Date().toISOString();
// R1 (2026-10-13): only the pages this run really starts are marked `writing` — *Spawn Page Runs* takes at most 3, and a page run the
// day's budget guard refuses sets its row back to `planned` with the reason (*Refused Ladder Row*), so no feature reports a page nobody wrote.
const startedNow = Math.min(3, Math.max(1, Number(d.pages_now) || 1));
const writing = new Set((L.write_now || []).slice(0, startedNow).map(w => w.keyword));
return pages.map(p => ({ json: {
  ladder_id: String(L.ladder_id || ''), domain: String(L.domain || d.domain || ''), head_keyword: String((L.head || {}).keyword || d.keyword || ''),
  rung: Number(p.rung) || 4, page_no: Number(p.page_no) || 0, keyword: String(p.keyword || ''), supporting: (p.supporting || []).join(', '),
  page_type: String(p.page_type || ''), target_url: String(p.target_url || ''), page_exists: !!p.exists, status: writing.has(p.keyword) ? 'writing' : 'planned',
  target_words: Number(p.target_words) || 0,   // P2-7: the length the verdict asked for (main page); R8: a rung page gets its own measured target
  status_note: '',   // R1: filled only when something moved the row (a refused page run sets it back to planned with the reason)
  months: Array.isArray(p.months) ? p.months.join('-') : '', start_date: now, country: String(d.country || ''), location_code: Number(d.location_code) || 0,
  language_code: String(d.language_code || 'en'), email: String(d.email || ''), callback_url: String(d.callback_url || ''), request_id: String(d.request_id || '')
} }));
