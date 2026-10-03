// One row per ladder page for the "seo_ladders" Data Table (the rank tracker reads these every week).
const d = $('Attach PDF Ladder').first().json;
const L = d.ladder || {};
if (L.planned === false) return [{ json: { skip: true, reason: (L.refusal || {}).reason || 'no pages planned' } }];   // v4.8: a refused ladder (duplicate / not realistic) stores nothing
const pages = [...(L.rungs || []).flatMap(r => (r.pages || []).map(p => ({ ...p, months: r.months }))), L.top].filter(Boolean);
const now = new Date().toISOString();
const writing = new Set((L.write_now || []).map(w => w.keyword));
return pages.map(p => ({ json: {
  ladder_id: String(L.ladder_id || ''), domain: String(L.domain || d.domain || ''), head_keyword: String((L.head || {}).keyword || d.keyword || ''),
  rung: Number(p.rung) || 4, page_no: Number(p.page_no) || 0, keyword: String(p.keyword || ''), supporting: (p.supporting || []).join(', '),
  page_type: String(p.page_type || ''), target_url: String(p.target_url || ''), page_exists: !!p.exists, status: writing.has(p.keyword) ? 'writing' : 'planned',
  months: Array.isArray(p.months) ? p.months.join('-') : '', start_date: now, country: String(d.country || ''), location_code: Number(d.location_code) || 0,
  language_code: String(d.language_code || 'en'), email: String(d.email || ''), callback_url: String(d.callback_url || ''), request_id: String(d.request_id || '')
} }));
