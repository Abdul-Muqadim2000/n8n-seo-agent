// KI KW Rows (E2, CONTRACTS.md §2): the rows the run writes to seo_ki_keywords, exactly the table's columns (a Data Table upsert maps every input field).
// Read from the result of this run's kind by name; an empty list is one `skip` item, so the IF in front of the write lets nothing through.
const p = $('KI Plan').first().json || {};
let r = {}; try { r = $(p.kind === 'keyword_research' ? 'Research Result' : 'Comp Result').first().json || {}; } catch (e) { r = {}; }
const rows = Array.isArray(r['kw_rows']) ? r['kw_rows'] : [];
return rows.length ? rows.map(j => ({ json: j })) : [{ json: { skip: true, reason: 'nothing to write' } }];
