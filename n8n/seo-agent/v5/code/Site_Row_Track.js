// "Track my site": one row for the Data Table "seo_sites" (upserted by site_id); the Site Tracker then runs at once for this site.
// Live finding (2026-10-02): the Data Table "create" node before this one outputs the table object, not the request, so read Normalize Input explicitly.
// Keyword-first (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §2.2 item 5 / §14.1): two changes to a re-save.
//   * A re-save no longer un-pauses the site: a website its owner (or the credit guard) paused stays `paused`; only Site Admin's `resume` resumes it.
//     The stored row is read by *Load Site (Track)*.
//   * The services the client declared ("What do you sell?", Normalize Input `services`) are stored as `declared_services` (a JSON list). The site
//     model merges them into its services and the Site Tracker never overwrites them. A request without `services` leaves the stored list alone.
const d = $('Normalize Input').first().json; const now = new Date().toISOString();
const site_id = 'site_' + String(d.domain || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
let prior = null; try { prior = $('Load Site (Track)').all().map(i => i.json).find(r => r && !r.error && r.site_id === site_id) || null; } catch (e) { prior = null; }
const status = prior && String(prior.status || '') === 'paused' ? 'paused' : 'active';
const declared = d.services_given ? { declared_services: JSON.stringify((Array.isArray(d.services) ? d.services : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, 30)) } : {};
return [{ json: { site_id, domain: d.domain, gsc_property: '', ga4_property_id: String(d.ga4_property_id || ''), country: d.country || '', location_code: Number(d.location_code) || 0, language_code: d.language_code || 'en',
  email: d.email || '', callback_url: d.callback_url || '', keywords: (d.track_keywords || []).join(', '), status, source: d.via_webhook ? 'api' : 'form', created_at: now, last_run_at: '', last_status: 'registered', request_id: d.request_id || '',
  ...declared } }];
