// Sites with something to report (an alert, or an on-demand run): the e-mail and the callback (stage ai_pulse). Quiet days send nothing.
const out = $('Pulse Metrics').all().map(i => i.json).filter(m => (m.alerts || []).length || m.on_demand).map(m => { const { daily_row, answer_rows, ...rest } = m; return { json: rest }; });
return out.length ? out : [{ json: { skip: true } }];