// One "seo_sites" row per site (upserted by site_id): resolved Search Console property, GA4 property id, last run and status.
return $('Site Metrics').all().map(i => ({ json: i.json.site_row }));
