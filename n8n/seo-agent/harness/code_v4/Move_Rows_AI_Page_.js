// Build section 194 (F10): the row updates of ONE table out of Watch Moves (the build writes this node once per table: ai_pages_update).
// The exact fields the update node matches on and writes; nothing else, so no other column of the row is touched.
const m = (() => { try { return $('Watch Moves').first().json || {}; } catch (e) { return {}; } })();
const list = Array.isArray(m['ai_pages_update']) ? m['ai_pages_update'] : [];
return list.length ? list.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'nothing of this kind moved today' } }];
