// Index coverage (fix wave 1, E4): a row that moved to its final address keeps its history - the history rows of the old address are given
// the new one. One item per move: { site_id, from, to }. Fix wave 2 (N1): only the net moves of this run, and only once the new row is in
// Save Index Pages' answer (as the delete of the old row).
const S = (v) => String(v == null ? '' : v).trim();
let saved = []; try { saved = $('Save Index Pages').all().map(i => i.json).filter(r => r && !r.error && S(r.url)); } catch (e) { saved = []; }
const savedKeys = new Set(saved.map(r => S(r.site_id) + '|' + S(r.url)));
const rows = $('Index Diagnose').all().map(i => i.json).filter(x => x && x.site_id).flatMap(x => x.history_moves || []).filter(m => savedKeys.has(S(m.site_id) + '|' + S(m.to)));
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'no address moved' } }];
