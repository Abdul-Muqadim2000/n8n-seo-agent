// G19 (2026-10-12): a rebuilt site model is kept in seo_cache ('model:<site_id>', SM.FRESH_DAYS) so the next run on the same site reuses
// it (exact columns for the upsert). A reused model is not written back: that would keep refreshing its age and it would never be rebuilt.
// Registered sites get the same model in their seo_sites row every Monday (the Site Tracker); this cache also covers sites that are not
// tracked, and is never used to register one (a seo_sites row would start the weekly paid runs).
/*__SITE_MODEL__*/
const j = $('Site Model').first().json;
const m = j.site_model || {};
if (j.site_model_reused || !m.site_id || !m.canonical_host) return [{ json: { skip: true } }];
return [{ json: { key: 'model:' + m.site_id, kind: 'model', site_id: m.site_id, value: JSON.stringify(SM.toRow(m)), updated_at: m.model_updated_at || new Date().toISOString() } }];
