// A case-study page found live becomes linkable proof, as when it is reported (seo_case_studies: status published + page URL; no row = no change).
const rows = $('Detect Published').all().flatMap(i => (i.json && Array.isArray(i.json.case_rows)) ? i.json.case_rows : []);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];
