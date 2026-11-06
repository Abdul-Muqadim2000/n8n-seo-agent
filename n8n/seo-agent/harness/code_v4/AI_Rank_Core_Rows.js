// AIR row builder (2026-11-06, docs/ai-ranking-2026-11-05/CONTRACTS.md §2 / §4 / §5, package P4): one builder per table, the same source for every
// one (ai_rank_wiring.py bakes WHICH and the table's exact columns into each node). It reads `AI Rank Plan` EXPLICITLY (never $json: the node
// before it is a Data Table save, which answers with the row it wrote) and returns exactly the table's columns, or [{ skip: true }].
//   runs / questions / actions / sources / priors   the five seo_ai_rank_* tables: shadow and on
//   targets / prospects / proposed / core / cache / growth   the existing tables AIR may write: ONLY for a site in `on` (AIRF.writesSinks);
//                                                   a site in shadow, or a plan that failed, writes none of them
// ---- AIRF: the AI-ranking algorithm's settings, kill switch, ids and shared vocabulary (inlined by build_monitors.py through its marker) ----
// AIR (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §4.1, frozen in CONTRACTS.md §2-§3). Written by W0 and FROZEN: the packages read it,
// none changes it (a change is a contract change: CONTRACTS.md first, then this file, then every caller). Pure: no node access, no clock, no
// network; n8n sandbox rules (no URL constructor, no Object.defineProperty / setPrototypeOf, no structuredClone).
// Every setting is OFF when empty: a site without the columns, or with them empty, runs exactly as before AIR.
const AIRF = (() => {
  const VERSION = 'air-flags-1';
  // air-2 (FX-B, 2026-11-06, for FX-A's counting changes: a t test across questions, control handling, one trial per action): rows of another rule are
  // never compared or learned from (ai_rank_wiring.py loads priors and runs of this rule only, and hides actions pre-registered under another one)
  const RULE_VERSION = 'air-2';   // the rule AIR's rows are written under (seo_ai_rank_* .rule_version); bump it when a counting rule changes
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

const WHICH = "core";
const COLS = ["site_id", "prompt_id", "core_until"];
const SINKS = ['targets', 'prospects', 'proposed', 'core', 'cache', 'growth'];
const JSON_MAX = 60000;
const plans = (() => { try { return $('AI Rank Plan').all().map(i => i.json || {}); } catch (e) { return []; } })().filter(p => p && p.site_id && !p.skip);
const exact = (r) => Object.fromEntries(COLS.map(c => [c, r[c] === undefined ? null : r[c]]));
const J = (x) => { try { return x == null ? '' : JSON.stringify(x); } catch (e) { return ''; } };
let execId = ''; try { execId = String($execution.id || ''); } catch (e) {}
// FX-B RB-5 (2026-11-06, REVIEW_B_SAFETY.md): the target sink read only the plan, whose stored targets are the start-of-run snapshot, and skipped only
// live work and wins. A question the client kept out ("kept by you"), or one the fit gate set aside (this run's AI Growth row, else the stored one),
// was queued again by AIR. Those are left alone now, and the sink keyword passes the fit gate (inlined in this builder only, at the AIR_SINK_GATE mark:
// brand, government, portal and job refusals; the topic bar judges nothing without topics, the Growth Plan's own verdict covers it).
const S1 = (v) => (v == null ? '' : String(v)).trim();
const rowsOf = (n) => { try { return $(n).all().map(i => i.json || {}).filter(r => r && r.target_id); } catch (e) { return []; } };
const tNow = WHICH === 'targets' ? rowsOf('AI Target Rows') : [], tStored = WHICH === 'targets' ? rowsOf('Load AI Targets') : [];
const listOf = (v) => { if (Array.isArray(v)) return v.map(S1).filter(Boolean); const t = S1(v); if (!t) return []; try { const j = JSON.parse(t); if (Array.isArray(j)) return j.map(S1).filter(Boolean); } catch (e) {} return t.split(/[,\n;|]+/).map(S1).filter(Boolean); };
const gateCtx = (p) => { if (typeof FITR !== 'object') return null; const by = (n) => { try { return $(n).all().map(i => i.json || {}).find(r => r && S1(r.site_id) === S1(p.site_id)) || {}; } catch (e) { return {}; } };
  const m = by('Load Monitors'), st = by('Load Sites');
  return FITR.ctx({ own_domain: p.domain, competitors: [...listOf(m.competitors), ...listOf(st.competitors)], services: [...listOf(st.declared_services), ...listOf(st.services)] }); };
const leaveAlone = (p, r) => { const t = tNow.find(x => S1(x.target_id) === S1(r.target_id)) || tStored.find(x => S1(x.target_id) === S1(r.target_id)) || {}; const st = S1(t.status);
  if (['writing', 'written', 'won'].includes(st)) return 'live work or a win';
  if (st === 'set_aside') return 'set aside by the fit gate';
  if (st === 'skipped' && /kept by you/i.test(S1(t.reason))) return 'kept by you';
  if (typeof fitGate === 'function' && S1(r.keyword)) { const c = gateCtx(p); const g = c ? fitGate(S1(r.keyword), c) : { ok: true }; if (g && g.ok === false) return 'the fit gate refuses it (' + S1(g.reason) + ')'; }
  return ''; };
const rows = [];
for (const p of plans) {
  const ok = !p.error && p.air && typeof p.air === 'object';
  if (SINKS.includes(WHICH)) {   // the sinks: `on` sites only, never a failed plan
    if (!ok || !AIRF.writesSinks({ mode: p.mode }, false)) continue;
    const sk = p.air.sinks || {};
    if (WHICH === 'growth') { if (sk.growth && sk.growth.run_id) rows.push(sk.growth); continue; }
    for (const r of (sk[WHICH] || [])) { if (WHICH === 'targets' && leaveAlone(p, r)) continue; rows.push(r); }
    continue;
  }
  if (WHICH === 'runs') {   // one row per site and run, also for a plan that failed (the run row is AIR's log)
    const a = ok ? p.air : {};
    const kits = (a.kits_missing || []);
    const row = { site_id: p.site_id, domain: p.domain || '', run_id: p.run_id || AIRF.runId(p.site_id, Date.now()), checked_at: a.checked_at || new Date().toISOString(), mode: p.mode || '', rule_version: AIRF.RULE_VERSION,
      panel_json: J(a.panel), diag_json: J(a.diag || []), sources_json: J((a.sources || []).slice(0, 60)), candidates_json: J((a.candidates || []).slice(0, 60)), chosen_json: J(a.chosen || []),
      old_json: J(a.old), compare_json: J(a.compare), memo_json: J(a.memo), cost_json: J(a.cost), learn_json: J({ outcomes: a.outcomes || [], learned: a.learn || [], deferred: (a.deferred || []).slice(0, 30), refused: (a.refused || []).slice(0, 30), set_aside: (a.set_aside || []).slice(0, 20) }),
      exec_id: execId, error: !ok ? String(p.error || 'the plan gave no result') : kits.length ? 'kit not built: ' + kits.join(', ') : '' };
    // at most 60 KB a row: the diagnosis goes first (it is rebuilt every week), then the candidates, then the sources
    for (const k of ['diag_json', 'candidates_json', 'sources_json', 'learn_json']) { const size = COLS.reduce((n, c) => n + String(row[c] == null ? '' : row[c]).length, 0); if (size <= JSON_MAX) break; row[k] = J({ trimmed: true, chars: String(row[k]).length }); }
    rows.push(row); continue;
  }
  if (!ok) continue;
  for (const r of ((p.air.rows || {})[WHICH] || [])) rows.push(r);
}
return rows.length ? rows.map(r => ({ json: exact(r) })) : [{ json: { skip: true } }];
