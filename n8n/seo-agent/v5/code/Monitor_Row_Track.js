// "Track my site": the site's monitor settings (seo_monitors, upsert by site_id; exact columns). Values given now (competitors from the form, the
// API's `monitors` object) replace the stored ones; everything else is kept, and a new site starts with every monitor on.
const d = $('Normalize Input').first().json; const site_id = 'site_' + String(d.domain || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
let old = {}; try { old = $('Load Monitors (Track)').all().map(i => i.json).find(x => x && x.site_id === site_id) || {}; } catch (e) {}
const m = d.monitor_input || {}; const has = (k) => m[k] !== undefined && m[k] !== null && m[k] !== '';
const pick = (k, dflt) => has(k) ? m[k] : (old[k] !== undefined && old[k] !== null && old[k] !== '' ? old[k] : dflt);
const comps = (d.competitors || []).length ? d.competitors.join(', ') : pick('competitors', '');
const __row = { site_id, domain: d.domain, ai_visibility: !!pick('ai_visibility', true) && pick('ai_visibility', true) !== 'false', ai_engines: String(pick('ai_engines', '')), ai_prompts_max: Math.min(50, Math.max(3, Number(pick('ai_prompts_max', 20)) || 20)), ai_pulse: pick('ai_pulse', true) !== false && pick('ai_pulse', true) !== 'false',
  backlinks: !!pick('backlinks', true) && pick('backlinks', true) !== 'false', audit_monthly: !!pick('audit_monthly', true) && pick('audit_monthly', true) !== 'false', audit_pages: Number(pick('audit_pages', 200)) || 200,
  audit_js: pick('audit_js', false) === true || pick('audit_js', false) === 'true', competitors: String(comps), brand_names: String(pick('brand_names', '')), updated_at: new Date().toISOString(), request_id: d.request_id || '' };
if (__row.audit_js && __row.audit_pages > 500) __row.audit_pages = 500;   // JavaScript rendering is limited to 500 pages per audit
return [{ json: __row }];
