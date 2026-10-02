// "Check my AI visibility" / "Check my backlinks" (form or API mode ai_visibility / backlinks): the monitor runs at once for this one domain, in its
// own execution (Manual Run of SEO Agent — AI Visibility Tracker / Backlink Monitor), and delivers to this requester. Tracked sites keep their settings.
const d = $('Normalize Input').first().json;
return [{ json: { domain: d.domain, site_id: 'site_' + d.domain.replace(/[^a-z0-9]+/g, '-'), on_demand: true, email: d.email || '', callback_url: d.callback_url || '', request_id: d.request_id || $execution.id,
  country: d.country || '', location_code: d.location_code || 0, language_code: d.language_code || 'en', competitors: d.competitors || [], topics: d.topics || [], monitor: d.mode } }];
