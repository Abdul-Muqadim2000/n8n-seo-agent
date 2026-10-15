// B-A6: one seo_cache row per request that arrived, written BEFORE the 202 so a repeat can see it.
// Exactly the seo_cache columns, in the table's own order: the insert node auto-maps every field of this item.
const q = $('Quick Validate').first().json || {};
const now = new Date().toISOString();
// `force_new` (and only it) leaves idem_key empty. The row is still written — a request that arrived is worth recording — but under a
// key nothing else can ever carry, so it can neither be matched nor match anything.
const key = 'idem:' + (q.idem_key || ('none:' + q.request_id));
return [{ json: {
  key,
  kind: 'idem',
  site_id: String(q.domain || ''),
  value: JSON.stringify({ request_id: String(q.request_id || ''), mode: q.mode || '', domain: q.domain || null,
                          keyword: q.keyword || null, country: q.country || null, source: q.idem_source || '', at: now }).slice(0, 2000),
  updated_at: now,
} }];