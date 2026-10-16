// R94: the catch-up's own state rows for seo_cache (exact columns): the first arming and the latest n8n start
const rows = ($('Catch-up Plan').first().json.state_rows || []);
return rows.length ? rows.map(r => ({ json: { key: r.key, kind: r.kind, site_id: r.site_id, value: r.value, updated_at: r.updated_at } })) : [{ json: { skip: true } }];
