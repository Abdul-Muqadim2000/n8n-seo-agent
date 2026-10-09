// Today's answer rows for seo_ai_answers (run_kind pulse; exact columns, short excerpts; kept 35 days).
const rows = $('Pulse Metrics').all().flatMap(i => i.json.answer_rows || []);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];