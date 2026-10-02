// API answer for mode "profile" (POSTed to callback_url): the stored profile, what it adds to every page and what is still missing.
const p = $input.first().json;
return [{ json: { status: 'completed', stage: 'profile', request_id: p.request_id || null, domain: p.domain, site_id: p.site_id, profile: p.profile, changed: p.changed, existed: p.existed,
  eeat_score: p.eeat_score, local_score: p.local_score, eeat_checklist: p.eeat_checklist, local_checklist: p.local_checklist, schema_preview: p.schema_preview, stored: p.stored, store_error: p.store_error, summary: p.summary, callback_url: p.callback_url } }];
