// v4.6: keep the fresh homepage description for 30 days (seo_cache 'desc:<domain>') for the next runs on this site (exact columns for the upsert).
const p = $input.first().json; const dom = String(p.domain || 'none').toLowerCase();
return [{ json: { key: 'desc:' + dom, kind: 'desc', site_id: 'site_' + dom.replace(/[^a-z0-9]+/g, '-'), value: JSON.stringify({ description: p.site_description || {}, page_title: p.page_title || '' }), updated_at: new Date().toISOString() } }];
