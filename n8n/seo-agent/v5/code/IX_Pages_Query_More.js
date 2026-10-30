// Index coverage (fix wave 1, X3): the second page (startRow 25,000) of every window whose first page came back full. Nothing more after
// that: 50,000 rows a window is the hard stop (pages beyond it keep their stored figures; the run note says so).
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
let reqs = []; try { reqs = $('Pages Query Requests').all().map(i => i.json).filter(q => q && !q.skip); } catch (e) { reqs = []; }
let res = []; try { res = $('GSC Pages Query').all().map(i => i.json); } catch (e) { res = []; }
const out = [];
reqs.forEach((q, i) => { const r = res[i] || {}; if (!r.error && Array.isArray(r.rows) && r.rows.length >= IX.CFG.sa_rows && IX.CFG.sa_max_rows > IX.CFG.sa_rows)
  out.push({ json: { ...q, start_row: IX.CFG.sa_rows, body: { ...q.body, startRow: IX.CFG.sa_rows } } }); });
return out.length ? out : [{ json: { skip: true, reason: 'no window needs a second page' } }];
