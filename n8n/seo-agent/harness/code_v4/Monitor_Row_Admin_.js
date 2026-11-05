// Site Admin "monitors": merges the given settings over the stored seo_monitors row (exact columns). Settings: ai_visibility, ai_engines
// (chatgpt, perplexity, gemini, claude, ai_overview, ai_mode, copilot, chatgpt_api, gemini_api), ai_prompts_max (3-500, G6), ai_personas / ai_markets
// (G6: buyer roles and extra markets, CC-lang), ai_pulse_mode ('' auto | sample | full) + ai_pulse_per_week (1-6, empty = auto), ai_pulse (daily AI Pulse, v4.9), ai_growth (weekly AI Growth loop) + ai_pages_month (0-8, v4.12), link_builder (weekly Link Builder, v4.13), stuck_weeks (2-26, G32), backlinks, audit_monthly, audit_pages (50-1000), audit_js,
// competitors (domains), brand_names; W2-E3: ai_claude_weekly, ai_pulse_engines, ai_persona_context, ai_fanout_check (0-200), ai_demand_market;
// Index coverage (2026-10-29): index_watch (daily index watch, empty = on), index_daily_cap (20-1,200 URL inspections a day, empty = 300);
// wave 2 (2026-10-30): index_sitemap_submit (the client's opt-in for sitemap submission, empty = OFF).
// ---- AIRF: the AI-ranking algorithm's settings, kill switch, ids and shared vocabulary (inlined by build_monitors.py through its marker) ----
// AIR (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §4.1, frozen in CONTRACTS.md §2-§3). Written by W0 and FROZEN: the packages read it,
// none changes it (a change is a contract change: CONTRACTS.md first, then this file, then every caller). Pure: no node access, no clock, no
// network; n8n sandbox rules (no URL constructor, no Object.defineProperty / setPrototypeOf, no structuredClone).
// Every setting is OFF when empty: a site without the columns, or with them empty, runs exactly as before AIR.
const AIRF = (() => {
  const VERSION = 'air-flags-1';
  const RULE_VERSION = 'air-1';   // the rule AIR's rows are written under (seo_ai_rank_* .rule_version); bump it when a counting rule changes
  const MODES = ['off', 'shadow', 'on'];
  const S = (v) => (v == null ? '' : String(v)).trim();
  const flag = (v) => v === true || /^(true|1|yes|on)$/i.test(S(v));
  const modeOf = (v) => { const m = S(v).toLowerCase(); return MODES.includes(m) ? m : 'off'; };
  const fanoutOf = (v) => { const n = Number(v); return S(v) === '' || !Number.isFinite(n) ? 0 : Math.min(50, Math.max(0, Math.round(n))); };
  // seo_monitors row -> s.settings.rank (package P4 puts it on every monitor site in _monitor_sites.js; P3 and P6 read it there)
  const settingsOf = (m) => { const r = m || {};
    return { mode: modeOf(r.ai_rank_mode), reserve: flag(r.ai_rank_reserve), fanout_n: fanoutOf(r.ai_rank_fanout_n), mentions: flag(r.ai_rank_mentions), brave: flag(r.ai_rank_brave) }; };
  // Site Admin `monitors` (package P4 calls it from Admin_Action.js / Monitor_Row_Admin.js): only the fields GIVEN are returned, normalised;
  // '' clears a field to null (= off); a bad value is an error message, never a silent default
  const COLS = ['ai_rank_mode', 'ai_rank_reserve', 'ai_rank_fanout_n', 'ai_rank_mentions', 'ai_rank_brave'];
  const validate = (given) => { const g = given || {}; const values = {}; const errors = [];
    for (const k of COLS) {
      if (!(k in g) || g[k] === undefined || g[k] === null) continue;
      const v = g[k];
      if (S(v) === '') { values[k] = null; continue; }
      if (k === 'ai_rank_mode') { const m = S(v).toLowerCase(); if (MODES.includes(m)) values[k] = m; else errors.push('ai_rank_mode must be off, shadow or on'); continue; }
      if (k === 'ai_rank_fanout_n') { const n = Number(v); if (Number.isFinite(n) && n >= 0 && n <= 50 && Math.round(n) === n) values[k] = n; else errors.push('ai_rank_fanout_n must be a whole number from 0 to 50'); continue; }
      if (v === true || v === false) { values[k] = v; continue; }
      if (/^(true|1|yes|on)$/i.test(S(v))) values[k] = true; else if (/^(false|0|no|off)$/i.test(S(v))) values[k] = false; else errors.push(k + ' must be true or false');
    }
    return { values, errors }; };
  // the global kill switch: seo_cache row key `air:kill`, value '1' (or true / on / yes) -> AIR skips every site, without a deploy
  const CACHE_KIND = 'air';
  const KILL_KEY = 'air:kill';
  const protectKey = (site_id) => 'air:protect:' + S(site_id);
  const mentionsKey = (site_id, ym) => 'air:mentions:' + S(site_id) + ':' + S(ym);
  const killed = (cacheRows) => (Array.isArray(cacheRows) ? cacheRows : []).some(r => r && S(r.key) === KILL_KEY && /^(1|true|on|yes)$/i.test(S(r.value)));
  // what a site in a mode may do (CONTRACTS.md §5): shadow computes and writes only the five AIR tables, pays nothing; on writes the sinks
  const runs = (rank, kill) => !kill && !!rank && (rank.mode === 'shadow' || rank.mode === 'on');
  const writesSinks = (rank, kill) => !kill && !!rank && rank.mode === 'on';
  const mayPay = (rank, kill) => writesSinks(rank, kill);
  // shared vocabulary (CONTRACTS.md §3.1)
  const ENGINES = ['chatgpt', 'gemini', 'ai_mode', 'ai_overview', 'perplexity', 'claude', 'copilot', 'chatgpt_api'];
  const EXCLUDED_ENGINES = ['gemini_api'];   // owner decision 9: never diagnosed or learned from until DataForSEO answers in writing
  const GROUP_OF = { ai_overview: 'google', ai_mode: 'google', gemini: 'google', chatgpt: 'chatgpt', chatgpt_api: 'chatgpt', perplexity: 'perplexity', copilot: 'copilot', claude: 'claude' };
  const GROUPS = ['google', 'chatgpt', 'perplexity', 'copilot', 'claude'];
  const STAGES = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'];
  const STAGE_LABELS = ['unmeasured', ...STAGES];
  const ACTION_STATUSES = ['shadow', 'proposed', 'queued', 'in_progress', 'done', 'verified', 'not_happened', 'expired', 'refused'];
  const ARMS = ['treated', 'control'];
  const usable = (engine) => ENGINES.includes(S(engine).toLowerCase());
  // ids (one rule for every writer and reader)
  const hash = (s) => { let h = 2166136261 >>> 0; const t = String(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };   // FNV-1a, as AVX.hash
  const hex8 = (s) => ('0000000' + hash(s).toString(16)).slice(-8);
  // url_key: no scheme, no www., host lower-cased, no query, no fragment, no trailing slash, at most 300 characters ('' when it is not an http(s) URL)
  const urlKey = (url) => { const m = S(url).match(/^https?:\/\/([^\/?#]+)([^?#]*)/i); if (!m) return '';
    const host = m[1].toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '').replace(/\.$/, ''); const path = m[2].replace(/\/+$/, '');
    return (host + path).slice(0, 300); };
  const refKey = (ref) => { const r = ref || {}; return r.prompt_id ? 'p:' + S(r.prompt_id) : r.url ? 'u:' + urlKey(r.url) : r.listing_id ? 'l:' + S(r.listing_id) : 's:site'; };
  const actionId = (site_id, lever, ref) => 'air_' + S(site_id) + '_' + S(lever) + '_' + hex8(refKey(ref));
  const day = (now) => { const d = new Date(typeof now === 'number' ? now : Date.parse(S(now))); return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10).replace(/-/g, '') : ''; };
  const runId = (site_id, now) => 'air_' + day(now) + '_' + S(site_id);
  const priorId = (lever, stage, group, scope) => [S(lever), S(stage), S(group), S(scope) || 'global'].join(':');
  const targetId = (site_id, prompt_id) => 'ait_' + S(site_id).replace(/^site_/, '') + '_' + S(prompt_id);   // the AI Growth format, unchanged
  return { VERSION, RULE_VERSION, MODES, COLS, settingsOf, validate, CACHE_KIND, KILL_KEY, protectKey, mentionsKey, killed, runs, writesSinks, mayPay,
    ENGINES, EXCLUDED_ENGINES, GROUP_OF, GROUPS, STAGES, STAGE_LABELS, ACTION_STATUSES, ARMS, usable, hash, urlKey, refKey, actionId, runId, priorId, targetId };
})();
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
  updated_at: a.updated_at, request_id: a.request_id || '',
  // W2-E2 (2026-10-23): the owner's AI alert rules (validated in Admin Action; '' clears) and the declared share-of-voice set - kept as stored unless given
  ai_alert_rules_json: m.ai_alert_rules_json !== undefined && m.ai_alert_rules_json !== null ? String(m.ai_alert_rules_json) : String(old.ai_alert_rules_json || ''),
  ai_sov_set: m.ai_sov_set !== undefined && m.ai_sov_set !== null ? String(m.ai_sov_set) : String(old.ai_sov_set || '') };
// W2-E3 (2026-10-23, WAVE2_CONTRACTS.md §4): Claude weekly, the pulse's engines, the persona test (API answers), the fan-out searches checked a week
// (0 = off; the app offers 25 / 50 / 100) and the monthly market trend - each kept as stored unless given; every one off by default
const PULSE_OK = ['chatgpt', 'gemini', 'ai_mode', 'copilot', 'perplexity', 'ai_overview'];
const __num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
Object.assign(__row, { ai_claude_weekly: b('ai_claude_weekly', false),
  ai_pulse_engines: has('ai_pulse_engines') ? [...new Set(list(m.ai_pulse_engines).map(e => e.toLowerCase().replace(/[\s-]+/g, '_')).filter(e => PULSE_OK.includes(e)))].join(', ') : String(old.ai_pulse_engines || ''),
  ai_persona_context: b('ai_persona_context', false),
  ai_fanout_check: m.ai_fanout_check !== undefined && m.ai_fanout_check !== null ? (m.ai_fanout_check === '' ? null : Math.min(200, Math.max(0, parseInt(m.ai_fanout_check, 10) || 0))) : __num(old.ai_fanout_check),
  ai_demand_market: b('ai_demand_market', false) });
// AI-FOCUS (2026-10-27): what the daily pulse asks (focus | all) and whether the panel follows the client's focus (off | '' = on) - kept as stored unless given
Object.assign(__row, { ai_pulse_scope: has('ai_pulse_scope') ? (['focus', 'all'].includes(String(m.ai_pulse_scope).toLowerCase()) ? String(m.ai_pulse_scope).toLowerCase() : String(old.ai_pulse_scope || '')) : String(old.ai_pulse_scope || (old.site_id ? '' : 'focus')),
  ai_focus_mode: has('ai_focus_mode') ? (String(m.ai_focus_mode).toLowerCase() === 'off' ? 'off' : '') : String(old.ai_focus_mode || '') });
// Index coverage (2026-10-29): the daily index watch (empty = on) and its daily inspection cap (empty = 300), validated in Admin Action - kept as stored unless given
Object.assign(__row, { index_watch: has('index_watch') ? (m.index_watch === true || /^(true|1|yes|on)$/i.test(String(m.index_watch))) : (old.index_watch === '' || old.index_watch == null ? null : !(old.index_watch === false || old.index_watch === 'false')),
  index_daily_cap: m.index_daily_cap === '' ? null : has('index_daily_cap') ? Math.min(1200, Math.max(20, parseInt(m.index_daily_cap, 10) || 300)) : (old.index_daily_cap === '' || old.index_daily_cap == null ? null : Number(old.index_daily_cap)) });
// Index coverage wave 2 (2026-10-30, DESIGN_WAVE2.md §2.5): the opt-in for sitemap submission (validated in Admin Action; empty = off) - kept as stored unless given
Object.assign(__row, { index_sitemap_submit: has('index_sitemap_submit') ? (m.index_sitemap_submit === true || /^(true|1|yes|on)$/i.test(String(m.index_sitemap_submit)))
  : (old.index_sitemap_submit === '' || old.index_sitemap_submit == null ? null : (old.index_sitemap_submit === true || old.index_sitemap_submit === 'true')) });
// AIR (2026-11-06, docs/ai-ranking-2026-11-05/CONTRACTS.md §2 / §5, package P4): the AI-ranking mode and its four flags. A value given is set
// through the one rule (AIRF.validate; Admin Action has already refused a bad one); '' clears it to null (= off); a field not given is kept as stored.
const __airGiven = AIRF.validate(Object.fromEntries(AIRF.COLS.filter(k => m[k] !== undefined && m[k] !== null).map(k => [k, m[k]]))).values;
const __airOld = (k) => { const v = old[k]; if (v === '' || v == null) return null;
  if (k === 'ai_rank_mode') return String(v); if (k === 'ai_rank_fanout_n') return Number(v); return v === true || v === 'true'; };
Object.assign(__row, Object.fromEntries(AIRF.COLS.map(k => [k, k in __airGiven ? __airGiven[k] : __airOld(k)])));
if (__row.audit_js && __row.audit_pages > 500) __row.audit_pages = 500;   // JavaScript rendering is limited to 500 pages per audit
return [{ json: __row }];
