// API answer for modes ai_visibility / backlinks: the run started; the report follows as its own callback (stage ai_visibility / backlinks).
const p = $input.first().json;
return [{ json: { status: p.status, stage: p.stage, request_id: p.request_id || null, domain: p.domain, competitors: p.competitors || [], started: p.started, error: p.error, summary: p.summary, estimated_minutes: p.mode === 'ai_visibility' ? 10 : 5, callback_url: p.callback_url } }];
