// "Track my site": one row for the Data Table "seo_sites" (upserted by site_id); the Site Tracker then runs at once for this site.
// Live finding (2026-10-02): the Data Table "create" node before this one outputs the table object, not the request, so read Normalize Input explicitly.
const d = $('Normalize Input').first().json; const now = new Date().toISOString();
const site_id = 'site_' + String(d.domain || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
return [{ json: { site_id, domain: d.domain, gsc_property: '', ga4_property_id: String(d.ga4_property_id || ''), country: d.country || '', location_code: Number(d.location_code) || 0, language_code: d.language_code || 'en',
  email: d.email || '', callback_url: d.callback_url || '', keywords: (d.track_keywords || []).join(', '), status: 'active', source: d.via_webhook ? 'api' : 'form', created_at: now, last_run_at: '', last_status: 'registered', request_id: d.request_id || '' } }];
