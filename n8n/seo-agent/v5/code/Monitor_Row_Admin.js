// Site Admin "monitors": merges the given settings over the stored seo_monitors row (exact columns). Settings: ai_visibility, ai_engines
// (chatgpt, perplexity, gemini, claude, ai_overview, ai_mode), ai_prompts_max (3-15), backlinks, audit_monthly, audit_pages (50-1000), audit_js,
// competitors (domains), brand_names.
const a = $('Admin Action').first().json; const m = a.monitors || {};
let old = {}; try { old = $('Load Monitors (Admin)').all().map(i => i.json).find(x => x && x.site_id === a.site_id) || {}; } catch (e) {}
const has = (k) => m[k] !== undefined && m[k] !== null && m[k] !== '';
const b = (k, dflt) => has(k) ? !/^(false|0|no|off)$/i.test(String(m[k])) : (old[k] === undefined || old[k] === null || old[k] === '' ? dflt : !(old[k] === false || old[k] === 'false'));
const list = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\n,;]+/)).map(x => String(x).trim()).filter(Boolean);
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const ENG = ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode'];
const __row = { site_id: a.site_id, domain: a.domain || old.domain || '', ai_visibility: b('ai_visibility', true), ai_engines: has('ai_engines') ? list(m.ai_engines).map(e => e.toLowerCase()).filter(e => ENG.includes(e)).join(', ') : String(old.ai_engines || ''),
  ai_prompts_max: has('ai_prompts_max') ? Math.min(15, Math.max(3, parseInt(m.ai_prompts_max, 10) || 8)) : (Number(old.ai_prompts_max) || 8), backlinks: b('backlinks', true), audit_monthly: b('audit_monthly', true),
  audit_pages: has('audit_pages') ? Math.min(1000, Math.max(50, parseInt(m.audit_pages, 10) || 200)) : (Number(old.audit_pages) || 200), audit_js: b('audit_js', false),
  competitors: has('competitors') ? list(m.competitors).map(normD).filter(Boolean).slice(0, 5).join(', ') : String(old.competitors || ''), brand_names: has('brand_names') ? list(m.brand_names).join(', ') : String(old.brand_names || ''),
  updated_at: a.updated_at, request_id: a.request_id || '' };
if (__row.audit_js && __row.audit_pages > 500) __row.audit_pages = 500;   // JavaScript rendering is limited to 500 pages per audit
return [{ json: __row }];
