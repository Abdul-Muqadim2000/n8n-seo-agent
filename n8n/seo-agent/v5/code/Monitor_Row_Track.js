// "Track my site": the site's monitor settings (seo_monitors, upsert by site_id; exact columns). Values given now (competitors from the form, the
// API's `monitors` object) replace the stored ones; everything else is kept, and a new site starts with every monitor on.
const d = $('Normalize Input').first().json; const site_id = 'site_' + String(d.domain || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
let old = {}; try { old = $('Load Monitors (Track)').all().map(i => i.json).find(x => x && x.site_id === site_id) || {}; } catch (e) {}
const m = d.monitor_input || {}; const has = (k) => m[k] !== undefined && m[k] !== null && m[k] !== '';
const pick = (k, dflt) => has(k) ? m[k] : (old[k] !== undefined && old[k] !== null && old[k] !== '' ? old[k] : dflt);
const comps = (d.competitors || []).length ? d.competitors.join(', ') : pick('competitors', '');
const __row = { site_id, domain: d.domain, ai_visibility: !!pick('ai_visibility', true) && pick('ai_visibility', true) !== 'false', ai_engines: String(pick('ai_engines', '')), ai_prompts_max: Math.min(500, Math.max(3, Number(pick('ai_prompts_max', old.site_id ? 20 : 50)) || 20)),   /* G6: 3-500; a new site starts at 50, a stored row keeps its size */
  ai_personas: String(pick('ai_personas', '')), ai_markets: String(pick('ai_markets', '')), ai_pulse_mode: String(pick('ai_pulse_mode', '')), ai_pulse_per_week: pick('ai_pulse_per_week', '') === '' ? null : Math.min(6, Math.max(1, Number(pick('ai_pulse_per_week', 0)) || 1)), ai_pulse: pick('ai_pulse', true) !== false && pick('ai_pulse', true) !== 'false',
  ai_growth: pick('ai_growth', true) !== false && pick('ai_growth', true) !== 'false', ai_pages_month: pick('ai_pages_month', '') === '' ? null : Math.min(8, Math.max(0, Number(pick('ai_pages_month', 2)) || 0)),
  backlinks: !!pick('backlinks', true) && pick('backlinks', true) !== 'false', link_builder: pick('link_builder', true) !== false && pick('link_builder', true) !== 'false', audit_monthly: !!pick('audit_monthly', true) && pick('audit_monthly', true) !== 'false', audit_pages: Number(pick('audit_pages', 200)) || 200,
  audit_js: pick('audit_js', false) === true || pick('audit_js', false) === 'true', competitors: String(comps), brand_names: String(pick('brand_names', '')),
  // G32: weeks without a position gain before a ladder is called stuck and gets a re-plan proposal (empty = 8, kept between 2 and 26)
  stuck_weeks: pick('stuck_weeks', '') === '' ? null : Math.min(26, Math.max(2, Number(pick('stuck_weeks', 8)) || 8)),
  updated_at: new Date().toISOString(), request_id: d.request_id || '',
  ai_alert_rules_json: String(old.ai_alert_rules_json || ''), ai_sov_set: String(old.ai_sov_set || '') };   // W2-E2: set through Site Admin `monitors` only; kept as stored
// W2-E3 (2026-10-23, WAVE2_CONTRACTS.md §4): the owner's engine and coverage options, given through the API's `monitors` object or kept as stored
const __b = (k) => { const v = pick(k, false); return v === true || /^(true|1|yes|on)$/i.test(String(v)); };
Object.assign(__row, { ai_claude_weekly: __b('ai_claude_weekly'), ai_pulse_engines: String(pick('ai_pulse_engines', '')), ai_persona_context: __b('ai_persona_context'),
  ai_fanout_check: pick('ai_fanout_check', '') === '' ? null : Math.min(200, Math.max(0, Number(pick('ai_fanout_check', 0)) || 0)), ai_demand_market: __b('ai_demand_market') });
// AI-FOCUS (2026-10-27): a NEW site's pulse asks the focus; a stored site keeps what it had ('' = the whole panel) unless the caller gives it
Object.assign(__row, { ai_pulse_scope: ['focus', 'all'].includes(String(pick('ai_pulse_scope', '')).toLowerCase()) ? String(pick('ai_pulse_scope', '')).toLowerCase() : (old.site_id ? '' : 'focus'),
  ai_focus_mode: String(pick('ai_focus_mode', '')).toLowerCase() === 'off' ? 'off' : '' });
// Index coverage (2026-10-29): the daily index watch and its cap are set through Site Admin `monitors` only; "Track my site" carries them as stored
// (the upsert writes every column it is given, so a column left out here would be emptied by every save)
Object.assign(__row, { index_watch: (old.index_watch === '' || old.index_watch == null) ? null : !(old.index_watch === false || old.index_watch === 'false'),
  index_daily_cap: (old.index_daily_cap === '' || old.index_daily_cap == null) ? null : Number(old.index_daily_cap) });
// Index coverage wave 2 (2026-10-30): the opt-in for sitemap submission is set through Site Admin `monitors` only; carried as stored (empty = off)
Object.assign(__row, { index_sitemap_submit: (old.index_sitemap_submit === '' || old.index_sitemap_submit == null) ? null : (old.index_sitemap_submit === true || old.index_sitemap_submit === 'true') });
if (__row.audit_js && __row.audit_pages > 500) __row.audit_pages = 500;   // JavaScript rendering is limited to 500 pages per audit
return [{ json: __row }];
