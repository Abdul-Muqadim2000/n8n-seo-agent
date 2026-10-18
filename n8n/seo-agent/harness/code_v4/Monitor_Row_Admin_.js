// Site Admin "monitors": merges the given settings over the stored seo_monitors row (exact columns). Settings: ai_visibility, ai_engines
// (chatgpt, perplexity, gemini, claude, ai_overview, ai_mode, copilot, chatgpt_api, gemini_api), ai_prompts_max (3-500, G6), ai_personas / ai_markets
// (G6: buyer roles and extra markets, CC-lang), ai_pulse_mode ('' auto | sample | full) + ai_pulse_per_week (1-6, empty = auto), ai_pulse (daily AI Pulse, v4.9), ai_growth (weekly AI Growth loop) + ai_pages_month (0-8, v4.12), link_builder (weekly Link Builder, v4.13), stuck_weeks (2-26, G32), backlinks, audit_monthly, audit_pages (50-1000), audit_js,
// competitors (domains), brand_names.
const a = $('Admin Action').first().json; const m = a.monitors || {};
let old = {}; try { old = $('Load Monitors (Admin)').all().map(i => i.json).find(x => x && x.site_id === a.site_id) || {}; } catch (e) {}
const has = (k) => m[k] !== undefined && m[k] !== null && m[k] !== '';
const b = (k, dflt) => has(k) ? !/^(false|0|no|off)$/i.test(String(m[k])) : (old[k] === undefined || old[k] === null || old[k] === '' ? dflt : !(old[k] === false || old[k] === 'false'));
const list = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\n,;]+/)).map(x => String(x).trim()).filter(Boolean);
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const ENG = ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode', 'copilot', 'chatgpt_api', 'gemini_api'];   // G6: + the two model APIs (opt-in)
const mkt = (x) => { const mm = String(x || '').trim().replace(/[_\s]+/g, '-').match(/^([A-Za-z]{2})(?:-([A-Za-z]{2,3}))?$/); return mm ? mm[1].toUpperCase() + '-' + (mm[2] || 'en').toLowerCase() : ''; };
const __row = { site_id: a.site_id, domain: a.domain || old.domain || '', ai_visibility: b('ai_visibility', true), ai_engines: has('ai_engines') ? list(m.ai_engines).map(e => e.toLowerCase()).filter(e => ENG.includes(e)).join(', ') : String(old.ai_engines || ''),
  ai_prompts_max: has('ai_prompts_max') ? Math.min(500, Math.max(3, parseInt(m.ai_prompts_max, 10) || 20)) : (old.ai_prompts_max === '' || old.ai_prompts_max == null ? (old.site_id ? null : 50) : Number(old.ai_prompts_max)), ai_pulse: b('ai_pulse', true), ai_growth: b('ai_growth', true),
  // G6 (2026-10-18): who asks, where, and how the daily pulse samples the panel — kept as stored unless given
  ai_personas: has('ai_personas') ? list(m.ai_personas).map(x => x.replace(/\s+/g, ' ').slice(0, 40)).slice(0, 6).join(', ') : String(old.ai_personas || ''),
  ai_markets: has('ai_markets') ? [...new Set(list(m.ai_markets).map(mkt).filter(Boolean))].slice(0, 5).join(', ') : String(old.ai_markets || ''),
  ai_pulse_mode: has('ai_pulse_mode') ? (['auto', 'sample', 'full'].includes(String(m.ai_pulse_mode).toLowerCase()) ? String(m.ai_pulse_mode).toLowerCase().replace('auto', '') : '') : String(old.ai_pulse_mode || ''),
  ai_pulse_per_week: has('ai_pulse_per_week') ? (parseInt(m.ai_pulse_per_week, 10) >= 1 ? Math.min(6, parseInt(m.ai_pulse_per_week, 10)) : null) : (old.ai_pulse_per_week === '' || old.ai_pulse_per_week == null ? null : Number(old.ai_pulse_per_week)),
  ai_pages_month: has('ai_pages_month') ? Math.min(8, Math.max(0, parseInt(m.ai_pages_month, 10) || 0)) : (old.ai_pages_month === '' || old.ai_pages_month == null ? null : Number(old.ai_pages_month)), backlinks: b('backlinks', true), audit_monthly: b('audit_monthly', true), link_builder: b('link_builder', true),
  audit_pages: has('audit_pages') ? Math.min(1000, Math.max(50, parseInt(m.audit_pages, 10) || 200)) : (Number(old.audit_pages) || 200), audit_js: b('audit_js', false),
  competitors: has('competitors') ? list(m.competitors).map(normD).filter(Boolean).slice(0, 5).join(', ') : String(old.competitors || ''), brand_names: has('brand_names') ? list(m.brand_names).join(', ') : String(old.brand_names || ''),
  // G32: weeks without a position gain before a ladder is called stuck and gets a re-plan proposal (empty = 8, kept between 2 and 26)
  stuck_weeks: has('stuck_weeks') ? Math.min(26, Math.max(2, parseInt(m.stuck_weeks, 10) || 8)) : (old.stuck_weeks === '' || old.stuck_weeks == null ? null : Number(old.stuck_weeks)),
  updated_at: a.updated_at, request_id: a.request_id || '' };
if (__row.audit_js && __row.audit_pages > 500) __row.audit_pages = 500;   // JavaScript rendering is limited to 500 pages per audit
return [{ json: __row }];
