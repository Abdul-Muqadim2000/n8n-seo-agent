// seo_cadence row for the admin action "cadence" (upserted by site_id).
const a = $('Admin Action').first().json;
return [{ json: { site_id: a.site_id, domain: a.domain, pages_per_week: a.pages_per_week, status: a.cadence_status, updated_at: a.updated_at, request_id: a.request_id } }];
