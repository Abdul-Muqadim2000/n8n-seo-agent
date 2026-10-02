// "Set up my business profile" (v4.4): merges the submitted fields over the stored profile — an empty field keeps the stored value, "-" clears it —
// into one row for the Data Table seo_profiles (upsert by site_id). Every content run for the domain then carries the author, reviewer and address.
const d = $('Normalize Input').first().json;
const site_id = 'site_' + String(d.domain || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
let old = {}; try { old = $('Load Profile (Profile)').all().map(i => i.json).find(x => x && x.site_id === site_id) || {}; } catch (e) {}
const COLS = ['business_name', 'business_type', 'logo_url', 'street_address', 'city', 'region', 'postal_code', 'country_code', 'phone', 'public_email', 'opening_hours', 'price_range', 'service_areas', 'map_url',
  'author_name', 'author_job_title', 'author_credentials', 'author_bio', 'author_url', 'author_image_url', 'author_same_as', 'author_knows_about', 'reviewer_name', 'reviewer_job_title', 'reviewer_url'];
const inp = d.profile_input || {};
const row = { site_id, domain: d.domain };
for (const k of COLS) { const v = inp[k] == null ? '' : String(inp[k]).trim(); const was = old[k] == null ? '' : String(old[k]); row[k] = v === '-' ? '' : (v || was); }
row.updated_at = new Date().toISOString(); row.request_id = d.request_id || '';
return [{ json: row }];   // exactly the table columns (the upsert maps every input field)
