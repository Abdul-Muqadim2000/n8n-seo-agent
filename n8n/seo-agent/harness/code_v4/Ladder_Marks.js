// Ladder rows of the pages started this week -> status "writing" (so the Rank Tracker and the next cadence know).
const m = $('Cadence Plan').all().map(i => i.json).filter(p => p.ladder_id && !p.dry_run && !p.nothing_to_do).map(p => ({ json: { ladder_id: p.ladder_id, keyword: p.keyword, status: 'writing' } }));
return m.length ? m : [{ json: { skip: true } }];
