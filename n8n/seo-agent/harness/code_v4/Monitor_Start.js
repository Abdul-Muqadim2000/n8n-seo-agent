// "Check my AI visibility" / "Check my backlinks" (form or API mode ai_visibility / backlinks): the monitor runs at once for this one domain, in its
// own execution (Manual Run of SEO Agent — AI Visibility Tracker / Backlink Monitor), and delivers to this requester. Tracked sites keep their settings.
const d = $('Normalize Input').first().json;
return [{ json: { domain: d.domain, site_id: 'site_' + d.domain.replace(/[^a-z0-9]+/g, '-'), on_demand: true, email: d.email || '', callback_url: d.callback_url || '', request_id: d.request_id || $execution.id,
  country: d.country || '', location_code: d.location_code || 0, language_code: d.language_code || 'en', competitors: d.competitors || [], topics: d.topics || [], monitor: d.mode, free_only: !!d.free_only,   // v4.10: free sources only ($0)
  // R77 (2026-10-16): THIS run's own execution id, which is the `run_id` of the ledger row the front door reserved. `request_id` is the API
  // execution (621), not this one (622), so the child could not tell its parent's row from a genuine twin and refused itself. The child
  // stores it on its own row (key `parent:<id>`) and its gate does not count this run as "another run in flight".
  parent_run_id: String($execution.id) } }];
