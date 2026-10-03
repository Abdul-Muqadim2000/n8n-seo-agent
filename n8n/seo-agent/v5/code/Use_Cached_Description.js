// v4.6: the homepage description is reused for 30 days (seo_cache 'desc:<domain>'), so keyword, ladder and cadence runs for the same site do not
// read and re-describe the homepage every time. "Just describe my website" always reads the site fresh, and what the user typed always wins.
const CONFIG = { ttl_days: 30 };
const d = $('Rate Limit').first().json;
const dom = String(d.domain || '').toLowerCase();
const row = $input.all().map(i => i.json || {}).find(r => r.key && r.key === 'desc:' + dom) || null;
let v = null; try { v = row ? JSON.parse(row.value) : null; } catch (e) {}
const desc = v && v.description;
const days = row ? (Date.now() - new Date(row.updated_at).getTime()) / 864e5 : Infinity;
if (!d.need_site_description || d.mode === 'site_description' || !desc || !desc.business_description || !(days < CONFIG.ttl_days)) return [{ json: d }];
return [{ json: { ...d, need_site_description: false, page_title: v.page_title || '', site_description: desc, site_description_cached: String(row.updated_at).slice(0, 10),
  business: d.business || desc.business_description, audience: d.audience || (desc.target_audience || []).join(', ') } }];
