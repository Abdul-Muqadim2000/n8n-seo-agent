// v4.6: the site description is reused for 30 days (seo_cache 'desc:<domain>'), so keyword, ladder and cadence runs for the same site do not
// read and re-describe it every time. "Just describe my website" always reads the site fresh, and what the user typed always wins.
// D22 (2026-10-11): a stored description is only reused when it was written from the site's pages, not from the homepage alone — rows without
// `pages_read` were written before the menu pages were read, so their service list is incomplete and the site is read again.
const CONFIG = { ttl_days: 30 };
const d = $('Rate Limit').first().json;
const dom = String(d.domain || '').toLowerCase();
const row = $input.all().map(i => i.json || {}).find(r => r.key && r.key === 'desc:' + dom) || null;
let v = null; try { v = row ? JSON.parse(row.value) : null; } catch (e) {}
const desc = v && v.description;
const days = row ? (Date.now() - new Date(row.updated_at).getTime()) / 864e5 : Infinity;
const readsPages = !!(desc && Array.isArray(desc.pages_read) && desc.pages_read.length);
if (!d.need_site_description || d.mode === 'site_description' || !desc || !desc.business_description || !readsPages || !(days < CONFIG.ttl_days)) return [{ json: d }];
return [{ json: { ...d, need_site_description: false, page_title: v.page_title || '', site_description: desc, site_description_cached: String(row.updated_at).slice(0, 10),
  business: d.business || desc.business_description, audience: d.audience || (desc.target_audience || []).join(', ') } }];
