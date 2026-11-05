// AIR kill switch (2026-11-06, docs/ai-ranking-2026-11-05/CONTRACTS.md §5, package P4): the seo_cache row `air:kill` (value 1 / true / on / yes)
// stops AIR for every website without a deploy. Read here, after the gate's IF, so a run whose sites are all off never reads it. Killed:
// [{ skip: true, killed: true }] and nothing of AIR runs further (no table is ensured, nothing is loaded or written). Otherwise the gate's items.
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
const cacheRows = (() => { try { return $('Load AI Rank Cache').all().map(i => i.json || {}); } catch (e) { return []; } })();
const sites = (() => { try { return $('AI Rank Gate').all().map(i => i.json || {}).filter(x => x.site_id && !x.skip && !x.error); } catch (e) { return []; } })();
if (AIRF.killed(cacheRows)) return [{ json: { skip: true, killed: true, reason: 'the AI-ranking kill switch (seo_cache ' + AIRF.KILL_KEY + ') is on: AIR is stopped for every website' } }];
return sites.length ? sites.map(s => ({ json: s })) : [{ json: { skip: true, reason: 'no website to run' } }];
