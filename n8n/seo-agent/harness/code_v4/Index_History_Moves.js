// Index coverage (fix wave 1, E4): a row that moved to its final address keeps its history - the history rows of the old address are given
// the new one. One item per move: { site_id, from, to }.
const rows = $('Index Diagnose').all().map(i => i.json).filter(x => x && x.site_id).flatMap(x => x.history_moves || []);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'no address moved' } }];
