// API answer for mode "case_study" (POSTed to callback_url): the intake is stored and the page run started; the page itself follows as a "content" callback.
const p = $input.first().json;
return [{ json: { status: p.status, stage: 'case_study_started', request_id: p.request_id || null, domain: p.domain, case_id: p.case_id, title: p.case_title, keyword: p.keyword, stored: p.stored, store_error: p.store_error,
  started: p.started, spawn_error: p.spawn_error, hints: p.hints, summary: p.summary, estimated_minutes: 15, callback_url: p.callback_url } }];
