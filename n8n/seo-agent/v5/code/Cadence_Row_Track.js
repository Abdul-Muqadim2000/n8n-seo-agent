// "Track my site": the content cadence for this site (blog posts per week, 0 = off), upserted into seo_cadence.
const d = $('Normalize Input').first().json; const r = $('Site Row (Track)').first().json; const n = Math.min(3, Math.max(0, Number(d.blogs_per_week) || 0));
return [{ json: { site_id: r.site_id, domain: r.domain, pages_per_week: n, status: n > 0 ? 'active' : 'off', updated_at: new Date().toISOString(), request_id: d.request_id || '' } }];
