// the answer is given only after the row is saved: a save that failed is a 500 with the reason (nothing will start), never a 202
const p = $('Kickoff Plan').first().json; const s = $input.first().json || {};
const ok = !s.error && (String(s.site_id || '') === p.site_id || Number(s.id) > 0);
const { row, ...rest } = p;
return [{ json: { ...rest, saved: ok, error: ok ? '' : 'the cycle row of ' + p.domain + ' could not be saved (' + String((s.error && (s.error.message || s.error)) || 'no row came back').slice(0, 160) + '): nothing will start; send the kickoff again' } }];