// AIR plan (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §2, CONTRACTS.md §4, package P4): the AI-ranking algorithm for each website the gate
// let through (shadow or on, not killed). It reads stored data and this run's own outputs only, calls the two kits (ARD diagnosis, ARL decision;
// packages P1 / P2) through their frozen signatures, and hands one item per site to the row builders. It WRITES NOTHING itself.
//   out: { site_id, domain, mode, run_id, air: { market, panel: { core, proposed, extend, comparable, why, arms, mde }, diag, sources, candidates,
//          chosen, deferred, refused, outcomes, priors, memo, compare, cost, ...rows for the builders }, error: '' }
// Rules (CONTRACTS.md §3-§5):
//   * a kit result marked `unavailable` (a W0 skeleton) is never written: its rows are left out and the run row says `kit not built: <which>`;
//   * the old logic's choice this run (Growth Plan targets, Earned Media pages, Growth Metrics actions) is recorded beside AIR's (DESIGN 2.E);
//   * stored ladder rungs are read through the fit gate (FITR.rungs, INVARIANTS rule 2), stored prospects and outreach rows through the
//     competitor gate (OK.sellsSame), and a placement on a rival's own page is never chosen (owner: rival lists are learn-only);
//   * the sink rows (targets, prospects, proposed questions, core windows, protect cache, growth actions) are built ONLY for a site in `on`
//     (AIRF.writesSinks); in shadow the plan says what it would do and the builders write the five seo_ai_rank_* tables only;
//   * nothing paid: the only outside reading is `AI Rank Fetched` (package P5, wave 2), which spends only for an `on` site (AIRF.mayPay).
// ---- shared by the monitors (AI Visibility Tracker, Backlink Monitor, Audit Scheduler; inlined by the build): which sites, with which settings ----
// Sites = the Data Table seo_sites ("Track my site") + every domain with a keyword ladder; settings per site from seo_monitors (defaults: everything on).
// On demand (Manual Run with { domain | site_id }) one site runs even when its weekly / monthly monitor is off; an untracked domain is checked ad hoc
// with the trigger's country, e-mail and callback.
// 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.5 / §14.2): a THIRD kind of run, `trigger: 'cycle'` — the Cycle Dispatcher starting one job of one
// website's weekly cycle. It names one site like an on-demand run, but it has the SCHEDULED semantics: `on_demand` is false, a job the site
// switched off and a paused site are honoured (nothing runs, and the plan says why), an untracked domain is never checked ad hoc, and the
// monthly extras come only from the `monthly` the dispatcher passes (cycle.monthly), never from the UTC calendar. `cycle` travels with the
// result so every plan can carry it on.
// ---- 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.4 / §4.5 / §4.8): the website's own calendar ----
// With one Monday for everyone, a month or a day was the engine's UTC month or day and that rarely mattered. With a 7-day cycle per website
// (started the day it set up, at 06:00 in ITS time zone), a run after 20:00 New York on the last day of a month is already "next month" in
// UTC, and a site in Dubai has its Wednesday while New York still has Tuesday. This kit is the one place that answers, for a website:
//   * which local day / month it is (dayKey / monthKey / weekday), in the website's time zone (`seo_cycles.tz`, else the engine zone);
//   * what its cycle weekday is (`seo_cycles.cycle_weekday`, 0 = Sunday … 6 = Saturday) and how to say it ("every Wednesday" / "each week");
//   * what a cycle run is: `trigger: 'cycle'` on a Manual Run (the Cycle Dispatcher's payload, plan §14.2) -> cycleOf(trigger);
//   * how a weekly report is dated: by its cycle ("Week of Wed 15 Oct"), never by "Monday".
// Pure: Intl only, no clock unless one is passed, no table access (the caller hands it the seo_cycles rows). ENGINE_TZ is written in at build
// time from GENERIC_TIMEZONE (America/New_York when unset, the same default n8n/compose.yml and the catch-up use).
const ST = (() => {
  const ENGINE_TZ = 'America/New_York';
  const S = (v) => String(v == null ? '' : v).trim();
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const okTz = (tz) => { const z = S(tz); if (!z || /^__/.test(z)) return false; try { new Intl.DateTimeFormat('en-US', { timeZone: z }).format(0); return true; } catch (e) { return false; } };
  const engineTz = () => okTz(ENGINE_TZ) ? ENGINE_TZ : 'America/New_York';
  /** the zone to use: the given one when it is a real IANA zone, else the engine's */
  const zone = (tz) => okTz(tz) ? S(tz) : engineTz();
  const msOf = (t) => { if (t instanceof Date) return t.getTime(); if (typeof t === 'number' && Number.isFinite(t)) return t; const v = Date.parse(S(t)); return Number.isFinite(v) ? v : NaN; };
  const normD = (x) => S(x).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
  /** the wall-clock parts of instant `t` in zone `tz`: { date: 'YYYY-MM-DD', month: 'YYYY-MM', weekday: 0-6, hour, minute } */
  const parts = (t, tz) => {
    const ms = t === undefined || t === null || t === '' ? Date.now() : msOf(t);
    if (!Number.isFinite(ms)) return null;
    const f = new Intl.DateTimeFormat('en-US', { timeZone: zone(tz), year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const p = {}; for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
    const date = p.year + '-' + p.month + '-' + p.day;
    return { date, month: date.slice(0, 7), weekday: SHORT.indexOf(p.weekday), hour: Number(p.hour) % 24, minute: Number(p.minute) };
  };
  const dayKey = (t, tz) => { const p = parts(t, tz); return p ? p.date : ''; };
  const monthKey = (t, tz) => { const p = parts(t, tz); return p ? p.month : ''; };
  const weekday = (t, tz) => { const p = parts(t, tz); return p ? p.weekday : -1; };
  /** the weekday of a calendar date 'YYYY-MM-DD' (the date itself, no zone involved) */
  const weekdayOfDate = (date) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(S(date)); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay() : -1; };
  // ---- the website's cycle row (seo_cycles) ----
  const cycleRow = (rows, site) => {
    const s = site || {}, sid = S(s.site_id), dom = normD(s.domain);
    return (rows || []).find(r => r && typeof r === 'object' && !r.error && ((sid && S(r.site_id) === sid) || (dom && normD(r.domain) === dom))) || null;
  };
  const tzOf = (rows, site) => { const r = cycleRow(rows, site); return zone(r && r.tz); };
  /** the website's cycle weekday (0-6) or null when it has no cycle row (or the row carries none) */
  const cycleWeekday = (rows, site) => {
    const r = cycleRow(rows, site); if (!r || r.cycle_weekday === '' || r.cycle_weekday == null) return null;
    const w = Number(r.cycle_weekday); return Number.isInteger(w) && w >= 0 && w <= 6 ? w : null;
  };
  // ---- words ----
  const dayName = (wd) => (Number.isInteger(wd) && wd >= 0 && wd <= 6) ? DAYS[wd] : '';
  /** "every Wednesday" when the website's day is known, else "each week" */
  const everyText = (wd) => dayName(wd) ? 'every ' + dayName(wd) : 'each week';
  /** "on Wednesday" / "next week" */
  const onText = (wd) => dayName(wd) ? 'on ' + dayName(wd) : 'next week';
  /** 'YYYY-MM-DD' -> "Week of Wed 15 Oct" */
  const weekOf = (date) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(S(date)); if (!m) return ''; return 'Week of ' + SHORT[weekdayOfDate(date)] + ' ' + Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1]; };
  // ---- a cycle run (plan §14.2): { trigger: 'cycle', domain, site_id, cycle_key: 'cyc:<site_id>:<YYYY-MM-DD>', job, monthly, scheduled_for, request_id, light? } ----
  const yes = (v) => v === true || /^(true|1|yes|on)$/i.test(S(v));
  const keyDate = (key) => { const m = /:(\d{4}-\d{2}-\d{2})$/.exec(S(key)); return m ? m[1] : ''; };
  const cycleOf = (trigger) => {
    const t = trigger || {};
    if (S(t.trigger) !== 'cycle') return null;
    const key = S(t.cycle_key), date = keyDate(key);
    return { key, date, job: S(t.job), monthly: yes(t.monthly), light: t.light === undefined || t.light === null || t.light === '' ? null : yes(t.light),
      scheduled_for: S(t.scheduled_for), request_id: S(t.request_id), tz: okTz(t.tz) ? S(t.tz) : '', preview: yes(t.preview), label: date ? weekOf(date) : '' };
  };
  /** the fields a cycle run's callback carries (plan §14.2), or {} for any other run */
  const callbackFields = (cyc) => cyc && cyc.key ? { trigger: 'cycle', cycle_key: cyc.key, cycle_date: cyc.date, cycle_week: cyc.label, cycle_job: cyc.job } : {};
  return { ENGINE_TZ, okTz, zone, engineTz, parts, dayKey, monthKey, weekday, weekdayOfDate, cycleRow, tzOf, cycleWeekday, dayName, everyText, onText, weekOf, keyDate, cycleOf, callbackFields, DAYS };
})();
// AIR (2026-11-06, docs/ai-ranking-2026-11-05/CONTRACTS.md §4, package P4): the AI-ranking flags kit (AIRF) comes with this file, so every node that
// inlines it reads `s.settings.rank` the one way. A node that inlines this file must NOT add the AIRF marker again (one const AIRF).
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
let trigger = {}; try { const t = $('Manual Run').first(); trigger = (t && t.json) || {}; } catch (e) {}
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const siteIdFor = (d) => 'site_' + d.replace(/[^a-z0-9]+/g, '-');
const listOf = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\n,;]+/)).map(x => String(x).trim()).filter(Boolean);
const flag = (v, dflt) => (v === undefined || v === null || v === '') ? dflt : !(v === false || /^(false|0|no|off)$/i.test(String(v)));
const DEFAULT_ENGINES = ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode'];
const ALL_ENGINES = [...DEFAULT_ENGINES, 'copilot', 'chatgpt_api', 'gemini_api'];   // G6 (2026-10-18): + the ChatGPT and Gemini APIs (DataForSEO LLM Responses), opt-in
// G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): the panel holds 3-500 questions. A site with NO seo_monitors row starts at 50; a row whose
// field is empty keeps the v4.9 default of 20 (a release never raises an existing site's spend); a stored number is kept. AIP.panelSize
// (_ai_panel.js) is the same rule — harness S200 holds the two to each other.
const panelMaxOf = (m) => { if (!m || !m.site_id) return 50; const v = Number(m.ai_prompts_max); if (m.ai_prompts_max === '' || m.ai_prompts_max == null || !Number.isFinite(v) || v <= 0) return 20; return Math.min(500, Math.max(3, Math.round(v))); };   // v4.12: Copilot (Bing's Copilot Search summary) only when chosen: Bing shows it for few searches (0 of 10 live, 2026-10-10)
// P34-6 (live 2026-10-12): the AI Visibility Tracker and the Backlink Monitor called the business "techand.ai" in every report and in
// the analyst's fact sheet, because the name was read from seo_profiles only — while AI Growth and the Link Builder read the site model
// and say "Tech&". The name now comes through the model (SM.name over the stored seo_sites row, SITE_MODEL_SPEC.md), with the business
// profile first as before; the bare domain is never a name. The AI Pulse does not inline the model kit, so SM is optional here.
const nameOf = (row, prof) => {
  const own = String((prof || {}).business_name || '').trim();
  if (own) return own;
  if (typeof SM === 'undefined') return '';
  const model = SM.stored(row) || null; const nm = model ? SM.name(model) : '';
  return nm && SM.helpers.bare(nm) !== String(row.domain || '').toLowerCase() ? nm : '';
};
function monitorSites(kind) {   // kind: 'ai' | 'backlinks' | 'audit' | 'links' (v4.13 Link Builder)
  const sites = rowsOf('Load Sites').filter(r => r.site_id && r.domain), ladders = rowsOf('Load Ladders').filter(r => r.domain), mons = rowsOf('Load Monitors'), profiles = rowsOf('Load Profiles');
  const byDomain = new Map();
  for (const s of sites) { const d = normD(s.domain); if (d && !byDomain.has(d)) byDomain.set(d, { ...s, domain: d, keywords: listOf(s.keywords).map(k => k.toLowerCase()), virtual: false }); }
  for (const l of ladders) { const d = normD(l.domain); if (d && !byDomain.has(d)) byDomain.set(d, { site_id: siteIdFor(d), domain: d, country: l.country || '', location_code: Number(l.location_code) || 0, language_code: l.language_code || 'en', email: l.email || '', callback_url: l.callback_url || '', keywords: [], status: 'active', source: 'ladder', virtual: true }); }
  for (const s of byDomain.values()) { if (s.email && s.callback_url) continue; const l = ladders.find(l => normD(l.domain) === s.domain && (l.email || l.callback_url)); if (l) { s.email = s.email || l.email || ''; s.callback_url = s.callback_url || l.callback_url || ''; } }
  const want = normD(trigger.domain) || String(trigger.site_id || '').trim();
  const cycle = ST.cycleOf(trigger);
  let list = [...byDomain.values()];
  let cycle_why = '';
  if (want) {
    list = list.filter(s => s.domain === want || s.site_id === want);
    if (!list.length && normD(trigger.domain) && !cycle) list = [{ site_id: siteIdFor(normD(trigger.domain)), domain: normD(trigger.domain), country: trigger.country || '', location_code: Number(trigger.location_code) || 0, language_code: trigger.language_code || 'en', email: '', callback_url: '', keywords: [], status: 'active', source: 'adhoc', virtual: true, adhoc: true }];
    // a cycle run honours the pause, as the schedule always did (an on-demand run is the owner asking, so it still runs)
    if (cycle) {
      if (!list.length) cycle_why = 'no tracked website matches "' + want + '", so this cycle job had nothing to run';
      else if (list.every(s => String(s.status || 'active') === 'paused')) cycle_why = list[0].domain + ' is paused, so its weekly cycle runs nothing until it is resumed';
      list = list.filter(s => String(s.status || 'active') !== 'paused');
    }
  } else list = list.filter(s => String(s.status || 'active') !== 'paused');
  const on_demand = !!want && !cycle;
  const out = list.map(s => {
    const m = mons.find(x => x.site_id === s.site_id) || {};
    const p = profiles.find(x => x.site_id === s.site_id) || {};
    const engines = [...new Set(listOf(m.ai_engines).map(e => e.toLowerCase()).filter(e => ALL_ENGINES.includes(e)))];
    const settings = { ai_visibility: flag(m.ai_visibility, true), backlinks: flag(m.backlinks, true), audit_monthly: flag(m.audit_monthly, true), engines: engines.length ? engines : DEFAULT_ENGINES,
      prompts_max: panelMaxOf(m), pulse: flag(m.ai_pulse, true),
      // G6: who asks (buyer roles), where (extra markets, CC-lang) and how the daily pulse samples the panel ('' auto | sample | full; N a week)
      personas: listOf(m.ai_personas).slice(0, 6), markets: listOf(m.ai_markets).slice(0, 5), pulse_mode: String(m.ai_pulse_mode || '').toLowerCase().trim(),
      pulse_per_week: Number.isFinite(Number(m.ai_pulse_per_week)) && Number(m.ai_pulse_per_week) >= 1 ? Math.min(6, Math.round(Number(m.ai_pulse_per_week))) : 0, growth: flag(m.ai_growth, true), link_builder: flag(m.link_builder, true),
      ai_pages_month: m.ai_pages_month === '' || m.ai_pages_month == null || !Number.isFinite(Number(m.ai_pages_month)) ? 2 : Math.min(8, Math.max(0, Math.round(Number(m.ai_pages_month)))), audit_pages: Math.min(1000, Math.max(50, Number(m.audit_pages) || 200)), audit_js: flag(m.audit_js, false),
      competitors: [...new Set([...listOf(m.competitors), ...listOf(trigger.competitors)].map(normD).filter(d => d && d !== s.domain))].slice(0, 5),
      brand_names: [...new Set([...listOf(m.brand_names), ...listOf(trigger.brand_names), p.business_name || '', nameOf(s, p)].map(x => String(x).trim()).filter(Boolean))], stored: !!m.site_id };
    // W2-E3 (2026-10-23, WAVE2_CONTRACTS.md §4): the owner's engine and coverage options, every one off / empty by default (cost and behaviour unchanged)
    Object.assign(settings, { claude_weekly: flag(m.ai_claude_weekly, false), pulse_engines_raw: String(m.ai_pulse_engines || '').trim(), persona_context: flag(m.ai_persona_context, false),
      fanout_check: Number.isFinite(Number(m.ai_fanout_check)) && Number(m.ai_fanout_check) > 0 ? Math.min(200, Math.round(Number(m.ai_fanout_check))) : 0, demand_market: flag(m.ai_demand_market, false) });
    // AI-FOCUS (2026-10-27, docs/ai-panel-focus-2026-10-27 §4.7): what the daily pulse asks - 'focus' (the questions of the ladders and pages the client
    // works on, and the pinned ones) or 'all'. A site with NO seo_monitors row starts at 'focus'; a stored row whose field is empty keeps 'all', so a
    // release never changes what an existing site measures or pays. ai_focus_mode 'off' keeps the panel as it is (no automatic additions or retirements).
    Object.assign(settings, { pulse_scope: String(m.ai_pulse_scope || '').toLowerCase().trim() === 'focus' || (!m.site_id && !String(m.ai_pulse_scope || '').trim()) ? 'focus' : 'all',
      focus_mode: String(m.ai_focus_mode || '').toLowerCase().trim() === 'off' ? 'off' : 'auto' });
    // AIR (2026-11-06, CONTRACTS.md §2 / §4): the AI-ranking mode and its flags, every one OFF when empty ({ mode, reserve, fanout_n, mentions, brave }).
    // Read as `s.settings.rank.mode`; no plan, report or callback copies `settings` whole, so this field never reaches a client.
    settings.rank = AIRF.settingsOf(m);
    const o = { ...s, business_name: nameOf(s, p), settings, profile: { business_name: p.business_name || '', business_type: p.business_type || '', city: p.city || '', phone: p.phone || '', street_address: p.street_address || '', author_name: p.author_name || '',
      region: p.region || '', country_code: p.country_code || '', public_email: p.public_email || '', price_range: p.price_range || '', service_areas: p.service_areas || '', opening_hours: p.opening_hours || '' } };
    if (on_demand) { if (trigger.email) o.email = trigger.email; if (trigger.callback_url) o.callback_url = trigger.callback_url; if (trigger.country) o.country = trigger.country; if (Number(trigger.location_code)) o.location_code = Number(trigger.location_code); if (trigger.language_code) o.language_code = trigger.language_code; }
    o.request_id = String(trigger.request_id || s.request_id || '');
    o.cycle = cycle;   // null outside a cycle run
    return o;
  });
  const flagOf = { ai: 'ai_visibility', backlinks: 'backlinks', audit: 'audit_monthly', links: 'link_builder' }[kind];
  // a switched-off job is honoured by every run but an on-demand one (the scheduled rule, and now the cycle's too)
  const kept = on_demand ? out : out.filter(s => s.settings[flagOf]);
  if (cycle && !cycle_why && out.length && !kept.length) cycle_why = ({ ai: 'AI visibility', backlinks: 'the backlink monitor', audit: 'the monthly audit', links: 'the Link Builder' }[kind] || kind) + ' is switched off for ' + out[0].domain + ', so this cycle job runs nothing';
  return { list: kept, on_demand, want, trigger, total: byDomain.size, cycle, cycle_why };
}

// ---- the one site model (G19, 2026-10-12; see SITE_MODEL_SPEC.md; the builders inline this file where a node asks for the SITE_MODEL kit) ----
// Every workflow reads the same facts about a site through SM: the canonical host, the business name / logo / NAP (seo_profiles ->
// the homepage Organization / LocalBusiness schema -> Google Business Profile -> the fields the web app sent), the services and nav
// pages, the page inventory (seo_pages), the business facts, the call to action, the brand names, the competitors and the
// accreditation status. SM.from() builds the model, SM.toRow() writes it back to the seo_sites columns.
const SM = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const normHost = (v) => S(v).toLowerCase().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '');
  const bare = (v) => normHost(v).replace(/^www\./, '');
  const hostOf = (u) => normHost((S(u).match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '');   // the n8n Code sandbox has no URL constructor
  const siteIdFor = (d) => 'site_' + bare(d).replace(/[^a-z0-9]+/g, '-');
  const listOf = (v) => (Array.isArray(v) ? v : S(v).split(/[\n,;|]+/)).map(x => S(x)).filter(Boolean);
  const uniq = (a) => [...new Set(a)];
  const jparse = (v, dflt) => { if (v && typeof v === 'object') return v; try { const o = JSON.parse(S(v) || 'null'); return o == null ? dflt : o; } catch (e) { return dflt; } };
  const STOP = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'vs', 'with', 'your', 'our', 'my']);
  const tokensOf = (s) => S(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  // one-letter parts ("e" of "e invoicing") and stop words never decide a page match: with them "e invoicing uae penalties" would
  // score 3 of 4 against /uae-e-invoicing-fta-rules/ and claim the FTA page (the S26 false-match pair).
  const termsOf = (s) => uniq(tokensOf(s).filter(t => t.length > 1 && !STOP.has(t)));
  const pathOf = (u) => { const p = S(u).replace(/^https?:\/\/[^\/]*/i, ''); return p || '/'; };
  const strip = (s) => S(s).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ').replace(/\s+/g, ' ').trim();

  // ---- the homepage HTML: canonical host, Organization / LocalBusiness schema, nav pages ----
  const ldNodes = (html) => {
    const out = []; const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi; let m;
    const push = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(push); return; } out.push(o); if (Array.isArray(o['@graph'])) o['@graph'].forEach(push); };
    while ((m = re.exec(S(html)))) push(jparse(m[1], null));
    return out;
  };
  const ORG_TYPE = /(organization|corporation|localbusiness|professionalservice|store|ngo|educationalorganization|governmentorganization|onlinebusiness|softwarecompany|company|consultant|accountingservice)/i;
  const typesOf = (o) => [].concat((o && o['@type']) || []).map(t => S(t).toLowerCase());
  const orgFromHtml = (html) => {
    const nodes = ldNodes(html).filter(o => typesOf(o).some(t => ORG_TYPE.test(t)));
    const node = nodes.find(o => typesOf(o).some(t => /localbusiness|professionalservice|store/.test(t))) || nodes[0];
    if (!node) return null;
    const logo = typeof node.logo === 'string' ? node.logo : ((node.logo || {}).url || '');
    return { name: S(node.name), type: typesOf(node).join('/'), telephone: S(node.telephone), email: S(node.email), logo: S(logo),
      sameAs: listOf(node.sameAs), address: (node.address && typeof node.address === 'object') ? node.address : null };
  };
  const navFromHtml = (html, host) => {
    const h = S(html); const zones = [];
    for (const re of [/<nav\b[\s\S]*?<\/nav>/gi, /<header\b[\s\S]*?<\/header>/gi]) { const f = h.match(re); if (f) zones.push(...f); }
    const out = []; const seen = new Set();
    for (const zone of zones) {
      for (const a of (zone.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || [])) {
        const href = S((a.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1]);
        if (!href || /^(#|javascript:|mailto:|tel:)/i.test(href)) continue;
        const abs = /^https?:\/\//i.test(href) ? href : (href.charAt(0) === '/' ? 'https://' + host + href : '');
        if (!abs || bare(hostOf(abs)) !== bare(host)) continue;
        const p = pathOf(abs); if (p === '/' || seen.has(p)) continue;
        seen.add(p); out.push({ url: abs, title: strip(a).slice(0, 80), path: p });
        if (out.length >= 12) return out;
      }
    }
    return out;
  };

  // ---- precedence: seo_profiles -> homepage schema -> Google Business Profile -> what the app sent ----
  const pick = (sources, read) => { for (const s of sources) { const v = S(read(s.value) || ''); if (v) return { value: v, source: s.name }; } return { value: '', source: '' }; };

  const from = (siteRow, extras) => {
    const row = (siteRow && typeof siteRow === 'object') ? siteRow : {};
    const x = (extras && typeof extras === 'object') ? extras : {};
    const req = x.request || {};
    const prof = x.profile || {};
    const gbp = x.gbp || {};
    const html = S(x.html || (x.home || {}).html);
    const domain = bare(row.domain || x.domain || req.domain || (x.home || {}).url || '');
    const site_id = S(row.site_id) || S(x.site_id) || (domain ? siteIdFor(domain) : '');
    const org = x.homepage_org || (html ? orgFromHtml(html) : null) || null;

    // canonical host: this run's probe, else the homepage's own canonical tag, else where the homepage request landed, else the stored
    // value, else the bare domain. A canonical tag on another domain is ignored.
    const canonTag = (S(html).match(/<link\b[^>]*>/gi) || []).find(t => /\brel\s*=\s*["']?canonical\b/i.test(t)) || '';
    const canonHost = hostOf((canonTag.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1] || '');
    const landed = hostOf(x.final_url || (x.home || {}).url || '');
    const fromProbe = normHost(x.canonical_host || (x.probe || {}).canonical_host || '');
    // the site's own live URLs (ladder pages, published pages, sitemap) are evidence too: the host most of them use
    const voted = (() => { const c = {}; for (const u of (x.seen_hosts || [])) { const h = normHost(u.indexOf('/') >= 0 ? hostOf(u) || u : u); if (h && bare(h) === domain) c[h] = (c[h] || 0) + 1; }
      return Object.keys(c).sort((a, b) => c[b] - c[a] || a.length - b.length)[0] || ''; })();
    const candidates = [[fromProbe, 'probe'], [bare(canonHost) === domain ? canonHost : '', 'canonical tag'], [bare(landed) === domain ? landed : '', 'redirect'], [voted, 'live urls'], [normHost(row.canonical_host), 'stored'], [domain, 'domain']];
    const hit = candidates.find(c => c[0]) || [domain, 'domain'];
    const canonical_host = hit[0], host_source = hit[1];

    const SRC = [{ name: 'profile', value: prof }, { name: 'homepage_schema', value: org || {} }, { name: 'gbp', value: gbp }, { name: 'app', value: req }, { name: 'stored', value: { business_name: row.business_name, logo_url: row.logo_url } }];
    const nameHit = pick(SRC, (s) => s.business_name || s.name || s.title);
    const logoHit = pick(SRC, (s) => s.logo_url || s.logo || s.photo_url);
    const addr = (org && org.address && typeof org.address === 'object') ? org.address : {};
    const NAP_SRC = [{ name: 'profile', value: prof }, { name: 'homepage_schema', value: { street_address: addr.streetAddress, city: addr.addressLocality, region: addr.addressRegion, postal_code: addr.postalCode, country_code: addr.addressCountry, phone: (org || {}).telephone, public_email: (org || {}).email } },
      { name: 'gbp', value: { street_address: gbp.address, city: gbp.city, phone: gbp.phone } }, { name: 'app', value: req }];
    const street = pick(NAP_SRC, (s) => s.street_address), phone = pick(NAP_SRC, (s) => s.phone);
    const nap = { business_name: nameHit.value, street_address: street.value, city: pick(NAP_SRC, (s) => s.city).value, region: pick(NAP_SRC, (s) => s.region).value,
      postal_code: pick(NAP_SRC, (s) => s.postal_code).value, country_code: pick(NAP_SRC, (s) => s.country_code || s.country).value,
      phone: phone.value, public_email: pick(NAP_SRC, (s) => s.public_email || s.email).value, price_range: S(prof.price_range), source: street.source || phone.source || '' };
    const stored = jparse(row.nap_json, null);
    if (stored && !nap.street_address && !nap.phone) { Object.assign(nap, stored); nap.source = S(stored.source) || 'stored'; }

    // P2-2 (2026-10-12): the Site Describer answers with `products_or_services` — reading only `services` left services_json empty on every
    // site, so the brief's facts said `services: []` although the describer had found nine.
    const desc0 = x.description || {};
    // keyword-first (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §5.2 / §14.1): what the client SAID they sell ("What do you sell?" on Track my site,
    // seo_sites.declared_services) comes first and is never dropped by what a crawl read; it is kept apart as well, so SM.toRow writes it back
    // unchanged and the weekly Site Tracker can never overwrite it
    const declListOf = (v) => { if (Array.isArray(v)) return v; const j = jparse(v, null); return Array.isArray(j) ? j : listOf(v); };
    const declared_services = uniq([...declListOf(x.declared_services), ...declListOf(row.declared_services)].map(s => S(s).slice(0, 120))).filter(Boolean).slice(0, 30);
    const services = uniq([...declared_services, ...listOf(x.services), ...listOf(desc0.products_or_services), ...listOf(desc0.services), ...listOf(desc0.main_services), ...(jparse(row.services_json, []) || [])].map(s => S(s).slice(0, 120))).filter(Boolean).slice(0, 30);
    const navStored = jparse(row.nav_pages_json, []) || [];
    const navFresh = x.nav_pages || (html && canonical_host ? navFromHtml(html, canonical_host) : []);
    const nav_pages = (navFresh.length ? navFresh : navStored).map(p => ({ url: S(p.url), title: S(p.title), path: S(p.path) || pathOf(p.url) })).filter(p => p.url).slice(0, 12);

    const pages = (Array.isArray(x.pages) ? x.pages : []).map(p => ({ url: S(p.url), title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod),
      queries: Array.isArray(p.queries) ? p.queries : (jparse(p.queries_json, []) || []), http_status: Number(p.http_status) || 0, status_at: S(p.status_at) })).filter(p => p.url);

    const business_facts = S(req.business_facts || x.business_facts || row.business_facts).slice(0, 2000);
    const cta = S(req.cta || x.cta || row.cta).slice(0, 200);
    const mon = x.monitors || {};
    const brand_names = uniq([...listOf(mon.brand_names), ...listOf(x.brand_names), ...listOf(row.brand_names), nameHit.value].filter(Boolean));
    const competitors = uniq([...listOf(mon.competitors), ...listOf(x.competitors), ...listOf(row.competitors)].map(bare).filter(d => d && d !== domain)).slice(0, 8);
    const accreditation = S(x.accreditation || row.accreditation);
    const updated_at = S(x.updated_at) || S(row.model_updated_at) || new Date().toISOString();

    return { site_id, domain, canonical_host, host_source, home_url: 'https://' + canonical_host + '/',
      business_name: nameHit.value, name_source: nameHit.source, logo_url: logoHit.value, logo_source: logoHit.source,
      nap, services, declared_services, nav_pages, pages, business_facts, cta, brand_names, competitors, accreditation,
      model_updated_at: updated_at, sources: { profile: !!prof.site_id || !!prof.business_name, homepage_schema: !!org, gbp: !!(gbp.name || gbp.phone), app: !!(req.business_facts || req.cta || req.business_name), html: !!html } };
  };

  // every URL the agent emits for a site goes through here: https, the canonical host, no double slash
  const siteUrl = (model, path) => {
    const p = S(path);
    if (/^https?:\/\//i.test(p)) return p;
    const host = normHost((model || {}).canonical_host || (model || {}).domain || '');
    const tail = p ? ('/' + p).replace(/\/{2,}/g, '/') : '/';
    return 'https://' + host + tail;
  };
  const apiTarget = (model) => bare((model || {}).domain || (model || {}).canonical_host || '');   // DataForSEO and the other APIs keep the bare domain
  const name = (model) => S((model || {}).business_name) || bare((model || {}).domain || '');
  const nap = (model) => ((model || {}).nap && typeof model.nap === 'object') ? model.nap : { business_name: '', street_address: '', city: '', region: '', postal_code: '', country_code: '', phone: '', public_email: '', price_range: '', source: '' };
  const services = (model) => Array.isArray((model || {}).services) ? model.services : [];
  const pages = (model) => Array.isArray((model || {}).pages) ? model.pages : [];
  const facts = (model) => {
    const t = S((model || {}).business_facts) + ' ' + S(((model || {}).nap || {}).price_range);
    return { business_facts: S((model || {}).business_facts), cta: S((model || {}).cta), accreditation: S((model || {}).accreditation),
      pricing: /(aed|usd|\$|€|£|price|pricing|cost|fee|per month|per user|from \d)/i.test(t),
      timeline: /(\d+\s*(day|week|month|year)|timeline|go.?live|turnaround|within \d)/i.test(t) };
  };
  // a page of the inventory answers a keyword when it already gets impressions for it, or when at least 75% of the keyword's
  // meaningful words are in its slug or title (D11; keep it even while the inventory is empty).
  const MATCH_MIN = 0.75;
  // R35 (2026-10-16, re-rating 2026-10-15): the words were compared literally, so "d365 finance dubai" did not match a page titled
  // "Dynamics 365 Finance & Operations UAE" and the report told the owner that page "does not target" the search. Three rules, applied
  // to BOTH sides before anything is compared: the product's own short names are written out (d365 = dynamics 365, f&o = finance and
  // operations), a word is compared on a light stem (invoice / invoices / invoicing), and an emirate in the SEARCH is covered by a page
  // about the UAE ("emirate ⊂ uae" — never the other way round: a Dubai page does not answer every UAE search).
  const SYN = [[/\bd\s?365\b/g, 'dynamics 365'], [/\bdynamics365\b/g, 'dynamics 365'], [/\bf\s?&\s?o\b|\bfno\b/g, 'finance operations'], [/\bunited arab emirates\b/g, 'uae'],
    [/\babu dhabi\b/g, 'abudhabi'], [/\bras al khaimah\b/g, 'rasalkhaimah'], [/\bumm al quwain\b/g, 'ummalquwain'], [/\bal ain\b/g, 'alain']];
  const EMIRATES = new Set(['dubai', 'abudhabi', 'sharjah', 'ajman', 'fujairah', 'rasalkhaimah', 'rak', 'ummalquwain', 'alain']);
  const norm = (s) => { let t = S(s).toLowerCase().replace(/&amp;/g, '&'); for (const [re, to] of SYN) t = t.replace(re, to); return t; };
  const stem = (t) => t.length >= 5 ? t.replace(/(ings?|ed|es|(?<!s)s)$/, '').replace(/e$/, '') : t;   // business = businesses, invoice = invoicing
  const matchTerms = (s) => uniq(termsOf(norm(s)).map(stem));
  // a keyword term is covered by a page's terms: the same stem, or an emirate in the search against a page about the UAE
  const covers = (set, t) => set.includes(t) || (EMIRATES.has(t) && (set.includes('uae') || set.includes('emirat')));
  const shareIn = (want, set) => want.length ? want.filter(t => covers(set, t)).length / want.length : 0;
  // R56: a listing page (the blog / insights index, a category, a tag) gets impressions for every article it lists; when a dedicated
  // page matches the same search by its own slug or title, the dedicated page is the one that answers it
  const LISTING = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:insights|blog|blogs|news|articles|resources|posts|updates|knowledge|learn|library|stories|press|media|case-studies)\/?$|\/(?:category|categories|tag|tags|page|author|topics?)\/[^/]+\/?$/i;
  const isListing = (u) => { const p = pathOf(u).replace(/[?#].*$/, ''); return LISTING.test(p); };
  const untitled = (model) => pages(model).filter(p => !S(p.title) && !S(p.h1));
  // RV-1 (2026-10-21): a page whose address answered 404 / 410 when it was last read (redirects followed: the bare host 308s to www, which
  // 404s) is GONE. It is still in the inventory (Google keeps showing it), but no advice may point at it: matchPage never returns it as
  // "the page that answers this search", and the readers list it as a redirect to make (v5/code/_gone.js). Unknown (0) is not gone.
  const isGone = (p) => { const n = Number((p || {}).http_status) || 0; return n === 404 || n === 410; };
  // section 189 (production review 2026-11-12): an address that answers a redirect (3xx to another path, read by the daily page watch) is not a
  // page: no search is matched to it and no rule names it as the page for a search
  const isMoved = (p) => { const n = Number((p || {}).http_status) || 0; return n >= 300 && n < 400; };
  const gonePages = (model) => pages(model).filter(isGone);
  // ---- K8 (2026-10-21, KW-MATCH): the page that is ABOUT the search, not only the page that repeats its words ----
  // The 75% word rule missed techand.ai's live "AI & Automation | What We Do | Tech&" (/whatwedo/ai-automation) for "ai consulting dubai"
  // (1 of 3 words) and the ladder planned a new top page beside it; it also let "it consulting services dubai" claim an AI consulting page
  // on "consulting services dubai" alone. Now: brand, place and generic service words ("consulting", "services", "company", "dubai") never
  // decide a match; what is left (the search's core words) must be on the page, weighted by how rare each word is on this site (IDF: a word
  // on every page proves nothing); the page's title / H1, address and Search Console searches are the evidence, in that order; a page whose
  // own words belong to another service of the client is never the answer; an article is not the answer to a buying search; a gone page
  // answers nothing. Every hit carries `confidence` (0-1), `confidence_label` and `evidence` in plain words; a weaker one is `may_overlap`
  // (pageMatch), which callers report as "may overlap" and never as the page.
  const GENERIC = new Set(['consulting', 'consultant', 'consultants', 'consultancy', 'consultancies', 'service', 'services', 'company', 'companies', 'agency', 'agencies',
    'firm', 'firms', 'provider', 'providers', 'solution', 'solutions', 'expert', 'experts', 'specialist', 'specialists', 'partner', 'partners', 'professional', 'professionals',
    'team', 'teams', 'best', 'top', 'near', 'me', 'leading', 'trusted', 'certified', 'official', 'online', 'local', 'affordable', 'cheap', 'home', 'page', 'website', 'site']);
  const COMMERCIAL = new Set(['consulting', 'consultant', 'consultants', 'consultancy', 'service', 'services', 'company', 'companies', 'agency', 'agencies', 'firm', 'firms',
    'provider', 'providers', 'solution', 'solutions', 'expert', 'experts', 'specialist', 'specialists', 'partner', 'partners', 'hire', 'price', 'pricing', 'cost', 'quote']);
  const PLACES = new Set(['uae', 'gcc', 'mena', 'emirates', 'emirate', 'middle', 'east', 'saudi', 'arabia', 'ksa', 'riyadh', 'jeddah', 'dammam', 'qatar', 'doha', 'oman', 'muscat',
    'bahrain', 'manama', 'kuwait', 'egypt', 'cairo', 'uk', 'london', 'usa', 'india', 'pakistan', 'karachi', 'lahore', 'singapore', 'europe', 'gulf', 'dxb', 'difc', 'dafza']);
  // the kind of service a search or a page is about: "crm consulting" is not answered by a "CRM implementation" page (the words left are the same)
  const KIND = { consulting: 'consulting', consultant: 'consulting', consultants: 'consulting', consultancy: 'consulting', advisory: 'consulting', implementation: 'implementation', implement: 'implementation',
    migration: 'migration', integration: 'integration', support: 'support', training: 'training', course: 'training', courses: 'training', pricing: 'pricing', price: 'pricing', cost: 'pricing',
    audit: 'audit', development: 'development', licensing: 'licensing', license: 'licensing', licence: 'licensing', jobs: 'jobs', careers: 'jobs', career: 'jobs', hosting: 'hosting', outsourcing: 'outsourcing' };
  const kindsOf = (s) => uniq(tokensOf(norm(s)).map(t => KIND[t]).filter(Boolean));
  const ARTICLE = /\/(?:insights|blog|blogs|news|articles|resources|posts|updates|knowledge|learn|library|stories|press|media|guides?)\/[^/]+/i;
  const svcList = (model) => (model && Array.isArray(model.declared_services) && model.declared_services.length) ? model.declared_services : services(model);
  // the client's own name ("Tech&", "techand"): never a topic word, unless the word also names one of its services ("ERP Partners" sells ERP)
  const brandWords = (model) => { const m = model || {}; const label = bare(m.domain || m.canonical_host || '').split('.')[0].replace(/[^a-z0-9]/g, '');
    const svc = new Set(svcList(m).flatMap(sv => tokensOf(norm(sv))));
    return new Set([...(m.brand_names || []), m.business_name].flatMap(b => tokensOf(norm(b))).concat(label ? [label] : []).filter(t => t.length > 2 && !svc.has(t))); };
  // the words that say WHAT a text is about: no stop / filler / generic / place / brand word, light stem, synonyms written out
  const coreTerms = (s, brands) => uniq(tokensOf(norm(s)).filter(t => t.length > 1 && !STOP.has(t) && !FILLER.has(t) && !GENERIC.has(t) && !PLACES.has(t) && !EMIRATES.has(t) && !(brands && brands.has(t))).map(stem));
  const slugText = (u) => pathOf(u).replace(/[?#].*$/, '').replace(/\.[a-z]{2,5}$/i, '').replace(/[\/_-]+/g, ' ');
  const fieldsOf = (p, brands) => ({ title: coreTerms(S(p.title) + ' ' + S(p.h1), brands), own: coreTerms(S(p.title) + ' ' + S(p.h1) + ' ' + slugText(p.url), brands),
    slug: coreTerms(slugText(p.url), brands), desc: coreTerms(S(p.description), brands),
    queries: (p.queries || []).filter(q => (Number((q || {}).impressions) || 0) > 0).map(q => coreTerms(S((q || {}).query || (q || {}).keyword), brands)) });
  // the client's services a set of core words belongs to (declared first): a service is hit when at least half its own core words are there
  const serviceHits = (model, terms, brands) => { const set = new Set(terms); const out = [];
    for (const sv of svcList(model)) { const st = coreTerms(sv, brands); if (!st.length) continue; const have = st.filter(t => set.has(t)).length; if (have >= Math.max(1, Math.ceil(st.length / 2))) out.push(S(sv)); }
    return out; };
  const MATCH_CONF = { page: 0.75, overlap: 0.4, article_cap: 0.6, high: 0.85 };
  const confLabel = (c) => c >= MATCH_CONF.high ? 'high' : c >= MATCH_CONF.page ? 'medium' : 'low';
  const topicMatch = (model, keyword, inv, opts) => {
    const o = opts || {}; const brands = brandWords(model); const core = coreTerms(keyword, brands); if (!core.length) return { best: null, overlap: null, core };
    const commercial = tokensOf(norm(keyword)).some(t => COMMERCIAL.has(t)); const kKinds = kindsOf(keyword);
    const docs = inv.map(p => ({ p, f: fieldsOf(p, brands) }));
    const N = docs.length || 1; const df = (t) => docs.filter(d => covers(d.f.own, t)).length;
    const w = new Map(core.map(t => [t, Math.log((N + 1) / (df(t) + 1)) + 1]));   // IDF: a word on every page of the site weighs least
    const W = core.reduce((a, t) => a + w.get(t), 0);
    const kSvc = serviceHits(model, core, brands);
    const kSvcTerms = new Set(kSvc.flatMap(sv => coreTerms(sv, brands)));
    const ignored = uniq(tokensOf(norm(keyword)).filter(t => GENERIC.has(t) || PLACES.has(t) || EMIRATES.has(t) || brands.has(t)));
    let best = null, overlap = null;
    const better = (a, b) => !b || a.confidence > b.confidence + 1e-9 || (Math.abs(a.confidence - b.confidence) < 1e-9 && (a.search_queries_about > b.search_queries_about || (o.isPref && o.isPref(a.url) && !o.isPref(b.url))));
    for (const { p, f } of docs) {
      if (o.skip && o.skip(p)) continue;
      const qAbout = f.queries.filter(q => core.every(t => covers(q, t)));   // its Search Console searches that carry every core word of this one
      const field = (t) => covers(f.title, t) ? 1 : covers(f.slug, t) ? 0.9 : qAbout.length >= 2 ? 1 : f.queries.filter(q => covers(q, t)).length >= 2 ? 0.85 : qAbout.length === 1 ? 0.7 : covers(f.desc, t) ? 0.6 : 0;
      const cov = core.reduce((a, t) => a + w.get(t) * field(t), 0) / W;
      if (cov <= 0) continue;
      const pSvc = serviceHits(model, f.own, brands);
      if (kSvc.length && pSvc.length && !pSvc.some(sv => kSvc.includes(sv))) continue;   // another service of the client: never the answer, not even "may overlap"
      // focus: how much of the page's own title is this search (or the client service it belongs to); a page about five things is a weaker answer
      const own = f.title.length ? f.title : f.slug;
      const focus = own.length ? own.filter(t => core.includes(t) || kSvcTerms.has(t)).length / own.length : 0;
      let conf = cov * (0.8 + 0.2 * focus);
      const article = ARTICLE.test(pathOf(p.url)) || isListing(p.url);
      if (commercial && article) conf = Math.min(conf, MATCH_CONF.article_cap);   // an article about the subject is not the page that sells it
      const pKinds = kindsOf(S(p.title) + ' ' + S(p.h1) + ' ' + slugText(p.url)); const kindClash = kKinds.length && pKinds.length && !pKinds.some(k => kKinds.includes(k));
      if (kindClash) conf = Math.min(conf, MATCH_CONF.article_cap);   // "crm consulting" vs a "CRM implementation" page: another kind of service
      const untitled = !S(p.title) && !S(p.h1);
      if (untitled && qAbout.length < 2) conf = Math.min(conf, MATCH_CONF.article_cap);   // an address alone is not enough to call it the page (R34: titles not read yet)
      conf = Math.round(conf * 100) / 100;
      const inTitle = core.filter(t => covers(f.title, t)), inSlug = core.filter(t => !covers(f.title, t) && covers(f.slug, t));
      const ev = [];
      if (inTitle.length) ev.push('its title' + (S(p.title) ? ' "' + S(p.title).replace(/&amp;/g, '&') + '"' : '') + ' is about ' + inTitle.map(t => '"' + t + '"').join(' and '));
      if (inSlug.length) ev.push('its address ' + pathOf(p.url) + ' carries ' + inSlug.map(t => '"' + t + '"').join(' and '));
      if (qAbout.length) ev.push(qAbout.length + ' of its Search Console searches ' + (qAbout.length === 1 ? 'is' : 'are') + ' about it');
      const shared = pSvc.find(sv => kSvc.includes(sv));
      if (shared) ev.push('both are about your service "' + shared + '"');
      if (commercial && article) ev.push('it is an article, not the page that sells this service');
      if (kindClash) ev.push('it is about ' + pKinds.join(' / ') + ', the search asks for ' + kKinds.join(' / '));
      if (untitled && qAbout.length < 2) ev.push('its title was not read yet');
      if (!ev.length) ev.push('some of its words are about this search');
      const hit = { url: p.url, title: p.title, source: p.source, matched_by: inTitle.length ? 'title' : inSlug.length ? 'slug' : qAbout.length ? 'query' : 'topic', score: conf, impressions: 0,
        confidence: conf, confidence_label: confLabel(conf), search_queries_about: qAbout.length, article, pass: 'topic',
        evidence: ev.join(', ') + (ignored.length ? ' (' + ignored.map(t => '"' + t + '"').join(', ') + ' left out as too general)' : '') };
      if (conf + 1e-9 >= MATCH_CONF.page) { if (better(hit, best)) best = hit; }
      else if (conf + 1e-9 >= MATCH_CONF.overlap && better(hit, overlap)) overlap = hit;
    }
    return { best, overlap, core };
  };
  // { match, may_overlap }: `match` is the page that answers the search (or null), `may_overlap` a weaker candidate to mention, never to act on
  const pageMatch = (model, keyword, prefer) => {   // `prefer`: a URL that wins a tie (the page Search Console itself credits for the search)
    const prefKey = prefer ? bare(hostOf(prefer)) + pathOf(prefer).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase() : "";
    const isPref = (u) => !!prefKey && (bare(hostOf(u)) + pathOf(u).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase()) === prefKey;
    const want = matchTerms(keyword); if (!want.length) return { match: null, may_overlap: null };
    const key = tokensOf(keyword).join(' ');
    const inv = pages(model).filter(p => !isGone(p) && !isMoved(p));   // RV-1: a gone page answers nothing; section 189: nor does an address that redirects
    const brands = brandWords(model); const core = coreTerms(keyword, brands);
    const kSvc = core.length ? serviceHits(model, core, brands) : [];
    const otherService = (p) => { if (!kSvc.length) return false; const ps = serviceHits(model, fieldsOf(p, brands).own, brands); return ps.length > 0 && !ps.some(sv => kSvc.includes(sv)); };
    const byQuery = [];
    for (const p of inv) {
      const q = (p.queries || []).find(x => tokensOf(x.query || x.keyword || x).join(' ') === key && (Number((x || {}).impressions) || 0) > 0);
      if (q) byQuery.push({ url: p.url, title: p.title, source: p.source, matched_by: 'query', score: 1, impressions: Number(q.impressions) || 0,
        confidence: 1, confidence_label: 'high', pass: 'query', evidence: 'Google already shows it for this exact search (' + (Number(q.impressions) || 0) + ' impressions in Search Console)' });
    }
    byQuery.sort((a, b) => Number(isListing(a.url)) - Number(isListing(b.url)) || b.impressions - a.impressions);
    const qHit = byQuery[0] || null;
    const listingOf = (lst, best) => ({ url: lst.url, impressions: lst.impressions,
      note: 'Google currently shows ' + pathOf(lst.url) + ' (a listing page) for this search; the page that is about it is ' + pathOf(best.url) });
    if (qHit && !isListing(qHit.url)) { const lst = byQuery.find(x => isListing(x.url)); return { match: lst ? { ...qHit, listing: listingOf(lst, qHit) } : qHit, may_overlap: null }; }
    let best = null;
    for (const p of inv) {
      if (qHit && isListing(p.url)) continue;   // R56: looking for the dedicated page behind a listing's impressions
      const slug = matchTerms(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''));
      const title = matchTerms(S(p.title) + ' ' + S(p.h1));
      const inSlug = shareIn(want, slug);
      const inTitle = shareIn(want, title);
      const score = Math.max(inSlug, inTitle);
      if (score + 1e-9 < MATCH_MIN) continue;
      // K8: the 75% may be made of generic and place words only when the search's core words are on the page too ("it consulting services
      // dubai" is not an AI consulting page), and never on a page of another service of the client
      if (core.length && !core.every(t => covers(slug, t) || covers(title, t))) continue;
      if (otherService(p)) continue;
      if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && isPref(p.url) && !isPref(best.url))) { const sc = Math.round(score * 100) / 100;
        best = { url: p.url, title: p.title, source: p.source, matched_by: inSlug >= inTitle ? 'slug' : 'title', score: sc, impressions: 0, confidence: sc, confidence_label: confLabel(sc), pass: 'words',
          evidence: (inSlug >= inTitle ? 'its address ' + pathOf(p.url) : 'its title "' + S(p.title).replace(/&amp;/g, '&') + '"') + ' carries ' + Math.round(score * 100) + '% of the words of the search' }; }
    }
    let overlap = null;
    if (!best) { const t = topicMatch(model, keyword, inv, { skip: (p) => !!qHit && isListing(p.url), isPref }); best = t.best; overlap = t.overlap; }
    if (qHit && best) return { match: { ...best, listing: listingOf(qHit, best) }, may_overlap: null };
    const match = qHit || best;
    return { match, may_overlap: match || !overlap ? null : { ...overlap, note: 'may overlap: ' + pathOf(overlap.url) + ' touches this search (' + overlap.evidence + '), but not closely enough to call it the page for it' } };
  };
  const matchPage = (model, keyword, prefer) => pageMatch(model, keyword, prefer).match;
  // A-22 (2026-10-17): how well ONE page of the inventory targets a search by its own words (slug or title / H1, the matchPage rule), so a
  // caller that already knows the page Google ranks can ask whether another page targets the search more closely - never to replace it
  const pageScore = (page, keyword) => { const p = page || {}; const want = matchTerms(keyword); if (!want.length || !S(p.url)) return null;
    return Math.round(Math.max(shareIn(want, matchTerms(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''))), shareIn(want, matchTerms(S(p.title) + ' ' + S(p.h1)))) * 100) / 100; };
  // R35: how much of a search a page's OWN title / H1 holds (null when the page's title was never read) - the only evidence that may call
  // a page "about something else"
  // the words of a spoken / long-tail search that say nothing about the subject ("which ... can help ... in the uae")
  const FILLER = new Set(['which', 'what', 'how', 'why', 'when', 'where', 'who', 'can', 'could', 'help', 'helps', 'best', 'top', 'near', 'me', 'is', 'are', 'do', 'does', 'should', 'will', 'would', 'get', 'need', 'i', 'we', 'you']);
  const titleShare = (page, keyword) => { const p = page || {}; if (!S(p.title) && !S(p.h1)) return null;
    const want = uniq(termsOf(norm(keyword)).filter(t => !FILLER.has(t)).map(stem)); if (!want.length) return null; const set = matchTerms(S(p.title) + ' ' + S(p.h1));
    return { share: Math.round(shareIn(want, set) * 100) / 100, have: want.filter(t => covers(set, t)).length, of: want.length, missing: want.filter(t => !covers(set, t)) }; };
  // ---- W05-B (2026-10-30, page-quality BEFORE_AFTER K4): is this page really THE page for the search, before a run rewrites its address? ----
  // The content run took /dynamics-365-project-operations-uae (title not on file, matched by its address only: "dynamics", "365", "uae") as the
  // page to improve for "dynamics 365 partner dubai", wrote the partner page onto that address, and the hold waved it through as a refresh.
  // An address is not evidence of what a page is about. A page is confirmed only by its OWN words: its title or main heading (from the
  // inventory or read in this run, `more.texts`), or a Search Console search it earns impressions for, where that text (1) carries every core
  // word of the search, (2) carries 75% of all its words, and (3) is ABOUT the search: its rarest word on this site is one of the search's own,
  // or the words it adds (not the brand, a place, the kind of service or the form of the page) weigh under a third of the whole. "Dynamics 365
  // Project Operations Implementation UAE" adds "project" and "operations" (rare) to "dynamics 365" (on every page): about something else.
  // Returns { ok, by, text, evidence, why }; never throws; with nothing to read, ok is false (the caller writes a new page and says so).
  const confirmPage = (model, page, keyword, more) => {
    const p = page || {}; const o = more || {};
    const m = model || {}; const brands = brandWords(m);
    const core = coreTerms(keyword, brands);
    const want = uniq(termsOf(norm(keyword)).filter(t => !FILLER.has(t)).map(stem));
    const shortUrl = pathOf(p.url);
    if (!core.length || !want.length) return { ok: false, by: '', text: '', evidence: '', why: 'the search has no word that says what it is about, so no page can be confirmed as its page' };
    // the kind of service ("implementation", "support") and the form of the page ("guide", "checklist", a year) say how a page answers, not what about
    const FORM = ['guide', 'guides', 'buyer', 'buyers', 'complete', 'ultimate', 'definitive', 'explained', 'explain', 'overview', 'introduction', 'intro', 'checklist', 'faq', 'faqs',
      'tip', 'tips', 'everything', 'know', 'need', 'basic', 'basics', 'beginner', 'beginners', 'step', 'steps', 'updated', 'latest'];
    const kindStems = new Set([...Object.keys(KIND), ...FORM].map(stem));
    const inv = pages(m); const N = inv.length || 1;
    const docs = inv.map(x => fieldsOf(x, brands).own);
    const wOf = (t) => { const df = docs.filter(d => covers(d, t)).length; return Math.log((N + 1) / (df + 1)) + 1; };
    const cands = [];
    const add = (text, by) => { const t = S(text).replace(/&amp;/g, '&'); if (t) cands.push({ text: t, by }); };
    add(p.title, 'its title'); add(p.h1, 'its main heading');
    for (const t of (Array.isArray(o.texts) ? o.texts : [])) if (t && S(t.text)) add(t.text, S(t.by) || 'its title as read now');
    for (const q of (Array.isArray(p.queries) ? p.queries : queriesOf(p))) if ((Number((q || {}).impressions) || 0) > 0) add((q || {}).query || (q || {}).keyword, 'a search it earns impressions for in Search Console');
    if (!cands.length) return { ok: false, by: '', text: '', evidence: '', why: shortUrl + ' has no title, main heading or Search Console search on file, and an address alone does not say what a page is about' };
    let best = null;
    for (const c of cands) {
      const tt = coreTerms(c.text, brands); if (!tt.length) continue;
      const allCore = core.every(t => covers(tt, t));
      const share = shareIn(want, matchTerms(c.text));
      const extra = uniq(tt.filter(t => !core.includes(t) && !kindStems.has(t) && !/^(?:19|20)\d\d$/.test(t)));
      const own = core.filter(t => covers(tt, t)).reduce((a, t) => a + wOf(t), 0);
      const add2 = extra.reduce((a, t) => a + wOf(t), 0);
      const focus = own + add2 > 0 ? own / (own + add2) : 0;
      // about the search: its rarest word is one of the search's own (an article title that only describes more, "the cost of non-compliance:
      // UAE e-invoicing penalties and mitigation costs", keeps it), or what it adds weighs under a third ("d365 operations uae", 0.58 on
      // client A's site, adds the rarer "operations" to "dynamics 365": not the page for "dynamics 365 partner dubai")
      const ws = tt.filter(t => !kindStems.has(t) && !/^(?:19|20)\d\d$/.test(t)).map(t => [t, wOf(t)]);
      const maxW = ws.reduce((mx, x) => Math.max(mx, x[1]), 0);
      const rarestOwn = ws.some(([t, w]) => core.includes(t) && w + 1e-9 >= maxW);
      const ok = allCore && share + 1e-9 >= MATCH_MIN && (rarestOwn || focus > 0.67 + 1e-9);
      const said = uniq(tokensOf(norm(c.text)).filter(w => extra.includes(stem(w))));   // the page's own words, not their stems, for the reason
      const r = { ok, by: c.by, text: c.text, focus: Math.round(focus * 100) / 100, share: Math.round(share * 100) / 100, extra: said.length ? said : extra };
      if (!best || (r.ok && !best.ok)) best = r;   // the first text read (the title before the searches) explains a refusal
      if (ok) break;
    }
    if (!best) return { ok: false, by: '', text: '', evidence: '', why: 'the title and searches of ' + shortUrl + ' say nothing about this search' };
    if (best.ok) return { ok: true, by: best.by, text: best.text, evidence: best.by + ' "' + best.text + '" is about this search', why: '' };
    return { ok: false, by: best.by, text: best.text, evidence: '',
      why: best.by + ' "' + best.text + '" is about ' + (best.extra.length ? best.extra.map(t => '"' + t + '"').join(' and ') : 'something else') + ', not this search, so ' + shortUrl + ' is not the page for it' };
  };
  // R34: the pages whose title was never read, so a caller can say what it judged on the address alone instead of reading nothing silently
  const titleGap = (model) => { const all = pages(model); const u = untitled(model);
    return { pages: all.length, untitled: u.length, urls: u.slice(0, 12).map(p => p.url),
      note: u.length ? u.length + ' of the ' + all.length + ' pages of the site have no title on file yet (the weekly site check reads them a batch at a time), so they were judged by their address only' : '' }; };
  // R55: a URL of the site as the site serves it (canonical host); another site's URL is returned as it is
  const canonUrl = (model, u) => { const h = hostOf(u); if (!h || bare(h) !== bare((model || {}).domain || (model || {}).canonical_host || '')) return S(u); return siteUrl(model, pathOf(u)); };
  // D11: a stored seo_pages row carries its queries as the JSON string `queries_json`, so both shapes are accepted here
  const queriesOf = (p) => Array.isArray(p.queries) ? p.queries : (jparse(p.queries_json, []) || []);
  const withPages = (model, more) => ({ ...model, pages: (() => { const seen = new Set(); const out = [];
    for (const p of [...pages(model), ...(Array.isArray(more) ? more : [])]) { const u = S(p.url); if (!u) continue; const k = pathOf(u).replace(/\/$/, '').toLowerCase();
      if (seen.has(k)) { const old = out.find(o => pathOf(o.url).replace(/\/$/, '').toLowerCase() === k); if (old) { old.title = old.title || S(p.title); old.h1 = old.h1 || S(p.h1); old.lastmod = old.lastmod || S(p.lastmod); const q = queriesOf(p); if (q.length) old.queries = q;
        // RV-1: the newest reading of the address wins (a page that came back after a redirect was added is live again)
        if ((Number(p.http_status) || 0) && S(p.status_at) >= S(old.status_at)) { old.http_status = Number(p.http_status) || 0; old.status_at = S(p.status_at); } } continue; }
      seen.add(k); out.push({ url: u, title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries: queriesOf(p), http_status: Number(p.http_status) || 0, status_at: S(p.status_at) }); }
    return out; })() });
  // the model exactly as it was stored (seo_sites row or a seo_cache value), with its own timestamp -- never "now", so isFresh() is honest
  const stored = (row) => { const r = (row && typeof row === 'object') ? row : {}; return (S(r.canonical_host) || S(r.model_updated_at)) ? from(r, {}) : null; };
  const FRESH_DAYS = 7;
  const ageDays = (model) => { const t = Date.parse(S((model || {}).model_updated_at)); return Number.isFinite(t) ? (Date.now() - t) / 864e5 : Infinity; };
  const isFresh = (model, days) => !!(model && S(model.canonical_host) && ageDays(model) < (Number(days) > 0 ? Number(days) : FRESH_DAYS));
  // exactly the seo_sites columns the model owns (plus the two keys), ready to merge into a site row or a cache value
  const COLUMNS = ['site_id', 'domain', 'canonical_host', 'business_name', 'logo_url', 'nap_json', 'services_json', 'nav_pages_json', 'business_facts', 'cta', 'brand_names', 'competitors', 'accreditation', 'model_updated_at', 'declared_services'];
  const toRow = (model) => { const m = model || {};
    return { site_id: S(m.site_id), domain: S(m.domain), canonical_host: S(m.canonical_host), business_name: S(m.business_name), logo_url: S(m.logo_url),
      nap_json: JSON.stringify(nap(m)), services_json: JSON.stringify(services(m)), nav_pages_json: JSON.stringify((m.nav_pages || []).map(p => ({ url: p.url, title: p.title }))),
      business_facts: S(m.business_facts).slice(0, 2000), cta: S(m.cta).slice(0, 200), brand_names: (m.brand_names || []).join(', ').slice(0, 500),
      competitors: (m.competitors || []).join(', ').slice(0, 500), accreditation: S(m.accreditation).slice(0, 200), model_updated_at: S(m.model_updated_at),
      declared_services: JSON.stringify(Array.isArray(m.declared_services) ? m.declared_services : []) };
  };
  // B4-1 / B4-2 (2026-10-15, benchmark area 4): the measurement columns belong to the row, so the kit emits them — a Data Table
  // node auto-maps every field it is given, and a row that is short of a column is as wrong as one that carries a stray field.
  // The model itself measures nothing: these are the defaults the Site Tracker's own judgement is written over
  // (v5/code/Page_Inventory_Site.js), and `''` for decay_state means "never measured", never "steady".
  const num0 = (v) => (Number(v) || 0);
  const pageRows = (model) => pages(model).map(p => ({ site_id: S((model || {}).site_id), url: S(p.url), title: S(p.title).slice(0, 300), h1: S(p.h1).slice(0, 300),
    source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries_json: JSON.stringify(p.queries || []), updated_at: S((model || {}).model_updated_at) || new Date().toISOString(),
    clicks: num0(p.clicks), impressions: num0(p.impressions), position: num0(p.position), prev_clicks: num0(p.prev_clicks), yoy_clicks: num0(p.yoy_clicks),
    decay_state: S(p.decay_state), decay_pct: num0(p.decay_pct), decay_lost: num0(p.decay_lost), decay_kind: S(p.decay_kind),
    decay_basis: S(p.decay_basis).slice(0, 900), measured_at: S(p.measured_at),
    http_status: num0(p.http_status), status_at: S(p.status_at) }));   // RV-1: what the address answered when it was last read (0 = not read)
  // ---- C-7 (re-rating 2026-10-17): ONE page state per keyword, read by the Rank Tracker AND the Site Tracker (and so by the cadence) ----
  // In one morning the Rank Tracker said of "ai consulting" "…/ai-copilot-advisory-uae already answers this search - refresh that page"
  // while the Site Tracker said "fix the four drafts that failed the quality check and run them again", and of "it consulting dubai"
  // "write the main page" while the Site Tracker and the cadence said "written today, failed QA, fix it". The order of evidence is one:
  // a LIVE page of the site that answers the search wins (refresh it; a draft written for the search is retired, never a second page);
  // then a written draft (publish it); then a draft that failed its quality check (fix it and run it again); then a run that wrote nothing.
  // in: { keyword, covered_url, written, not_ready, reasons (array or '; ' text), started } -> { state, text } (text: the parenthesis a list uses)
  const pageStep = (o) => {
    const c = o || {}, kw = S(c.keyword), why = (Array.isArray(c.reasons) ? c.reasons : S(c.reasons).split(/;\s+/)).map(S).filter(Boolean).slice(0, 2).join('; ').slice(0, 220);
    if (S(c.covered_url)) return { state: 'covered', text: S(c.covered_url) + ' already answers this search — refresh that page, do not publish a second one'
      + (c.not_ready || c.written ? '; the draft written for "' + kw + '" is not needed (use its text to refresh that page)' : '') };
    if (c.written) return { state: 'written', text: 'already written — publish it' };
    if (c.not_ready) return { state: 'not_ready', text: 'written, but the draft did not pass the quality check' + (why ? ' (' + why + ')' : '') + ' — fix it and run it again; do not publish it as it is' };
    if (c.started) return { state: 'started', text: 'a page run was started for it but no page was written — it is written again' };
    return { state: 'planned', text: '' };
  };
  return { from, stored, siteUrl, apiTarget, name, nap, services, pages, facts, matchPage, pageMatch, MATCH_CONF, withPages, toRow, pageRows, COLUMNS, isFresh, ageDays, FRESH_DAYS, MATCH_MIN,
    titleShare, titleGap, canonUrl, isListing, pageScore, pageStep, isGone, isMoved, gonePages, confirmPage,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml, matchTerms, coreTerms } };
})();
// ---- fit gate (2026-10-11, FIX_PLAN D4 / D8): ONE rule for keywords that no page of this website should target. Inlined by the build
// (the FIT_GATE placeholder) into Analyze Keywords (full report: keyword gap, easy wins, opportunities), Rank Keywords (discovery), Ladder Pool /
// Ladder Plan (ladder rungs and the main keyword), Relevance Chunks (the brands the AI screen is told about) and Brief Context (the hub
// page's cluster list); a copy goes to harness/code_v4/_fit_gate.js as a shim (S34). fitGate(keyword, ctx) -> { ok: true } or
// { ok: false, reason, detail } with reason one of:
//   'own brand'    — the keyword names the website itself (its domain label, 4+ letters);
//   'navigational' — DataForSEO Labs says the intent is navigational (ctx.intent);
//   'government'   — the keyword is a public body or an identity document and nothing else (FTA, EmaraTax, MoHRE, GDRFA, ICP, RTA, DEWA,
//                    ZATCA, GOSI, "ministry …", "… authority", Emirates ID, UAE Pass, visa / labour card status …), or a body with a portal /
//                    status word ("fta portal", "emirates id status"), or, with its results page in hand (ctx.serp), 3+ of the top 5 results
//                    are on government hosts (.gov / .gov.xx / .gouv.xx / u.ae …);
//   'portal'       — a login / portal / password / status check / renewal / verification / application task: people want the owner's own site;
//   'off topic'    — with topics on file (ctx.topics, R13): under a quarter of the keyword's own words have anything to do with what the
//                    site sells ("character ai", "mofa attestation dubai", "mh enterprises uae");
//   'too broad'    — with topics on file: nothing but generic or place words is left of it ("ai", "google ai", "microsoft ai");
//   'other brand'  — one of its words is the label of a declared competitor (cleartax.com ↔ "cleartax"), of a domain on the results page
//                    (facts.ae ↔ "facts"), or a brand name AI uses for another company (seo_cache ai_brands: name -> domain); with the
//                    keyword's own results page in hand also when one domain whose label is in the keyword holds 3+ of the top 5.
// Bounds, so that legitimate keywords survive:
//   * a public body with a topic word is a topic, not a destination: "zatca e invoicing", "fta vat registration", "mohre wps" are kept — only
//     the body alone (plus country words) or with a portal / status word is refused;
//   * a portal word with a content / buying word is kept ("best erp software with mobile login", "emaratax registration guide"); a plain
//     category noun is not enough ("erp software login" is still a login);
//   * a results-page or AI-named brand with a partner-type word ("sap implementation dubai", "microsoft dynamics 365 partner uae") or a
//     comparison word ("facts erp vs odoo") is kept; a declared competitor is kept only when compared ("cleartax vs zoho"); a results-page
//     label (often a dictionary word) counts only where a product name sits — first, or right before a category word ("facts erp", not
//     "erp facts and figures guide");
//   * a domain label shorter than 4 letters, a word of the keyword being researched (ctx.protect: head term / seeds / services) or a generic
//     word (erp, software, tax …) never counts as a brand; "www", "m", "app" prefixes are dropped before the label is taken.
// Relevance to the website's services is NOT judged here. ctx.relevance (FIX_PLAN G19) is the hook: a function (keyword) -> { ok, reason,
// detail } called last, so the first version of G19 plugs in without touching the callers.
const FIT_CFG = { min_label: 4, serp_top: 5, serp_hold: 3 };
const FIT_STOP = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'my', 'your', 'our', 'is', 'are', 'what', 'how', 'me']);
const FIT_GEO = new Set(['uae', 'u.a.e', 'dubai', 'abu', 'dhabi', 'sharjah', 'ajman', 'fujairah', 'ras', 'al', 'khaimah', 'umm', 'quwain', 'emirates', 'gcc', 'saudi', 'arabia', 'ksa', 'riyadh', 'jeddah', 'qatar', 'doha', 'oman', 'muscat', 'bahrain', 'kuwait', 'egypt', 'india', 'pakistan', 'uk', 'usa', 'us', 'online', 'portal',
  // KW-GATE (2026-10-21): regions and the markets e-invoicing and ERP searches name ("e invoicing europe", "belgium", "bpo company in middle east")
  'middle', 'east', 'mena', 'emea', 'apac', 'europe', 'european', 'eu', 'africa', 'asia', 'belgium', 'germany', 'france', 'netherlands', 'italy', 'spain', 'portugal', 'poland', 'austria',
  'switzerland', 'ireland', 'luxembourg', 'denmark', 'sweden', 'norway', 'finland', 'greece', 'singapore', 'malaysia', 'australia', 'zealand', 'canada', 'japan', 'china', 'turkey', 'jordan', 'lebanon',
  'morocco', 'nigeria', 'kenya', 'london', 'england', 'britain', 'america', 'states', 'united', 'world', 'worldwide', 'global']);
// R13 (2026-10-13): 'ai' joined this list — it is a category word, not a topic. With it in, "ai" (165,000/mo) and "google ai" are left with
// nothing of their own ("too broad") while "character ai", "humanize ai", "meta ai" and "blackbox ai" are judged on the word that is really
// theirs; a keyword that names a service of the site ("ai automation uae") still matches on that service's own words.
const FIT_GENERIC = new Set(['ai', 'software', 'softwares', 'services', 'service', 'erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'tax', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll', 'finance', 'financial', 'cloud', 'digital', 'online', 'web', 'data', 'tech', 'technology', 'technologies', 'solutions', 'solution', 'systems', 'system', 'business', 'company', 'group', 'global', 'international', 'gulf', 'arab', 'arabia', 'emirates', 'national', 'consulting', 'consultants', 'consultancy', 'partners', 'partner', 'network', 'news', 'blog', 'guide', 'guides', 'info', 'best', 'top', 'free', 'app', 'apps', 'shop', 'store', 'market', 'media', 'academy', 'institute', 'university', 'school', 'bank', 'pay', 'pro', 'plus', 'hub', 'one', 'first', 'smart', 'easy', 'get', 'go', 'ae', 'com', 'net', 'org', 'home', 'house', 'world', 'city', 'daily', 'times', 'post', 'review', 'reviews', 'compare', 'comparison', 'list', 'directory', 'jobs', 'careers', 'businesses', 'companies', 'firms', 'wiki', 'wikipedia', 'youtube', 'linkedin', 'facebook', 'instagram', 'twitter', 'reddit', 'quora', 'medium', 'google', 'microsoft', 'amazon', 'apple']);
const FIT_GOV_WORDS = /\b(ministry|ministries|authority|authorities|federal|government|govt|municipality|municipal|embassy|consulate|police|courts?|customs|immigration|department of|public prosecution|parliament|chamber of commerce|free zone authority)\b/;
// KW-GATE (2026-10-21): other countries' tax and identity bodies too ("hmrc vat login" was a plain portal refusal, not a government one)
const FIT_GOV_NAMES = /\b(hmrc|irs|cra|ato|finanzamt|elster|agenzia entrate|belastingdienst|skatteverket|spf finances|dgfip|impots\.gouv|fta|emaratax|emara ?tax|tax authority|mohre|mohap|mofa|moec|gdrfa|icp|ica|rta|dewa|sewa|fewa|addc|aadc|dha|doh|ded|tdra|adjd|ejari|dubai land department|dld|dubai economy|dubai courts|zatca|gazt|gosi|qiwa|absher|muqeem|mudad|hrsd|misa|nafath|tawtheeq|uae pass|smart pass|amer cent(er|re)|tasheel|tawjeeh|emirates id|emirates identity|national id|i ?d card|identity card|labou?r card|work permit status|visa status|visa check|passport status|establishment card|golden visa status|trn verification|trn check|trn lookup|tax registration number check)\b/;
const FIT_PORTAL = /\b(log ?in|logins|sign ?in|sign ?up|password|passwords|portal|portals|e ?services?|customer care|customer service number|helpline|toll ?free|contact number|phone number|status|status check|check status|status enquiry|application status|track(ing)? (status|application|order)|renewal|renew|verification|verify|apply online|online application|download (the )?app|app download|complaint|complaints|fine check|traffic fines?|balance check|otp)\b/;
// content / buying words that turn a portal or government query into a topic ("best erp software with mobile login", "emaratax registration guide");
// plain category nouns (software, system, services …) do not — "erp software login" is still a login
const FIT_CONTENT = /\b(best|top|vs|versus|compar(e|ison)|review|reviews|alternatives?|how to|guide|guides|checklist|requirements?|pricing|price|prices|cost|costs|quote|quotes|hire|consultan(t|ts|cy|cies)|consulting|partner|partners|provider|providers|vendor|vendors|agency|agencies|accredited|approved|certified|compliant|compliance|implementation|integration|integrations|training|course|courses|template|templates|examples?|explained|meaning|benefits|registration|register|filing|return|returns|refund|refunds|deadline|deadlines|penalt(y|ies)|rules?|regulations?|free trial|demo|tutorial|steps|process|procedure)\b/;
const FIT_PARTNER = /\b(partner|partners|partnership|reseller|resellers|implementation|implement|implementer|implementers|consultan(t|ts|cy|cies)|consulting|integration|integrations|integrate|migration|migrate|support|training|developer|developers|development|customi[sz]ation|customi[sz]e|add-?ons?|plugins?|specialist|specialists|expert|experts|agency|agencies|services?)\b/;
// R60: the words of a public body's own service to a person (with FIT_GOV_NAMES only): nothing a business sells is left once they are taken out
const FIT_GOV_SERVICE = /^(attestation|attestations|attest|attested|legali[sz]ation|legali[sz]e|apostille|notari[sz]ation|passport|passports|visa|visas|residency|iqama|renewal|renew|renewing|fines?|penalty|appointment|appointments|booking|stamp|stamping|medical|fitness|typing|cancellation|cancel|replacement|lost|reprint|fees?|charges?|timings?|working|hours|office|offices|centre|center|centres|centers|near|location|locations|track|tracking|apply|application|form|forms|download|print|copy|expiry|expired|validity|valid|enquiry|inquiry|document|documents|certificate|certificates|degree|degrees|diploma|marriage|birth|educational|personal)$/;
// B-3 (2026-10-17, re-rating 2026-10-17, exec 767): the same refusal WITHOUT a body's name. "mofa attestation dubai" was refused but "uae document
// attestation" and "mofa document attestation" were offered as keyword-gap targets under a High finding: attesting, legalising or notarising a
// person's document is a public service whatever words surround it. A keyword whose own words are such a service word plus document / service
// words is refused as 'government'; "attestation software" or "document attestation management system" keep a product word and stay.
const FIT_DOC_SERVICE = /^(attestation|attestations|attest|attested|attesting|apostille|legali[sz]ation|legali[sz]e|notari[sz]ation|notari[sz]e|notary)$/;
// B-3: a person looking for work is not a buyer ("finance jobs in uae", "finance manager jobs in uae" were offered as easy wins). A job word with no
// product word ("recruitment software", "hr jobs portal system") is refused as 'job search'.
const FIT_JOBS = /\b(jobs?|careers?|vacanc(y|ies)|salary|salaries|internships?|walk ?in interviews?|job openings?|cv|resume)\b/;
const FIT_COURSE_ONLY = /\b(courses?|bootcamps?|diploma|degree|syllabus|exam|exams|dumps|study material)\b/;
const FIT_PRODUCT = /\b(software|system|systems|platform|platforms|tool|tools|app|apps|module|modules|solution|solutions|crm|erp|hrms|hcm|ats|portal software)\b/;
// B-3: words common enough in English that, lifted out of a longer service NAME, they say nothing about the topic: "intelligent" out of
// "Intelligent Document Processing" let "intelligent software solutions" (another company's name) through; "management" out of "Supply Chain
// Management" let "top facilities management companies uae" through; "commerce" out of "Dynamics 365 Commerce" let "commercial companies law
// uae" through. Such a word counts as on topic only when the keyword carries the whole name, or at least two of its words (fitTopic).
const FIT_COMMON = new Set(['management', 'manager', 'document', 'documents', 'processing', 'process', 'processes', 'intelligent', 'intelligence', 'central', 'operations', 'operation', 'operational',
  'project', 'projects', 'field', 'customer', 'customers', 'client', 'clients', 'sales', 'human', 'resources', 'resource', 'commerce', 'commercial', 'supply', 'chain', 'identity', 'model', 'models',
  'predictive', 'virtual', 'desktop', 'studio', 'builder', 'factory', 'pipeline', 'pipelines', 'modernization', 'modernisation', 'enterprise', 'enterprises', 'advanced', 'modern', 'integrated',
  'unified', 'professional', 'premium', 'standard', 'basic', 'core', 'general', 'public', 'private', 'social', 'mobile', 'facility', 'facilities', 'experience', 'insights', 'transformation',
  'innovation', 'value', 'impact', 'productivity', 'efficiency', 'assets', 'asset', 'people', 'team', 'teams', 'growth', 'performance']);
const FIT_COMPARE = /\b(vs|versus|compare|comparison|alternatives?|instead of|better than|difference between|against)\b/;
// F-KW (2026-10-20, finding 8): letters and digits of EVERY script, not a-z only. An Arabic keyword ("برنامج محاسبة في الإمارات") was
// no tokens at all, so a ladder the client chose in Arabic was set aside as `empty` and every Arabic item key was ''. NFKC folds
// full-width and compatibility forms, toLowerCase (never the locale form) folds case; marks (\p{M}) stay inside their word.
const FIT_SPLIT = /[^\p{L}\p{M}\p{N}.]+/u, FIT_SPLIT_WORDS = /[^\p{L}\p{M}\p{N}]+/u;
const fitLow = (s) => String(s || '').normalize('NFKC').toLowerCase();
// KWL-RES D2 (2026-10-21 live keyword test, exec 111): "artificial intelligence consultancy" (170/mo, KD 5) was judged "not one of the services
// you listed" while "AI consulting" was the first service declared: the topic words never read "artificial intelligence" as "ai". fitSyn writes
// one spelling for the same thing, and the topic paths run it on BOTH sides (the keyword and the client's services / topics), so it can only
// make two spellings of one subject agree. An acronym the rules already treat as a category ("ai", "erp", "crm") is the canonical form; "ml"
// and "bi" are written out (a two-letter word is never a topic word on its own); advisory and advisor read as "consultant"; every spelling
// of e-invoicing reads as "e invoicing" (so "invoicing" stays a word of it).
const FIT_SYNONYMS = [[/\bartificial[\s-]+intelligence\b/g, 'ai'], [/\bcustomer[\s-]+relationship[\s-]+management\b/g, 'crm'], [/\benterprise[\s-]+resource[\s-]+planning\b/g, 'erp'],
  [/\bml\b/g, 'machine learning'], [/\bbi\b/g, 'business intelligence'],
  [/\b(?:advisory|advisors?|advisers?)\b/g, 'consultant'],   // consultancy, consulting and consultant already agree (one stem, "consult"); a consultant word stays a word of its own ("hire ai consultant dubai")
  [/\b(?:e[\s-]?|electronic[\s-]+)(invoic\w*)/g, 'e $1'],
  // N1 (KW recheck 2026-10-21, exec 149): "d365 cloud migration uae" was out for a Dynamics 365 partner: d365 is how buyers write Dynamics 365
  [/\b(?:d365|dynamics365|ms ?d365)\b/g, 'dynamics 365']];
const fitSyn = (s) => FIT_SYNONYMS.reduce((t, [re, to]) => t.replace(re, to), String(s || '').normalize('NFKC').toLowerCase());
const fitTokens = (s) => fitLow(s).replace(/[’']/g, '').split(FIT_SPLIT).map(t => t.replace(/^\.+|\.+$/g, '')).filter(t => t.length > 1 && !FIT_STOP.has(t));
const fitHost = (d) => String(d || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^(www|m|app|en|ar)\./, '');
const fitGovHost = (d) => { const h = fitHost(d); return /(^|\.)gov(\.[a-z]{2,3})?$/.test(h) || /(^|\.)(gouv|gob|go|gv)\.[a-z]{2}$/.test(h) || /(^|\.)mil(\.[a-z]{2})?$/.test(h) || /(^|\.)(u\.ae|government\.ae|dubai\.ae|abudhabi\.ae|sharjah\.ae|ajman\.ae|rak\.ae|tax\.gov\.ae|europa\.eu)$/.test(h); };
// the brand label(s) of a domain: "facts.ae" -> ["facts"], "northwind-erp.com" -> ["northwind"] (generic / short parts dropped), "e-invoicing.ae" -> []
const fitLabels = (domain, protect) => { const h = fitHost(domain); if (!h) return []; const first = h.split('.')[0]; const parts = [...new Set([first, ...first.split(/[-_]/)])];
  return parts.map(p => p.replace(/[^a-z0-9]/g, '')).filter(p => p.length >= FIT_CFG.min_label && !FIT_GENERIC.has(p) && !FIT_GEO.has(p) && !(protect || []).includes(p)); };
// F-KW (2026-10-20, finding 5): a label is the website's own BRAND only when it is distinctive. A label that splits entirely into category,
// generic or place words, or into the words of the keyword or of what the client protected (its ladder heads, its services), describes what
// the site sells ("erp-software.ae", "crmexperts.ae", "accountingsoftware.ae", "interiordesign-dubai.com"); it is not a name, and a keyword
// built from those words is the client's own subject. "techand" does not split ("tech" + the stop word "and" is not allowed), so "techand crm"
// stays the site's own brand. The label itself is never part of its own vocabulary, so "crmexperts reviews" (one word) is still the brand.
const FIT_CATEGORY = new Set(['expert', 'experts', 'specialist', 'specialists', 'consultant', 'advisor', 'advisors', 'advisory', 'agency', 'agencies', 'design', 'designs', 'designer', 'designers',
  'interior', 'interiors', 'outsourcing', 'marketing', 'seo', 'legal', 'law', 'lawyer', 'lawyers', 'clinic', 'clinics', 'dental', 'medical', 'health', 'care', 'realty', 'property', 'properties', 'homes',
  'travel', 'tours', 'logistics', 'cargo', 'shipping', 'trading', 'auto', 'autos', 'cars', 'motors', 'insurance', 'printing', 'events', 'cleaning', 'maintenance', 'security', 'training', 'courses',
  'implementation', 'integration', 'migration', 'support', 'hosting', 'it', 'hr', 'audit', 'auditing', 'bookkeeping', 'consult', 'advice', 'pros', 'works', 'labs', 'studio', 'studios',
  'center', 'centre', 'source', 'point', 'zone', 'link', 'links', 'line', 'now', 'hq', 'co', 'inc', 'llc', 'ltd', 'fz', 'fzco', 'fze', 'dmcc']);
const fitWordBreak = (label, vocab) => { const n = label.length; const ok = new Array(n + 1).fill(false); ok[0] = true;
  for (let i = 1; i <= n; i++) for (let j = Math.max(0, i - 30); j < i; j++) if (ok[j] && vocab.has(label.slice(j, i))) { ok[i] = true; break; }
  return ok[n]; };
const fitOwnLabels = (domain, toks, protect) => fitLabels(domain, []).filter(l => {
  const words = [...FIT_GENERIC, ...FIT_GEO, ...FIT_CATEGORY, ...(toks || []), ...(protect || [])].map(w => String(w || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(w => w.length >= 2 && w !== l && !FIT_STOP.has(w));
  const vocab = new Set(); for (const w of words) { vocab.add(w); vocab.add(w + 's'); if (w.length > 3 && w.endsWith('s')) vocab.add(w.slice(0, -1)); }
  vocab.delete(l);
  return !fitWordBreak(l, vocab); });
// the learned "name -> domain" map from seo_cache rows (key ai_brands:<site_id>), any shape of row list
const fitLearnedBrands = (rows) => { const out = {}; for (const r of (rows || [])) { const j = r && r.json ? r.json : r; if (!j || typeof j !== 'object' || !/^ai_brands:/.test(String(j.key || ''))) continue; let v = j.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } if (v && typeof v === 'object') for (const [name, d] of Object.entries(v)) if (name && d) out[String(name)] = String(d); } return out; };
// the organic domains of a DataForSEO SERP answer, in rank order (for ctx.serp)
// ---- KW-GATE (2026-10-21, keyword accuracy set: in recall 54%): Arabic keywords are READ, not guessed ----
// Every Arabic keyword was "0% of its own words match" (the topics are English), so "استشارات الذكاء الاصطناعي في دبي" (AI consulting in Dubai)
// was refused as off topic and "وظائف الذكاء الاصطناعي في دبي" (AI jobs in Dubai) was refused for the wrong reason. The keyword is normalised
// (alef forms, ta marbuta, alef maqsura, hamza seats, diacritics, tatweel, Arabic digits), split, its article / prefixes taken off, and the
// common search words are mapped to the English words the rules below already judge, through a small glossary (phrases first). No
// machine translation call. A word the glossary does not know stays as it is (fitTopic treats it as unread, not as evidence either way).
const FIT_AR = /[؀-ۿ]/;
const FIT_AR_PHRASES_SRC = [['ذكاء اصطناعي', 'ai'], ['فاتوره الكترونيه', 'e invoicing'], ['فواتير الكترونيه', 'e invoicing'], ['فوتره الكترونيه', 'e invoicing'],
  ['فوتره', 'invoicing'], ['ضريبه قيمه مضافه', 'vat'], ['قيمه مضافه', 'vat'], ['تخطيط موارد موسسات', 'erp'], ['تخطيط موارد', 'erp'], ['موارد بشريه', 'hr'],
  ['اداره علاقات عملاء', 'crm'], ['علاقات عملاء', 'crm'], ['هويه اماراتيه', 'emirates id'], ['بطاقه هويه', 'id card'], ['وزاره خارجيه', 'ministry of foreign affairs'],
  ['هيئه اتحاديه للضرائب', 'fta'], ['هيئه اتحاديه ضرائب', 'fta'], ['تعلم اله', 'machine learning'], ['ابو ظبي', 'abu dhabi'], ['راس خيمه', 'ras al khaimah'],
  ['خدمه عملاء', 'customer service'], ['تسجيل دخول', 'login'], ['سيره ذاتيه', 'cv'], ['عن بعد', 'remote']];
const FIT_AR_WORDS_SRC = { 'استشارات': 'consulting', 'استشاره': 'consulting', 'استشاري': 'consulting', 'استشاريه': 'consulting', 'مستشار': 'consultant', 'مستشارين': 'consultants', 'مستشارون': 'consultants',
  'شركه': 'company', 'شركات': 'companies', 'مكتب': 'firm', 'برنامج': 'software', 'برامج': 'software', 'نظام': 'system', 'انظمه': 'systems', 'حلول': 'solutions', 'خدمات': 'services',
  'خدمه': 'service', 'تطبيق': 'app', 'تطبيقات': 'apps', 'منصه': 'platform', 'اتمته': 'automation', 'ذكاء': 'intelligence', 'اصطناعي': 'artificial', 'فاتوره': 'invoice', 'فواتير': 'invoices',
  'الكترونيه': 'electronic', 'الكتروني': 'electronic', 'ضريبه': 'tax', 'ضرائب': 'tax', 'ضريبي': 'tax', 'محاسبه': 'accounting', 'محاسبي': 'accounting', 'محاسب': 'accountant', 'محاسبين': 'accountants',
  'راتب': 'salary', 'رواتب': 'salary', 'وظائف': 'jobs', 'وظيفه': 'job', 'توظيف': 'recruitment', 'دوره': 'course', 'دورات': 'courses', 'تدريب': 'training', 'شهاده': 'certificate', 'شهادات': 'certificates',
  'تصديق': 'attestation', 'توثيق': 'attestation', 'تجديد': 'renewal', 'هويه': 'id', 'تاشيره': 'visa', 'اقامه': 'residency', 'جواز': 'passport', 'حكومه': 'government', 'حكومي': 'government',
  'حكوميه': 'government', 'وزاره': 'ministry', 'هيئه': 'authority', 'بوابه': 'portal', 'تسجيل': 'registration', 'دخول': 'login', 'سعر': 'price', 'اسعار': 'prices', 'تكلفه': 'cost', 'افضل': 'best',
  'اكبر': 'top', 'مايكروسوفت': 'microsoft', 'دايناميكس': 'dynamics', 'داينامكس': 'dynamics', 'ديناميكس': 'dynamics', 'كوبايلوت': 'copilot', 'سيلزفورس': 'salesforce', 'ساب': 'sap',
  'اوراكل': 'oracle', 'نتسويت': 'netsuite', 'اودو': 'odoo', 'دبي': 'dubai', 'امارات': 'uae', 'اماراتي': 'uae', 'اماراتيه': 'uae', 'ابوظبي': 'abu dhabi', 'شارقه': 'sharjah', 'عجمان': 'ajman',
  'سعوديه': 'saudi', 'رياض': 'riyadh', 'جده': 'jeddah', 'قطر': 'qatar', 'دوحه': 'doha', 'مصر': 'egypt', 'كويت': 'kuwait', 'بحرين': 'bahrain', 'عمان': 'oman', 'خليج': 'gcc',
  'كيف': 'how to', 'ماهي': 'what is', 'ماهو': 'what is', 'ما': 'what', 'هو': '', 'هي': '', 'في': '', 'من': '', 'على': '', 'الى': '', 'عن': '', 'مع': 'with', 'او': '', 'و': '',
  'مبيعات': 'sales', 'بيع': 'sales', 'ماليه': 'finance', 'مالي': 'finance', 'اعمال': 'business', 'سحابه': 'cloud', 'سحابي': 'cloud', 'بيانات': 'data', 'امن': 'security', 'سيبراني': 'cyber',
  'تسويق': 'marketing', 'موقع': 'website', 'عقارات': 'real estate', 'تصنيع': 'manufacturing', 'مخزون': 'inventory', 'تنفيذ': 'implementation', 'شريك': 'partner', 'شركاء': 'partners',
  'مرخص': 'certified', 'معتمد': 'certified', 'معتمده': 'certified', 'متطلبات': 'requirements', 'دليل': 'guide', 'مقارنه': 'comparison', 'مجاني': 'free', 'تحميل': 'download' };
const fitArNorm = (s) => String(s || '').normalize('NFKC').replace(/[ً-ٰٟۖ-ۭ]/g, '').replace(/ـ/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
// the glossary in the same normal form as the keyword (so "وظائف" and "وظايف", "شركة" and "شركه" are one word)
const FIT_AR_WORDS = Object.fromEntries(Object.entries(FIT_AR_WORDS_SRC).map(([k, v]) => [fitArNorm(k), v]));
const FIT_AR_PHRASES = FIT_AR_PHRASES_SRC.map(([k, v]) => [fitArNorm(k), v]);
// the article and the one-letter prefixes glued to it ("الامارات", "بالامارات", "للشركات"); a word of 3 letters or less is never cut
const fitArStem = (w) => { if (FIT_AR_WORDS[w] !== undefined) return w; const m = w.match(/^(?:وال|بال|كال|فال|لل|ال)(.{2,})$/); if (m && m[1].length >= 2) return m[1];
  const v = w.match(/^و(.{3,})$/); return v && FIT_AR_WORDS[v[1]] !== undefined ? v[1] : w; };
// "استشارات الذكاء الاصطناعي في دبي" -> { text: "consulting ai dubai", read: true, unread: [] }; an English keyword comes back unchanged
const fitArabic = (s) => {
  const raw = String(s || '');
  if (!FIT_AR.test(raw)) return { text: raw, read: false, unread: [] };
  const toks = fitArNorm(raw).split(/[^\p{L}\p{M}\p{N}.&]+/u).filter(Boolean).map(t => FIT_AR.test(t) ? fitArStem(t) : t.toLowerCase());
  const out = [], unread = [];
  for (let i = 0; i < toks.length;) {
    let hit = null;
    for (const [p, en] of FIT_AR_PHRASES) { const pw = p.split(' '); if (pw.length > 1 && pw.every((w, j) => toks[i + j] === w)) { hit = [pw.length, en]; break; } }
    if (hit) { out.push(hit[1]); i += hit[0]; continue; }
    const t = toks[i++];
    if (!FIT_AR.test(t)) { out.push(t); continue; }
    const one = FIT_AR_PHRASES.find(([p]) => p === t);
    if (one) { out.push(one[1]); continue; }
    if (FIT_AR_WORDS[t] !== undefined) { if (FIT_AR_WORDS[t]) out.push(FIT_AR_WORDS[t]); continue; }
    out.push(t); unread.push(t);
  }
  return { text: out.join(' ').replace(/\s+/g, ' ').trim(), read: true, unread };
};
// ---- MKT (2026-10-27, docs/mismatch-audit-2026-10-27/AUDIT.md §2.4, M4 / M5 / M7): WHERE a keyword or a text points ----
// FIT_GEO above says only "this word is a place", so "ai automation solutions gcc" for a Pakistan website passed as "in your market". The
// gazetteer attaches countries (ISO-2) to the place words: a country, its people, its capital and largest cities; a region is the set of its
// countries. One table for the engine (fitGate's `ctx.market`) and the app (shared/src/markets.ts imports it through fit-gate.generated.js).
// Never the bare word "us"; demonyms that are also languages (german, french, spanish, italian, dutch, english) are not places
// ("spanish translation services" is not about Spain); "online", "near me", "global", "worldwide" are not places.
const FIT_PLACES_SRC = [
  ['AE', 'uae|united arab emirates|emirates|emirati|dubai|abu dhabi|sharjah|ajman|fujairah|ras al khaimah|umm al quwain|al ain'],
  ['SA', 'saudi|saudi arabia|ksa|riyadh|jeddah|dammam|khobar|al khobar|mecca|makkah|medina|madinah'],
  ['PK', 'pakistan|pakistani|lahore|karachi|islamabad|rawalpindi|faisalabad|multan|peshawar|quetta|sialkot|gujranwala'],
  ['IN', 'india|indian|delhi|new delhi|mumbai|bangalore|bengaluru|chennai|pune|kolkata|ahmedabad|noida|gurgaon|gurugram'],
  ['IN PK', 'hyderabad'],
  ['GB', 'uk|united kingdom|britain|great britain|british|england|scotland|wales|london|manchester|birmingham|leeds|glasgow|edinburgh'],
  ['US', 'usa|united states|united states of america|new york|nyc|california|texas|florida|chicago|los angeles|san francisco|houston|seattle|boston'],
  ['CA', 'canada|canadian|ottawa|toronto|montreal|vancouver|calgary'],
  ['AU', 'australia|australian|canberra|sydney|melbourne|brisbane'],
  ['NZ', 'new zealand|wellington|auckland|christchurch'],
  ['IE', 'ireland|irish|dublin|galway|limerick'],
  ['SG', 'singapore|singaporean'],
  ['ZA', 'south africa|south african|pretoria|johannesburg|cape town|durban'],
  ['DE', 'germany|deutschland|berlin|hamburg|munich|cologne|frankfurt'],
  ['FR', 'france|paris|marseille|lyon'],
  ['ES', 'spain|madrid|barcelona|valencia|seville'],
  ['IT', 'italy|rome|milan|naples|turin'],
  ['NL', 'netherlands|holland|amsterdam|rotterdam|the hague|utrecht'],
  ['BR', 'brazil|brazilian|brasilia|sao paulo|rio de janeiro'],
  ['MX', 'mexico|mexican|mexico city|guadalajara|monterrey'],
  // markets the product cannot measure (not in the COUNTRIES table): a keyword about them is flagged, and their rankings cannot be tracked
  ['QA', 'qatar|qatari|doha'], ['OM', 'oman|omani|muscat'], ['BH', 'bahrain|bahraini|manama'], ['KW', 'kuwait|kuwaiti'],
  ['EG', 'egypt|egyptian|cairo|alexandria'], ['JO', 'jordan|amman'], ['LB', 'lebanon|beirut'], ['TR', 'turkiye|istanbul|ankara'],
  ['CN', 'china|beijing|shanghai|shenzhen'], ['JP', 'japan|tokyo|osaka'], ['MY', 'malaysia|kuala lumpur'], ['ID', 'indonesia|jakarta'],
  ['PH', 'philippines|manila'], ['NG', 'nigeria|lagos|abuja'], ['KE', 'kenya|nairobi'], ['BD', 'bangladesh|dhaka'], ['LK', 'sri lanka|colombo'],
  ['NP', 'nepal|kathmandu'], ['AF', 'afghanistan|kabul'],
  // regions: the set of their countries ("gcc" is fine for a UAE website, not for a Pakistan one)
  ['AE SA QA OM BH KW', 'gcc|gcc countries|gulf|gulf countries|gulf region|arabian gulf|persian gulf|khaleej'],
  ['AE SA QA OM BH KW EG JO LB', 'middle east|mena|arab world|arab countries'],
  ['DE FR ES IT NL IE GB', 'europe|european|eu|european union'],
  ['US CA', 'north america'], ['BR MX', 'latin america|latam'], ['IN PK BD LK NP', 'south asia']];
const FIT_PLACES = FIT_PLACES_SRC.flatMap(([iso, ws]) => ws.split('|').map(w => ({ word: w, iso: iso.split(' '), region: iso.split(' ').length > 2 || iso === 'US CA' || iso === 'BR MX' })))
  .sort((a, b) => b.word.split(' ').length - a.word.split(' ').length || b.word.length - a.word.length);
// a one-word place is neutral for the topic rules, like the places FIT_GEO already held ("ai automation lahore" is about automation)
for (const p of FIT_PLACES) if (p.word.indexOf(' ') < 0) FIT_GEO.add(p.word);
// the comparable form of a text: Arabic read through the glossary, NFKC, lower case, dots dropped (u.a.e -> uae), every other mark a space
const fitPlaceText = (s) => { const raw = String(s || ''); const AR = fitArabic(raw);
  return ' ' + fitLow((AR.read ? AR.text + ' ' : '') + raw).replace(/\./g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' '; };
// every place a text names, longest phrase first (each word read once): [{ word, iso: [..], region }], in the order found
const fitPlaces = (s) => { let t = fitPlaceText(s); const out = [];
  for (const p of FIT_PLACES) { const k = ' ' + p.word + ' '; let i = t.indexOf(k);
    while (i >= 0) { out.push({ word: p.word, iso: p.iso.slice(), region: p.region, at: i }); t = t.slice(0, i) + ' | ' + t.slice(i + k.length - 1); i = t.indexOf(k); } }
  return out.sort((a, b) => a.at - b.at).map(({ word, iso, region }) => ({ word, iso, region })); };
// the keyword without the given place words (and the "in" / "for" left dangling): "ai automation solutions gcc" -> "ai automation solutions"
const FIT_PLACE_GLUE = /^(in|for|across|at|of|the|and|near|from|within|around|throughout|to)$/;
const fitDropPlaces = (keyword, words) => { if (FIT_AR.test(String(keyword || ''))) return '';
  let t = fitPlaceText(keyword); for (const w of (words || [])) t = t.split(' ' + w + ' ').join(' | ');
  const parts = t.split('|').map(x => x.trim().split(' ').filter(Boolean));
  for (const p of parts) { while (p.length && FIT_PLACE_GLUE.test(p[p.length - 1])) p.pop(); while (p.length && FIT_PLACE_GLUE.test(p[0])) p.shift(); }
  return parts.map(p => p.join(' ')).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(); };
// does a text point to the market `iso`? ok = it names no place, or at least one place that includes the market
//   { ok, iso, places, inside: [words], outside: [words], without: the text with the outside words dropped ('' when it cannot be said) }
const fitMarket = (s, iso) => { const m = String(iso || '').toUpperCase(); const places = fitPlaces(s);
  const inside = places.filter(p => p.iso.includes(m)).map(p => p.word), outside = places.filter(p => !p.iso.includes(m)).map(p => p.word);
  const ok = !m || !places.length || inside.length > 0;
  return { ok, iso: m, places, inside, outside, without: ok ? String(s || '').trim() : fitDropPlaces(s, outside) }; };
// ---- KW-GATE: what the client DECLARED it sells, widened by a small category tree, and the products of OTHER vendors ----
// A category search of what the client sells is in topic ("erp software uae" for a Business Central partner, "peppol uae" for an e-invoicing
// firm, "vat registration uae" next to e-invoicing compliance, "it company dubai" for an IT firm). A family is declared only by the client's
// own words (ctx.services / ctx.protect: services, business line, chosen keywords), never by a crawl or the research pool. `anchors` are product
// categories that count as matched words of the keyword; `words` join the topic words; `wide` are two-letter categories ("ai", "it") that
// count only with a word naming a seller ("best ai companies uae", "ai firm dubai"), so "ai online", "ai uae" and "best ai apps" stay too broad.
const FIT_FAMILIES = [
  // N1: `cat` = a product family; a service the client declared in it (Business Central, Dynamics 365 Finance, F&O; Dynamics 365 Sales; any
  // e-invoicing service) makes the family's category word one of the client's own (fitServiceAnchors), so "erp consultants" and "finance erp
  // system" are the work of a Business Central partner. `subj` = the names of the standard itself (not a vendor): a keyword about PINT-AE is
  // an e-invoicing firm's subject whatever else it asks ("pint-ae xml format mandatory fields").
  { re: /\b(erp|erps|enterprise resource planning|business central|dynamics 365 (finance|f ?& ?o|supply chain)|finance and operations|netsuite|sap|odoo|acumatica|epicor|sage (x3|intacct|200)|oracle (fusion|cloud erp|epm|erp))\b/, anchors: ['erp', 'erps'], words: ['erp'], cat: true },
  { re: /\b(e ?-?invoic\w*|einvoic\w*|electronic invoic\w*|peppol|fatoora)\b/, anchors: ['invoicing', 'invoice', 'invoices', 'einvoicing'], words: ['peppol', 'pint', 'fatoora', 'invoicing', 'einvoicing'], svc: ['vat'], cat: true, subj: ['peppol', 'pint', 'fatoora'] },
  { re: /\b(crm|dynamics 365 (sales|customer service|marketing)|customer engagement|salesforce|hubspot)\b/, anchors: ['crm'], words: ['crm'], cat: true },
  { re: /\b(vat|value added tax|tax (registration|consultan\w*|advis\w*|filing|compliance))\b/, anchors: ['vat'], words: [] },
  { re: /\b(ai|artificial intelligence|machine learning|copilot|genai|generative ai)\b/, anchors: [], words: [], wide: ['ai'] },   // no extra topic words: "generative ai" and "ai agent" stay as wide as "ai" (R13)
  { re: /\b(it (services|support|solutions|consulting|company|outsourcing|infrastructure)|managed it|information technology)\b/, anchors: [], words: [], wide: ['it'] }];
const FIT_TAX_SERVICE = /\b(registration|register|registering|deregistration|filing|returns?|compliance|compliant|consultants?|consultancy|consulting|advisors?|advisory|agents?|services?|refunds?|audit|auditing)\b/;
const FIT_SELLER = /\b(company|companies|firm|firms|agency|agencies|provider|providers|consultants?|consultancy|consultancies|consulting|services|service|partners?|vendors?|specialists?|experts?|solutions|integrators?)\b/;
const FIT_REAL_GEO = (t) => FIT_GEO.has(t) && t !== 'online' && t !== 'portal';
// the declared side, once per context: { text, toks: Set, anchors: Set, words: Set (stemmed), wide: Set }
const fitDeclared = (ctx) => {
  const o = ctx || {};
  const src = [...(Array.isArray(o.services) ? o.services : [o.services]), ...(o.protect || []), ...(o.brand_names || [])].filter(Boolean).map(x => fitLow(x)).join(' | ');
  const d = { text: src, toks: new Set(src.split(FIT_SPLIT_WORDS).filter(Boolean)), anchors: new Set(), words: new Set(), wide: new Set() };
  d.svc = new Set();
  for (const f of FIT_FAMILIES) if (f.re.test(src)) { f.anchors.forEach(a => d.anchors.add(a)); f.words.forEach(w => d.words.add(fitStem(w))); (f.wide || []).forEach(w => d.wide.add(w)); (f.svc || []).forEach(w => d.svc.add(w)); }
  // a product category the client named in a service ("CRM implementation", "Payroll outsourcing") is an anchor too (F-REH's rule, for every caller)
  for (const t of d.toks) if (FIT_SERVICE_CATS_K.has(t)) d.anchors.add(t);
  // what makes a vendor the client's own: everything the client told us, the topics included (some callers pass services only as topics)
  const topicsTxt = (Array.isArray(o.topics) ? o.topics : [o.topics]).filter(Boolean).map(x => fitLow(x)).join(' | ');
  d.vtext = src + ' | ' + topicsTxt; d.vtoks = new Set(d.vtext.split(FIT_SPLIT_WORDS).filter(Boolean));
  return d;
};
const FIT_SERVICE_CATS_K = new Set(['erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll']);
// Another company's PRODUCT or firm. Refused as 'other brand' unless the client declared it (its services, business line, chosen keywords or
// domain name it), or the keyword compares it ("dynamics 365 vs sap business one"). A partner word does not make SAP the client's: "sap
// implementation dubai" is a page for SAP's partners, not for a Dynamics 365 partner.
const FIT_VENDORS = [['SAP', ['sap', 's4hana']], ['Oracle NetSuite', ['netsuite'], ['oracle']], ['Oracle', ['oracle'], ['netsuite']], ['Odoo', ['odoo']], ['Sage', ['sage']], ['Acumatica', ['acumatica']],
  ['Epicor', ['epicor']], ['Infor', ['infor']], ['Syspro', ['syspro']], ['QuickBooks', ['quickbooks']], ['Xero', ['xero']], ['Tally', ['tally']], ['Zoho', ['zoho']], ['FreshBooks', ['freshbooks']],
  ['Microsoft Dynamics 365', ['dynamics', 'navision', 'axapta'], ['microsoft', 'business central']], ['Business Central', ['business central'], ['dynamics', 'microsoft']], ['Microsoft Copilot', ['copilot'], ['microsoft']],
  ['Salesforce', ['salesforce']], ['HubSpot', ['hubspot']], ['Pipedrive', ['pipedrive']], ['Freshworks', ['freshworks', 'freshsales']], ['Zendesk', ['zendesk']], ['ServiceNow', ['servicenow']], ['Workday', ['workday']],
  ['Storecove', ['storecove']], ['Pagero', ['pagero']], ['Avalara', ['avalara']], ['Sovos', ['sovos']], ['ClearTax', ['cleartax']], ['Edicom', ['edicom']], ['Tungsten', ['tungsten']], ['Basware', ['basware']],
  ['Comarch', ['comarch']], ['Banqup', ['banqup']], ['Unifiedpost', ['unifiedpost']], ['Tradeshift', ['tradeshift']], ['Coupa', ['coupa']],
  ['Capgemini', ['capgemini']], ['Deloitte', ['deloitte']], ['Accenture', ['accenture']], ['KPMG', ['kpmg']], ['PwC', ['pwc']], ['McKinsey', ['mckinsey']], ['IBM', ['ibm']], ['Infosys', ['infosys']],
  ['TCS', ['tcs']], ['Wipro', ['wipro']], ['Cognizant', ['cognizant']],
  ['OpenAI', ['openai', 'chatgpt']], ['Google Gemini', ['gemini']], ['Perplexity', ['perplexity']], ['Meta', ['meta']], ['Anthropic', ['anthropic', 'claude']], ['DeepSeek', ['deepseek']], ['Mistral', ['mistral']],
  ['Midjourney', ['midjourney']], ['Jasper', ['jasper']]];
// the first vendor the keyword names that the client did not declare: { name, word } or null
const fitVendor = (toks, decl, ownLabels) => {
  const line = ' ' + toks.join(' ') + ' ';
  const said = (w) => w.indexOf(' ') > 0 ? line.includes(' ' + w + ' ') : toks.includes(w);
  const declared = (w) => w.indexOf(' ') > 0 ? (' ' + String(decl.vtext || decl.text).replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ').includes(' ' + w + ' ') : ((decl.vtoks || decl.toks).has(w) || (ownLabels || []).includes(w));
  for (const [name, words, also] of FIT_VENDORS) {
    const w = words.find(said); if (!w) continue;
    if ([...words, ...(also || [])].some(declared)) continue;
    return { name, word: w };
  }
  return null;
};
const fitSerpDomains = (res) => { try { return ((((res || {}).tasks || [])[0] || {}).result || [])[0].items.filter(x => x && x.type === 'organic').sort((a, b) => (a.rank_group || 99) - (b.rank_group || 99)).map(x => fitHost(x.domain || String(x.url || '').replace(/^https?:\/\//, '').split('/')[0])).filter(Boolean); } catch (e) { return []; } };
// ---- R13 (2026-10-13, re-rating §3.11): TOPIC DISTANCE, the same 25% bar the outreach gate uses (OK.OFF_TOPIC in _outreach_kit.js) ----
// The full report's §4a offered "ai" (165,000/mo), "character ai" (110,000), "google ai", "humanize ai", "meta ai", "blackbox ai",
// "mh enterprises uae" and "microsoft ai", and the gap kept "mofa attestation dubai" and "how to check emirates id status with passport
// number", under a High finding telling the owner to build pages for them: the gate only ever refused classes somebody had listed
// (navigational, a declared competitor, a results-page label), so a brand or a subject nobody listed walked straight through. fitTopic()
// measures what share of a keyword's OWN distinctive words the site's topics carry. Place names and generic category words are neutral —
// they count for neither side, so "best erp software dubai" is judged on "erp" — and a keyword left with nothing but generic or place
// words ("ai", "google ai", "microsoft ai") is too broad for any page of this site to win.
const FIT_TOPIC_BAR = 0.25;
// B-3: category words too wide to stand for what a site sells on their own: "dubai business tax" and "uae businesses" were judged "a category you
// sell (business) in your market" because the site's services name "Dynamics 365 Business Central". They never count for a head term.
const FIT_WIDE = new Set(['business', 'businesses', 'company', 'companies', 'firms', 'finance', 'financial', 'tax', 'data', 'digital', 'online', 'web', 'technology', 'technologies', 'tech',
  'solutions', 'solution', 'services', 'service', 'systems', 'system', 'global', 'group', 'national', 'international', 'best', 'top', 'free', 'news', 'jobs', 'careers', 'smart', 'consulting',
  'consultants', 'consultancy', 'partners', 'partner', 'network', 'info', 'guide', 'guides', 'blog', 'list', 'directory', 'review', 'reviews', 'compare', 'comparison', 'pro', 'plus', 'one', 'first',
  'get', 'go', 'easy', 'home', 'world', 'city', 'market', 'media', 'shop', 'store', 'gulf', 'arab', 'arabia', 'emirates', 'google', 'microsoft', 'amazon', 'apple']);
const fitStem = (w) => w.length > 5 ? w.replace(/(ingly|ings|ing|ments|ment|ations|ation|ions|ion|ies|ers|er|ed|es|s|e)$/, '') : w;   // the outreach kit's stem: invoice / invoices / invoicing -> invoic
// E-GATE (2026-10-21, pre-launch run D4): the topic words drop every word of two letters (below), so "ai" is never one of them, and a client
// whose first declared service is "AI consulting" was told "ai consulting services uae", "ai consulting dubai" and "best ai consulting firms
// dubai" were "too broad" (only category or place words, none of them the site's). Making "ai" a topic word on its own is not the fix: it is a
// category word (R13), and with it every "ai" + category or place search of an AI-selling site passed ("ai online", "ai in cloud", "best ai
// apps", harness S103). The short word counts through the client's own phrase instead (fitCarriedName below): a keyword made only of category
// and place words that carries the WHOLE of a short topic phrase (a service the client named, a keyword they chose: "AI consulting", "Power
// BI", "HR software") names that service. Two-letter words count there because fitTokens keeps them.
const fitTopicWords = (topics) => new Set(fitSyn(Array.isArray(topics) ? topics.filter(Boolean).join(' ') : String(topics || ''))
  .split(FIT_SPLIT_WORDS).filter(t => t.length > 2 && !FIT_STOP.has(t) && !FIT_GEO.has(t)).map(fitStem));
// E-GATE (D4): words a buyer adds to any service search ("ai consulting cost uae", "best ai consulting firm dubai"). They say how the person
// buys, not what they buy, so they are neutral like a place: "ai consulting cost uae" was refused as off topic on the word "cost" alone.
const FIT_BUYER = new Set(['cost', 'costs', 'price', 'prices', 'pricing', 'fee', 'fees', 'quote', 'quotes', 'cheap', 'cheapest', 'affordable', 'firm', 'near', 'nearby']);
const fitAnd = (a) => a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
// the short topic phrase (2 to 6 words, never prose) whose every word the keyword carries ("consultants" carries "consulting": the same stem rule as fitTopic)
const fitCarriedName = (toks, topics) => { const ks = toks.filter(t => !FIT_GEO.has(t)).map(fitStem);
  const hit = (x) => { const s = fitStem(x); return ks.some(k => k === s || (k.length >= 5 && s.length >= 5 && (k.indexOf(s) === 0 || s.indexOf(k) === 0))); };
  for (const t of (Array.isArray(topics) ? topics : [topics])) { const raw0 = String(t || '').replace(/\s+/g, ' ').trim(); if (!raw0) continue; const raw = fitSyn(raw0);
    const w = fitTokens(raw).filter(x => !FIT_GEO.has(x) && !/^\d+$/.test(x));
    if (w.length < 2 || w.length > 6) continue;
    if (w.every(hit)) return raw0; }
  return ''; };
// B-3: the topics as PHRASES (one service name, one configured keyword, one description), so a common word can be judged against the name
// it came from. `dist` = the phrase's own distinctive words (stemmed); prose (more than 6 of them) never vouches for a common word.
const fitTopicPhrases = (topics) => (Array.isArray(topics) ? topics.filter(Boolean).map(String) : [String(topics || '')])
  .map(t => { const w = fitSyn(t).split(FIT_SPLIT_WORDS).filter(x => x.length > 2 && !FIT_STOP.has(x) && !FIT_GEO.has(x) && !/^\d+$/.test(x));
    return { dist: [...new Set(w.filter(x => !FIT_GENERIC.has(x)).map(fitStem))], words: [...new Set(w.map(fitStem))] }; })
  .filter(p => p.dist.length).map(p => ({ ...p, prose: p.dist.length > 6 }));
function fitTopic(keyword, topics, ctx) {
  const o = ctx || {};
  const bar = typeof o.topic_bar === 'number' ? o.topic_bar : FIT_TOPIC_BAR;
  const label = String(o.topic_label || 'what this website sells');
  const T = fitTopicWords(topics);
  const PH = fitTopicPhrases(topics);
  // With little on file the measure would refuse good keywords, so under topic_min_words (12) distinctive words it judges nothing: a site
  // whose services and description are a single line gets no topic refusals at all ("no evidence, no refusal").
  if (T.size < (typeof o.topic_min_words === 'number' ? o.topic_min_words : 12)) return { ok: true, reason: '', detail: T.size ? 'too few topic words on file (' + T.size + ') to judge topic distance' : 'no topics on file, so topic distance was not judged', share: null };
  // KW-GATE (2026-10-21): an Arabic keyword is judged on its English reading; a "number 1" claim says nothing about the subject
  const AR = fitArabic(keyword);
  const toks = fitTokens(fitSyn(AR.text).replace(/(^|\s)(no\.? ?1|number (one|1)|#1)(?=\s|$)/gi, ' '));
  const decl = o._decl || fitDeclared(o);
  for (const w of decl.words) T.add(w);
  const unread = new Set(AR.unread);
  let own = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !FIT_BUYER.has(t) && !/^[\d.]+$/.test(t));   // F-KW: a year or a number ("2026", "3.0") is neutral, like a place; E-GATE: so is a buyer's word (cost, firm)
  // KW-GATE: a product category the client declared (erp for a Business Central partner, vat and invoicing next to e-invoicing) is a matched word of the keyword
  // a neighbouring tax word ("vat" next to e-invoicing compliance) counts only when the keyword asks for a service done for the buyer:
  // "vat registration uae" is the client's work, "uae vat", "vat tax uae" and "online vat calculator" are not
  const svcAsk = FIT_TAX_SERVICE.test(' ' + toks.join(' ') + ' ');
  const anchors = [...new Set(toks.filter(t => decl.anchors.has(t) || (svcAsk && (decl.svc || new Set()).has(t))))];
  const known = [...T];
  const stemHit = (s, x) => x === s || (x.length >= 5 && s.length >= 5 && (s.indexOf(x) === 0 || x.indexOf(s) === 0));
  const matches = (t) => { const s = fitStem(t); return T.has(s) || known.some(x => stemHit(s, x)); };
  // B-3: a common word (FIT_COMMON) is on topic only through a service NAME the keyword carries whole, or two words of (prose never vouches)
  // ("business central partner uae" carries two words of "Dynamics 365 Business Central"; "intelligent software solutions" one of "Intelligent Document Processing")
  const ownStems = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !FIT_BUYER.has(t) && !/^\d+$/.test(t)).map(fitStem);
  const allStems = toks.filter(t => t.length > 2 && !FIT_GEO.has(t)).map(fitStem);
  const viaName = (t) => { const s = fitStem(t); return PH.some(ph => !ph.prose && ph.dist.some(x => stemHit(s, x))
    && (ph.dist.every(x => ownStems.some(k => stemHit(k, x))) || ph.words.filter(x => allStems.some(k => stemHit(k, x))).length >= 2)); };
  const matchOwn = (t) => FIT_COMMON.has(t) ? viaName(t) : matches(t);
  // a keyword made only of category and place words is a head term: it is on topic when at least two of those categories are the site's own
  // ("erp software uae", "best erp software dubai"), and too broad when only one is and there is no market in it either ("ai", "google ai")
  // an Arabic word the glossary cannot read is neither evidence nor a refusal once another word of the keyword matched
  if (unread.size && own.some(t => !unread.has(t) && matchOwn(t))) own = own.filter(t => !unread.has(t));
  if (!own.length) {
    const cats = [...new Set(toks.filter(t => (FIT_GENERIC.has(t) && !FIT_WIDE.has(t) && matches(t)) || decl.anchors.has(t)))];   // B-3: a wide word never stands for a category
    // MKT (2026-10-27): with the website's market given, only a place IN that market is "your market" ("erp software gcc" for a Pakistan site is not)
    const hasPlace = o.market ? fitMarket(keyword, o.market).inside.length > 0 : toks.some(FIT_REAL_GEO);
    if (cats.length >= 2 || (cats.length >= 1 && hasPlace)) return { ok: true, reason: '', detail: 'a category you sell (' + cats.join(', ') + ')' + (hasPlace ? ' in your market' : ''), share: 1 };
    // KW-GATE (review 13): "it company dubai" for an IT firm, "best ai companies uae" for an AI consultancy: a two-letter category the client
    // declared, with a word naming a seller. "ai", "ai uae", "ai online", "best ai apps" carry no seller and stay too broad.
    const wide = toks.filter(t => decl.wide.has(t));
    if (wide.length && FIT_SELLER.test(' ' + toks.join(' ') + ' ')) return { ok: true, reason: '', detail: 'a search for a provider of ' + wide[0].toUpperCase() + ', a category you sell', share: 1 };
    const carried = fitCarriedName(toks, topics);
    if (carried) return { ok: true, reason: '', detail: 'it names "' + carried + '", part of ' + label, share: 1 };
    // E-GATE (D4): the sentence names the words, not the keyword again (it read "... and the keywords you chose ("<the keyword itself>")")
    return { ok: false, reason: 'too broad', detail: (toks.length === 1 ? 'its one word, "' + toks[0] + '", is a category or a place' : 'it has only category or place words, ' + fitAnd(toks.map(t => '"' + t + '"'))) + ', so nothing in it points to ' + label, share: cats.length ? 0.5 : 0 };
  }
  const hits = own.filter(matchOwn);
  const share = Math.round(100 * (hits.length + anchors.length) / (own.length + anchors.length)) / 100;
  const readAs = AR.read ? ' (read as "' + AR.text + '")' : '';
  if (share < bar) return { ok: false, reason: 'off topic', detail: Math.round(share * 100) + '% of its own words match ' + label + ' (' + Math.round(bar * 100) + '% is the bar): '
    + own.filter(t => hits.indexOf(t) < 0).slice(0, 4).join(', ') + readAs + '. Add it to your services if you do sell it.', share };
  return { ok: true, reason: '', detail: Math.round(share * 100) + '% of its own words match ' + label + (anchors.length ? ' ("' + anchors.join('", "') + '" is a category you listed)' : ''), share };
}
// ---- F-KW (2026-10-20, findings 1 and 2): POSITIVE topic evidence, for the decisions that write on their own ----
// fitTopic answers "may we refuse it?" and, with fewer than 12 topic words on file, refuses nothing ("no evidence, no refusal"). That is the
// right rule for a refusal and the wrong one for writing a page on our own: a site that lists two services passed every keyword. fitEvidence
// answers "is there evidence it is the client's subject?": `in` = at least the topic bar of the keyword's own words is in the topics given (any
// number of topic words); `out` = with 12+ topic words on file the keyword misses the bar (a refusal); `unknown` = too little on file to say,
// which a caller must treat as NOT in topic (a suggestion at most) and say so in plain words.
// F-REH (2026-10-20, real-credit rehearsal): a DECLARED service's product-category word is positive evidence. "crm service provider uae" for a
// client who listed "CRM implementation" came back "not enough information": `crm` is a category word (FIT_GENERIC), which the share rule
// treats as neutral, so the keyword was judged on "provider" alone. When the client named the category in a service (ctx.services = the
// services they DECLARED, never the crawl's guesses), that word counts as one of the keyword's own words AND as a hit, at any number of topic
// words on file. Only product categories qualify: `ai`, `software`, `cloud` and the wide words never do ("character ai" stays off topic for an
// "AI consulting" site); a FIT_COMMON word ("sales", "central") still needs the whole service name, as in fitTopic.
const FIT_SERVICE_CATS = new Set(['erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll']);
// the declared product families (FIT_FAMILIES `cat`) of these services, read on the services alone (never the crawl)
const fitServiceFamilies = (services) => { const txt = (Array.isArray(services) ? services : [services]).filter(Boolean).map(x => fitSyn(x)).join(' | ');
  return txt ? FIT_FAMILIES.filter(f => f.cat && f.re.test(txt)) : []; };
const fitServiceAnchors = (keyword, services) => {
  const svc = new Set((Array.isArray(services) ? services : [services]).filter(Boolean).flatMap(x => fitTokens(fitSyn(x))).filter(t => FIT_SERVICE_CATS.has(t)).map(fitStem));
  for (const f of fitServiceFamilies(services)) f.anchors.forEach(a => svc.add(fitStem(a)));   // N1: Business Central / D365 Finance -> erp, D365 Sales -> crm
  if (!svc.size) return [];
  return [...new Set(fitTokens(fitSyn(keyword)).filter(t => FIT_SERVICE_CATS.has(t) && svc.has(fitStem(t))))];
};
function fitEvidence(keyword, topics, ctx) {
  const o = ctx || {};
  const T = fitTopicWords(topics);
  const anchors = fitServiceAnchors(keyword, o.services || []);
  // KW-GATE: judged on the topics alone here (no declared-category anchors), so a keyword that passes only through a declared category says so (basis below)
  const t = T.size ? fitTopic(keyword, topics, { ...o, topic_min_words: 1, _decl: { ...fitDeclared(o), anchors: new Set(), svc: new Set() } }) : { ok: false, share: null, detail: '' };
  if (t.ok && t.share != null) return { verdict: 'in', share: t.share, words: T.size, detail: t.detail, basis: 'topics' };
  // N1: the name of a standard the client works in (PINT-AE, Peppol, FATOORA for an e-invoicing service) makes the search the client's subject
  const subjToks = fitTokens(fitSyn(keyword));
  for (const f of fitServiceFamilies(o.services || [])) { const w = (f.subj || []).find(x => subjToks.includes(x));
    if (w) return { verdict: 'in', share: t.share == null ? null : t.share, words: T.size, basis: 'declared service', anchors: [w],
      detail: '"' + w + '" is part of a service you listed (' + (o.services || []).find(s => f.re.test(fitSyn(s))) + ')' }; }
  if (anchors.length) {
    // the share again, with the declared category word counted as the keyword's own and as matched
    const toks = fitTokens(fitSyn(keyword));
    const own = toks.filter(x => x.length > 2 && !FIT_GEO.has(x) && !FIT_GENERIC.has(x) && !FIT_BUYER.has(x) && !/^\d+$/.test(x));
    const PH = fitTopicPhrases(topics), known = [...T];
    const stemHit = (s, x) => x === s || (x.length >= 5 && s.length >= 5 && (s.indexOf(x) === 0 || x.indexOf(s) === 0));
    const ownStems = own.map(fitStem), allStems = toks.filter(x => x.length > 2 && !FIT_GEO.has(x)).map(fitStem);
    const viaName = (w) => { const s = fitStem(w); return PH.some(ph => !ph.prose && ph.dist.some(x => stemHit(s, x)) && (ph.dist.every(x => ownStems.some(k => stemHit(k, x))) || ph.words.filter(x => allStems.some(k => stemHit(k, x))).length >= 2)); };
    const hit = (w) => FIT_COMMON.has(w) ? viaName(w) : (T.has(fitStem(w)) || known.some(x => stemHit(fitStem(w), x)));
    const hits = own.filter(hit).length + anchors.length, all = own.length + anchors.length;
    const share = Math.round(100 * hits / all) / 100;
    const bar = typeof o.topic_bar === 'number' ? o.topic_bar : FIT_TOPIC_BAR;
    // N1: a category reached through a product the client listed is named with that product ("erp" for Dynamics 365 Business Central)
    const said = new Set((o.services || []).flatMap(x => fitTokens(fitSyn(x))).map(fitStem));
    const via = anchors.every(a => said.has(fitStem(a))) ? '' : ((o.services || []).find(s => fitServiceFamilies([s]).some(f => f.anchors.some(a => anchors.includes(a)))) || '');
    if (share >= bar) return { verdict: 'in', share, words: T.size, basis: 'declared service', anchors,
      detail: '"' + anchors.join('", "') + '" ' + (via ? 'is the category of ' + via + ', one of the services you listed' : 'is one of the services you listed') + (own.length ? ' (' + Math.round(share * 100) + '% of its own words match)' : '') };
  }
  if (!T.size) return { verdict: 'unknown', share: null, words: 0, detail: 'nothing is on file yet about what this website sells or which keywords you chose' };
  if (T.size >= 12) return { verdict: 'out', share: t.share == null ? null : t.share, words: T.size, detail: t.detail };
  return { verdict: 'unknown', share: t.share == null ? null : t.share, words: T.size, detail: 'too little is on file about what this website sells to tell whether this keyword is part of it' };
}
// ---- E-GATE (2026-10-21, pre-launch run RV-11): a search made by people looking for WORK or TRAINING, read from its results page ----
// The job-search rule (4b) reads the keyword's own words only, so it refused "ai consultant jobs" and "ai consultant salary" and let "ai
// consultant" through: research labelled it commercial, "buyers comparing providers", Easy, and it became the client's ladder head, while its
// results page was ae.indeed.com, usaii.org (a certification course) and upwork, and the questions people also ask were "What is AI
// consulting's salary?" and "How do I become an AI consultant?". fitCareer reads three kinds of evidence a caller may have:
//   pages   - the top results ({ domain, url, title } or domains): job boards, salary sites and course / certification sites, or a page whose
//             address or title is a job listing or a course;
//   paa     - the "people also ask" questions: pay, jobs, careers, becoming one, courses, certification;
//   related - the research pool: of the searches that contain all of this keyword's own words, the share that are about jobs, pay or courses.
// Points: 3+ such pages 1.5, 2 pages 1, 1 page 0.5; 2+ questions 1, one 0.5; related 40%+ of 4+ variants 1. A career search needs 1.5, so
// one kind of evidence alone is never enough unless the results page itself is mostly job and course pages. A keyword with a product or
// buyer word ("ai consulting services uae", "hire an ai consultant", "recruitment software") is never one. A site whose own short topics
// (a service name, a chosen keyword; never prose) are recruitment keeps its job searches, one that sells training keeps its course searches.
const FIT_JOB_HOSTS = /(^|\.)(naukrigulf|naukri|indeed|glassdoor|bayt|monster|monstergulf|foundit|gulftalent|ziprecruiter|jooble|careerjet|simplyhired|wellfound|laimoon|drjobpro|jobsdb|jobstreet|seek|reed|totaljobs|careerbuilder|dice|payscale|salary|salaryexplorer|ambitionbox|talent|adzuna|jobrapido|levels)\.[a-z.]+$/;
const FIT_COURSE_HOSTS = /(^|\.)(coursera|udemy|edx|simplilearn|udacity|usaii|iabac|greatlearning|mygreatlearning|upgrad|datacamp|skillshare|futurelearn|pluralsight|classcentral|emeritus|edureka|intellipaat|knowledgehut|careerfoundry|springboard|codecademy|alison)\.[a-z.]+$/;
const FIT_JOB_PATH = /\/(jobs?|careers?|vacanc[a-z]*|salar[a-z]*)(\/|$|-|\?)/i, FIT_COURSE_PATH = /\/(courses?|certifications?|learning)(\/|$|-|\?)/i;
const FIT_JOB_TITLE = /\b(jobs?|vacanc(y|ies)|hiring now|salar(y|ies))\b/i, FIT_COURSE_TITLE = /\b(courses?|certification|certificate program(me)?|program fee|bootcamp|diploma|degree)\b/i;
const FIT_JOB_Q = /\b(salary|salaries|earn|earns|earning|become|becoming|jobs?|careers?|qualifications?)\b/i, FIT_COURSE_Q = /\b(courses?|certifications?|degree|study)\b/i;
const FIT_JOB_KW = /\b(jobs?|careers?|vacanc(y|ies)|salary|salaries|internships?|cv|resume|become|becoming)\b/, FIT_COURSE_KW = /\b(courses?|certifications?|degree|diploma)\b/;
const FIT_BUYER_KW = /\b(services?|company|companies|firms?|agency|agencies|provider|providers|vendor|vendors|partners?|hire|cost|costs|price|prices|pricing|quote|quotes|outsourc\w*)\b/;
// KW-GATE (review 8): what a recruitment or a training business calls what it sells. Read from the client's own short topics (service names,
// chosen keywords; never prose), so "Manpower supply", "Executive search", "Employment agency" keep job searches and "Power BI workshops",
// "Corporate learning programs", "Excel bootcamps" keep course searches. One definition for rule 4b and for fitCareer.
const FIT_SELLS_JOBS = /\b(recruit\w*|staffing|staff augmentation|hiring|headhunt\w*|talent (acquisition|search|solutions)|manpower|employment (agenc\w*|services?)|placements?|executive search|job (board|portal)s?|careers? (services?|coaching))\b/;
const FIT_SELLS_COURSES = /\b(train\w*|courses?|educat\w*|academ\w*|tutor\w*|learning|e-?learning|workshops?|bootcamps?|class(es)?|institutes?|institution|certification (training|courses?|programs?|preparation))\b/;
const fitSells = (topics) => { const short = (Array.isArray(topics) ? topics : [topics]).filter(t => t && fitTokens(t).length <= 6).map(fitLow).join(' | ');
  return { jobs: FIT_SELLS_JOBS.test(short), courses: FIT_SELLS_COURSES.test(short) }; };
// KW-GATE (review 6): a word the keyword itself carries is not evidence about the results page ("certification" in "iso 27001 certification
// dubai" is in every buyer's title too). The title / question is read without the keyword's own words.
const fitWithout = (text, toks) => { let t = ' ' + fitLow(text) + ' '; for (const w of toks) t = t.split(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')).join(' '); return t; };
function fitCareer(keyword, o) {
  o = o || {};
  const kw = fitLow(fitArabic(keyword).text).replace(/\s+/g, ' ').trim();
  const none = (why) => ({ career: false, points: 0, signals: [], detail: '', why });
  if (!kw) return none('no keyword');
  if (FIT_PRODUCT.test(' ' + kw + ' ') || FIT_BUYER_KW.test(' ' + kw + ' ')) return none('it carries a product or buyer word');
  const S = fitSells(o.topics);
  const sellsJobs = S.jobs, sellsCourses = S.courses;
  if (sellsJobs && sellsCourses) return none('this website sells recruitment and training');
  const kwToks = fitTokens(kw);
  const isJob = (p) => !sellsJobs && (FIT_JOB_HOSTS.test(p.domain) || FIT_JOB_PATH.test(p.path) || FIT_JOB_TITLE.test(fitWithout(p.title, kwToks)));
  const isCourse = (p) => !sellsCourses && (FIT_COURSE_HOSTS.test(p.domain) || FIT_COURSE_PATH.test(p.path) || FIT_COURSE_TITLE.test(fitWithout(p.title, kwToks)));
  const pages = (o.pages || []).map(p => typeof p === 'string' ? { domain: p, url: '', title: '' } : (p || {}))
    .map(p => ({ domain: fitHost(p.domain || p.url || ''), path: String(p.url || '').replace(/^https?:\/\/[^/]+/i, ''), title: String(p.title || '') })).filter(p => p.domain).slice(0, 10);
  const careerDom = [...new Set(pages.filter(p => isJob(p) || isCourse(p)).map(p => p.domain))];
  const qs = [...new Set((o.paa || []).map(q => String(q || '').trim()).filter(q => q && ((!sellsJobs && FIT_JOB_Q.test(fitWithout(q, kwToks))) || (!sellsCourses && FIT_COURSE_Q.test(fitWithout(q, kwToks))))))];
  const own = fitTokens(kw).filter(t => !FIT_GEO.has(t));
  const variants = [...new Set((o.related || []).map(r => fitLow(typeof r === 'string' ? r : (r || {}).keyword).replace(/\s+/g, ' ').trim()))]
    .filter(r => r && r !== kw && own.length && own.every(t => fitTokens(r).includes(t)));
  const careerVar = variants.filter(r => (!sellsJobs && FIT_JOB_KW.test(' ' + r + ' ')) || (!sellsCourses && FIT_COURSE_KW.test(' ' + r + ' ')));
  const pp = careerDom.length >= 3 ? 1.5 : careerDom.length === 2 ? 1 : careerDom.length === 1 ? 0.5 : 0;
  const qp = qs.length >= 2 ? 1 : qs.length === 1 ? 0.5 : 0;
  const rp = variants.length >= 4 && careerVar.length / variants.length >= 0.4 ? 1 : 0;
  const points = pp + qp + rp;
  const signals = [];
  if (careerDom.length) signals.push('job, salary or course pages rank for it (' + careerDom.slice(0, 4).join(', ') + ')');
  if (qs.length) signals.push('the questions people also ask are about pay, jobs or training ("' + qs[0].replace(/["\u201c\u201d]/g, '') + '")');
  if (rp) signals.push(careerVar.length + ' of the ' + variants.length + ' related searches are about jobs, pay or courses');
  if (points < 1.5) return { career: false, points, signals, detail: '', why: 'not enough evidence' };
  // KW-GATE (review 5): questions and related searches alone never make a career search: at least one job, salary or course page must rank for it
  if (!careerDom.length) return { career: false, points, signals, detail: '', why: 'no job, salary or course page ranks for it' };
  return { career: true, points, signals, why: '',
    detail: 'people searching it are mostly looking for work or training, not for a provider: ' + signals.join('; ') };
}
// ctx: { intent, own_domain, competitors: [domains, declared], serp_domains: [domains on the results page / auto-detected rivals], brands: { name: domain } (learned),
//       serp: [this keyword's own top domains, in rank order] (optional), protect: [words of the head term / seeds / services], relevance: fn (G19 hook) }
// F-10 (production review 2026-11-12, section 189): a search for one website by its ADDRESS ("zylo com", "zylo.com", "www zylo", "zylo co uk")
// is navigational whatever the search data says: people want that site, not a page of yours (the Recommendations told a client to move
// "otherbrand com" into the top 3). The same rule as the web app's addressSearchLabel (app/shared/src/search-advice.ts). "net" is left out
// ("asp net" is a subject), and so are "node.js" / "asp.net" (js and net are not a top-level domain people type here).
// Kept identical in effect to the app's addressSearchLabel after its review (2026-11-12): the whole search is a host ("zylo.com"); a name
// followed by com / net / org (org only after one word) or by "co" and a country ("zylo com pk", "zylo co uk"); "www" and one name. "info",
// "io" and "ai" as a separate word never ("vat info", "generative ai"); the label must be a distinctive name (4+ letters, the gate's own
// label rule), so "erp com", "company info", "non profit org" and "socket.io developers" are subjects, not addresses.
const FIT_CC = 'uk|ae|in|za|nz|au|pk|sa|qa|om|kw|bh|eg|jp|sg|my';
const FIT_HOST_ONLY = new RegExp('^(?:https?://)?(?:www\\.)?([a-z0-9-]+)\\.(?:com|net|org|io|ai|co|ae|sa|pk|qa|om|kw|bh|eg|in|uk|us|de|fr)(?:\\.(?:' + FIT_CC + '))?(?:/\\S*)?$');
const FIT_NAME_TAIL = new RegExp('^(\\S+(?:\\s\\S+)?)\\s(com|net|org|co)(?:\\s(' + FIT_CC + '))?$');
/** a search for one website by its address: the label typed ("zylo"), or '' (own = the site's own label, always an address of it) */
const fitAddressLabel = (query, own) => {
  let q = String(query == null ? '' : query).replace(/\s+/g, ' ').trim().toLowerCase();
  if (!q) return '';
  const www = /^www(\s|\.)/.test(q) && !/^www\.[a-z0-9-]+\.[a-z]/.test(q) ? (q = q.replace(/^www[\s.]+/, ''), true) : false;
  let label = '';
  const host = q.match(FIT_HOST_ONLY);
  if (host) label = host[1];
  else {
    const t = q.match(FIT_NAME_TAIL);
    if (t) { const words = t[1].split(' '); const tld = t[2]; if ((tld === 'co' && t[3]) || (tld !== 'co' && (tld !== 'org' || words.length === 1))) label = words.join(''); }
    else if (www && /^[a-z0-9-]+$/.test(q)) label = q;
  }
  if (!label) return '';
  if (own && own.length >= 4 && label.startsWith(own)) return label;
  return label.replace(/-/g, '').length >= 4 && fitOwnLabels(label + '.example', [], []).length ? label : '';
};
function fitGate(keyword, ctx) {
  ctx = ctx || {};
  // KW-GATE (2026-10-21): an Arabic keyword is judged on its English reading (fitArabic); the sentence says how it was read
  const AR = fitArabic(String(keyword || ''));
  const kw = AR.text.toLowerCase().replace(/\s+/g, ' ').trim();
  const res = (r) => (AR.read && r && r.ok === false && r.detail && !/read as "/.test(r.detail)) ? { ...r, detail: r.detail + ' (read as "' + AR.text + '")' } : r;
  const toks = fitTokens(kw); const squashed = toks.join('');
  if (!toks.length) return { ok: false, reason: 'empty', detail: 'no keyword' };
  const protect = [...new Set((ctx.protect || []).flatMap(p => fitTokens(p)))];
  const decl = fitDeclared(ctx);
  const has = (re) => re.test(' ' + kw + ' ');
  const contentWord = has(FIT_CONTENT), partnerWord = has(FIT_PARTNER), compareWord = has(FIT_COMPARE), portalWord = has(FIT_PORTAL);
  const topicsOn = !!(ctx.topics && (Array.isArray(ctx.topics) ? ctx.topics.length : String(ctx.topics).trim()));
  const sellsWhat = fitSells(ctx.topics || []);
  // 1. the website itself
  // F-KW (2026-10-20, finding 5): only a DISTINCTIVE label is a brand. On an exact-match domain the label is made of the very words the client
  //    sells ("erp-software.ae" -> "erpsoftware"), and "erp software uae" was refused as the site's own brand (fitOwnLabels above).
  // KW-GATE (2026-10-21): a label that is also a word of what the client declared is its TOPIC as well as its name: "peppol" for peppol.org
  //    (services "Peppol network", "Peppol access point certification") made "what is peppol", "peppol access point" and "peppol uae"
  //    navigational. Such a label is judged like any other topic word; a login, a job or a course search for it is still refused below.
  const ownLabels = fitOwnLabels(ctx.own_domain, toks, protect);
  for (const l of ownLabels) if ((toks.includes(l) || squashed.includes(l)) && !decl.toks.has(l)) {
    if (has(FIT_JOBS) && !sellsWhat.jobs) return { ok: false, reason: 'job search', detail: 'people looking for work at this company (' + l + '), not buyers of what it sells' };
    return { ok: false, reason: 'own brand', detail: 'names the website itself (' + l + ')' };
  }
  // 1b. F-10 (section 189): a search for a website by its address (the website's own, or another one)
  { const own = fitHost(ctx.own_domain).split('.')[0]; const al = fitAddressLabel(kw, own); if (al) {
    return (own && (al === own || (own.length >= 4 && al.includes(own))))
      ? { ok: false, reason: 'own brand', detail: 'people looking for your own website by its address (' + kw + ')' }
      : { ok: false, reason: 'navigational', detail: 'people looking for one website by its address (' + kw + '), not for what you sell' }; } }
  // 2. the search data says navigational
  if (String(ctx.intent || '').toLowerCase() === 'navigational') return { ok: false, reason: 'navigational', detail: 'the search data classifies it as navigational (people look for one particular website)' };
  // 2b. MKT (2026-10-27, AUDIT M4): with the website's market given (ctx.market, ISO-2), a keyword that names only places outside it is a
  //     search of another market ("ai automation solutions gcc" for a Pakistan website). The keyword the client chose itself (ctx.protect,
  //     the whole keyword) is never refused here: the app asked them first, and they decided.
  if (ctx.market) {
    const mk = fitMarket(String(keyword || ''), ctx.market);
    const chosen = (ctx.protect || []).some(p => fitLow(p).replace(/\s+/g, ' ').trim() === fitLow(keyword).replace(/\s+/g, ' ').trim());
    if (!mk.ok && !chosen) return res({ ok: false, reason: 'other market', detail: 'a search about ' + fitAnd(mk.outside.map(w => '"' + w + '"')) + ', outside the market this website is measured in (' + mk.iso + ')' });
  }
  // 3. a public body or an identity document: "ministry of finance", "federal tax authority" (no content / buying word), "fta", "emaratax uae",
  //    "emirates id status" (the body alone, or with a portal / status word); "zatca e invoicing" and "fta vat registration" are topics and stay
  const govWord = (' ' + kw + ' ').match(FIT_GOV_WORDS);
  if (govWord && !contentWord) return { ok: false, reason: 'government', detail: 'a public body, not a topic (' + String(govWord[1] || govWord[0]).trim() + ')' };
  const govName = (' ' + kw + ' ').match(FIT_GOV_NAMES);
  if (govName) {
    const body = String(govName[1] || govName[0]).trim();
    const rest = toks.filter(t => !fitTokens(body).includes(t) && !FIT_GEO.has(t) && !/^(check|checking|card|number|no|online|status)$/.test(t));
    if (!rest.length || (portalWord && !contentWord)) return { ok: false, reason: 'government', detail: 'a public body or an identity document, not a topic (' + body + ')' };
    // R60 (2026-10-16, re-rating 2026-10-15): "mofa attestation dubai" and "how to check emirates id status with passport number" walked
    // through because one more word ("attestation", "passport") or a content word ("how to") made them look like a topic. A word that only
    // names what the public body does FOR A PERSON (attest a document, issue a passport or visa, renew a card, collect a fine, book an
    // appointment) adds no topic: the searcher still wants the body's own service, whatever "how to" is in front of it. "fta vat registration"
    // and "zatca e invoicing" keep a business topic word of their own, so they stay.
    if (rest.every(t => FIT_GOV_SERVICE.test(t))) return { ok: false, reason: 'government', detail: 'a service a public body provides to a person, not a topic for this website (' + body + ': ' + rest.join(' ') + ')' };
  }
  const serp = (ctx.serp || []).map(fitHost).filter(Boolean).slice(0, FIT_CFG.serp_top);
  // KW-GATE (review 2): a results page full of government sites says the searcher may want the public body, unless the keyword carries what
  //    the client declared it sells: "vat registration uae" for a VAT consultancy (tax.gov.ae, u.ae, mof.gov.ae, ey, pwc) is its own service
  const declaredHere = () => topicsOn && (toks.some(t => decl.anchors.has(t)) || fitTopic(AR.read ? keyword : kw, ctx.topics, { ...ctx, topic_min_words: 1, _decl: decl }).ok);
  if (serp.length >= FIT_CFG.serp_hold && serp.filter(fitGovHost).length >= FIT_CFG.serp_hold && !partnerWord && !declaredHere()) return { ok: false, reason: 'government', detail: 'the results page belongs to government sites (' + [...new Set(serp.filter(fitGovHost))].slice(0, 3).join(', ') + ')' };
  // B-3 (2026-10-17): what the site's own topics say it sells (empty when none are on file), for the two rules below
  const topicT = topicsOn ? fitTopicWords(ctx.topics) : null;
  const sells = (re) => !!topicT && [...topicT].some(w => re.test(w));
  // 3b. a document service a public body provides to a person, without the body's name ("uae document attestation"): refused unless the
  //     site's own topics say it sells that service (an attestation agency keeps it)
  const docSvc = toks.filter(t => FIT_DOC_SERVICE.test(t));
  if (docSvc.length && !sells(/^(attest|apostill|legali|notar)/)) {
    const restD = toks.filter(t => !FIT_GEO.has(t) && !FIT_DOC_SERVICE.test(t) && !FIT_GOV_SERVICE.test(t) && !FIT_GOV_NAMES.test(' ' + t + ' ')
      && !/^(online|services?|centre|center|centres|centers|near|price|prices|cost|costs|company|companies|agency|agencies|best|top|cheap|fast|same|day|requirements?|procedure|process|steps)$/.test(t));
    if (!restD.length) return { ok: false, reason: 'government', detail: 'a document service public bodies (a ministry, an embassy, a notary) provide to a person (' + docSvc.join(' ') + '), not a topic for this website' };
  }
  // 4. a login / portal / status task
  if (portalWord && !contentWord) return { ok: false, reason: 'portal', detail: 'a login, portal, status or application task: people want the owner\'s own site' };
  // 4b. a person looking for work (B-3): no product word in it, and the site's topics are not recruitment
  //     (KW-GATE review 8: manpower, employment agencies, executive search and placements are recruitment too)
  if (has(FIT_JOBS) && !has(FIT_PRODUCT) && !sellsWhat.jobs && !sells(/^(recruit|staff|hiring|job|career|headhunt|talent)/)) return res({ ok: false, reason: 'job search', detail: 'people looking for work, not buyers of what this website sells' });
  //     KW-GATE: a person looking for a course for themselves ("netsuite certification course"), unless the client sells training
  if (has(FIT_COURSE_ONLY) && !has(FIT_PRODUCT) && !has(FIT_BUYER_KW) && !sellsWhat.courses) return res({ ok: false, reason: 'job search', detail: 'people looking for a course or a certificate for themselves, not buyers of what this website sells' });
  // 4c. the same, read from the keyword's results page when the caller has it (E-GATE RV-11: ctx.career = { pages, paa, related })
  if (ctx.career && typeof ctx.career === 'object') { const c = fitCareer(kw, { ...ctx.career, topics: ctx.career.topics || ctx.topics || [] }); if (c.career) return { ok: false, reason: 'job search', detail: c.detail, career: c }; }
  // 5. another company's brand. A declared competitor's label counts anywhere in the keyword; a results-page label (often a dictionary word:
  //    facts.ae) only where a product name sits — first, or right before a category word ("facts erp", "best facts erp"; not "erp facts and figures")
  const rescue = partnerWord || compareWord;
  const leads = (l) => { const i = toks.indexOf(l); return i === 0 || (i > 0 && i + 1 < toks.length && (FIT_GENERIC.has(toks[i + 1]) || protect.includes(toks[i + 1]))); };
  for (const d of (ctx.competitors || [])) for (const l of fitLabels(d, protect)) if ((toks.includes(l) || squashed.includes(l)) && !compareWord) return { ok: false, reason: 'other brand', detail: 'names a competitor: ' + l + ' (' + fitHost(d) + ')' };
  for (const d of (ctx.serp_domains || [])) for (const l of fitLabels(d, protect)) if (toks.includes(l) && leads(l) && !rescue) return { ok: false, reason: 'other brand', detail: 'names another company on the results page: ' + l + ' (' + fitHost(d) + ')' };
  // E-GATE (2026-10-21, pre-launch run RV-7): a learned name counts only through its DISTINCTIVE words. "Microsoft UAE" (seo_cache ai_brands:)
  // lost "microsoft" as a generic word and kept "uae", so every "... uae" keyword without a partner word ("ai for finance operations uae", "erp
  // software uae") was refused as "a brand of Microsoft UAE" in research, ladders, AI Growth and the pulse. Place, generic, category and common
  // words and numbers are never a brand's own part; a name with nothing else left is ignored here, so a stored bad name is harmless on read.
  for (const [name, d] of Object.entries(ctx.brands || {})) {
    const nt = fitTokens(name).filter(t => !FIT_GENERIC.has(t) && !FIT_GEO.has(t) && !FIT_WIDE.has(t) && !FIT_CATEGORY.has(t) && !FIT_COMMON.has(t) && !FIT_BUYER.has(t)
      && !/^\d+$/.test(t) && !protect.includes(t));
    if (!nt.length || !nt.some(t => t.length >= 3) || rescue) continue;
    const phrase = nt.join(' ');
    if ((' ' + toks.join(' ') + ' ').includes(' ' + phrase + ' ') || fitLabels(d, protect).some(l => toks.includes(l))) return { ok: false, reason: 'other brand', detail: 'a brand AI names for another company: ' + name + ' (' + fitHost(d) + ')' };
  }
  if (serp.length >= FIT_CFG.serp_hold) {
    const count = {}; for (const h of serp) count[h] = (count[h] || 0) + 1;
    for (const [h, n] of Object.entries(count)) if (n >= FIT_CFG.serp_hold && fitLabels(h, protect).some(l => toks.includes(l))) return { ok: false, reason: 'other brand', detail: h + ' holds ' + n + ' of the top ' + serp.length + ' results: a brand query' };
  }
  // 5c. KW-GATE (review 3, 4, 14; moved here from the full report so every path decides the same): a company's own name in front of a colon
  //     ("ingoude: erp solutions dubai") or of a "number 1" claim ("ibt no 1 bpo company in middle east"). The name must be a word that is no
  //     category, place or topic word: "dynamics 365: business central pricing" and "no 1 erp company in uae" are searches for what the client sells.
  const nameWords = (s) => fitTokens(s).filter(t => !FIT_GENERIC.has(t) && !FIT_GEO.has(t) && !FIT_WIDE.has(t) && !FIT_BUYER.has(t) && !/^[\d.]+$/.test(t)
    && !decl.toks.has(t) && !protect.includes(t) && !(topicT && topicT.has(fitStem(t))));
  // only a short name (one or two words) of a keyword, never a question ("Odoo or Business Central: which ERP ...?" is a comparison)
  const colon = String(keyword || '').includes('?') ? null : kw.match(/^([\p{L}\p{N}&.' -]{2,24}):\s+\S/u);
  if (colon && fitTokens(colon[1]).length <= 2 && !compareWord && !/\bor\b/.test(colon[1]) && nameWords(colon[1]).length) return res({ ok: false, reason: 'other brand', detail: 'starts with a company\'s own name (' + nameWords(colon[1]).join(' ') + '), not a topic' });
  const claim = kw.match(/^(.*?)(?:^|\s)(no\.? ?1|number (?:one|1)|#1)(?=\s|$)/);
  if (claim && nameWords(claim[1]).length) return res({ ok: false, reason: 'other brand', detail: 'a company\'s own "number 1" claim (' + nameWords(claim[1]).join(' ') + '), not a topic' });
  // 5d. a list of companies in ANOTHER industry ("top facilities management companies uae"), judged even when few topic words are on file;
  //     category words are neutral ("best erp companies in dubai" is judged by the topic rule below)
  const list = kw.match(/^(?:top|best|leading|biggest|largest)\s+(?:\d+\s+)?(.+?)\s+(?:companies|firms|providers|agencies|suppliers|contractors)\b/);
  if (list && topicT && topicT.size) {
    const T2 = new Set([...topicT, ...decl.words]);
    const w = fitTokens(list[1]).filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !decl.anchors.has(t) && !/^[\d.]+$/.test(t));
    const hit = (t) => { const st = fitStem(t); return T2.has(st) || [...T2].some(x => x.length >= 5 && st.length >= 5 && (st.indexOf(x) === 0 || x.indexOf(st) === 0)); };
    if (w.length && !w.some(hit)) return res({ ok: false, reason: 'off topic', detail: 'a list of companies in another industry (' + w.join(' ') + '), nothing this website sells' });
  }
  // 6. relevance to the website's services: the caller's own hook (G19) first, else the topic bar when the caller gave topics (R13)
  if (typeof ctx.relevance === 'function') { const r = ctx.relevance(kw); if (r && r.ok === false) return res({ ok: false, reason: r.reason || 'off topic', detail: r.detail || '' }); }
  else if (topicsOn) {
    const t = fitTopic(AR.read ? keyword : kw, ctx.topics, { ...ctx, _decl: decl });
    if (!t.ok) {
      // KW-GATE: off topic only BECAUSE every word of its own is another vendor's product ("netsuite pricing", "meta ai", "cleartax vs zoho"):
      // the client reads the real reason, another company's brand
      const ownW = toks.filter(x => x.length > 2 && !FIT_GEO.has(x) && !FIT_GENERIC.has(x) && !FIT_BUYER.has(x) && !/^[\d.]+$/.test(x));
      const vs = ownW.length && t.reason === 'off topic' ? ownW.map(x => fitVendor([x], decl, ownLabels)) : [];
      if (vs.length && vs.every(Boolean)) return res({ ok: false, reason: 'other brand', detail: 'names ' + [...new Set(vs.map(v => v.name))].join(' and ') + ', another company\'s product or firm, which is not among what you sell' });
      return res({ ok: false, reason: t.reason, detail: t.detail });
    }
  }
  // 7. KW-GATE (2026-10-21): a product or a firm of ANOTHER vendor the client did not declare ("netsuite pricing" and "sap implementation dubai"
  //     for a Dynamics 365 partner, "storecove pricing" for peppol.org, "tech consultant deloitte"). A comparison is a topic of its own and stays
  //     ("dynamics 365 vs sap business one"); the client's own products never count (its services, business line, chosen keywords, domain).
  //     No evidence, no refusal: only with the client's services, or 12+ topic words, on file. It runs after the topic rule, so a keyword that is off topic anyway keeps that reason (the app's port of this gate, app/shared/src/fit-gate.ts, and the shared cadence fixture agree on it).
  if (!compareWord && ((topicT && topicT.size >= 12) || (Array.isArray(ctx.services) && ctx.services.filter(Boolean).length))) { const v = fitVendor(toks, decl, ownLabels.length ? ownLabels : fitLabels(ctx.own_domain, [])); if (v) return res({ ok: false, reason: 'other brand', detail: 'names ' + v.name + ', another company\'s product or firm, which is not among what you sell' }); }
  return { ok: true };
}
// one line for reports and prompts: "facts (facts.ae), cleartax (cleartax.com), Zoho Books (zoho.com)"
const fitBrandList = (ctx, protect) => { const out = []; const seen = new Set(); const add = (s) => { if (s && !seen.has(s)) { seen.add(s); out.push(s); } };
  for (const d of (ctx.competitors || [])) for (const l of fitLabels(d, protect)) add(l + ' (' + fitHost(d) + ')');
  for (const d of (ctx.serp_domains || [])) for (const l of fitLabels(d, protect)) add(l + ' (' + fitHost(d) + ')');
  for (const [n, d] of Object.entries(ctx.brands || {})) add(n + ' (' + fitHost(d) + ')');
  return out.slice(0, 40).join(', '); };
// ---- R16 (2026-10-13, system review FIX_PLAN §3.11): the same gate, run over a row somebody stored BEFORE the gate existed ----
// The gate stops a new keyword, but nothing ever revisited the rows already in `seo_ladders`: rung 2 of lad_mv40b6s9h5a8 still held
// "facts erp" (facts.ae, a competing UAE ERP vendor) as a planned page, so the Rank Tracker's report of 2026-10-12 listed it and the
// Content Cadence would have written it. `fitStored` is `fitGate` plus the one rule a stored row needs: a rung whose page is already
// written or published is never dropped — that page is live work, it keeps being tracked, and it is flagged instead of hidden.
// Returns { ok, live, flagged, reason, detail, note }: ok false = leave it out of what is written and reported; `note` is the sentence
// a report or the repair script prints, so the reason always travels with the decision.
const fitStoredLive = (row) => { const r = row || {}; const st = String(r.status || '').toLowerCase();
  return st === 'writing' || st === 'written' || st === 'not_ready' || st === 'published' || r.page_exists === true || r.page_exists === 'true' || !!String(r.published_url || '').trim(); };
const fitStored = (row, ctx) => {
  const r = row || {}; const kw = String(r.keyword || '').trim();
  const live = fitStoredLive(r) || (ctx || {}).written === true;
  if (!kw) return { ok: false, live, flagged: false, reason: 'empty', detail: 'the row has no keyword', note: 'a stored row with no keyword' };
  const g = fitGate(kw, ctx || {});
  if (g.ok) return { ok: true, live, flagged: false, reason: '', detail: '', note: '' };
  const why = '"' + kw + '" is not a search this website should target: ' + g.detail + ' (' + g.reason + ')';
  // F-KW (2026-10-20, finding 10): plain sentences, and no claim about WHEN the row was planned: a row written after the gate existed (its
  // results page changed, a competitor was declared later) is set aside by the same rule, and "planned before this rule existed" was false for it
  if (live) return { ok: true, live: true, flagged: true, reason: g.reason, detail: g.detail,
    note: why + '. Its page is already written, so it stays tracked; decide whether to keep it.' };
  return { ok: false, live: false, flagged: true, reason: g.reason, detail: g.detail,
    note: why + '. It is set aside, so no page is written for it.' };
};
// ---- B-G1 / B-G2 / B-G3 (2026-10-15, FIX_PLAN §3.16; INVARIANTS rule 2): the READ path, written once ----
// R16 put `fitStored` on two read paths — the Rank Tracker and the Content Cadence — and wrote the loop around it twice. Three more
// readers of the same stored rungs were written afterwards without it, and every one of them ACTS on what it reads: *AI Plan* (the AI
// Visibility Tracker and the AI Pulse) turns a stored rung into a question asked of ChatGPT and then scores the site against the answer;
// *Growth Plan* turns it into a "question to win" and then into a page the Content Cadence writes; *Site Plan* buys it a live rank check
// every week and prints it in the weekly report. Three copies of one loop are three chances to drift, and the drift IS this defect — so
// the loop lives here, once, and every reader calls it. FITR.rungs() never throws a refusal away: `set_aside` carries the row, the reason
// and the sentence to print, because a list that is shorter because a gate ran has to say so (INVARIANTS rule 1).
const FITR = {
  // The context a stored row is judged in. Deliberately the shape R16's two callers build by hand: the site's own domain, the
  // competitors it declared, the brand names AI uses for other companies, and — PROTECTED, so the ladder's own subject can never look
  // like somebody's brand — the ladder head terms, the site's services and its own tracked keywords. Topics are optional: with none on
  // file the topic bar judges nothing (fitTopic's own "no evidence, no refusal" rule).
  ctx(o) {
    o = o || {};
    const own = fitHost(o.own_domain || o.domain || '');
    const protect = [...new Set([...(o.heads || []), ...(o.services || []), ...(o.keywords || []), ...(o.protect || [])]
      .map(x => String(x || '').trim()).filter(Boolean))];
    return { own_domain: own, brands: o.brands || {}, intent: o.intent || '',
      competitors: [...new Set((o.competitors || []).map(fitHost).filter(d => d && d !== own))],
      serp_domains: (o.serp_domains || []).map(fitHost).filter(Boolean), protect,
      topics: o.topics && (Array.isArray(o.topics) ? o.topics.length : String(o.topics).trim()) ? o.topics : null,
      topic_label: o.topic_label || 'what this website sells' };
  },
  // Every stored row, gated once. Returns { keep, set_aside, dropped, flagged, refused_keywords }:
  //   keep      — what the caller may act on (a row whose page is already written stays: that page is live work);
  //   set_aside — one record per refusal, with `reason`, `detail`, `note` (the sentence to print), `written` and `dropped`.
  // opts: { keyword: row -> the keyword (default row.keyword), live: row -> true when the row must be kept and only flagged,
  //         serpFor: (keyword, row) -> [domains in rank order] for the results-page rules, where: a label naming this read path }.
  rungs(rows, ctx, opts) {
    const o = opts || {}; const C = ctx || {};
    const kwOf = typeof o.keyword === 'function' ? o.keyword : ((r) => (r || {}).keyword);
    const liveOf = typeof o.live === 'function' ? o.live : null;
    const serpFor = typeof o.serpFor === 'function' ? o.serpFor : null;
    const keep = []; const set_aside = [];
    for (const r0 of (rows || [])) {
      const r = (r0 && typeof r0 === 'object') ? r0 : {};
      const kw = String(kwOf(r0) || '').trim();
      if (!kw) { keep.push(r0); continue; }   // a row with no keyword is not this gate's business (the caller's own emptiness rules apply)
      const serp = serpFor ? (serpFor(kw, r0) || []).map(fitHost).filter(Boolean) : [];
      let c = C;
      if (serp.length) c = { ...c, serp, serp_domains: [...new Set([...(C.serp_domains || []), ...serp])] };
      if (liveOf && liveOf(r0)) c = { ...c, written: true };
      const g = fitStored({ ...r, keyword: kw }, c);
      if (g.ok) keep.push(r0);
      if (!g.flagged) continue;
      set_aside.push({ keyword: kw, reason: g.reason, detail: g.detail, note: g.note, written: !!g.live, dropped: !g.ok,
        where: String(o.where || ''), ladder_id: r.ladder_id || '', head_keyword: r.head_keyword || '', rung: Number(r.rung) || 0,
        page_no: Number(r.page_no) || 0, status: r.status || '', target_url: r.target_url || '', prompt_id: r.prompt_id || '' });
    }
    return { keep, set_aside, dropped: set_aside.filter(x => x.dropped), flagged: set_aside.filter(x => !x.dropped),
      refused_keywords: set_aside.filter(x => x.dropped).map(x => x.keyword) };
  },
  // The sentence a human reads. INVARIANTS rule 1: a list that is shorter because a gate ran says so, with the reason, every time.
  // `what` finishes "so they are not …" ("asked of the AI engines", "tracked", "written as a page").
  line(set_aside, what) {
    const a = (set_aside || []).filter(x => x && x.dropped);
    if (!a.length) return '';
    return a.length + ' stored keyword' + (a.length === 1 ? ' was' : 's were') + ' set aside, so ' + (a.length === 1 ? 'it is' : 'they are')
      + ' not ' + String(what || 'used') + ': ' + a.slice(0, 6).map(x => '"' + x.keyword + '" (' + (x.detail || x.reason) + ')').join('; ')
      + (a.length > 6 ? ' (and ' + (a.length - 6) + ' more)' : '')
      + '. A page that is already written is kept and only flagged.';
  }
};
// ---- W2-E2 (2026-10-23, docs/ai-visibility-2026-10-23/fixes/W2-E2.md): measurement a statistician would sign (inlined by build_monitors.py) ----
// The answers to ONE question are correlated: the same question asked of five engines on seven mornings tends to name the same businesses,
// so 35 such answers are not 35 independent trials. Every interval below treats the QUESTION as the sampling unit (the cluster):
//   prop()   a rate: Wilson's interval on the effective sample size n / deff, the design effect deff = (cluster-robust variance over questions)
//            / (binomial variance), floored at 1, with Korn & Graubard's degrees-of-freedom correction (n* = n_eff x (z / t_{questions-1})^2)
//            so a panel of 8 questions is not read as if its between-question variance were known. A rate of 0% or 100% has no variance to
//            measure: its design effect is BORROWED from the other rates of the same answers (the competitors' named rates; `basis`
//            says so), and with nothing to borrow from it assumes the answers to one question all agree (rho = 1, the widest honest range).
//   ratio()  a share or a mean (share of voice, mean normalised position, net sentiment): the linearised ratio estimator over QUESTION
//            totals, its standard error times t_{questions-1}.
//   boot()   a seeded (deterministic) bootstrap over questions, optionally two-level (questions, then the answers within each question)
//            - used where a closed form does not exist (difference in differences, harness/simulation comparisons).
// The choice of prop() for the headline was made by the harness simulation (W2E2-SIM: coverage of the 95% interval on clustered data with a
// known rate) and its speed at 500 questions x 9 engines (W2E2-SPEED); both are printed by the harness and written in W2-E2.md.
const AVX = (() => {
  const Z = 1.959963985;
  const r1 = (x) => Math.round(10 * x) / 10;
  const r3 = (x) => Math.round(1000 * x) / 1000;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const has = (v) => v !== undefined && v !== null && v !== '';
  const parse = (v, d) => { if (v && typeof v === 'object') return v; if (!has(v)) return d; try { const x = JSON.parse(String(v)); return x == null ? d : x; } catch (e) { return d; } };
  /** FNV-1a: a seed from a string (the site and run), so the same run always gives the same bootstrap */
  const hash = (s) => { let h = 2166136261 >>> 0; const t = String(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  /** mulberry32: a small, fast, seeded uniform generator in [0, 1) */
  const rng = (seed) => { let a = (typeof seed === 'number' ? seed : hash(seed)) >>> 0; if (!a) a = 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  // Student's t, 97.5% quantile: exact table to 30 degrees of freedom, the Cornish-Fisher expansion above (error < 0.001)
  const TT = [null, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
  const t975 = (df) => { const v = Math.floor(Number(df)); if (!(v >= 1)) return null; if (v <= 30) return TT[v]; const z = Z, z3 = z * z * z, z5 = z3 * z * z, z7 = z5 * z * z, z9 = z7 * z * z;
    return z + (z3 + z) / (4 * v) + (5 * z5 + 16 * z3 + 3 * z) / (96 * v * v) + (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * v * v * v) + (79 * z9 + 776 * z7 + 1482 * z5 - 1920 * z3 - 945 * z) / (92160 * v * v * v * v); };
  /** Wilson's interval for a proportion p on a (possibly non-integer, effective) sample size n, in percent */
  const wilsonN = (p, n, z) => { const zz = z || Z; if (!(n > 0)) return [null, null]; const d = 1 + zz * zz / n, c = p + zz * zz / (2 * n), m = zz * Math.sqrt(Math.max(0, p * (1 - p)) / n + zz * zz / (4 * n * n));
    return [Math.max(0, r1(100 * (c - m) / d)), Math.min(100, r1(100 * (c + m) / d))]; };
  const NONE = (why) => ({ rate: null, lo: null, hi: null, k: 0, n_answers: 0, n_questions: 0, deff: null, rho: null, df: null, n_eff: null, basis: 'not_available', why: why || 'no answer' });
  /** a rate over answers clustered by question. pick(u) -> true / false / null (null: not counted). o.q: the cluster key (default prompt_id);
   *  o.rho: a borrowed intra-question correlation for a rate with no variance of its own. */
  const prop = (units, pick, o) => { const opt = o || {}; const qOf = opt.q || ((u) => u.prompt_id);
    const G = new Map(); let K = 0, M = 0;
    for (const u of (units || [])) { const y = pick(u); if (y == null) continue; const key = String(qOf(u)); const g = G.get(key) || [0, 0]; if (y) { g[0]++; K++; } g[1]++; M++; G.set(key, g); }
    if (!M) return NONE('no answer');
    const C = G.size, p = K / M; let S2 = 0, Mw = 0; for (const [k, m] of G.values()) { S2 += (k - p * m) * (k - p * m); Mw += m * m; }
    const mbar = Mw / M;                                   // the answers-weighted mean answers per question (the design effect's m)
    const vSrs = p * (1 - p) / M, vClu = C > 1 ? (C / (C - 1)) * S2 / (M * M) : null;
    const deffRaw = vClu != null && vSrs > 0 ? vClu / vSrs : null;
    let deff, rho = null, basis = 'measured';
    if (deffRaw != null) { deff = Math.max(1, deffRaw); rho = mbar > 1 ? clamp((deffRaw - 1) / (mbar - 1), 0, 1) : 0; }
    else { const rb = opt.rho != null && isFinite(opt.rho) ? clamp(Number(opt.rho), 0, 1) : 1; deff = 1 + Math.max(0, mbar - 1) * rb; rho = rb; basis = opt.rho != null ? 'borrowed' : 'assumed'; }
    const df = Math.max(1, C - 1), t = t975(df), nEff = M / deff, nStar = Math.min(M, nEff * (Z / t) * (Z / t));
    const ci = wilsonN(p, nStar);
    return { rate: r1(100 * p), lo: ci[0], hi: ci[1], k: K, n_answers: M, n_questions: C, deff: r3(deff), rho: rho == null ? null : r3(rho), df, n_eff: r1(nStar), basis,
      why: basis === 'measured' ? '' : basis === 'borrowed' ? 'no variation of its own (' + K + ' of ' + M + '): its design effect is borrowed from the other rates of the same answers'
        : 'no variation of its own (' + K + ' of ' + M + ') and nothing to borrow from: the range assumes the answers to one question all agree' }; };
  /** a share or a mean over answers clustered by question: yx(u) -> [y, x] or null. Ratio estimator R = sum y / sum x over question totals.
   *  o.scale: 100 for a share in percent; o.lo0 / o.hi0: the bounds the ratio cannot cross. */
  const ratio = (units, yx, o) => { const opt = o || {}; const qOf = opt.q || ((u) => u.prompt_id); const sc = opt.scale == null ? 1 : opt.scale;
    const G = new Map(); let Y = 0, X = 0, n = 0;
    for (const u of (units || [])) { const v = yx(u); if (!v || !(v[1] > 0)) continue; const key = String(qOf(u)); const g = G.get(key) || [0, 0]; g[0] += v[0]; g[1] += v[1]; G.set(key, g); Y += v[0]; X += v[1]; n++; }
    if (!X) return { value: null, lo: null, hi: null, n: 0, n_questions: 0, df: null, se: null, basis: 'not_available' };
    const C = G.size, R = Y / X; let S2 = 0; for (const [y, x] of G.values()) S2 += (y - R * x) * (y - R * x);
    const df = Math.max(1, C - 1), t = t975(df);
    const se = C > 1 ? Math.sqrt((C / (C - 1)) * S2) / X : null;
    const lo0 = opt.lo0 == null ? -Infinity : opt.lo0, hi0 = opt.hi0 == null ? Infinity : opt.hi0;
    if (se == null || se === 0) return { value: Math.round(1000 * sc * R) / 1000, lo: null, hi: null, n, n_questions: C, df, se: se == null ? null : 0, basis: 'not_available',
      why: C < 2 ? 'one question only: there is no between-question variation to measure a range from' : 'every question gives the same figure, so no range can be measured' };
    return { value: Math.round(1000 * sc * R) / 1000, lo: Math.round(1000 * sc * Math.max(lo0, R - t * se)) / 1000, hi: Math.round(1000 * sc * Math.min(hi0, R + t * se)) / 1000, n, n_questions: C, df, se: Math.round(1e5 * sc * se) / 1e5, basis: 'measured' }; };
  /** a seeded bootstrap. groups: [[unit, ...], ...] (one array per question). stat(sample) -> number | null over a list of groups.
   *  o.B (default 1000), o.seed, o.two (also resample the answers within each question). Percentile interval. */
  const boot = (groups, stat, o) => { const opt = o || {}; const B = opt.B || 1000; const R = rng(opt.seed == null ? 1 : opt.seed); const G = (groups || []).filter(g => g && g.length); const C = G.length;
    if (!C) return { lo: null, hi: null, B: 0, ok: 0 };
    const vals = []; for (let b = 0; b < B; b++) { const s = new Array(C);
      for (let i = 0; i < C; i++) { const g = G[Math.floor(R() * C)]; if (opt.two) { const m = g.length, h = new Array(m); for (let j = 0; j < m; j++) h[j] = g[Math.floor(R() * m)]; s[i] = h; } else s[i] = g; }
      const v = stat(s); if (v != null && isFinite(v)) vals.push(v); }
    vals.sort((a, b) => a - b); const q = (f) => vals.length ? vals[Math.min(vals.length - 1, Math.max(0, Math.floor(f * vals.length)))] : null;
    return { lo: q(0.025), hi: q(0.975), B, ok: vals.length }; };
  /** a binomial draw (two-level bootstrap within a question without building arrays) */
  const binom = (R, m, p) => { let k = 0; for (let j = 0; j < m; j++) if (R() < p) k++; return k; };

  // ---- 1. ci_json: the headline intervals, clustered by question ------------------------------------------------------------------------
  /** U: the headline's answers ({ prompt_id, engine, named, cited, position, rivals }). rivalIds: the competitors whose named rates lend
   *  their design effect to a rate with no variance. Returns ci_json and the time it took. */
  const ci = (U, o) => { const opt = o || {}; const t0 = Date.now(); const units = (U || []).filter(u => u && u.answered !== false);
    // rho to lend: the median measured rho of the competitors' named rates (the same answers, the same clustering)
    const rhos = []; for (const id of (opt.rivalIds || []).slice(0, 12)) { const r0 = prop(units, (u) => !!(u.rivals || []).find(x => x.id === id), {}); if (r0.basis === 'measured' && r0.rho != null) rhos.push(r0.rho); }
    const cit = prop(units, (u) => !!u.cited); if (cit.basis === 'measured' && cit.rho != null) rhos.push(cit.rho);
    const nm0 = prop(units, (u) => !!u.named); if (nm0.basis === 'measured' && nm0.rho != null) rhos.push(nm0.rho);
    rhos.sort((a, b) => a - b); const lend = rhos.length ? rhos[Math.floor(rhos.length / 2)] : null;
    const P = (pick) => { const r0 = prop(units, pick, {}); return r0.basis === 'measured' ? r0 : prop(units, pick, { rho: lend }); };
    const out = { named_rate: P((u) => !!u.named), cited_rate: P((u) => !!u.cited) };
    out.first_rate = P((u) => !!u.named && u.position === 1);
    const sv = ratio(units.filter(u => u.rivals), (u) => [u.named ? 1 : 0, (u.named ? 1 : 0) + u.rivals.length], { scale: 100, lo0: 0, hi0: 1 });
    out.share_of_voice = { rate: sv.value == null ? null : r1(sv.value), lo: sv.lo == null ? null : r1(sv.lo), hi: sv.hi == null ? null : r1(sv.hi), n_answers: sv.n, n_questions: sv.n_questions, df: sv.df, basis: sv.basis, why: sv.why || '' };
    const pw = (pos) => pos === 1 ? 1 : pos === 2 ? 0.8 : pos === 3 ? 0.65 : pos > 3 && pos <= 5 ? 0.5 : pos > 5 ? 0.35 : 0.6;
    const pv = ratio(units, (u) => [u.named ? 100 * pw(u.position || 0) : 0, 1], { lo0: 0, hi0: 100 });
    out.pos_visibility = { rate: pv.value == null ? null : r1(pv.value), lo: pv.lo == null ? null : r1(pv.lo), hi: pv.hi == null ? null : r1(pv.hi), n_answers: pv.n, n_questions: pv.n_questions, df: pv.df, basis: pv.basis, why: pv.why || '' };
    const ap = ratio(units.filter(u => u.named && u.position), (u) => [u.position, 1], { lo0: 1 });
    out.avg_position = { rate: ap.value == null ? null : r1(ap.value), lo: ap.lo == null ? null : r1(ap.lo), hi: ap.hi == null ? null : r1(ap.hi), n_answers: ap.n, n_questions: ap.n_questions, df: ap.df, basis: ap.basis, why: ap.why || '' };
    // the plain Wilson the report used to print, kept beside each rate so the difference is visible (it treats every answer as independent)
    for (const k of ['named_rate', 'cited_rate', 'first_rate']) { const x = out[k]; if (x && x.n_answers) { const w = wilsonN(x.k / x.n_answers, x.n_answers); x.wilson_naive = w; } }
    const byEngine = {}; for (const e of [...new Set(units.map(u => u.engine))].sort()) { const eu = units.filter(u => u.engine === e); const r0 = prop(eu, (u) => !!u.named); const r1_ = r0.basis === 'measured' ? r0 : prop(eu, (u) => !!u.named, { rho: lend });
      const c0 = prop(eu, (u) => !!u.cited); byEngine[e] = { named_rate: { lo: r1_.lo, hi: r1_.hi, n_answers: r1_.n_answers, n_questions: r1_.n_questions, deff: r1_.deff, basis: r1_.basis }, cited_rate: { lo: c0.basis === 'measured' ? c0.lo : prop(eu, (u) => !!u.cited, { rho: lend }).lo, hi: c0.basis === 'measured' ? c0.hi : prop(eu, (u) => !!u.cited, { rho: lend }).hi, n_answers: c0.n_answers, n_questions: c0.n_questions } }; }
    const nq = new Set(units.map(u => String(u.prompt_id))).size;
    return { method: 'design-effect', level: 95, headline: out, by_engine: byEngine, rho_lent: lend, questions: nq, answers: units.length, ms: Date.now() - t0,
      note: 'Ranges treat the question as the sampling unit: answers to one question (across engines and mornings) repeat each other, so they count as fewer independent answers (the design effect). '
        + (out.named_rate.deff != null ? '"Named in" rests on ' + units.length + ' answers to ' + nq + ' questions, worth about ' + out.named_rate.n_eff + ' independent answers (design effect ' + out.named_rate.deff + ').' : '') }; };

  // ---- 2. the 28-day window: units of earlier weekly runs (units_json) and of the daily pulse (detail_json) --------------------------------
  /** the compact per-answer record a weekly row stores (units_json): questions and engines indexed once */
  // FX-B RB-1 (2026-11-06): `er` = the entity rule the competitors were counted under (AIE.RULE); a reader with another rule keeps the answer's
  // named / cited / place but drops its competitors (null = not recorded under this rule)
  const packUnits = (units, at, rule, er) => { const qs = [], es = [], ents = []; const ix = (arr, v) => { let i = arr.indexOf(v); if (i < 0) { arr.push(v); i = arr.length - 1; } return i; };
    const a = (units || []).map(u => [ix(qs, String(u.prompt_id)), ix(es, String(u.engine)), u.named ? 1 : 0, u.cited ? 1 : 0, u.position || null, u.rivals ? u.rivals.map(x => [ix(ents, String(x.id)), x.position || null, x.cited ? 1 : 0]) : null]);
    return { v: 1, rule_version: rule, ...(er ? { entity_rule: er } : {}), at, q: qs, e: es, ents, a }; };
  const unpackUnits = (raw) => { const x = parse(raw, null); if (!x || !Array.isArray(x.a)) return null; const q = x.q || [], e = x.e || [], ents = x.ents || [];
    return { rule_version: String(x.rule_version || ''), entity_rule: String(x.entity_rule || ''), at: String(x.at || ''), units: x.a.filter(Array.isArray).map(a => ({ prompt_id: String(q[a[0]]), engine: String(e[a[1]]), named: !!a[2], cited: !!a[3], position: Number(a[4]) > 0 ? Number(a[4]) : null,
      rivals: Array.isArray(a[5]) ? a[5].map(r => ({ id: String(ents[(r || [])[0]] || ''), position: Number((r || [])[1]) > 0 ? Number(r[1]) : null, cited: !!(r || [])[2] })).filter(r => r.id) : null, answered: true })) }; };
  /** a pulse morning's per-answer record (Pulse Metrics' detail_json) as units */
  const pulseUnits = (detail, er) => { const D = parse(detail, null); if (!D || !Array.isArray(D.a)) return []; const ents = Array.isArray(D.ents) ? D.ents : []; const keepR = !er || String(D.entity_rule || '') === er;
    return D.a.filter(Array.isArray).map(a => ({ prompt_id: String(a[0]), engine: String(a[1]), named: !!a[2], cited: !!a[3], position: Number(a[4]) > 0 ? Number(a[4]) : null, pulse: true, answered: true,
      rivals: keepR && Array.isArray(a[5]) ? a[5].map(x => ({ id: String(ents[(x || [])[0]] || ''), position: Number((x || [])[1]) > 0 ? Number(x[1]) : null, cited: !!(x || [])[2] })).filter(x => x.id) : null })); };
  /** every dated answer of the site under the current rule in (from, to]: this run's weekly units, earlier weekly rows' units_json, the pulse
   *  mornings' detail_json. Each pulse morning counts once (by its row), the weekly answers once (by their run). */
  const history = (o) => { const opt = o || {}; const rule = opt.rule; const from = Date.parse(opt.from), to = Date.parse(opt.to); const inW = (t) => { const x = Date.parse(t); return isFinite(x) && x > from && x <= to; };
    const out = []; const runs = [], left = { weekly_rows: 0, pulse_rows: 0 }; let pulseDays = new Set();
    for (const u of (opt.now_units || [])) out.push({ ...u, at: opt.now_at });
    if (opt.now_units && opt.now_units.length) runs.push({ run_id: opt.now_run || '', at: opt.now_at });
    for (const r of (opt.vis_rows || [])) { if (!r || r.run_id === opt.now_run || !inW(r.checked_at)) continue; const x = unpackUnits(r.units_json); if (!x || x.rule_version !== rule) { left.weekly_rows++; continue; }
      runs.push({ run_id: String(r.run_id || ''), at: String(r.checked_at) }); const keepR = !opt.entity_rule || x.entity_rule === opt.entity_rule; for (const u of x.units) out.push({ ...u, ...(keepR ? {} : { rivals: null }), at: String(r.checked_at) }); }
    const seen = new Set(); for (const d of (opt.daily_rows || [])) { if (!d || !inW(d.checked_at)) continue; const key = String(d.run_id || '') + '|' + String(d.date || '') + '|' + String(d.checked_at); if (seen.has(key)) continue; seen.add(key);
      if (String(d.rule_version || '') !== rule) { left.pulse_rows++; continue; } const us = pulseUnits(d.detail_json || d.detail, opt.entity_rule); if (!us.length) { left.pulse_rows++; continue; }
      pulseDays.add(String(d.date || String(d.checked_at).slice(0, 10))); for (const u of us) out.push({ ...u, at: String(d.checked_at) }); }
    return { units: out, runs, pulse_days: pulseDays.size, left_out: left, from: new Date(from).toISOString(), to: new Date(to).toISOString(), days: Math.round(10 * (to - from) / 864e5) / 10 }; };

  // ---- 3. share of voice over a fixed, declared set + "others" (both denominators; mean normalised position) -----------------------------
  /** U: the headline's answers (rivals canonicalised). set: the declared entity ids (canonical). selfId: the business's own id. */
  const sov = (U, o) => { const opt = o || {}; const set = [...new Set((opt.set || []).filter(Boolean))]; const selfId = opt.selfId || 'you'; const units = (U || []).filter(u => u && u.answered !== false);
    const rec = units.filter(u => Array.isArray(u.rivals));          // the answers whose businesses were recorded (an older row may not say)
    const names = (u) => (u.named ? 1 : 0) + u.rivals.length;
    const branded = rec.filter(u => names(u) > 0);
    const mentionsOf = (id) => id === selfId ? (u) => (u.named ? 1 : 0) : (u) => (u.rivals.some(x => x.id === id) ? 1 : 0);
    const totalM = branded.reduce((s, u) => s + names(u), 0);
    const share = (f) => { const r = ratio(branded, (u) => [f(u), names(u)], { scale: 100, lo0: 0, hi0: 1 }); return { share: r.value == null ? null : r1(r.value), lo: r.lo == null ? null : r1(r.lo), hi: r.hi == null ? null : r1(r.hi), basis: r.basis }; };
    const by_entity = [{ id: selfId, name: opt.selfName || selfId, self: true, n: branded.reduce((s, u) => s + (u.named ? 1 : 0), 0), ...share(mentionsOf(selfId)) }];
    for (const id of set) { if (id === selfId) continue; by_entity.push({ id, name: (opt.names || {})[id] || id, n: branded.reduce((s, u) => s + mentionsOf(id)(u), 0), ...share(mentionsOf(id)) }); }
    const othersOf = (u) => u.rivals.filter(x => !set.includes(x.id)).length;
    const others = share(othersOf); const othersN = branded.reduce((s, u) => s + othersOf(u), 0);
    const otherIds = new Map(); for (const u of branded) for (const x of u.rivals) if (!set.includes(x.id)) otherIds.set(x.id, (otherIds.get(x.id) || 0) + 1);
    const nob = prop(branded, (u) => !!u.named); const nall = prop(units, (u) => !!u.named);
    const np = ratio(rec.filter(u => u.named && u.position), (u) => { const nn = names(u); const pos = Math.min(u.position, nn); return [nn > 1 ? 1 - (pos - 1) / (nn - 1) : 1, 1]; }, { lo0: 0, hi0: 1 });
    return { set, set_source: opt.setSource || 'configured', others_share: others.share, others_lo: others.lo, others_hi: others.hi, others_n: othersN, others_top: [...otherIds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ id, n })),
      by_entity, mentions: totalM,
      denominators: { all_answers: units.length, answers_recorded: rec.length, answers_naming_any_brand: branded.length },
      named_rate_all: { rate: nall.rate, lo: nall.lo, hi: nall.hi, n: nall.n_answers },
      named_of_branded_rate: nob.rate, named_of_branded: { rate: nob.rate, lo: nob.lo, hi: nob.hi, n: nob.n_answers },
      mean_norm_position: { value: np.value == null ? null : Math.round(100 * np.value) / 100, lo: np.lo == null ? null : Math.round(100 * np.lo) / 100, hi: np.hi == null ? null : Math.round(100 * np.hi) / 100, n: np.n, n_questions: np.n_questions, basis: np.basis, why: np.why || '' },
      note: (set.length ? 'Share of voice over a fixed set you declared (' + set.length + ' competitor' + (set.length === 1 ? '' : 's') + ') plus "others" (every other business AI named), so a new rival cannot silently shrink your share.'
        : 'No competitor set is declared: every business AI named counts in "others". Declare competitors to follow them one by one.')
        + ' ' + branded.length + ' of ' + units.length + ' answers named at least one business.' }; };

  // ---- 5. did an action work: difference in differences, treated vs matched control questions ------------------------------------------
  /** hist: dated units (history()); actions: [{ action_id, kind, at, questions: [prompt ids], label }]; meta: prompt id -> { cluster, stage }.
   *  Returns impact_json. Two-level bootstrap over questions (stratified by arm), seeded by the action id. */
  const impact = (hist, actions, o) => { const opt = o || {}; const W = (opt.window_days || 28) * 864e5; const now = Date.parse(opt.now || new Date().toISOString()); const meta = opt.meta || new Map(); const MINA = opt.min_answers || 12;
    const allTreated = new Map(); for (const a of (actions || [])) for (const q of (a.questions || [])) { const s = allTreated.get(String(q)) || []; s.push(Date.parse(a.at)); allTreated.set(String(q), s); }
    const out = [];
    for (const a of (actions || []).slice(0, opt.max || 12)) { const t0 = Date.parse(a.at); if (!isFinite(t0)) continue;
      const post_to = Math.min(now, t0 + W), days_after = Math.round(10 * (post_to - t0) / 864e5) / 10;
      const pre = (u) => { const x = Date.parse(u.at); return x >= t0 - W && x < t0; }, post = (u) => { const x = Date.parse(u.at); return x > t0 && x <= post_to; };
      const byQ = new Map(); for (const u of hist) { const ph = pre(u) ? 0 : post(u) ? 1 : -1; if (ph < 0) continue; const q = String(u.prompt_id); const g = byQ.get(q) || [0, 0, 0, 0]; g[ph * 2] += u.named ? 1 : 0; g[ph * 2 + 1]++; byQ.set(q, g); }
      const T = (a.questions || []).map(String).filter(q => { const g = byQ.get(q); return g && g[1] && g[3]; });
      // controls: never treated by any action within the windows; same topic cluster first, then the same buyer stage, then any; closest
      // "before" rate; up to 3 per treated question (at least 3)
      const busy = (q) => (allTreated.get(q) || []).some(t => Math.abs(t - t0) < 2 * W);
      const pool = [...byQ.entries()].filter(([q, g]) => !busy(q) && g[1] && g[3]);
      const mt = (q) => meta.get(q) || {}; const tClusters = new Set(T.map(q => String(mt(q).cluster || ''))), tStages = new Set(T.map(q => String(mt(q).stage || '')));
      const tRate = T.reduce((s, q) => s + byQ.get(q)[0], 0) / Math.max(1, T.reduce((s, q) => s + byQ.get(q)[1], 0));
      const rank = ([q, g]) => [tClusters.has(String(mt(q).cluster || '')) ? 0 : tStages.has(String(mt(q).stage || '')) ? 1 : 2, Math.abs(g[0] / g[1] - tRate), q];
      const Cq = pool.map(e => [e[0], rank(e)]).sort((x, y) => x[1][0] - y[1][0] || x[1][1] - y[1][1] || (x[1][2] < y[1][2] ? -1 : 1)).slice(0, Math.max(3, 3 * T.length)).map(x => x[0]);
      const sumArm = (qs) => qs.reduce((s, q) => { const g = byQ.get(q); return [s[0] + g[0], s[1] + g[1], s[2] + g[2], s[3] + g[3]]; }, [0, 0, 0, 0]);
      const ta = sumArm(T), ca = sumArm(Cq);
      const rate = (k, n) => n ? r1(100 * k / n) : null;
      const row = { action_id: String(a.action_id), kind: a.kind, label: a.label || '', at: new Date(t0).toISOString(), target_questions: T, control_questions: Cq,
        before: { rate: rate(ta[0], ta[1]), n: ta[1] }, after: { rate: rate(ta[2], ta[3]), n: ta[3] }, control_before: { rate: rate(ca[0], ca[1]), n: ca[1] }, control_after: { rate: rate(ca[2], ca[3]), n: ca[3] },
        did: { effect: null, lo: null, hi: null, B: 0 }, verdict: "can't tell", why: '', window_days: opt.window_days || 28, days_after, metric: 'named_rate' };
      if (!T.length) { row.why = 'none of its questions has answers both in the 28 days before and after it'; out.push(row); continue; }
      if (!Cq.length) { row.why = 'no untreated question with answers on both sides to compare against'; out.push(row); continue; }
      if (days_after < 7) { row.why = 'too soon: ' + days_after + ' day(s) after it, a week is needed before anything can be read'; out.push(row); continue; }
      const eff = 100 * ((ta[2] / ta[3] - ta[0] / ta[1]) - (ca[2] / ca[3] - ca[0] / ca[1]));
      row.did.effect = r1(eff);
      if (Math.min(ta[1], ta[3], ca[1], ca[3]) < MINA) { row.why = 'too few answers to tell (' + ta[1] + ' / ' + ta[3] + ' treated, ' + ca[1] + ' / ' + ca[3] + ' control, before / after; ' + MINA + ' needed in each)'; out.push(row); continue; }
      // two-level bootstrap: questions with replacement within each arm, then each question's answers (binomial on its own rate) per period
      const R = rng(hash(String(opt.seed || '') + '|' + a.action_id)); const B = opt.B || 2000; const vals = [];
      const arm = (qs) => { let k0 = 0, n0 = 0, k1 = 0, n1 = 0; for (let i = 0; i < qs.length; i++) { const g = byQ.get(qs[Math.floor(R() * qs.length)]); k0 += binom(R, g[1], g[0] / g[1]); n0 += g[1]; k1 += binom(R, g[3], g[2] / g[3]); n1 += g[3]; } return k1 / n1 - k0 / n0; };
      for (let b = 0; b < B; b++) vals.push(100 * (arm(T) - arm(Cq)));
      vals.sort((x, y) => x - y); const lo = r1(vals[Math.floor(0.025 * B)]), hi = r1(vals[Math.min(B - 1, Math.floor(0.975 * B))]);
      row.did = { effect: r1(eff), lo, hi, B };
      row.verdict = lo > 0 ? 'likely helped' : hi < 0 ? 'likely hurt' : "can't tell";
      row.why = row.verdict === "can't tell" ? 'the change on its questions (' + (eff >= 0 ? '+' : '') + r1(eff) + ' points against the control questions) is inside the 95% range ' + lo + ' to ' + hi
        : 'its questions moved ' + (eff >= 0 ? '+' : '') + r1(eff) + ' points more than ' + Cq.length + ' matched control question' + (Cq.length === 1 ? '' : 's') + ' (95% range ' + lo + ' to ' + hi + '); a correlation over 28 days, not proof of cause';
      out.push(row); }
    return out; };

  // ---- 6. owner alert rules (seo_monitors.ai_alert_rules_json) --------------------------------------------------------------------------
  const METRICS = ['named_rate', 'cited_rate', 'share_of_voice', 'visibility_score', 'avg_position', 'competitor_share'];
  const SCOPES = ['engine', 'cluster', 'persona', 'market', 'competitor'];
  /** validate and normalise the owner's rules (Site Admin `monitors`); throws with the reason on the first bad rule */
  const validateRules = (raw) => { const v = Array.isArray(raw) ? raw : parse(raw, null); if (!Array.isArray(v)) throw new Error('ai_alert_rules_json must be a list of rules');
    if (v.length > 25) throw new Error('ai_alert_rules_json: at most 25 rules');
    const ids = new Set(); return v.map((r, i) => { if (!r || typeof r !== 'object') throw new Error('rule ' + (i + 1) + ' is not an object');
      const id = String(r.id || '').trim().slice(0, 60) || 'rule_' + (i + 1); if (ids.has(id)) throw new Error('rule id "' + id + '" is used twice'); ids.add(id);
      const metric = String(r.metric || '').trim(); if (!METRICS.includes(metric)) throw new Error('rule "' + id + '": metric must be one of ' + METRICS.join(', '));
      const sc = r.scope && typeof r.scope === 'object' ? r.scope : {}; const scope = {}; for (const k of Object.keys(sc)) { if (!SCOPES.includes(k)) throw new Error('rule "' + id + '": scope may only name ' + SCOPES.join(', ')); const x = String(sc[k] == null ? '' : sc[k]).trim().slice(0, 120); if (x) scope[k] = k === 'competitor' ? x.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '') : (k === 'cluster' ? x.toLowerCase() : x); }
      if (metric === 'competitor_share' && !scope.competitor) throw new Error('rule "' + id + '": competitor_share needs scope.competitor');
      if (Object.keys(scope).filter(k => k !== 'competitor').length > 1) throw new Error('rule "' + id + '": one segment at a time (engine, cluster, persona or market)');
      const direction = String(r.direction || 'any').toLowerCase(); if (!['drop', 'rise', 'any'].includes(direction)) throw new Error('rule "' + id + '": direction must be drop, rise or any');
      const th = Number(r.threshold_points); if (!(th > 0 && th <= 100)) throw new Error('rule "' + id + '": threshold_points must be a number of points above 0 (at most 100)');
      return { id, metric, scope, direction, threshold_points: r1(th), enabled: !(r.enabled === false || String(r.enabled) === 'false') }; }); };
  /** evaluate the rules on this run. ctx: { comparable, why, compare (compare_json.metrics), segRows (now: { dim, key, n, k, cited }), segPrev (Map dim|key -> { n, k, cited }),
   *  comps ([{ domain, delta: { sov, sov_p }, sov }]), engines / engPrev for an engine scope }. Holm across the rules that have a test. */
  const evalRules = (rules, ctx) => { const c = ctx || {}; const res = [];
    const mk = (r, o) => ({ rule_id: r.id, fired: false, metric: r.metric, scope: r.scope, direction: r.direction, threshold_points: r.threshold_points, delta: null, test: null, reason: '', ...(o || {}) });
    const tests = [];
    for (const r of (rules || [])) {
      if (!r.enabled) { res.push(mk(r, { reason: 'switched off' })); continue; }
      if (!c.comparable) { res.push(mk(r, { reason: 'not evaluated: this run is not comparable with the last one (' + (c.why || 'no earlier run') + ')' })); continue; }
      const segDim = ['engine', 'cluster', 'persona', 'market'].find(k => r.scope[k]);
      let d = null, z = null, why = '';
      if (r.metric === 'competitor_share') { const cp = (c.comps || []).find(x => String(x.domain).toLowerCase() === r.scope.competitor);
        if (!cp) why = r.scope.competitor + ' is not among the competitors measured this run'; else if (!cp.delta || cp.delta.sov == null) why = 'no earlier share for ' + r.scope.competitor;
        else { d = cp.delta.sov; z = cp.delta.sov_z != null ? cp.delta.sov_z : null; if (z == null) why = cp.delta.why || 'its share was not tested'; } }
      else if (segDim) { const key = String(r.scope[segDim]).toLowerCase(); const now = (c.segRows || []).find(s => s.dim === segDim && String(s.key).toLowerCase() === key); const prev = c.segPrev ? c.segPrev.get(segDim + '|' + key) : null;
        if (!['named_rate', 'cited_rate'].includes(r.metric)) why = 'only "named in" and "cited" are tested per ' + segDim + ' (the other figures carry no per-segment test)';
        else if (!now || !prev) why = 'no ' + segDim + ' "' + r.scope[segDim] + '" in both runs';
        else { const kN = r.metric === 'named_rate' ? now.k : now.cited, kB = r.metric === 'named_rate' ? prev.k : prev.cited;
          if (kN == null || kB == null || !(now.n >= 12) || !(prev.n >= 12)) why = 'too few answers in that ' + segDim + ' to test (' + (now.n || 0) + ' now, ' + (prev.n || 0) + ' before; 12 needed on each side)';
          else { const p1 = kN / now.n, p2 = kB / prev.n, pp = (kN + kB) / (now.n + prev.n), se = Math.sqrt(pp * (1 - pp) * (1 / now.n + 1 / prev.n)); d = r1(100 * (p1 - p2)); z = se ? (p1 - p2) / se / Math.sqrt(Math.max(1, Number(c.deff) || 1)) : null; if (z == null) why = 'no variation to test'; } } }
      else { const m0 = (c.compare || {})[r.metric]; if (!m0 || m0.delta == null) why = 'no comparable earlier figure'; else { d = m0.delta; if (m0.p == null) why = 'the change was not tested (too few answers)'; else z = (m0.delta >= 0 ? 1 : -1) * zOfP(m0.p); } }
      const row = mk(r, { delta: d, reason: why });
      if (z != null) tests.push({ id: r.id, z, row });
      res.push(row); }
    // Holm across the owner's tested rules: a rule set by the owner is one more family of alerts on the same sample
    const T = tests.map(t => ({ ...t, p: 2 * (1 - nCdf(Math.abs(t.z))) })).sort((a, b) => a.p - b.p); const m = T.length; let open = true;
    T.forEach((t, i) => { const thr = 0.05 / (m - i); const pass = open && t.p <= thr; if (!pass) open = false; const r = t.row; const dirOk = r.direction === 'any' || (r.direction === 'drop' ? (r.metric === 'avg_position' ? r.delta > 0 : r.delta < 0) : (r.metric === 'avg_position' ? r.delta < 0 : r.delta > 0));
      const big = Math.abs(r.delta) >= r.threshold_points;
      r.test = { z: Math.round(100 * t.z) / 100, p: Math.round(1e6 * t.p) / 1e6, threshold_p: Math.round(1e6 * thr) / 1e6, method: 'holm', tested_rules: m, passed: pass };
      r.fired = pass && dirOk && big;
      r.reason = r.fired ? 'fired: ' + (r.delta > 0 ? '+' : '') + r.delta + ' points (threshold ' + r.threshold_points + '), a real change (p ' + r.test.p + ' within the Holm-adjusted ' + r.test.threshold_p + ' across ' + m + ' tested rule' + (m === 1 ? '' : 's') + ')'
        : !pass ? 'within noise: ' + (r.delta > 0 ? '+' : '') + r.delta + ' points, p ' + r.test.p + ' above the Holm-adjusted ' + r.test.threshold_p
        : !dirOk ? 'a real change, but in the other direction (' + (r.delta > 0 ? '+' : '') + r.delta + ' points)' : 'a real change of ' + (r.delta > 0 ? '+' : '') + r.delta + ' points, under the rule\'s ' + r.threshold_points + ' points'; });
    return res; };
  const nCdf = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989422804014327 * Math.exp(-x * x / 2); const q = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))); return x >= 0 ? 1 - q : q; };
  const zOfP = (p) => { let lo = 0, hi = 12; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (2 * (1 - nCdf(mid)) > p) lo = mid; else hi = mid; } return (lo + hi) / 2; };

  // ---- 7. the repeat pilot: within- vs between-question variance per engine -> repeats per engine ---------------------------------------
  /** units: answers of the pilot ({ prompt_id (the base question), engine, named }). For each engine: a one-way ANOVA over questions.
   *  sigma2_between (the questions differ) and sigma2_within (one question asked again). Repeats per question for a target half-width h on a
   *  panel of Q questions: m = sigma2_w / (Q * (h / z)^2 - sigma2_b) (more repeats cannot help past the between-question floor). */
  const pilot = (units, o) => { const opt = o || {}; const Q = Number(opt.panel) || 50; const h = (Number(opt.half_width) || 5) / 100; const out = {};
    for (const e of [...new Set((units || []).map(u => u.engine))].sort()) { const G = new Map(); for (const u of units.filter(x => x.engine === e)) { const g = G.get(u.prompt_id) || []; g.push(u.named ? 1 : 0); G.set(u.prompt_id, g); }
      const gs = [...G.values()].filter(g => g.length >= 2); const k = gs.length; const N = gs.reduce((s, g) => s + g.length, 0);
      if (k < 3) { out[e] = { questions: k, answers: N, repeats: null, why: 'fewer than 3 questions answered twice or more' }; continue; }
      const grand = gs.reduce((s, g) => s + g.reduce((a, b) => a + b, 0), 0) / N; const n0 = (N - gs.reduce((s, g) => s + g.length * g.length, 0) / N) / (k - 1);
      const msb = gs.reduce((s, g) => { const m = g.reduce((a, b) => a + b, 0) / g.length; return s + g.length * (m - grand) * (m - grand); }, 0) / (k - 1);
      const msw = gs.reduce((s, g) => { const m = g.reduce((a, b) => a + b, 0) / g.length; return s + g.reduce((a, b) => a + (b - m) * (b - m), 0); }, 0) / Math.max(1, N - k);
      const sb = Math.max(0, (msb - msw) / n0), sw = msw; const icc = sb + sw > 0 ? sb / (sb + sw) : null;
      const room = Q * Math.pow(h / Z, 2) - sb; const m = room <= 0 ? null : sw === 0 ? 1 : Math.max(1, Math.ceil(sw / room));   // the between-question floor first: past it no number of asks helps
      out[e] = { questions: k, answers: N, rate: r1(100 * grand), sigma2_between: Math.round(1e5 * sb) / 1e5, sigma2_within: Math.round(1e5 * sw) / 1e5, icc: icc == null ? null : r3(icc), repeats: m,
        why: m == null ? 'the questions differ so much that no number of repeats reaches +/-' + r1(100 * h) + ' points on ' + Q + ' questions: ask more questions instead' : m === 1 ? 'one answer per question a week is enough for +/-' + r1(100 * h) + ' points on ' + Q + ' questions' : m + ' answers per question a week reach +/-' + r1(100 * h) + ' points on ' + Q + ' questions' }; }
    return out; };

  // ---- the run: what AI Metrics hands over once its own figures exist (one call per site; AI_Metrics.js hook marked W2-E2) ------------------
  /** c: { p, rule, U (the headline's answers), CI (ci()), segRows, segKeys(q, engine), meta (Map prompt id -> question), compare (compare_json.metrics),
   *  comparable, why, comps (the competitor table), canon(id) -> the run's key for a business, read(nodeName) -> rows } */
  const run = (c) => { const t0 = Date.now(); const p = c.p || {}; const rd = c.read || (() => []); const DAY = 864e5; const nowT = Date.parse(p.checked_at) || Date.now(); const isoT = (t) => new Date(t).toISOString();
    const mine = (r) => r && String(r.site_id || '') === String(p.site_id);
    const mon = rd('Load Monitors').find(mine) || {};
    // 3. share of voice over the declared set (ai_sov_set, else the configured competitors) + others
    const setDeclared = has(mon.ai_sov_set); const setRaw = setDeclared ? String(mon.ai_sov_set).split(/[\n,;]+/) : (p.configured_competitors || []);
    const set = [...new Set(setRaw.map(x => String(x).trim()).filter(Boolean).map(x => (c.canon ? c.canon(x) : x)).filter(Boolean))].slice(0, 20);
    const sovJ = sov(c.U, { set, selfId: p.domain, selfName: p.business_name || p.domain, setSource: setDeclared ? 'declared (ai_sov_set)' : 'your configured competitors' });
    // 2. the 28-day window for segment rates (earlier weekly rows' units_json + the pulse mornings' detail_json + this run's weekly answers)
    const visRows = rd('Load AI Visibility').filter(mine), daily = rd('Load AI Daily').filter(mine);
    const weeklyNow = (c.U || []).filter(u => !u.pulse);
    const H28 = history({ rule: c.rule, entity_rule: c.entity_rule, from: isoT(nowT - 28 * DAY), to: isoT(nowT + 1), now_units: weeklyNow, now_run: p.run_id, now_at: p.checked_at, vis_rows: visRows, daily_rows: daily });
    const acc = new Map(); for (const u of H28.units) { const m0 = (c.meta && c.meta.get(u.prompt_id)) || {}; for (const [d, key] of c.segKeys({ ...m0, topic: m0.topic || '' }, u.engine)) { const id = d + '|' + key; const a = acc.get(id) || []; a.push(u); acc.set(id, a); } }
    const lend = c.CI ? c.CI.rho_lent : null;
    for (const s of (c.segRows || [])) { const us = acc.get(s.dim + '|' + s.key) || []; const r0 = prop(us, (u) => !!u.named, { rho: lend });
      s.w28 = { rate: r0.rate, lo: r0.lo, hi: r0.hi, n: r0.n_answers, k: r0.k, questions: r0.n_questions, deff: r0.deff, basis: r0.basis, enough: r0.n_answers >= 12 }; }
    const window28 = { from: H28.from, to: isoT(nowT), days: 28, weekly_runs: H28.runs.length, pulse_days: H28.pulse_days, answers: H28.units.length, left_out: H28.left_out,
      note: 'Segment rates count the last 28 days (' + H28.runs.length + ' weekly run' + (H28.runs.length === 1 ? '' : 's') + ' and ' + H28.pulse_days + ' pulse morning' + (H28.pulse_days === 1 ? '' : 's') + ', ' + H28.units.length + ' answers); the headline counts this run\'s window. A segment\'s change is still tested run against run, on answers that do not overlap.'
        + (H28.left_out.weekly_rows || H28.left_out.pulse_rows ? ' ' + (H28.left_out.weekly_rows + H28.left_out.pulse_rows) + ' earlier reading(s) were left out (another measurement rule, or no per-answer record).' : '') };
    // 5. did an action work: the AI targets written / won and the pages published in the last 31 days (its 28 days before must be inside what is loaded)
    const H60 = history({ rule: c.rule, entity_rule: c.entity_rule, from: isoT(nowT - 60 * DAY), to: isoT(nowT + 1), now_units: weeklyNow, now_run: p.run_id, now_at: p.checked_at, vis_rows: visRows, daily_rows: daily });
    const qOfKw = (kw) => { const k = String(kw || '').toLowerCase().trim(); if (k.split(/\s+/).length < 2) return []; return [...(c.meta || new Map()).values()].filter(q => q.kind !== 'brand' && (String(q.keyword || '').toLowerCase().trim() === k || String(q.prompt || '').toLowerCase().includes(k))).map(q => String(q.prompt_id)); };
    const inRange = (at) => { const x = Date.parse(at); return isFinite(x) && x >= nowT - 31 * DAY && x <= nowT; };
    const acts = [];
    // AIR (P3, 2026-11-06, CONTRACTS.md 2.1): an AIR target row carries live_at, when its page was seen live (the treatment's start); it is the
    // action's time when present. AI Growth's rows never carry it (written null), so their time is unchanged.
    for (const t of rd('Load AI Targets (AI)').filter(mine)) { const at = t.live_at || t.written_at || (String(t.status) === 'won' ? t.won_at : ''); if (!['written', 'won', 'published'].includes(String(t.status || '')) || !inRange(at) || !t.prompt_id) continue;
      acts.push({ action_id: String(t.target_id || 'ait_' + t.prompt_id), kind: 'ai_target' + (t.kind ? ':' + t.kind : ''), at, questions: [String(t.prompt_id)], label: String(t.question || t.keyword || '').slice(0, 160) }); }
    for (const l of rd('Load Content Log (AI)').filter(mine)) { if (String(l.status || '') !== 'published' || !inRange(l.published_at)) continue; const qs = qOfKw(l.keyword); if (!qs.length) continue;
      acts.push({ action_id: 'page:' + String(l.published_url || l.keyword), kind: 'page', at: l.published_at, questions: qs, label: String(l.keyword || '') }); }
    const imp = impact(H60.units, acts, { now: isoT(nowT), meta: c.meta, seed: p.site_id + '|' + p.run_id });
    // 6. the owner's alert rules
    let rules = [], rulesErr = '';
    if (has(mon.ai_alert_rules_json)) { try { rules = validateRules(mon.ai_alert_rules_json); } catch (e) { rulesErr = String(e.message || e); } }
    const prevRaw = visRows.find(r => p.previous && String(r.run_id) === String(p.previous.run_id)) || null;
    const segPrev = new Map(); const ps = prevRaw ? parse(prevRaw.segments_json, null) : null;
    if (ps && Array.isArray(ps.rows)) { const cols = ps.cols || ['dim', 'key', 'questions', 'n', 'k', 'cited']; const ix = (k) => cols.indexOf(k);
      for (const r of ps.rows) { const g = (k) => Array.isArray(r) ? r[ix(k)] : r[k]; segPrev.set(String(g('dim')) + '|' + String(g('key')).toLowerCase(), { n: Number(g('n')) || 0, k: Number(g('k')) || 0, cited: ix('cited') >= 0 || !Array.isArray(r) ? Number(g('cited')) : null }); } }
    const comps = (c.comps || []).map(x => ({ domain: x.domain, sov: x.sov, delta: x.delta ? { sov: x.delta.sov, sov_z: x.delta.sov_p != null && x.delta.sov != null ? (x.delta.sov >= 0 ? 1 : -1) * zOfP(x.delta.sov_p) : null, why: x.delta.why } : null }));
    const evaluated = rulesErr ? [] : evalRules(rules, { comparable: c.comparable, why: c.why, compare: c.compare, segRows: (c.segRows || []).map(s => ({ dim: s.dim, key: String(s.key).toLowerCase(), n: s.n, k: s.k, cited: s.cited })), segPrev, comps, deff: c.CI && c.CI.headline.named_rate ? c.CI.headline.named_rate.deff : 1 });
    if (rulesErr) evaluated.push({ rule_id: '', fired: false, metric: '', scope: {}, delta: null, test: null, reason: 'the stored rules could not be read: ' + rulesErr });
    return { sov: sovJ, window28, impact: imp, actions_considered: acts.length, alert_rules: evaluated, units_json: JSON.stringify(packUnits(weeklyNow, p.checked_at, c.rule, c.entity_rule)), ms: Date.now() - t0 }; };

  return { Z, t975, wilsonN, prop, ratio, boot, binom, rng, hash, ci, packUnits, unpackUnits, pulseUnits, history, sov, impact, validateRules, evalRules, METRICS, SCOPES, pilot, zOfP, nCdf, parse, run };
})();
// ---- G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): the AI question panel at enterprise scale — shared by AI Plan, AI Requests, Prompt Jobs,
// Prompt Rows, Pulse Plan, AI Metrics and the Site Admin (inlined by the build). Pure functions, no node access: the harness runs them.
// The money is here too (AIP.cost, section 8: ONE formula for the engine; app/shared/src/cost.ts mirrors it against one table of golden
// cases). And the rest: the limits, the markets and personas a question carries, the strata the daily sample rotates through,
// the requests of a run in one deterministic order (so a resumed run never pays for the same answer twice), the state of a run that is
// split across executions, and the "same question in other words" rule that keeps a 500-question panel from asking one thing ten times.
const AIP = (() => {
  const LIMITS = {
    min: 3, max: 500,                 // questions a site may track (the brand question included)
    default_new: 50,                  // a site with NO seo_monitors row starts here
    default_stored: 20,               // a row whose ai_prompts_max is empty keeps the v4.9 default (an existing site is never raised by a release)
    chunk_requests: 600,              // engine requests one execution of the weekly run asks for one site (about 25 KB an answer: ~30 MB of execution data)
    exec_requests: 1200,              // and for all its sites together (a scheduled run covers up to 15 sites)
    pulse_max_requests: 900,          // requests one pulse morning may ask (the v4.9 cap); the daily sample is sized to fit under it
    full_pulse_max_panel: 50,         // up to this panel the pulse asks every question every day, as before (auto mode)
    target_headline: 3,               // ± points (95%) the weekly headline rate should reach — the pulse's N is chosen for it
    target_cluster: 8,                // ± points (95%) the median topic cluster should reach
    cluster_size_guess: 12,           // questions per cluster when the panel has none yet (the Prompt Writer aims at 8-15)
    min_segment: 12,                  // answers under which a segment rate is "too few answers" (= MIN_RATE_SAMPLES)
    stall_minutes: 65,                // a split run silent this long is resumed by the next start of the tracker or the pulse: the tracker's
                                      // execution limit is 60 minutes, so a part not heard of for 65 is dead, never merely slow (a resume of a
                                      // live part would ask its questions twice; the run guard refuses that twin too)
    resume_days: 6,                   // an unfinished run older than this is closed, not resumed (a new week starts a new run)
    done_fresh_hours: 20,             // R-E1: a run that FINISHED this recently answers an on-demand / catch-up start with its stored week
                                      // (a retry of the same cycle job is answered so whatever the hour); nothing is asked or paid again
    max_run_usd: 150,                 // one weekly / full run above this is refused by the plan, with the reason
    writer_batch: 40,                 // questions one Prompt Writer job writes (the agent's answer must fit its token budget)
    writer_jobs_per_run: 14,          // Prompt Writer jobs one run may start (14 x 40 = 560: a new 500-question panel in one run)
    similar: 0.6,                     // Jaccard over content-word stems at or above which two questions ask the same thing
  };
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const hash = (t) => { let h = 5381; for (const c of String(t)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h; };

  // ---- 1. the panel size a site is held to ----------------------------------------------------------------------------------
  /** `row` = the site's seo_monitors row, or null when it has none. A stored number is never changed; an empty field keeps 20. */
  const panelSize = (row) => {
    if (!row || !S(row.site_id)) return LIMITS.default_new;
    const v = Number(row.ai_prompts_max);
    if (row.ai_prompts_max === '' || row.ai_prompts_max == null || !Number.isFinite(v) || v <= 0) return LIMITS.default_stored;
    return clamp(Math.round(v), LIMITS.min, LIMITS.max);
  };

  // ---- 2. markets and personas -----------------------------------------------------------------------------------------------
  /** "ae-EN", "AE en", "ae" -> "AE-en" (country ISO + language); '' when it is not a market */
  const normMarket = (m, dfltLang) => {
    const x = S(m).replace(/[_\s]+/g, '-'); const mm = x.match(/^([A-Za-z]{2})(?:-([A-Za-z]{2,3}))?$/);
    if (!mm) return '';
    return mm[1].toUpperCase() + '-' + (mm[2] || dfltLang || 'en').toLowerCase();
  };
  const listOf = (v) => (Array.isArray(v) ? v : S(v).split(/[\n,;|]+/)).map(S).filter(Boolean);
  /** the markets a site's panel covers: its own first, then the extra ones in its settings and the stored questions' own markets, at most
   *  MARKETS_MAX (E22, 2026-10-23: the comment said 6 while the code kept 8; the app caps the settings at 5, the stored questions can add
   *  more). A question whose market falls past the cap is asked in the site's own market and the request says so (`market_fallback`). */
  const MARKETS_MAX = 8;
  const marketsOf = (site) => {
    const own = normMarket(S(site.country_iso) + '-' + S(site.language_code || 'en')) || 'US-en';
    const extra = listOf(site.ai_markets).map(m => normMarket(m, 'en')).filter(Boolean);
    return [...new Set([own, ...extra])].slice(0, MARKETS_MAX);
  };
  // DataForSEO's location code for a country is 2000 + its ISO 3166 numeric code. The main workflow's COUNTRIES table holds 22 countries;
  // a market outside it (Qatar, Kuwait, Germany …) must still be asked IN that country, never quietly relabelled as the site's own market.
  const ISO_NUM = { AE: 784, SA: 682, QA: 634, KW: 414, BH: 48, OM: 512, EG: 818, JO: 400, LB: 422, MA: 504, TN: 788, DZ: 12, IQ: 368, TR: 792, IL: 376, PK: 586, IN: 356, BD: 50, LK: 144, NP: 524,
    US: 840, CA: 124, MX: 484, BR: 76, AR: 32, CL: 152, CO: 170, PE: 604, GB: 826, IE: 372, FR: 250, DE: 276, NL: 528, BE: 56, LU: 442, CH: 756, AT: 40, IT: 380, ES: 724, PT: 620,
    SE: 752, NO: 578, DK: 208, FI: 246, PL: 616, CZ: 203, SK: 703, HU: 348, RO: 642, BG: 100, GR: 300, HR: 191, SI: 705, RS: 688, UA: 804, EE: 233, LV: 428, LT: 440, CY: 196, MT: 470,
    ZA: 710, NG: 566, KE: 404, GH: 288, ET: 231, TZ: 834, UG: 800, AU: 36, NZ: 554, SG: 702, MY: 458, ID: 360, TH: 764, VN: 704, PH: 608, HK: 344, TW: 158, JP: 392, KR: 410, CN: 156 };
  const locationOf = (cc) => { const n = ISO_NUM[S(cc).toUpperCase()]; return n ? 2000 + n : 0; };
  const PERSONA_MAX = 6;
  const personasOf = (site) => [...new Set(listOf(site.ai_personas).map(p => p.replace(/\s+/g, ' ').slice(0, 40)))].slice(0, PERSONA_MAX);
  const stageOf = (s) => { const x = S(s).toLowerCase(); return ['awareness', 'consideration', 'decision', 'brand', 'shopping'].includes(x) ? x : ''; };

  // ---- 3. one question, said another way ----------------------------------------------------------------------------------------
  const STOP = new Set(('a an and are as at be best by can do does for from get has have how i in is it its me my of on or our should the their them '
    + 'there these this to top us we what when where which who why will with you your vs versus near me good great right').split(' '));
  const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(ing|ers|er|es|ed|ly|s)$/, '').slice(0, 7);
  const stems = (t) => [...new Set(S(t).toLowerCase().replace(/[^a-z0-9؀-ۿ\s]+/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).map(stem).filter(w => w.length >= 2))];
  const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); if (!A.size || !B.size) return 0; let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i); };
  /** do two questions ask the same thing? (same market and persona, and their content words overlap enough) */
  const sameAsk = (a, b) => {
    if (S(a.market || '') !== S(b.market || '') && a.market && b.market) return false;
    if (a.persona && b.persona && S(a.persona).toLowerCase() !== S(b.persona).toLowerCase()) return false;
    return jaccard(stems(a.prompt), stems(b.prompt)) >= LIMITS.similar;
  };
  /** keep the first of every group of questions that ask the same thing; `existing` are kept already. Returns { keep, dup: [{q, like}] } */
  const dedupe = (cands, existing) => {
    const kept = (existing || []).map(q => ({ ...q, _s: stems(q.prompt) }));
    const keep = [], dup = [];
    for (const q of (cands || [])) {
      const s = stems(q.prompt);
      const like = kept.find(k => (S(k.market || '') === S(q.market || '') || !k.market || !q.market)
        && (!k.persona || !q.persona || S(k.persona).toLowerCase() === S(q.persona).toLowerCase()) && jaccard(k._s, s) >= LIMITS.similar);
      if (like) { dup.push({ q, like: like.prompt }); continue; }
      kept.push({ ...q, _s: s }); keep.push(q);
    }
    return { keep, dup };
  };

  // ---- 3b. a question's identity and its search phrase (F2, 2026-10-23: ENGINE_AUDIT.md E2 / E15 / E9) ---------------------------------
  // E2: the old normaliser kept only [a-z0-9], so every Arabic (any non-Latin) question became the empty string — one prompt id for all of
  // them, the first stored and every later one overwriting its wording. E15: that id was a 32-bit djb2 hash in one key space shared by every
  // site, upserted on `prompt_id` alone, so a collision moved one site's question to another (~25% odds at 50k questions).
  // Now: ONE normal form for every script (NFKC, lower case, Arabic harakat / tatweel dropped, anything that is not a letter, digit or mark
  // is a space), and a 64-bit id (two independent 32-bit mixes, cyrb53's mixing without the 53-bit cut) over `site_id | normal form`,
  // prefixed `q_` so a new id can never be read as an old `p_` one. Save Prompts and the Site Admin upsert on (site_id, prompt_id).
  // A stored question keeps the id it was stored with (its trend and its answer history hang on it): writers and the Site Admin match an
  // existing row by its id OR its normal form first, and only a question new to the site gets a new id.
  const AR_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
  const normQ = (t) => S(t).normalize('NFKC').toLowerCase().replace(AR_MARKS, '').replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const hash64 = (t) => {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57; const s = String(t);
    for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(36).padStart(7, '0') + (h1 >>> 0).toString(36).padStart(7, '0');
  };
  /** the stable id of a question on one site: 'q_' + 64 bits over the site and the question's normal form */
  const promptId = (site_id, prompt) => 'q_' + hash64(S(site_id) + '|' + normQ(prompt));
  /** a stored row that IS this question (same id, or same normal form) — so a reworded-identical question keeps its stored id */
  const findStored = (rows, site_id, prompt) => { const n = normQ(prompt); if (!n) return null;
    return (rows || []).find(r => r && S(r.site_id) === S(site_id) && (S(r.prompt_id) === promptId(site_id, prompt) || normQ(r.prompt) === n)) || null; };
  // E9: an owner's question got the first five words as its search phrase ("what should i check before"), and the AI Overview presence,
  // the AI search volume and the fit gate were all measured on that fragment. The phrase is now the question's content words in their own
  // order (question words, stop words and filler dropped, hyphenated words kept whole, at most 6) — or the owner's own keyword when given.
  // `keyword_source` says which: 'owner' (typed by the owner), 'writer' (the Prompt Writer's search phrase), 'template', 'derived' (built
  // here). A derived phrase is not a search anyone typed, so AI Requests does not ask Google's AI Overview for it.
  const KW_DROP = new Set(('a an and are as at be been before being best both by can could did do does doing each few for from get gets give has have '
    + 'help how i if in into is it its just know like list looking me more most much my need needs of on or our please really recommend '
    + 'recommended should so some tell than that the their them then there these they this those to top us very vs versus want was way ways '
    + 'we what whats what\'s when where which while who whom whose why will with without would you your yours check good great right near '
    + 'any also about after etc options option thing things kind kinds sort type types able actually currently today now there\'s '
    + 'ما ماذا هي هو هل في من على عن إلى الى كيف لماذا أي اي التي الذي مع أو او و هذا هذه ذلك تلك كم لدي لدى أفضل افضل يمكن يجب').split(/\s+/));
  const keywordOf = (prompt) => {
    const words = (S(prompt).normalize('NFKC').replace(AR_MARKS, '').match(/[\p{L}\p{N}\p{M}]+(?:['’-][\p{L}\p{N}\p{M}]+)*/gu) || [])
      .map(t => ({ t, w: t.toLowerCase().replace(/’/g, '\'') }))
      .filter(({ t, w }) => (t === 'IT' || (!KW_DROP.has(w) && !KW_DROP.has(w.replace(/'s$/, '')))) && (w.length >= 2 || /^\d+$/.test(w) || /[^\x00-\x7f]/.test(w)))   // "IT" (information technology) is a word, "it" is not
      .map(({ w }) => w);
    const kw = [...new Set(words)].slice(0, 6).join(' ').slice(0, 120).trim();
    return kw || normQ(prompt).split(' ').slice(0, 6).join(' ').slice(0, 120);
  };
  const KEYWORD_SOURCES = ['owner', 'writer', 'template', 'derived'];

  // ---- 4. strata and the daily rotating sample ----------------------------------------------------------------------------------
  const stratumOf = (q) => (S(q.cluster || q.topic).toLowerCase() || 'other') + ' | ' + (S(q.persona).toLowerCase() || 'any buyer');
  /** the pulse-day counter: the six days after the website's cycle day (its weekly run) are six consecutive numbers, and the cycle day
   *  itself shares the next day's. `cycleWeekday` is 0 (Sunday) … 6 (Saturday); with none it is Monday (1), the v4.9 rule exactly - every
   *  website then had its weekly run on Monday and its pulse Tuesday..Sunday. 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.8): a website's week
   *  starts on the day it set up, so its six pulse mornings are counted from ITS cycle day; a question is still asked on exactly `per_week`
   *  of every six consecutive pulse mornings (pulseSample), whatever the weekday. `iso` is the website's LOCAL date (YYYY-MM-DD…). */
  const pulseDay = (iso, cycleWeekday) => {
    const cw = Number.isInteger(Number(cycleWeekday)) && cycleWeekday !== null && cycleWeekday !== '' && Number(cycleWeekday) >= 0 && Number(cycleWeekday) <= 6 ? Number(cycleWeekday) : 1;
    const t = Date.parse(S(iso).slice(0, 10) + 'T00:00:00Z'); const d = Math.floor((t - Date.UTC(1970, 0, 4 + cw)) / 864e5);   // 1970-01-04 was a Sunday: the anchor is the first cycle day of 1970
    const w = Math.floor(d / 7), r = ((d % 7) + 7) % 7;
    return w * 6 + (r === 0 ? 0 : r - 1);
  };
  /** the weekly answer counts a panel collects */
  const halfWidth = (n, p) => { const N = n0(n); if (N <= 0) return null; const z = 1.96, q = p == null ? 0.5 : p; const d = 1 + z * z / N, m = z * Math.sqrt(q * (1 - q) / N + z * z / (4 * N * N)); return Math.round(1000 * m / d) / 10; };
  /** N: how many pulse mornings a week each question is asked. 'full' = every morning; auto = the smallest N that brings the weekly
   *  headline to ±target_headline and the median cluster to ±target_cluster (both at 95%, at worst p = 0.5) — capped by what one
   *  morning may ask. Returns { per_week, why, headline, cluster } with the half-widths it buys. */
  const pulsePerWeek = (o) => {
    const asked = Math.max(1, n0(o.asked)); const wE = Math.max(0, n0(o.weekly_engines)); const pE = Math.max(0, n0(o.pulse_engines));
    const cl = Math.max(1, n0(o.cluster_size) || LIMITS.cluster_size_guess);
    const capQ = pE ? Math.floor(LIMITS.pulse_max_requests / pE) : asked;   // questions one morning may ask
    const capN = Math.max(1, Math.min(6, Math.floor(6 * capQ / asked)));
    const at = (N) => ({ headline: halfWidth(asked * (wE + N * pE)), cluster: halfWidth(Math.min(asked, cl) * (wE + N * pE)) });
    const mode = S(o.mode).toLowerCase();
    if (!pE) return { per_week: 0, why: 'no pulse engine is on', ...at(0), capped: false };
    if (mode === 'full' || (mode !== 'sample' && asked <= LIMITS.full_pulse_max_panel - 1)) {
      const N = Math.min(6, capN);
      return { per_week: N, ...at(N), capped: N < 6, why: N < 6 ? 'every question every morning would be ' + (asked * pE) + ' requests; one morning asks at most ' + LIMITS.pulse_max_requests + ', so each question is asked ' + N + ' mornings a week' : 'every question, every pulse morning' };
    }
    const fixed = n0(o.per_week);
    if (fixed >= 1) { const N = Math.min(6, Math.round(fixed), capN); return { per_week: N, ...at(N), capped: N < Math.round(fixed), why: 'set by the owner: each question ' + N + ' morning(s) a week' + (N < Math.round(fixed) ? ' (more would pass the ' + LIMITS.pulse_max_requests + '-request morning limit)' : '') }; }
    for (let N = 1; N <= capN; N++) { const h = at(N); if (h.headline <= LIMITS.target_headline && h.cluster <= LIMITS.target_cluster) return { per_week: N, ...h, capped: false, why: 'the fewest mornings that bring the weekly rate to ±' + h.headline + ' points and a ' + cl + '-question cluster to ±' + h.cluster + ' (95%)' }; }
    return { per_week: capN, ...at(capN), capped: true, why: 'the most one morning allows (' + LIMITS.pulse_max_requests + ' requests): a ' + cl + '-question cluster reaches ±' + at(capN).cluster + ' points, not ±' + LIMITS.target_cluster };
  };
  /** today's sample: every question asked on `per_week` of the six pulse mornings, slots spread round-robin inside each stratum (with a
   *  per-stratum offset so the mornings carry the same load), and every stratum present every morning (a stratum too small to be
   *  covered by its slots gets one extra question that day, chosen in turn). Returns { asked, strata, covered, per_week, extra } */
  const pulseSample = (prompts, o) => {
    const N = clamp(Math.round(n0(o.per_week)) || 6, 1, 6); const pd = n0(o.day);
    const groups = new Map();
    for (const q of (prompts || [])) { const k = stratumOf(q); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(q); }
    const asked = []; let extra = 0;
    for (const [k, qs] of groups) {
      const sorted = qs.slice().sort((a, b) => (hash(a.prompt_id) - hash(b.prompt_id)) || S(a.prompt_id).localeCompare(S(b.prompt_id)));
      const off = hash(k) % 6; let got = 0;
      sorted.forEach((q, i) => { const slot = (off + i) % 6; if (((pd - slot) % 6 + 6) % 6 < N) { asked.push({ ...q, slot, stratum: k }); got++; } });
      if (!got && sorted.length) { const q = sorted[((pd % sorted.length) + sorted.length) % sorted.length]; asked.push({ ...q, slot: -1, stratum: k, top_up: true }); extra++; }
    }
    return { asked, strata: groups.size, covered: new Set(asked.map(q => q.stratum)).size, per_week: N, extra };
  };

  // ---- 5. the requests of one run, in one order -------------------------------------------------------------------------------
  const reqKey = (prompt_id, engine) => S(prompt_id) + '|' + S(engine);
  /** the requests a run still owes: `all` in the run's deterministic order, minus the keys answered by an earlier execution of the same
   *  run, cut at `limit`. Returns { now, left, done, total, final } — `final` when nothing is left after this execution. */
  const slice = (all, doneKeys, limit) => {
    const done = doneKeys instanceof Set ? doneKeys : new Set(doneKeys || []);
    const owed = (all || []).filter(r => !done.has(reqKey(r.prompt_id, r.engine)));
    const lim = Math.max(1, n0(limit) || LIMITS.chunk_requests);
    const now = owed.slice(0, lim);
    return { now, left: owed.length - now.length, done: (all || []).length - owed.length, total: (all || []).length, final: owed.length <= lim };
  };

  // ---- 6. a run split across executions: its state row in seo_cache (`ai_run:<site_id>`, kind ai) --------------------------------
  const stateKey = (site_id) => 'ai_run:' + S(site_id);
  const parse = (t, d) => { try { const v = typeof t === 'string' ? JSON.parse(t || '') : t; return v == null ? d : v; } catch (e) { return d; } };
  const stateOf = (cacheRows, site_id) => { const r = (cacheRows || []).find(c => c && c.key === stateKey(site_id)); return r ? parse(r.value, null) : null; };
  /** what to do with a stored state at `now`: 'continue' (this is its next chunk), 'resume' (silent too long: pick it up), 'busy' (a chunk
   *  is running right now), 'blocked' (F2: the run was STOPPED — its answers were not stored or it reached its money ceiling — and nothing
   *  of this site's weekly run is asked again until a human clears the row or the run is older than resume_days; a `failed_store` stop is
   *  checked again by every later start, see healStore), 'closed' (finished, or
   *  too old to resume) */
  const STOPPED = ['failed_store', 'stopped_ceiling', 'stopped'];
  const stateVerdict = (st, nowIso, continuing) => {
    if (!st || !st.run_id) return 'closed';
    const now = Date.parse(nowIso) || Date.now();
    const started = Date.parse(st.started_at) || 0, upd = Date.parse(st.updated_at) || started;
    if (started && now - started > LIMITS.resume_days * 864e5) return 'closed';
    if (STOPPED.includes(S(st.status))) return 'blocked';
    if (S(st.status) !== 'running') return 'closed';
    if (continuing && S(continuing) === S(st.run_id)) return 'continue';
    if (now - upd >= LIMITS.stall_minutes * 60000) return 'resume';
    return 'busy';
  };
  const stateRow = (site_id, st, nowIso) => ({ key: stateKey(site_id), kind: 'ai', site_id: S(site_id), value: JSON.stringify(st), updated_at: nowIso });   // exact seo_cache columns
  /** R-E1 (2026-10-23, REVIEW_ENGINE.md): is a stored `done` run THIS start's week? -> { why, cycle_key, finished_at } or null. A start of the same
   *  cycle job (the dispatcher's retry after the run's last part died past the moment its week was stored) is always answered with the stored
   *  week; any other start that is not a cycle job (on demand, a catch-up, a bare manual start) is answered so when the run finished less than
   *  done_fresh_hours ago. A cycle job of ANOTHER cycle (the next week) runs. `rerun` (the trigger's rerun_today) asks again on purpose. */
  const doneRun = (st, o) => { const x = o || {};
    if (!st || !st.run_id || S(st.status) !== 'done' || x.rerun) return null;
    const fin = Date.parse(st.finished_at || st.updated_at) || 0; const now = Date.parse(x.now) || Date.now();
    const ck = S(x.cycle && x.cycle.key), sk = S(st.cycle && st.cycle.key);
    if (ck) return ck === sk ? { why: 'same_cycle', cycle_key: ck, finished_at: S(st.finished_at || st.updated_at) } : null;
    if (fin && now - fin >= 0 && now - fin < LIMITS.done_fresh_hours * 3600e3) return { why: 'recent', cycle_key: sk, finished_at: S(st.finished_at || st.updated_at) };
    return null; };

  // ---- 6b. never pay twice (F2, 2026-10-23: ENGINE_AUDIT.md E1 / E11) ----------------------------------------------------------------
  // E1: a part whose answers were not stored left no trace of what it had PAID for, so every later part asked the same first chunk again,
  // until the run expired or the account ran dry (4 parts x 600 keys = 2,400 paid requests for 600 questions). Now the state row records
  // every key the run has sent (`asked_keys`, packed) and the chunk in flight (`pending`) BEFORE the requests leave (*AI Asking State* ->
  // *Save Asking State*, and nothing is paid unless that save is read back), and AI Requests never asks a recorded key again. A part whose
  // keys are recorded but whose answers are not stored is found by the next part: the first time (a crash: the 60-minute limit, a restart,
  // a pre-empted VM) the lost keys are counted as could-not-be-read and the next chunk is halved; the second time, or when the part itself
  // saw its save fail, the run STOPS (`failed_store`), with an ops alert and the reason, and nothing is asked again.
  // The run also carries a hard money ceiling (`ceiling_dfs_usd`, fixed at its start: 1.5 x its own estimate, at least $2, never above
  // max_run_usd): every part checks the run's spent + committed DataForSEO money against it, AI Requests stops adding requests at it, and a
  // run that reaches it with questions left STOPS (`stopped_ceiling`) with an ops alert.
  const ENG_CODE = { chatgpt: 'c', gemini: 'g', perplexity: 'p', claude: 'l', ai_overview: 'o', ai_mode: 'm', copilot: 'b', chatgpt_api: 'C', gemini_api: 'G' };
  const CODE_ENG = Object.fromEntries(Object.entries(ENG_CODE).map(([e, c]) => [c, e]));
  /** ['p1|chatgpt', 'p1|gemini', 'p2|claude'] -> { p1: 'cg', p2: 'l' } (an engine without a code is kept in parentheses) */
  const packKeys = (keys) => { const m = {};
    for (const k of (keys instanceof Set ? [...keys] : (keys || []))) { const s = S(k); const i = s.lastIndexOf('|'); if (i <= 0) continue;
      const pid = s.slice(0, i), e = s.slice(i + 1); const c = ENG_CODE[e] || ('(' + e + ')'); if (!(m[pid] || '').includes(c)) m[pid] = (m[pid] || '') + c; }
    return m; };
  const unpackKeys = (m) => { const out = new Set(); const o = parse(m, {}) || {};
    for (const pid of Object.keys(o)) for (const t of (S(o[pid]).match(/\(([^)]+)\)|./g) || [])) { const e = t[0] === '(' ? t.slice(1, -1) : CODE_ENG[t]; if (e) out.add(reqKey(pid, e)); }
    return out; };
  const CEILING = { factor: 1.5, min_usd: 2 };
  /** the run's hard DataForSEO ceiling, fixed when it starts */
  const runCeiling = (runCostDfs) => Math.round(100 * Math.min(LIMITS.max_run_usd, Math.max(CEILING.min_usd, CEILING.factor * n0(runCostDfs)))) / 100;
  /** what is left under the ceiling: the larger of what the run measured (settled per task) and what it committed before paying */
  const ceilingLeft = (st) => { if (!st || !(n0(st.ceiling_dfs_usd) > 0)) return null; return Math.max(0, n0(st.ceiling_dfs_usd) - Math.max(n0(st.spent_dfs_usd), n0(st.committed_dfs_usd))); };
  /** the request estimate of a set of keys at the engine prices */
  const keysUsd = (keys) => { let t = 0; for (const k of keys) { const e = S(k).slice(S(k).lastIndexOf('|') + 1); t += PRICE[e] || 0.01; } return Math.round(t * 10000) / 10000; };
  /** the identity of a run's state (what every writer of the state row carries), from a plan item */
  const baseState = (p) => { const c = p.cycle && p.cycle.key ? { key: p.cycle.key, date: p.cycle.date || '', job: p.cycle.job || 'ai_visibility', monthly: !!p.cycle.monthly, scheduled_for: p.cycle.scheduled_for || '', request_id: p.cycle.request_id || p.request_id || '', label: p.cycle.label || '' } : null;
    return { run_id: p.run_id, run_kind: p.run_kind, on_demand: !!p.on_demand, full_due: !!p.full_due, request_id: p.request_id || '', email: p.email || '', callback_url: p.callback_url || '', cycle: c,
      site_id: p.site_id, domain: p.domain, started_at: p.checked_at, ceiling_dfs_usd: n0(p.ceiling_dfs_usd) || null }; };

  // ---- 6b'. a store that only LOOKED failed heals itself (2026-10-27, production 2026-10-25: devaicon.com, run ai_20261025_devaicon-com) -----
  // The hand-off counted an answer as "not stored" when the row *Save AI Answers* returned carried a non-empty `error` - but `error` is a
  // COLUMN of seo_ai_answers: an answer the in-200 gate could not read is stored WITH its DataForSEO message ("Internal SE Server Error.").
  // Three such rows (stored, ids and all) were read as three failed saves and the run stopped `failed_store`, blocking the site for 6 days.
  // n8n 2.41's Data Table insert writes every row of a call in ONE transaction and returns each row with its `id`, or fails them all; so a
  // row is stored exactly when the table handed it back with an id (storedRow), never judged by its `error` column. Before a part declares
  // `failed_store` it reads the run's rows back and inserts the truly missing ones once more (storeCheck); a run already stopped
  // `failed_store` is checked again by every later start of the tracker and by the pulse's resume (healStore / storeHealDue): if every lost
  // answer is in the table the run simply continues; if some are truly missing it continues ONCE with them counted as could-not-be-read
  // (never asked again, never paid again); a second storage failure in the same run keeps it stopped for a person.
  const storedRow = (j) => !!(j && typeof j === 'object' && S(j.id) !== '' && S(j.prompt_id) && S(j.engine));
  /** what one part sent and what the table holds of it: { sent, stored, missing: [keys], recovered: n (found on the re-read or the retry) } */
  const storeCheck = (o) => { const x = o || {}; const mine = (r) => r && S(r.site_id) === S(x.site_id) && (!x.run_id || !S(r.run_id) || S(r.run_id) === S(x.run_id));
    const sent = new Set((x.sent || []).filter(mine).map(r => reqKey(r.prompt_id, r.engine)));
    const first = new Set((x.saved || []).filter(r => mine(r) && storedRow(r)).map(r => reqKey(r.prompt_id, r.engine)));
    const later = new Set([...(x.reread || []), ...(x.retried || [])].filter(r => mine(r) && storedRow(r)).map(r => reqKey(r.prompt_id, r.engine)));
    const missing = [...sent].filter(k => !first.has(k) && !later.has(k));
    return { sent: sent.size, stored: sent.size - missing.length, missing, recovered: [...sent].filter(k => !first.has(k) && later.has(k)).length }; };
  /** a `failed_store` state checked against the run's stored rows: null (not such a state), { ok: true, state, found, missing, note } (the
   *  run continues), or { ok: false, found, missing, why } (it stays stopped) */
  const healStore = (st, rows, nowIso) => {
    if (!st || !st.run_id || S(st.status) !== 'failed_store') return null;
    const stored = new Set((rows || []).filter(r => r && S(r.run_id) === S(st.run_id) && r.prompt_id && r.engine).map(r => reqKey(r.prompt_id, r.engine)));
    const explicit = Object.keys(parse(st.lost_keys, {}) || {}).length > 0;
    if (!explicit && !st.asked_keys) return { ok: false, found: 0, missing: n0(st.lost), why: 'the stopped run recorded neither the answers it lost nor the requests it sent, so the table cannot be checked for them' };
    const lostK = explicit ? unpackKeys(st.lost_keys) : new Set([...unpackKeys(st.asked_keys)].filter(k => !stored.has(k)));
    const missing = [...lostK].filter(k => !stored.has(k));
    const found = explicit ? lostK.size - missing.length : Math.max(0, n0(st.lost) - missing.length);
    const heals = n0(st.store_heals);
    if (missing.length && heals >= 1) return { ok: false, found, missing: missing.length, why: 'this run already continued once after answers it paid for were not stored, and ' + missing.length + ' answer(s) are missing again: a second storage failure in one run keeps it stopped' };
    const when = S(st.updated_at).slice(0, 16).replace('T', ' ');
    const note = missing.length
      ? 'Run ' + st.run_id + ' was stopped' + (when ? ' at ' + when + ' UTC' : '') + ' because answers it had paid for were not stored. Read again, ' + found + ' of them are stored and ' + missing.length + ' are still missing: those ' + missing.length + ' were paid for once, are never asked again and count as could not be read; the run continued with the answers it has.'
      : 'Run ' + st.run_id + ' was stopped' + (when ? ' at ' + when + ' UTC' : '') + ' because ' + (found || n0(st.lost)) + ' answer(s) looked unstored. Read again, every one of them is in the table (the save had reported them as failed), so the run continued from its stored answers. Nothing was asked or paid for again.';
    const state = { ...st, status: 'running', stop_reason: '', lost: explicit ? Math.max(0, n0(st.lost) - found) : missing.length, lost_keys: null, pending: null,
      store_heals: heals + (missing.length ? 1 : 0), store_heal: { at: S(nowIso), found, missing: missing.length, stopped_at: S(st.updated_at), reason: S(st.stop_reason).slice(0, 300) }, store_heal_note: note };
    return { ok: true, state, found, missing: missing.length, note }; };
  /** the pulse's resume: a `failed_store` run (inside resume_days) whose answers can be checked is started again so the tracker checks them */
  const storeHealDue = (st, nowIso) => { if (!st || !st.run_id || S(st.status) !== 'failed_store') return false;
    const now = Date.parse(nowIso) || Date.now(), started = Date.parse(st.started_at) || 0;
    if (started && now - started > LIMITS.resume_days * 864e5) return false;
    return !!(Object.keys(parse(st.lost_keys, {}) || {}).length || st.asked_keys); };

  // ---- 6c. a part sized by TIME, not only by count (F2, 2026-10-23: ENGINE_AUDIT.md E11) ----------------------------------------------
  // A 600-request part at ~40-60 s per batch of 10 (Run AI Requests: batch 10, 200 ms apart) is 40-60 minutes BEFORE the retries and the
  // Answer Analyst, against an execution limit of 60: a part that runs out of time loses everything it paid for. A part now gets a time
  // budget (40 of the 60 minutes, less a fixed allowance for loads and writes, the retry pause and the analyst's jobs), and the requests
  // that fit it at the slow-case seconds of each engine (a batch of 10 waits for its slowest answer) — or at the seconds per request the
  // run's earlier parts MEASURED (wall time of the part, analyst taken out), with 20% headroom. Never more than chunk_requests.
  const TIME = { exec_limit_s: 3600, budget_s: 2400, fixed_s: 300, batch: 10, interval_s: 0.2, retry_wait_s: 20, retry_share: 0.15, headroom: 1.2, min_requests: 40,
    analyst_job_s: 30,
    // R-E5 (2026-10-23, REVIEW_ENGINE.md): one Sentiment Reader call (20 passages, ~6k tokens in, up to 4k out) at its slow case, and the tail a run's
    // last part still runs after the reader (the metrics, the saves, the brief, the report, the PDF; the options keep their own extra_s)
    sentiment_call_s: 30, sentiment_tail_s: 420,
    req_s: { chatgpt: 60, gemini: 60, perplexity: 30, claude: 45, ai_mode: 45, ai_overview: 25, copilot: 20, chatgpt_api: 45, gemini_api: 45 } };
  /** seconds one request costs a part, on these engines: the modelled figure, or the measured one when a part of the run measured it */
  const secPerRequest = (engines, measured) => {
    const es = (engines || []).filter(e => TIME.req_s[e]); const avg = es.length ? es.reduce((t, e) => t + TIME.req_s[e], 0) / es.length : 45;
    const model = (avg / TIME.batch + TIME.interval_s) * (1 + TIME.retry_share);
    return n0(measured) > 0 ? Math.max(0.5, n0(measured) * TIME.headroom) : model; };
  /** how many requests one part may ask: { size, sec_per_request, budget_s, basis } */
  const chunkPlan = (o) => {
    const x = o || {}; const spr = secPerRequest(x.engines, x.measured_s); const aj = Math.max(0, n0(x.analyst_jobs));
    // W2-E3 (2026-10-23): `extra_s` = the seconds the run's last part keeps for the fan-out check, the persona test and the demand lookups
    // (AIX.extraSeconds); 0 when none of them is on, so every part keeps its size
    const budget = Math.max(0, n0(x.budget_s) || (TIME.budget_s - TIME.fixed_s - TIME.retry_wait_s - aj * TIME.analyst_job_s - Math.max(0, n0(x.extra_s))));
    let size = Math.min(LIMITS.chunk_requests, Math.max(TIME.min_requests, Math.floor(budget / spr)));
    if (x.halve) size = Math.max(TIME.min_requests, Math.floor(size / 2));
    return { size, sec_per_request: Math.round(spr * 100) / 100, budget_s: Math.round(budget), analyst_jobs: aj, halved: !!x.halve,
      basis: (n0(x.measured_s) > 0 ? 'measured ' + (Math.round(n0(x.measured_s) * 100) / 100) + ' s a request in this run\'s earlier parts (+20%)' : 'modelled ' + (Math.round(spr * 100) / 100) + ' s a request (slow-case engine time / batch of ' + TIME.batch + ', +15% retries)')
        + ', ' + Math.round(budget) + ' s for requests in a part (40 of the 60 minutes, less loads, the retry pause and ' + aj + ' analyst job(s)' + (n0(x.extra_s) > 0 ? ', and ' + Math.round(n0(x.extra_s)) + ' s kept for the fan-out check / persona test / demand lookups' : '') + ')' + (x.halve ? '; halved after a part that did not finish' : '') }; };

  // ---- 6d. one fit-gate context for the weekly run and the pulse (F2, 2026-10-23: ENGINE_AUDIT.md E18) ------------------------------------
  // The weekly plan protected the ladder heads + the site's services, the pulse the questions' own topics with no services, so one question
  // could be refused on one path and asked on the other. Both now build the gate's input here, from the same rows.
  const servicesOfRow = (row) => { const r = row || {}; if (!(S(r.canonical_host) || S(r.model_updated_at))) return [];
    const arr = (v) => { const x = parse(v, null); return Array.isArray(x) ? x : listOf(v); };
    return [...new Set([...arr(r.declared_services), ...arr(r.services_json)].map(s => S(s).slice(0, 120)).filter(Boolean))].slice(0, 30); };
  const fitInput = (o) => { const x = o || {};
    return { own_domain: S(x.domain), competitors: [...new Set((x.competitors || []).map(S).filter(Boolean))].slice(0, 8), brands: x.aliases || {},
      heads: [...new Set((x.ladders || []).map(l => S(l.head_keyword)).filter(Boolean))], services: (x.services || []).slice(0, 30), keywords: x.keywords || [] }; };

  // ---- 7. the panel's identity: a delta is only a delta between the same questions ---------------------------------------------
  const panelIds = (ids) => [...new Set((ids || []).map(S).filter(Boolean))].sort();
  const panelHash = (ids, engines) => { const s = panelIds(ids).join(',') + '#' + [...new Set(engines || [])].sort().join('+'); return (hash(s) >>> 0).toString(36) + '-' + panelIds(ids).length; };
  /** share of the earlier panel's questions still asked now (0-1), and whether that is the same panel (>= 80%) */
  const overlap = (now, before) => { const A = new Set(panelIds(now)), B = panelIds(before); if (!B.length || !A.size) return { share: null, same: null, common: 0 };
    const c = B.filter(x => A.has(x)).length; const share = c / Math.max(A.size, B.length); return { share: Math.round(1000 * share) / 1000, same: share >= 0.8, common: c }; };

  // ---- 8. the money: ONE formula (the app's app/shared/src/cost.ts estimateAiPanelCost mirrors it; both are held to the golden cases in
  // v5/data/ai_panel_cost_cases.json — harness S211 and app/shared cost.aipanel.test.ts) --------------------------------------------
  // DataForSEO price per question on each engine (LLM scraper / LLM Responses / SERP, measured 2026-10-02, priced 2026-10-08; the two API
  // engines of 2026-10-18 are ESTIMATES until their first live call — the settle takes each task's own `cost` either way).
  const PRICE = { chatgpt: 0.004, gemini: 0.004, perplexity: 0.006, claude: 0.025, ai_overview: 0.002, ai_mode: 0.004, copilot: 0.002, chatgpt_api: 0.012, gemini_api: 0.02 };
  const PRICE_BASIS = { chatgpt_api: 'estimate: DataForSEO $0.0002 a task + OpenAI tokens + web search (~$0.01); confirm on the first live run', gemini_api: 'estimate: DataForSEO $0.0002 a task + Gemini tokens + Google Search grounding; confirm on the first live run' };
  const ENGINES = Object.keys(PRICE);
  const DEFAULT_ENGINES = ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode'];   // copilot and the two API engines are opt-in
  const MONTHLY_ENGINES = ['claude'];
  const PULSE_ENGINES = ['chatgpt', 'gemini', 'ai_mode', 'copilot'];
  const FIXED = { weekly_ai_min: 0.13, brief_ai: 0.03, analyst_job_ai: 0.02, analyst_per_job: 12, analyst_share: 0.35, analyst_cap_base: 24, analyst_cap_max: 60,
    full_dfs: 0.45, full_ai: 0.3, weeks_per_month: 4.33, pulse_days: 6,
    // W2-E2's Sentiment Reader (Claude Haiku, merged 2026-10-23): every answer of the run that names the business, 20 a call, at most 40 calls a
    // run, about $0.02 a call (R-E9, 2026-10-23: was $0.012; a call reads ~20 x (question + passage) + the prompt = ~6k tokens at Haiku 4.5's $1/M
    // = $0.006, and answers 2-3k tokens (capped at 4,000) at $5/M = $0.010-0.020, so $0.016-0.026; _cost_cal.js holds the same Haiku prices).
    // The worst case a run can spend is calls_max x tries (the agent node's retryOnFail: 2) x sentiment_call_worst (6k in + 4k out = $0.026). Named answers = the weekly run's answers x sentiment_named_rate. ASSUMPTION: 50% named, conservative on purpose (a
    // new site is named in far fewer), so the quote is an upper bound; the full run's few extra answers (the monthly engine, the brand question) are
    // inside that margin and are not priced on their own (a quote never moves by a call or two with the engine set).
    sentiment_named_rate: 0.5, sentiment_per_call: 20, sentiment_calls_max: 40, sentiment_call_ai: 0.02, sentiment_call_worst: 0.026, sentiment_tries: 2 };
  /** the Sentiment Reader's calls and Claude money for a run of `answers` answers */
  const sentimentOf = (answers) => { const named = Math.ceil(Math.max(0, n0(answers)) * FIXED.sentiment_named_rate);
    const calls = Math.min(FIXED.sentiment_calls_max, Math.ceil(named / FIXED.sentiment_per_call)); return { named, calls, ai: Math.round(calls * FIXED.sentiment_call_ai * 10000) / 10000 }; };
  // ---- W2-E3 (2026-10-23, docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §4): the owner's engine and coverage options -------------------------
  // Every one is OFF by default, so a site that sets none of them costs exactly what it cost before (the golden cases of `cases` hold that).
  //  * ai_claude_weekly   Claude every weekly run instead of the month's full run only
  //  * ai_pulse_engines   which engines the daily pulse asks ('' = the default four, each when the site has it on); Perplexity and the Google AI
  //                       Overview may be added (the AI Overview is asked only for a real search phrase, so its figure here is an upper bound)
  //  * ai_persona_context each buyer role sent to the ChatGPT API as the asker's context on a sub-panel of PERSONA.questions questions (the same
  //                       questions for every role), plus the same questions once with no role (one control shared by every role), every weekly
  //                       run: the persona effect, labelled "API answers"
  //  * ai_fanout_check    the N most frequent searches the engines ran before answering, each checked on Google's top 10 every weekly run
  //                       (a results page read earlier the same day is reused for nothing, so the figure is an upper bound)
  //  * ai_demand_market   (W2-E3 addition to the contract) the monthly market trend from the AI-answer database: your mentions month by month,
  //                       the mentions won and lost, and the brands AI names most for your main topic (3 LLM Mentions tasks on the full run)
  // The extra prices live apart from PRICE (PRICE is the per-engine table the app's AI_ENGINE_COST is held to).
  const XPRICE = { fanout_serp: 0.002, persona: 0.012, demand_task: 0.11 };   // serp/google/organic depth 10 (live); the ChatGPT API answer (= PRICE.chatgpt_api, an estimate until its first live call); one LLM Mentions task ($0.10 + ~10 rows x $0.001)
  const PERSONA = { questions: 12, max_roles: 6 };   // 12 questions a role = MIN_RATE_SAMPLES, so a role's rate is never "too few answers" by construction
  const FANOUT_MAX = 200;
  const DEMAND_TASKS = 3;
  const PULSE_ALLOWED = ['chatgpt', 'gemini', 'ai_mode', 'copilot', 'perplexity', 'ai_overview'];
  /** the engines the daily pulse asks: the owner's choice (only engines the site has on, in a fixed order) or, with none, the default four */
  const pulseEnginesOf = (engines, chosen) => {
    const en = (engines && engines.length ? engines : DEFAULT_ENGINES).map(e => S(e).toLowerCase());
    const pick = listOf(chosen).map(e => e.toLowerCase().replace(/[\s-]+/g, '_')).filter(e => PULSE_ALLOWED.includes(e) && en.includes(e));
    return pick.length ? PULSE_ALLOWED.filter(e => pick.includes(e)) : PULSE_ENGINES.filter(e => en.includes(e));
  };
  /** the engines asked only on the month's full run */
  const monthlyOf = (claudeWeekly) => (claudeWeekly ? [] : MONTHLY_ENGINES.slice());
  const r4 = (x) => Math.round(x * 10000) / 10000; const r2 = (x) => Math.round(x * 100) / 100;
  const sumPrice = (list) => list.reduce((t, e) => t + (PRICE[e] || 0), 0);
  /** what the options add to one run: the persona test and the fan-out check every weekly run, the demand trend on the full run */
  const optionsOf = (x, asked) => {
    const nRoles = Array.isArray(x.personas) || typeof x.personas === 'string' ? listOf(x.personas).length : Math.round(n0(x.personas));   // a count, or the roles themselves
    const roles = x.persona_context ? Math.min(PERSONA.max_roles, Math.max(0, nRoles)) : 0;
    const pq = roles ? Math.min(PERSONA.questions, asked) : 0;
    const pReq = roles ? (roles + 1) * pq : 0;   // every role, plus one control arm shared by all of them
    const fq = clamp(Math.round(n0(x.fanout_check)), 0, FANOUT_MAX);
    const dm = !!x.demand_market;
    return { claude_weekly: !!x.claude_weekly, pulse_engines: null,
      persona: { on: !!x.persona_context, roles, questions: pq, requests_run: pReq, dfs_run: r4(pReq * XPRICE.persona) },
      fanout: { queries: fq, requests_run: fq, dfs_run: r4(fq * XPRICE.fanout_serp) },
      demand_market: { on: dm, tasks: dm ? DEMAND_TASKS : 0, dfs_full: dm ? r4(DEMAND_TASKS * XPRICE.demand_task) : 0 } };
  };
  /** the seconds the run's last part keeps for the options (batches of 10, the slowest request of each kind; none = 0) */
  const extraSeconds = (o) => { const x = o || {}; const p = n0(x.persona_requests), f = n0(x.fanout_requests), d = n0(x.demand_requests);
    return Math.ceil(p / 10) * (TIME.req_s.chatgpt_api || 45) + Math.ceil(f / 10) * 10 + Math.ceil(d / 10) * 30 + (p + f + d ? TIME.retry_wait_s : 0); };
  /** the Answer Analyst jobs one weekly run may start (it reads the answers that matter, 12 a job; more for a bigger panel, never past 60) */
  const analystCap = (panel) => Math.min(FIXED.analyst_cap_max, FIXED.analyst_cap_base + Math.floor(n0(panel) / 25));
  /** o: { panel, engines, pulse (bool), pulse_mode ('auto'|'sample'|'full'), pulse_per_week, cluster_size, and the W2-E3 options claude_weekly,
   *  pulse_engines, persona_context + personas (the number of buyer roles), fanout_check, demand_market; AI-FOCUS: pulse_questions, the questions the
   *  pulse asks when its scope is the focus }. Every figure is in US dollars;
   *  `run` is what one execution chain of the weekly tracker spends (weekly / the month's full run), `pulse_day` one pulse morning,
   *  `month` the site's month (4.33 weekly runs + the full run's extra + 26 pulse mornings); `options` what each option adds. */
  const cost = (o) => {
    const x = o || {};
    const panel = clamp(Math.round(n0(x.panel)) || LIMITS.default_new, LIMITS.min, LIMITS.max);
    const engines = [...new Set((x.engines && x.engines.length ? x.engines : DEFAULT_ENGINES).filter(e => PRICE[e] != null))];
    const asked = Math.max(1, panel - 1);                  // the brand question is asked on the month's full run only
    const MONTHLY = monthlyOf(x.claude_weekly);            // W2-E3: Claude weekly when the owner asks for it
    const wE = engines.filter(e => !MONTHLY.includes(e));
    const pE = pulseEnginesOf(engines, x.pulse_engines);   // W2-E3: the owner's pulse engines ('' = the default four)
    const answers = asked * wE.length;
    const jobs = Math.min(analystCap(panel), Math.ceil(answers * FIXED.analyst_share / FIXED.analyst_per_job));
    const opt = optionsOf(x, asked); opt.pulse_engines = pE.slice();
    const sw = sentimentOf(answers);   // W2-E2's Sentiment Reader, priced on the weekly run's answers (every run asks them)
    const weekly = { dfs: r4(asked * sumPrice(wE) + opt.persona.dfs_run + opt.fanout.dfs_run), ai: r4(Math.max(FIXED.weekly_ai_min, FIXED.brief_ai + jobs * FIXED.analyst_job_ai) + sw.ai) };
    weekly.usd = r4(weekly.dfs + weekly.ai);
    const extra = { dfs: r4(MONTHLY.filter(e => engines.includes(e)).reduce((t, e) => t + panel * PRICE[e], 0) + sumPrice(wE) + FIXED.full_dfs + opt.demand_market.dfs_full), ai: FIXED.full_ai };
    extra.usd = r4(extra.dfs + extra.ai);
    const full = { dfs: r4(weekly.dfs + extra.dfs), ai: r4(weekly.ai + extra.ai) }; full.usd = r4(full.dfs + full.ai);
    const on = x.pulse !== false && pE.length > 0;
    const pw = on ? pulsePerWeek({ asked, weekly_engines: wE.length, pulse_engines: pE.length, cluster_size: x.cluster_size, mode: x.pulse_mode, per_week: x.pulse_per_week }) : { per_week: 0, headline: halfWidth(answers), cluster: halfWidth(Math.min(asked, n0(x.cluster_size) || LIMITS.cluster_size_guess) * wE.length), capped: false, why: on ? '' : 'the daily pulse is off' };
    // AI-FOCUS (2026-10-27): with the pulse scope 'focus' the pulse asks only `pulse_questions` of the panel (the questions of the topics the client
    // works on); null / absent = the whole panel, exactly as before (every golden case without it is unchanged)
    const pq = x.pulse_questions == null || x.pulse_questions === '' || !Number.isFinite(Number(x.pulse_questions)) ? asked : clamp(Math.round(n0(x.pulse_questions)), 0, asked);
    const qDay = on ? Math.min(pq, Math.ceil(pq * pw.per_week / FIXED.pulse_days)) : 0;
    const pulse_day = { dfs: r4(qDay * sumPrice(pE)), ai: 0 }; pulse_day.usd = pulse_day.dfs;
    const W = FIXED.weeks_per_month;
    const month = { weekly: r2(W * weekly.usd), full_extra: r2(extra.usd), pulse: r2(W * FIXED.pulse_days * pulse_day.usd) };
    month.total = r2(month.weekly + month.full_extra + month.pulse);
    return { panel, asked, engines, weekly_engines: wE, pulse_engines: on ? pE : [], per_week: pw.per_week, pulse_questions_day: qDay, pulse_why: pw.why, pulse_capped: !!pw.capped,
      requests: { weekly: answers, full: answers + MONTHLY.filter(e => engines.includes(e)).length * panel + wE.length, pulse_day: qDay * (on ? pE.length : 0) },
      executions: Math.max(1, Math.ceil(answers / LIMITS.chunk_requests)), analyst_jobs: jobs,
      half_width: { headline: pw.headline, cluster: pw.cluster }, run: { weekly, full }, full_extra: extra, pulse_day, month,
      prices: engines.map(e => ({ engine: e, usd: PRICE[e], basis: PRICE_BASIS[e] || 'measured / priced' })),
      // W2-E3: what each option adds (all zero / off by default), and the requests the run's last part makes for them
      sentiment: { named_rate: FIXED.sentiment_named_rate, ...sw },
      options: { ...opt, requests_extra: { weekly: opt.persona.requests_run + opt.fanout.requests_run, full: opt.persona.requests_run + opt.fanout.requests_run + opt.demand_market.tasks } } };
  };

  return { LIMITS, panelSize, normMarket, locationOf, listOf, marketsOf, personasOf, stageOf, stems, jaccard, sameAsk, dedupe, stratumOf, pulseDay, halfWidth,
    pulsePerWeek, pulseSample, reqKey, slice, stateKey, stateOf, stateVerdict, stateRow, doneRun, panelIds, panelHash, overlap, hash,
    MARKETS_MAX, normQ, hash64, promptId, findStored, keywordOf, KEYWORD_SOURCES, STOPPED, ENG_CODE, packKeys, unpackKeys, CEILING, runCeiling, ceilingLeft, keysUsd, baseState,
    storedRow, storeCheck, healStore, storeHealDue,
    TIME, secPerRequest, chunkPlan, servicesOfRow, fitInput,
    PRICE, PRICE_BASIS, ENGINES, DEFAULT_ENGINES, MONTHLY_ENGINES, PULSE_ENGINES, FIXED, analystCap, cost, sentimentOf,
    XPRICE, PERSONA, FANOUT_MAX, DEMAND_TASKS, PULSE_ALLOWED, pulseEnginesOf, monthlyOf, optionsOf, extraSeconds };
})();
// ---- SERP-GOTO (2026-11-08, R5 L-1): the real site behind a Google results-page redirect (SU) ----
// Since about 2026-11-05 DataForSEO's LIVE Google organic SERP answers every organic and local-pack item with `domain: "google.com"`,
// `url: "https://google.com/goto?url=CAES..."` (an opaque token nobody can decode), `main_domain` / `relative_url` null and `links[].url`
// wrapped the same way. Google started serving /goto links in August; on 2026-11-02 DataForSEO wrote that Google now throttles how many
// of them can be resolved per results page, so "High priority and Live requests resolve about half" (live probes of 2026-11-08 resolved
// none of 50). Standard-priority tasks (task_post + task_get, about 80 s) still come back with every real URL.
//   Read as it comes, every reader took google.com for the site: the Rank Tracker never found the client (13 of 14 rows of 2026-11-05
// held goto URLs), competitors became google.com, and no two keywords ever shared a result (each token is unique).
//   What survives is `breadcrumb` ("https://www.sage.com › en-ae › erp") and sometimes `website_name` (a host, a brand, or
// "Facebook · <page name>"). The rule, applied as early as possible (every DataForSEO answer node, the SERP cache, the rank kit):
//   * an item is a REDIRECT when its url is a Google redirect (google.<tld>/goto, /url, /search/url, /aclk; or Bing /ck/a) - a normal
//     google.com result (support.google.com/..., about.google/...) is NOT one and passes untouched;
//   * its host comes from the breadcrumb (the text before the first " › "), else from website_name when that is a host, else from a
//     known social network named before " · " ("Facebook · X" -> facebook.com); otherwise the item stays UNRESOLVED: domain null,
//     url null, never google.com;
//   * a recovered url is `https://<host>/<breadcrumb segments joined by "/">` - APPROXIMATE: Google's breadcrumb segments are often the
//     path ("› en-ae › erp") but sometimes page labels ("› Home › Blog"), and a long one is cut ("› best-erp-sof..."). Only a complete
//     breadcrumb of slug segments is a path (`url_path: 'path'`); a cut one, labels or the host alone say `url_partial: true` and the url
//     is then the host's home page (review 2026-11-08, M2);
//   * every rewritten item carries `url_exact: false`, `url_recovered` ('breadcrumb' | 'website_name' | 'social' | null) and the original
//     redirect in `redirect_url`; an item that was not a redirect is returned as the SAME object (old fixtures stay byte-identical).
// What a reader may do with an approximate url (the rule every reader follows):
//   * the SITE (host) is reliable: own-site rank detection matches by host, competitors are counted by host;
//   * the PAGE is not: own-page identification says "page not identified" (url ''), never a guessed page; a cited source needs an exact
//     url; clustering compares `SU.key()` - host + the complete slug path - which is the same for the same result on two pages read
//     the same way, marked `~` so it never equals an exact url key; a partial result has NO key (review H1: two posts of one blog must
//     not look like one page);
//   * own-site rank: -1 only when a result with no site could be ours (`couldBe`: our domain label in its name / title / breadcrumb).
// Regex only: the n8n Code sandbox has no URL constructor. `var` + the guard lets two kits that both inline SU share one copy.
var SU = (typeof SU === 'object' && SU && SU.v === 1) ? SU : (() => {
  const S = (x) => (x == null ? '' : String(x));
  const REDIR = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:google\.[a-z]{2,3}(?:\.[a-z]{2})?\/(?:goto|url|search\/url|aclk)(?=[?\/#]|$)|bing\.com\/ck\/a(?=[?\/#]|$))/i;
  const isRedirect = (u) => REDIR.test(S(u).trim());
  // R-H2 (review 2026-11-08): a host may be Unicode (Google shows IDNs as "müller.de") or punycode, its TLD too ("xn--mgbaam7a8h", the UAE)
  const HOST = /^(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:\p{L}{2,24}|xn--[a-z0-9-]{1,59})$/iu;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);   // R-L1: "constructor" is not a social network
  const SOCIAL = { facebook: 'facebook.com', linkedin: 'linkedin.com', youtube: 'youtube.com', instagram: 'instagram.com', x: 'x.com',
    twitter: 'x.com', reddit: 'reddit.com', quora: 'quora.com', tiktok: 'tiktok.com', medium: 'medium.com', pinterest: 'pinterest.com' };
  const bare = (h) => S(h).toLowerCase().replace(/^www\./, '');
  // R-H2: the scheme is optional ("en.wikipedia.org › wiki › ERP"); a first word with no dot ("3 reactions · 1 month ago") is not a host
  const crumbHost = (b) => { const m = S(b).trim().match(/^(?:https?:\/\/)?([^\/\s›]+)/i); const h = m && !/@/.test(m[1]) ? m[1].toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '') : ''; return HOST.test(h) ? h : ''; };
  // the breadcrumb's path segments, up to (not including) the first cut one; `cut` says whether one was cut
  // R-M2: a segment is a PATH segment only when it looks like a slug (lower case, no spaces); "› Home › Blog" are page labels, not a path
  const SLUG = /^[a-z0-9%._~-]+$/;
  const crumbPath = (b) => {
    const parts = S(b).split(/\s*›\s*/).slice(1).map(x => x.trim()).filter(Boolean); const segs = []; let cut = false, labels = false;
    for (const p of parts) { if (/^(?:\.\.\.|…)$/.test(p) || /(?:\.\.\.|…)$/.test(p)) { cut = true; break; } if (!SLUG.test(p)) labels = true; segs.push(p.replace(/\s+/g, '-').replace(/[?#]/g, '')); }
    return { segs, cut, labels };
  };
  // a redirect that CARRIES its target (google.com/url?q=https://..., ?url=https%3A...) is read as that target, exactly (FU-SV kept this
  // rule for the facts search); the /goto token is opaque, so this finds nothing there
  // R-L2: one host rule for a carried target; userinfo ("https://u:p@host") or no host at all is not a target, and nothing here can throw
  const hostOfUrl = (u) => { const m = S(u).match(/^https?:\/\/([^\/?#\s]+)/i); if (!m || /@/.test(m[1])) return ''; const h = m[1].toLowerCase().replace(/:\d+$/, ''); return HOST.test(h) ? h : ''; };
  const dec = (v) => { let x = S(v); for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(x); i++) { try { x = decodeURIComponent(x); } catch (e) { break; } } return x; };
  const carried = (u) => { const s = S(u).trim(); const q = s.indexOf('?'); if (q < 0) return '';
    for (const n of ['url', 'q', 'u']) for (const p of s.slice(q + 1).replace(/#.*$/, '').split('&')) { const e = p.indexOf('=');
      if (e > 0 && p.slice(0, e).toLowerCase() === n) { const t = dec(p.slice(e + 1)).trim(); if (/^https?:\/\/[^\s\/?#]+\.[^\s<>"]*$/i.test(t) && !isRedirect(t) && hostOfUrl(t)) return t; } }
    return ''; };
  const nameHost = (n) => { const s = S(n).trim().toLowerCase(); if (HOST.test(s)) return s;
    const brand = s.split(/\s*·\s*/)[0].trim(); return has(SOCIAL, brand) ? SOCIAL[brand] : ''; };
  // one item -> the same object when it is not a redirect, else a copy with the real host (or none)
  const fixItem = (it) => {
    if (!it || typeof it !== 'object' || !isRedirect(it.url)) return fixLinks(it);
    const tgt = carried(it.url); const th = tgt ? hostOfUrl(tgt) : '';
    if (tgt && th) { const h = th;
      return fixLinks({ ...it, domain: h, url: tgt, main_domain: bare(h), relative_url: (tgt.match(/^https?:\/\/[^\/?#]+(\/[^?#]*)?/i) || [])[1] || '/', url_recovered: 'redirect', redirect_url: S(it.url) }, true); }   // exact: no url_exact flag
    const ch = crumbHost(it.breadcrumb); const nh = ch ? '' : nameHost(it.website_name);
    const host = ch || nh;
    const how = ch ? 'breadcrumb' : (nh ? (HOST.test(S(it.website_name).trim()) ? 'website_name' : 'social') : null);
    // url_path: 'path' (slug segments, complete), 'labels' (page labels, not a path), 'cut' (Google cut it), 'none' (the host only)
    // url_partial: the PAGE is not known from the breadcrumb (anything but 'path'); its url is then the host's home page
    let url = null, rel = null, partial = true, pathKind = 'none';
    if (host) {
      const p = ch ? crumbPath(it.breadcrumb) : { segs: [], cut: false, labels: false };
      pathKind = p.cut ? 'cut' : p.labels ? 'labels' : p.segs.length ? 'path' : 'none';
      partial = pathKind !== 'path'; const segs = partial ? [] : p.segs;
      rel = '/' + segs.join('/'); url = 'https://' + host + (segs.length ? rel : '/');
    }
    const out = { ...it, domain: host || null, url, main_domain: host ? bare(host) : null, relative_url: rel, url_exact: false,
      url_recovered: how, url_partial: partial, url_path: host ? pathKind : null, redirect_url: S(it.url) };
    return fixLinks(out, true);
  };
  // links / nested items (AI Overview elements, sitelinks): a redirect url there is dropped (null), never kept as google.com
  const fixLinks = (it, copied) => {
    if (!it || typeof it !== 'object') return it;
    let o = it;
    for (const f of ['links', 'items', 'references']) {
      const arr = it[f]; if (!Array.isArray(arr)) continue;
      let changed = false;
      const next = arr.map(x => { if (!x || typeof x !== 'object') return x;
        if (f === 'items' && x.type && (x.type === 'organic' || x.breadcrumb != null)) { const y = fixItem(x); if (y !== x) changed = true; return y; }
        if (isRedirect(x.url)) { changed = true; return { ...x, url: null, domain: (x.domain && !/^(?:www\.)?google\./i.test(S(x.domain))) ? x.domain : null, url_exact: false, redirect_url: S(x.url) }; }
        const y = fixLinks(x); if (y !== x) changed = true; return y; });
      if (changed) { if (o === it && !copied) o = { ...it }; o[f] = next; }   // `copied`: `it` is already this kit's own copy
    }
    return o;
  };
  // a whole DataForSEO answer -> the same object when nothing was a redirect, else a copy (result[].items rewritten, counts on the result)
  const fixAnswer = (res) => {
    if (!res || typeof res !== 'object' || !Array.isArray(res.tasks)) return res;
    let changedAny = false;
    const tasks = res.tasks.map(t => {
      if (!t || !Array.isArray(t.result)) return t;
      let ch = false;
      const result = t.result.map(r => {
        if (!r || !Array.isArray(r.items)) return r;
        let n = 0, rec = 0, unres = 0;
        const items = r.items.map(x => { const y = fixItem(x); if (y !== x) { if (y && y.redirect_url && y.type) { n++; if (y.domain) rec++; else unres++; } } return y; });
        if (!items.some((y, i) => y !== r.items[i])) return r;
        ch = true; return { ...r, items, serp_url: { redirects: n, recovered: rec, unresolved: unres, rule: 'SU (v5/code/_serp_url.js): host from the breadcrumb, url approximate' } };
      });
      if (!ch) return t; changedAny = true; return { ...t, result };
    });
    return changedAny ? { ...res, tasks } : res;
  };
  const fixItems = (items) => (Array.isArray(items) ? items.map(fixItem) : items);
  const exact = (it) => !!it && it.url_exact !== false;
  const unresolved = (it) => !!it && it.url_exact === false && !it.domain;
  // a stored compact reading written before this fix: an item still holding a redirect url with no recovery on it
  const poisoned = (v) => !!v && Array.isArray(v.items) && v.items.some(x => x && (x.type === 'organic' || x.type === 'local_pack') && isRedirect(x.url) && x.url_exact !== false);
  // the clustering key of one result: an exact url as it is (no scheme, no www, no query, no trailing slash); an approximate one as
  // "~host/segments" in lower case (the same result read on two pages gives the same key; it is never equal to an exact key)
  const urlKey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  // R-H1 (review 2026-11-08): only a COMPLETE slug path is a key. A cut, label or host-only breadcrumb has NO key ('') - two different
  // posts of one blog would otherwise share "~host/…" and merge two searches that share no page; with no key such a result neither
  // matches nor counts towards the minimum a results page needs to be compared (Ladder Clusters: "too few to compare")
  const key = (it) => { if (!it) return ''; if (exact(it)) return urlKey(it.url || it.domain);
    if (!it.domain || it.url_partial || !it.relative_url || it.relative_url === '/') return ''; return '~' + urlKey(S(it.domain) + it.relative_url); };
  // R-H2: could this unresolved result be the site's own? Its visible name, title or breadcrumb carries the site's own label
  // ("techand" for techand.ai, "gear up" for gear-up.ae), in any case and spacing
  const flat = (v) => S(v).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const labelOf = (d) => flat(bare(S(d)).replace(/^https?:\/\//, '').split('/')[0].split('.')[0]);
  const couldBe = (it, domain) => { const l = labelOf(domain); if (!it || l.length < 4) return false;
    return [it.website_name, it.title, it.breadcrumb].some(v => flat(v).includes(l)); };
  // ---- SERP-GOTO (re-review N1): unread readings of seo_rank_history, shared by the Rank Tracker and the Site Tracker ----
  // UNREAD = position -1 because a result Google hid may be ours (snapshot `mo`), or settled after that (`st`). A -1 without `mo` is a
  // failed read, which is not an unread reading and ends a streak. A row stored with bare redirects (before this fix) is no reading.
  const snapOf = (v) => { if (v && typeof v === 'object') return v; try { const o = JSON.parse(S(v) || 'null'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  const poisonedRow = (h) => !!h && ((Array.isArray(snapOf(h.snapshot_json).top) && snapOf(h.snapshot_json).top.some(e => e && isRedirect(e.u))) || isRedirect(h.url));
  const unreadRow = (h) => { if (!h || Number(h.position) !== -1) return false; const x = snapOf(h.snapshot_json); return Number(x.mo) > 0 || Number(x.st) > 0; };
  const weekOf = (t) => { const d = new Date(S(t)); if (isNaN(d.getTime())) return ''; return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))).toISOString().slice(0, 10); };
  // how many earlier CALENDAR WEEKS (Monday-based, UTC) in a row ended unread, newest first: a catch-up or an app re-check in the same
  // week is one week, and this run's own week does not count. rows: one keyword's desktop rows of one tracker (any order)
  const unreadWeeks = (rows, o) => { const now = weekOf((o || {}).now || new Date().toISOString()); const weeks = new Set();
    for (const h of (rows || []).filter(r => r && !poisonedRow(r) && S(r.checked_at)).sort((a, b) => S(b.checked_at).localeCompare(S(a.checked_at)))) {
      if (!unreadRow(h)) break; const w = weekOf(h.checked_at); if (w && w !== now) weeks.add(w); }
    return weeks.size; };
  // the words a report uses for an unread reading (null for any other)
  const unreadNote = (snap) => { const x = snapOf(snap); return Number(x.st) > 0 ? 'not found among the results we could read' : Number(x.mo) > 0 ? 'could not be told: a result Google hid may be yours' : null; };
  return { v: 1, REDIR, HOST, unreadRow, weekOf, unreadWeeks, unreadNote, poisonedRowSU: poisonedRow, isRedirect, carried, hostOfUrl, couldBe, labelOf, fixItem, fixItems, fixAnswer, exact, unresolved, poisoned, key, urlKey, crumbHost, crumbPath, nameHost };
})();
// KW-SERP / RV-12 (2026-10-21): ONE Google results-page reading per search and per day, shared by every path that reads it.
//   On 2026-10-21 the research, the ladder and the rank tracker read three different results pages for "ai consultant" on the same day,
// and on 2026-10-17 two runs three minutes apart said "no AI Overview" and "an AI Overview was seen". A client must get one answer, and
// we must pay for it once. The identity of a reading is: the keyword (lower case, spaces collapsed), location_code, language_code, device
// and the UTC day. The row in seo_cache is keyed WITHOUT the day (`serp:<keyword>|<location>|<language>|<device>`) and the day is checked
// on the stored value, so the table holds one row per search (overwritten by the next day's read), not one row per search per day.
//   A path asks for a reading with what it needs: a depth (how many results) and whether the AI Overview's content must be loaded. A
// stored reading is used only when it is from today AND at least that deep AND (when asked) loaded the AI Overview; otherwise the path
// makes its request as before and its reading replaces the stored one. A failed read (HTTP error, a task error inside an HTTP 200, no
// result) is never stored. "No Search Results" (40102) is DataForSEO's final answer: read, and empty, so it is stored.
//   Concurrency: two runs that miss at the same moment both pay once and the later write wins. That is accepted: it costs one extra
// read in a rare race and both runs still read a real page. A cache hit costs nothing: the rebuilt answer carries cost 0 and a task id
// `cache:<id of the paid task>`, so the ledger's count-once-by-task-id rule still counts the money exactly once.
const SC = (() => {
  const CFG = { prefix: 'serp:', kind: 'serp', title_len: 120, desc_len: 160, aio_text_len: 800, max_chars: 20000, default_depth: 100 };
  const S = (x) => (x == null ? '' : String(x));
  const normKw = (k) => { let s = S(k); try { s = s.normalize('NFKC'); } catch (e) {} return s.toLowerCase().replace(/\s+/g, ' ').trim(); };
  const dayOf = (t) => { const d = t ? new Date(t) : new Date(); return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10); };
  // DataForSEO's datetime is "2026-10-21 14:05:12 +00:00"; Date() does not read that form everywhere, so it is rewritten to ISO first
  const isoOf = (t) => { const s = S(t).trim(); if (!s) return ''; const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?\s*([+-]\d{2}):?(\d{2})$/);
    const d = new Date(m ? m[1] + 'T' + m[2] + m[3] + ':' + m[4] : s); return isNaN(d.getTime()) ? '' : d.toISOString(); };
  const ident = (q) => ({ keyword: normKw((q || {}).keyword), location_code: Number((q || {}).location_code) || 0,
    language_code: S((q || {}).language_code || 'en').toLowerCase().trim() || 'en', device: S((q || {}).device || 'desktop').toLowerCase().trim() || 'desktop' });
  const key = (q) => { const i = ident(q); return CFG.prefix + [i.keyword, i.location_code, i.language_code, i.device].join('|'); };
  // what a request needs from a reading: its depth (DataForSEO's default is 100) and whether it asked for the AI Overview's content
  const need = (body) => ({ depth: Number((body || {}).depth) || CFG.default_depth, aio: (body || {}).load_async_ai_overview === true });
  const hhmm = (iso) => { const s = isoOf(iso); return s ? s.slice(11, 16) : ''; };
  const timing = (r) => (r && r.at ? 'read earlier today at ' + hhmm(r.at) + ' UTC' : 'read earlier today');
  const task0 = (res) => ((res && Array.isArray(res.tasks)) ? res.tasks[0] : null) || {};
  // the one test of "this answer is a reading": no HTTP error, 20000 at the top and on the task, a result array; 40102 is read and empty
  const status = (res) => {
    if (!res || typeof res !== 'object' || res.error) return 'failed';
    const t = task0(res);
    if (Number(t.status_code) === 40102 || Number(res.status_code) === 40102) return 'empty';
    if (Number(res.status_code) !== 20000 || Number(t.status_code) !== 20000 || !Array.isArray(t.result)) return 'failed';
    return 'ok';
  };
  const cut = (s, n) => S(s).slice(0, n);
  const ref = (r) => ({ domain: cut((r || {}).domain, 80), url: cut((r || {}).url, 240), title: cut((r || {}).title, CFG.title_len) });
  // SERP-GOTO (2026-11-08, v5/code/_serp_url.js, inlined above this kit): a result whose url was a Google redirect is stored with its
  // recovered host and the flags that say its url is approximate; a clean result is stored exactly as before (no new keys)
  const su = (o, x) => { if (x && x.url_exact === false) { o.url_exact = false; o.url_recovered = x.url_recovered || null; o.url_partial = !!x.url_partial; o.url_path = x.url_path || null; o.relative_url = x.relative_url || null; } return o; };
  // the compact form of one item: enough for every reader of this codebase (organic order and owners, page titles, PAA, related searches,
  // forum threads, the featured snippet, the AI Overview and its cited sources, which features were on the page), nothing else
  const compactItem = (x) => {
    const t = S(x && x.type); const o = { type: t, rank_group: Number(x.rank_group) || null, rank_absolute: Number(x.rank_absolute) || null };
    if (t === 'organic') { o.url = cut(x.url, 300); o.domain = cut(x.domain, 100); o.title = cut(x.title, CFG.title_len); o.description = cut(x.description, CFG.desc_len); return su(o, x); }
    if (t === 'people_also_ask') { o.items = (x.items || []).slice(0, 10).map(q => ({ title: cut(q && (q.title || q.question), 200) })).filter(q => q.title); return o; }
    if (t === 'related_searches') { o.items = (x.items || []).slice(0, 12).map(q => cut(typeof q === 'string' ? q : (q && (q.title || q.keyword)), 120)).filter(Boolean); return o; }
    if (t === 'discussions_and_forums') { o.items = (x.items || []).slice(0, 6).map(q => ({ title: cut(q && q.title, CFG.title_len), domain: cut(q && (q.domain || q.source), 80), url: cut(q && q.url, 240) })); return o; }
    if (t === 'featured_snippet') { o.domain = cut(x.domain, 100); o.url = cut(x.url, 300); o.title = cut(x.title, CFG.title_len); o.description = cut(x.description || x.text, 400); return su(o, x); }
    if (t === 'ai_overview') {
      o.asynchronous_ai_overview = x.asynchronous_ai_overview === true;
      o.references = (x.references || []).slice(0, 12).map(ref);
      let left = CFG.aio_text_len;
      o.items = (x.items || []).slice(0, 8).map(y => { const tx = cut(y && (y.text || y.markdown), Math.max(0, left)); left -= tx.length;
        return { title: cut(y && y.title, CFG.title_len), text: tx, references: ((y && y.references) || []).slice(0, 6).map(ref) }; });
      return o;
    }
    if (t === 'local_pack' || t === 'map') { o.domain = cut(x.domain, 100); o.url = cut(x.url, 300); o.title = cut(x.title, CFG.title_len); return su(o, x); }
    return o;
  };
  // a fresh answer -> the reading to store (null when it is not a reading: a failed read is never stored)
  const reading = (res, body, opts) => {
    const st = status(res); if (st === 'failed') return null;
    const o = opts || {}; const t = task0(res); const r0 = ((t.result || [])[0]) || {};
    const b = body || (t.data || {}); const id = ident({ ...(t.data || {}), ...b }); const nd = need(b);
    const at = isoOf(r0.datetime) || isoOf(o.now) || new Date().toISOString();
    const items = Array.isArray(r0.items) ? SU.fixItems(r0.items) : [];   // SERP-GOTO: the real host behind a Google redirect, before anything is stored
    const out = { v: 1, ...id, day: dayOf(at), at, datetime: S(r0.datetime) || at, task_id: S(t.id), cost: Number(t.cost) || 0, depth: nd.depth, aio_loaded: nd.aio,
      empty: st === 'empty', se_results_count: r0.se_results_count ?? null, item_types: Array.isArray(r0.item_types) ? r0.item_types.map(S) : [...new Set(items.map(x => S(x && x.type)))].filter(Boolean),
      ai_overview_seen: items.some(x => x && x.type === 'ai_overview'), path: S(o.path),
      items: items.filter(Boolean).map(x => compactItem(x)) };
    // keep the stored value compact: drop the descriptions, then the titles below the top 10, then the tail, until it fits
    let s = JSON.stringify(out);
    const below10 = (x) => x.type === 'organic' && Number(x.rank_group) > 10;
    if (s.length > CFG.max_chars) { out.items.forEach(x => { if (below10(x)) delete x.description; }); s = JSON.stringify(out); }
    if (s.length > CFG.max_chars) { out.items.forEach(x => { if (below10(x)) delete x.title; }); s = JSON.stringify(out); }
    while (s.length > CFG.max_chars && out.items.length > 10) { out.items.pop(); out.depth = Math.min(out.depth, out.items.filter(x => x.type === 'organic').length); s = JSON.stringify(out); }
    return out;
  };
  // the descriptions, then the titles below the top 10 go first when the value is too long, then the tail (the depth then says so)
  // a stored reading -> an answer in DataForSEO's own shape, so every existing reader works unchanged; it cost nothing
  const response = (r) => ({ status_code: 20000, status_message: 'Ok.', cost: 0, tasks_count: 1, tasks_error: 0,
    serp_cache: { hit: true, key: key(r), read_at: r.at, day: r.day, task_id: r.task_id, depth: r.depth, aio_loaded: !!r.aio_loaded, text: timing(r) },
    tasks: [{ id: 'cache:' + S(r.task_id), status_code: r.empty ? 40102 : 20000, status_message: r.empty ? 'No Search Results.' : 'Ok.', cost: 0,
      data: { keyword: r.keyword, location_code: r.location_code, language_code: r.language_code, device: r.device, depth: r.depth, load_async_ai_overview: !!r.aio_loaded },
      result: r.empty ? null : [{ keyword: r.keyword, location_code: r.location_code, language_code: r.language_code, datetime: r.datetime || r.at,
        se_results_count: r.se_results_count, item_types: r.item_types || [], items_count: (r.items || []).length, items: (r.items || []).map(x => ({ ...x })) }] }] });
  const parse = (row) => { if (!row || typeof row !== 'object') return null; let v = row.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return null; } } return v && typeof v === 'object' ? v : null; };
  // the stored reading this request may use, or why not. `rows` are seo_cache rows (any keys; the right one is found by its key)
  const lookup = (rows, body, opts) => {
    const o = opts || {}; const k = key(body); const nd = need(body); const today = dayOf(o.now);
    const row = (Array.isArray(rows) ? rows : []).find(x => x && x.key === k);
    if (!row) return { hit: false, key: k, why: 'not read yet today' };
    const r = parse(row);
    if (!r) return { hit: false, key: k, why: 'stored reading unreadable' };
    if (r.day !== today) return { hit: false, key: k, why: 'last read on ' + (r.day || 'an unknown day') };
    if (SU.poisoned(r)) return { hit: false, key: k, why: 'stored reading holds Google redirect links with no site behind them (read before the 2026-11-08 fix)' };
    if (key(r) !== k) return { hit: false, key: k, why: 'stored reading is for another search' };
    if (!r.empty && Number(r.depth) < nd.depth) return { hit: false, key: k, why: 'read today only ' + r.depth + ' results deep, this needs ' + nd.depth };
    if (nd.aio && !r.aio_loaded) return { hit: false, key: k, why: 'read today without the AI Overview content, which this needs' };
    return { hit: true, key: k, reading: r, response: response(r), text: timing(r) };
  };
  // the seo_cache row (exact columns of CACHE_COLS) for a reading, or null
  const row = (r, siteId) => (r ? { key: key(r), kind: CFG.kind, site_id: S(siteId), value: JSON.stringify(r), updated_at: new Date().toISOString() } : null);
  // a fresh answer straight to its row (null when it was a cache hit or a failed read)
  const rowFor = (res, body, siteId, opts) => { if (res && res.serp_cache && res.serp_cache.hit) return null; return row(reading(res, body, opts), siteId); };
  return { CFG, key, ident, need, status, reading, response, lookup, row, rowFor, timing, dayOf, normKw };
})();
// ---- link kit (v4.10, inlined by build_monitors.py): reads a fetched page the way a link checker does — the links to a site with their rel,
// anchor and placement, page facts (noindex, canonical, outbound links, language) and contact e-mails. Regex only: the n8n sandbox has no URL
// constructor and no DOM. Hosts are compared without "www." (crawls report www. URLs while canonicals often use the bare host).
const LK = (() => {
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'param']);
  const ent = (() => {
    const N = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·', laquo: '«', raquo: '»', euro: '€', pound: '£', deg: '°' };
    return (s) => String(s == null ? '' : s).replace(/&(?:#[xX]([0-9a-fA-F]+)|#(\d+)|([a-zA-Z][a-zA-Z0-9]*));/g, (m, h, d, n) => {
      if (h !== undefined || d !== undefined) { const cp = h !== undefined ? parseInt(h, 16) : Number(d); if (cp === 160) return ' '; try { return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m; } catch (e) { return m; } }
      const k = n.toLowerCase(); return Object.prototype.hasOwnProperty.call(N, k) ? N[k] : m;
    });
  })();   // R62: named + decimal + hex, one pass (the same body as v5/code/_entities.js)
  const text = (s) => ent(String(s || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const attr = (attrs, name) => { const m = String(attrs || '').match(new RegExp('\\b' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? ent(m[1] ?? m[2] ?? m[3] ?? '') : null; };
  const hostOf = (u) => { const m = String(u || '').trim().match(/^(?:[a-z][a-z0-9+.-]*:)?\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '').replace(/\.$/, '') : ''; };
  // RV-8 (2026-10-21): suffixes that are sold one level down like a TLD ("ggmap.us.com" is a site of its own; "us.com" is nobody). Without them
  // the disavow file held `domain:us.com`, which would disavow every *.us.com site. The country second levels (co.uk, com.au, co.ae ...)
  // are the rule below; these are the private ones a link profile meets.
  const MULTI = new Set(['us.com', 'uk.com', 'eu.com', 'de.com', 'br.com', 'cn.com', 'gb.com', 'gr.com', 'hu.com', 'jpn.com', 'kr.com', 'no.com', 'qc.com', 'ru.com', 'sa.com', 'se.com', 'uy.com', 'za.com', 'ae.org', 'us.org', 'gb.net', 'uk.net', 'se.net', 'jp.net', 'in.net', 'eu.org']);
  const regDomain = (h) => { const p = String(h || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean); if (p.length <= 2) return p.join('.');
    if (MULTI.has(p.slice(-2).join('.'))) return p.slice(-3).join('.');
    const sld = /^(co|com|net|org|gov|edu|ac|ltd|plc|sch|nic|or|ne|go|mil|biz|info)$/; return (sld.test(p[p.length - 2]) && p[p.length - 1].length === 2) ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
  // a public (or privately sold) suffix on its own: never a site, never a line in a disavow file
  const isSuffix = (d) => { const p = String(d || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean); if (p.length < 2) return true;
    return p.length === 2 && (MULTI.has(p.join('.')) || (/^(co|com|net|org|gov|edu|ac|ltd|plc|sch|nic|or|ne|go|mil|biz|info)$/.test(p[0]) && p[1].length === 2)); };
  // the ledger key of a linking host: its registrable domain, except on hosting platforms where every subdomain is a different site
  const PLATFORM = /\.(blogspot\.[a-z.]+|wordpress\.com|tumblr\.com|medium\.com|substack\.com|github\.io|gitlab\.io|wixsite\.com|weebly\.com|webflow\.io|squarespace\.com|netlify\.app|vercel\.app|pages\.dev|herokuapp\.com|web\.app|firebaseapp\.com|blogger\.com|livejournal\.com|over-blog\.com|jimdosite\.com|site123\.me|webnode\.[a-z]+|strikingly\.com|carrd\.co|notion\.site|super\.site|hashnode\.dev|dev\.to|translate\.goog)$/;
  const refKey = (h) => { const x = String(h || '').toLowerCase().replace(/^www\./, '').replace(/\.$/, ''); return PLATFORM.test(x) ? x : regDomain(x); };
  const sameSite = (host, domain) => { const h = String(host || '').toLowerCase().replace(/^www\./, ''), d = String(domain || '').toLowerCase().replace(/^www\./, ''); return !!h && !!d && (h === d || h.endsWith('.' + d)); };
  // D23 (2026-10-11 system review): one list of tracking parameters, for comparing URLs (normUrl) and for the URLs we store and show
  // (cleanUrl). `srsltid` (Google Shopping) and `utm_source=chatgpt.com` were kept in stored links before, so the same page counted
  // twice and outreach quoted a tagged URL.
  const TRACK = /^(utm_[a-z_]*|srsltid|gclid|gbraid|wbraid|dclid|fbclid|msclkid|yclid|twclid|igshid|mc_cid|mc_eid|ref|ref_src|referrer|_hsenc|_hsmi|hsa_[a-z]+|spm|at_[a-z_]+|mkt_tok)$/i;
  const dropTrack = (q) => String(q || '').replace(/^\?/, '').split('&').filter(kv => kv && !TRACK.test(kv.split('=')[0])).join('&');
  const normUrl = (u) => { const s = String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/#.*$/, '');
    const i = s.indexOf('?'); const q = i < 0 ? '' : dropTrack(s.slice(i)); const base = (i < 0 ? s : s.slice(0, i)).replace(/\/+$/, '');
    return base + (q ? '?' + q : ''); };
  // the URL as we keep it (scheme and host as they are, the real query kept): for from_url, source_url and anything a person opens
  const cleanUrl = (u) => { const s = String(u || '').trim().replace(/#.*$/, ''); const i = s.indexOf('?');
    if (i < 0) return s; const q = dropTrack(s.slice(i)); return s.slice(0, i) + (q ? '?' + q : ''); };
  const decodeAll = (s) => { let x = String(s || ''); for (let i = 0; i < 3; i++) { try { const y = decodeURIComponent(x); if (y === x) break; x = y; } catch (e) { break; } } return x; };
  // where on the page an index sits: the innermost structural element decides (an "aside" inside "main" is a sidebar, a "header" inside "article" is nav)
  // the innermost structural element decides: an "aside" inside "main" is a sidebar, a "header" inside "article" is nav
  // whole class / id / role tokens, not substrings: page builders put "widget" or "header" in every wrapper (Elementor's "elementor-widget-container")
  function placeOf(stack) {
    const is = (toks, re) => toks.some(t => re.test(t));
    for (let i = stack.length - 1; i >= 0; i--) {
      const { tag } = stack[i]; const toks = stack[i].cls.split(/[\s"'=]+/).filter(t => t && !/^(class|id|role|itemprop)$/.test(t));
      if (is(toks, /^(comments?|comment-[a-z-]+|[a-z-]+-comments?|commentlist|disqus[a-z_-]*|reply|respond)$/)) return 'comment';
      if (tag === 'footer' || is(toks, /^(footer|site-footer|[a-z]+-footer|footer-[a-z-]+|colophon|site-info|copyright|contentinfo)$/)) return 'footer';
      if (tag === 'aside' || is(toks, /sidebar|^(widget|widget-area|widget_[a-z_-]+|secondary|blogroll|related|related-posts|yarpp[a-z-]*|jp-relatedposts|partner-logos|sponsors?|complementary)$/)) return 'sidebar';
      if (tag === 'nav' || tag === 'header' || is(toks, /^(nav|navbar|navigation|menu|[a-z]+-menu|menu-[a-z-]+|[a-z]+-nav|nav-[a-z-]+|breadcrumbs?|masthead|topbar|banner|site-header|header|[a-z]+-header)$/)) return 'nav';
      if (tag === 'article' || tag === 'main' || is(toks, /^(article|entry|entry-content|post|post-content|[a-z]+-content|content|story|prose|main|articlebody|blog-post|single-post|hentry)$/)) return 'content';
    }
    return 'body';
  }
  // one walk over the tags up to `upto` (or the whole page): calls onA(index, stack) at every <a>; scripts / styles skipped
  function walkTags(html, upto, onA) {
    const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g; const stack = []; let m; let low = null;
    while ((m = re.exec(html)) && m.index < upto) {
      const close = m[1] === '/', tag = m[2].toLowerCase(), attrs = m[3] || '';
      if (!close && (tag === 'script' || tag === 'style' || tag === 'template')) { if (low === null) low = html.toLowerCase(); const end = low.indexOf('</' + tag, re.lastIndex); if (end < 0 || end > upto) break; re.lastIndex = end; continue; }
      if (!close && tag === 'a' && onA) onA(m.index, stack);
      if (VOID.has(tag) || /\/\s*$/.test(attrs)) continue;
      if (close) { let at = -1; for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === tag) { at = i; break; } if (at >= 0) stack.length = at; }
      else stack.push({ tag, cls: ((attrs.match(/\b(?:class|id|role|itemprop)\s*=\s*["'][^"']*["']/gi) || []).join(' ')).toLowerCase() });
    }
    return stack;
  }
  // where on the page an index sits (one link: verify)
  function placementAt(html, idx) { return placeOf(walkTags(html, idx, null)); }
  // where every link of a page sits, in one walk (many links: the Link Builder's dead-link check; v4.13 — placementAt per link re-walked the
  // page each time: 11 minutes on real list pages, live 2026-10-11)
  function anchorPlacements(html) { const out = new Map(); walkTags(String(html || ''), Infinity, (i, stack) => out.set(i, placeOf(stack))); return out; }
  // every <a> on the page that points to the site (directly, or through a redirect / tracking URL that carries it)
  function linksTo(html, domain) {
    const out = []; const re = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi; let m;
    while ((m = re.exec(html))) {
      const href = attr(m[1], 'href'); if (!href) continue;
      const h = hostOf(href); let indirect = false; let to = href;
      if (!sameSite(h, domain)) { const dec = decodeAll(href); const i = dec.toLowerCase().search(new RegExp('https?:\\/\\/(?:[a-z0-9-]+\\.)*' + String(domain).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[\\/?#:&]|$)', 'i'));
        if (i < 0 || h === '') continue; indirect = true; to = dec.slice(i).split(/[&\s"'<>]/)[0]; }
      const rel = String(attr(m[1], 'rel') || '').toLowerCase().split(/\s+/).filter(Boolean);
      const img = (m[2].match(/<img\b[^>]*>/i) || [])[0]; const anchor = text(m[2]).slice(0, 160) || (img ? '[image] ' + String(attr(img, 'alt') || '').slice(0, 120) : '');
      out.push({ href: to, rel, anchor, image: !!img && !text(m[2]), indirect, index: m.index });
    }
    return out;
  }
  function pageFacts(html, headers, url) {
    const H = {}; for (const [k, v] of Object.entries(headers || {})) H[String(k).toLowerCase()] = String(v);
    const robots = [...String(html).matchAll(/<meta\b[^>]*>/gi)].map(x => x[0]).filter(t => /name\s*=\s*["']?(robots|googlebot)\b/i.test(t)).map(t => String(attr(t, 'content') || '').toLowerCase()).join(',') + ',' + String(H['x-robots-tag'] || '').toLowerCase();
    const canonTag = [...String(html).matchAll(/<link\b[^>]*>/gi)].map(x => x[0]).find(t => /rel\s*=\s*["']?canonical\b/i.test(t)); const canonical = canonTag ? attr(canonTag, 'href') || '' : '';
    const own = hostOf(url); const hosts = new Set(); let anchors = 0;
    for (const a of String(html).matchAll(/<a\b([^>]*)>/gi)) { anchors++; const h = hostOf(attr(a[1], 'href')); if (h && !sameSite(h, regDomain(own))) hosts.add(regDomain(h)); }
    const body = text((String(html).match(/<body\b[\s\S]*$/i) || [html])[0]);
    return { title: text((String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1]).slice(0, 160), lang: String(attr((String(html).match(/<html\b[^>]*>/i) || [''])[0], 'lang') || '').slice(0, 10),
      noindex: /noindex|\bnone\b/.test(robots), nofollow_page: /nofollow|\bnone\b/.test(robots), canonical, canonical_elsewhere: !!canonical && /^(https?:)?\/\//i.test(canonical) && normUrl(canonical) !== normUrl(url),
      outbound_domains: hosts.size, anchors, words: body ? body.split(' ').length : 0,
      js_shell: anchors < 3 && body.split(' ').length < 80 && /<script\b/i.test(html) && (/<(div|main|body)\b[^>]*\bid\s*=\s*["']?(root|app|__next|__nuxt|svelte|main-app)\b/i.test(html) || /enable javascript|requires javascript|javascript is (disabled|required)/i.test(body)) };   // a client-rendered app, not just a short page
  }
  const contextAt = (html, idx, len = 170) => text(String(html).slice(Math.max(0, idx - 1500), idx + 1500).replace(/^[^<]*>/, '')).slice(0, 2 * len + 40);
  const challenge = (status, html) => { const s = Number(status) || 0; const h = String(html || '').slice(0, 60000);
    return /cf-browser-verification|challenge-platform|cf_chl_|Just a moment\.\.\.|Attention Required! \| Cloudflare|Enable JavaScript and cookies to continue|_Incapsula_Resource|Request unsuccessful\. Incapsula|px-captcha|perimeterx|datadome|captcha-delivery|Access Denied<\/title>|Pardon Our Interruption/i.test(h) || ((s === 403 || s === 429 || s === 503) && h.length < 30000); };
  // e-mail addresses an outreach could go to (mailto first, then text), without image names, tracking and platform addresses
  function emailsIn(html, domain) {
    const BAD = /\.(png|jpe?g|gif|webp|svg|css|js)$|@(sentry|wixpress|example|domain|email|yoursite|sentry-next)\.|^(no-?reply|donotreply|privacy|abuse|postmaster|webmaster|dpo|legal|gdpr|unsubscribe)@|@2x|u00/i;
    const found = new Map(); const add = (e, w) => { const x = ent(String(e || '')).toLowerCase().replace(/^mailto:/, '').split('?')[0].trim(); if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(x) || BAD.test(x)) return; found.set(x, Math.max(found.get(x) || 0, w + (sameSite(x.split('@')[1], domain) ? 2 : 0) + (/^(editor|editorial|news|press|media|pr|content|hello|info|contact|partnerships?|marketing)@/.test(x) ? 1 : 0))); };
    for (const m of String(html).matchAll(/href\s*=\s*["']mailto:([^"'>\s]+)/gi)) add(m[1], 3);
    for (const m of text(html).matchAll(/[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi)) add(m[0], 1);
    for (const m of String(html).matchAll(/"email"\s*:\s*"([^"]+)"/gi)) add(m[1], 2);
    return [...found.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e).slice(0, 3);
  }
  // one fetched page against the site: was the link found, how, and where
  function verify(page, domain, opts = {}) {
    const status = Number(page.statusCode || page.status || 0); const html = String(page.body ?? page.data ?? '');
    const err = page.error ? String(page.error.message || page.error.description || page.error).slice(0, 160) : '';
    if (err && !html) { const gone = /ENOTFOUND|getaddrinfo ENOTFOUND|NXDOMAIN|certificate has expired|ERR_TLS_CERT_ALTNAME|ECONNREFUSED/i.test(err); return { verify: gone ? 'gone' : 'error', status, error: err }; }
    if (status === 404 || status === 410) return { verify: 'gone', status };
    if (challenge(status, html)) return { verify: 'blocked', status };
    if (status >= 500 || (status && status >= 400)) return { verify: 'error', status };
    const facts = pageFacts(html, page.headers, opts.url || '');
    const links = linksTo(html, domain);
    if (!links.length) return { verify: facts.js_shell ? 'js' : 'missing', status, ...facts };
    const best = links.map(l => ({ ...l, placement: placementAt(html, l.index), follow: !l.rel.some(r => r === 'nofollow' || r === 'sponsored' || r === 'ugc') && !l.indirect && !facts.nofollow_page }))
      .sort((a, b) => (b.follow - a.follow) || ((b.placement === 'content') - (a.placement === 'content')))[0];
    const relKind = best.rel.includes('sponsored') ? 'sponsored' : best.rel.includes('ugc') ? 'ugc' : (best.rel.includes('nofollow') || facts.nofollow_page) ? 'nofollow' : best.indirect ? 'redirect' : 'follow';
    return { verify: 'found', status, ...facts, to_url: best.href, anchor: best.anchor, rel: relKind, placement: best.placement, image: best.image, links_on_page: links.length, context: contextAt(html, best.index) };
  }
  // a page that names the brand: with or without a link to the site (unlinked mentions are the warmest outreach)
  function mention(page, domain, brandRes) {
    const v = verify(page, domain); const html = String(page.body ?? page.data ?? '');
    if (v.verify === 'found') return { ...v, named: true };
    if (v.verify !== 'missing') return { ...v, named: false };
    const t = text(html); let at = -1; for (const re of brandRes) { const i = t.search(re); if (i >= 0 && (at < 0 || i < at)) at = i; }
    return { ...v, named: at >= 0, context: at >= 0 ? t.slice(Math.max(0, at - 160), at + 200) : '' };
  }
  // what kind of site a referrer is: GA4 referrals include e-mail, chat, search and payment hosts that are not links on the web
  const KIND = [
    ['search', /(^|\.)(google|bing|yahoo|duckduckgo|baidu|yandex|ecosia|qwant|brave|startpage|naver|seznam|search\.yahoo|aol|ask)\.[a-z.]+$/],
    ['ai', /(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|gemini\.google\.com|bard\.google\.com|copilot\.microsoft\.com|claude\.ai|deepseek\.com|grok\.com|meta\.ai|you\.com|poe\.com|phind\.com|mistral\.ai|kagi\.com)$/],
    ['mail', /(^|\.)(mail\.google|outlook\.(live|office|office365)|mail\.yahoo|webmail|zimbra|roundcube|teams\.(microsoft|live)|teams\.public\.onecdn\.static\.microsoft|statics\.teams\.cdn\.office\.net|slack|discord|web\.whatsapp|web\.telegram|zoom\.us|mail\.)/],
    ['tool', /(^|\.)(stripe|paypal|checkout|accounts\.google|login\.microsoftonline|okta|auth0|hubspot|salesforce|zendesk|intercom|calendly|docs\.google|drive\.google|sharepoint|notion\.so|trello|asana|atlassian|github\.dev|localhost|127\.0\.0\.1|translate\.goog|googleusercontent|ampproject|webcache)\b/],
    ['social', /(^|\.)(linkedin|lnkd|facebook|fb|instagram|twitter|x|t|tiktok|youtube|youtu|pinterest|reddit|quora|threads|snapchat|tumblr|medium|vk|weibo|wechat|telegram|t\.co)\.[a-z.]+$|^(t\.co|lnkd\.in|youtu\.be|fb\.me)$/],
  ];
  // infrastructure: CDNs, storage, link shorteners and whole hosting platforms (the Common Crawl graph reports "blogspot.com" or
  // "amazonaws.com" as one domain) — they appear in link graphs but nobody there can be asked for a link (live finding 2026-10-08)
  const INFRA = /(^|\.)(amazonaws\.com|cloudfront\.net|akamai(hd|edge|ized)?\.net|edgesuite\.net|azureedge\.net|azurewebsites\.net|windows\.net|googleusercontent\.com|googleapis\.com|gstatic\.com|ggpht\.com|appspot\.com|app\.link|bit\.ly|t\.co|goo\.gl|ow\.ly|lnkd\.in|tinyurl\.com|rebrand\.ly|blogspot\.com|wordpress\.com|wixsite\.com|weebly\.com|squarespace\.com|github\.io|gitlab\.io|herokuapp\.com|netlify\.app|vercel\.app|pages\.dev|web\.app|firebaseapp\.com|doubleclick\.net|addthis\.com|sharethis\.com|cdninstagram\.com|fbcdn\.net|jsdelivr\.net|cloudflare\.com|wp\.com|gravatar\.com|archive\.org|translate\.goog)$/i;
  const isInfra = (d) => INFRA.test(String(d || '').toLowerCase().replace(/^www\./, ''));
  // auto-generated pages that name every domain (WHOIS, "site worth", site statistics, similar-site lists): not mentions, not prospects
  // (live finding 2026-10-08: whois.com came back as an "unlinked mention" of techand.ai)
  const SCRAPER = /(^|[.-])(whois|who\.is|worth|siteprice|sitestats?|site-?info|hypestat|similarsites?|sitelike|sitesimilar|websiteoutlook|statshow|domaintools|robtex|builtwith|urlscan|siteindices|dnslytics|ipaddress|host\.io|domainbigdata|webstatsdomain|siteliner|rank2traffic|websiteinformer|informer|valuation|traffic-?estimate|seo-?analy[sz]er|seositecheckup|sitechecker|webrank|domainstats)/i;
  const isScraper = (d) => SCRAPER.test(String(d || '').toLowerCase().replace(/^www\./, ''));
  // G18-1 (2026-10-12, the accuracy set): a SEARCH-RESULTS page of someone else's site. Its content is whatever was typed into a search box,
  // it is noindex or canonicalised away on most sites, and Google passes nothing from it — yet robuta.com/?q=business+impact came back as
  // techand.ai's best link (SEO value 57, above OpenPeppol's members list at 35) because only whois / stats / valuation hosts counted as
  // scrapers. The shapes: a path segment "search" / "suche" / "recherche" / "busca" (/search, /en/search/), a search script
  // (/search.php, /results.aspx), or a query that carries the search term (?q= / ?s= / ?query= / ?search= / ?keyword= / ?term= / ?k=).
  // Query keys only, never a value, and only on a whole key, so ?qid=, ?src= and ?ref= are not searches. The caller decides what to do with
  // it (Parse Backlinks labels such a page "scraper" when nothing ties the host to our topics, so LK.values' cap of 5 applies).
  const SEARCH_PATH = /(^|\/)(search|searchresults|suche|recherche|busca|buscar|zoeken)(\/|\.(php|html?|aspx?|jsp)$|$)/i;   // "results" alone is left out on purpose: /results/ is a real page on plenty of sites
  const SEARCH_Q = /^(q|s|k|kw|query|search|searchterm|search_term|searchword|keyword|keywords|term|suche|wd)$/i;
  const isSearchPage = (u) => { const s = String(u || '').trim(); if (!s) return false;
    const noHost = s.replace(/^[a-z][a-z0-9+.-]*:\/\/[^\/?#]*/i, ''); const i = noHost.indexOf('?');
    const path = (i < 0 ? noHost : noHost.slice(0, i)).replace(/#.*$/, '');
    if (SEARCH_PATH.test(path)) return true;
    if (i < 0) return false;
    return noHost.slice(i + 1).replace(/#.*$/, '').split('&').some(kv => kv.includes('=') && SEARCH_Q.test(kv.split('=')[0]) && kv.split('=').slice(1).join('=').length > 0); };
  // press-release wires: a competitor's link there is a paid release (usually nofollow), not a site to pitch (live finding 2026-10-08:
  // prnewswire.co.uk and kyodonewsprwire.jp ranked among techand.ai's top gap prospects once Ahrefs DR was on)
  const WIRE = /(^|\.)(prnewswire|businesswire|globenewswire|einpresswire|einnews|accesswire|newswire|prweb|prlog|openpr|newsfilecorp|issuewire|presswire|kyodonewsprwire|marketwired|newsdirect|pressat|24-7pressrelease|prunderground|send2press|realwire|pressebox|presseportal|newsvoir|prfire|cision)\.[a-z.]+$/i;
  const isWire = (d) => WIRE.test(String(d || '').toLowerCase().replace(/^www\./, ''));
  const domainKind = (d, site) => { const x = String(d || '').toLowerCase().replace(/^www\./, ''); if (!x) return 'unknown'; if (site && sameSite(x, site)) return 'self'; for (const [k, re] of KIND) if (re.test(x)) return k; return 'web'; };
  // A link's value on three scales, 0-100 each (a link can matter for one and not the others):
  // - seo: what it passes in search. Weighted signals (authority 30, relevance 20, traffic of the linking page 15, placement 10, editorial
  //   integrity 10, cleanliness 10, anchor 5) times hard gates — a lost link, a noindex page or a canonical pointing elsewhere passes (almost)
  //   nothing; rel nofollow / ugc / sponsored are hints (partial weight). Missing inputs count as average.
  // - referral: the visits it sends (GA4 referral sessions a year; key events add).
  // - brand: earned media and sources AI assistants cite (editorial / press / resource / listing, AI-cited domains, authority).
  // authority: DataForSEO rank 0-1000 (or a Tranco position); relevance 0-1 (Link Analyst 0-3 / 3, else topic words); link_type from the analyst.
  function values(l) {
    const clamp = (x) => Math.max(0, Math.min(1, x));
    const auth = Math.max(l.authority > 0 ? clamp((Number(l.authority) - 40) / 520) : 0, l.tranco > 0 ? clamp(1 - Math.log10(Number(l.tranco)) / 6.2) * 0.9 : 0);
    const authKnown = l.authority > 0 || l.tranco > 0;
    const rel = l.relevance == null || l.relevance === '' ? 0.5 : clamp(Number(l.relevance));
    const visits = Number(l.visits) || 0, kw = Number(l.page_keywords) || 0;
    const traffic = kw > 0 ? clamp(Math.log10(1 + kw) / 2.5) : visits > 0 ? 0.5 : 0.2;
    // client reports 2026-11-11 (188): a row an index named with no page we ever read (no address, no visits, never found) is not an average
    // link: its placement and editorial weight are unknown, so they count below average (devaicon: 775 such rows reached 50 and filled "Best")
    const unseen = !l.from_url && !(Number(l.visits) > 0) && l.verify !== 'found';
    const place = unseen ? 0.4 : ({ content: 1, body: 0.65, sidebar: 0.4, nav: 0.3, footer: 0.2, comment: 0.1 }[l.placement || 'body'] ?? 0.6);
    const editorial = (unseen ? 0.6 : 1) * (l.original === false ? 0.4 : 1) * (Number(l.sitewide) >= 20 ? 0.5 : 1) * (['guest_post', 'sponsored'].includes(l.link_type) ? 0.4 : 1);
    const clean = clamp(1 - (Number(l.spam) || 0) / 100) * (Number(l.outbound) > 150 ? 0.5 : Number(l.outbound) > 60 ? 0.8 : 1);
    const anchor = l.anchor_kind === 'money' && rel < 0.5 ? 0.2 : 1;
    let seo = 100 * (0.3 * (authKnown ? auth : 0.15) + 0.2 * rel + 0.15 * traffic + 0.1 * place + 0.1 * editorial + 0.1 * clean + 0.05 * anchor);
    const gate = (l.status === 'lost' ? 0 : 1)   // a link missed once (at risk) keeps its value until a second miss confirms the loss
      * (l.noindex ? 0.1 : 1) * (l.canonical_elsewhere ? 0.3 : 1)
      * (l.kind === 'social' ? 0.3 : ({ follow: 1, redirect: 0.8, ugc: 0.3, nofollow: 0.3, sponsored: 0.15 }[l.rel] ?? 0.8));   // social profile links are nofollow; a rel nobody checked yet counts 0.8
    seo *= gate;
    const cap = { scraper: 5, spam: 0, directory: 40, profile: 35, comment: 15, forum: 50 }[l.link_type || ''];
    if (cap != null) seo = Math.min(seo, cap);
    const keyEvents = Number(l.key_events) || 0;
    const referral = visits > 0 ? Math.min(100, 22 * Math.log10(1 + visits) + (keyEvents > 0 ? 15 + 10 * Math.log10(1 + keyEvents) : 0)) : 0;
    const earned = { editorial: 1, press: 1, resource: 0.8, listing: 0.85, partner: 0.6, forum: 0.45, profile: 0.35, directory: 0.3 }[l.link_type || ''] ?? (l.kind === 'social' ? 0.3 : l.placement === 'content' ? 0.5 : 0.25);
    const brand = l.link_type === 'spam' || l.link_type === 'scraper' ? 0 : Math.min(100, 100 * (0.55 * earned + 0.25 * (authKnown ? auth : 0.15) + (l.ai_cited ? 0.25 : 0)));
    return { seo: Math.round(seo), referral: Math.round(referral), brand: Math.round(brand) };
  }
  const quality = (l) => values(l).seo;
  // anchor kinds (a money-keyword anchor from an off-topic page is a flag; branded / URL / generic anchors are natural)
  const anchorKind = (anchor, domain, brands = []) => { const a = String(anchor || '').toLowerCase().trim(); if (!a || /^\[image\]/.test(a)) return 'image_or_empty';
    const label = String(domain || '').toLowerCase().replace(/^www\./, '').split('.')[0];
    if (a.includes(String(domain).toLowerCase()) || /^(https?:\/\/|www\.)/.test(a)) return 'url';
    if ((label.length >= 4 && a.replace(/[^a-z0-9]/g, '').includes(label)) || brands.some(b => b && a.includes(String(b).toLowerCase()))) return 'brand';
    if (/^(click here|here|this|read more|more|website|link|source|visit( site| website)?|learn more|this article|this post|view|official site|homepage)$/.test(a)) return 'generic';
    return 'money'; };
  // ---- footprint gate (D3, 2026-10-11) ----
  // Link farms sell the same page on many domains: one PBN network linked techand.ai from 16 domains with one path (/all/2835/13.html) and
  // one anchor ("High Quality Dofollow Backlinks DA 50 PA 40 Premium PBN Network Service …"), some on casino hosts; the index flagged 4 and
  // the other 12 ranked above peppol.org as "best links" (live 2026-10-11). A cluster is: the same page path or the same keyword anchor on 3+
  // referring sites, an anchor or page title that advertises link selling or gambling, a gambling host, or a page path shared with such a
  // page. Members get link_type "spam" (SEO and brand value 0), stay out of best links, alerts and impact tracking and go on the disavow
  // candidates (review-only). Bounds: a path with one plain segment (/partners, /links) or made of generic words (/en/partners) never
  // clusters, nor do brand / URL / generic anchors or anchors under 4 words (every partner page and every brand mention would); an anchor
  // that is one of the site's own page titles is a citation, not a footprint. One list of link-selling words for every consumer (SPAM_RE).
  const SPAM_RE = /\b(?:pbn|private blog network|buy (?:cheap |quality |high[- ]quality )?(?:backlinks?|links?)|backlinks? (?:service|package|for sale|provider)|dofollow (?:backlinks?|links?)|high[- ]quality (?:backlinks?|links?)|link ?farms?|guest post services?|link building services?|da ?\d{1,2}\W{0,3}pa ?\d{1,2}|casinos?|betting|slots?|gambling|poker|jackpot|sportsbook|bookmakers?|porn|xxx|viagra|cialis|payday loans?|escorts?|essay writing)\b/i;
  const GAMBLING = /casino|poker|gambl|jackpot|sportsbook|bookmaker|roulette|blackjack|baccarat|betwinner|1xbet|mostbet|melbet|parimatch|bet365|betway|unibet|bwin|slotgacor/i;   // unambiguous substrings only ("alphabet" is not a bet)
  const isGambling = (d) => { const x = String(d || '').toLowerCase().replace(/^www\./, ''); return GAMBLING.test(x) || x.split(/[.-]/).some(t => /^(bets?|betting|slots?|lotto|lottery|toto|togel|judi|gacor)$/.test(t)); };
  const GENERIC = /^(en|de|fr|es|it|ar|nl|pt|ru|zh|ja|blog|news|partners?|links?|resources?|clients?|about|about-us|directory|members?|sponsors?|vendors?|tools?|category|tag|page|pages|home|contact|sitemap|index|posts?|articles?|press|media|portfolio|services?|products?|solutions?|team|company)$/;
  const footPath = (u) => { const p = String(u || '').replace(/^https?:\/\/[^\/?#]+/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase().replace(/\/index\.(html?|php)$/, ''); const seg = p.split('/').filter(Boolean);
    if (!seg.length || seg.every(x => GENERIC.test(x)) || (seg.length === 1 && !/\d/.test(p))) return ''; return p; };
  // rows: anything with ref_domain (or from_url), from_url, anchor and page_title / title. Returns Map ref_domain → reason.
  function footprints(rows, opts = {}) {
    const out = new Map(); const set = (d, why) => { if (d && !out.has(d)) out.set(d, why); };
    const titles = (opts.titles || []).map(t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim()).filter(t => t.length >= 8);
    const items = []; const byPath = new Map(), byAnchor = new Map();
    for (const r of rows || []) { if (!r) continue; const d = String(r.ref_domain || refKey(hostOf(r.from_url)) || '').toLowerCase(); if (!d) continue;
      const path = footPath(r.from_url); const a = String(r.anchor || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const ak = a && a.split(' ').length >= 4 && anchorKind(a, opts.domain || '', opts.brands || []) === 'money' && !titles.some(t => t.includes(a) || a.includes(t)) ? a : '';
      items.push({ d, path, ak, r });
      if (path) { if (!byPath.has(path)) byPath.set(path, new Set()); byPath.get(path).add(d); }
      if (ak) { if (!byAnchor.has(ak)) byAnchor.set(ak, new Set()); byAnchor.get(ak).add(d); } }
    for (const [p, ds] of byPath) if (ds.size >= 3) for (const d of ds) set(d, 'the same page path on ' + ds.size + ' sites (' + p.slice(0, 60) + ')');
    for (const [a, ds] of byAnchor) if (ds.size >= 3) for (const d of ds) set(d, 'the same keyword anchor on ' + ds.size + ' sites ("' + a.slice(0, 60) + '")');
    for (const x of items) { const txt = String(x.r.anchor || '') + ' | ' + String(x.r.page_title || x.r.title || '');
      if (SPAM_RE.test(txt)) set(x.d, 'the anchor or page title sells links or gambling ("' + String(x.r.anchor || x.r.page_title || x.r.title || '').replace(/\s+/g, ' ').slice(0, 60) + '")');
      else if (isGambling(x.d)) set(x.d, 'a gambling site'); }
    for (const [p, ds] of byPath) if (ds.size >= 2 && [...ds].some(d => out.has(d))) for (const d of ds) set(d, 'shares its page path with a link-farm page (' + p.slice(0, 60) + ')');
    return out;
  }
  // client reports 2026-11-11 (section 188, devaicon.com: 774 of 1,289 rows): an AUTOMATIC REPORT PAGE (a site checker / WHOIS / "worth" /
  // trust checker on an established domain, or a name made of SEO-tool words on a new cheap ending that only a link index has named and our
  // own check never found a link on). Every site gets hundreds; Google ignores them. Same rule as the app (app/shared/src/backlinks.ts
  // isAutoReportSite); keep the two equal.
  const AR_CHEAP_TLD = new Set(['shop', 'store', 'site', 'online', 'website', 'space', 'xyz', 'top', 'icu', 'click', 'link', 'fun', 'buzz', 'monster', 'cfd', 'sbs', 'cyou', 'bond', 'quest', 'rest', 'lol', 'pw', 'cam', 'bar', 'mom', 'vip', 'win', 'bid', 'loan', 'work', 'party']);
  const AR_TOOL_WORD = /seo|traffic|backlink|rank|serp|visit|audit|analy[sz]|metric|stat|report|monitor|check|crawl|index|domain|url|page|site|web|link|organic|keyword|score|worth|value|bot|hits|click|track|insight|spy|lookup|search|position|authority|referr|views?|boost|signal|scan|tool|data|info|trend|rate|test|review|list|dir|catalog|submit/;
  // review D11: a token counts only as a whole part of the name (followed by a dot or a hyphen), so worthington.edu, informer.ae,
  // valuationexperts.com, webrankinfo.com or builtwithdesign.co are not report pages; the bare words worth / informer / valuation are gone
  const AR_REPORT_HOST = /(^|[.-])(whois|who\.is|siteprice|sitestats?|site-?info|hypestat|similarsites?|sitelike|sitesimilar|websiteoutlook|statshow|domaintools|robtex|builtwith|urlscan|siteindices|dnslytics|ipaddress|host\.io|domainbigdata|webstatsdomain|siteliner|rank2traffic|websiteinformer|traffic-?estimate|seo-?analy[sz]er|seositecheckup|sitechecker|domainstats|scamadviser|scam-?detector|trustscam|isitlegit|urlvoid|siteadvisor|scamdoc|gridinsoft)(?=[.-])/;
  const isAutoReport = (domain, row) => { const d = String(domain || '').toLowerCase().trim().replace(/^www\./, '').replace(/\.$/, ''); if (!d) return false; const r = row || {};
    if (Number(r.visits) > 0 || /\.(?:edu|gov|mil|ac\.[a-z]{2}|edu\.[a-z]{2}|gov\.[a-z]{2})$/.test(d)) return false;   // review D11: real people came, or a public body
    if (AR_REPORT_HOST.test(d)) return true;
    const dot = d.lastIndexOf('.'); if (dot < 0) return false;
    let src = r.sources; if (typeof src === 'string') { try { src = JSON.parse(src); } catch (e) { src = src.split(/[,\s]+/); } }
    const onlyIndex = Array.isArray(src) && src.length > 0 && src.every(x => String(x) === 'dfs');
    return AR_CHEAP_TLD.has(d.slice(dot + 1)) && AR_TOOL_WORD.test(d.slice(0, dot)) && onlyIndex && r.verify !== 'found' && !(Number(r.visits) > 0); };
  return { text, attr, hostOf, regDomain, isSuffix, refKey, sameSite, isInfra, isScraper, isAutoReport, isSearchPage, isWire, normUrl, cleanUrl, placementAt, anchorPlacements, linksTo, pageFacts, contextAt, challenge, emailsIn, verify, mention, domainKind, quality, values, anchorKind, SPAM_RE, isGambling, footPath, footprints };
})();

// ---- outreach kit (v4.13 Link Builder, LINK_BUILDER_SPEC.md; inlined after the link kit): contacts, qualification, topic fit, our page and
// the link text to ask for. Regex only (the n8n sandbox has no URL / DOM).
// ---- C-2 / C-8 (re-rating 2026-10-17): one answer to "is this site a rival?", for every path that labels a site a PR target or a prospect ----
// The 2026-10-17 run told the customer to "ask the editor of flick.network to add Tech& to this list" (AI Growth) ten minutes after the AI
// visibility run listed flick.network among "businesses AI recommends instead of you", while the Link Builder refused the same site as a
// competitor; AI visibility labelled erp-dubai.ae ("ERPNext Implementation Partner in UAE & Dubai") and penieltech.com ("Odoo
// Implementation in Umm Al Quwain") "site (PR target)" and wrote them as prospects; the Link Builder qualified erp-dubai.ae, penieltech.com,
// halsimplify.com (HAL ERP) and pactsoft.ae (named by the AI answers as "PACT REVENU") as `needs_contact`. Four paths, four rival sets.
// This kit is the shared part, inlined by itself into AI Metrics and through the outreach kit (OK) everywhere else:
//  * RV.set(...)        - one rival set: the declared competitors, the businesses AI names (the Answer Analyst's `ai_brands:` aliases, the
//                         stored `rival_sources_json` / `competitors_json`), and the sites that outrank you (stored SERP competitors).
//                         `business` rivals (declared, named by AI, or selling what you sell) are never a pitch, not even their own
//                         "best X" list - a competitor ranks itself first and does not add you; a SERP-only rival (a publisher that
//                         outranks you) keeps the old rule: its list page is still fair to pitch.
//  * RV.providerOf(...) - a site that sells your CATEGORY whatever product names it uses: its page title, URL or its own about / contact
//                         text says "<category word> <provider word>" ("ERPNext Implementation Partner", "Odoo Implementation", "ERP
//                         Software", "IT Company"). The services list of a site names products (Azure, Dynamics 365 Finance …), which is
//                         why the service-overlap rule never matched an ERP or e-invoicing implementer that names other products.
//                         A roundup ("Top 10 …", "Best …") and a directory of providers (plural: "Service Providers", "Partners") is
//                         not a provider claim.
const RV = (() => {
  const S = (v) => String(v == null ? '' : v);
  const norm = (h) => S(h).toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#:].*$/, '').replace(/\.$/, '');
  const reg = (h) => { const x = norm(h); const p = x.split('.').filter(Boolean); if (p.length <= 2) return x;
    const sl = p.slice(-2).join('.'); return /^(co|com|org|net|gov|ac|edu|ltd|plc|sch|nic|mil)\.[a-z]{2}$/.test(sl) ? p.slice(-3).join('.') : sl; };
  // the categories a business can sell, each a family of words that name it (products of the category count: Odoo is an ERP)
  const FAMILIES = {
    erp: { label: 'ERP', words: ['erp', 'erpnext', 'odoo', 'netsuite', 'business central', 'dynamics 365', 'dynamics', 'sap business one', 'sap', 'acumatica', 'sage x3', 'tally', 'zoho books', 'oracle fusion', 'epicor', 'infor'] },
    einvoicing: { label: 'e-invoicing', words: ['e-invoicing', 'einvoicing', 'e invoicing', 'e-invoice', 'einvoice', 'peppol', 'asp'] },
    crm: { label: 'CRM', words: ['crm', 'salesforce', 'hubspot'] },
    it: { label: 'IT services', words: ['it'] },
    ai: { label: 'AI', words: ['ai', 'artificial intelligence', 'machine learning', 'copilot', 'generative ai'] },
    cloud: { label: 'cloud', words: ['azure', 'cloud', 'aws', 'cloud migration'] },
  };
  // singular provider words only: "Service Providers", "Partners", "Companies" are a directory OF providers, not a provider
  const PROV = '(software|system|systems|solution|solutions|platform|provider|partner|implementation|implementer|consulting|consultancy|consultant|services|service|reseller|integrator|company|agency|firm|expert)';
  // for the broad categories (AI, cloud, IT) only the words of a business that SELLS the work: "AI platform" or "cloud software" is too
  // often a news headline; "AI consulting", "Cloud Services", "IT Company" is a provider
  const PROV_SELL = '(consulting|consultancy|consultant|company|agency|partner|implementation|implementer|services|service|reseller|integrator|firm|expert)';
  const BROAD = new Set(['ai', 'cloud', 'it']);
  const NOT_AFTER = '(?![\\s-]+(?:providers|partners|companies|vendors|consultants|firms|agencies|experts|list|lists|directory|rules?|requirements?|deadlines?|guide))';
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]+');
  const ROUNDUP = /\b(best|top\s*\d+|top ten|alternatives?|round-?up|shortlist|directory|listing|list of|compar(?:e|ed|ison)|vs)\b/i;   // 'Top ERP System' is a vendor's SEO title, not a list (R89)
  const res = {};
  const reOf = (fam, w) => { const k = fam + ':' + w; if (res[k]) return res[k];
    // "IT" is only the category in capitals ("IT Company", "IT Services"), never the pronoun
    const P = BROAD.has(fam) ? PROV_SELL : PROV;
    return (res[k] = fam === 'it' ? new RegExp('\\bIT[\\s-]+' + P + '(?:[\\s-]+' + P + ')?\\b' + NOT_AFTER, 'gi')
      : new RegExp('\\b' + esc(w) + '\\b(?:[\\s-]+[A-Za-z0-9&.]+){0,' + (BROAD.has(fam) ? 0 : 1) + '}?[\\s-]+' + P + '(?:[\\s-]+' + P + ')?\\b' + NOT_AFTER, 'gi')); };
  // the categories THIS site sells: a family is active when one of its words is in the site's own topics or services
  const families = (o) => { const t = ' ' + [...(o.topics || []), ...(o.services || []), ...(o.terms || [])].map(S).join(' | ').toLowerCase() + ' ';
    return Object.keys(FAMILIES).filter(f => f === 'it' ? /\bit (consult|servic|solution|support|compan|managed)/.test(t) || /\bmanaged it\b/.test(t)
      : FAMILIES[f].words.some(w => new RegExp('(^|[^a-z0-9])' + esc(w) + '([^a-z0-9]|$)').test(t))); };
  // a CLAIM in a title is the category phrase standing for what the page sells: at the end, before a separator, a place or a year
  // ("ERPNext Implementation Partner in UAE", "Elate ERP | ERP Software in Dubai") - not a topic phrase inside a sentence ("ERP software for
  // distributors in the UAE: what to ask" is an article). The address and the site's own pages are read without that condition.
  const TAIL = /^\s*(?:$|[|\-\u2013\u2014:,(&]|(?:in|across|for (?:businesses|companies|smes|enterprises))\b|(?:uae|dubai|saudi|ksa|qatar|oman|bahrain|kuwait)\b|\d{4}\b)/i;
  const claims = (text, fams, strict) => { const out = []; const src = S(text);
    for (const f of fams) for (const w of FAMILIES[f].words) { const re = reOf(f, w); re.lastIndex = 0;
      const m = [...src.matchAll(re)].find(x => (f !== 'it' || src.slice(x.index, x.index + 2) === 'IT') && (!strict || TAIL.test(src.slice(x.index + x[0].length))));
      if (m) { out.push({ family: f, label: FAMILIES[f].label, phrase: m[0].replace(/\s+/g, ' ').trim().slice(0, 80) }); break; } }
    return out; };
  const slugWords = (u) => S(u).replace(/^https?:\/\/[^\/]+/i, '').replace(/[\/_?.&=#-]+/g, ' ').trim();
  const NOT_RIVAL_HOST = (d) => NOT_RIVAL.test(reg(d)) || NOT_RIVAL.test(norm(d));
  // ---- C-8 leftover (F-L, 2026-10-18): the STOREFRONT of the page itself. halsimplify.com (HAL ERP) and tradeshift.com (an e-invoicing
  // network) were qualified from an article and a buyer's guide whose titles and addresses claim nothing - but the same page's own menu sells
  // the category ("Conversational ERP", "E-invoicing (VAT CARE)", "HAL vs Odoo / SAP B1 / Microsoft Dynamics"; "Compliance for e-Invoicing
  // Software") and the page asks the reader to "Request a demo". Both halves are required: a menu that names the category (a provider phrase,
  // or two different words of a specific category: ERP / e-invoicing / CRM products - never the broad AI / cloud / IT words a news menu
  // carries) AND a sales call to action (demo, trial, pricing, quote, sales). A ministry, a publisher, a guide site or a directory has the
  // first at most; a roundup page is not judged here at all (the caller exempts lists, and a "Best …" title is skipped below).
  const STRONG_CTA = /\b(?:request|book|get|schedule)(?:\s+a|\s+your)?\s+demo\b|\bfree\s+trial\b|\bstart\s+(?:for\s+)?free\b|\bpricing\b|\bget\s+a\s+quote\b|\b(?:contact|talk\s+to)\s+sales\b/i;
  const ENT = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  const textOf = (h) => S(h).replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<svg\b[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, k) => k[0] === '#' ? ' ' : (ENT[k.toLowerCase()] || ' ')).replace(/\s+/g, ' ').trim();
  const menuOf = (html) => (S(html).match(/<(nav|header)\b[\s\S]*?<\/\1>/gi) || []).slice(0, 6).map(textOf).join(' | ').slice(0, 12000);
  const storefront = (c, fams) => {
    const html = S(c.page_html); if (html.length < 200) return '';
    const menu = menuOf(html); if (menu.length < 20) return '';
    // "pricing" counts only as a menu link: an article body says "pricing" whenever it discusses cost; a demo / trial / quote / sales button
    // counts anywhere on the page
    const cta = (menu.match(STRONG_CTA) || textOf(html).replace(/\bpricing\b/gi, ' ').match(STRONG_CTA) || [])[0]; if (!cta) return '';
    const said = claims(menu, fams, false);
    let what = said.length ? said[0].label + ' ("' + said[0].phrase + '")' : '';
    if (!what) {
      const hits = []; for (const f of fams.filter(x => !BROAD.has(x))) for (const w of FAMILIES[f].words) {
        const k = w.toLowerCase().replace(/[\s-]+/g, '');   // "e-invoicing", "e invoicing" and "einvoicing" are one word
        if (new RegExp('(^|[^a-z0-9])' + esc(w) + '([^a-z0-9]|$)', 'i').test(menu) && !hits.some(h => h.k === k)) hits.push({ f, w, k }); }
      if (hits.length >= 2) what = [...new Set(hits.map(h => FAMILIES[h.f].label))].join(' / ') + ' (its menu names ' + hits.slice(0, 4).map(h => '"' + h.w + '"').join(', ') + ')';
    }
    return what ? 'its own site menu sells ' + what + ' and the page asks visitors to "' + cta.replace(/\s+/g, ' ').trim() + '"' : '';
  };
  // o: { title, url, site_text, page_html, topics, services, domain } -> '' or the reason it is a competing provider of your category
  const providerOf = (o) => {
    const c = o || {}, fams = families(c); if (!fams.length) return '';
    if (c.domain && NOT_RIVAL_HOST(c.domain)) return '';   // a platform, an official body, a news site, a directory or a consultancy is never a provider of your category
    const title = S(c.title);
    // a question ("Which e-invoicing provider are you using?" on a forum) asks about providers; it does not claim to be one
    const question = /\?\s*$/.test(title) || /^(which|what|who|how|where|why|is|are|do|does|can|should|best)\b/i.test(title);
    if (title && !ROUNDUP.test(title) && !question) { const t = claims(title, fams, true); if (t.length) return 'its page title says it sells ' + t[0].label + ' ("' + title.slice(0, 90) + '")'; }
    if (!ROUNDUP.test(title) && !question) { const sf = storefront(c, fams); if (sf) return sf; }   // C-8 leftover: the page's own menu + a sales call to action
    const slug = slugWords(c.url); if (slug && !ROUNDUP.test(slug)) { const t = claims(slug, fams); if (t.length) return 'its page address says it sells ' + t[0].label + ' (' + S(c.url).replace(/^https?:\/\/(www\.)?/i, '').slice(0, 90) + ')'; }
    const site = S(c.site_text).slice(0, 60000); if (site.length < 200) return '';
    // its own about / contact pages: two different phrases presenting it as a provider of your category
    const seen = new Map();
    for (const f of fams) for (const w of FAMILIES[f].words) { const re = new RegExp(reOf(f, w).source, 'gi');
      for (const m of site.matchAll(re)) { if (f === 'it' && site.slice(m.index, m.index + 2) !== 'IT') continue; const ph = m[0].replace(/\s+/g, ' ').trim().toLowerCase(); if (!seen.has(ph)) seen.set(ph, FAMILIES[f].label); if (seen.size >= 6) break; } }
    if (seen.size < 2) return '';
    const ph = [...seen.keys()].slice(0, 2);
    return 'its own site presents it as a provider of ' + [...new Set(seen.values())].slice(0, 2).join(' / ') + ' ("' + ph.join('", "') + '")';
  };
  // the one rival set. Each input is a list of domains or {domain, why}; `kind` says whether it is a business rival or a SERP-only one.
  const set = (o) => {
    const c = o || {}, own = reg(c.own), m = new Map();
    const add = (d, kind, why) => { const x = reg(d && typeof d === 'object' ? (d.domain || d.host) : d); if (!x || !/\./.test(x) || x === own) return;
      const old = m.get(x); if (old && old.kind === 'business') return; m.set(x, { domain: x, kind, why: S(why || (d && d.why)) }); };
    for (const d of (c.declared || [])) add(d, 'business', 'a competitor you declared');
    for (const d of (c.ai || [])) add(d, 'business', 'a business AI recommends instead of you');
    for (const d of (c.serp || [])) add(d, 'serp', 'a site that outranks you for one of your own keywords');
    const of = (h) => m.get(reg(h)) || null;
    return { of, has: (h) => !!of(h), business: (h) => { const e = of(h); return !!e && e.kind === 'business'; }, size: m.size, entries: () => [...m.values()] };
  };
  // the businesses AI recommends instead of the site, as the AI Visibility Tracker last stored them: its latest seo_ai_visibility row
  // (rival_sources_json: the cited rivals, vendors and every named business; competitors_json: the share-of-voice rows) and the Answer
  // Analyst's learned names (seo_cache `ai_brands:<site>`). Official bodies, platforms, news sites, directories and consultancies are never
  // "rivals" (they keep their own kind); neither is the site itself.
  const NOT_RIVAL = /\.gov(\.[a-z]{2})?$|(^|\.)u\.ae$|\.int$|\.edu(\.[a-z]{2})?$|(^|\.)(youtube|linkedin|facebook|instagram|x|twitter|tiktok|reddit|quora|wikipedia|medium|github|google|bing|apple|amazon)\.[a-z.]+$|(^|\.)(gulfnews|khaleejtimes|thenationalnews|zawya|arabianbusiness|gulfbusiness|reuters|bloomberg|forbes|cnbc|bbc|ft|wsj|techcrunch|entrepreneur|economist|businessinsider|thenational|arabnews)\.[a-z.]+$|(^|\.)(g2|capterra|clutch|trustpilot|goodfirms|getapp|softwareadvice|crunchbase|yelp)\.[a-z.]+$|(^|\.)(deloitte|pwc|kpmg|ey|gartner|forrester|mckinsey|accenture|statista|bcg|bain|idc)\.[a-z.]+$/i;
  const parseJ = (v, d) => { if (v && typeof v === 'object') return v; try { return JSON.parse(S(v) || ''); } catch (e) { return d; } };
  const aiRivals = (o) => {
    const c = o || {}, sid = S(c.site_id), own = reg(c.own), out = new Map();
    const add = (d, why) => { const x = reg(d); if (!x || !/\./.test(x) || x === own || NOT_RIVAL.test(x) || out.has(x)) return; out.set(x, { domain: x, why }); };
    const rows = (c.vis_rows || []).filter(r => r && S(r.site_id) === sid && S(r.checked_at)).sort((a, b) => S(b.checked_at).localeCompare(S(a.checked_at)));
    const v = rows[0];
    if (v) {
      for (const r of (parseJ(v.rival_sources_json, []) || [])) add(r && (r.domain || r), r && r.kind === 'vendor' ? 'sells what you sell: ' + S(r.why) : 'a business AI recommends instead of you');
      for (const r of (parseJ(v.competitors_json, []) || [])) add(r && r.domain, 'a business AI recommends instead of you (' + (Number(r && r.mentions) || 0) + ' answers)');
    }
    const cache = (c.cache_rows || []).find(r => r && S(r.key) === 'ai_brands:' + sid);
    const names = cache ? parseJ(cache.value, {}) : {};
    for (const [nm, d] of Object.entries(names || {})) add(d, 'a business AI recommends instead of you (named "' + S(nm).slice(0, 40) + '")');
    return [...out.values()];
  };
  // C-10: a national news publisher of the market is in the market whatever its domain ending (gulfnews.com is a UAE paper; the link gap
  // refused it as "neither its name, its page nor its country ties it to dynamics 365 partner uae")
  const MARKET_MEDIA = { AE: /(^|\.)(gulfnews|khaleejtimes|thenationalnews|thenational|zawya|arabianbusiness|gulfbusiness|emirates247|wam|albayan|alkhaleej|emaratalyoum|timeoutdubai|whatson|constructionweekonline|itp|tahawultech|gulfmagazine|edgemiddleeast)\.[a-z.]+$/i,
    SA: /(^|\.)(arabnews|saudigazette|argaam|okaz|aleqt|spa)\.[a-z.]+$/i, QA: /(^|\.)(gulf-times|thepeninsulaqatar|qna|alraya)\.[a-z.]+$/i,
    GB: /(^|\.)(bbc|theguardian|telegraph|thetimes|ft|independent|cityam)\.[a-z.]+$/i, IN: /(^|\.)(timesofindia|economictimes|livemint|thehindu|business-standard|moneycontrol)\.[a-z.]+$/i };
  const marketMedia = (d, iso) => { const re = MARKET_MEDIA[S(iso).toUpperCase()]; return !!re && re.test(norm(d)); };
  return { set, providerOf, storefront, menuOf, families, reg, aiRivals, marketMedia, ROUNDUP, FAMILIES, NOT_RIVAL };
})();
const OK = (() => {
  const STOP = new Set('a an and are as at be but by for from has have how i in into is it its of on or our that the their this to was what when where which who why will with you your best top guide vs new more most about all can do does get here how'.split(' '));
  const words = (s) => String(s || '').toLowerCase().replace(/&[a-z]+;/g, ' ').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').split(' ').filter(w => w.length > 2 && !STOP.has(w));
  const stem = (w) => w.length > 5 ? w.replace(/(ingly|ings|ing|ments|ment|ations|ation|ions|ion|ies|ers|er|ed|es|s|e)$/, '') : w;   // invoice / invoices / invoicing → invoic (S30: a 5-letter prefix matched consultancy ~ consumer)
  // shared distinctive words, weighted by how rare each word is among the site's own pages (a site's topic words appear everywhere: IDF)
  function fit(a, b, df, nDocs) {
    const A = new Set(words(a).map(stem)), B = new Set(words(b).map(stem)); if (!A.size || !B.size) return 0;
    let num = 0, den = 0; const w = (t) => Math.log(1 + (nDocs || 1) / (1 + ((df && df.get(t)) || 0)));
    for (const t of B) { den += w(t); if (A.has(t)) num += w(t); }
    return den ? Math.round(100 * num / den) / 100 : 0;
  }
  // contacts on a page: who to write to, best first (a named person or the author on their own domain, then editorial, then general)
  const ROLE = { editorial: /^(editor|editors|editorial|news|newsroom|press|media|pr|content|stories|tips|submissions?|contribute|features)@/, general: /^(info|hello|hi|contact|team|office|enquir(y|ies)|inquir(y|ies)|admin|marketing|partnerships?|partner|sales|business|support|help)@/ };
  const BAD = /^(no-?reply|donotreply|privacy|abuse|postmaster|webmaster|dpo|legal|gdpr|unsubscribe|jobs|careers|hr|recruit(ing|ment)?|billing|invoices?|accounts?payable|security|noc)@/;
  const kindOf = (e) => ROLE.editorial.test(e) ? 'editorial' : ROLE.general.test(e) ? 'general' : /^[a-z]+([._-][a-z]+)?@/.test(e) ? 'person' : 'other';
  function contactsIn(html, domain, url) {
    const out = []; const seen = new Set(); const add = (e, w, src) => { const x = String(e || '').toLowerCase().trim(); if (seen.has(x) || BAD.test(x)) return; seen.add(x); out.push({ email: x, kind: kindOf(x), own: LK.sameSite(x.split('@')[1], domain), w, source_url: src }); };
    for (const e of LK.emailsIn(html, domain)) add(e, 1, url);
    return out; }
  // only addresses on the prospect's own domain: a page often lists other companies' addresses (live 2026-10-11: an address on a provider's
  // own site was stored as the Ministry of Finance's contact, because the Ministry's provider list names that provider)
  const rankContacts = (list) => [...list].filter(c => c.own).sort((a, b) => (b.own - a.own) || ({ person: 3, editorial: 2, general: 1, other: 0 }[b.kind] - { person: 3, editorial: 2, general: 1, other: 0 }[a.kind]) || (b.w - a.w)).slice(0, 3);
  // the author's page and the contact form of a prospect page
  function authorUrl(html, base) {
    const h = String(html || ''); let u = '';
    const rel = h.match(/<a\b[^>]*\brel\s*=\s*["'][^"']*\bauthor\b[^"']*["'][^>]*>/i); if (rel) u = LK.attr(rel[0], 'href') || '';
    if (!u) { const m = h.match(/"author"\s*:\s*(?:\[\s*)?\{[^{}]*?"url"\s*:\s*"([^"]+)"/i); if (m) u = m[1]; }
    if (!u) { const m = h.match(/<a\b[^>]*href\s*=\s*["']([^"']*\/(?:author|authors|writer|team|people|profile)\/[^"'#?]+)["']/i); if (m) u = m[1]; }
    if (!u) return ''; if (/^\/\//.test(u)) u = 'https:' + u; else if (/^\//.test(u)) u = String(base || '').replace(/^(https?:\/\/[^\/]+).*$/i, '$1') + u;
    return /^https?:\/\//i.test(u) ? u.slice(0, 300) : ''; }
  const OFF_TOPIC = 0.25;   // gap / competitor / resource / broken prospects below this topic match are not pitched (live 2026-10-11: Navan, Stripe, WEF from the Common Crawl gap)
  const contactForm = (html, url) => /<form\b[\s\S]{0,4000}?<textarea\b/i.test(String(html || '')) && /contact|enquir|inquir|get-in-touch|reach|write-for-us|contribute/i.test(String(url || '')) ? url : '';
  // signs a site sells links or is a link farm (Google: "sites used for the purpose of passing outgoing links"; research 2026-10-10)
  function sellSignals(html, facts) {
    const t = LK.text(html).toLowerCase().slice(0, 60000); const r = [];
    if (/(sponsored|guest) post[^.]{0,80}(\$|usd|eur|£|price|pricing|rate card|fee)|(\$|usd)\s?\d+[^.]{0,40}(per|a) (post|article|link)|dofollow (link|backlink)s? (guaranteed|included)|buy (a )?(guest post|backlink)|link insertion/.test(t)) r.push('sells posts or links');
    // LIVE1 (2026-11-07): read without the choices of a form's drop-down (<select>): code-brew.ae, a software firm, was refused as gambling
    // because its quote form's "Industry" list offers "Fantasy & Betting"; the options a form offers are not what the page is about
    const tg = /<select\b/i.test(String(html || '')) ? LK.text(String(html).replace(/<select\b[\s\S]*?<\/select>/gi, ' ')).toLowerCase().slice(0, 60000) : t;
    if (/\b(casino|betting|sportsbook|cbd oil|essay writing|payday loan|escort|replica watches)\b/.test(tg)) r.push('gambling / CBD / essay-mill topics');
    if (facts && facts.outbound_domains > 150) r.push(facts.outbound_domains + ' different sites linked from one page');
    if (/(write for us|guest post|sponsored post|contribute)[^.]{0,150}(\$\s?\d|usd\s?\d|€\s?\d|£\s?\d|\bfee\b|\bpaid\b|\bpricing\b)|(\$\s?\d+|\bfee\b)[^.]{0,80}(guest post|sponsored post|write for us)/.test(t)) r.push('paid guest posts');   // a price next to the offer (S30: "with prices and setup time" on an ordinary list page)
    return r; }
  // the recipient's country from the top-level domain (else the site's own market) — for the consent rules the app applies
  const CC = { de: 'DE', at: 'AT', ch: 'CH', fr: 'FR', uk: 'GB', ie: 'IE', es: 'ES', it: 'IT', nl: 'NL', be: 'BE', se: 'SE', no: 'NO', dk: 'DK', fi: 'FI', pl: 'PL', pt: 'PT', cz: 'CZ', gr: 'GR', ro: 'RO', hu: 'HU',
    ae: 'AE', sa: 'SA', qa: 'QA', kw: 'KW', bh: 'BH', om: 'OM', eg: 'EG', jo: 'JO', in: 'IN', pk: 'PK', sg: 'SG', my: 'MY', au: 'AU', nz: 'NZ', ca: 'CA', us: 'US', za: 'ZA', ng: 'NG', ke: 'KE', br: 'BR', mx: 'MX', jp: 'JP', cn: 'CN', tr: 'TR' };
  const countryOf = (domain) => { const d = String(domain || '').toLowerCase(); const m = d.match(/\.([a-z]{2})$/); return m && CC[m[1]] ? CC[m[1]] : ''; };
  // our page to point to and the link text to ask for (LINK_BUILDER_SPEC.md §5). pages: [{ url, title, keyword, kind, page_type, position,
  // rds, kw_share, pitched }] (kind: home | hub | guide | answer | article | case | money); p: the prospect { type, text, dead_text, to_url }
  const HOME_TYPES = new Set(['mention', 'list', 'listing', 'press', 'digest', 'podcast', 'ai_list']);   // L5: an answer in the press and a guest appearance name the business, so they point at the homepage
  function pickTarget(p, pages, df, nDocs, home) {
    if (p.type === 'lost' && p.to_url) return { url: p.to_url, reason: 'the page it used to link to', anchor: 'as before', fit: 1 };
    if (HOME_TYPES.has(p.type)) return { url: home, reason: p.type === 'list' || p.type === 'ai_list' ? 'lists link to the homepage' : 'a mention or a listing names the business: the homepage', anchor: 'brand', fit: 1 };
    const probe = p.type === 'broken' ? (p.dead_text || p.text) : ['gap', 'comp_new'].includes(p.type) ? p.text + ' ' + (p.topics || '') : p.text;   // they link to competitors for OUR topics: aim at our page on them
    const scored = pages.filter(x => x.url && x.kind !== 'home').map(x => {
      const f = fit(probe, [x.title, x.keyword, String(x.url || '').replace(/^https?:\/\/[^\/]+/, '').replace(/[\/_.-]+/g, ' ')].join(' '), df, nDocs);   // the URL's words too: titles come from Search Console queries (live 2026-10-11)
      const pos = Number(x.position) || 0; const band = pos >= 4 && pos <= 15 ? 1 : pos >= 16 && pos <= 30 ? 0.6 : pos >= 1 && pos <= 3 ? 0.3 : 0.4;
      const rds = Number(x.rds) || 0; const need = rds === 0 ? 1 : rds <= 5 ? 0.9 : rds <= 20 ? 0.7 : 0.5;
      const type = x.kind === 'money' ? 0.6 : 1;   // publishers link to guides; the guide links on to the service page
      const paced = (Number(x.pitched) || 0) >= (rds < 20 ? 4 : Math.max(4, Math.round(rds * 0.2)));
      return { x, f, score: paced ? 0 : f * band * need * type, band, pos, rds, paced };
    }).filter(s => s.f >= 0.2 && s.score > 0).sort((a, b) => b.score - a.score);
    if (!scored.length) return { url: home, reason: 'no page of ours matches their topic closely: the homepage', anchor: 'brand', fit: 0 };
    const s = scored[0]; const why = [s.pos >= 4 && s.pos <= 15 ? 'ranks #' + s.pos + ' (close to the top)' : s.pos ? 'ranks #' + s.pos : 'not ranking yet', s.rds ? s.rds + ' linking sites' : 'no links yet', 'topic match ' + Math.round(s.f * 100) + '%'];
    return { url: s.x.url, reason: why.join(' · '), anchor: (Number(s.x.kw_share) || 0) > 0.15 ? 'brand' : 'title', fit: s.f, title: s.x.title };
  }
  // government sites list providers through accreditation or an application, never through a pitch (the listings checklist covers them)
  const isGov = (d) => /(^|\.)(gov|gouv|gob|govt|mil)(\.[a-z]{2})?$/i.test(String(d || '').toLowerCase());
  // ---- who is never worth a pitch (D13, live 2026-10-11) ----
  // a mailbox provider, a generated contact / company database, a CDN or a statistics page: they turn up in link data as hosts, but there is
  // nobody there who could add a link (outlook.com and zoominfo.com were listed as broken-link prospects)
  const MAILHOST = /^(gmail\.com|googlemail\.com|outlook\.[a-z.]{2,6}|hotmail\.[a-z.]{2,6}|live\.[a-z.]{2,6}|msn\.com|yahoo\.[a-z.]{2,6}|ymail\.com|aol\.com|icloud\.com|me\.com|gmx\.[a-z.]{2,5}|web\.de|mail\.(com|ru)|email\.com|protonmail\.com|proton\.me|tutanota\.com|yandex\.[a-z.]{2,5}|fastmail\.com|rediffmail\.com|qq\.com|naver\.com|163\.com|office\.com|office365\.com|microsoftonline\.com|sharepoint\.com|mimecast\.com)$/i;
  const DATABROKER = /^(zoominfo\.[a-z.]+|apollo\.io|lusha\.com|rocketreach\.co|signalhire\.com|leadiq\.com|cognism\.com|seamless\.ai|hunter\.io|snov\.io|clearbit\.com|uplead\.com|datanyze\.com|contactout\.com|anymailfinder\.com|skrapp\.io|getprospect\.com|kaspr\.io|lead411\.com|slintel\.com|6sense\.com|owler\.com|dnb\.com|bizapedia\.com|opencorporates\.com|zaubacorp\.com|tofler\.in|signal\.ai)$/i;
  function badHost(domain) {
    const d = String(domain || '').toLowerCase().trim().replace(/^www\./, '');
    if (!d || !/\./.test(d)) return '';
    if (MAILHOST.test(d)) return 'a mailbox provider (' + d + '), not a website whose editor could add a link';
    if (DATABROKER.test(d)) return 'a contact / company database (' + d + '): its pages are generated, nobody there edits them';
    if (LK.isInfra(d)) return 'infrastructure (' + d + ': a CDN, a hosting platform or a link shortener), not a site to write to';
    if (LK.isScraper(d)) return 'an automatically generated statistics page (' + d + '), not a site to write to';
    return '';
  }
  // a bare homepage is no place for a link to add: only a listing, a list, a mention or a journalist request is pitched on the front page
  const HOME_OK = new Set(['mention', 'list', 'listing', 'ai_list', 'press', 'digest', 'podcast', 'lost', 'reclaim']);   // L5: a show's front page is where its contact and its guest invitation live
  const isHomeUrl = (u) => /^https?:\/\/[^\/?#]+\/?([?#]|$)/i.test(String(u || ''));
  const homepageOnly = (type, url) => (isHomeUrl(url) && !HOME_OK.has(String(type || '')))
    ? 'only their homepage was found: a front page has no section a link could be added to (find the page on your topic first)' : '';
  // "accredited / pre-approved / certified provider" lists: a business gets on them by applying with the accreditation, never by a pitch —
  // and asking to be added without it claims something we cannot stand behind (live 2026-10-11: two ASP lists were asked to add Tech&)
  const ACCRED_RE = /\b(accredited|accreditation|pre-?approved|approved|certified|licen[cs]ed|authori[sz]ed|registered)\b[^.\n]{0,40}\b(service providers?|providers?|asps?|partners?|vendors?|suppliers?|list|lists|directory|register|registry)\b|\b(service providers?|providers?|asps?|partners?|vendors?)\b[^.\n]{0,25}\b(accredited|pre-?approved|approved|certified|licen[cs]ed)\b/i;
  const accreditedList = (text) => ACCRED_RE.test(String(text || ''));
  // the facts on file say the business itself holds an accreditation ("none" / "not accredited" / "applying" do not)
  const accredited = (fact) => { const f = String(fact || '').trim(); if (!f) return false;
    if (/^(no\b|none|not\b|non-|never|pending|in progress|planned|applying|applied|n\/?a|unknown|tbc|tbd)/i.test(f)) return false;
    return /accredit|certif|licen|authoris|authoriz|approved|peppol|iso ?\d|registered|member/i.test(f); };
  // a prospect that sells what we sell: a declared competitor, or their own page offering our services with the signals of a vendor selling
  // them. A publisher writing about our topic has the words but not the signals; a list that leaves us out, a mention or a journalist
  // request is still pitched when the publisher also sells something (the ask there is "add us", not "link to us").
  const VENDOR_RE = /(book|schedule|request)(?: a| your)? (?:demo|call|consultation)|free trial|start (?:for )?free|talk to (?:sales|an expert|our advisor)|our (?:software|platform|product|products|solution|solutions|services|suite)|request (?:a )?quote|why choose us|our (?:clients|customers) (?:include|trust)|pricing plans?|per user ?\/ ?month|we (?:provide|offer|deliver|implement|build) /gi;
  const SELL_EXEMPT = new Set(['list', 'listing', 'ai_list', 'mention', 'press', 'digest', 'podcast', 'lost', 'reclaim']);   // L5: a journalist request and a podcast that takes guests are asked "will you cover us", not "link to us" — the declared-competitor check above still runs
  const THEIRS_RE = /\b(solutions?|services?|software|platform|suite|provider|providers|consultan\w+|implementation|company)\b/i;
  // R4 (2026-10-13, re-rating): the gate only read the prospect's page, so a competitor's *guide* passed. Live, flick.network was a `ready`
  // resource prospect with a drafted sequence while the same run's Rank Tracker had just found it at #1 for the ladder head "e invoicing in
  // uae", and basware.com (an AP / e-invoicing vendor) reached `needs_contact`. The refusal now matches the prospect's REGISTRABLE domain
  // against the declared competitors (seo_monitors.competitors) and the SERP competitors the ladder / verdict measured, and says which it was.
  // A list page ("best X", a directory, a mention, a journalist request) stays pitchable even on a rival's domain: the ask there is "add us to
  // your list", which is legitimate; pitching their guide or resource page is not.
  const LIST_TYPES = new Set(['list', 'listing', 'ai_list', 'mention', 'press']);
  const domOf = (c) => String((c && typeof c === 'object' ? (c.domain || c.d || c.host) : c) || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '').replace(/\.$/, '');
  // R21 (2026-10-14, the second re-rating): three prospects that sell exactly what the owner sells reached `ready`, two of them as drafted
  // pitches waiting for the owner. `ae.invoiceq.com` had been recorded ABOVE techand.ai for "peppol uae" on two days, yet `invoiceq.com`
  // was pitched for a brand link to the home page: the stored SERP host was matched as it stands, so a rival on a SUBDOMAIN was a
  // different site. Every host on both sides is now reduced to its registrable domain before it is matched (the host the rank check
  // really saw is quoted in the reason), and a prospect whose own page sells our service is refused on that evidence alone - whether or
  // not it is on the declared list and whether or not the rank checks happened to see it.
  const rivalEntry = (c, label) => {
    const x = domOf(c); if (!x) return null;
    const o = (c && typeof c === 'object') ? c : {};
    const pos = Number(o.position || o.p) || 0; const kw = String(o.keyword || '').slice(0, 60);
    const reg = LK.regDomain(x) || x;
    const seen = String(o.host || '').toLowerCase().replace(/^www\./, '').replace(/\.$/, '') || x;   // the host the rank check really showed
    const where = ((seen !== reg ? seen + ' ranks ' : '') + (pos ? '#' + pos : '') + (kw ? ' for "' + kw + '"' : '')).trim();
    return { domain: reg, host: seen, why: label + ((pos || seen !== reg) ? ' (' + where + ')' : '') };
  };
  // C-2 / C-8 (re-rating 2026-10-17): the one rival set (RV, v5/code/_rivals.js) - a declared competitor or a business AI recommends
  // instead of you (`ai_rivals`: the Answer Analyst's aliases and the stored AI-visibility rivals) is a BUSINESS rival; a site that only
  // outranks you is a SERP rival. `kind` says which, because only a SERP rival's "best X" list stays pitchable.
  function rivalOf(o) {
    const d = String(o.domain || '').toLowerCase().replace(/^www\./, ''); const dr = LK.regDomain(d);
    // LIVE1 (2026-11-07): a social or professional network is never a competitor (linkedin.com, where any author posts, was refused as "a site
    // that outranks you" because a LinkedIn article ranked #3 for one of the client's keywords); what its pages say is judged by the other rules
    if (d && LK.domainKind(d) === 'social') return null;
    const hit = (list, label, kind) => {
      for (const c of (list || [])) { const x = domOf(c); if (!x || !d) continue;
        if (LK.sameSite(d, x) || LK.sameSite(x, d) || (dr && dr === LK.regDomain(x))) { const e = rivalEntry(c, (c && typeof c === 'object' && c.why) || label); return e ? { ...e, kind } : null; }
      }
      return null;
    };
    return hit(o.competitors, 'a competitor of yours', 'business') || hit(o.ai_rivals, 'a business AI recommends instead of you', 'business')
      || hit(o.serp_rivals, 'a site that outranks you for one of your own keywords', 'serp');
  }
  // a rival's "best X" list is still fair game - but only when the page really IS such a list. A mention, a resource page or the rival's
  // own front page is not: "add us to your list" has somewhere to go, "link to our guide" has not.
  const ROUNDUP_RE = /\b(best|top\s*\d+|top ten|alternatives?|round-?up|shortlist|directory|listing|list of|compar(?:e|ed|ison)|vs)\b/i;
  const isRoundup = (o) => ROUNDUP_RE.test(String(o.title || '')) || ROUNDUP_RE.test(String(o.url || o.page_url || '').replace(/[\/_?.&=-]+/g, ' '));
  // ---- R86 (2026-10-16, re-rating defect C-10): the competitor test judged only the prospect PAGE. daxin-global.ae (whose own pages
  // sell Odoo, Dynamics 365, Business Central and e-invoicing in Dubai) and qzinfomatics.com ("Microsoft Dynamics 365 Partner in Dubai")
  // reached `ready` because their blog article named too few of the customer's 30 services to reach the 45% bar — a bar over a
  // 30-service list is the problem, not its value. The SITE is now judged too, on the pages the run already fetched for contacts
  // (about / contact / home): a business whose own pages offer at least SITE_MIN_SERVICES of our services — each service matched by
  // all of its words, single-word services left out because one word ("builder", "finance") proves nothing — with the signals of a
  // vendor selling them, in our market (the country named, or its domain ending), is a competing provider whatever its article is.
  const SITE_MIN_SERVICES = 2, SITE_MIN_SIGNALS = 2;
  const SITE_EXEMPT = new Set(['lost', 'reclaim', 'digest', 'podcast']);   // a lost link, a journalist request, a show: the ask is not "link to our page"
  const MARKET = { AE: ['uae', 'u\\.a\\.e', 'dubai', 'abu dhabi', 'sharjah', 'ajman', 'united arab emirates', 'emirates'], SA: ['ksa', 'saudi', 'riyadh', 'jeddah', 'dammam'], QA: ['qatar', 'doha'],
    KW: ['kuwait'], BH: ['bahrain', 'manama'], OM: ['oman', 'muscat'], EG: ['egypt', 'cairo'], GB: ['uk', 'united kingdom', 'london', 'england'], US: ['usa', 'united states'], IN: ['india'], PK: ['pakistan'],
    SG: ['singapore'], AU: ['australia'], CA: ['canada'], DE: ['germany', 'deutschland'] };
  const TLD_OF = Object.fromEntries(Object.entries(CC).map(([k, v]) => [v, k]));
  const marketRe = (o) => { const iso = String(o.country_iso || '').toUpperCase(); const words = [...(MARKET[iso] || []), ...(o.country ? [String(o.country).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')] : [])];
    return words.length ? new RegExp('(^|[^a-z])(' + words.join('|') + ')($|[^a-z])', 'i') : null; };
  function siteOffer(o) {
    const text = String(o.site_text || '').slice(0, 60000); if (text.length < 200) return null;
    const T = new Set(words(text).map(stem));
    const offered = []; const seen = new Set();
    for (const sv of (o.terms || [])) { const st = [...new Set(words(sv).map(stem))]; const key = st.slice().sort().join(' ');
      if (st.length < 2 || seen.has(key)) continue; seen.add(key); if (st.every(w => T.has(w))) offered.push(String(sv)); }
    const signals = [...new Set((text.match(VENDOR_RE) || []).map(x => x.toLowerCase().replace(/\s+/g, ' ').trim()))];
    const re = marketRe(o); const iso = String(o.country_iso || '').toUpperCase(); const d = String(o.domain || '').toLowerCase();
    const local = !re ? true : re.test(text) || (TLD_OF[iso] ? d.endsWith('.' + TLD_OF[iso]) : false);
    return { offered, signals, local, pages: (o.site_pages || []).slice(0, 3) };
  }
  function sellsSame(o) {
    const type = String(o.type || '');
    const rival = rivalOf(o);
    // a SERP rival's "best X" list is fair game (a publisher that outranks you); a business rival's own list is not - it ranks itself first
    // and does not add a competitor (C-2: flick.network, named by AI instead of you, was pitched "ask the editor to add you to this list")
    if (rival && rival.kind === 'serp' && (LIST_TYPES.has(type) || type === 'ai_source') && isRoundup(o)) return '';
    if (rival) return 'a competing site of yours (' + rival.domain + '): ' + rival.why + (rival.kind === 'business' && isRoundup(o) ? ', and its own list ranks itself, not you' : ', and a competitor does not link to your page');
    const site = (SITE_EXEMPT.has(type) || (LIST_TYPES.has(type) && isRoundup(o))) ? null : siteOffer(o);
    if (site && site.offered.length >= SITE_MIN_SERVICES && site.signals.length >= SITE_MIN_SIGNALS && site.local)
      return 'a competing provider: their own site' + (site.pages.length ? ' (' + site.pages.join(', ') + ')' : '') + ' offers ' + site.offered.length + ' of your services ("'
        + site.offered.slice(0, 3).join('", "') + '"' + (site.offered.length > 3 ? ' …' : '') + ') with the signals of a vendor selling them ("' + site.signals.slice(0, 2).join('", "') + '")'
        + (o.country ? ' in ' + o.country : '');
    // C-8 (after the service-overlap evidence above, which names what their site offers): a site that sells your CATEGORY (ERP, e-invoicing, IT, AI, cloud) by its title, its address or its own about / contact text,
    // whatever product names it uses - erp-dubai.ae "ERPNext Implementation Partner", penieltech.com "Odoo Implementation"
    if (!SITE_EXEMPT.has(type) && typeof RV !== 'undefined') {
      const cat = RV.providerOf({ domain: o.domain, title: o.title, url: o.url || o.page_url, site_text: o.site_text, page_html: o.page_html, topics: o.topics, services: o.terms });   // C-8 leftover (F-L): page_html = the prospect page itself (its menu + sales buttons)
      if (cat) return 'a competing provider: ' + cat;
    }
    const terms = [...new Set((o.terms || []).flatMap(t => words(t).map(stem)))];
    if (terms.length < 2) return '';
    const title = String(o.title || ''); const text = String(o.text || '').slice(0, 30000);
    const T = new Set(words(title + ' ' + text).map(stem));
    const share = terms.filter(t => T.has(t)).length / terms.length;
    const signals = [...new Set((text.match(VENDOR_RE) || []).map(x => x.toLowerCase().replace(/\s+/g, ' ').trim()))];
    const theirs = THEIRS_RE.test(title) && words(title).map(stem).some(w => terms.includes(w));
    const topic = Number(o.fit) > 0 ? Number(o.fit) : 0;   // the topic match this run measured on their page, where it read one
    // their page sells our service: our words AND the signals of a vendor selling them, confirmed by the title or by that measured match
    // (deloitte.com at 54% and alaan.com at 65% were `ready` on 2026-10-14 with no title THEIRS_RE could read)
    if (!(signals.length >= 2 && share >= 0.45 && (theirs || topic >= 0.5))) return '';
    if (SELL_EXEMPT.has(type) && (!LIST_TYPES.has(type) || isRoundup(o))) return '';   // a roundup, a journalist request, a podcast, a lost link: the ask there is not "link to our guide"
    return 'a competing provider: their page sells what you sell (' + Math.round(share * 100) + '% of your service words'
      + (topic ? ', topic match ' + Math.round(topic * 100) + '%' : '') + ', "' + signals.slice(0, 2).join('", "') + '")';
  }
  // does a page name the business? Punctuation in a name ("Tech&") breaks \b, so every name is matched by its letter / digit runs with a
  // little punctuation allowed between them, and the domain counts as a name too.
  // P34-2 (live 2026-10-12): "Tech&" collapses to the four-letter run "tech", which matched the plain word "tech" on three unrelated
  // pages and claimed listings the site does not have — SaaSHub ("Tech Alternatives", 20x "tech", 0x "techand"), AlternativeTo and the
  // UAE Ministry of Finance accredited-provider list. A name decides that on its own only when it is distinctive: the domain, or letter /
  // digit runs of at least MIN_NAME_RUN characters. A shorter name is matched only with its own punctuation in place ("Tech&", "Tech &"),
  // never as the bare letters, so the stripped-ampersand form is never evidence on its own. (Entities are decoded by LK.text first.)
  const MIN_NAME_RUN = 5;
  const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function nameRe(n) {
    const s = String(n || '').trim(); const runs = s.toLowerCase().match(/[a-z0-9]+/g) || [];
    if (!runs.length) return null;
    const isDomain = runs.length >= 2 && /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(s);
    if (isDomain || runs.join('').length >= MIN_NAME_RUN) return new RegExp('(^|[^a-z0-9])' + runs.join('[^a-z0-9]{0,3}') + '($|[^a-z0-9])', 'i');
    if (!/[^a-z0-9\s]/i.test(s)) return null;   // four letters and nothing else: too common a word to claim anything by itself
    return new RegExp('(^|[^a-z0-9])' + s.toLowerCase().split(/\s+/).map(reEsc).join('\\s*'), 'i');
  }
  function namesUs(text, names) {
    const t = String(text || '');
    for (const n of (names || [])) { const re = nameRe(n); if (re && re.test(t)) return String(n); }
    return '';
  }
  // ---- the cold link gap: who is never pitched when all we know is the domain (P34-4, live 2026-10-12) ----
  // The full SEO report's "Link opportunities" told the owner to "reach out with a listing request, partnership or useful resource" to
  // mof.gov.ae (a ministry you join by accreditation), backlinkcheckers.space and buyhighda.space (sites whose business is selling
  // links). The Backlink Monitor refuses all three on the same data; this is the rule both of them use. The spam score is the link
  // index's own 0-100 (DataForSEO `backlinks_spam_score`).
  const SELLWORD = /(backlink|dofollow|link ?building|link ?farm|guest ?post|high ?da|seo ?link|buy ?link|authority ?link|link ?juice|link ?exchange|pbn)/i;
  function noPitch(domain, o) {
    const x = o || {}; const d = String(domain || '').toLowerCase().replace(/^www\./, '');
    if (!d || !/\./.test(d)) return 'not a website';
    if (isGov(d)) return 'a government site: you get on its lists by applying or being accredited, not by a pitch (see the listings checklist)';
    const bad = badHost(d); if (bad) return bad;
    if (LK.isWire(d)) return 'a press-release wire (' + d + '): a link there is a paid release, not an editorial link';
    if (LK.isGambling(d)) return 'a gambling site (' + d + ')';
    const name = d.replace(/\.[a-z.]{2,}$/, '').replace(/[.-]+/g, ' ');
    if (SELLWORD.test(name)) return 'its own name offers links ("' + name.slice(0, 40) + '"): a site that sells links passes nothing on and risks a penalty';
    if (Number(x.spam) >= 30) return 'a spam score of ' + Math.round(Number(x.spam)) + ' of 100 in the link index';
    if (!x.accredited && accreditedList(String(x.title || '') + ' ' + name)) return 'a list of accredited / approved providers: you get on it by applying with the accreditation, and the facts on file do not say you hold one';
    return '';
  }
  // and whether anything ties a bare domain to our topics: a topic word inside its own name, a title we know for it, or our own market's
  // domain ending (the 25% rule the Link Builder applies to the page it fetches, OFF_TOPIC)
  function gapTopic(domain, o) {
    const x = o || {}; const d = String(domain || '').toLowerCase().replace(/^www\./, '');
    const name = d.replace(/\.[a-z.]{2,}$/, '').replace(/[.-]+/g, ' ');
    const topicStems = new Set(words(x.topics || '').map(stem).filter(w => w.length >= 4));
    if (words(name).map(stem).some(w => topicStems.has(w))) return { ok: true, why: 'its name carries your topic' };
    const f = x.title ? fit(x.topics, x.title, x.df, x.docs) : 0;
    if (f >= OFF_TOPIC) return { ok: true, why: 'its page matches your topics (' + Math.round(100 * f) + '%)' };
    const tld = String(x.country_tld || '').toLowerCase();
    if (tld.length === 2 && tld !== 'us' && d.endsWith('.' + tld)) return { ok: true, why: 'a site in your market (.' + tld + ')' };
    return { ok: false, why: 'off topic for you: neither its name, its page nor its country ties it to ' + (String(x.topic_label || '') || 'your topics') };
  }
  // ---- LIVE1 (2026-11-07, the first live AI ranking run): a placement AI ranking would pitch, through the Link Builder's own verdicts and rules,
  // BEFORE it is chosen. Live, AI ranking chose five lists the Link Builder had already refused (competitors' own lists, paid guest posts) or
  // had already written to, so the Link Builder drafted none. Read from the stored rows only (no fetch): the Link Builder's latest verdict on
  // this site's page (not_fit, with its reason), any earlier pitch to the same site (a drafted sequence, a sent or answered e-mail, a stored
  // draft), and the rules that need no page: a mailbox / database / CDN host, a government site, a bare homepage, a competing site.
  // -> { refused: '' | why, contact: 'email' | 'form' | '', email, form }. A contact form only is allowed: the caller marks it a manual step.
  // the platforms the Link Builder never reads for a pitch (LB_Page_Requests' BIG list, kept identical; harness LIVE1-3 compares the two): a page
  // there belongs to whoever posted it, nobody edits it for a pitch, and the Link Builder would never qualify or draft it
  const PLATFORM = /(^|\.)(google|youtube|facebook|linkedin|wikipedia|amazon|apple|microsoft|reddit|quora|instagram|twitter|x|tiktok|medium|github|pinterest|bing|yahoo|duckduckgo)\.[a-z.]+$/i;
  const PITCHED = new Set(['drafted', 'needs_edit', 'approved', 'scheduled', 'sending', 'sent', 'replied', 'won', 'bounced', 'opted_out', 'stopped', 'contacted', 'declined']);
  const pkey = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  function placementVet(o) {
    const x = o || {}; const host = domOf(x.domain || LK.hostOf(x.url)); const d = LK.regDomain(host) || host; if (!d) return { refused: 'no site address', contact: '', email: '', form: '' };
    const mine = (r) => { const y = domOf(r && r.prospect_domain); return !!y && (LK.sameSite(y, d) || LK.regDomain(y) === d); };
    const outs = (x.outreach || []).filter(mine), pros = (x.prospects || []).filter(mine);
    const when = (r) => String(r.drafted_at || r.contacted_at || r.checked_at || r.updated_at || r.updatedAt || '').slice(0, 10);
    const pitched = outs.find(r => PITCHED.has(String(r.status || '')) || String(r.sequence_json || '').length > 2 || !!String(r.drafted_at || ''))
      || pros.find(r => PITCHED.has(String(r.status || '')) || !!String(r.contacted_at || '') || !!String(r.drafted_at || '') || !!String(r.outreach_body || '').trim());
    if (pitched) return { refused: 'the Link Builder already wrote to ' + d + (when(pitched) ? ' (' + when(pitched) + ')' : '') + ': one pitch per site, nothing new to send', contact: '', email: '', form: '' };
    const nf = outs.filter(r => String(r.status || '') === 'not_fit' && (String(r.type || '') === 'ai_source' || (pkey(r.page_url) && pkey(r.page_url) === pkey(x.url))))
      .sort((a, b) => String(b.checked_at || b.updatedAt || '').localeCompare(String(a.checked_at || a.updatedAt || '')))[0];
    if (nf) return { refused: 'the Link Builder ruled it out' + (when(nf) ? ' on ' + when(nf) : '') + ': ' + String(nf.fit_reason || 'not a fit').slice(0, 240), contact: '', email: '', form: '' };
    const why = badHost(d) || (PLATFORM.test(host) || PLATFORM.test(d) ? 'a platform page (' + d + '): the Link Builder does not pitch a platform, a post there belongs to whoever wrote it' : '') || (isGov(d) ? 'government site: you get on its lists by applying or being accredited, not by a pitch (see the listings checklist)' : '') || homepageOnly('ai_source', x.url)
      || sellsSame({ type: 'ai_source', domain: d, competitors: x.competitors || [], serp_rivals: x.serp_rivals || [], ai_rivals: x.ai_rivals || [], topics: x.topics || [], title: x.title || '', url: x.url || '', terms: x.terms || [] });
    if (why) return { refused: why, contact: '', email: '', form: '' };
    const jl = (v) => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
    const email = String(x.contact_email || '').trim() || (outs.map(r => String(r.contact_email || '') || String((jl(r.contacts_json)[0] || {}).email || '')).find(Boolean) || '') || (pros.map(r => String(r.contact_email || '')).find(Boolean) || '');
    const form = email ? '' : (String(x.contact_url || '').trim() || outs.map(r => String(r.contact_form_url || '')).find(Boolean) || pros.map(r => String(r.contact_url || '')).find(Boolean) || '');
    return { refused: '', contact: email ? 'email' : form ? 'form' : '', email, form };
  }
  return { OFF_TOPIC, isGov, words, stem, fit, contactsIn, placementVet, PLATFORM, rankContacts, authorUrl, contactForm, sellSignals, countryOf, pickTarget, kindOf,
    badHost, isHomeUrl, homepageOnly, accreditedList, accredited, sellsSame, siteOffer, rivalOf, isRoundup, LIST_TYPES, namesUs, nameRe, MIN_NAME_RUN, noPitch, gapTopic, SELLWORD };
})();

// ---- ARD: the AI-ranking diagnosis kit (inlined by build_monitors.py through its marker, after AIRF) ----
// AIR (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §2.A-§2.C, interface frozen in CONTRACTS.md §3.2). OWNER: package P1 (fixes/P1.md).
// What it answers, per site and per question x engine:
//   A  the market (A1), the intent of each question (A2), the frozen core panel (A3/A4), treatment and control arms (A6), what change the
//      panel can detect (A7: MDE and the first-appearance requirement)
//   B  the stage where the client is stuck (S0 cannot be read .. S5 won), with the basis of the reading (direct / proxy_rank / unknown_index),
//      the counts and up to three evidence items; parametric share, no_search, list_dominated, nobody_named, the first / last dates named or cited
//   C  the source graph: every third-party page the answers cite, its type and author, whether it names the client, influence and placeability
// Pure: no $(...), no network, no clock (time comes in as `now`, ms or ISO). n8n sandbox: no URL constructor (hosts by regex), no
// Object.defineProperty / setPrototypeOf, no structuredClone. Needs AIRF (_ai_rank_flags.js) in scope. Engines in AIRF.EXCLUDED_ENGINES
// (gemini_api) are ignored everywhere. Shapes are the frozen ones; fields added beside them are marked "additive" and nobody must rely on
// their absence.
const ARD = (() => {
  const VERSION = 'air-2';   // FX-A2: follows AIRF.RULE_VERSION (FX-B)
  const DAY = 864e5;
  // ---- small helpers -----------------------------------------------------------------------------------------------------------------
  const S = (v) => (v == null ? '' : String(v)).trim();
  const lc = (v) => S(v).toLowerCase();
  const num = (v, d) => { if (v === '' || v == null) return d; const n = Number(v); return Number.isFinite(n) ? n : d; };
  const J = (v, d) => { if (v && typeof v === 'object') return v; const s = S(v); if (!s) return d; try { const x = JSON.parse(s); return x == null ? d : x; } catch (e) { return d; } };
  const MSC = new Map();   // the same answer dates come back thousands of times: parse each once
  const msOf = (t) => { if (typeof t === 'number') return t; const k = S(t); let x = MSC.get(k); if (x === undefined) { x = Date.parse(k); if (!Number.isFinite(x)) x = NaN; if (MSC.size > 50000) MSC.clear(); MSC.set(k, x); } return x; };
  const ISC = new Map();
  const isoOf = (ms) => { if (!Number.isFinite(ms)) return ''; let x = ISC.get(ms); if (x === undefined) { x = new Date(ms).toISOString(); if (ISC.size > 50000) ISC.clear(); ISC.set(ms, x); } return x; };
  const dayOf = (ms) => isoOf(ms).slice(0, 10);
  const r1 = (x) => Math.round(10 * x) / 10; const r3 = (x) => Math.round(1000 * x) / 1000; const r4 = (x) => Math.round(1e4 * x) / 1e4;
  const flag = (v) => v === true || /^(true|1|yes)$/i.test(S(v));
  const usable = (e) => AIRF.usable(e);
  const engOf = (e) => lc(e);
  const median = (xs) => { const a = xs.filter(x => Number.isFinite(x)).sort((p, q) => p - q); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const normKw = (k) => { let s = S(k); try { s = s.normalize('NFKC'); } catch (e) {} return s.toLowerCase().replace(/\s+/g, ' ').trim(); };   // as _serp_cache.js
  const HC = new Map();
  const hostOf = (u) => { const k = S(u); let h = HC.get(k); if (h === undefined) { h = hostOf0(k); if (HC.size > 50000) HC.clear(); HC.set(k, h); } return h; };
  const hostOf0 = (u) => { const m = S(u).match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@\/?#]*@)?([^\/?#:\s]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '').replace(/\.$/, '') : ''; };
  const pathOf = (u) => { const m = S(u).match(/^https?:\/\/[^\/?#]+([^?#]*)/i); return m ? (m[1] || '/') : ''; };
  const isHttp = (u) => /^https?:\/\/[^\/?#\s]+/i.test(S(u));
  const hostIn = (h, list) => { const x = hostOf(h); if (!x) return false; for (const o of list) if (x === o || x.endsWith('.' + o)) return true; return false; };
  const compact = (s) => lc(s).replace(/[^a-z0-9]+/g, '');
  const hex8 = (s) => ('0000000' + AIRF.hash(s).toString(16)).slice(-8);
  const asMap = (m) => (m instanceof Map ? m : m && typeof m === 'object' ? new Map(Object.entries(m)) : new Map());
  // the client's hosts: the site (domain, canonical host), the hosts given, brand aliases; www and case removed
  const ourList = (site, ourHosts, extra) => { const out = new Set(); const add = (h) => { const x = hostOf(h); if (x && /\./.test(x)) out.add(x); };
    const s = site || {}; add(s.domain); add(s.canonical_host); for (const h of (Array.isArray(ourHosts) ? ourHosts : S(ourHosts).split(/[,\s]+/))) add(h); for (const h of (extra || [])) add(h); return [...out]; };

  // ---- places -> countries (A1) --------------------------------------------------------------------------------------------------------
  // [cc, DataForSEO location code, ISO alpha-3, country names, place words]
  const GEO = [
    ['AE', 2784, 'ARE', ['united arab emirates', 'uae', 'emirates'], ['uae', 'u.a.e', 'emirates', 'dubai', 'abu dhabi', 'sharjah', 'ajman', 'ras al khaimah', 'fujairah', 'al ain', 'umm al quwain']],
    ['SA', 2682, 'SAU', ['saudi arabia', 'ksa', 'kingdom of saudi arabia'], ['saudi', 'saudi arabia', 'ksa', 'riyadh', 'jeddah', 'dammam', 'khobar', 'mecca', 'makkah', 'medina', 'madinah', 'tabuk']],
    ['PK', 2586, 'PAK', ['pakistan'], ['pakistan', 'lahore', 'karachi', 'islamabad', 'rawalpindi', 'faisalabad', 'multan', 'peshawar']],
    ['QA', 2634, 'QAT', ['qatar'], ['qatar', 'doha']], ['KW', 2414, 'KWT', ['kuwait'], ['kuwait']], ['BH', 2048, 'BHR', ['bahrain'], ['bahrain', 'manama']],
    ['OM', 2512, 'OMN', ['oman'], ['oman', 'muscat']], ['EG', 2818, 'EGY', ['egypt'], ['egypt', 'cairo', 'alexandria']], ['JO', 2400, 'JOR', ['jordan'], ['jordan', 'amman']],
    ['IN', 2356, 'IND', ['india'], ['india', 'mumbai', 'delhi', 'new delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'pune', 'kolkata']],
    ['GB', 2826, 'GBR', ['united kingdom', 'uk', 'great britain'], ['uk', 'united kingdom', 'britain', 'england', 'scotland', 'london', 'manchester', 'birmingham']],
    ['US', 2840, 'USA', ['united states', 'usa', 'united states of america'], ['usa', 'united states', 'america', 'new york', 'california', 'texas', 'florida', 'chicago', 'san francisco', 'los angeles', 'seattle', 'boston']],
    ['CA', 2124, 'CAN', ['canada'], ['canada', 'toronto', 'vancouver', 'montreal']], ['AU', 2036, 'AUS', ['australia'], ['australia', 'sydney', 'melbourne']],
    ['DE', 2276, 'DEU', ['germany'], ['germany', 'berlin', 'munich']], ['FR', 2250, 'FRA', ['france'], ['france', 'paris']], ['NL', 2528, 'NLD', ['netherlands'], ['netherlands', 'amsterdam']],
    ['IE', 2372, 'IRL', ['ireland'], ['ireland', 'dublin']], ['SG', 2702, 'SGP', ['singapore'], ['singapore']], ['MY', 2458, 'MYS', ['malaysia'], ['malaysia', 'kuala lumpur']],
    ['TR', 2792, 'TUR', ['turkey', 'turkiye'], ['turkey', 'istanbul']], ['NG', 2566, 'NGA', ['nigeria'], ['nigeria', 'lagos']], ['KE', 2404, 'KEN', ['kenya'], ['kenya', 'nairobi']],
    ['ZA', 2710, 'ZAF', ['south africa'], ['south africa', 'johannesburg', 'cape town']] ];
  const GCC = ['AE', 'SA', 'QA', 'KW', 'BH', 'OM'];
  const REGIONAL = /\b(gcc|gulf|middle east|mena)\b/;
  const LOC = new Map(GEO.map(g => [g[0], g[1]]));
  const PLACE_RE = GEO.map(g => [g[0], new RegExp('\\b(' + g[4].map(w => w.replace(/[.]/g, '\\.').replace(/ /g, '\\s+')).join('|') + ')\\b', 'i')]);
  const PLACE_TOKENS = new Set(GEO.flatMap(g => g[4].flatMap(w => w.split(' '))).concat(['gcc', 'gulf', 'mena', 'middle', 'east']));
  // a country code from a code, an alpha-3, a name, a DataForSEO location code or a place word ('' when none)
  const ccOf = (v) => { if (typeof v === 'number' || /^\d{4}$/.test(S(v))) { const n = Number(v); const g = GEO.find(x => x[1] === n); return g ? g[0] : ''; }
    const s = lc(v); if (!s) return ''; if (/^[a-z]{2}$/.test(s)) { const g = GEO.find(x => x[0] === s.toUpperCase()); return g ? g[0] : s === 'uk' ? 'GB' : s.toUpperCase(); }
    if (/^[a-z]{3}$/.test(s)) { const g = GEO.find(x => lc(x[2]) === s); if (g) return g[0]; }
    const byName = GEO.find(x => x[3].includes(s)); if (byName) return byName[0];
    const hit = PLACE_RE.find(([, re]) => re.test(s)); return hit ? hit[0] : ''; };
  // every country a keyword names (place words), a regional word (GCC / Gulf / Middle East) counting for the site's own country when it is in the region
  const placesIn = (kw, siteCc) => { const s = lc(kw); const out = PLACE_RE.filter(([, re]) => re.test(s)).map(([cc]) => cc);
    if (!out.length && REGIONAL.test(s) && GCC.includes(siteCc)) out.push(siteCc); return [...new Set(out)]; };

  // ---- A1: the market --------------------------------------------------------------------------------------------------------------
  const isClientChosen = (r) => /^(client|user|owner)/i.test(S(r.chosen_by));
  const kwOf = (x) => (typeof x === 'string' ? x : x ? S(x.keyword || x.query || x.head_keyword) : '');
  const market = ({ site, ladders, tracked, monitors, profile, gscCountries } = {}) => {
    const st = site || {}; const pr = profile || {};
    const siteCc = ccOf(st.country) || ccOf(st.location_code) || ccOf(st.country_code);
    const tally = new Map(); const inputs = [];
    const add = (cc, w, source, value) => { if (!cc || !(w > 0)) return; tally.set(cc, (tally.get(cc) || 0) + w); inputs.push({ cc, w, source, value: S(value) }); };
    // keywords the client chose: a ladder's own head keyword (chosen by the client, or a legacy row with no chooser), tracked keywords;
    // a rung the system spawned, and the panel questions the model wrote, are never a source
    const client = new Set(), ignored = new Set();
    for (const r of (Array.isArray(ladders) ? ladders : [])) { if (!r) continue; const head = normKw(r.head_keyword || r.keyword); const kw = normKw(r.keyword || r.head_keyword); if (!head) continue;
      if (/^(deleted|refused|removed)$/i.test(S(r.status))) continue;
      if (isClientChosen(r) || !S(r.chosen_by)) { client.add(head); if (kw !== head) ignored.add(kw); } else { ignored.add(head); ignored.add(kw); } }
    for (const k of client) ignored.delete(k);
    for (const t of (Array.isArray(tracked) ? tracked : S(tracked).split(','))) { const k = normKw(kwOf(t)); if (k && !ignored.has(k)) client.add(k); }
    for (const k of client) { const ccs = placesIn(k, siteCc); for (const cc of ccs) add(cc, 3 / ccs.length, 'keyword', k); }
    if (siteCc) add(siteCc, 3, 'site.country', S(st.country) || S(st.location_code));
    for (const a of S(pr.service_areas).split(/[,;|\n]+/).map(S).filter(Boolean)) add(ccOf(a), 1, 'profile.service_areas', a);
    const gsc = Array.isArray(gscCountries) ? gscCountries.map(g => [ccOf(g && (g.country || g.cc || g.key || (g.keys || [])[0])), num(g && g.clicks, 0)])
      : gscCountries && typeof gscCountries === 'object' ? Object.entries(gscCountries).map(([k, v]) => [ccOf(k), num(v && typeof v === 'object' ? v.clicks : v, 0)]) : [];
    const topG = gsc.filter(g => g[0] && g[1] > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (topG) add(topG[0], 2, 'search_console.top_country', topG[0]);
    const prCc = ccOf(pr.country_code) || ccOf(pr.country); if (prCc) add(prCc, 1, 'profile.country_code', prCc);
    const kwW = (cc) => inputs.filter(i => i.cc === cc && i.source === 'keyword').reduce((s, i) => s + i.w, 0);
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1] || (b[0] === siteCc) - (a[0] === siteCc) || kwW(b[0]) - kwW(a[0]) || a[0].localeCompare(b[0]));
    const lang = lc(st.language_code) || lc(pr.language) || 'en';
    if (!ranked.length) return { cc: '', lang, location_code: 0, second: null, conflicts: [], basis: 'no market signal: no client keyword with a place, no site country, no service area, no Search Console country, no profile country' };
    const [cc, w] = ranked[0]; const total = ranked.reduce((s, x) => s + x[1], 0);
    const second = ranked[1] && ranked[1][1] >= 0.75 * w ? { cc: ranked[1][0], share: r3(ranked[1][1] / total) } : null;
    const seen = new Set(); const conflicts = [];
    for (const i of inputs) { if (i.cc === cc) continue; const k = i.source + '|' + i.cc + '|' + i.value; if (seen.has(k)) continue; seen.add(k); conflicts.push({ source: i.source, value: i.cc + (i.value && i.value !== i.cc ? ' (' + i.value + ')' : '') }); }
    const loc = siteCc === cc && num(st.location_code, 0) > 0 ? num(st.location_code, 0) : (LOC.get(cc) || 0);
    const part = (c) => { const by = new Map(); for (const i of inputs.filter(x => x.cc === c)) by.set(i.source, (by.get(i.source) || 0) + i.w); return [...by.entries()].map(([s, v]) => s + ' ' + r1(v)).join(', '); };
    const basis = ranked.slice(0, 3).map(([c, v]) => c + ' ' + r1(v) + ' (' + part(c) + ')').join('; ') + (ignored.size ? '; ' + ignored.size + ' keyword(s) the system chose itself not counted' : '');
    return { cc, lang, location_code: loc, second, conflicts, basis };
  };

  // ---- A2: intent -------------------------------------------------------------------------------------------------------------------
  // an answer (row of seo_ai_answers, or a unit of AVX.history) names a business: the client, or an entity in the role competitor
  const namesBusiness = (a) => { if (!a) return false; if (a.named === true || flag(a.named)) return true;
    if (Array.isArray(a.rivals)) return a.rivals.length > 0;
    const ents = J(a.entities_json, null); if (Array.isArray(ents)) return ents.some(x => x && (x.role === 'competitor' || (x.role === 'self' && x.position != null)));
    return !!S(a.competitors); };
  const answered = (a) => !!a && a.answered !== false && !S(a.error) && usable(a.engine);
  const REC_Q = /\b(best|top|leading|recommend\w*|which\s+(\w+\s+){0,2}(compan|firm|agenc|provider|vendor|partner|consult|house|developer|studio|shop|platform|tool|software|app)\w*|who\s+(are|is|can|offers?|provides?|builds?|sells?|does)|near me|hire)\b/i;
  const PROVIDER_Q = /\b(providers?|vendors?|agenc(y|ies)|compan(y|ies)|firms?|partners?|consultants?|contractors?|developers?|integrators?|resellers?|suppliers?)\b/i;
  const INFO_Q = /^\s*(what|how|why|when|where|is|are|can|does|do|should|will|explain|define)\b/i;
  const intentOf = (prompt, answers28) => { const p = prompt || {};
    if (lc(p.kind) === 'brand' || lc(p.source) === 'brand' || lc(p.intent) === 'brand') return 'brand';
    const pid = S(p.prompt_id);
    const rows = (Array.isArray(answers28) ? answers28 : []).filter(a => answered(a) && (!pid || !S(a.prompt_id) || S(a.prompt_id) === pid));
    if (rows.length >= 4) return rows.filter(namesBusiness).length / rows.length >= 0.5 ? 'recommendation' : 'informational';
    const k = lc(p.kind); if (['recommend', 'recommendation', 'compare', 'choose', 'shortlist', 'alternatives'].includes(k)) return 'recommendation'; if (['learn', 'informational', 'info', 'cost', 'problem', 'howto', 'how_to', 'define'].includes(k)) return 'informational';
    const t = S(p.prompt || p.question); if (!t) return 'unknown';
    return REC_Q.test(t) ? 'recommendation' : INFO_Q.test(t) ? 'informational' : PROVIDER_Q.test(t) ? 'recommendation' : 'unknown'; };

  // ---- tokens for matching a page to a question ------------------------------------------------------------------------------------
  const STOP = new Set(['the', 'and', 'for', 'with', 'what', 'how', 'which', 'who', 'are', 'is', 'can', 'does', 'do', 'your', 'you', 'that', 'this', 'from', 'into', 'best', 'top', 'in',
    'of', 'to', 'a', 'an', 'on', 'by', 'or', 'it', 'its', 'my', 'our', 'we', 'company', 'companies', 'provider', 'providers', 'firm', 'firms', 'agency', 'agencies', 'service', 'services',
    'near', 'me', 'much', 'cost', 'costs', 'html', 'php', 'www', 'https', 'http', 'blog', 'page', 'index', 'en', 'ar', 'leading', 'good', 'great']);
  const stem = (w) => (w.length > 4 && /ies$/.test(w) ? w.slice(0, -3) + 'y' : w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w);
  const toks = (s, keepCost) => lc(s).replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').split(' ').filter(w => w.length >= 2 && !/^\d{4}$/.test(w) && !PLACE_TOKENS.has(w) && (!STOP.has(w) || (keepCost && /^costs?$/.test(w)))).map(stem);
  const cover = (kw, text) => { const K = [...new Set(toks(kw, true))]; if (!K.length) return 0; const P = new Set(toks(text, true)); return K.filter(k => P.has(k)).length / K.length; };

  // ---- A3/A4: the core panel ----------------------------------------------------------------------------------------------------------
  const marketCc = (m) => S(m).split(/[-_]/)[0].toUpperCase();
  const corePanel = ({ site, prompts, units60, stored, market, demand, now, cfg } = {}) => {
    const N = msOf(now); const C = cfg || {}; const coreMax = num(C.core_max, 30); const FREEZE = num(C.freeze_days, 56) * DAY;
    const mk = market || {}; const siteCc = S(mk.cc).toUpperCase(); const lang = lc(mk.lang) || 'en';
    const P = (Array.isArray(prompts) ? prompts : []).filter(p => p && S(p.prompt_id) && !/^deleted$/i.test(S(p.status)));
    const ST = new Map((Array.isArray(stored) ? stored : []).filter(r => r && S(r.prompt_id)).map(r => [S(r.prompt_id), r]));
    const inW = (t, d) => { const x = msOf(t); return !Number.isFinite(N) || !Number.isFinite(x) || (x > N - d * DAY && x <= N + 6 * 3600e3); };
    const U = (Array.isArray(units60) ? units60 : []).filter(u => answered(u) && inW(u.at, 56));
    const lastHit = new Map(), by28 = new Map();
    for (const u of U) { const pid = S(u.prompt_id); if (u.named || u.cited) { const t = msOf(u.at); if (!lastHit.has(pid) || t > lastHit.get(pid)) lastHit.set(pid, Number.isFinite(t) ? t : N); }
      if (inW(u.at, 28)) { const a = by28.get(pid) || []; a.push(u); by28.set(pid, a); } }
    const DM = asMap(demand && (demand.byPrompt || demand.by_prompt) ? (demand.byPrompt || demand.by_prompt) : demand);
    const volOf = (p) => { const d = DM.get(S(p.prompt_id)); const v = d && typeof d === 'object' ? num(d.volume != null ? d.volume : d.vol, null) : num(d, null); return v != null ? v : num(p.volume, 0); };
    const brand = (p) => intentOf(p, []) === 'brand';
    const isActive = (p) => !S(p.status) || /^active$/i.test(S(p.status));
    const marketOk = (p) => !siteCc || !S(p.market) || marketCc(p.market) === siteCc;
    const iso = isoOf; const core = [], extend = []; const inCore = new Set();
    const meta = (p) => { const u28 = by28.get(S(p.prompt_id)) || []; return { intent: intentOf(p, u28), baseline: u28.some(u => u.named || u.cited) ? 'some' : 'zero', cluster: lc(p.cluster || p.topic) || '', market: S(p.market) || (siteCc ? siteCc + '-' + lang : '') }; };
    const push = (p, since, until, reason) => { core.push({ prompt_id: S(p.prompt_id), core_since: since, core_until: until, reason, ...meta(p) }); inCore.add(S(p.prompt_id)); };
    // 1. frozen ones stay; 2. a question that named or cited the client in 56 days is never retired: its window is extended
    for (const p of P) { if (brand(p)) continue; const pid = S(p.prompt_id); const s = ST.get(pid); const was = s && flag(s.core);
      const until0 = s ? msOf(s.core_until) : NaN; const frozen = was && Number.isFinite(until0) && until0 > N; const hit = lastHit.get(pid);
      if (!frozen && hit == null) continue;
      const since = was && S(s.core_since) ? S(s.core_since) : iso(N);
      let until = Number.isFinite(until0) && was ? until0 : msOf(since) + FREEZE;
      let reason = was ? 'frozen until ' + dayOf(until) + ' (8 weeks from ' + since.slice(0, 10) + ')' : 'named or cited you on ' + dayOf(hit) + ': in the core, never retired while it does';
      if (hit != null && N + FREEZE > until) { until = N + FREEZE; reason = 'named or cited you on ' + dayOf(hit) + ': kept 56 more days, never retired while it does'; extend.push({ prompt_id: pid, core_until: iso(until), reason }); }
      if (!isActive(p)) reason += '; not asked now (' + lc(p.status) + ')';
      push(p, since, iso(until), reason); }
    // 3. fill up to core_max with active questions of the site's market: pinned first, then demand, then the oldest
    const fresh = P.filter(p => !brand(p) && !inCore.has(S(p.prompt_id)) && isActive(p) && marketOk(p))
      .sort((a, b) => (flag(b.pinned) - flag(a.pinned)) || (volOf(b) - volOf(a)) || S(a.created_at).localeCompare(S(b.created_at)) || S(a.prompt_id).localeCompare(S(b.prompt_id)));
    const join = (p, outside) => { const s = ST.get(S(p.prompt_id)); const was = s && flag(s.core);
      const since = was && S(s.core_since) ? S(s.core_since) : iso(N); const until = N + FREEZE;
      const where = outside ? 'outside your market (' + marketCc(p.market) + ', yours is ' + siteCc + '): measured because too few questions of your market are asked' : 'in your market (' + (siteCc || 'any') + ')';
      const reason = was ? 'renewed: still asked, ' + where : 'new: asked, ' + where + (volOf(p) > 0 ? ', demand ' + volOf(p) : '');
      if (was) extend.push({ prompt_id: S(p.prompt_id), core_until: iso(until), reason });
      push(p, since, iso(until), reason); };
    for (const p of fresh) { if (core.length >= coreMax) break; join(p, false); }
    // too few questions of the site's market are being asked (a panel that drifted to another country, R4 cause 3): the questions that ARE
    // asked join, up to core_min, labelled; progress can only be measured on questions somebody asks. Off with cfg.core_min = 0.
    const coreMin = Math.min(coreMax, num(C.core_min, 12));
    if (core.length < coreMin) for (const p of P.filter(q => !brand(q) && !inCore.has(S(q.prompt_id)) && isActive(q) && !marketOk(q))
      .sort((a, b) => (flag(b.pinned) - flag(a.pinned)) || (volOf(b) - volOf(a)) || S(a.created_at).localeCompare(S(b.created_at)) || S(a.prompt_id).localeCompare(S(b.prompt_id)))) { if (core.length >= coreMin) break; join(p, true); }
    // 4. questions to propose (never activated here): the caller's candidates from client keywords, Search Console question queries, LLM Mentions
    const cands = Array.isArray(demand && demand.candidates) ? demand.candidates : Array.isArray(C.candidates) ? C.candidates : [];
    const proposed = []; const room = Math.max(0, Math.min(num(C.propose_max, 5), coreMax - core.length)); const taken = new Set();
    // first: questions of the site's market that were retired and are no longer asked (bring them back; `revive` names the stored row, additive)
    const inMarketAsked = core.filter(c => marketOk(P.find(p => S(p.prompt_id) === c.prompt_id) || {}) && isActive(P.find(p => S(p.prompt_id) === c.prompt_id) || {})).length;
    if (siteCc && inMarketAsked < coreMin) for (const p of P.filter(q => !brand(q) && !isActive(q) && marketOk(q) && S(q.market) && !/^(refused|deleted)$/i.test(S(q.status)))
      .sort((a, b) => (volOf(b) - volOf(a)) || S(a.prompt_id).localeCompare(S(b.prompt_id)))) { if (proposed.length >= room) break; const kw = normKw(p.keyword || p.prompt); if (taken.has(kw)) continue; taken.add(kw);
      proposed.push({ prompt: S(p.prompt), keyword: normKw(p.keyword), market: siteCc + '-' + lang, intent: intentOf(p, []), source: 'retired_in_market', revive: S(p.prompt_id),
        reason: 'a question of your market (' + siteCc + ') that is no longer asked (' + lc(p.status) + '): ask it again so progress in your market can be measured' }); }
    const covered = (kw) => P.some(p => cover(kw, S(p.keyword) + ' ' + S(p.prompt)) >= 0.6 || (S(p.keyword) && cover(S(p.keyword), kw) >= 0.8));
    for (const c of cands.slice().sort((a, b) => num(b && b.volume, 0) - num(a && a.volume, 0))) { if (proposed.length >= room) break;
      const kw = normKw(c && (c.keyword || c.query)); if (!kw || taken.has(kw)) continue;
      const cm = S(c.market) ? marketCc(c.market) : ''; const kwCcs = placesIn(kw, siteCc);
      if (siteCc && ((cm && cm !== siteCc) || (kwCcs.length && !kwCcs.includes(siteCc)))) continue;
      if (covered(kw)) continue; taken.add(kw);
      const q = S(c.question) || (INFO_Q.test(kw) ? kw.charAt(0).toUpperCase() + kw.slice(1) + '?' : 'Which companies are best for ' + kw + '?');
      proposed.push({ prompt: q, keyword: kw, market: siteCc ? siteCc + '-' + lang : S(c.market), intent: intentOf({ prompt: q, kind: c.kind }, []), source: S(c.source) || 'keyword',
        reason: 'no question on the panel covers "' + kw + '"' + (num(c.volume, 0) > 0 ? ' (demand ' + num(c.volume, 0) + ')' : '') }); }
    // A4: progress is read only on the core present in both periods
    const prev = new Set([...ST.values()].filter(r => flag(r.core)).map(r => S(r.prompt_id))); const nowSet = new Set(core.map(c => c.prompt_id));
    const added = [...nowSet].filter(x => !prev.has(x)), dropped = [...prev].filter(x => !nowSet.has(x));
    const comparable = prev.size > 0 && !added.length && !dropped.length;
    const why = !prev.size ? 'first reading: no core stored yet, nothing to compare with' : comparable ? 'core unchanged (' + nowSet.size + ' questions): progress is comparable'
      : 'core changed (' + added.length + ' added, ' + dropped.length + ' left): progress is read only on the ' + [...nowSet].filter(x => prev.has(x)).length + ' questions present in both periods';
    return { core, proposed, extend, comparable, why };
  };

  // ---- A6: treatment and control arms (seeded, never reshuffled; FX-A RA-2: a control floor kept every week, rotation one at a time) ---------
  // Each stratum's share of the control target floor(N / 3): floor(n / 3), the remainder to the strata with the largest fraction (a stratum of 5
  // holds 1 or 2, so 30 questions in 6 strata of 5 hold 10, not 6). A control rotates after `holdout_days` only when a replacement in its stratum
  // takes its place in the same run (a treated question no step worked on: not in `exposed`), one per stratum per run (so a first core's controls,
  // all due the same week, rotate over several weeks), and never while it is a registered control of an open action (`locked`). A stratum under its
  // target is refilled from its treated questions no step worked on. `exposed` / `locked`: prompt ids (Set or array; additive inputs, FX-A).
  // `assigned_at` is when the question took its arm (stored as seo_ai_rank_questions.arm_since); a row without it falls back to core_since.
  const assignArms = ({ core, stored, seed, now, site_id, holdout_days, exposed, locked } = {}) => {
    const N = msOf(now); const HOLD = num(holdout_days, 84) * DAY; const iso = isoOf(N);
    const C = (Array.isArray(core) ? core : []).filter(c => c && S(c.prompt_id));
    const ST = new Map((Array.isArray(stored) ? stored : []).filter(r => r && S(r.prompt_id)).map(r => [S(r.prompt_id), r]));
    const EX = new Set([...(exposed || [])].map(S)), LK = new Set([...(locked || [])].map(S));
    const clusterCount = new Map(); for (const c of C) { const k = lc(c.cluster) || 'other'; clusterCount.set(k, (clusterCount.get(k) || 0) + 1); }
    const top = new Set([...clusterCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(x => x[0]));
    // a stratum needs at least 3 questions to hold a control (T, T, C): smaller ones are merged into a coarser stratum, dropping the cluster
    // first, then the baseline, then the intent (a real panel of 13 questions over 10 fine strata held no control at all)
    const MIN_S = 3; const levels = [(c) => [lc(c.intent) || 'unknown', lc(c.baseline) === 'some' ? 'some' : 'zero', top.has(lc(c.cluster) || 'other') ? (lc(c.cluster) || 'other') : 'other'],
      (c) => [lc(c.intent) || 'unknown', lc(c.baseline) === 'some' ? 'some' : 'zero', '*'], (c) => [lc(c.intent) || 'unknown', '*', '*'], () => ['*', '*', '*']];
    const fine = new Map(); { let pending = C.slice(); for (let L = 0; L < levels.length; L++) { const g = new Map(); for (const c of pending) { const k = levels[L](c).join('|'); const a = g.get(k) || []; a.push(c); g.set(k, a); }
      const next = []; for (const [k, a] of g) { if (a.length >= MIN_S || L === levels.length - 1) for (const c of a) fine.set(S(c.prompt_id), k); else next.push(...a); } pending = next; if (!pending.length) break; } }
    const stratumOf = (c) => fine.get(S(c.prompt_id)) || levels[0](c).join('|');
    const out = new Map(); const fresh = []; const known = new Set();
    for (const c of C) { const pid = S(c.prompt_id); const s = ST.get(pid); const arm = s && AIRF.ARMS.includes(lc(s.arm)) ? lc(s.arm) : '';
      if (!arm) { fresh.push(c); continue; }
      const stratum = S(s.stratum) || stratumOf(c); known.add(stratum);
      out.set(pid, { prompt_id: pid, arm, stratum, assigned_at: S(s.assigned_at || s.arm_since || s.core_since) || iso, _new: false }); }
    const key = (c) => AIRF.hash(S(site_id) + '|' + S(c.prompt_id) + '|' + S(seed));
    fresh.sort((a, b) => key(a) - key(b) || S(a.prompt_id).localeCompare(S(b.prompt_id)));
    // a new question joins its stored stratum: the computed one when it already holds stored questions, else the finest level that does
    const placeOf = (c) => { const k = stratumOf(c); if (known.has(k)) return k; for (const L of levels) { const k2 = L(c).join('|'); if (known.has(k2)) return k2; } return k; };
    for (const c of fresh) out.set(S(c.prompt_id), { prompt_id: S(c.prompt_id), arm: 'treated', stratum: placeOf(c), assigned_at: iso, _new: true });
    // the control target per stratum
    const members = new Map(); for (const a of out.values()) { const l = members.get(a.stratum) || []; l.push(a); members.set(a.stratum, l); }
    const total = Math.floor(out.size / 3); const target = new Map(); let sum = 0;
    for (const [k, l] of members) { const b = l.length >= MIN_S ? Math.floor(l.length / 3) : 0; target.set(k, b); sum += b; }
    const order = [...members.entries()].filter(([, l]) => l.length >= MIN_S && l.length % 3).sort((a, b) => (b[1].length % 3) - (a[1].length % 3) || b[1].length - a[1].length || a[0].localeCompare(b[0]));
    for (const [k] of order) { if (sum >= total) break; target.set(k, target.get(k) + 1); sum++; }
    const ctl = (k) => (members.get(k) || []).filter(a => a.arm === 'control');
    // a replacement: a treated question of the stratum no step worked on; a new one first (never treated), then the one treated longest, then the seed order
    const ageMs = (a) => { const t = msOf(a.assigned_at); return Number.isFinite(t) && Number.isFinite(N) ? N - t : 0; };
    const pick = (k, not) => (members.get(k) || []).filter(a => a.arm === 'treated' && !EX.has(a.prompt_id) && !(not && not.has(a.prompt_id)))
      .sort((a, b) => (b._new - a._new) || (ageMs(b) - ageMs(a)) || (key(a) - key(b)) || a.prompt_id.localeCompare(b.prompt_id))[0] || null;
    const set = (a, arm) => { a.arm = arm; a.assigned_at = iso; };
    for (const k of [...members.keys()].sort()) {
      // 1. the new questions and the refill: up to the target
      const swapped = new Set(); while (ctl(k).length < target.get(k)) { const r = pick(k); if (!r) break; set(r, 'control'); swapped.add(r.prompt_id); }
      // 2. the holdout rotates: the oldest control past its 12 weeks (not locked) gives its place to a replacement, one per stratum per run
      const due = ctl(k).filter(a => !swapped.has(a.prompt_id) && !LK.has(a.prompt_id) && HOLD > 0 && ageMs(a) >= HOLD).sort((a, b) => (ageMs(b) - ageMs(a)) || a.prompt_id.localeCompare(b.prompt_id))[0];
      if (due) { const r = pick(k, swapped); if (r) { set(due, 'treated'); set(r, 'control'); } } }
    return C.map(c => { const a = out.get(S(c.prompt_id)); return { prompt_id: a.prompt_id, arm: a.arm, stratum: a.stratum, assigned_at: a.assigned_at }; });
  };

  // ---- A7: minimum detectable effect + the first-appearance requirement -------------------------------------------------------------
  // inverse standard normal (Acklam), accurate to ~1e-9 over (0, 1)
  const qnorm = (p) => { const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239],
      b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572], c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783],
      d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]; const pl = 0.02425;
    if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    const q = p - 0.5, r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); };
  // P(all k first appearances fall on treated questions | none on control) = C(Q_t, k) / C(Q_t + Q_c, k)
  const allTreatedP = (qt, qc, k) => { let p = 1; for (let i = 0; i < k; i++) p *= (qt - i) / (qt + qc - i); return p; };
  const mde = ({ q_t, q_c, m, p, rho, alpha = 0.05, power = 0.8 } = {}) => {
    const Qt = Math.max(0, Math.floor(num(q_t, 0))), Qc = Math.max(0, Math.floor(num(q_c, 0))), M = Math.max(1, num(m, 28)), R = Math.min(1, Math.max(0, num(rho, 0.3)));
    const A = Math.min(0.5, Math.max(1e-6, num(alpha, 0.05))), PW = Math.min(0.999, Math.max(0.5, num(power, 0.8)));
    const z = qnorm(1 - A / 2) + qnorm(PW); const pIn = num(p, null); const pu = Math.max(pIn == null ? 0 : pIn, 0.02);
    const neff = (Q) => (Q > 0 ? Q * M / (1 + (M - 1) * R) : 0); const nt = neff(Qt), nc = neff(Qc); const v = pu * (1 - pu);
    const prepost = nt > 0 ? r1(100 * z * Math.sqrt(2 * v / nt)) : null;
    const did = nt > 0 && nc > 0 ? r1(100 * z * Math.sqrt(2 * v * (1 / nt + 1 / nc))) : null;
    // FX-A RA-12: the first-appearance test is judged one-sided at alpha / 2 (0.025), the same alpha as the DiD's two-sided 95% range
    const A1 = A / 2; let k = null, kp = null; if (Qt > 0 && Qc > 0) for (let j = 1; j <= Qt; j++) { const pj = allTreatedP(Qt, Qc, j); if (pj < A1) { k = j; kp = r4(pj); break; } }
    const basis = 'percentage points at ' + Math.round(PW * 100) + '% power, alpha ' + A + ' two-sided; n_eff = Q x m / (1 + (m - 1) x rho) with m ' + M + ', rho ' + R
      + (pIn == null ? ', baseline unknown: 2% used' : pIn < 0.02 ? ', baseline ' + r1(100 * pIn) + '%: 2% used for planning' : ', baseline ' + r1(100 * pu) + '%')
      + (k != null ? '; first appearances: ' + k + ' on treated questions and none on control give one-sided p ' + kp + ' (below ' + A1 + ')' : Qt > 0 && Qc > 0 ? '; no number of first appearances reaches one-sided p < ' + A1 + ' with ' + Qt + ' treated and ' + Qc + ' control questions' : '; no control questions: no first-appearance test');
    return { prepost, did, n_eff_t: r1(nt), n_eff_c: r1(nc), p_used: r4(pu), first_appearance_k: k, first_appearance_p: kp, basis };   // first_appearance_p: additive
  };

  // ---- 2.C: page classification ---------------------------------------------------------------------------------------------------------
  const H_ENC = /(^|\.)(wikipedia\.org|wikidata\.org|wikimedia\.org|britannica\.com)$/;
  const H_VIDEO = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|dailymotion\.com|wistia\.com)$/;
  const H_COMM = /(^|\.)(reddit\.com|quora\.com|stackexchange\.com|stackoverflow\.com|news\.ycombinator\.com|discord\.com|spiceworks\.com|indiehackers\.com)$|^(community|communities|forum|forums|discuss|discussion|discourse|answers)\./;
  const P_COMM = /\/(forums?|community|communities|threads?|discussions?|topic|questions)\/|\/t\/[^\/]+\/\d+/;
  const H_REVIEW = /(^|\.)(g2\.com|capterra\.[a-z.]+|trustpilot\.com|trustradius\.com|softwareadvice\.com|getapp\.com|sourceforge\.net|softwaresuggest\.com|saasworthy\.com|peerspot\.com|featuredcustomers\.com|yelp\.[a-z.]+|crozdesk\.com|financesonline\.com|slashdot\.org)$/;
  const H_DIR = /(^|\.)(clutch\.co|goodfirms\.co|themanifest\.com|designrush\.com|sortlist\.[a-z.]+|upcity\.com|topdevelopers\.co|appfutura\.com|techbehemoths\.com|selectedfirms\.co|itfirms\.co|softwareworld\.co|topsoftwarecompanies\.co|crunchbase\.com|yellowpages\.[a-z.]+|yellowpages-uae\.com|yell\.com|hotfrog\.[a-z.]+|kompass\.com|europages\.[a-z.]+|cylex\.[a-z.]+|brownbook\.net|f6s\.com|producthunt\.com|bark\.com|dnb\.com|zoominfo\.com|appsource\.microsoft\.com|partner\.microsoft\.com|solutionpartners\.microsoft\.com|appexchange\.salesforce\.com|partners\.salesforce\.com|partners\.odoo\.com|businesslist\.[a-z.]+|2gis\.[a-z.]+|connect\.ae|dubaidirectory\.[a-z.]+)$/;
  const H_GOV = /(^|\.)(gov|gob|gouv|govt|government|mil)(\.[a-z]{2,12})?$|(^|\.)u\.ae$|(^|\.)europa\.eu$|(^|\.)(un|who|oecd|worldbank|imf|wto)\.org$|\.int$/;
  const H_BODY = /(chamber|association|council|federation|institute|society|authority|peppol|alliance|consortium|guild|board)/;
  const P_REG = /\b(accredit\w*|registered|approved|certified|licen[cs]ed|authori[sz]ed|registry|register|members?(hip)?[\s-]+(directory|list)|member[\s-]+directory|providers?[\s-]+list|list[\s-]+of[\s-]+(accredit|approv|regist|certif|licen|member|provider))/;
  const H_SOCIAL = /(^|\.)(linkedin\.com|facebook\.com|x\.com|twitter\.com|instagram\.com|threads\.net|pinterest\.com|medium\.com|substack\.com|dev\.to|hashnode\.dev|blogspot\.com|wordpress\.com|tumblr\.com)$/;
  const H_BLOGPLAT = /(^|\.)(medium\.com|substack\.com|dev\.to|hashnode\.dev|blogspot\.com|wordpress\.com|tumblr\.com)$/;
  const H_NEWS = /(^|\.)(reuters\.com|bloomberg\.com|forbes\.com|cnbc\.com|bbc\.co\.uk|bbc\.com|ft\.com|wsj\.com|nytimes\.com|theguardian\.com|gulfnews\.com|khaleejtimes\.com|thenationalnews\.com|zawya\.com|arabianbusiness\.com|gulfbusiness\.com|arabnews\.com|saudigazette\.com\.sa|dawn\.com|techcrunch\.com|theverge\.com|businessinsider\.com|economictimes\.indiatimes\.com|livemint\.com|prnewswire\.com|businesswire\.com|globenewswire\.com|einpresswire\.com|menafn\.com|accesswire\.com|newswire\.com|wamda\.com|magnitt\.com)$/;
  const H_NEWSY = /(^|[.-])(news|times|daily|gazette|herald|journal|tribune|magazine|mag)([.-]|$)/;
  const P_NEWS = /\/(news|press|press-releases?|newsroom|media-centre|media-center)(\/|$)|\/(19|20)\d\d\/\d{1,2}\//;
  const LISTY = /\b(best(?![\s-]+(practice|way|time|guide|approach|option for you))|top[\s-]?\d+|\d+[\s-]+(best|top|leading|great)|top[\s-]+(rated|ranked|companies|firms|agencies|providers|vendors|partners|developers|consultants|software|apps|tools|platforms|erp|ai|crm|picks|choices|list)|leading[\s-]+(\w+[\s-]+){0,2}(companies|firms|providers|agencies|partners|vendors|developers|consultants)|(companies|firms|providers|agencies|partners|vendors|developers|consultants|houses)[\s-]+in[\s-]+\w+|list[\s-]+of|alternatives?[\s-]+to|\w+[\s-]+alternatives|vs\.?|versus|compared|comparison|ranked|shortlist)\b/;
  const P_DIR = /\/(companies|agencies|developers|directory|vendors|firms|service-providers|providers|listings?|partners-directory|find-a-partner|partner-finder)(\/|$)(?!docs|api|documentation|reference)/;
  const P_VENDOR = /\/(services?|solutions?|products?|pricing|plans|about(-us)?|contact(-us)?|industries|case-stud(y|ies)|portfolio|platform|features|company|team|careers|customers|integrations?|docs|documentation|support|help|downloads?)(\/|$|-)/;
  const P_ARTICLE = /\/(blog|blogs|insights?|resources?|guides?|articles?|learn|knowledge|academy|library|posts?|whitepapers?|ebooks?)(\/|$)/;
  const rivalSet = (rivals) => { const hosts = new Set(), names = new Set();
    for (const r of (Array.isArray(rivals) ? rivals : S(rivals).split(','))) { if (!r) continue;
      const cand = typeof r === 'string' ? [r] : [r.host, r.domain, r.id, ...(Array.isArray(r.domains) ? r.domains : [])];
      for (const c of cand) { const h = hostOf(c); if (h && /\./.test(h)) hosts.add(h); else if (compact(c).length >= 5) names.add(compact(c)); }
      if (typeof r === 'object' && compact(r.name).length >= 5) names.add(compact(r.name)); }
    return { hosts: [...hosts], names: [...names] }; };
  const isRival = (host, path, RS) => { if (hostIn(host, RS.hosts)) return true; if (!RS.names.length) return false;
    const label = compact(host.split('.').slice(0, -1).join('.')); const segs = lc(path).split('/').map(compact).filter(Boolean);
    return RS.names.some(n => label === n || label.endsWith(n) || (H_SOCIAL.test(host) && segs.slice(0, 2).some(s => s === n || s === '@' + n || s.replace(/^@/, '') === n))); };
  const PLATFORM_TYPES = new Set(['directory', 'review', 'registry', 'community', 'encyclopedia', 'video', 'social']);
  const CLS = new Map();
  const classifyPage = ({ url, title, host, rivals, ourHosts } = {}) => {
    const u = S(url); const h = hostOf(host) || hostOf(u); const RS = rivals && rivals.hosts && rivals.names ? rivals : rivalSet(rivals); const OH = ourList(null, ourHosts);
    const ck = u + '|' + lc(title).slice(0, 120) + '|' + h + '|' + RS.hosts.join(',') + '|' + RS.names.join(',') + '|' + OH.join(',');
    if (CLS.has(ck)) return CLS.get(ck);
    const res = (() => {
      if (!h || (u && !isHttp(u) && !host)) return { page_type: 'unknown', author_kind: 'unknown', why: 'not a web address' };
      if (hostIn(h, OH)) return { page_type: 'client', author_kind: 'client', why: 'your own site (' + h + ')' };
      const path = lc(pathOf(u) || '/'); const text = lc(S(title)) + ' ' + path.replace(/[-_\/.]+/g, ' ');
      const rival = isRival(h, path, RS);
      const kind = (pt, why) => ({ page_type: pt, author_kind: rival && !PLATFORM_TYPES.has(pt) ? 'rival' : rival && (pt === 'social' || pt === 'video') ? 'rival' : PLATFORM_TYPES.has(pt) ? 'platform' : 'editorial', why: why + (rival ? '; written by a rival' : '') });
      if (H_ENC.test(h)) return kind('encyclopedia', 'encyclopedia host');
      if (H_VIDEO.test(h)) return kind('video', 'video host');
      if (H_COMM.test(h) || (P_COMM.test(path) && /(^|\.)(forum|community|discuss)/.test(h))) return kind('community', 'forum or community');
      if (H_REVIEW.test(h)) return kind('review', 'review platform');
      if (H_DIR.test(h)) return kind('directory', 'service directory');
      if (H_GOV.test(h)) return P_REG.test(text) ? kind('registry', 'an official list of accredited or registered providers') : kind('official', 'government or international body');
      if (H_BODY.test(h) && (P_REG.test(text) || /\/(members|directory|member-directory)(\/|$)/.test(path))) return kind('registry', 'an industry body\'s list of members or accredited providers');
      if (H_SOCIAL.test(h)) { if ((H_BLOGPLAT.test(h) || /^\/pulse\//.test(path)) && LISTY.test(text)) return kind('listicle', 'a list on a blogging platform'); return kind('social', 'social or blogging platform'); }
      if (P_DIR.test(path) && !rival && !LISTY.test(lc(S(title)))) return kind('directory', 'a directory path (' + (path.match(P_DIR) || [''])[0] + ')');
      if (LISTY.test(text)) return kind('listicle', 'a list or comparison (title or address)');
      if (H_NEWS.test(h) || P_NEWS.test(path) || H_NEWSY.test(h)) return kind('news', 'news or press');
      if (rival) return kind('vendor_page', 'a rival business\'s own page');
      if (path === '/' || P_VENDOR.test(path)) return kind('vendor_page', 'a business page that is not a list');
      if (P_ARTICLE.test(path)) return kind('vendor_page', 'a business\'s own article, not a list');
      return kind('unknown', 'no rule matched the host, address or title'); })();
    if (CLS.size > 5000) CLS.clear(); CLS.set(ck, res); return res; };

  // ---- evidence kept across weeks (seo_ai_rank_questions.evidence_json) ------------------------------------------------------------------
  // { v: 1, p: prompt_id, at, fn / ln / lc: first named, last named, last cited (ISO), s: { answer key: day number } (answers already counted),
  //   c: { 'YYYY-MM-DD|engine' (days up to 28 old) or 'wYYYY-MM-DD|engine' (weeks, 29-120 days): [n, named, cited, retrieved, has_retrieved_reading,
  //   parametric, cites, list_cites, negative, wrong, names_business] }, f: { query: [n, 'engine,engine', 'YYYY-MM-DD'] } }
  const NC = 11; const CAP = 8000;
  const listType = (pt) => pt === 'listicle' || pt === 'directory';
  const AFM = new WeakMap();
  const answerFacts = (row, OH) => { const ok = (OH || []).join(','); const m = AFM.get(row); if (m && m.ok === ok) return m.F; const F = answerFacts0(row, OH); AFM.set(row, { ok, F }); return F; };
  // the page type of a cited third-party page for the list count (no rival or client context needed: listicle / directory do not depend on it)
  const TOC = new Map();
  const typeOfCite = (c) => { const u = S(c.url) || ('https://' + S(c.host) + '/'); const k = u + '|' + lc(c.title); let t = TOC.get(k); if (t === undefined) { t = classifyPage({ url: u, title: c.title, rivals: [], ourHosts: [] }).page_type; if (TOC.size > 20000) TOC.clear(); TOC.set(k, t); } return t; };
  const answerFacts0 = (row, OH) => { const own = ourList({ domain: row.domain }, OH);
    const cited = J(row.cited_json, null); const cl = Array.isArray(cited) ? cited.filter(c => c && (c.url || c.host)) : (J(row.cited_urls, []) || []).filter(c => c && c.u).map(c => ({ url: c.u, title: c.t }));
    const isOurs = (c) => c.role === 'self' || hostIn(c.host || c.url, own);
    const ourCited = cl.some(isOurs) || flag(row.cited) || !!S(row.our_urls);
    const rt = S(row.retrieved_json); const rl = J(rt, null); const hasR = Array.isArray(rl);
    const ourRetr = ourCited || (hasR && rl.some(x => x && hostIn(x.host || x.url, own)));
    const fz = J(row.fanout_json, null); const fan = (Array.isArray(fz) ? fz : S(row.fanout) ? S(row.fanout).split(' | ') : []).map(normKw).filter(Boolean);
    const ents = J(row.entities_json, null);
    const named = flag(row.named) || (Array.isArray(ents) && ents.some(x => x && x.role === 'self' && x.position != null));
    const biz = named || (Array.isArray(ents) ? ents.some(x => x && (x.role === 'competitor' || (x.role === 'self' && x.position != null))) : !!S(row.competitors));
    const list = cl.filter(c => !isOurs(c) && listType(typeOfCite(c))).length;
    return { named, cited: ourCited, retrieved: ourRetr, hasR, param: cl.length === 0 && fan.length === 0, cites: cl.length, list, neg: named && lc(row.sentiment) === 'negative', wrong: !!S(row.issues), biz, fan: [...new Set(fan)].slice(0, 12), cl, own }; };
  const weekKey = (ms) => { const d = new Date(ms); const dow = (d.getUTCDay() + 6) % 7; return 'w' + dayOf(ms - dow * DAY); };
  const bucketMs = (k) => msOf(S(k).replace(/^w/, '').slice(0, 10) + 'T00:00:00Z');
  const rollObj = (stored, rows, N, pid, OH) => {
    const S0 = J(stored, null); const E0 = S0 && typeof S0 === 'object' && !Array.isArray(S0) ? S0 : {};
    const E = { v: 1, p: S(E0.p) || S(pid), at: S(E0.at), fn: S(E0.fn), ln: S(E0.ln), lc: S(E0.lc), s: { ...(E0.s && typeof E0.s === 'object' ? E0.s : {}) }, c: {}, f: {} };
    for (const [k, v] of Object.entries(E0.c && typeof E0.c === 'object' ? E0.c : {})) if (Array.isArray(v)) E.c[k] = v.slice(0, NC).concat(new Array(Math.max(0, NC - v.length)).fill(0)).map(x => num(x, 0));
    for (const [k, v] of Object.entries(E0.f && typeof E0.f === 'object' ? E0.f : {})) if (Array.isArray(v)) E.f[k] = [num(v[0], 0), S(v[1]), S(v[2])];
    let p = S(pid) || E.p;
    for (const row of (Array.isArray(rows) ? rows : [])) { if (!answered(row)) continue; if (!p && S(row.prompt_id)) { p = S(row.prompt_id); E.p = p; } if (p && S(row.prompt_id) && S(row.prompt_id) !== p) continue;
      const t = msOf(row.checked_at); if (!Number.isFinite(t)) continue; const e = engOf(row.engine);
      const key = hex8(S(row.run_id) + '|' + e + '|' + S(row.checked_at) + '|' + S(row.prompt_id)); if (E.s[key] != null) continue; E.s[key] = Math.floor(t / DAY);
      const F = answerFacts(row, OH); const at = isoOf(t); const dy = at.slice(0, 10); const bk = dy + '|' + e; const cell = E.c[bk] || new Array(NC).fill(0);
      const add = [1, F.named, F.cited, F.retrieved, F.hasR, F.param, F.cites, F.list, F.neg, F.wrong, F.biz]; for (let i = 0; i < NC; i++) cell[i] += add[i] ? Number(add[i]) : 0; E.c[bk] = cell;
      for (const q of F.fan) { const f = E.f[q] || [0, '', '']; f[0]++; const es = new Set(f[1] ? f[1].split(',') : []); es.add(e); f[1] = [...es].sort().join(','); if (dy > f[2]) f[2] = dy; E.f[q] = f; }
      if (F.named) { if (!E.fn || at < E.fn) E.fn = at; if (!E.ln || at > E.ln) E.ln = at; } if (F.cited && (!E.lc || at > E.lc)) E.lc = at; }
    if (Number.isFinite(N)) { E.at = isoOf(N);
      for (const [k, d] of Object.entries(E.s)) if (num(d, 0) < Math.floor(N / DAY) - 21) delete E.s[k];
      const merged = {}; for (const [k, v] of Object.entries(E.c)) { const [b, e] = k.split('|'); const t = bucketMs(b); if (!Number.isFinite(t) || N - t > 120 * DAY) continue;
        const nk = (b.charAt(0) !== 'w' && N - t > 28 * DAY ? weekKey(t) : b) + '|' + e; const cur = merged[nk] || new Array(NC).fill(0); for (let i = 0; i < NC; i++) cur[i] += v[i]; merged[nk] = cur; }
      E.c = merged;
      for (const [q, f] of Object.entries(E.f)) { const t = msOf(f[2] + 'T00:00:00Z'); if (Number.isFinite(t) && N - t > 120 * DAY) delete E.f[q]; } }
    return E; };
  const fit = (E) => { let s = JSON.stringify(E); if (s.length <= CAP) return s;
    const fq = Object.entries(E.f).sort((a, b) => b[1][0] - a[1][0] || b[1][2].localeCompare(a[1][2])); if (fq.length > 30) { E.f = {}; for (const [q, v] of fq.slice(0, 30)) E.f[q] = v; s = JSON.stringify(E); }
    const ck = Object.keys(E.c).sort((a, b) => bucketMs(a.split('|')[0]) - bucketMs(b.split('|')[0]));
    while (s.length > CAP && ck.length > 0) { delete E.c[ck.shift()]; s = JSON.stringify(E); }
    const fk = Object.entries(E.f).sort((a, b) => a[1][0] - b[1][0]).map(x => x[0]); while (s.length > CAP && fk.length) { delete E.f[fk.shift()]; s = JSON.stringify(E); }
    if (s.length > CAP) { E.s = {}; s = JSON.stringify(E); }
    return s.length > CAP ? JSON.stringify({ v: 1, p: E.p, at: E.at, fn: E.fn, ln: E.ln, lc: E.lc, s: {}, c: {}, f: {} }) : s; };
  const rollEvidence = ({ stored, answers8, now, prompt_id, ourHosts } = {}) => {
    const rows = Array.isArray(answers8) ? answers8 : [];
    if (!S(stored) && !rows.some(answered)) return typeof stored === 'string' ? stored : '';
    return fit(rollObj(stored, rows, msOf(now), prompt_id, ourList(null, ourHosts))); };

  // ---- 2.B: fan-out queries per question ----------------------------------------------------------------------------------------------
  const fanFromE = (E) => Object.entries(E.f).map(([query, f]) => ({ query, n: f[0], engines: f[1] ? f[1].split(',').filter(Boolean) : [] }))
    .sort((a, b) => b.n - a.n || a.query.localeCompare(b.query));
  const fanoutOf = ({ prompt_id, answers8, evidence, now } = {}) => fanFromE(rollObj(evidence, (Array.isArray(answers8) ? answers8 : []).filter(a => a && (!S(prompt_id) || S(a.prompt_id) === S(prompt_id))), msOf(now), prompt_id, []));

  // ---- 2.B: the stage per question x engine -------------------------------------------------------------------------------------------
  const BOTS_OF = { chatgpt: ['OAI-SearchBot'], chatgpt_api: ['OAI-SearchBot'], perplexity: ['PerplexityBot'], claude: ['Claude-SearchBot'],
    ai_overview: ['Googlebot'], ai_mode: ['Googlebot'], gemini: ['Googlebot', 'Google-Extended'], copilot: ['Bingbot'] };
  const INDEX_OF = { chatgpt: 'chatgpt', chatgpt_api: 'none', ai_overview: 'google', ai_mode: 'google', gemini: 'google', perplexity: 'google', copilot: 'bing', claude: 'brave' };
  const JS_BLIND = new Set(['chatgpt', 'chatgpt_api', 'perplexity', 'claude']);   // fetchers that read raw HTML (Google and Bing render)
  const W_ENGINE = { chatgpt: 0.30, ai_overview: 0.15, ai_mode: 0.15, gemini: 0.10, perplexity: 0.12, copilot: 0.10, claude: 0.08, chatgpt_api: 0.05 };
  const ORDER = { unmeasured: -1, S0: 0, S1: 1, S2: 2, S3: 3, S4: 4, S5: 5 };
  const NOT_INDEXED = /^(not_indexed|excluded)$/; const INDEXED = /^(indexed)$/;
  const robotsVerdict = (access, bot) => { const R = (access && access.robots) || {}; const k = Object.keys(R).find(x => lc(x) === lc(bot)); if (!k) return null; const v = R[k] || {};
    const a = v.allowed_root != null ? v.allowed_root : v.allowed; return a === false || /^false$/i.test(S(a)) ? { ok: false, rule: S(v.rule || v.root_rule) } : a === true || /^true$/i.test(S(a)) ? { ok: true, rule: S(v.rule) } : null; };
  const jsOnly = (pg) => { if (!pg) return false; const wr = num(pg.words_raw, null); if (wr == null || wr >= 150) return false;
    const wd = num(pg.words_rendered != null ? pg.words_rendered : pg.rendered_words != null ? pg.rendered_words : pg.words_js, null);
    if (wd != null) return wd >= 3 * Math.max(1, wr); return /javascript|client[\s-]side|without js|rendered by js|js[\s-]only/i.test(S(pg.issues)); };
  // diagnose is called once per question with the same site-wide lists: index them by question once (answered, usable engines only)
  const BYP = new WeakMap();
  const byPrompt = (list) => { if (!Array.isArray(list)) return new Map(); let m = BYP.get(list); if (m && m.n === list.length) return m.map;
    const map = new Map(); for (const a of list) { if (!a || !answered(a)) continue; const k = S(a.prompt_id); const g = map.get(k); if (g) g.push(a); else map.set(k, [a]); } BYP.set(list, { n: list.length, map }); return map; };
  // the engines a site asks at all (latest answer per engine, any question), once per list
  const LBE = new WeakMap();
  const lastByEngine = (list) => { if (!Array.isArray(list)) return new Map(); let m = LBE.get(list); if (m && m.n === list.length) return m.map; const map = new Map();
    for (const a of list) { if (!a || !answered(a)) continue; const e = engOf(a.engine); const t = msOf(a.at || a.checked_at); const c = map.get(e); if (c === undefined || (Number.isFinite(t) && !(t <= c))) map.set(e, Number.isFinite(t) ? t : (c === undefined ? NaN : c)); }
    LBE.set(list, { n: list.length, map }); return map; };
  const diagnose = ({ site, prompt, answers8, units60, evidence, access, pages, index, serp, bingStats, brave, brandKnown, ourHosts, rivals, engines, now, cfg } = {}) => {
    const N = msOf(now); const C = cfg || {}; const p = prompt || {}; const pid = S(p.prompt_id); const st = site || {};
    const OH = ourList(st, ourHosts); const ours = (u) => hostIn(u, OH);
    const rows = byPrompt(answers8).get(pid) || [];
    const E = rollObj(evidence, rows, N, pid, OH);
    const inW = (t, d) => { const x = msOf(t); return !Number.isFinite(N) || !Number.isFinite(x) || (x > N - d * DAY && x <= N + 6 * 3600e3); };
    const U = byPrompt(units60).get(pid) || [];
    const CE = Object.entries(E.c).map(([k, v]) => { const [b, ee] = k.split('|'); const bt = bucketMs(b); return { e: ee, end: b.charAt(0) === 'w' ? bt + 7 * DAY : bt + DAY, v }; });
    const CEM = new Map();
    const cellsE = (e, d) => { const ck = e + '|' + d; if (CEM.has(ck)) return CEM.get(ck); const t = new Array(NC).fill(0); for (const c of CE) { if (c.e !== e) continue;
      if (Number.isFinite(N) && c.end <= N - d * DAY) continue; for (let i = 0; i < NC; i++) t[i] += c.v[i]; } CEM.set(ck, t); return t; };
    const intent = ['recommendation', 'informational', 'brand'].includes(lc(p.intent)) ? lc(p.intent) : intentOf(p, U.filter(u => inW(u.at, 28)).length >= 4 ? U.filter(u => inW(u.at, 28)) : rows);
    // the searches the engines ran for this question, plus its own keyword
    const fan = fanFromE(E); const queries = [...new Set([...fan.map(f => f.query), normKw(p.keyword)].filter(Boolean))].slice(0, 40);
    // the client page AIR maps to the question
    const PG = (Array.isArray(pages) ? pages : []).filter(g => g && ours(g.url));
    const G = index && index.google ? asMap(index.google) : new Map();
    const mapped = (() => {
      const byQ = PG.find(g => S(g.questions).split(/[\s,|]+/).includes(pid)); if (byQ) return { ...byQ, how: 'question' };
      const tu = S(p.page_url || p.target_url); if (tu && ours(tu)) return { ...(PG.find(g => AIRF.urlKey(g.url) === AIRF.urlKey(tu)) || { url: tu }), how: 'target' };
      const cnt = new Map(); for (const r of rows) for (const c of answerFacts(r, OH).cl) { const u = S(c.url); if (u && hostIn(c.host || u, OH)) cnt.set(AIRF.urlKey(u), [(cnt.get(AIRF.urlKey(u)) || [0])[0] + 1, u]); }
      const top = [...cnt.values()].sort((a, b) => b[0] - a[0])[0]; if (top) return { ...(PG.find(g => AIRF.urlKey(g.url) === AIRF.urlKey(top[1])) || { url: top[1] }), how: 'cited' };
      const kw = S(p.keyword) || S(p.prompt); const pool = PG.map(g => ({ g, text: pathOf(g.url) + ' ' + S(g.title) }));
      for (const k of G.keys()) if (hostIn('https://' + k, OH) && !pool.some(x => AIRF.urlKey(x.g.url) === k)) pool.push({ g: { url: 'https://' + k }, text: k.replace(/^[^\/]+/, '') });
      let best = null; for (const x of pool) { if (pathOf(x.g.url) === '/' ) continue; const s = cover(kw, x.text); if (s >= 0.5 && (!best || s > best.s || (s === best.s && pathOf(x.g.url).length < pathOf(best.g.url).length))) best = { s, g: x.g }; }
      return best ? { ...best.g, how: 'words' } : null; })();
    const gState = (u) => { const v = G.get(AIRF.urlKey(u)); return v && typeof v === 'object' ? lc(v.state) : lc(v); };
    const serpM = serp ? asMap(serp) : new Map(); const braveM = brave ? asMap(brave) : index && index.brave ? asMap(index.brave) : null;
    const bingPos = bingStats && bingStats.positions ? asMap(bingStats.positions) : null;
    const gsc = index && index.gsc ? asMap(index.gsc) : null;
    const look = (M, q) => M.get(q) || M.get(normKw(q)) || M.get(normKw(q).replace(/[^a-z0-9\u00c0-\u024f\u0600-\u06ff ]+/g, ' ').replace(/\s+/g, ' ').trim());
    // FX-A RA-13: a Google results page counts only when it was read in the question's market (its market, else the site's): a US page says nothing
    // about a UAE question. An entry may hold one reading per location (`by_loc`, AI_Rank_Plan) or one reading with its `location_code`; a reading
    // with no location recorded is accepted (it cannot be shown to be another market's)
    const wantLoc = (() => { const qcc = S(p.market).split(/[-_]/)[0].toUpperCase(); const l1 = qcc ? LOC.get(qcc) || 0 : 0; if (l1) return l1; const sl = num(st.location_code, 0); return sl > 0 ? sl : (LOC.get(ccOf(st.country)) || 0); })();
    const inMarket = (r) => { if (!r) return null; if (r.by_loc && typeof r.by_loc === 'object') { if (!wantLoc) return r; return r.by_loc[wantLoc] || r.by_loc[String(wantLoc)] || r.by_loc['0'] || null; }
      const rl = num(r.location_code, 0); return !wantLoc || !rl || rl === wantLoc ? r : null; };
    const rankIn = (kind) => { let best = null, read = false, anyOurs = false;
      if (kind === 'google') for (const q of queries) { const r = inMarket(look(serpM, q)); if (!r) continue; read = true; const res = Array.isArray(r.results) ? r.results : Array.isArray(r.items) ? r.items : [];
        for (const x of res) { if (!x) continue; const pos = num(x.pos != null ? x.pos : x.rank_group != null ? x.rank_group : x.rank_absolute, null); if (pos == null || !ours(x.url || x.domain)) continue; anyOurs = true;
          if (!best || pos < best.pos) best = { query: q, pos, index: 'google', read_at: S(r.read_at || r.at || r.datetime) }; break; } }
      else if (kind === 'bing' && bingPos) for (const q of queries) { const v = look(bingPos, q); if (v == null) continue; read = true; const pos = num(v && typeof v === 'object' ? v.pos != null ? v.pos : v.position : v, null);
        if (pos != null && pos > 0) { anyOurs = true; if (!best || pos < best.pos) best = { query: q, pos: r1(pos), index: 'bing', read_at: S(bingStats.read_at) }; } }
      else if (kind === 'brave' && braveM) for (const q of queries) { const r = look(braveM, q); if (!r) continue; read = true; const res = Array.isArray(r) ? r : Array.isArray(r.results) ? r.results : [];
        for (const x of res) { if (!x) continue; const pos = num(x.pos != null ? x.pos : x.position, null); if (pos == null || !ours(x.url)) continue; anyOurs = true; if (!best || pos < best.pos) best = { query: q, pos, index: 'brave', read_at: S(r.read_at) }; break; } }
      return { best, read, anyOurs, top10: !!best && best.pos <= 10 }; };
    const RK = { google: rankIn('google'), bing: rankIn('bing'), brave: rankIn('brave') };
    const thinList = Array.isArray(C.thin_engines) ? C.thin_engines.map(lc) : ['claude'];
    const engs = (Array.isArray(engines) && engines.length ? engines : AIRF.ENGINES).map(engOf).filter(usable);
    const nobodyNamed = (() => { const u28 = U.filter(u => inW(u.at, 28)); if (u28.length >= 4) return u28.filter(namesBusiness).length / u28.length <= 0.2;
      let n = 0, b = 0; for (const e of engs) { const t = cellsE(e, 28); n += t[0]; b += t[10]; } return n >= 4 && b / n <= 0.2; })();
    const byCitation = intent === 'informational' || nobodyNamed;
    const askedBySite = new Set(); for (const L of [units60, answers8]) for (const [e2, t] of lastByEngine(L)) if (!Number.isFinite(N) || !Number.isFinite(t) || (t > N - 56 * DAY && t <= N + 6 * 3600e3)) askedBySite.add(e2);
    // S0 per engine: robots block, a JavaScript-only page for a fetcher that does not render, not in the engine's index. A reading that shows the
    // engine already reads the client (cited, retrieved) beats the page inference, and a ranking in the engine's own index beats Index Coverage;
    // a Google ranking proves nothing about a fetcher that does not render (Perplexity). -> { sub, ev } or null
    const eligibility = (e, cited, retrieved, rk, ix) => {
      const blockBot = (BOTS_OF[e] || []).map(b => [b, robotsVerdict(access, b)]).find(x => x[1] && x[1].ok === false);
      const blockedListed = Array.isArray(access && access.blocked_engines) && access.blocked_engines.map(engOf).includes(e);
      if (blockBot || blockedListed) return { sub: 'blocked', ev: { kind: 'robots', bot: blockBot ? blockBot[0] : (BOTS_OF[e] || [''])[0], rule: blockBot ? blockBot[1].rule : '', at: S(access && access.read_at) } };
      const read = cited > 0 || retrieved > 0; const proof = read || rk.top10 || (ix === 'google' && rk.anyOurs);
      if (!read && JS_BLIND.has(e) && jsOnly(mapped)) return { sub: 'js_only', ev: { kind: 'page', url: S(mapped.url), words_raw: num(mapped.words_raw, 0), what: 'little text without JavaScript', at: S(mapped.checked_at) } };
      if (!proof && ix === 'google' && e !== 'perplexity' && G.size) {
        const gscHit = gsc && queries.some(q => num(look(gsc, q), 0) > 0);
        const siteIdx = [...G.entries()].filter(([k]) => hostIn('https://' + k, OH)); const anyIdx = siteIdx.some(([, v]) => INDEXED.test(v && typeof v === 'object' ? lc(v.state) : lc(v)));
        const ms = mapped ? gState(mapped.url) : ''; const notIdx = mapped ? NOT_INDEXED.test(ms) || (!ms && siteIdx.length > 0 && !anyIdx) : siteIdx.length > 0 && !anyIdx;
        if (!gscHit && notIdx) return { sub: 'not_indexed', ev: { kind: 'index', url: mapped ? S(mapped.url) : '', state: ms || 'no page of the site indexed', what: mapped ? 'the page for this question is not in Google' : 'no page of the site is in Google' } }; }
      if (!proof && ix === 'bing') { const B = (index && index.bing) || {}; const inAcc = B.in_account; const crawled = B.crawled ? asMap(B.crawled) : new Map();
        if (inAcc === false) return { sub: 'not_indexed', ev: { kind: 'bing', what: 'the site is not in the Bing Webmaster account' } };
        if (inAcc === true && mapped && !crawled.has(AIRF.urlKey(mapped.url)) && !S(mapped.bing_crawled_at) && Number.isFinite(msOf(mapped.submitted_at)) && N - msOf(mapped.submitted_at) >= 14 * DAY)
          return { sub: 'not_indexed', ev: { kind: 'bing', url: S(mapped.url), what: 'submitted ' + S(mapped.submitted_at).slice(0, 10) + ', not crawled by Bing 14 days later' } }; }
      return null; };
    const out = {}; const param = {}; const noSearch = [];
    for (const e of [...new Set(engs)]) {
      const any28 = U.some(u => engOf(u.engine) === e && inW(u.at, 28)) || cellsE(e, 28)[0] > 0;
      const thin = thinList.includes(e) || (!any28 && (U.some(u => engOf(u.engine) === e && inW(u.at, 56)) || cellsE(e, 56)[0] > 0));
      const W = thin ? num(C.thin_days, 56) : num(C.window_days, 28); const minN = thin ? num(C.min_n_thin, 2) : num(C.min_n, 4);
      const ue = U.filter(u => engOf(u.engine) === e && inW(u.at, W)); const ce = cellsE(e, W); const useU = ue.length > 0;
      const n = useU ? ue.length : ce[0]; const named = useU ? ue.filter(u => u.named).length : ce[1]; const cited = useU ? ue.filter(u => u.cited).length : ce[2];
      const retrieved = Math.max(ce[3], e === 'chatgpt' ? cited : 0); const hasR = ce[4];
      const positions = (useU ? ue.filter(u => u.named).map(u => num(u.position, null)) : rows.filter(r => engOf(r.engine) === e && answerFacts(r, OH).named).map(r => num(r.position != null ? r.position : r.rank, null))).filter(x => x != null && x > 0);
      const ix = INDEX_OF[e]; const rk = ix === 'google' ? RK.google : ix === 'bing' ? RK.bing : ix === 'brave' ? RK.brave : { best: null, read: false, anyOurs: false, top10: false };
      const ev = [];
      const recent = rows.filter(r => engOf(r.engine) === e).sort((a, b) => S(b.checked_at).localeCompare(S(a.checked_at)));
      // DESIGN 2.B deviation (orchestrator, 2026-11-06, fixes/P1.md): with 0-3 answers, S0 (robots / JavaScript / index presence) and S1 (a rank or
      // fan-out proxy, or ChatGPT's own retrieved set without the client) are still read, marked `provisional`, because their basis is not an
      // answer rate; S2-S5 need n >= 4. Once n >= 4 the ordinary rules decide (agreeing or not) and the cell is no longer provisional.
      const low = n < minN; let prov = false;
      const cell = (stage, sub, basis) => ({ stage, sub, basis, n, named, cited, retrieved, our_rank: rk.best, evidence: ev.slice(0, 3), thin, provisional: prov && (stage === 'S0' || stage === 'S1') });   // thin, provisional: additive
      if (ce[0] > 0) { param[e] = r3(ce[5] / ce[0]); if (ce[0] >= num(C.min_param_n, 3) && ce[5] / ce[0] >= 0.6) noSearch.push(e); }
      const unmeasured = () => { ev.length = 0; ev.push(n === 0 ? { kind: 'count', what: 'no answer of this engine to this question in ' + W + ' days' } : { kind: 'count', what: n + ' answer(s) in ' + W + ' days, ' + minN + ' needed' + (thin ? ' (engine asked less than weekly)' : '') });
        prov = false; return cell('unmeasured', n === 0 ? 'not_asked' : 'too_few', 'direct'); };
      if (n === 0 && !askedBySite.has(e)) { const s0u = eligibility(e, cited, retrieved, rk, ix);   // an engine the site does not ask at all: eligibility only
        if (s0u) { out[e] = { stage: 'S0', sub: s0u.sub, basis: 'direct', n: 0, named: 0, cited: 0, retrieved: 0, our_rank: rk.best, evidence: [s0u.ev, { kind: 'count', what: 'provisional: this engine is not asked for your site' }], thin, provisional: true, asked: false }; continue; }
        out[e] = unmeasured(); continue; }
      if (low) { prov = true; ev.push({ kind: 'count', what: 'provisional: ' + n + ' answer(s) in ' + W + ' days, ' + minN + ' needed for an answer-based stage' }); }
      // S0: the engine cannot read the client (one function, also used for the engines the site does not ask: see below)
      const s0 = eligibility(e, cited, retrieved, rk, ix); if (s0) { ev.push(s0.ev); out[e] = cell('S0', s0.sub, 'direct'); continue; }
      if (low) { const b1 = e === 'chatgpt' ? (hasR > 0 ? 'direct' : '') : rk.read && ix !== 'none' ? 'proxy_rank' : '';
        if (named === 0 && cited === 0 && retrieved === 0 && !rk.top10 && b1) { ev.length = 0;
          ev.push(b1 === 'direct' ? { kind: 'answer', what: 'your site was not among the pages ChatGPT read (' + hasR + ' readings)' } : { kind: ix === 'google' ? 'serp' : ix, query: rk.best ? rk.best.query : queries[0] || '', pos: rk.best ? rk.best.pos : null, at: rk.best ? rk.best.read_at : '', what: rk.best ? 'ranks ' + rk.best.pos : 'not in the results read' });
          ev.push({ kind: 'count', what: 'provisional: ' + n + ' answer(s) in ' + W + ' days' }); out[e] = cell('S1', '', b1); continue; }
        out[e] = unmeasured(); continue; }
      // S3-S5 from the answers
      const rate = named / n, crate = cited / n, med = median(positions);
      const namedA = ce[1]; const negHeavy = ce[8] >= 1 && ce[8] >= Math.ceil(0.25 * Math.max(1, namedA)); const wrong = ce[9] > 0;
      const wonNamed = named >= 2 && rate >= 0.30 && (byCitation || med == null || med <= 3);
      const wonCited = byCitation && cited >= 2 && crate >= 0.30;
      const ansEv = (what, f) => { for (const r of recent.filter(f).slice(0, 2)) ev.push({ kind: 'answer', at: S(r.checked_at), run_id: S(r.run_id), what }); };
      if (wonNamed || wonCited || named >= 1) { const nm = wonNamed || named >= 1;
        ev.push({ kind: 'rate', what: (nm ? 'named in ' + named : 'cited in ' + cited) + ' of ' + n + ' answers' + (med != null && nm ? ', median position ' + r1(med) : '') });
        ansEv(nm ? 'named' : 'cited', r => { const F = answerFacts(r, OH); return nm ? F.named : F.cited; });
        if (wrong) { ev.unshift({ kind: 'accuracy', what: ce[9] + ' answer(s) state something wrong about you' }); out[e] = cell('S4', 'wrong', 'direct'); continue; }
        if (negHeavy) { ev.unshift({ kind: 'sentiment', what: ce[8] + ' answer(s) speak negatively about you' }); out[e] = cell('S4', 'negative', 'direct'); continue; }
        if (wonNamed || wonCited) { out[e] = cell('S5', '', 'direct'); continue; }
        out[e] = cell('S4', !byCitation && named >= 2 && rate >= 0.30 && med != null && med > 3 ? 'low_position' : 'weak', 'direct'); continue; }
      if (cited >= 1) { ev.push({ kind: 'rate', what: 'cited in ' + cited + ' of ' + n + ' answers, named in none' }); ansEv('cited', r => answerFacts(r, OH).cited);
        out[e] = byCitation ? cell('S4', 'weak', 'direct') : cell('S3', '', 'direct'); continue; }
      // S2 / S1: retrieved (direct for ChatGPT) or ranking in the engine's index (proxy)
      if (e === 'chatgpt' && retrieved >= 1) { ev.push({ kind: 'answer', what: 'your page was among the pages ChatGPT read (' + retrieved + ' of ' + n + ' answers)' }); out[e] = cell('S2', '', 'direct'); continue; }
      if (rk.top10) { ev.push({ kind: ix === 'google' ? 'serp' : ix, query: rk.best.query, pos: rk.best.pos, at: rk.best.read_at }); out[e] = cell('S2', '', 'proxy_rank'); continue; }
      const basis = e === 'chatgpt' ? (hasR > 0 ? 'direct' : 'unknown_index') : rk.read ? 'proxy_rank' : 'unknown_index';
      if (e === 'chatgpt' && hasR > 0) ev.push({ kind: 'answer', what: 'your site was not among the pages ChatGPT read (' + hasR + ' readings)' });
      else if (rk.read) ev.push({ kind: ix === 'google' ? 'serp' : ix, query: rk.best ? rk.best.query : queries[0] || '', pos: rk.best ? rk.best.pos : null, at: rk.best ? rk.best.read_at : '', what: rk.best ? 'ranks ' + rk.best.pos : 'not in the results read' });
      else ev.push({ kind: 'none', what: ix === 'none' ? 'no reading of what this engine retrieves' : 'no reading of ' + (ix === 'chatgpt' ? 'what ChatGPT retrieved' : 'the ' + ix + ' results') + ' for these searches' });
      out[e] = cell('S1', '', basis); }
    // engines the site does not ask (or the caller did not list): no answer stage, but eligibility does not depend on asking. A Copilot that
    // cannot find the site in Bing is a step to take in week 1 (DESIGN 2.B deviation, fixes/P1.md): such a cell is a provisional S0 with n 0
    // and `asked: false` (additive); an engine with no S0 finding gets no cell, as before.
    for (const e of AIRF.ENGINES) { if (out[e] || !usable(e)) continue; const ix = INDEX_OF[e]; const rk = ix === 'google' ? RK.google : ix === 'bing' ? RK.bing : ix === 'brave' ? RK.brave : { best: null, read: false, anyOurs: false, top10: false };
      const ce = cellsE(e, 56); const s0 = eligibility(e, ce[2], ce[3], rk, ix); if (!s0) continue;
      out[e] = { stage: 'S0', sub: s0.sub, basis: 'direct', n: 0, named: 0, cited: 0, retrieved: 0, our_rank: rk.best, evidence: [s0.ev, { kind: 'count', what: 'provisional: this engine is not asked for your site' }], thin: false, provisional: true, asked: false }; }
    // question-level signals
    let tc = 0, tl = 0; for (const e of Object.keys(out)) { const t = cellsE(e, 28); tc += t[6]; tl += t[7]; }
    const list_dominated = tc >= num(C.min_list_cites, 3) && tl / tc >= 0.4;
    const meas = Object.entries(out).filter(([, c]) => c.stage !== 'unmeasured' && c.asked !== false); const wsum = meas.reduce((s, [e]) => s + (num((C.weights || {})[e], W_ENGINE[e] || 0.05)), 0);   // an engine the site does not ask never moves best_stage
    let best_stage = 'unmeasured'; if (meas.length) { let acc = 0; for (const [e, c] of meas.slice().sort((a, b) => ORDER[b[1].stage] - ORDER[a[1].stage])) { acc += num((C.weights || {})[e], W_ENGINE[e] || 0.05); if (acc >= 0.25 * wsum - 1e-9) { best_stage = c.stage; break; } } }
    let fnM = msOf(E.fn), lnM = msOf(E.ln), lcM = msOf(E.lc); for (const u of U) { const t = msOf(u.at); if (!Number.isFinite(t)) continue; if (u.named) { if (!(t >= fnM)) fnM = t; if (!(t <= lnM)) lnM = t; } if (u.cited && !(t <= lcM)) lcM = t; }
    const fn = isoOf(fnM), ln = isoOf(lnM), lcx = isoOf(lcM);
    return { prompt_id: pid, intent, engines: out, best_stage, parametric_share: param, no_search: noSearch, list_dominated, nobody_named: nobodyNamed,
      first_named_at: fn || '', last_named_at: ln || '', last_cited_at: lcx || '', mapped_page: mapped ? S(mapped.url) : '', fanout: queries.slice(0, 12) };   // mapped_page, fanout: additive
  };

  // ---- 2.C: the source graph ------------------------------------------------------------------------------------------------------------
  const PLACE = { directory: [0.80, 'a directory with a self-serve profile: a person creates it, reviews raise its place'],
    review: [0.60, 'a review platform with a self-serve profile: it needs genuine reviews to rank'],
    registry: [0.50, 'an official list: you are listed if you meet its rules (check them)'], community: [0.30, 'a disclosed, genuine answer in the thread'],
    news: [0.05, 'a news article: a later story may name you, the article itself rarely changes'] };
  const placeOf = (pt, author, names, contact) => {
    if (names === true) return [0, 'it already names you: keep it that way'];
    if (author === 'client') return [0, 'your own page'];
    if (author === 'rival' && pt === 'listicle') return [0.02, 'a rival\'s list: learn its format and who it names; pitched only with the owner\'s opt-in'];
    if (author === 'rival') return [0, 'a rival\'s own page'];
    if (pt === 'listicle') return contact ? [0.15, 'an editorial list with a contact found'] : [0.05, 'an editorial list, no contact found'];
    if (PLACE[pt]) return PLACE[pt];
    return [0, pt === 'vendor_page' ? 'a business\'s own page: nobody adds you to it' : pt === 'official' || pt === 'encyclopedia' ? 'not a page you can be placed on' : pt === 'video' || pt === 'social' ? 'a post: answer with your own (other levers)' : 'cannot tell what kind of page this is']; };
  const sources = ({ answers8, storedSources, mentionsPages, fetched, prompts, values, rivals, ourHosts, now } = {}) => {
    const N = msOf(now); const RS = rivalSet(rivals); const rows = (Array.isArray(answers8) ? answers8 : []).filter(answered);
    const OH = ourList(null, ourHosts, rows.map(r => r.domain));
    const PQ = Array.isArray(prompts) && prompts.length ? new Map(prompts.filter(p => p && S(p.prompt_id)).map(p => [S(p.prompt_id), p])) : null;
    const VQ = asMap(values); const vOf = (pid) => { const v = VQ.get(pid); return num(v && typeof v === 'object' ? v.V : v, 1); };
    const inW = (t) => { const x = msOf(t); return !Number.isFinite(N) || !Number.isFinite(x) || (x > N - 28 * DAY && x <= N + 6 * 3600e3); };
    const keep = (r) => { const pid = S(r.prompt_id); if (lc(r.kind) === 'brand') return false; if (PQ) { const p = PQ.get(pid); if (!p || intentOf(p, []) === 'brand' || p.core === false || /^false$/i.test(S(p.core))) return false; } return inW(r.checked_at); };
    const answersOf = new Map(); const pages = new Map();
    for (const r of rows) { if (!keep(r)) continue; const pid = S(r.prompt_id); answersOf.set(pid, (answersOf.get(pid) || 0) + 1);
      const own = ourList({ domain: r.domain }, OH); const seen = new Set();
      for (const c of answerFacts(r, OH).cl) { const url = S(c.url) || (c.host ? 'https://' + S(c.host) + '/' : ''); const host = hostOf(c.host || url); if (!url || !host || c.role === 'self' || hostIn(host, own)) continue;
        const key = AIRF.urlKey(url); if (!key || seen.has(key)) continue; seen.add(key);
        const g = pages.get(key) || { url, host, title: '', perQ: new Map(), engines: new Set(), cites: 0, last: '' };
        g.cites++; g.perQ.set(pid, (g.perQ.get(pid) || 0) + 1); g.engines.add(engOf(r.engine)); if (!g.title && S(c.title || c.t)) g.title = S(c.title || c.t);
        const at = isoOf(msOf(r.checked_at)); if (at > g.last) g.last = at; pages.set(key, g); } }
    const FM = new Map(); for (const f of (fetched instanceof Map ? [...fetched.values()] : Array.isArray(fetched) ? fetched : fetched && typeof fetched === 'object' ? Object.values(fetched) : [])) { if (f && S(f.url)) FM.set(AIRF.urlKey(f.url), f); }
    const SM = new Map((Array.isArray(storedSources) ? storedSources : []).filter(r => r && S(r.url_key || r.url)).map(r => [S(r.url_key) || AIRF.urlKey(r.url), r]));
    const arr = (v) => { const x = J(v, null); return Array.isArray(x) ? x.map(S).filter(Boolean) : S(v) ? S(v).split(',').map(S).filter(Boolean) : []; };
    const boolN = (v) => (v === true || /^true$/i.test(S(v)) ? true : v === false || /^false$/i.test(S(v)) ? false : null);
    const out = [];
    const build = (key, url, host, title, from, g) => { const f = FM.get(key); const s = SM.get(key) || {};
      const cls = classifyPage({ url, title: title || S(f && f.title) || S(s.title), host, rivals: RS, ourHosts: OH });
      let names = null; if (f) { const code = num(f.fetch_status != null ? f.fetch_status : f.status != null ? f.status : f.statusCode, 0); const v = f.mentions_us != null ? f.mentions_us : f.names_client != null ? f.names_client : f.names_us;
        names = code >= 200 && code < 300 ? boolN(v) : null; } else names = boolN(s.names_client);
      const rivals_named = f && Array.isArray(f.competitors_named || f.rivals_named) ? (f.competitors_named || f.rivals_named).map(S).filter(Boolean) : arr(s.rivals_named);
      const contact_email = S((f && f.contact_email) || s.contact_email); const contact_url = S((f && f.contact_url) || s.contact_url);
      const [placeability, placeability_why] = placeOf(cls.page_type, cls.author_kind, names, contact_email || contact_url);
      let influence = 0; const qs = g ? [...g.perQ.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) : [];
      for (const [pid, k] of qs) { const n = answersOf.get(pid) || 0; if (n > 0) influence += vOf(pid) * k / n; }
      return { url, url_key: key, host, page_type: cls.page_type, author_kind: cls.author_kind, names_client: names, rivals_named, questions: g ? qs.map(x => x[0]) : arr(s.questions),
        engines: g ? [...g.engines].sort() : arr(s.engines), cites_28d: g ? g.cites : 0, influence: r4(influence), placeability, placeability_why, contact_email, contact_url, from,
        last_seen: g ? (S(s.last_seen) > g.last ? S(s.last_seen) : g.last) : S(s.last_seen), page_why: cls.why, first_seen: S(s.first_seen) || (g ? g.last : isoOf(N)) };   // page_why, first_seen: additive
    };
    for (const [key, g] of pages) out.push(build(key, g.url, g.host, g.title, 'answers', g));
    for (const [key, s] of SM) { if (pages.has(key)) continue; const ls = msOf(s.last_seen); if (Number.isFinite(N) && Number.isFinite(ls) && N - ls > 120 * DAY) continue;
      const url = S(s.url) || 'https://' + key; out.push(build(key, url, hostOf(url), S(s.title), S(s.source_from) === 'llm_mentions' ? 'llm_mentions' : 'answers', null)); }
    for (const m of (Array.isArray(mentionsPages) ? mentionsPages : [])) { const url = S(m && m.url); const key = AIRF.urlKey(url); if (!key || pages.has(key) || SM.has(key) || out.some(o => o.url_key === key) || hostIn(url, OH)) continue;
      const o = build(key, url, hostOf(url), S(m.title), 'llm_mentions', null); o.last_seen = o.last_seen || isoOf(N); out.push(o); }
    return out.sort((a, b) => (b.influence * b.placeability - a.influence * a.placeability) || (b.influence - a.influence) || (b.cites_28d - a.cites_28d) || a.url_key.localeCompare(b.url_key));
  };

  return { VERSION, market, intentOf, corePanel, assignArms, mde, fanoutOf, diagnose, classifyPage, sources, rollEvidence };
})();
// ---- ARL: the AI-ranking decision and learning kit (inlined by build_monitors.py through its marker, after AIRF and ARD) ----
// AIR (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md 2.D-2.H, interface frozen in CONTRACTS.md 3.3). OWNER: package P2 (fixes/P2.md).
//   D  the lever library (17 levers: Beta prior, engine multipliers, one step per from stage in `next`), the refused tactics, the zero-weight items
//   E  value, feasibility, the prior of a cell, candidates, score, greedy choice under the weekly caps, pre-registration
//   G  verify (our own check that the action happened, timed from live_at for pages), outcome (stage moves net of the control background,
//      difference in differences through AVX.impact, a placebo in time, Fisher's exact first-appearance test), pooled Beta-binomial learning
//   H  the weekly memo (seven parts, every figure with its basis) and the comparison with the old logic
// Pure: no $(...), no network, no clock (`now` comes in, ms or ISO). n8n sandbox: no URL constructor, no property-descriptor or prototype setters,
// no structured cloning. Needs AIRF in scope. Uses AVX (v5/code/_ai_measure.js) for the difference in differences when the node inlines it
// (`/*` + `__AI_MEASURE__*/` before this kit); without AVX the DiD says so and nothing else changes.
// Wording rule: nothing here claims a cause. Verdicts are "likely helped", "can't tell", "no effect seen", "did not happen", "not due yet".
//
// Inputs beyond the frozen signatures (all optional; documented in fixes/P2.md for P4):
//   candidates: site = { site_id, domain, hosts: [host], prompts: [seo_ai_prompts rows], pages: [seo_ai_pages rows] };
//               settings = { pitch_rival_urls: [url] } (owner opt-in per page; rival lists are learn-only by default)
//   feasibility: diag.rivals_median (median competitors named per answered answer; ARL.rivalsMedian(answers) computes it)
//   choose: { now, units60 } pre-registers every chosen action before it is returned (no sink is written before that)
//   outcome: { verified } the verify result when the action row is not marked verified (its t0_snapshot is read), { exposure } [{ action_id, lever,
//            questions, from, to }] the other actions' exposure (RA-4); { B } is no longer used (FX-A: the lift test is a question-level t test)
//   learn: { history } the site's stored action rows already learned (RA-4: one move teaches one action)
//   FX-A (2026-11-06, docs/ai-ranking-2026-11-05/fixes/FX-A.md): RA-1 .. RA-18 of REVIEW_A_ALGO_STATS.md
const ARL = (() => {
  const VERSION = 'air-2';   // FX-A2: follows AIRF.RULE_VERSION (FX-B)
  const RULE = AIRF.RULE_VERSION;
  const DAY = 864e5;
  const S = (v) => (v == null ? '' : String(v)).trim();
  const N = (v, d) => { const x = Number(v); return v !== null && v !== '' && isFinite(x) ? x : d; };
  const rd = (x, k) => { const f = Math.pow(10, k == null ? 6 : k); return Math.round(x * f) / f; };
  const pct1 = (x) => Math.round(1000 * x) / 10;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const msOf = (t) => (typeof t === 'number' ? t : Date.parse(S(t)));
  const isoOf = (t) => { const x = msOf(t); return isFinite(x) ? new Date(x).toISOString() : ''; };
  const parse = (v, d) => { if (v && typeof v === 'object') return v; const s = S(v); if (!s) return d; try { const x = JSON.parse(s); return x == null ? d : x; } catch (e) { return d; } };
  const mget = (m, k) => (m == null ? undefined : typeof m.get === 'function' ? m.get(k) : m[k]);
  const arr = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? parse(v, S(v) ? S(v).split(/\s*,\s*/) : []) : []);
  const uniq = (xs) => [...new Set(xs)];
  const lvl = (s) => { const i = AIRF.STAGES.indexOf(S(s)); return i; };
  const avx = () => { try { return typeof AVX !== 'undefined' && AVX && typeof AVX.impact === 'function' ? AVX : null; } catch (e) { return null; } };
  const hostOf = (u) => S(u).toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/[\/?#:].*$/, '').replace(/^www\./, '');

  // ================================================================ statistics (exact where it matters; checked by harness AL-STAT)
  const LZ = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  /** log Gamma (Lanczos, g = 7): relative error below 1e-13 for z > 0 */
  const lgamma = (z) => { if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgamma(1 - z);
    const x0 = z - 1; let x = LZ[0]; for (let i = 1; i < 9; i++) x += LZ[i] / (x0 + i); const t = x0 + 7.5; return 0.5 * Math.log(2 * Math.PI) + (x0 + 0.5) * Math.log(t) - t + Math.log(x); };
  const logC = (n, k) => (k < 0 || k > n ? -Infinity : lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1));
  /** the continued fraction of the incomplete beta function (modified Lentz) */
  const betacf = (a, b, x) => { const FPMIN = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
    for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-15) break; }
    return h; };
  /** the regularised incomplete beta I_x(a, b) = P(Beta(a, b) <= x) */
  const ibeta = (x, a, b) => { if (!(a > 0 && b > 0)) return NaN; if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; };
  /** the q quantile of Beta(a, b), by bisection on ibeta (monotone; 80 halvings = machine precision) */
  const betaInv = (q, a, b) => { if (!(a > 0 && b > 0)) return null; if (q <= 0) return 0; if (q >= 1) return 1; let lo = 0, hi = 1;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (ibeta(mid, a, b) < q) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  /** standard normal CDF (erfc by its Chebyshev fit, |error| < 1.2e-7) and quantile (Acklam, |relative error| < 1.2e-9) */
  const erfc = (x) => { const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r; };
  const normCdf = (z) => 0.5 * erfc(-z / Math.SQRT2);
  const normInv = (p) => { if (!(p > 0 && p < 1)) return p <= 0 ? -Infinity : Infinity;
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239], b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416], pl = 0.02425;
    if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    const q = p - 0.5, r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); };
  /** Student t: CDF through the incomplete beta, quantile by bisection (FX-A RA-3: the question-level DiD is a t test on C - 1 or T + C - 2 degrees of freedom) */
  const tCdf = (t, df) => { if (!(df > 0)) return NaN; if (!isFinite(t)) return t > 0 ? 1 : 0; const tail = 0.5 * ibeta(df / (df + t * t), df / 2, 0.5); return t > 0 ? 1 - tail : tail; };
  const tInv = (q, df) => { if (!(df > 0) || !(q > 0 && q < 1)) return NaN; let lo = -1e4, hi = 1e4; for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (tCdf(mid, df) < q) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  /** P(X >= k) for X hypergeometric: n draws from N items of which K are "successes" */
  const hyperUpper = (k, Nn, K, n) => { if (!(Nn > 0) || n < 0 || K < 0 || n > Nn || K > Nn) return null; const lo = Math.max(0, n - (Nn - K)), hi = Math.min(K, n); if (k <= lo) return 1; if (k > hi) return 0;
    const den = logC(Nn, n); let p = 0; for (let x = k; x <= hi; x++) p += Math.exp(logC(K, x) + logC(Nn - K, n - x) - den); return Math.min(1, p); };
  /** one-sided Fisher exact test on question counts: kt of nt treated questions appeared, kc of nc control questions. P(treated >= kt | margins) */
  const fisher = (kt, nt, kc, nc) => (nt > 0 && nc > 0 ? hyperUpper(kt, nt + nc, kt + kc, nt) : null);
  /** P(X >= x) for X ~ Bin(n, p) */
  const binomUpper = (x, n, p) => { if (!(n >= 0) || !(p >= 0 && p <= 1)) return null; if (x <= 0) return 1; if (x > n) return 0; if (p === 0) return 0; if (p === 1) return 1;
    let s = 0; for (let i = x; i <= n; i++) s += Math.exp(logC(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p)); return Math.min(1, s); };
  /** the smallest number k of first appearances that, all on treated questions, gives a one-sided Fisher p below alpha: C(qt, k) / C(qt + qc, k) */
  const firstK = (qt, qc, alpha) => { const a = alpha == null ? 0.05 : alpha; for (let k = 1; k <= qt; k++) { const p = Math.exp(logC(qt, k) - logC(qt + qc, k)); if (p < a) return { k, p }; } return { k: null, p: null }; };
  /** DESIGN A7 / R1 6: minimum detectable effect in POINTS of the rate. n_eff(Q) = Q m / (1 + (m - 1) rho); z = z(1 - alpha/2) + z(power) (2.80 at 0.05 / 0.8);
   *  pre/post z sqrt(2 p(1-p) / n_eff(Qt)), DiD z sqrt(2 p(1-p) (1/n_eff(Qt) + 1/n_eff(Qc))), a zero baseline planned at 2% */
  const mde = ({ q_t, q_c, m, p, rho, alpha, power } = {}) => { const a = alpha == null ? 0.05 : alpha, pw = power == null ? 0.8 : power; const qt = N(q_t, 0), qc = N(q_c, 0), mm = N(m, 0), r = clamp(N(rho, 0.3), 0, 1);
    const pu = Math.max(N(p, 0), 0.02); const z = normInv(1 - a / 2) + normInv(pw); const ne = (Q) => (Q > 0 && mm > 0 ? Q * mm / (1 + (mm - 1) * r) : 0);
    const nt = ne(qt), nc = ne(qc); const v = 2 * pu * (1 - pu); const fk = firstK(qt, qc, a / 2);   // RA-12: one alpha, one-sided a / 2 (0.025), as the verdict
    return { prepost: nt > 0 ? rd(100 * z * Math.sqrt(v / nt), 2) : null, did: nt > 0 && nc > 0 ? rd(100 * z * Math.sqrt(v * (1 / nt + 1 / nc)), 2) : null, n_eff_t: rd(nt, 2), n_eff_c: rd(nc, 2), p_used: pu,
      first_appearance_k: fk.k, first_appearance_p: fk.p == null ? null : rd(fk.p, 4), z: rd(z, 4),
      basis: qt + ' treated and ' + qc + ' control questions, ' + mm + ' answers each per 4 weeks, intra-question correlation ' + r + ', 80% power, 5% two-sided (first appearances one-sided 2.5%)' + (N(p, 0) < 0.02 ? ', baseline planned at 2%' : '') }; };
  // RA-12 (FX-A): ONE alpha for every lift test: one-sided 0.025 (the 95% two-sided range above 0), for the DiD, the Fisher first-appearance test and the
  // interrupted time series alike; across the actions judged in a quarter the false discovery rate is held at the same level (Benjamini-Hochberg, fdr())
  const ALPHA = 0.025;
  const STATS = { lgamma, logC, ibeta, betaInv, normCdf, normInv, tCdf, tInv, hyperUpper, fisher, binomUpper, firstK, mde, ALPHA };

  // ================================================================ D. the lever library
  // lever: { id, label, from: [stage], to: stage (the highest it reaches), next: { from: to } (one step per from stage), sub: [S0 sub-label] (empty = any),
  //   mult: { engine: number } (an engine not listed takes the '*' value when the lever has one, else 1), prior: { mean, n0 } (null = never proposed until its
  //   gate holds), days: [min, typ, max] (null = not applicable), usd, effort_min, executor: auto | approve | human, scope: question | page | site,
  //   sink: ai_target | prospect | listing | growth_action | site_task | protect | existing, sink_wave2: the wave-2 sink when it moves, evidence: [keys]
  // P2 corrections to the W0 figures (fixes/P2.md 2): L03 and L04 act only on the engines whose index they fix ('*': 0); L09 effort 90 -> 60 minutes
  // (R1: "low for the profile"); L13 / L14 are proposed only for questions whose cited pages are community threads / videos.
  const G3 = { ai_mode: 1, ai_overview: 1, gemini: 1 };
  const LEVERS = [
    { id: 'L01', label: 'Unblock AI bots in robots.txt', from: ['S0'], to: 'S1', next: { S0: 'S1' }, sub: ['blocked'], mult: { '*': 1 }, prior: { mean: 0.90, n0: 10 }, days: [1, 2, 7], usd: 0, effort_min: 15, executor: 'human', scope: 'site', sink: 'existing', sink_wave2: 'existing', evidence: ['E11', 'E8'] },
    { id: 'L02', label: 'Content in raw HTML (server render)', from: ['S0'], to: 'S1', next: { S0: 'S1' }, sub: ['js_only'], mult: { chatgpt: 1, perplexity: 1, claude: 1, ai_mode: 0.3, ai_overview: 0.3, gemini: 0.3 }, prior: { mean: 0.70, n0: 6 }, days: [7, 14, 45], usd: 0, effort_min: 240, executor: 'human', scope: 'page', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E23'] },
    { id: 'L03', label: 'Add the site to Bing Webmaster and submit', from: ['S0'], to: 'S1', next: { S0: 'S1' }, sub: ['not_indexed'], mult: { '*': 0, copilot: 1, chatgpt: 0.2, chatgpt_api: 0.2 }, prior: { mean: 0.85, n0: 8 }, days: [2, 10, 30], usd: 0, effort_min: 20, executor: 'human', scope: 'site', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E13', 'R4'] },
    { id: 'L04', label: 'Get the page indexed in Google', from: ['S0'], to: 'S1', next: { S0: 'S1' }, sub: ['not_indexed'], mult: Object.assign({ '*': 0 }, G3), prior: { mean: 0.50, n0: 6 }, days: [7, 21, 60], usd: 0, effort_min: 30, executor: 'human', scope: 'page', sink: 'existing', sink_wave2: 'existing', evidence: ['E8'] },
    { id: 'L05', label: 'Own answer page for the searches the engines run', from: ['S1'], to: 'S2', next: { S1: 'S2' }, sub: [], mult: { ai_mode: 1.2, ai_overview: 1.2, gemini: 1.2, chatgpt: 1, chatgpt_api: 1, perplexity: 1, copilot: 0.8, claude: 0.6 }, prior: { mean: 0.20, n0: 6 }, days: [14, 45, 90], usd: 0.80, effort_min: 20, executor: 'approve', scope: 'question', sink: 'ai_target', sink_wave2: 'ai_target', evidence: ['E20', 'E19', 'E24', 'E9'] },
    { id: 'L06', label: 'Refresh the ranking page for the searches the engines run', from: ['S1', 'S2'], to: 'S3', next: { S1: 'S2', S2: 'S3' }, sub: [], mult: { ai_mode: 1.2, ai_overview: 1.2, gemini: 1.2, chatgpt: 1, chatgpt_api: 1, perplexity: 1, copilot: 0.8, claude: 0.6 }, prior: { mean: 0.25, n0: 6 }, days: [7, 30, 60], usd: 0.80, effort_min: 20, executor: 'approve', scope: 'question', sink: 'ai_target', sink_wave2: 'ai_target', evidence: ['E20', 'OT2'] },
    { id: 'L07', label: 'Cited but not named: fix the passage', from: ['S3'], to: 'S4', next: { S3: 'S4' }, sub: [], mult: { '*': 1 }, prior: { mean: 0.35, n0: 5 }, days: [7, 21, 45], usd: 0, effort_min: 20, executor: 'approve', scope: 'question', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['GG1', 'E20'] },
    { id: 'L08', label: 'Placement on an editorial list the answers cite', from: ['S1', 'S2'], to: 'S4', next: { S1: 'S4', S2: 'S4' }, sub: [], mult: { ai_mode: 1.2, ai_overview: 1.2, perplexity: 1.2, chatgpt: 1, chatgpt_api: 1, claude: 0.8 }, prior: { mean: 0.06, n0: 8 }, days: [14, 30, 90], usd: 0.02, effort_min: 30, executor: 'approve', scope: 'page', sink: 'prospect', sink_wave2: 'prospect', evidence: ['E26', 'E25', 'E7', 'E20'] },
    { id: 'L09', label: 'Directory profile on a directory the answers cite', from: ['S1', 'S2'], to: 'S4', next: { S1: 'S2', S2: 'S4' }, sub: [], mult: { perplexity: 1.5, ai_mode: 1.2, ai_overview: 1.2, gemini: 1.2, chatgpt: 0.8, chatgpt_api: 0.8 }, prior: { mean: 0.08, n0: 5 }, days: [14, 45, 90], usd: 0, effort_min: 60, executor: 'human', scope: 'page', sink: 'listing', sink_wave2: 'listing', evidence: ['EX6', 'EX8', 'E31', 'R4'] },
    { id: 'L10', label: 'Registry or partner listing (eligible only)', from: ['S1'], to: 'S4', next: { S1: 'S4' }, sub: [], mult: { '*': 1 }, prior: { mean: 0.15, n0: 4 }, days: [30, 60, 120], usd: 0, effort_min: 120, executor: 'human', scope: 'page', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['R4'] },
    { id: 'L11', label: 'Earned mention (press, partner, customer case)', from: ['S1', 'S2', 'S3', 'S4'], to: 'S4', next: { S1: 'S2', S2: 'S3', S3: 'S4', S4: 'S4' }, sub: [], mult: { chatgpt: 1.2, chatgpt_api: 1.2, claude: 1.2 }, prior: { mean: 0.05, n0: 4 }, days: [30, 60, 180], usd: 0, effort_min: 240, executor: 'human', scope: 'site', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E18', 'E5', 'E6', 'E21'] },
    { id: 'L12', label: 'LinkedIn article by a named person', from: ['S1', 'S2'], to: 'S4', next: { S1: 'S2', S2: 'S4' }, sub: [], mult: { chatgpt: 1.2, chatgpt_api: 1.2, ai_mode: 1.2 }, prior: { mean: 0.05, n0: 4 }, days: [7, 21, 45], usd: 0, effort_min: 90, executor: 'human', scope: 'site', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E29'] },
    { id: 'L13', label: 'Disclosed community answer', from: ['S1'], to: 'S2', next: { S1: 'S2' }, sub: [], mult: { perplexity: 1.5, ai_overview: 1, chatgpt: 0.5, chatgpt_api: 0.5 }, prior: { mean: 0.03, n0: 3 }, days: [3, 14, 45], usd: 0, effort_min: 45, executor: 'human', scope: 'page', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E32', 'E6', 'E15'] },
    { id: 'L14', label: 'Video for the question', from: ['S1'], to: 'S2', next: { S1: 'S2' }, sub: [], mult: { ai_overview: 1.3, perplexity: 1.2 }, prior: { mean: 0.03, n0: 3 }, days: [14, 45, 90], usd: 0, effort_min: 300, executor: 'human', scope: 'page', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E9'] },
    { id: 'L15', label: 'Correction (own page or ask the source)', from: ['S4'], to: 'S5', next: { S4: 'S5' }, sub: ['wrong'], mult: { '*': 1 }, prior: { mean: 0.30, n0: 4 }, days: [14, 30, 60], usd: 0.02, effort_min: 20, executor: 'approve', scope: 'question', sink: 'existing', sink_wave2: 'existing', evidence: ['PE1'] },
    { id: 'L16', label: 'Protect a cited page; refresh it when citations decay', from: ['S5'], to: 'S5', next: { S5: 'S5' }, sub: [], mult: { '*': 1 }, prior: { mean: 0.50, n0: 4 }, days: null, usd: 0, effort_min: 0, executor: 'auto', scope: 'page', sink: 'protect', sink_wave2: 'protect', evidence: ['E33'] },
    { id: 'L17', label: 'Wikidata / Wikipedia entity', from: ['S1', 'S2', 'S3', 'S4'], to: 'S4', next: {}, sub: [], mult: { '*': 0, chatgpt: 1, chatgpt_api: 1, claude: 1 }, prior: null, gate: 'three independent earned mentions on file (notability, E36)', days: null, usd: 0, effort_min: 0, executor: 'human', scope: 'site', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E36', 'E35'] }
  ];
  const LV = new Map(LEVERS.map(l => [l.id, l]));
  // the refused tactics: never chosen whatever their score (weight 0); `match` finds them in the old logic's plan (compareOld) so the reason is printed
  const REFUSED = [
    { id: 'R01', label: 'Self-ranked "best X" list', why: 'the self-promoter is left out of the answers 69% to 83% of the time', evidence: ['E26'], weight: 0, match: '\\b(best|top \\d+|top ten|leading)\\b.*\\b(companies|providers|agencies|partners|firms|vendors)\\b' },
    { id: 'R02', label: 'AI-only or agent-only page version without parity', why: 'near cloaking', evidence: ['AD1'], weight: 0, match: '\\b(ai[- ]only|for (ai|llm|bots?) only|agent[- ]only)\\b' },
    { id: 'R03', label: 'Paid placement without disclosure', why: 'link spam by Google\'s own rules', evidence: ['R2'], weight: 0, match: '\\b(paid placement|sponsored (post|placement)|buy (a )?(link|placement))\\b' },
    { id: 'R04', label: 'Prompt-injection text on a page', why: 'manipulates the engines; engines treat it as an attack', evidence: ['E13'], weight: 0, match: '\\b(prompt injection|hidden (text|instructions) for (ai|llm))\\b' },
    { id: 'R05', label: 'Fake reviews', why: 'deceptive and against every platform\'s rules', evidence: ['R2'], weight: 0, match: '\\b(fake|seeded|incentivi[sz]ed) reviews?\\b' },
    { id: 'R06', label: 'Astroturfed community posts', why: 'undisclosed promotion; removed and penalised by the communities', evidence: ['E41'], weight: 0, match: '\\b(astroturf|sock ?puppet|undisclosed (post|answer))' }
  ];
  const ZERO_WEIGHT = ['schema', 'llms_txt'];
  const U = { S0: 0, S1: 0.03, S2: 0.15, S3: 0.25, S4: 0.45, S5: 0.8 };
  const VERDICTS = ['likely_helped', 'cant_tell', 'no_effect', 'not_happened', 'not_due'];
  const VERDICT_WORDS = { likely_helped: 'likely helped', cant_tell: 'can\'t tell', no_effect: 'no effect seen', not_happened: 'did not happen', not_due: 'not due yet' };
  const ELIG = ['L01', 'L02', 'L03', 'L04'];
  const OWN_PAGE = ['L05', 'L06'];
  // FX-A RA-4: the site-wide levers that touch every question EQUALLY (an earned mention, a LinkedIn article, the entity; and the site-scope
  // eligibility steps L01 / L03) affect both arms alike, so they do not bias a question-level DiD and are not exposure. L13 (community answer) and
  // L14 (video) act only on the questions whose cited pages are threads / videos: they are targeted in effect, so since FX-A they are scope 'page',
  // record exposure, get controls (the questions they do not touch) and are judged and learned like a placement.
  // SITE_WIDE (no control possible) are judged by an interrupted time series against the questions' own pre-period trend (its()), never learned.
  const SITE_WIDE = ['L11', 'L12', 'L17'];
  const UNIFORM = ['L01', 'L03', 'L11', 'L12', 'L17'];
  const HUMAN_NEW = ['L02', 'L03', 'L07', 'L09', 'L10', 'L11', 'L12', 'L13', 'L14', 'L17'];   // DESIGN 2.E "new human steps" (L01 / L04 ride existing site tasks)
  // the levers that can reach an answer given from memory (no_search): an earned mention and the entity, through the next training data only.
  // FX-A RA-15: LinkedIn (L12) reaches answers through search citations only (R1), so it no longer acts on a no_search cell; L11 / L17 on such a cell
  // are discounted as if their time to effect were 180 days: (1 + 60 / 60) / (1 + 180 / 60) = 0.5 (score()).
  const LONG_RUN = ['L11', 'L17'];
  const NO_SEARCH_DISCOUNT = (1 + 60 / 60) / (1 + 180 / 60);
  // off-site levers put the business's name on a third-party page the engine CAN read (a list, a directory, a registry, press, LinkedIn, a forum,
  // a video): they do not need the client's own page to be readable, so they act on S0 cells too, counted from S1 (fixes/P2.md 2, item 13).
  // DESIGN 2.E's "S0: eligibility only" is kept for every lever that works through the client's own page (L05-L07, L15, L16).
  const OFF_SITE = ['L08', 'L09', 'L10', 'L11', 'L12', 'L13', 'L14', 'L17'];
  const effFrom = (L, stage) => (L.from.includes(stage) ? stage : stage === 'S0' && OFF_SITE.includes(L.id) && L.from.includes('S1') ? 'S1' : '');   // the only levers that can reach a question an engine answers from memory (no_search)
  const ENGINE_W = { chatgpt: 0.30, ai_overview: 0.15, ai_mode: 0.15, gemini: 0.10, perplexity: 0.12, copilot: 0.10, claude: 0.08, chatgpt_api: 0 };
  // The minimum is on EFFICIENCY, not size: an action must be expected to win at least 0.5% of what its own cells still have to win,
  // gain / sum over its cells of w_e V F (U(S5) - U(s)), which does not move with V, F or the panel's size. DESIGN's absolute 0.02 is about six
  // well-placed cells (one is ~0.0036): on the production replay (2026-11-06) every action of both sites fell under it and AIR chose nothing. A floor
  // that grows with the panel (a share of all its headroom) favours site-wide steps that add up many tiny cells (fixes/P2.md 2, item 16).
  // `min_gain` given in capacities is still read as an absolute floor.
  const CAPS = { own_pages: 1, pitches: 5, human_new: 3, human_open_max: 8, protect: 10, min_gain: null, min_efficiency: 0.005, min_gain_abs: 0.0001 };
  const OPEN = ['proposed', 'queued', 'in_progress', 'done'];
  const PROV = 0.8;   // ARD marks S0 / S1 read from index presence or a rank proxy with 0-3 answers `provisional`: acted on, p x 0.8 (unmeasured cells: nothing)
  const ENGINE_NAMES = { chatgpt: 'ChatGPT', gemini: 'Gemini', ai_mode: 'Google AI Mode', ai_overview: 'Google AI Overviews', perplexity: 'Perplexity', claude: 'Claude', copilot: 'Copilot', chatgpt_api: 'ChatGPT (API)' };
  const STAGE_WORDS = { S0: 'cannot be read', S1: 'not found', S2: 'found, not cited', S3: 'cited, not named', S4: 'named, weak or wrong', S5: 'won', unmeasured: 'not measured' };
  // AIR's cost constants, shared with the app through harness/ai_rank_cost_cases.json (AL1 regenerates and compares; P6 reads it)
  const COST = { H: 25, overhead_usd: 0.5, credits_per_usd: 60, page_usd: 0.80, reserve_pages_month: 2, fanout_read_usd: 0.002, mentions_task_usd: [0.10, 0.20], mentions_tasks_month: 2 };
  const multOf = (lever, engine) => { const m = (lever && lever.mult) || {}; return engine in m ? N(m[engine], 1) : '*' in m ? N(m['*'], 1) : 1; };
  const costOf = (lever, H) => rd(N(lever.usd, 0) + N(lever.effort_min, 0) / 60 * (H == null ? COST.H : H) + COST.overhead_usd, 4);

  // ================================================================ E. value, feasibility, priors
  const INTENT_W = { recommendation: 1.0, informational: 0.6, unknown: 0.8, brand: 0 };
  const BUYER_W = { decision: 1.0, consideration: 0.8, awareness: 0.6 };
  /** V(q) = demand_w * intent_w * stage_w; demand_w = 1 + log10(1 + vol) / 2 (A5: AI search volume, else Search Console impressions x 12 / 28, else 0) */
  const value = ({ prompt, demand, intent, stage } = {}) => { const p = prompt || {}; let vol = 0, src = '';
    const d = demand; if (typeof d === 'number' && isFinite(d)) { vol = d; src = 'demand given'; }
    else if (d && typeof d === 'object') { if (N(d.vol, null) != null) { vol = N(d.vol, 0); src = S(d.basis) || 'demand given'; } else if (N(d.ai_volume, 0) > 0) { vol = N(d.ai_volume, 0); src = 'AI search volume'; } else if (N(d.gsc_impressions_28d, 0) > 0) { vol = N(d.gsc_impressions_28d, 0) * 12 / 28; src = 'Search Console impressions x 12 / 28'; } }
    if (!src && N(p.volume, 0) > 0) { vol = N(p.volume, 0); src = 'AI search volume'; }
    vol = Math.max(0, vol); const demand_w = 1 + Math.log10(1 + vol) / 2;
    const it = S(intent) || 'unknown'; const intent_w = it in INTENT_W ? INTENT_W[it] : 0.8;
    const bs = S(stage || p.stage).toLowerCase(); const stage_w = bs in BUYER_W ? BUYER_W[bs] : 0.8;
    return { V: rd(demand_w * intent_w * stage_w), demand_w: rd(demand_w), intent_w, stage_w, vol: rd(vol, 2),
      basis: (src ? src + ' ' + Math.round(vol) + ' a month' : 'no demand data') + '; intent ' + it + (it in INTENT_W ? '' : ' (not known: 0.8)') + '; buyer stage ' + (bs || 'not known') + (bs in BUYER_W ? '' : ' (0.8)') }; };
  /** F(q) = clamp(0.05, 1, market_w * (0.5 comp_w + 0.5 reach_w)); comp_w = 1 / (1 + median rivals named per answer / 3) */
  const feasibility = ({ prompt, market, diag, reach } = {}) => { const p = prompt || {}; const mk = market || {}; const why = [];
    const qcc = S(p.market).split('-')[0].toUpperCase(); const scc = S(mk.cc).toUpperCase();
    const market_w = !qcc || !scc ? 1 : qcc === scc ? 1 : 0.2; why.push(!qcc || !scc ? 'market not known: 1' : qcc === scc ? 'the site market' : 'another market (' + qcc + ' vs ' + scc + '): 0.2');
    const rm = N(diag && (diag.rivals_median != null ? diag.rivals_median : diag.rivals_per_answer), null);
    const comp_w = rm == null ? 0.5 : 1 / (1 + Math.max(0, rm) / 3); why.push(rm == null ? 'rivals per answer not known: 0.5' : 'median ' + rm + ' rivals named per answer');
    let rw = N(reach && typeof reach === 'object' ? (reach.pct != null ? reach.pct : reach.percentile) : reach, null); if (rw != null && rw > 1) rw = rw / 100;
    const reach_w = rw == null ? 0.5 : clamp(rw, 0, 1); why.push(rw == null ? 'reach not stored: 0.5' : 'reach percentile ' + rd(reach_w, 2));
    return { F: rd(clamp(market_w * (0.5 * comp_w + 0.5 * reach_w), 0.05, 1)), market_w, comp_w: rd(comp_w), reach_w: rd(reach_w), basis: why.join('; ') }; };
  /** the median number of competitors named per answered answer (feasibility's comp_w input), from seo_ai_answers rows */
  const rivalsMedian = (answers) => { const xs = []; for (const a of (answers || [])) { if (!a || a.answered === false || !AIRF.usable(a.engine)) continue; const ents = arr(a.entities_json);
    xs.push(ents.length ? ents.filter(e => e && S(e.role) === 'competitor').length : arr(a.competitors).filter(Boolean).length); }
    if (!xs.length) return null; xs.sort((x, y) => x - y); const m = xs.length; return m % 2 ? xs[(m - 1) / 2] : (xs[m / 2 - 1] + xs[m / 2]) / 2; };
  const evidencePrior = (lever) => { const L = LV.get(S(lever)); const pr = L && L.prior; return pr ? { a: pr.mean * pr.n0, b: (1 - pr.mean) * pr.n0 } : null; };
  const rowsOf = (priors) => (Array.isArray(priors) ? priors : []);
  /** FX-A RA-5: a site's share of the pool keeps its RATE and caps its WEIGHT: w = min(1, SITE_CAP / (k + f)) applied to both k and f (DESIGN G4's
   *  separate caps min(10, k) / min(10, f) pulled a 4% site to 50%). k and f count ACTIONS (one trial per action and engine group, RA-6), not cells. */
  const SITE_CAP = 20;
  const wOf = (k, f) => (k + f > SITE_CAP ? SITE_CAP / (k + f) : 1);
  /** the Beta prior of a lever at a stage for an engine group: evidence (DESIGN 2.D), pooled across sites (the global row), or the site's own posterior
   *  (the global pool without this site's weighted share, shrunk to at most 10 pseudo-outcomes toward that pool, which is anchored at the evidence
   *  prior, plus this site's raw outcomes: G4, leave-one-out) */
  const priorOf = ({ lever, stage, group, priors, site_id } = {}) => { const ev = evidencePrior(lever);
    const out = (a, b, n, source) => ({ a: rd(a), b: rd(b), mean: a + b > 0 ? rd(a / (a + b)) : 0, lo90: a > 0 && b > 0 ? rd(betaInv(0.05, a, b)) : 0, hi90: a > 0 && b > 0 ? rd(betaInv(0.95, a, b)) : 0, n, source });
    if (!ev) return out(0, 0, 0, 'evidence');
    const rows = rowsOf(priors); const gid = AIRF.priorId(lever, stage, group, 'global'); const g = rows.find(r => r && S(r.prior_id) === gid);
    let ga = ev.a, gb = ev.b, gn = 0; if (g && N(g.alpha, 0) > 0 && N(g.beta, 0) > 0) { ga = N(g.alpha, ev.a); gb = N(g.beta, ev.b); gn = N(g.n_outcomes, 0); }
    const sid = S(site_id); const s = sid ? rows.find(r => r && S(r.prior_id) === AIRF.priorId(lever, stage, group, sid)) : null;
    if (s) { const ks = Math.max(0, N(s.alpha, 0) - N(s.prior_alpha, 0)), fs = Math.max(0, N(s.beta, 0) - N(s.prior_beta, 0)); const w = wOf(ks, fs);
      const la = Math.max(1e-6, ga - w * ks), lb = Math.max(1e-6, gb - w * fs); const kap = Math.min(la + lb, 10);
      return out(kap * la / (la + lb) + ks, kap * lb / (la + lb) + fs, N(s.n_outcomes, 0), 'site'); }
    return out(ga, gb, gn, gn > 0 ? 'pooled' : 'evidence'); };

  // ================================================================ E. candidates
  const cellsOf = (d) => Object.entries((d && d.engines) || {}).filter(([e, c]) => AIRF.usable(e) && c && typeof c === 'object').map(([e, c]) => ({ engine: e, stage: S(c.stage), sub: S(c.sub), c }));
  const applies = (L, cell, d) => { if (!effFrom(L, cell.stage)) return false; if (L.sub.length && !L.sub.includes(cell.sub)) return false; if (multOf(L, cell.engine) <= 0) return false;
    if ((d.no_search || []).includes(cell.engine) && !LONG_RUN.includes(L.id) && !ELIG.includes(L.id)) return false; return true; };
  const isOurs = (u, hosts) => { const h = hostOf(u); return !!h && hosts.some(x => h === x || h.endsWith('.' + x)); };
  const DIR_IDS = [['clutch.co', 'clutch'], ['goodfirms.co', 'goodfirms'], ['themanifest.com', 'themanifest'], ['sortlist.', 'sortlist'], ['designrush.com', 'designrush'], ['upcity.com', 'upcity'], ['g2.com', 'g2'], ['capterra.', 'capterra'], ['trustradius.com', 'trustradius'], ['trustpilot.', 'trustpilot'], ['appsource.microsoft.com', 'ms_appsource'], ['partner.microsoft.com', 'ms_partner']];
  const listingIdOf = (url) => { const h = hostOf(url); const hit = DIR_IDS.find(([k]) => h === k || h.endsWith('.' + k) || (k.endsWith('.') && h.indexOf(k) === 0)); return hit ? hit[1] : ''; };
  /** every action AIR could take this week, one per lever and ref (page, question, listing or the site), with the cells it touches. A candidate
   *  that policy forbids carries `refused` (the reason) and is never chosen: a question-specific lever on a control question, a rival's list. */
  const candidates = ({ site, diag, sources, arms, stored_actions, settings, now } = {}) => {
    const st = site || {}; const sid = S(st.site_id); if (!sid) return [];
    const D = (Array.isArray(diag) ? diag : []).filter(d => d && !d.unavailable && S(d.prompt_id) && d.engines && S(d.intent) !== 'brand');
    const byQ = new Map(D.map(d => [S(d.prompt_id), d]));
    const armOf = new Map((arms || []).map(a => [S(a && a.prompt_id), S(a && a.arm)]));
    const P = new Map((st.prompts || []).map(p => [S(p.prompt_id), p]));
    const hosts = uniq([S(st.domain), ...(st.hosts || []).map(S)].map(hostOf).filter(Boolean));
    const home = hosts.length ? 'https://' + hosts[0] + '/' : '';
    const optIn = new Set((((settings || {}).pitch_rival_urls) || []).map(u => AIRF.urlKey(u)).filter(Boolean));
    const pageOf = (d) => { const q = S(d.prompt_id); if (S(d.page_url)) return S(d.page_url); if (S(d.mapped_page) && isOurs(d.mapped_page, hosts)) return S(d.mapped_page);   // ARD's additive mapped_page
      for (const { c } of cellsOf(d)) for (const ev of (c.evidence || [])) { const u = S(ev && (ev.url || ev.page)); if (u && isOurs(u, hosts)) return u; }
      const pg = (st.pages || []).find(r => r && arr(r.questions).map(S).includes(q) && isOurs(r.url, hosts)); if (pg) return S(pg.url);
      // LIVE1 (2026-11-07): the page Search Console shows for the question's own keyword or one of the engines' searches (exact query, the site's own host)
      const gp = st.gsc_pages; if (gp && typeof gp.get === 'function') { const p0 = P.get(q) || {}; for (const k of uniq([S(p0.keyword), ...arr(d.fanout).map(S)].map(x => x.toLowerCase().replace(/\s+/g, ' ').trim()).filter(Boolean))) { const u = S(gp.get(k)); if (u && isOurs(u, hosts)) return u; } }
      return ''; };
    const intentOf = (qs) => { const its = uniq(qs.map(q => S((byQ.get(q) || {}).intent))); return its.length === 1 && its[0] === 'informational' ? 'informational' : its.length === 1 && its[0] === 'recommendation' ? 'recommendation' : 'mixed'; };
    const out = []; const seen = new Set();
    const add = (L, ref, cells, extra) => { if (!cells.length) return; const id = AIRF.actionId(sid, L.id, ref); if (seen.has(id)) return; seen.add(id);
      cells.sort((x, y) => (x.prompt_id < y.prompt_id ? -1 : x.prompt_id > y.prompt_id ? 1 : x.engine < y.engine ? -1 : x.engine > y.engine ? 1 : 0));
      const qs = uniq(cells.map(c => c.prompt_id)); const p0 = P.get(qs[0]) || {};
      out.push(Object.assign({ action_id: id, site_id: sid, lever: L.id, label: L.label, executor: L.executor, scope: L.scope, ref, questions: qs, engines: uniq(cells.map(c => c.engine)).sort(), target_stage: L.to,
        sink: L.sink, sink_ref: '', cells: cells.map(c => Object.assign({ prompt_id: c.prompt_id, engine: c.engine, stage: c.stage, sub: c.sub }, c.provisional ? { provisional: true } : {}, c.no_search ? { no_search: true } : {})), intent: intentOf(qs), factor: 1,
        keyword: L.scope === 'question' ? S(p0.keyword) : '', page_url: '', exposure: L.scope === 'page', why: '' }, extra || {})); };
    const cellsFor = (L, qs, engines) => { const cs = []; for (const q of qs) { const d = byQ.get(q); if (!d) continue; for (const cell of cellsOf(d)) { if (engines && !engines.includes(cell.engine)) continue; if (applies(L, cell, d)) cs.push({ prompt_id: q, engine: cell.engine, stage: cell.stage, sub: cell.sub, provisional: cell.c.provisional === true, no_search: (d.no_search || []).includes(cell.engine) }); } } return cs; };
    const allQ = [...byQ.keys()].sort();
    // S0: eligibility only (content cannot help a page the engine cannot read)
    add(LV.get('L01'), {}, cellsFor(LV.get('L01'), allQ), { why: 'robots.txt blocks the AI search bots of these engines' });
    add(LV.get('L03'), {}, cellsFor(LV.get('L03'), allQ), { why: 'the site is not in the Bing index the engine searches' });
    for (const id of ['L02', 'L04']) { const L = LV.get(id); const byPage = new Map();
      for (const q of allQ) { const cs = cellsFor(L, [q]); if (!cs.length) continue; const u = pageOf(byQ.get(q)) || home; const k = AIRF.urlKey(u) || 'site'; const g = byPage.get(k) || { url: u, cells: [] }; g.cells.push(...cs); byPage.set(k, g); }
      for (const [, g] of [...byPage.entries()].sort()) add(L, g.url ? { url: g.url } : {}, g.cells, { page_url: g.url, why: id === 'L02' ? 'the page shows little text before JavaScript runs' : 'the page the question maps to is not in Google\'s index' }); }
    // the pages a won question is cited on (L16 protects them): never rewritten for ANOTHER question (DESIGN 2.F); that question gets a new page
    const protectedBy = new Map(); for (const q of allQ) { const d = byQ.get(q); if (!cellsOf(d).some(x => x.stage === 'S5')) continue; const u = pageOf(d); if (!u) continue; const k = AIRF.urlKey(u); const set = protectedBy.get(k) || new Set(); set.add(q); protectedBy.set(k, set); }
    // question-specific levers: own page (new or refresh, never both), cited-not-named, correction. Never on a control question.
    for (const q of allQ) { const d = byQ.get(q); const control = armOf.get(q) === 'control'; const pu = pageOf(d); const guard = pu ? protectedBy.get(AIRF.urlKey(pu)) : null;
      const onOther = !!guard && !guard.has(q);
      const own = pu && !onOther ? LV.get('L06') : LV.get('L05');   // LIVE1: a refresh needs a concrete page address (stage evidence alone wrote refresh rows with no URL); otherwise a new page
      const listy = !!d.list_dominated && S(d.intent) !== 'informational';   // E26 / R1 7: recommendation answers pick providers from lists; an informational answer's win is the citation
      for (const L of [own, LV.get('L07'), LV.get('L15')]) { const cs = cellsFor(L, [q]); if (!cs.length) continue;
        const extra = { page_url: L.id === 'L05' ? '' : pageOf(d), factor: OWN_PAGE.includes(L.id) && listy ? 0.5 : 1,
          why: L.id === 'L05' ? (onOther ? 'its closest page (' + pu + ') wins AI answers for ' + [...guard].join(', ') + ' and is protected: a new page for this question instead of rewriting it' : 'no page of the site is found for the searches the engines run') + (listy ? '; the answers are built from lists, so write an honest comparison or cost guide, never a self-ranked list (own-page chance halved)' : '')
            : L.id === 'L06' ? 'a page of the site is found but not cited' + (listy ? '; the answers are built from lists (own-page chance halved)' : '') : L.id === 'L07' ? 'the answers cite the site but do not name it' : 'an answer states something wrong about the business' };
        if (control) extra.refused = 'held out as a control question: no question-specific action while it is in the control group (1 in 3, 12 weeks)';
        add(L, ['L06', 'L07'].includes(L.id) && extra.page_url ? { prompt_id: q, url: extra.page_url } : { prompt_id: q }, cs, extra); } }   // FX-A2: L07 stores the page it fixes (refKey keys on prompt_id, so its id is unchanged)
    // protect what wins (L16): the client's page cited for a won question, one action per page with every won cell it carries
    { const L = LV.get('L16'); const byPage = new Map(); for (const q of allQ) { const cs = cellsFor(L, [q]); if (!cs.length) continue; const u = pageOf(byQ.get(q)); const k = u ? AIRF.urlKey(u) : 'p:' + q;
        const g = byPage.get(k) || { url: u, q, cells: [] }; g.cells.push(...cs); byPage.set(k, g); }
      for (const [, g] of [...byPage.entries()].sort()) add(L, g.url ? { url: g.url } : { prompt_id: g.q }, g.cells, { page_url: g.url, exposure: true, why: 'AI answers cite this page for a question the business wins; a rewrite for another keyword could lose it' }); }
    // pages the answers are built from: lists (L08), directories and review sites (L09), registries (L10); community threads (L13) and videos (L14)
    const comm = [], vid = []; const dirs = new Map();
    const srcs = (Array.isArray(sources) ? sources : []).filter(s => s && S(s.url) && !isOurs(s.url, hosts)).slice().sort((a, b) => (AIRF.urlKey(a.url) < AIRF.urlKey(b.url) ? -1 : 1));
    for (const s of srcs) { const pt = S(s.page_type), ak = S(s.author_kind); const qs = arr(s.questions).map(S).filter(q => byQ.has(q)); const es = arr(s.engines).map(S).filter(AIRF.usable); if (!qs.length) continue;
      if (s.names_client === true) continue;   // already on it: nothing to place (L16 protects what wins)
      const pl = N(s.placeability, 0); const ref = { url: S(s.url) };
      if (pt === 'listicle') { const L = LV.get('L08'); const cs = cellsFor(L, qs, es.length ? es : null);
        const extra = { page_url: S(s.url), factor: rd(clamp(pl / 0.15, 0, 1), 4), why: 'a list the answers cite for ' + qs.length + ' question(s) does not name the business' + (S(s.contact_email || s.contact_url) ? '' : '; no contact found yet') };
        if (ak === 'rival' && !optIn.has(AIRF.urlKey(s.url))) extra.refused = 'a list written by a competitor: learn from it (format, who wins, its searches), never pitch it (owner decision 8)';
        else if (!(pl > 0)) extra.refused = 'placeability 0' + (S(s.placeability_why) ? ': ' + S(s.placeability_why) : '');
        add(L, ref, cs, extra); }
      else if (pt === 'directory' || pt === 'review') { const L = LV.get('L09'); const cs = cellsFor(L, qs, es.length ? es : null); const lid = listingIdOf(s.url);
        // RA-17 (FX-A): every cited page of one directory is served by ONE profile: the pages' cells are merged into one candidate (all URLs kept)
        const gk = lid ? 'l:' + lid : 'u:' + AIRF.urlKey(s.url); const g = dirs.get(gk) || { ref: lid ? { listing_id: lid } : ref, pt, urls: [], cells: [], qs: [], pl: 0, why0: S(s.placeability_why) };
        g.urls.push(S(s.url)); g.qs.push(...qs); g.pl = Math.max(g.pl, pl); if (!g.why0) g.why0 = S(s.placeability_why);
        for (const c of cs) if (!g.cells.some(x => x.prompt_id === c.prompt_id && x.engine === c.engine)) g.cells.push(c); dirs.set(gk, g); }
      else if (pt === 'registry') { const L = LV.get('L10'); const cs = cellsFor(L, qs, es.length ? es : null);
        const extra = { page_url: S(s.url), factor: rd(clamp(pl / 0.5, 0, 1), 4), why: 'an official list of providers the answers cite' };
        if (!(pl > 0)) extra.refused = 'not eligible for this list' + (S(s.placeability_why) ? ': ' + S(s.placeability_why) : '');
        add(L, ref, cs, extra); }
      else if (pt === 'community') comm.push(...qs); else if (pt === 'video') vid.push(...qs); }
    for (const [, g] of dirs) { const L = LV.get('L09'); const nq = uniq(g.qs).length;
      const extra = { page_url: g.urls[0], factor: rd(clamp(g.pl / 0.8, 0, 1), 4), why: 'a ' + g.pt + ' page the answers cite for ' + nq + ' question(s) does not list the business' + (g.urls.length > 1 ? ' (' + g.urls.length + ' of its pages are cited: one profile serves them all)' : '') };
      if (g.urls.length > 1) extra.page_urls = g.urls.slice();
      if (!(g.pl > 0)) extra.refused = 'placeability 0' + (g.why0 ? ': ' + g.why0 : '');
      add(L, g.ref, g.cells, extra); }
    add(LV.get('L13'), {}, cellsFor(LV.get('L13'), uniq(comm).sort()), { why: 'the answers cite community threads for these questions; answer them openly as the business' });
    add(LV.get('L14'), {}, cellsFor(LV.get('L14'), uniq(vid).sort()), { why: 'the answers cite videos for these questions' });
    // site-wide, long-run levers
    add(LV.get('L11'), {}, cellsFor(LV.get('L11'), allQ), { why: 'independent mentions are the strongest correlate of being named, and the only route into answers given from memory' });
    add(LV.get('L12'), {}, cellsFor(LV.get('L12'), allQ), { why: 'B2B answers cite LinkedIn articles by named people' });
    const earned = (stored_actions || []).filter(a => a && S(a.lever) === 'L11' && S(a.status) === 'verified').length;
    if (earned >= 3) add(LV.get('L17'), {}, cellsFor(Object.assign({}, LV.get('L17'), { next: { S1: 'S2', S2: 'S3', S3: 'S4', S4: 'S4' } }), allQ), { why: earned + ' earned mentions verified: the notability gate holds' });
    return out; };

  // ================================================================ E. score and choose
  const asNum = (m, k, field, d) => { const v = mget(m, k); return v == null ? d : typeof v === 'object' ? N(v[field], d) : N(v, d); };
  /** one-step look-ahead for eligibility (S0 -> S1): U(S1) - U(S0) is only 0.03, but S0 is a gate (R1: "without it the effect is 0 on that engine");
   *  the value of reaching S1 includes the best next step from S1 among the levers always open to a site: an own page (L05), an earned mention (L11),
   *  a LinkedIn article (L12). Levers that need a cited page (lists, directories, registries) are left out: they may not exist (fixes/P2.md 2) */
  const CONT = ['L05', 'L11', 'L12'];
  const contAt = (stage, engine, group, priors, site_id) => { let best = 0; for (const L of LEVERS) { if (!CONT.includes(L.id) || !L.from.includes(stage)) continue;
    const t = L.next[stage]; if (!t) continue; const p = Math.min(0.95, priorOf({ lever: L.id, stage, group, priors, site_id }).mean * multOf(L, engine)); best = Math.max(best, p * (U[t] - U[stage])); } return best; };
  /** gain(a) = sum over cells w_e V F p (U(next) - U(s)); cost = usd + effort / 60 * H + 0.5; score = gain / cost / (1 + days_typ / 60). Protect (L16): the loss
   *  avoided, U(S5) - U(S2). p = prior mean x engine multiplier x the candidate's factor (placeability, list-dominated own page), at most 0.95 */
  const score = (candidate, { priors, values, feas, weights, H } = {}) => { const c = candidate || {}; const L = LV.get(S(c.lever));
    if (!L) return { gain: 0, cost: 0, score: 0, p_by_cell: [], days: 0, why: 'unknown lever' };
    const W = Object.assign({}, ENGINE_W, weights || {}); const hh = H == null ? COST.H : N(H, COST.H); const costRaw = N(L.usd, 0) + N(L.effort_min, 0) / 60 * hh + COST.overhead_usd; const cost = costOf(L, hh); const days = L.days ? L.days[1] : 0;
    const fac = N(c.factor, 1); let gain = 0; const pc = []; const memo = new Map();
    for (const cell of (c.cells || [])) { const s0 = S(cell.stage); const e = S(cell.engine); const grp = AIRF.GROUP_OF[e]; if (!grp || !(s0 in U)) continue;
      const s = effFrom(L, s0) || (L.id === 'L17' ? (s0 === 'S0' ? 'S1' : s0) : s0);   // an off-site lever on an S0 cell is priced from S1, its gain from S0
      const t = L.id === 'L16' ? 'S5' : L.next[s] || (L.id === 'L17' ? ({ S1: 'S2', S2: 'S3', S3: 'S4', S4: 'S4' })[s] : ''); if (!t) continue;
      const key = s + '|' + grp; if (!memo.has(key)) memo.set(key, priorOf({ lever: L.id, stage: s, group: grp, priors, site_id: c.site_id }));
      const pr = memo.get(key); const mean = L.prior ? pr.mean : (L.id === 'L17' ? 0.05 : 0);
      const p = Math.min(0.95, mean * multOf(L, e) * fac * (cell.provisional === true ? PROV : 1));   // a provisional S0 / S1 (0-3 answers, read from the index or a rank proxy): mild doubt
      let du = L.id === 'L16' ? U.S5 - U.S2 : U[t] - U[s0]; if (ELIG.includes(L.id)) du += contAt(t, e, grp, priors, c.site_id);
      if (!(du > 0) || !(p > 0)) continue;
      const w = N(W[e], 0), V = asNum(values, cell.prompt_id, 'V', 1), F = asNum(feas, cell.prompt_id, 'F', 0.5);
      const rk = OWN_PAGE.includes(L.id) ? rankChance(feas, cell.prompt_id) : 1;
      const ns = cell.no_search === true && LONG_RUN.includes(L.id) ? NO_SEARCH_DISCOUNT : 1;   // RA-15: an answer from memory moves only after the next training release
      const g = w * V * F * p * rk * ns * du; gain += g; pc.push({ prompt_id: cell.prompt_id, engine: e, stage: s0, to: t, p: rd(p * rk, 4), gain: rd(g), head: rd(w * V * F * (U.S5 - U[s0])) }); }   // head: what the cell still has to win
    const sc = costRaw > 0 ? gain / costRaw / (1 + days / 60) : 0; const head = pc.reduce((a, x) => a + x.head, 0);
    return { gain: rd(gain, 8), cost, score: rd(sc, 12), head: rd(head, 8), efficiency: head > 0 ? rd(gain / head, 6) : gain > 0 ? 1 : 0, p_by_cell: pc, days, why: L.label + ': ' + pc.length + ' cell(s), expected gain ' + rd(gain, 4) + ' over $' + rd(cost, 2) + ' (client time at $' + hh + ' an hour), typical ' + days + ' days' }; };
  /** an own page helps only if it ranks for the searches the engines run (R1 lever 2, E24): its chance scales with the site's reach against the keyword,
   *  reach_w / 0.5 within [0.2, 1.5] (the median site keeps the prior). Unknown reach: 1. Other levers do not depend on the client's own ranking. */
  const rankChance = (feas, q) => { const f = mget(feas, q); const r = f && typeof f === 'object' && !/reach not stored/.test(S(f.basis)) ? N(f.reach_w, null) : null; return r == null ? 1 : clamp(r / 0.5, 0.2, 1.5); };
  const meanP = (pc) => { const xs = (pc || []).filter(x => x.gain > 0); return xs.length ? rd(xs.reduce((s, x) => s + x.p, 0) / xs.length, 4) : 0; };
  /** greedy by score under the weekly caps (DESIGN 2.E). `scored`: candidates each with `.scored` = score(...) (or the score fields merged in).
   *  `open_actions`: stored action rows; rows with status 'shadow' never hold a slot (a shadow plan is made fresh each week). With `now` (and
   *  `units60`) every chosen action is pre-registered before it is returned. */
  const choose = (scored, { capacities, arms, mode, open_actions, now, units60, exposure } = {}) => { const md = S(mode) || 'off'; const res = { chosen: [], deferred: [], refused: [] };
    if (md === 'off' || !AIRF.MODES.includes(md)) return res;
    const cap = Object.assign({}, CAPS, capacities || {}); const armOf = new Map((arms || []).map(a => [S(a && a.prompt_id), S(a && a.arm)]));
    const openRows = (open_actions || []).filter(a => a && OPEN.includes(S(a.status)));
    const openIds = new Set(openRows.map(a => S(a.action_id)));
    const openHuman = openRows.filter(a => HUMAN_NEW.includes(S(a.lever)) && S(a.status) !== 'done').length;
    const ownQ = new Set(openRows.filter(a => OWN_PAGE.includes(S(a.lever))).map(a => S((parse(a.ref, {}) || {}).prompt_id)).filter(Boolean));
    const refusedSeen = new Set(); const refuse = (what, why) => { const k = what + '|' + why; if (!refusedSeen.has(k)) { refusedSeen.add(k); res.refused.push({ what, why }); } };
    const items = (scored || []).filter(Boolean).map(x => ({ c: x, s: x.scored || x }));
    const ok = [];
    for (const it of items) { const c = it.c; const L = LV.get(S(c.lever)); if (!L) continue;
      const what = L.label + (c.page_url ? ' (' + c.page_url + ')' : c.ref && c.ref.prompt_id ? ' (question ' + c.ref.prompt_id + ')' : '');
      if (ZERO_WEIGHT.includes(S(c.lever))) { refuse(what, 'weight 0: kept as hygiene in the audit fix pack, never an AI-ranking action'); continue; }
      if (c.refused) { refuse(c.ref && c.ref.prompt_id ? 'question-specific actions on question ' + c.ref.prompt_id : what, S(c.refused)); continue; }
      if (L.scope === 'question' && (c.questions || []).some(q => armOf.get(S(q)) === 'control')) { refuse('question-specific actions on question ' + c.questions.join(', '), 'held out as a control question'); continue; }
      if (!ELIG.includes(L.id) && !OFF_SITE.includes(L.id) && (c.cells || []).some(x => S(x.stage) === 'S0')) { refuse(what, 'a cell the engine cannot read: only eligibility steps or a third-party page apply'); continue; }
      ok.push(it); }
    ok.sort((x, y) => N(y.s.score, 0) - N(x.s.score, 0) || (S(x.c.action_id) < S(y.c.action_id) ? -1 : 1));
    let own = 0, pitches = 0, human = 0, protect = 0; const ownNow = new Set(); const expNow = [];
    const absMin = cap.min_gain != null; const effMin = N(cap.min_efficiency, 0), gMin = absMin ? N(cap.min_gain, 0) : N(cap.min_gain_abs, 0);
    const effOf = (sc) => (sc.efficiency != null ? N(sc.efficiency, 0) : N(sc.head, 0) > 0 ? N(sc.gain, 0) / N(sc.head, 0) : 1);
    const tooSmall = (sc) => N(sc.gain, 0) < gMin || (!absMin && effOf(sc) < effMin);
    const floorWhy = (sc) => absMin || N(sc.gain, 0) < gMin ? 'below the minimum ' + gMin : 'expected to win ' + pct1(effOf(sc)) + '% of what its cells still have to win (' + pct1(effMin) + '% needed)';
    res.floor = absMin ? { min_gain: gMin, basis: 'absolute, given' } : { min_efficiency: effMin, min_gain: gMin, basis: 'share of what the action\'s own cells still have to win' };
    const defer = (c, why) => res.deferred.push({ action: c, why });
    for (const { c, s } of ok) { const L = LV.get(c.lever);
      if (tooSmall(s) && !(ELIG.includes(L.id) && N(s.gain, 0) > 0)) { defer(c, 'expected gain ' + rd(N(s.gain, 0), 5) + ': ' + floorWhy(s)); continue; }   // eligibility is a gate: never dropped for size
      if (openIds.has(S(c.action_id))) { defer(c, 'already open'); continue; }
      if (OWN_PAGE.includes(L.id)) { const q = S(c.questions[0]); if (ownQ.has(q) || ownNow.has(q)) { defer(c, 'one own page per question: one is already planned'); continue; } if (own >= cap.own_pages) { defer(c, 'no content slot left this week (' + cap.own_pages + ')'); continue; } }
      if (L.id === 'L08' && pitches >= cap.pitches) { defer(c, 'placement pitches this week: ' + cap.pitches + ' already'); continue; }
      if (HUMAN_NEW.includes(L.id)) { if (human >= cap.human_new) { defer(c, 'new steps for a person this week: ' + cap.human_new + ' already'); continue; } if (openHuman + human >= cap.human_open_max) { defer(c, 'already ' + cap.human_open_max + ' steps open for a person'); continue; } }
      if (L.id === 'L16' && protect >= cap.protect) { defer(c, 'protected pages: ' + cap.protect + ' already'); continue; }
      if (OWN_PAGE.includes(L.id)) { own++; ownNow.add(S(c.questions[0])); } if (L.id === 'L08') pitches++; if (HUMAN_NEW.includes(L.id)) human++; if (L.id === 'L16') protect++;
      const a = { action_id: c.action_id, site_id: c.site_id, lever: L.id, executor: L.executor, scope: L.scope, ref: c.ref || {}, questions: (c.questions || []).slice(), engines: (c.engines || []).slice(), target_stage: L.to,
        expected: { p: meanP(s.p_by_cell), gain: rd(N(s.gain, 0)), cost: N(s.cost, 0), score: N(s.score, 0), days: N(s.days, 0) }, prereg: null, sink: L.sink, sink_ref: '',
        label: L.label, intent: c.intent || 'mixed', keyword: S(c.keyword), page_url: S(c.page_url), why: S(c.why) };
      if (now != null) a.prereg = prereg(a, { arms, units60, now, exposure: (exposure || []).concat(expNow) });
      if (!UNIFORM.includes(L.id)) expNow.push({ action_id: a.action_id, lever: L.id, questions: a.questions, from: now == null ? '' : isoOf(now), to: '' });   // this week's other steps are exposure too (RA-4)
      res.chosen.push(a); }
    return res; };

  // ================================================================ E. pre-registration
  /** RA-16 (FX-A): how long an action may wait for our check to find it happened, from its registration (or, for a placement, from the pitch):
   *  the lever's own longest time to effect (days[2]), at least its window, plus 14 days. The window itself is kept for the outcome only. */
  const expiryDays = (lever, pre) => { const L = typeof lever === 'string' ? LV.get(S(lever)) : lever; const p = pre || {}; const stored = N(p.expire_days, null); if (stored != null && stored > 0) return stored;
    const win = N(p.window_days, L && L.days ? Math.max(28, L.days[1]) : 28); return Math.max(win, L && L.days ? N(L.days[2], win) : win) + 14; };
  const metricOf = (action) => { const L = LV.get(S(action.lever)) || {}; if (ELIG.includes(L.id) || SITE_WIDE.includes(L.id)) return 'stage'; if (L.id === 'L16') return 'cited_rate'; return S(action.intent) === 'informational' ? 'cited_rate' : 'named_rate'; };
  /** written once, before anything is executed, never edited: questions, engines, controls (the control arm, minus every question the action touches),
   *  the metric, the window (the lever's typical days, at least 28), when the clock starts, and the projection. */
  const prereg = (action, { arms, units60, now, exposure } = {}) => { const a = action || {}; const L = LV.get(S(a.lever)); const nowMs = msOf(now);
    const qs = (a.questions || []).map(S); const touched = new Set(qs);
    // RA-4 (FX-A): a control question another action is working on right now (a page-level or community step whose cells include it) is no control
    const busy = new Set(); for (const x of (Array.isArray(exposure) ? exposure : [])) { if (!x || S(x.action_id) === S(a.action_id) || UNIFORM.includes(S(x.lever))) continue;
      const to = msOf(x.to); if (isFinite(nowMs) && isFinite(to) && to < nowMs) continue; for (const q of (x.questions || [])) busy.add(S(q)); }
    const site = L && SITE_WIDE.includes(L.id); const elig = L && ELIG.includes(L.id) && L.scope === 'site';
    const strat = new Map((arms || []).map(x => [S(x && x.prompt_id), S(x && x.stratum)])); const myStrata = new Set(qs.map(q => strat.get(q)).filter(Boolean));
    const controls = site || elig ? [] : (arms || []).filter(x => x && S(x.arm) === 'control' && !touched.has(S(x.prompt_id)) && !busy.has(S(x.prompt_id))).map(x => S(x.prompt_id))
      .sort((x, y) => (myStrata.has(strat.get(x)) ? 0 : 1) - (myStrata.has(strat.get(y)) ? 0 : 1) || (x < y ? -1 : 1));
    const window_days = L && L.days ? Math.max(28, L.days[1]) : 28; const metric = metricOf(a); const expire_days = expiryDays(L, { window_days });
    const ex = a.expected || {}; const pr = { metric, questions: qs, engines: (a.engines || []).map(S), controls, window_days, t0_rule: L && (OWN_PAGE.includes(L.id) || L.id === 'L16') ? 'live_at' : 'happened_at',
      projected: { p: N(ex.p, 0), gain: N(ex.gain, 0) }, registered_at: isFinite(nowMs) ? new Date(nowMs).toISOString() : '', lever: S(a.lever), rule_version: RULE, expire_days,
      control_note: site || elig ? 'no control possible: it touches every question; judged on whether it happened, on the leading indicators and against the questions\' own trend before it' : controls.length ? (busy.size && (arms || []).some(x => x && S(x.arm) === 'control' && busy.has(S(x.prompt_id))) ? 'held-back questions another step is working on are left out' : '') : 'no control question available' };
    if (isFinite(nowMs) && Array.isArray(units60) && units60.length) { const from = nowMs - 28 * DAY; const ys = metric === 'cited_rate' ? 'cited' : 'named'; const cs = new Set(controls); const es = new Set(pr.engines);
      const b = { t: { k: 0, n: 0 }, c: { k: 0, n: 0 } }; for (const u of units60) { if (!u || !AIRF.usable(u.engine) || (es.size && !es.has(u.engine))) continue; const t = msOf(u.at); if (!(t > from && t <= nowMs)) continue;
        const q = S(u.prompt_id); const g = touched.has(q) ? b.t : cs.has(q) ? b.c : null; if (!g) continue; g.n++; if (u[ys]) g.k++; } pr.baseline = Object.assign(b, { days: 28, metric: ys }); }
    return pr; };
  /** the stored registration wins: a later run never rewrites it (prereg_json is written once) */
  const keepPrereg = (storedRow, fresh) => { const st = parse(storedRow && (storedRow.prereg_json != null ? storedRow.prereg_json : storedRow.prereg), null); return st && S(st.registered_at) ? st : fresh; };

  // ================================================================ G1. did it happen (our own check)
  const kwNorm = (s) => S(s).toLowerCase().replace(/[^a-z0-9\u00c0-\uffff]+/g, ' ').trim();
  const CHATGPT_TYPE = ['chatgpt', 'chatgpt_api', 'perplexity', 'claude', 'copilot'];
  const verify = (action, { contentLog, pages, index, listings, outreach, sources, robots, bing, now } = {}) => { const a = action || {}; const L = LV.get(S(a.lever)); const nowMs = msOf(now);
    const pr = parse(a.prereg_json != null ? a.prereg_json : a.prereg, {}) || {}; const reg = msOf(pr.registered_at || a.created_at); const win = N(pr.window_days, L && L.days ? Math.max(28, L.days[1]) : 28);
    const res = (happened, at, evidence, extra) => Object.assign({ happened, at: at ? isoOf(at) : '', evidence }, extra || {});
    // RA-16: the clock runs to the lever's longest time to effect + 14 days (not its typical window); a placement's clock starts when the pitch is sent
    const url0 = S((a.ref || parse(a.ref, {}) || {}).url) || S(a.page_url);
    const sentAt = L && L.id === 'L08' && url0 ? (outreach || []).filter(o => o && AIRF.urlKey(o.page_url || o.source_url) === AIRF.urlKey(url0) && /sent|replied|contacted/.test(S(o.status))).map(o => msOf(o.sent_at || o.contacted_at || o.updated_at)).filter(isFinite).sort((x, y) => x - y)[0] : NaN;
    const clock = isFinite(sentAt) && isFinite(reg) ? Math.max(reg, sentAt) : reg; const expDays = expiryDays(L, Object.assign({}, pr, { window_days: win }));
    const expired = isFinite(clock) && isFinite(nowMs) && nowMs > clock + expDays * DAY;
    const notYet = (why) => res(false, '', [why], { expired, why: expired ? 'not verified within ' + expDays + ' days (the step\'s longest time to effect + 14 days)' : why });
    if (!L) return res(null, '', ['unknown lever']);
    if (S(a.status) === 'shadow' || S(a.mode) === 'shadow') return res(false, '', ['shadow: nothing is executed'], { expired: false });
    const url = S((a.ref || parse(a.ref, {}) || {}).url) || S(a.page_url); const key = AIRF.urlKey(url);
    const after = (t) => !isFinite(reg) || msOf(t) >= reg - DAY;
    const srcRow = (k) => (sources || []).find(s => s && AIRF.urlKey(s.url) === k);
    const pageRow = (k) => (pages || []).find(p => p && AIRF.urlKey(p.url) === k);
    const gIdx = (k) => S(mget(index && index.google, k)); const bCrawl = (k) => S(mget(((index && index.bing) || bing || {}).crawled, k));
    if (L.id === 'L01') { const bl = ((robots || {}).blocked_engines || []).map(S); const at = (robots || {}).read_at;
      if (!robots || !at || !after(at)) return notYet('robots.txt not read since the step was asked');
      const still = (a.engines || []).filter(e => bl.includes(S(e))); return still.length ? notYet('robots.txt still blocks ' + still.join(', ')) : res(true, at, ['robots.txt read ' + isoOf(at).slice(0, 10) + ' allows the AI search bots']); }
    if (L.id === 'L02') { const p = pageRow(key); if (!p || !after(p.checked_at)) return notYet('the page has not been read since the step was asked');
      return N(p.status, 0) === 200 && N(p.words_raw, 0) >= 150 ? res(true, p.checked_at, [N(p.words_raw, 0) + ' words in the raw HTML (read ' + S(p.checked_at).slice(0, 10) + ')']) : notYet('still ' + N(p.words_raw, 0) + ' words before JavaScript runs'); }
    if (L.id === 'L03') { const b = (index && index.bing) || bing || {}; if (b.in_account !== true) return notYet('the site is not in the Bing Webmaster account yet');
      const crawled = [...(b.crawled && typeof b.crawled.entries === 'function' ? b.crawled.entries() : Object.entries(b.crawled || {}))].filter(([, t]) => after(t)).sort((x, y) => (x[1] < y[1] ? -1 : 1));
      return crawled.length ? res(true, crawled[0][1], ['in the Bing account; ' + crawled[0][0] + ' crawled ' + S(crawled[0][1]).slice(0, 10)]) : notYet('in the Bing account, no page crawled since'); }
    if (L.id === 'L04') { const st = gIdx(key); return st === 'indexed' ? res(true, nowMs, ['Google index state of ' + key + ': indexed']) : notYet('Google index state: ' + (st || 'not read')); }
    if (OWN_PAGE.includes(L.id)) { const kw = kwNorm(a.keyword); const rows = (contentLog || []).filter(r => r && S(r.status) === 'published' && S(r.published_url) && (['ai_answer', 'ai_refresh'].includes(S(r.source)) || L.id === 'L06')
        && ((kw && kwNorm(r.keyword) === kw) || (url && AIRF.urlKey(r.published_url) === key)) && after(r.published_at || r.started_at)).sort((x, y) => (S(x.published_at) < S(y.published_at) ? -1 : 1));
      if (!rows.length) return notYet('no published page for this question yet');
      const r = rows[0]; const k = AIRF.urlKey(r.published_url); const p = pageRow(k); const pub = msOf(r.published_at);
      if (!p || N(p.status, 0) !== 200 || (isFinite(pub) && msOf(p.checked_at) < pub)) return notYet('published ' + S(r.published_at).slice(0, 10) + '; our fetch has not seen it live (HTTP 200) yet');
      const gi = gIdx(k) === 'indexed', bi = !!bCrawl(k); const es = (a.engines || []).map(S); const needG = es.some(e => AIRF.GROUP_OF[e] === 'google'), needB = es.includes('copilot');
      if (!(gi || bi) || (needG && !needB && !gi) || (needB && !needG && !bi)) return notYet('live, not yet in the index the engines search');
      if (es.some(e => CHATGPT_TYPE.includes(e)) && N(p.words_raw, 0) < 150) return notYet('live and indexed, but the raw HTML holds ' + N(p.words_raw, 0) + ' words (the AI fetchers run no JavaScript)');
      const live = Math.max(isFinite(pub) ? pub : 0, msOf(p.checked_at) || 0); return res(true, live, ['published ' + S(r.published_at).slice(0, 10) + ', HTTP 200, ' + (gi ? 'indexed in Google' : 'crawled by Bing') + ', ' + N(p.words_raw, 0) + ' raw words'], { live_at: isoOf(live), url: S(r.published_url) }); }
    // FX-A2: L07 fixes a passage on the client's OWN page (its ref holds the page since FX-A2). Done when our fetch of that page after the step was asked
    // finds it live (HTTP 200) and showing a change since then (its visible update date); an own page is never in the third-party source graph
    if (L.id === 'L07') { if (!key) return notYet('the page this step fixes is not recorded on the action'); const p = pageRow(key); if (!p || !after(p.checked_at)) return notYet('the page has not been read since the step was asked');
      if (N(p.status, 0) !== 200) return notYet('the page answers HTTP ' + (N(p.status, 0) || 'nothing') + ', not 200');
      const up = msOf(p.updated_on); return isFinite(up) && after(up) ? res(true, p.checked_at, ['our fetch of ' + key + ' on ' + S(p.checked_at).slice(0, 10) + ': live, updated ' + S(p.updated_on).slice(0, 10)]) : notYet('the page is live but shows no update since the step was asked'); }
    if (L.id === 'L08') { const s = srcRow(key); if (!s) return notYet('the page has not been read since the step was asked');
      const t = s.checked_at || s.last_seen; if (s.names_client == null) return res(null, '', ['the page could not be read (blocked): cannot confirm'], { expired });
      if (s.names_client === true && after(t)) return res(true, t, ['our fetch of ' + key + ' on ' + S(t).slice(0, 10) + ' finds the business named']);
      const sent = (outreach || []).find(o => o && AIRF.urlKey(o.page_url) === key && /sent|replied/.test(S(o.status)));
      return notYet('the page does not name the business yet' + (sent ? ' (pitch ' + S(sent.status) + ')' : '')); }
    if (L.id === 'L09' || L.id === 'L10') { const lid = S((a.ref || {}).listing_id); const li = (listings || []).find(r => r && ((lid && S(r.listing_id) === lid) || (key && AIRF.urlKey(r.profile_url) === key)));
      if (li && /^(linked|listed)$/.test(S(li.status)) && after(li.checked_at)) return res(true, li.checked_at, ['listing ' + (lid || key) + ' is ' + S(li.status) + (S(li.profile_url) ? ' at ' + S(li.profile_url) : '')]);
      const s = key ? srcRow(key) : null; if (s && s.names_client === true && after(s.checked_at || s.last_seen)) return res(true, s.checked_at || s.last_seen, ['our fetch finds the business on ' + key]);
      if ((s && s.names_client == null) || (li && /unknown|blocked/.test(S(li.status)))) return res(null, '', ['the platform blocks our check: unconfirmed'], { expired });
      return notYet('no listing found yet'); }
    if (L.id === 'L16') return S(a.sink_ref) ? res(true, reg, ['the page is protected (' + S(a.sink_ref) + ')']) : notYet('not protected yet');
    // L11-L15, L17: the client pastes the address on the step (the app stores it as client_url and, when its own fetch finds the business named,
    // a source row: names_client true, source_from 'client'). FX-A2: the address must pass the safe fetcher's rules (https, no credentials, no IP
    // literal, a public host; L17 a Wikidata item) and the page must have been read live AFTER the step was asked and name the business. A source
    // row that does not say it names the business never counts; the client's own page counts for a correction (L15) only when our fetch read it HTTP 200.
    const cu = S(a.client_url); if (!cu) return notYet('waiting for the address from the client (paste it on the step)');
    const bad = safeUrlWhy(cu, L.id); if (bad) return notYet('the address cannot be checked: ' + bad);
    const ck = AIRF.urlKey(cu); const s = srcRow(ck); const own = pageRow(ck);
    if (s) { const t = s.checked_at || s.last_seen; if (!after(t)) return notYet('the address has not been read since the step was asked'); if (s.names_client == null) return res(null, '', ['the page could not be read: cannot confirm'], { expired });
      return s.names_client === true ? res(true, t, ['our fetch of ' + ck + ' on ' + S(t).slice(0, 10) + ' finds the business named']) : notYet('the page does not name the business'); }
    if (own && L.id === 'L15') { if (!after(own.checked_at)) return notYet('the page has not been read since the step was asked');
      return N(own.status, 0) === 200 ? res(true, own.checked_at, ['our fetch of ' + ck + ' on ' + S(own.checked_at).slice(0, 10) + ': the business\'s own page, live']) : notYet('the page answers HTTP ' + (N(own.status, 0) || 'nothing') + ', not 200'); }
    return notYet('the address has not been read yet'); };
  /** FX-A2: the safe fetcher's rules for an address a client gives (as the app's): '' when it may be checked, else why not */
  const safeUrlWhy = (u, lever) => { const m = S(u).match(/^https:\/\/([^\/?#\s]*)/i); if (!m) return 'it is not an https address'; const auth = m[1];
    if (auth.indexOf('@') >= 0) return 'it carries a user name or password'; const hp = auth.toLowerCase(); const host = hp.replace(/:(\d+)$/, '').replace(/\.$/, ''); const port = (hp.match(/:(\d+)$/) || [])[1];
    if (port && port !== '443') return 'it names a port'; if (/^\[|:/.test(host) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /^0x|^\d+$/.test(host)) return 'it is an IP address, not a website';
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) || /(^|\.)(localhost|local|internal|intranet|lan|home|corp|invalid)$/.test(host)) return 'it is not a public website';
    if (lever === 'L17' && !/(^|\.)wikidata\.org$/.test(host)) return 'an entity step needs a Wikidata item address';
    return ''; };

  // ================================================================ G2-G3. did it move the stage, and the lift tests
  const diagMap = (x) => { const m = new Map(); if (x && typeof x.get === 'function') { for (const [k, v] of x.entries()) m.set(S(k), v); return m; } for (const d of (Array.isArray(x) ? x : [])) if (d && S(d.prompt_id)) m.set(S(d.prompt_id), d); return m; };
  const stageAt = (m, q, e) => { const d = m.get(q); const c = d && d.engines && d.engines[e]; return c ? { stage: S(c.stage), sub: S(c.sub), c } : null; };
  /** DiD through AVX.impact on the action's engines, its questions and its pre-registered controls only. Pre-period: the 28 days before t0; post: the
   *  window after t0. AVX compares equal windows, so the post answers' times are scaled into 28 days (the estimator uses counts per question and
   *  period only, so the result is the same DiD); with a 28-day window this is exactly AVX.impact. p: two-sided, from the bootstrap range. */
  const didOf = (units, o) => { const A = avx(); const base = { effect: null, lo: null, hi: null, p: null, B: 0, metric: o.metric, controls_used: [], treated_used: [], why: '' };
    if (!A) return Object.assign(base, { why: 'the measurement kit is not in this node' });
    const t0 = msOf(o.t0), end = Math.min(msOf(o.now), t0 + o.post_days * DAY); if (!isFinite(t0) || !(end > t0)) return Object.assign(base, { why: 'no time after the start' });
    const preD = o.pre_days || 28, W = preD * DAY, sc = W / Math.max(DAY, o.post_days * DAY);
    const qs = new Set(o.questions), cs = new Set(o.controls), es = new Set(o.engines || []); const hist = []; let earliest = Infinity;
    for (const u of (units || [])) { if (!u || !AIRF.usable(u.engine) || (es.size && !es.has(u.engine))) continue; const q = S(u.prompt_id); if (!qs.has(q) && !cs.has(q)) continue; const t = msOf(u.at); if (!isFinite(t)) continue;
      earliest = Math.min(earliest, t); let at; if (t >= t0 - W && t < t0) at = t; else if (t > t0 && t <= end) at = t0 + (t - t0) * sc; else continue;
      hist.push({ prompt_id: q, engine: u.engine, named: o.metric === 'cited_rate' ? !!u.cited : !!u.named, at: new Date(at).toISOString() }); }
    const meta = new Map(); for (const [q, s] of (o.strata || new Map())) meta.set(q, { cluster: s });
    const row = A.impact(hist, [{ action_id: o.id, kind: o.lever, at: new Date(t0).toISOString(), questions: [...qs], label: o.label || '' }], { now: new Date(t0 + (end - t0) * sc).toISOString(), window_days: preD, seed: o.seed, B: o.B, meta })[0] || {};
    const d = row.did || {}; const se = d.lo != null && d.hi != null ? (d.hi - d.lo) / (2 * 1.959963985) : null;
    const p = d.effect != null && se != null && se > 0 ? rd(2 * (1 - normCdf(Math.abs(d.effect) / se)), 4) : d.effect != null && se === 0 ? (d.effect === 0 ? 1 : 0) : null;
    return Object.assign(base, { effect: d.effect == null ? null : d.effect, lo: d.lo == null ? null : d.lo, hi: d.hi == null ? null : d.hi, p, B: d.B || 0, controls_used: row.control_questions || [], treated_used: row.target_questions || [],
      before: row.before, after: row.after, control_before: row.control_before, control_after: row.control_after, pre_days: preD, post_days: rd((end - t0) / DAY, 1), history_from: isFinite(earliest) ? new Date(earliest).toISOString() : '',
      why: S(row.why).replace(/28 days before and after/g, preD + ' days before and the window after') }); };
  // ---- FX-A: compact stages (RA-9), the t0 snapshot (RA-1 / RA-8), per-question counts and the question-level tests (RA-3, RA-4, RA-12, RA-18) ----
  /** a diagnosis in about 25 characters a cell: { v: 1, q: { prompt_id: { engine: [stage, sub, retrieved 0/1, on_source 1/0/null] } } }; `only` keeps those questions */
  const stagesPack = (diag, only) => { const keep = only ? new Set([...only].map(S)) : null; const q = {};
    for (const d of (Array.isArray(diag) ? diag : [])) { const pid = S(d && d.prompt_id); if (!pid || (keep && !keep.has(pid)) || !d.engines) continue; const e0 = {};
      for (const e of Object.keys(d.engines).sort()) { const c = d.engines[e]; if (!c || typeof c !== 'object' || !AIRF.usable(e)) continue; e0[e] = [S(c.stage), S(c.sub), N(c.retrieved, 0) > 0 ? 1 : 0, 'on_source' in c ? (c.on_source === true ? 1 : 0) : null]; }
      q[pid] = e0; }
    return { v: 1, q }; };
  /** back to ARD's diagnosis shape (prompt_id, engines: { e: { stage, sub, retrieved, on_source? } }); a stored full diagnosis array passes through */
  const stagesUnpack = (x) => { const p = parse(x, null); if (Array.isArray(p)) return p; if (!p || typeof p !== 'object' || !p.q || typeof p.q !== 'object') return [];
    return Object.keys(p.q).sort().map(pid => ({ prompt_id: pid, engines: Object.fromEntries(Object.entries(p.q[pid] || {}).map(([e, c]) => { const v = Array.isArray(c) ? c : [S(c)];
      const o = { stage: S(v[0]), sub: S(v[1]), retrieved: N(v[2], 0) }; if (v[3] === 1 || v[3] === 0) o.on_source = v[3] === 1; return [e, o]; })) })); };
  const Z3 = () => [0, 0, 0];
  /** answers per question on the action's engines, [n, named, cited] per period: p1 = 56-28 days before t0, pre = the 28 days before, h1 / h2 = its
   *  two halves, post = (t0, min(now, t0 + window)] */
  const countsOf = (units, { qs, es, t0, post_days, now }) => { const keep = new Set((qs || []).map(S)); const E = new Set((es || []).map(S)); const end = Math.min(msOf(now), t0 + N(post_days, 0) * DAY);
    const c = new Map(); let earliest = Infinity;
    for (const u of (units || [])) { if (!u || !AIRF.usable(u.engine) || (E.size && !E.has(S(u.engine)))) continue; const q = S(u.prompt_id); if (!keep.has(q)) continue; const t = msOf(u.at); if (!isFinite(t)) continue;
      earliest = Math.min(earliest, t);
      const per = t >= t0 - 28 * DAY && t < t0 ? (t < t0 - 14 * DAY ? ['pre', 'h1'] : ['pre', 'h2']) : t >= t0 - 56 * DAY && t < t0 - 28 * DAY ? ['p1'] : t > t0 && t <= end ? ['post'] : null; if (!per) continue;
      const x = c.get(q) || { p1: Z3(), pre: Z3(), h1: Z3(), h2: Z3(), post: Z3() }; for (const k of per) { x[k][0]++; if (u.named) x[k][1]++; if (u.cited) x[k][2]++; } c.set(q, x); }
    return { c, earliest: isFinite(earliest) ? earliest : null }; };
  const coveredDays = (earliest, from, to) => (earliest == null ? 0 : rd(Math.max(0, Math.min((to - from) / DAY, (to - Math.max(earliest, from)) / DAY)), 1));
  /** RA-1 / RA-8: what the action's questions and its registered controls looked like when it started, frozen in verify_json the first time our check
   *  finds that it happened: their stages (the latest reading at or before t0 within 14 days, else this run's, labelled) and their answer counts before t0
   *  (the 28 days before, its halves and the 28 days before that, for the placebo). The outcome reads them at the end of the window, whatever history is
   *  loaded then (a 60-day window keeps no before-period of its own). `readings`: [{ at, diag (array or packed), basis }]. */
  const snapshotT0 = (action, { t0, readings, diagNow, units, now } = {}) => { const a = action || {}; const pr = parse(a.prereg_json != null ? a.prereg_json : a.prereg, {}) || {}; const T0 = msOf(t0); if (!isFinite(T0)) return null;
    const qs = uniq([...arr(pr.questions && pr.questions.length ? pr.questions : a.questions), ...arr(pr.controls)].map(S).filter(Boolean)).sort(); const es = arr(pr.engines && pr.engines.length ? pr.engines : a.engines).map(S).filter(AIRF.usable);
    let src = null; for (const r of (Array.isArray(readings) ? readings : [])) { const t = msOf(r && r.at); if (!isFinite(t) || t > T0 + 6 * 3600e3 || T0 - t > 14 * DAY) continue; const d = stagesUnpack(r.diag); if (!d.length) continue; if (!src || t > src.t) src = { t, d, basis: S(r.basis) || 'the reading of ' + isoOf(t).slice(0, 10) }; }
    if (!src && Array.isArray(diagNow) && diagNow.length) src = { t: msOf(now), d: diagNow, basis: 'this run\'s reading (' + isoOf(now).slice(0, 10) + '), after the start: no reading on file from the 14 days before it' };
    const cnt = countsOf(units, { qs, es, t0: T0, post_days: 0, now: T0 }); const periods = {};
    for (const q of qs) { const x = cnt.c.get(q); if (x) periods[q] = [...x.pre, ...x.h1, ...x.h2, ...x.p1]; }
    return { at: isoOf(T0), taken_at: isoOf(now), stages_basis: src ? src.basis : 'no reading on file', stages: src ? stagesPack(src.d, qs) : null, periods, engines: es,
      pre_days_covered: coveredDays(cnt.earliest, T0 - 28 * DAY, T0), p1_days_covered: coveredDays(cnt.earliest, T0 - 56 * DAY, T0 - 28 * DAY) }; };
  /** RA-3: the lift test at the unit R1 6 names, the QUESTION. Each question's change between two periods (rate after - rate before, points); the
   *  DiD = mean change of the worked-on questions - mean change of the held-back ones; its variance is the spread of the questions' own changes (pooled
   *  over both arms, or the held-back questions' alone when one question is worked on): s2 (1 / T + 1 / C), t on T + C - 2 (or C - 1) degrees of
   *  freedom. A question's own drift between periods and the correlation of its answers are inside that spread; a resampling of answers missed both
   *  (13% to 19% false "likely helped" for one question). The binomial noise of the counts is a floor under s2. One worked-on question needs at
   *  least 4 held-back questions, any other action 3. p_one: one-sided, judged at ALPHA. */
  const qDid = (cnt, T, C, a, b, metric, opt) => { const o = opt || {}; const yi = metric === 'cited_rate' ? 2 : 1; const minN = N(o.min_n, 3);
    const ch = (q) => { const x = cnt.get(S(q)); if (!x) return null; const A = x[a], Bq = x[b]; if (!A || !Bq || A[0] < minN || Bq[0] < minN) return null; const ra = A[yi] / A[0], rb = Bq[yi] / Bq[0];
      const pa = (A[yi] + 0.5) / (A[0] + 1), pb = (Bq[yi] + 0.5) / (Bq[0] + 1); return { q: S(q), d: 100 * (rb - ra), ra, rb, noise: 1e4 * (pa * (1 - pa) / A[0] + pb * (1 - pb) / Bq[0]) }; };
    const dT = uniq(T.map(S)).map(ch).filter(Boolean), dC = uniq(C.map(S)).map(ch).filter(Boolean);
    const base = { effect: null, lo: null, hi: null, p: null, p_one: null, se: null, df: null, B: 0, method: 'question-level difference in differences: t test on each question\'s change', periods: a + ' -> ' + b, treated_used: dT.map(x => x.q), controls_used: dC.map(x => x.q), why: '' };
    if (!dT.length) return Object.assign(base, { why: 'no worked-on question has at least ' + minN + ' answers in both periods' });
    const minC = dT.length === 1 ? 4 : 3;
    if (dC.length < minC) return Object.assign(base, { why: (dT.length === 1 ? 'one worked-on question can only be compared with at least 4 held-back questions' : 'at least 3 held-back questions are needed') + ' with answers in both periods (' + dC.length + ' have)' });
    const mean = (xs) => xs.reduce((s, x) => s + x.d, 0) / xs.length; const ss = (xs, m) => xs.reduce((s, x) => s + (x.d - m) * (x.d - m), 0);
    const mT = mean(dT), mC = mean(dC); const df = dT.length >= 2 ? dT.length + dC.length - 2 : dC.length - 1;
    const s2raw = (dT.length >= 2 ? ss(dT, mT) + ss(dC, mC) : ss(dC, mC)) / df; const all = dT.concat(dC); const floor = all.reduce((s, x) => s + x.noise, 0) / all.length;
    const s2 = Math.max(s2raw, floor); const se = Math.sqrt(s2 * (1 / dT.length + 1 / dC.length)); const eff = mT - mC; const tq = tInv(1 - ALPHA, df);
    const p_one = rd(se > 0 ? 1 - tCdf(eff / se, df) : (eff > 0 ? 0 : 1), 6);
    const avg = (xs, k) => (xs.length ? rd(100 * xs.reduce((s, x) => s + x[k], 0) / xs.length, 1) : null);
    return Object.assign(base, { effect: rd(eff, 1), lo: rd(eff - tq * se, 1), hi: rd(eff + tq * se, 1), se: rd(se, 3), df, p_one, p: rd(Math.min(1, 2 * Math.min(p_one, 1 - p_one)), 6),
      s2_basis: s2raw >= floor ? (dT.length >= 2 ? 'spread of both arms\' changes' : 'spread of the held-back questions\' changes') : 'binomial noise of the counts (larger than the spread)',
      before: avg(dT, 'ra'), after: avg(dT, 'rb'), control_before: avg(dC, 'ra'), control_after: avg(dC, 'rb') }); };
  /** RA-4: a step that touches every question equally has no control. Interrupted time series per question: its change after the start (post - pre)
   *  minus the change it was already making (2 x (second half - first half of the 28 days before): the same 28-day spacing); mean over the questions,
   *  t on Q - 1 degrees of freedom. Reported, never learned: a market-wide move looks the same. */
  const its = (cnt, Q, metric) => { const yi = metric === 'cited_rate' ? 2 : 1; const xs = [];
    for (const q of uniq(Q.map(S))) { const x = cnt.get(q); if (!x || x.post[0] < 3 || x.pre[0] < 3 || x.h1[0] < 2 || x.h2[0] < 2) continue; const r = (v) => v[yi] / v[0]; xs.push(100 * ((r(x.post) - r(x.pre)) - 2 * (r(x.h2) - r(x.h1)))); }
    const base = { effect: null, lo: null, hi: null, p_one: null, df: null, n_questions: xs.length, method: 'interrupted time series per question: the change after the start minus the trend before it', why: '' };
    if (xs.length < 3) return Object.assign(base, { why: 'fewer than 3 questions with answers before (in both halves) and after' });
    const m = xs.reduce((s, x) => s + x, 0) / xs.length; const df = xs.length - 1; const se = Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / df / xs.length); const tq = tInv(1 - ALPHA, df);
    return Object.assign(base, { effect: rd(m, 1), lo: rd(m - tq * se, 1), hi: rd(m + tq * se, 1), df, p_one: rd(se > 0 ? 1 - tCdf(m / se, df) : (m > 0 ? 0 : 1), 6) }); };
  /** Fisher's exact first-appearance test on questions (one-sided, judged at ALPHA). RA-18: the answer counts are printed for reading only, never tested
   *  (answers to one question are correlated: an answer-level binomial p was far too small) */
  const firstAppearC = (cnt, T, C, metric) => { const yi = metric === 'cited_rate' ? 2 : 1;
    const arm = (qs) => { const r = { k: 0, n: 0, x: 0, m: 0, zero_all: true, any: false }; for (const q of uniq(qs.map(S))) { const x = cnt.get(q); if (!x || !x.pre[0] || !x.post[0]) continue; r.any = true; if (x.pre[yi]) { r.zero_all = false; continue; } r.n++; r.m += x.post[0]; r.x += x.post[yi]; if (x.post[yi]) r.k++; } return r; };
    const A = arm(T), Cc = arm(C);
    return { t: { k: A.k, n: A.n }, c: { k: Cc.k, n: Cc.n }, p_fisher: A.n && Cc.n ? rd(fisher(A.k, A.n, Cc.k, Cc.n), 6) : null, answers: { t: { x: A.x, n: A.m }, c: { x: Cc.x, n: Cc.m } },
      answers_note: 'answer counts for reading only: answers to one question are correlated, so no test is run on them', treated_zero_baseline: A.any && A.zero_all }; };
  const shareOf = (m, qs, es, f) => { let k = 0, n = 0; for (const q of qs) for (const e of es) { const x = stageAt(m, q, e); if (!x || x.stage === 'unmeasured' || !x.stage) continue; n++; if (f(x)) k++; } return n ? { k, n, share: rd(k / n, 4) } : { k: 0, n: 0, share: null }; };
  /** at the end of the pre-registered window: stage moves of the treated cells (from the stages frozen at t0) net of the control background b (same
   *  starting stage, same engine group); the question-level DiD on the metric with a placebo in time (the 28 days before t0 against the 28 before that,
   *  or, with less history, the two halves of the 28 days before); Fisher's exact first-appearance test when every treated question started at zero;
   *  for the steps that touch every question, the interrupted time series; the leading indicators. Controls another step worked on in the same period
   *  are left out (`controls_dropped`). One alpha (ALPHA, one-sided). The verdict never says "caused".
   *  opts: { units60, diagNow, diagAtT0 (fallback when verify_json holds no t0 snapshot), arms, now, B (unused since FX-A), verified, exposure } */
  const outcome = (action, { units60, diagNow, diagAtT0, arms, now, B, verified, exposure } = {}) => { const a = action || {}; const L = LV.get(S(a.lever)); const nowMs = msOf(now);
    const pr = parse(a.prereg_json != null ? a.prereg_json : a.prereg, {}) || {}; const vf = verified || parse(a.verify_json, {}) || {};
    const empty = (verdict, why, extra) => Object.assign({ due: false, stage_moves: { k: 0, n: 0, b: 0, by: [], cells: [] }, did: null, placebo: null, first_appearance: { t: { k: 0, n: 0 }, c: { k: 0, n: 0 }, p_fisher: null }, leading: {}, verdict, why }, extra || {});
    if (!L || !pr.registered_at) return empty('not_due', 'no pre-registration');
    const happened = S(a.status) === 'verified' || vf.happened === true;
    const t0 = msOf(pr.t0_rule === 'live_at' ? (a.live_at || vf.live_at) : (a.happened_at || vf.at)); const win = N(pr.window_days, 28);
    if (!happened) { const expired = S(a.status) === 'expired' || S(a.status) === 'not_happened' || vf.expired === true || (vf.expired === undefined && isFinite(nowMs) && nowMs > msOf(pr.registered_at) + expiryDays(L, pr) * DAY);   // verify's own clock (a placement's from its pitch) wins when it ran
      return expired ? empty('not_happened', 'our check never found that it happened, so it says nothing about what works', { due: true }) : empty('not_due', 'not verified yet: the clock starts when our check finds it happened'); }
    if (!isFinite(t0)) return empty('not_due', 'verified, but the start date (' + pr.t0_rule + ') is not recorded');
    const due = isFinite(nowMs) && nowMs >= t0 + win * DAY;
    const qs = (pr.questions || []).map(S), cs0 = (pr.controls || []).map(S), es = (pr.engines || []).map(S).filter(AIRF.usable);
    // RA-4: a registered control another (non-uniform) step worked on during this one's before or after period is left out; recorded, the registration is never edited
    const exp = (Array.isArray(exposure) ? exposure : []).filter(x => x && S(x.action_id) !== S(a.action_id) && !UNIFORM.includes(S(x.lever)));
    const lo0 = t0 - 28 * DAY, hi0 = t0 + win * DAY; const controls_dropped = [];
    const cs = cs0.filter(q => { const hit = exp.find(x => arr(x.questions).map(S).includes(q) && !(msOf(x.from) > hi0) && !(msOf(x.to) < lo0)); if (hit) controls_dropped.push({ prompt_id: q, by: S(hit.action_id), lever: S(hit.lever) }); return !hit; });
    // RA-1: the stages at t0 come from the snapshot frozen when our check first found the action done; a reading passed in is the fallback
    const snap = vf.t0_snapshot || (parse(a.verify_json, {}) || {}).t0_snapshot || null;
    const mN = diagMap(diagNow), m0 = diagMap(snap && snap.stages ? stagesUnpack(snap.stages) : diagAtT0);
    // stage moves
    const cells = [], byK = new Map(), ctrl = new Map();
    const targetOf = (s) => (L.id === 'L16' ? 'S5' : L.next[s] || (L.id === 'L17' ? ({ S1: 'S2', S2: 'S3', S3: 'S4', S4: 'S4' })[s] : ''));
    const counts = (s, sub) => !!effFrom(L, s) && (!L.sub.length || L.sub.includes(sub)) && (targetOf(effFrom(L, s)) !== s || L.id === 'L16');
    for (const q of qs) for (const e of es) { const x0 = stageAt(m0, q, e), x1 = stageAt(mN, q, e); if (!x0 || !x1 || !counts(x0.stage, x0.sub) || multOf(L, e) <= 0) continue;
      const t = targetOf(effFrom(L, x0.stage)); const reached = L.id === 'L16' ? x1.stage === 'S5' : lvl(x1.stage) >= lvl(t); const grp = AIRF.GROUP_OF[e];
      cells.push({ prompt_id: q, engine: e, group: grp, from: x0.stage, target: t, now: x1.stage, reached }); const k = x0.stage + '|' + grp; const g = byK.get(k) || { stage: x0.stage, group: grp, n: 0, k: 0 }; g.n++; if (reached) g.k++; byK.set(k, g); }
    for (const q of cs) for (const e of es) { const x0 = stageAt(m0, q, e), x1 = stageAt(mN, q, e); if (!x0 || !x1 || !counts(x0.stage, x0.sub) || multOf(L, e) <= 0) continue; const t = targetOf(effFrom(L, x0.stage)); const ok = L.id === 'L16' ? x1.stage === 'S5' : lvl(x1.stage) >= lvl(t);
      for (const k of [x0.stage + '|' + AIRF.GROUP_OF[e], x0.stage + '|*']) { const g = ctrl.get(k) || { n: 0, k: 0 }; g.n++; if (ok) g.k++; ctrl.set(k, g); } }
    const noControl = SITE_WIDE.includes(L.id) || (ELIG.includes(L.id) && L.scope === 'site');
    const by = [...byK.values()].sort((x, y) => (x.stage + x.group < y.stage + y.group ? -1 : 1)).map(g => { const c1 = ctrl.get(g.stage + '|' + g.group), c2 = ctrl.get(g.stage + '|*');
      const src = c1 && c1.n ? c1 : c2 && c2.n ? c2 : null; const b = src ? src.k / src.n : 0;
      const b_basis = src ? (src === c1 ? 'control cells, same stage and engine group' : 'control cells, same stage, any engine group') + ' (' + src.k + ' of ' + src.n + ')' : ELIG.includes(L.id) ? 'eligibility: no background expected' : 'none';
      return { stage: g.stage, prior_stage: effFrom(L, g.stage) || g.stage, group: g.group, n: g.n, k: g.k, b: rd(b, 4), b_basis, k_adj: rd(Math.max(0, g.k - g.n * b), 4) }; });   // prior_stage: the prior it teaches (an off-site lever from S0 teaches its S1 prior); b: same real starting stage
    const sk = by.reduce((s, x) => s + x.k, 0), sn = by.reduce((s, x) => s + x.n, 0), sb = sn ? by.reduce((s, x) => s + x.b * x.n, 0) / sn : 0;
    const stage_moves = { k: sk, n: sn, b: rd(sb, 4), k_adj: rd(by.reduce((s, x) => s + x.k_adj, 0), 4), by, cells, stages_at_t0: snap && snap.stages ? 'snapshot: ' + S(snap.stages_basis) : m0.size ? 'a reading passed in' : 'none: no stage at the start is on file, so no stage move is read' };
    // the counts every lift test reads: the before-period as frozen at t0 when it was, the window after from the answers loaded now (RA-8)
    const metric = pr.metric === 'stage' ? 'named_rate' : S(pr.metric) || 'named_rate';
    const allQ = uniq([...qs, ...cs]); const live = countsOf(units60, { qs: allQ, es, t0, post_days: win, now: nowMs }); const cnt = new Map();
    const sp = snap && snap.periods && typeof snap.periods === 'object' ? snap.periods : null;
    for (const q of allQ) { const x = live.c.get(q) || { p1: Z3(), pre: Z3(), h1: Z3(), h2: Z3(), post: Z3() };
      if (sp) { const v = Array.isArray(sp[q]) ? sp[q].map(n => N(n, 0)) : []; x.pre = v.length >= 3 ? v.slice(0, 3) : Z3(); x.h1 = v.length >= 6 ? v.slice(3, 6) : Z3(); x.h2 = v.length >= 9 ? v.slice(6, 9) : Z3(); x.p1 = v.length >= 12 ? v.slice(9, 12) : Z3(); }
      cnt.set(q, x); }
    const end = Math.min(nowMs, t0 + win * DAY);
    const coverage = { pre_days: sp ? N(snap.pre_days_covered, 0) : coveredDays(live.earliest, t0 - 28 * DAY, t0), p1_days: sp ? N(snap.p1_days_covered, 0) : coveredDays(live.earliest, t0 - 56 * DAY, t0 - 28 * DAY),
      post_days: coveredDays(live.earliest, t0, end), before_from: sp ? 'snapshot taken ' + S(snap.taken_at).slice(0, 10) : 'the answers loaded now' };
    let did = null, placebo = null, itsR = null, fa = { t: { k: 0, n: 0 }, c: { k: 0, n: 0 }, p_fisher: null };
    if (!noControl && cs.length) { did = Object.assign(qDid(cnt, qs, cs, 'pre', 'post', metric), { pre_days: coverage.pre_days, post_days: coverage.post_days });
      // the placebo in time: the 28 days before t0 against the 28 before that when at least 21 of those days are on file; else the halves of the 28 days
      // before (14 days apart, so their effect counts double against the DiD's 28-day spacing)
      if (coverage.p1_days >= 21) placebo = Object.assign(qDid(cnt, qs, cs, 'p1', 'pre', metric), { kind: 'the 28 days before against the 28 before that', scale: 1 });
      else placebo = Object.assign(qDid(cnt, qs, cs, 'h1', 'h2', metric, { min_n: 2 }), { kind: 'the two halves of the 28 days before (short history)', scale: 2 });
      if (placebo.effect == null) placebo.why = placebo.why || 'not enough history before the start';
      fa = firstAppearC(cnt, qs, cs, metric); }
    else if (SITE_WIDE.includes(L.id)) itsR = its(cnt, qs, metric);
    // leading indicators (LI1 retrievable, LI2 indexed, LI3 on-source, LI4 cited rate): treated vs control, at t0 and now
    const li = (f) => { const T0 = shareOf(m0, qs, es, f), T1 = shareOf(mN, qs, es, f), C0 = shareOf(m0, cs, es, f), C1 = shareOf(mN, cs, es, f);
      const dd = T0.share != null && T1.share != null && C0.share != null && C1.share != null ? rd(100 * ((T1.share - T0.share) - (C1.share - C0.share)), 1) : null;
      return { t: { at_t0: T0, now: T1 }, c: { at_t0: C0, now: C1 }, did_points: dd, basis: 'share of question x engine cells, two readings, no range' }; };
    const leading = { LI1: li((x) => lvl(x.stage) >= 2 || N(x.c.retrieved, 0) > 0), LI2: li((x) => !(x.stage === 'S0' && x.sub === 'not_indexed')),
      LI3: li((x) => x.c.on_source === true), LI4: did && metric === 'cited_rate' ? did : !noControl && cs.length ? qDid(cnt, qs, cs, 'pre', 'post', 'cited_rate') : null };
    if (!mN.size || ![...mN.values()].some(d => d && d.engines && Object.values(d.engines).some(c => c && 'on_source' in c))) leading.LI3 = { basis: 'not read: the diagnosis does not carry on-source yet' };
    // verdict (one alpha: ALPHA one-sided)
    let verdict = 'cant_tell', why = '', primary = 'none', p_one = null;
    const pct = (x) => rd(x, 4);
    if (!due) { verdict = 'not_due'; why = 'the window ends ' + new Date(t0 + win * DAY).toISOString().slice(0, 10); }
    else if (noControl) { primary = 'stage';
      if (ELIG.includes(L.id) && sn) { const r = sk / sn; verdict = r >= 0.5 ? 'likely_helped' : sk === 0 ? 'no_effect' : 'cant_tell'; why = sk + ' of ' + sn + ' cells the step was for can now be read (' + pct1(r) + '%); no control possible, it touches every question'; }
      else if (itsR && itsR.effect != null) { primary = 'its'; p_one = itsR.p_one;
        if (itsR.p_one < ALPHA && itsR.effect > 0) { verdict = 'likely_helped'; why = 'the questions moved ' + itsR.effect + ' points more than their own trend before the start (95% range ' + itsR.lo + ' to ' + itsR.hi + '); no control: a move of the whole market would look the same'; }
        else if (itsR.hi <= 0) { verdict = 'no_effect'; why = 'the questions did not move more than their own trend before the start (95% range ' + itsR.lo + ' to ' + itsR.hi + ' points)'; }
        else { verdict = 'cant_tell'; why = 'against their own trend before the start the questions moved ' + itsR.effect + ' points, inside the 95% range ' + itsR.lo + ' to ' + itsR.hi; } }
      else { verdict = 'cant_tell'; why = 'no control possible: it touches every question, so only whether it happened and the leading indicators are reported (' + sk + ' of ' + sn + ' cells moved)' + (itsR ? '; the trend test: ' + itsR.why : ''); } }
    else if (!cs.length) { why = cs0.length ? 'every registered held-back question was worked on by another step in this period (' + controls_dropped.map(x => x.prompt_id + ' by ' + x.lever).join(', ') + '), so no lift can be read' : 'no control question was registered, so no lift can be read'; }
    else { const fisherFirst = fa.p_fisher != null && fa.t.n > 0 && fa.c.n > 0 && (fa.treated_zero_baseline === true);
      if (fisherFirst) { primary = 'fisher'; p_one = fa.p_fisher;
        if (fa.p_fisher < ALPHA) { verdict = 'likely_helped'; why = fa.t.k + ' of ' + fa.t.n + ' worked-on questions named the business for the first time against ' + fa.c.k + ' of ' + fa.c.n + ' held-back questions (one-sided Fisher p ' + fa.p_fisher + ')'; }
        else { verdict = 'cant_tell'; why = 'first appearances: ' + fa.t.k + ' of ' + fa.t.n + ' worked-on vs ' + fa.c.k + ' of ' + fa.c.n + ' held-back questions (Fisher p ' + fa.p_fisher + ', ' + ALPHA + ' needed)'; } }
      else if (did && did.lo != null) { primary = 'did'; p_one = did.p_one;
        if (did.p_one < ALPHA && did.effect > 0) { verdict = 'likely_helped'; why = 'its questions moved ' + did.effect + ' points more than the held-back questions (95% range ' + did.lo + ' to ' + did.hi + ', ' + did.treated_used.length + ' against ' + did.controls_used.length + ' questions); a correlation with controls, not proof of cause'; }
        else if (did.hi <= 0) { verdict = 'no_effect'; why = 'its questions did not move more than the held-back questions (95% range ' + did.lo + ' to ' + did.hi + ' points)'; }
        else { verdict = 'cant_tell'; why = 'the change against the held-back questions (' + did.effect + ' points) is inside the 95% range ' + did.lo + ' to ' + did.hi; } }
      else { why = 'the lift cannot be read: ' + ((did && did.why) || 'no answers'); }
      if (verdict === 'likely_helped' && placebo && placebo.effect != null && did && did.effect != null && did.effect > 0 && placebo.effect * placebo.scale >= 0.5 * did.effect && placebo.p_one != null && placebo.p_one < 0.1) {
        verdict = 'cant_tell'; why = 'can\'t tell: the questions were already moving before the action (placebo ' + placebo.effect + ' points over ' + placebo.kind + ', one-sided p ' + placebo.p_one + ', against ' + did.effect + ' after)'; }
      if (placebo && placebo.effect == null) why += '; placebo not computable (' + placebo.why + ')';
      if (controls_dropped.length) why += '; ' + controls_dropped.length + ' held-back question(s) left out: another step worked on them'; }
    return { due, t0: new Date(t0).toISOString(), window_days: win, metric: pr.metric, primary, p_one: p_one == null ? null : pct(p_one), alpha: ALPHA, stage_moves, did, placebo, its: itsR, first_appearance: fa, leading, coverage, controls_used: cs, controls_dropped, verdict, verdict_words: VERDICT_WORDS[verdict], why }; };

  // ================================================================ G4. learning
  /** RA-1 (FX-A): an outcome is learnable only when it read at least one stage move (an empty reading, e.g. no stage at t0 on file, never burns learned_at) */
  const learnable = (item) => { const a = (item && item.action) || item || {}; const oc = (item && item.outcome) || parse(a.outcome_json, null); const vf = parse(a.verify_json, {}) || {};
    const happened = (item && item.happened === true) || S(a.status) === 'verified' || vf.happened === true;
    return !!(oc && oc.due === true && happened && oc.verdict !== 'not_happened' && !S(a.learned_at) && LV.has(S(a.lever)) && LV.get(S(a.lever)).prior && !SITE_WIDE.includes(S(a.lever))
      && oc.stage_moves && Array.isArray(oc.stage_moves.by) && oc.stage_moves.by.length > 0 && N(oc.stage_moves.n, 0) > 0); };
  /** RA-4 (FX-A): one question x engine move teaches ONE action. Within the actions learned now and those learned before (`history`: stored action rows
   *  with learned_at and outcome_json), a cell already claimed by another action whose window overlaps is dropped from the later one (the earliest t0
   *  wins; ties: the smaller action id). Returns Map action_id -> { by (regrouped), dropped: [{ prompt_id, engine, by }] }. */
  const claimCells = (items, history) => { const claims = new Map(); const winOf = (oc) => { const t0 = msOf(oc && oc.t0); return [t0, t0 + N(oc && oc.window_days, 28) * DAY]; };
    const overl = (x, y) => isFinite(x[0]) && isFinite(y[0]) && x[0] <= y[1] && y[0] <= x[1];
    const reg = (id, oc) => { const w = winOf(oc); for (const c of ((oc.stage_moves || {}).cells || [])) { const k = S(c.prompt_id) + '|' + S(c.engine); const l = claims.get(k) || []; l.push({ id, w }); claims.set(k, l); } };
    for (const h of (history || [])) { const a = (h && h.action) || h || {}; if (!S(a.learned_at)) continue; const oc = (h && h.outcome) || parse(a.outcome_json, null); if (oc && oc.due) reg(S(a.action_id), oc); }
    const out = new Map();
    const list = (items || []).map(it => ({ it, a: (it && it.action) || it || {}, oc: (it && it.outcome) || parse(((it && it.action) || it || {}).outcome_json, {}) || {} }))
      .sort((x, y) => (winOf(x.oc)[0] - winOf(y.oc)[0]) || (S(x.a.action_id) < S(y.a.action_id) ? -1 : 1));
    for (const { a, oc } of list) { const id = S(a.action_id); const sm = oc.stage_moves || {}; const cells = Array.isArray(sm.cells) ? sm.cells : []; const w = winOf(oc);
      if (!cells.length) { out.set(id, { by: sm.by || [], dropped: [] }); continue; }   // a reading with no cell list (older rows): kept as it was, nothing to de-duplicate
      const dropped = [], keep = []; for (const c of cells) { const k = S(c.prompt_id) + '|' + S(c.engine); const hit = (claims.get(k) || []).find(x => x.id !== id && overl(x.w, w)); if (hit) dropped.push({ prompt_id: S(c.prompt_id), engine: S(c.engine), by: hit.id }); else keep.push(c); }
      const by = []; for (const g of (sm.by || [])) { const cs = keep.filter(c => S(c.from) === S(g.stage) && S(c.group) === S(g.group)); if (!cs.length) continue; const k = cs.filter(c => c.reached).length;
        by.push(Object.assign({}, g, { n: cs.length, k, k_adj: rd(Math.max(0, k - cs.length * N(g.b, 0)), 4) })); }
      out.set(id, { by, dropped }); reg(id, Object.assign({}, oc, { stage_moves: Object.assign({}, sm, { cells: keep }) })); }
    return out; };
  /** DESIGN G4 with three FX-A corrections. RA-6: each action teaches ONE trial per engine group, its success the share of its cells that reached the
   *  target net of the control background, (k - n b) / n, so one placement on 30 correlated cells moves another site's prior by one pseudo-outcome, not 30.
   *  RA-5: a site's share of the pool keeps its rate and caps its weight (w = min(1, 20 / trials), wOf), never min(10, k) and min(10, f) apart.
   *  RA-4: a cell another overlapping action already taught is not counted again (claimCells; `history` = the site's stored, learned action rows).
   *  Global: a = a0 + sum over sites w k, b = b0 + sum over sites w f (anchored at the evidence prior a0 / b0). Site: the global pool WITHOUT this site's
   *  weighted share, shrunk to kappa = min(a + b, 10) pseudo-outcomes, plus the site's own k and f. Rows: the global row and the site row of every key
   *  touched; a site row stores its raw totals as alpha - prior_alpha and beta - prior_beta, so the next run (and priorOf) can rebuild the pool exactly.
   *  RA-10: call it ONCE per run with every site's outcomes (AI_Rank_Plan does), or two sites learning one key overwrite each other's global row. */
  const learn = ({ priors, outcomes, now, history } = {}) => { const rows = rowsOf(priors); const t = isoOf(now); const delta = new Map(); const done = new Set();
    const items = (outcomes || []).filter(learnable); const claimed = claimCells(items, history);
    for (const it of items) { const a = (it && it.action) || it; const id = S(a.action_id); if (id && done.has(id)) continue; if (id) done.add(id);
      const sid = S(a.site_id); if (!sid) continue; const L = S(a.lever); const cl = claimed.get(id); const by = cl ? cl.by : (((it && it.outcome) || parse(a.outcome_json, {}) || {}).stage_moves || {}).by || [];
      for (const g of by) { if (!(N(g.n, 0) > 0) || !AIRF.STAGES.includes(S(g.stage)) || !AIRF.GROUPS.includes(S(g.group))) continue; if (S(g.b_basis) === 'none' && !ELIG.includes(L)) continue;
        const n = N(g.n, 0), kadj = clamp(N(g.k, 0) - n * clamp(N(g.b, 0), 0, 1), 0, n), s = kadj / n; const key = L + '|' + (AIRF.STAGES.includes(S(g.prior_stage)) ? S(g.prior_stage) : S(g.stage)) + '|' + S(g.group);
        const m = delta.get(key) || new Map(); const d = m.get(sid) || { k: 0, f: 0, n: 0 }; d.k += s; d.f += 1 - s; d.n++; m.set(sid, d); delta.set(key, m); } }
    const out = [];
    for (const [key, m] of [...delta.entries()].sort()) { const [L, st, gr] = key.split('|'); const ev = evidencePrior(L);
      const gid = AIRF.priorId(L, st, gr, 'global'); const g = rows.find(r => r && S(r.prior_id) === gid);
      const a0 = g && N(g.prior_alpha, 0) > 0 ? N(g.prior_alpha, ev.a) : ev.a, b0 = g && N(g.prior_beta, 0) > 0 ? N(g.prior_beta, ev.b) : ev.b;
      const sites = new Map();   // every site's raw totals: stored site rows, plus this call's outcomes
      for (const r of rows) { if (!r || S(r.lever) !== L || S(r.stage) !== st || S(r.engine_group) !== gr || S(r.scope) === 'global' || !S(r.scope)) continue;
        sites.set(S(r.scope), { k: Math.max(0, N(r.alpha, 0) - N(r.prior_alpha, 0)), f: Math.max(0, N(r.beta, 0) - N(r.prior_beta, 0)), n: N(r.n_outcomes, 0) }); }
      for (const [sid, d] of m) { const s = sites.get(sid) || { k: 0, f: 0, n: 0 }; sites.set(sid, { k: s.k + d.k, f: s.f + d.f, n: s.n + d.n }); }
      let A = a0, Bt = b0, nn = 0; for (const s of sites.values()) { const w = wOf(s.k, s.f); A += w * s.k; Bt += w * s.f; nn += s.n; }
      const base = { lever: L, stage: st, engine_group: gr, updated_at: t, rule_version: RULE };
      out.push(Object.assign({ prior_id: gid, scope: 'global', alpha: rd(A), beta: rd(Bt), n_outcomes: nn, prior_alpha: rd(a0), prior_beta: rd(b0), source: 'pooled' }, base));
      for (const sid of [...m.keys()].sort()) { const s = sites.get(sid); const w = wOf(s.k, s.f); const la = Math.max(1e-6, A - w * s.k), lb = Math.max(1e-6, Bt - w * s.f); const kap = Math.min(la + lb, 10);
        const pa = kap * la / (la + lb), pb = kap * lb / (la + lb);
        out.push(Object.assign({ prior_id: AIRF.priorId(L, st, gr, sid), scope: sid, alpha: rd(pa + s.k), beta: rd(pb + s.f), n_outcomes: s.n, prior_alpha: rd(pa), prior_beta: rd(pb), source: 'site' }, base)); } }
    return out; };
  /** RA-12 (FX-A): the false discovery rate across the actions judged in a quarter (Benjamini-Hochberg at ALPHA on the one-sided p of each action's
   *  primary test). `outcomes`: this run's items ({ action, outcome }); `judged`: stored action rows whose outcome was judged before. A "likely helped"
   *  of this run that does not survive becomes "can't tell", with the reason; stored verdicts are history and are never rewritten. Returns
   *  { m, expected_by_chance, demoted: [action_id] } and writes outcome.fdr on each judged item of this run. */
  const fdr = ({ outcomes, judged, now, days } = {}) => { const nowMs = msOf(now); const D = N(days, 91) * DAY; const pv = [];
    const ids = new Set((outcomes || []).map(it => S(((it && it.action) || {}).action_id)));
    for (const r of (judged || [])) { const id = S(r && r.action_id); if (!id || ids.has(id)) continue; const oc = parse(r.outcome_json, null); if (!oc || !oc.due || oc.p_one == null || !isFinite(N(oc.p_one, NaN))) continue;
      const end = msOf(oc.t0) + N(oc.window_days, 28) * DAY; if (isFinite(nowMs) && isFinite(end) && nowMs - end > D) continue; pv.push({ id, p: N(oc.p_one, 1), mine: false }); }
    for (const it of (outcomes || [])) { const oc = it && it.outcome; if (!oc || !oc.due || oc.p_one == null || !isFinite(N(oc.p_one, NaN))) continue; pv.push({ id: S(((it && it.action) || {}).action_id), p: N(oc.p_one, 1), mine: true, it }); }
    const m = pv.length; const sorted = pv.slice().sort((x, y) => x.p - y.p || (x.id < y.id ? -1 : 1)); let kmax = 0; sorted.forEach((x, i) => { if (x.p <= (i + 1) / m * ALPHA) kmax = i + 1; });
    const qv = new Map(); { let run = 1; for (let i = m - 1; i >= 0; i--) { run = Math.min(run, sorted[i].p * m / (i + 1)); qv.set(sorted[i].id, rd(Math.min(1, run), 6)); } }
    const pass = new Set(sorted.slice(0, kmax).map(x => x.id)); const demoted = [];
    for (const x of pv) { if (!x.mine) continue; const oc = x.it.outcome; oc.fdr = { m, q_value: qv.get(x.id), alpha: ALPHA, basis: 'Benjamini-Hochberg over the ' + m + ' action(s) judged in the last ' + Math.round(D / DAY) + ' days' };
      if (oc.verdict === 'likely_helped' && !pass.has(x.id)) { oc.verdict = 'cant_tell'; oc.verdict_words = VERDICT_WORDS.cant_tell; oc.why = 'can\'t tell once the ' + m + ' actions judged this quarter are counted: alone it read "likely helped" (' + S(oc.why) + '), but with this many tests that is expected by chance (false discovery rate ' + ALPHA + ')'; demoted.push(x.id); } }
    return { m, expected_by_chance: rd(m * ALPHA, 2), demoted }; };
  /** RA-14 (FX-A): an own page is screened against the refused tactics before it is sent to the writer. A self-ranked "best X companies" question (R01)
   *  is written as an honest comparison (criteria the reader can check, every option on the same terms, never a ranked list with the business first);
   *  an AI-only page (R02) is refused. Returns { refused: null | { id, why }, page_type, note, matched: [ids] } */
  const screenOwnPage = ({ keyword, question, fanouts } = {}) => { const txt = [S(keyword), S(question), ...arr(fanouts).map(f => S(f && f.query != null ? f.query : f))].join(' | ').toLowerCase(); const hits = REFUSED.filter(R => new RegExp(R.match, 'i').test(txt)).map(R => R.id);
    const R02 = REFUSED.find(R => R.id === 'R02'); if (hits.includes('R02')) return { refused: { id: 'R02', why: R02.label + ': ' + R02.why }, page_type: '', note: '', matched: hits };
    if (hits.includes('R01')) return { refused: null, page_type: 'Comparison Page', note: 'honest comparison, never a self-ranked list: the question asks for the best providers, and a page that ranks its own business first is left out of the answers (R01: ' + REFUSED[0].why + '); compare the options on criteria the reader can check, the business on the same terms as the others', matched: hits };
    return { refused: null, page_type: '', note: '', matched: hits }; };
  /** calibration per lever: the Brier score of the projected p against each treated cell's result (reached its target or not), and the observed rate */
  const brier = (items) => { const by = {}; for (const it of (items || [])) { const a = (it && it.action) || it || {}; const oc = (it && it.outcome) || parse(a.outcome_json, null); if (!oc || !oc.due || !oc.stage_moves) continue;
      const pr = parse(a.prereg_json != null ? a.prereg_json : a.prereg, {}) || {}; const p = N((pr.projected || {}).p, N((a.expected || parse(a.expected_json, {}) || {}).p, null)); if (p == null) continue;
      const L = S(a.lever); const x = by[L] || (by[L] = { sq: 0, n_cells: 0, n_actions: 0, sum_p: 0, reached: 0 }); x.n_actions++;
      for (const c of (oc.stage_moves.cells || [])) { const y = c.reached ? 1 : 0; x.sq += (p - y) * (p - y); x.n_cells++; x.sum_p += p; x.reached += y; } }
    const out = {}; for (const L of Object.keys(by).sort()) { const x = by[L]; if (!x.n_cells) continue; out[L] = { brier: rd(x.sq / x.n_cells, 4), n_cells: x.n_cells, n_actions: x.n_actions, mean_p: rd(x.sum_p / x.n_cells, 4), observed: rd(x.reached / x.n_cells, 4) }; }
    return { by_lever: out, basis: 'projected p of each action against each treated cell reaching its target; raw outcomes, before the control background' }; };

  // ================================================================ H. the memo and the old-logic comparison
  const MEMO_PARTS = ['what_changed', 'why', 'detectable', 'actions', 'projected_vs_real', 'cost_per_win', 'shadow_vs_old'];
  const MEMO_TITLES = { what_changed: 'What changed', why: 'Why', detectable: 'What we can detect', actions: 'What we did and what is waiting',
    projected_vs_real: 'Projected and real', cost_per_win: 'Cost per won question', shadow_vs_old: 'This plan and the current one' };
  const clean = (s) => S(s).replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, '\'').replace(/[\u201c\u201d]/g, '"').replace(/\u2026/g, '...');
  const line = (text, figures) => ({ text: clean(text), figures: (figures || []).map(f => ({ name: S(f.name), value: f.value == null ? null : f.value, basis: clean(f.basis) || 'not stated' })) });
  const eName = (e) => ENGINE_NAMES[e] || e;
  const memo = ({ site, diagNow, diagPrev, chosen, open, outcomes, mde: md, blockers, cost, old, mode } = {}) => { const st = site || {}; const mode_ = S(mode) || 'off';
    const parts = {}; for (const k of MEMO_PARTS) parts[k] = [];
    const mN = diagMap(diagNow), mP = diagMap(diagPrev); const core = [...mN.keys()].filter(q => !mP.size || mP.has(q)).sort();
    // 1. what changed (core questions in both readings only)
    const engines = uniq(core.flatMap(q => Object.keys((mN.get(q) || {}).engines || {}))).filter(AIRF.usable).sort();
    const moved = [];
    if (!mN.size) parts.what_changed.push(line('No diagnosis this week.', []));
    else if (!mP.size) parts.what_changed.push(line('This is the first reading: there is no week before to compare with.', [{ name: 'questions', value: mN.size, basis: 'core questions diagnosed this week' }]));
    else { for (const e of engines) { const cnt = (m) => { const c = {}; for (const q of core) { const x = stageAt(m, q, e); if (x) c[x.stage] = (c[x.stage] || 0) + 1; } return c; }; const a = cnt(mN), b = cnt(mP);
        const won = a.S5 || 0, wonB = b.S5 || 0, found = AIRF.STAGES.filter(s => lvl(s) >= 2).reduce((s, x) => s + (a[x] || 0), 0), foundB = AIRF.STAGES.filter(s => lvl(s) >= 2).reduce((s, x) => s + (b[x] || 0), 0);
        parts.what_changed.push(line(eName(e) + ': found on ' + found + ' of ' + core.length + ' questions (last week ' + foundB + '), won on ' + won + ' (last week ' + wonB + ').',
          [{ name: 'found', value: found, basis: 'stage S2 or higher, core questions in both weeks' }, { name: 'found_last_week', value: foundB, basis: 'same, last week' }, { name: 'won', value: won, basis: 'stage S5, core questions in both weeks' }, { name: 'won_last_week', value: wonB, basis: 'same, last week' }])); }
      for (const q of core) for (const e of engines) { const x1 = stageAt(mN, q, e), x0 = stageAt(mP, q, e); if (!x1 || !x0 || x1.stage === x0.stage || x1.stage === 'unmeasured' || x0.stage === 'unmeasured') continue; moved.push({ q, e, from: x0.stage, to: x1.stage, up: lvl(x1.stage) > lvl(x0.stage) }); }
      if (!moved.length) parts.what_changed.push(line('No question changed stage this week.', [{ name: 'moved', value: 0, basis: 'question x engine cells, core questions in both weeks' }]));
      for (const x of moved.slice(0, 20)) parts.what_changed.push(line('Question ' + x.q + ' on ' + eName(x.e) + ': ' + (x.up ? 'up' : 'down') + ' from "' + STAGE_WORDS[x.from] + '" to "' + STAGE_WORDS[x.to] + '".', [{ name: 'from', value: x.from, basis: 'stage last week' }, { name: 'to', value: x.to, basis: 'stage this week' }])); }
    // 2. why: an action only when our check found it happened; otherwise background or nothing of ours
    const acts = [...(open || []), ...(chosen || [])].map(a => Object.assign({}, a, { questions: arr(a.questions).map(S), engines: arr(a.engines).map(S) }));
    const ctrlMoved = moved.filter(x => x.up && !acts.some(a => a.questions.includes(x.q)));
    for (const x of moved.filter(m => m.up)) { const a = acts.find(z => S(z.status) === 'verified' && z.questions.includes(x.q) && (!z.engines.length || z.engines.includes(x.e)));
      const bg = ctrlMoved.some(y => y !== x && y.e === x.e && y.from === x.from);
      parts.why.push(line('Question ' + x.q + ' on ' + eName(x.e) + ': ' + (a ? 'after "' + (LV.get(S(a.lever)) || {}).label + '", which our check found done' + (bg ? '; questions we did not work on moved the same way, so it may be background' : '') : bg ? 'background: questions we did not work on moved the same way' : 'no action of ours touched it') + '.',
        [{ name: 'attributed_to', value: a ? S(a.action_id) : null, basis: a ? 'verified action on this question and engine' : 'no verified action' }])); }
    if (!parts.why.length) parts.why.push(line('Nothing moved up, so there is nothing to explain.', []));
    // 3. what we can detect
    // RA-11 (FX-A): the figure of the test that is actually run. Every lift test is per action: one question for an own page, a passage fix or a
    // correction (md.one_question), a few for a placement (md.page_level); the whole-panel figure is printed last, for a step touching every worked-on question
    const mdv = md && !md.unavailable && md.prepost != null ? md : md && md.q_t != null ? mde(md) : null;
    const one = md && md.one_question && md.one_question.did != null ? md.one_question : null, pl = md && md.page_level && md.page_level.did != null ? md.page_level : null;
    if (one) { parts.detectable.push(line('For a step on one question (an own page, a passage fix, a correction), judged against the held-back questions, only a change of about ' + one.did + ' points in the rate can be shown.',
        [{ name: 'mde_one_question_points', value: one.did, basis: one.basis || 'minimum detectable effect, one worked-on question' }]));
      parts.detectable.push(line(one.first_appearance_k != null ? 'On a question where you were never named, one first appearance is enough to show against this many held-back questions.' : 'On a question where you were never named, one first appearance can never be shown on its own: that needs at least ' + Math.ceil(1 / ALPHA) + ' held-back questions that also start at zero (one-sided ' + ALPHA + '); such steps are read by the change of the rate.',
        [{ name: 'first_appearance_one_question', value: one.first_appearance_k, basis: 'one-sided Fisher exact test at ' + ALPHA + ', one worked-on question' }])); }
    if (pl) parts.detectable.push(line('For a step on ' + N(md.page_level_q, 3) + ' questions (a list placement, a directory profile), about ' + pl.did + ' points.', [{ name: 'mde_page_level_points', value: pl.did, basis: pl.basis || 'minimum detectable effect' }]));
    if (mdv) { parts.detectable.push(line('For a step touching every question we work on, judged against the ones held back, a change of about ' + mdv.did + ' points in the rate can be shown (' + mdv.prepost + ' points before and after on the worked-on questions alone).',
        [{ name: 'mde_did_points', value: mdv.did, basis: mdv.basis || 'minimum detectable effect, 80% power, 5% two-sided' }, { name: 'mde_prepost_points', value: mdv.prepost, basis: mdv.basis || 'minimum detectable effect' }]));
      if (mdv.first_appearance_k != null) parts.detectable.push(line('To show that such a step worked on questions where you were never named, about ' + mdv.first_appearance_k + ' of them must name you for the first time, all among the questions we worked on.',
        [{ name: 'first_appearance_k', value: mdv.first_appearance_k, basis: 'one-sided Fisher exact test below ' + ALPHA + ', all first appearances on worked-on questions' }])); }
    if (!mdv && !one) parts.detectable.push(line('The size of change this panel can show is not computed this week.', [{ name: 'mde', value: null, basis: 'no panel arms yet' }]));
    // 4. actions and blockers
    for (const a of (chosen || [])) parts.actions.push(line('New: ' + (LV.get(S(a.lever)) || {}).label + ' (' + ({ auto: 'we do it', approve: 'needs your approval', human: 'a person must do it' })[S(a.executor)] + (a.page_url ? ', ' + a.page_url : '') + ').',
      [{ name: 'expected_gain', value: N((a.expected || {}).gain, 0), basis: 'AIR\'s own model, not independent' }, { name: 'p', value: N((a.expected || {}).p, 0), basis: 'prior mean x engine multiplier' }]));
    for (const a of (open || []).filter(x => OPEN.includes(S(x.status)))) parts.actions.push(line('Open since ' + S(a.created_at).slice(0, 10) + ': ' + (LV.get(S(a.lever)) || {}).label + ' (' + S(a.status).replace('_', ' ') + ').', [{ name: 'status', value: S(a.status), basis: 'action row' }]));
    const bl = (blockers || []).map(b => ({ what: clean(b.what), owner: S(b.owner) || 'client', since: S(b.since).slice(0, 10), blocks: clean(b.blocks) }));
    for (const b of bl) parts.actions.push(line('Waiting on ' + (b.owner === 'us' ? 'us' : 'you') + (b.since ? ' since ' + b.since : '') + ': ' + b.what + (b.blocks ? '. It blocks: ' + b.blocks : '') + '.', [{ name: 'owner', value: b.owner, basis: 'blocker list' }]));
    if (!parts.actions.length) parts.actions.push(line('No new action this week and nothing open.', []));
    // 5. projected vs real
    const ocs = (outcomes || []).map(it => ({ a: (it && it.action) || it || {}, o: (it && it.outcome) || parse(((it && it.action) || it || {}).outcome_json, null) })).filter(x => x.o && x.o.due);
    for (const { a, o } of ocs) { const pr = parse(a.prereg_json != null ? a.prereg_json : a.prereg, {}) || {}; const sm = o.stage_moves || {};
      parts.projected_vs_real.push(line((LV.get(S(a.lever)) || {}).label + ': we projected a ' + pct1(N((pr.projected || {}).p, 0)) + '% chance per cell; ' + N(sm.k, 0) + ' of ' + N(sm.n, 0) + ' cells moved (background ' + pct1(N(sm.b, 0)) + '%)' + (o.did && o.did.effect != null ? '; against the held-back questions ' + o.did.effect + ' points' + (o.did.lo != null ? ' (95% range ' + o.did.lo + ' to ' + o.did.hi + ')' : '') : '') + '. Verdict: ' + (VERDICT_WORDS[o.verdict] || o.verdict) + '.',
        [{ name: 'projected_p', value: N((pr.projected || {}).p, 0), basis: 'pre-registered ' + S(pr.registered_at).slice(0, 10) }, { name: 'moved', value: N(sm.k, 0), basis: 'treated cells that reached the target stage' }, { name: 'cells', value: N(sm.n, 0), basis: 'treated cells at a starting stage the lever acts on' },
          { name: 'background', value: N(sm.b, 0), basis: 'share of control cells that moved the same way' }, { name: 'did_points', value: o.did ? o.did.effect : null, basis: o.did && o.did.lo != null ? 'difference in differences per question, t test (' + (o.did.treated_used || []).length + ' against ' + (o.did.controls_used || []).length + ' questions)' : 'not computed' }])); }
    if (!parts.projected_vs_real.length) parts.projected_vs_real.push(line('No action has reached the end of its window yet.', []));
    { const fm = ocs.map(x => x.o.fdr).filter(Boolean).sort((x, y) => N(y.m, 0) - N(x.m, 0))[0];   // RA-12: how many were judged, and what chance alone gives
      if (fm) parts.projected_vs_real.push(line(N(fm.m, 0) + ' action(s) were judged in the last quarter. Each test alone reads "likely helped" by chance about ' + pct1(ALPHA) + '% of the time (about ' + rd(N(fm.m, 0) * ALPHA, 1) + ' of them), so a verdict counts only if it holds with all of them taken together (false discovery rate ' + pct1(ALPHA) + '%).',
        [{ name: 'judged_quarter', value: N(fm.m, 0), basis: fm.basis || 'actions judged in the last 91 days' }, { name: 'expected_by_chance', value: rd(N(fm.m, 0) * ALPHA, 2), basis: 'judged actions x one-sided ' + ALPHA }])); }
    // 6. cost per won question (12 weeks)
    const c = cost || {}; const H = N(c.H, COST.H); const spend = N(c.usd, 0) + N(c.minutes, 0) / 60 * H;
    let wins = 0; for (const { o } of ocs) for (const g of ((o.stage_moves || {}).by || [])) { const cl = ((o.stage_moves || {}).cells || []).filter(x => x.from === g.stage && x.group === g.group && x.now === 'S5' && (!mP.size || (stageAt(mP, x.prompt_id, x.engine) || {}).stage === 'S5')).length; wins += Math.max(0, cl - N(g.n, 0) * N(g.b, 0)); }
    if (c.wins != null) wins = N(c.wins, 0);
    parts.cost_per_win.push(wins > 0 ? line('About $' + rd(spend / wins, 2) + ' per question and engine won (' + rd(wins, 1) + ' won net of the background, $' + rd(spend, 2) + ' spent including your time at $' + H + ' an hour).',
      [{ name: 'cost_per_win_usd', value: rd(spend / wins, 2), basis: '12 weeks of AIR spend / cells won and held 2 weeks after a verified action, net of control background' }, { name: 'wins', value: rd(wins, 2), basis: 'net of control background' }, { name: 'spend_usd', value: rd(spend, 2), basis: 'provider cost + client minutes x hour value' }])
      : line('Not yet: no question has been won after a verified action ($' + rd(spend, 2) + ' spent so far).', [{ name: 'wins', value: 0, basis: 'cells won and held after a verified action' }, { name: 'spend_usd', value: rd(spend, 2), basis: 'provider cost + client minutes x hour value' }]));
    // 7. this plan and the current one
    if (mode_ === 'shadow' && old && !old.unavailable) { parts.shadow_vs_old.push(line('The two plans share ' + pct1(N(old.overlap, 0)) + '% of their targets. AIR\'s model expects ' + rd(N(old.gain_air, 0), 3) + ' from its plan and ' + rd(N(old.gain_old, 0), 3) + ' from the current one (AIR\'s own model, not independent).',
        [{ name: 'overlap', value: N(old.overlap, 0), basis: 'shared targets / all targets of both plans' }, { name: 'gain_air', value: N(old.gain_air, 0), basis: 'AIR\'s own model, not independent' }, { name: 'gain_old', value: N(old.gain_old, 0), basis: 'AIR\'s own model, not independent' }]));
      parts.shadow_vs_old.push(line('Problems addressed (of the six found on the two clients): AIR ' + ((old.causes || {}).air || []).join(', ') + '; current plan ' + (((old.causes || {}).old || []).join(', ') || 'none') + '.', [{ name: 'problems_addressed', value: ((old.causes || {}).air || []).length, basis: 'R4 problem list: 1 footprint, 2 cited sources, 3 panel, 5 execution, 6 blockers' }])); }
    else parts.shadow_vs_old.push(line(mode_ === 'on' ? 'AIR drives the plan on this site.' : 'No comparison this week.', []));
    return { v: 1, rule_version: RULE, site_id: S(st.site_id), mode: mode_, parts: MEMO_PARTS.map(k => ({ key: k, title: MEMO_TITLES[k], lines: parts[k] })), blockers: bl }; };
  const CAUSE_OF = { L01: 1, L02: 1, L03: 1, L04: 1, L05: 1, L06: 1, L08: 2, L09: 2, L10: 2, L13: 2, L14: 2, L11: 2, L12: 2 };
  /** AIR's plan beside the old logic's: overlap (Jaccard of the refs), both plans' gain in AIR's own model (old items found among `old.scored`, AIR's
   *  scored candidates; an item AIR's model cannot see counts 0), the R4 causes each addresses, and the refused tactics the old plan contains */
  const compareOld = ({ chosen, old } = {}) => { const o = old || {};
    const refA = (a) => { const r = parse(a.ref, {}) || {}; return OWN_PAGE.includes(S(a.lever)) && r.prompt_id ? 'p:' + S(r.prompt_id) : AIRF.refKey(r) + (r.prompt_id || r.url || r.listing_id ? '' : ':' + S(a.lever)); };
    const air = new Map((chosen || []).map(a => [refA(a), a]));
    const oldRefs = new Map(); for (const t of (o.targets || [])) if (t && S(t.prompt_id)) oldRefs.set('p:' + S(t.prompt_id), { kind: 'target', item: t });
    for (const e of (o.earned || [])) { const u = S(e && (e.url || e.page_url || e.source_url)); if (u) oldRefs.set('u:' + AIRF.urlKey(u), { kind: 'earned', item: e }); }
    for (const x of (o.actions || [])) if (x && S(x.action)) oldRefs.set('a:' + AIRF.hash(S(x.type) + '|' + S(x.action)).toString(16), { kind: 'action', item: x });
    const inter = [...air.keys()].filter(k => oldRefs.has(k)); const union = new Set([...air.keys(), ...oldRefs.keys()]);
    const scored = [...(chosen || []).map(a => Object.assign({}, a, { scored: { gain: N((a.expected || {}).gain, 0) } })), ...(o.scored || []).filter(Boolean)]; const gainOf = (k) => { const c = scored.find(x => refA(x) === k || (k.indexOf('p:') === 0 && OWN_PAGE.includes(S(x.lever)) && S((x.ref || {}).prompt_id) === k.slice(2))); return c ? N((c.scored || c).gain, 0) : 0; };
    const gain_air = (chosen || []).reduce((s, a) => s + N((a.expected || {}).gain, 0), 0); let gain_old = 0; for (const k of oldRefs.keys()) gain_old += gainOf(k);
    const ca = uniq((chosen || []).map(a => CAUSE_OF[S(a.lever)]).filter(Boolean)); if ((chosen || []).length) ca.push(5); if ((chosen || []).some(a => S(a.executor) === 'human')) ca.push(6); if (o.panel && N(o.panel.core_n, 0) > 0) ca.push(3);
    const co = []; if ((o.targets || []).length) co.push(1); if ((o.earned || []).length) co.push(2); if ((o.actions || []).some(x => /bing|indexnow|robots|crawler|setup|mailbox/i.test(S(x && (x.type + ' ' + x.action))))) co.push(6);
    const refused_old = []; for (const t of [...(o.targets || []), ...(o.actions || [])]) { const txt = S(t && (t.question || '') + ' ' + (t.keyword || '') + ' ' + (t.page_type || '') + ' ' + (t.action || ''));
      for (const R of REFUSED) if (R.id !== 'R01' ? new RegExp(R.match, 'i').test(txt) : (/listicle|best .* list/i.test(S(t && t.page_type)) || (/^(best|top)\b/i.test(S(t && t.keyword)) && /list/i.test(S(t && t.page_type))))) refused_old.push({ what: txt.trim().slice(0, 120), id: R.id, why: R.why }); }
    return { overlap: union.size ? rd(inter.length / union.size, 4) : 0, overlap_n: inter.length, gain_air: rd(gain_air), gain_old: rd(gain_old), causes: { air: uniq(ca).sort(), old: uniq(co).sort() }, refused_old,
      note: 'Gains are AIR\'s own model, not independent. Overlap: shared targets over all targets of both plans.' }; };

  return { VERSION, OFF_SITE, LEVERS, REFUSED, ZERO_WEIGHT, U, VERDICTS, VERDICT_WORDS, MEMO_PARTS, MEMO_TITLES, ENGINE_W, CAPS, COST, HUMAN_NEW, ELIG, SITE_WIDE, STATS,
    value, feasibility, rivalsMedian, priorOf, candidates, score, choose, prereg, keepPrereg, verify, outcome, learnable, learn, brier, memo, compareOld, costOf, multOf, didOf,
    UNIFORM, ALPHA, SITE_CAP, expiryDays, safeUrlWhy, stagesPack, stagesUnpack, snapshotT0, qDid, its, claimCells, fdr, screenOwnPage };
})();
const AIR_CFG = { H: 25, window_min_days: 28, expire_grace_days: 14, sources_max: 200, actions_max: 300, growth_add_max: 3, protect_days: 28,
  // capacities: ARL's own defaults (own_pages 1 a week, pitches 5, human_new 3, human_open_max 8) in shadow AND on, so the shadow plan is what on would do
  open: ['proposed', 'queued', 'in_progress', 'done'], json_max: 60000 };
const nowMs = Date.now(); const nowIso = new Date(nowMs).toISOString();
const DAY = 864e5;
const J = (x) => { try { return JSON.stringify(x == null ? null : x); } catch (e) { return ''; } };
const P = (s, d) => { if (s && typeof s === 'object') return s; try { const v = JSON.parse(String(s || '')); return v == null ? d : v; } catch (e) { return d; } };
const S0 = (v) => (v == null ? '' : String(v)).trim();
const tryAll = (name) => { try { return $(name).all().map(i => i.json || {}); } catch (e) { return []; } };
const bySite = (rows, sid, dom) => rows.filter(r => r && (r.site_id === sid || (!r.site_id && normD(r.domain) === dom)));
const latest = (rows, col) => rows.slice().sort((a, b) => String(b[col] || '').localeCompare(String(a[col] || '')))[0] || null;
const hostOf = (u) => { const m = S0(u).match(/^https?:\/\/([^\/?#]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '') : ''; };

// ---- this run ----
const gateSites = tryAll('AI Rank Live').filter(x => x.site_id && !x.skip && !x.error);
const monitor = monitorSites('ai');
const plansG = tryAll('Growth Plan').filter(p => p.site_id && !p.nothing_to_do);
const earnedG = tryAll('Earned Media').filter(e => e.site_id);
const metricsG = tryAll('Growth Metrics').filter(m => m.site_id && !m.skip);
const robotsG = tryAll('Robots Verdicts (Growth)').filter(r => r.site_id);
const fetchedG = tryAll('AI Rank Fetched').filter(f => f.site_id);   // wave 2 (P5): absent until then, so nothing outside is read
// ---- stored data (the AI Growth loads, plus AIR's own) ----
const promptsAll = rowsOf('Load AI Prompts'), answersAll = rowsOf('Load AI Answers'), visAll = rowsOf('Load AI Visibility'), aiPagesAll = rowsOf('Load AI Pages');
const targetsAll = rowsOf('Load AI Targets'), monRows = rowsOf('Load Monitors'), laddersAll = rowsOf('Load Ladders'), logAll = rowsOf('Load Content Log');
const rqAll = rowsOf('Load AI Rank Questions'), raAll = rowsOf('Load AI Rank Actions'), rsAll = rowsOf('Load AI Rank Sources'), rpAll = rowsOf('Load AI Rank Priors'), rrAll = rowsOf('Load AI Rank Runs');
const indexAll = rowsOf('Load Index Pages (Rank)'), serpRows = rowsOf('Load SERP Cache (Rank)'), dailyAll = rowsOf('Load AI Daily (Rank)');
const answers28All = rowsOf('Load AI Answers (Rank)'), queryAll = rowsOf('Load Query History');   // P1: the source graph reads 28 days of answers; Search Console queries feed demand
const listingsAll = rowsOf('Load Listings (Rank)'), outreachAll = rowsOf('Load Link Outreach (Rank)'), prospectsAll = rowsOf('Load Link Prospects (Rank)');

// Google results pages the engines' searches return (seo_cache serp:*, any date, each labelled with its reading date). FX-A RA-13: one reading per
// keyword AND location (`by_loc`; the latest of each), so ARD reads only a results page of the question's market; the entry's own fields are the
// latest reading of any location (read when the market is not known)
const serp = new Map();
const putSerp = (m, k, e) => { const prev = m.get(k); const by = Object.assign({}, prev ? prev.by_loc : {}); const lk = String(Number(e.location_code) || 0);
  if (!by[lk] || String(by[lk].read_at) <= String(e.read_at)) by[lk] = e; const latest = !prev || String(prev.read_at) <= String(e.read_at) ? e : prev; m.set(k, Object.assign({}, latest, { by_loc: by })); };
for (const r of serpRows) { const v = P(r.value, null); if (!v || typeof v !== 'object' || !v.keyword || SU.poisoned(v)) continue;   // SERP-GOTO (2026-11-08): a reading stored with Google redirect links and no site behind them is not a reading
  putSerp(serp, SC.normKw(v.keyword), { results: (v.items || []).filter(x => x && x.type === 'organic' && x.url).map(x => ({ url: x.url, pos: Number(x.rank_group || x.rank_absolute) || null })), read_at: String(v.at || v.day || ''), location_code: Number(v.location_code) || 0 }); }

// the robots verdict of this run, in the shape ARD reads: { robots: { bot: { allowed_root, rule } }, blocked_engines, read_at }
const BOT_ENGINES = { 'OAI-SearchBot': ['chatgpt', 'chatgpt_api'], 'ChatGPT-User': ['chatgpt', 'chatgpt_api'], 'PerplexityBot': ['perplexity'], 'Perplexity-User': ['perplexity'],
  'Claude-SearchBot': ['claude'], 'Claude-User': ['claude'], 'Bingbot': ['copilot'], 'Googlebot': ['ai_overview', 'ai_mode', 'gemini'], 'Google-Extended': [] };
const accessOf = (rv) => { if (!rv) return { robots: {}, blocked_engines: [], read_at: '', basis: 'robots.txt was not read this run' };
  const robots = {}; for (const b of (rv.bots || [])) robots[b.bot] = { allowed_root: rv.found ? b.allowed_root : null, rule: b.root_rule || '' };
  const byEngine = {}; for (const [bot, engines] of Object.entries(BOT_ENGINES)) { if (!robots[bot]) continue; for (const e of engines) (byEngine[e] = byEngine[e] || []).push(robots[bot].allowed_root); }
  const blocked_engines = Object.keys(byEngine).filter(e => byEngine[e].length && byEngine[e].every(x => x === false)).sort();
  return { robots, blocked_engines, read_at: S0(rv.checked_at), basis: rv.found ? 'measured' : rv.unavailable ? 'not available' : 'measured (no robots.txt)' }; };

// Bing's list of the sites this account manages (Fetch Bing Sites (Growth)), read once. `null` when it was not read (Bing off, the call failed,
// an empty answer): then nobody knows whether a site is in Bing, and `in_account` must be null, never false (a false "not in Bing" gave
// techand.ai, which is in Bing, a Copilot S0 and a Bing step). Growth Metrics' own in_account is left as it is: it feeds the report.
const bingList = (() => { try { const r = $('Fetch Bing Sites (Growth)').first(); const j0 = r && r.json; if (!j0 || typeof j0 !== 'object' || j0.error) return null;
  let j = j0; if (j0.d === undefined) { const b = j0.body ?? j0.data; if (b && typeof b === 'object') j = b; else { try { j = JSON.parse(b || '{}'); } catch (e) { j = {}; } } }
  return Array.isArray(j.d) ? j.d.filter(x => x && x.Url) : null; } catch (e) { return null; } })();
// D24 (P5): this run's fan-out results pages (AI Rank Fetched `serp_reads`, Google only; Bing's reach the kits through bing_stats.positions) are
// merged into the site's own copy of the Google map, a later reading of the same search winning, so the S1 / S2 proxy basis can be read
const serpFor = (f) => { const reads = f && Array.isArray(f.serp_reads) ? f.serp_reads.filter(r => r && (!r.engine || r.engine === 'google')) : []; if (!reads.length) return serp;
  const m = new Map(serp); for (const r of reads) { const k = SC.normKw(r.query || r.key); if (!k) continue;
    putSerp(m, k, { results: (r.results || []).filter(x => x && x.url).map(x => ({ url: x.url, pos: Number(x.pos) || null })), read_at: String(r.read_at || ''), location_code: Number(r.location_code) || 0 }); }
  return m; };
const rawHost = (u) => { const m = S0(u).match(/^https?:\/\/([^\/?#:]+)/i); return m ? m[1].toLowerCase() : ''; };
// RA-4 (FX-A): the exposure ledger - which questions each EXECUTED action (mode on; shadow rows execute nothing) works on, from its registration to
// the end of its window (open-ended while it is open). The levers that touch every question alike (ARL.UNIFORM) are not exposure.
const exposureOf = (rows) => rows.filter(a => a && S0(a.mode) === 'on' && !['shadow', 'refused', ''].includes(S0(a.status)) && !ARL.UNIFORM.includes(S0(a.lever))).map(a => {
  const pre = P(a.prereg_json, {}) || {}; const vf = P(a.verify_json, {}) || {}; const win = Math.max(AIR_CFG.window_min_days, Number(pre.window_days) || 0);
  const t0 = Date.parse(S0(pre.t0_rule === 'live_at' ? vf.live_at : '') || S0(a.happened_at) || S0(vf.at)); const open = AIR_CFG.open.includes(S0(a.status)) && S0(a.status) !== 'done';
  const to = open ? '' : Number.isFinite(t0) ? new Date(t0 + win * DAY).toISOString() : S0(a.updated_at);
  return { action_id: S0(a.action_id), lever: S0(a.lever), questions: P(a.questions, []).map(S0), from: S0(pre.registered_at) || S0(a.created_at), to, window_days: win, controls: (pre.controls || []).map(S0), open: AIR_CFG.open.includes(S0(a.status)) }; });
const out = []; const siteLearn = [];
for (const g of gateSites) {
  const sid = g.site_id;
  try {
    const rank = g.rank || AIRF.settingsOf({}); const mode = rank.mode; const on = AIRF.writesSinks(rank, false);
    const unavailable = new Set(); const un = (name, r) => { if (r && r.unavailable) unavailable.add(name); return r; };
    const s = monitor.list.find(x => x.site_id === sid) || { site_id: sid, domain: g.domain, settings: { rank, engines: [] }, profile: {}, keywords: [] };
    const dom = normD(s.domain || g.domain);
    const gp = plansG.find(p => p.site_id === sid) || {}; const em = earnedG.find(e => e.site_id === sid) || {}; const gm = metricsG.find(m => m.site_id === sid) || {};
    const fetched = fetchedG.find(f => f.site_id === sid) || null;
    const serpS = serpFor(fetched);
    const ourHosts = [...new Set([dom, 'www.' + dom, S0(gp.site_host).toLowerCase()].filter(Boolean))];
    const competitors = (gp.competitors || s.settings.competitors || []).map(normD).filter(Boolean);
    const rivals = [...new Set([...competitors, ...(gp.rival_sources || []).map(normD)].filter(d => d && d !== dom))];
    const engines = (s.settings.engines || []).filter(e => AIRF.usable(e));
    const site = { site_id: sid, domain: dom, site_host: S0(gp.site_host) || dom, country: s.country || '', location_code: Number(s.location_code) || 0, language_code: s.language_code || 'en',
      keywords: s.keywords || [], business_name: s.business_name || gp.business_name || '', services: gp.services || [], competitors, profile: s.profile || {} };
    // ---- read paths through their gates (INVARIANTS rule 2) ----
    const lrows = laddersAll.filter(l => normD(l.domain) === dom);
    const fitCtx = FITR.ctx({ own_domain: dom, competitors, heads: lrows.map(l => l.head_keyword), services: site.services });
    const fitG = FITR.rungs(lrows, fitCtx, { where: 'AI ranking (market and questions)' });
    const ladders = fitG.keep;
    const rivalWhy = (d, extra) => OK.sellsSame({ type: 'ai_source', domain: d, competitors, ai_rivals: gp.rival_sources || [], topics: gp.topics || [], ...(extra || {}) });
    const prospects = bySite(prospectsAll, sid, dom).filter(r => !rivalWhy(r.prospect_domain));
    const outreach = bySite(outreachAll, sid, dom).filter(r => !rivalWhy(r.prospect_domain));
    const listings = bySite(listingsAll, sid, dom);
    // ---- the site's AI data ----
    const prompts = bySite(promptsAll, sid, dom);
    const promptById = new Map(prompts.map(p => [S0(p.prompt_id), p]));
    // ONE array each, passed whole to every ARD call (P1 indexes them by question once per list): 28 days for the source graph, 8 days for the stages
    const answers28 = (() => { const a = bySite(answers28All, sid, dom); return (a.length ? a : bySite(answersAll, sid, dom)).filter(x => AIRF.usable(x.engine)); })();
    const answers8 = answers28.filter(a => { const t = Date.parse(a.checked_at); return !Number.isFinite(t) || t >= nowMs - 8 * DAY; });
    const visRows = bySite(visAll, sid, dom);
    const visLast = latest(visRows, 'checked_at') || {};
    const rule = ((AVX.unpackUnits(visLast.units_json) || {}).rule_version) || S0(visLast.rule_version);
    const hist = AVX.history({ rule, from: new Date(nowMs - 60 * DAY).toISOString(), to: new Date(nowMs + 1).toISOString(), vis_rows: visRows, daily_rows: bySite(dailyAll, sid, dom) });
    const units60 = (hist.units || []).filter(u => AIRF.usable(u.engine));
    const demand = P(visLast.demand_json, {}) || {};   // the AI search demand per question (ARL.value)
    const queries = bySite(queryAll, sid, dom); const gsc = new Map(); for (const q of queries) { const k = S0(q.query).toLowerCase(); if (k) gsc.set(k, Math.max(gsc.get(k) || 0, Number(q.impressions) || 0)); }
    // LIVE1 (2026-11-07): the page Search Console shows for each query (the one with the most impressions): a concrete address for a refresh (ARL.candidates)
    const gscPages = new Map(); { const best = new Map(); for (const q of queries) { const k = S0(q.query).toLowerCase().replace(/\s+/g, ' '); const u = S0(q.page); const im = Number(q.impressions) || 0; if (!k || !u) continue; const b = best.get(k); if (!b || im > b) { best.set(k, im); gscPages.set(k, u); } } }
    const monRow = monRows.find(m => m.site_id === sid) || {};
    const aiPages = bySite(aiPagesAll, sid, dom);
    const storedQ = new Map(bySite(rqAll, sid, dom).map(r => [S0(r.prompt_id), r]));
    const storedA = bySite(raAll, sid, dom);   // (also read by the arms below: the exposure ledger)
    const storedSrc = bySite(rsAll, sid, dom);
    const runsPrev = bySite(rrAll, sid, dom).filter(r => r.run_id !== g.run_id);
    const prevRun = latest(runsPrev, 'checked_at');
    const access = accessOf(robotsG.find(r => r.site_id === sid));
    const bingIn = bingList === null ? null : bingList.some(x => { const h = rawHost(x.Url); return (h && h === S0(gp.site_host).toLowerCase()) || h.replace(/^www\./, '') === dom; });   // the list read: in it or not; not read: null
    const index = { google: new Map(bySite(indexAll, sid, dom).map(r => [AIRF.urlKey(r.url), S0(r.state || r.coverage)])),
      bing: { in_account: bingIn, crawled: new Map(aiPages.filter(p => S0(p.bing_crawled_at)).map(p => [AIRF.urlKey(p.url), S0(p.bing_crawled_at)])) },
      brave: fetched && fetched.brave ? new Map(Object.entries(fetched.brave)) : null, cc_captures: fetched && fetched.cc_captures != null ? Number(fetched.cc_captures) : null, gsc };
    const brandKnown = visLast.perception_json ? !!(P(visLast.perception_json, {}) || {}).known : null;
    // ---- A: market, core panel, arms, MDE ----
    const market = un('ARD.market', ARD.market({ site, ladders, tracked: site.keywords, monitors: monRow, profile: site.profile, gscCountries: [] }));
    // corePanel's demand (P1): { byPrompt: { prompt_id: { volume } }, candidates: [{ keyword, question?, source, volume, market }] } - candidates from the
    // gated ladder keywords and the site's own Search Console queries
    const mkt = market.unavailable || !market.cc ? '' : market.cc + '-' + (market.lang || 'en');
    const candidatesQ = [...ladders.map(l => ({ keyword: S0(l.keyword).toLowerCase(), source: 'ladder', volume: Number(l.volume) || 0, market: mkt })),
      ...[...gsc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => ({ keyword: k, source: 'gsc', volume: v, market: mkt }))].filter(c => c.keyword);
    const panelDemand = { byPrompt: Object.fromEntries(prompts.map(p => [S0(p.prompt_id), { volume: Number(p.volume) || 0 }])), candidates: candidatesQ };
    const panel0 = un('ARD.corePanel', ARD.corePanel({ site, prompts, units60, stored: [...storedQ.values()], market, demand: panelDemand, now: nowMs, cfg: {} }));
    // RA-2 (FX-A): a control is replaced only by a treated question no executed step worked on in the last two windows, and never rotates while it is a
    // registered control of an open action
    const exposure = exposureOf(storedA);
    const exposedQ = new Set(exposure.filter(x => !x.to || Date.parse(x.to) >= nowMs - 2 * x.window_days * DAY).flatMap(x => x.questions));
    const lockedQ = new Set(exposure.filter(x => x.open).flatMap(x => x.controls));
    const arms = ARD.assignArms({ core: panel0.core || [], stored: [...storedQ.values()], seed: sid, now: nowMs, site_id: sid, holdout_days: 84, exposed: exposedQ, locked: lockedQ }) || [];
    const armOf = new Map(arms.map(a => [S0(a.prompt_id), a]));
    const qT = arms.filter(a => a.arm === 'treated').length, qC = arms.filter(a => a.arm === 'control').length;
    // RA-11 (FX-A): m = answers per core question in the last 28 days (the period the formula assumes), p = the named share on the core (no brand
    // question); the memo prints the test actually run - one question (own page, passage fix, correction), a placement on 3 - beside the panel figure
    const coreSet = new Set((panel0.core || []).map(c => S0(c.prompt_id))); const u28 = units60.filter(u => coreSet.has(S0(u.prompt_id)) && Date.parse(u.at) > nowMs - 28 * DAY);
    const perQ = new Map(); for (const u of u28) perQ.set(u.prompt_id, (perQ.get(u.prompt_id) || 0) + 1);
    const mAns = perQ.size ? Math.round([...perQ.values()].reduce((a, b) => a + b, 0) / perQ.size) : 0;
    const pNamed = u28.length ? u28.filter(u => u.named).length / u28.length : 0;
    const mde0 = un('ARD.mde', ARD.mde({ q_t: qT, q_c: qC, m: mAns, p: pNamed, rho: 0.3 }));
    const mde = mde0.unavailable ? mde0 : Object.assign({}, mde0, { one_question: qC ? ARD.mde({ q_t: 1, q_c: qC, m: mAns, p: pNamed, rho: 0.3 }) : null, page_level: qC && qT ? ARD.mde({ q_t: Math.min(3, qT), q_c: qC, m: mAns, p: pNamed, rho: 0.3 }) : null, page_level_q: Math.min(3, qT) });
    // ---- B: the stage of each question x engine ----
    const coreIds = new Set((panel0.core || []).map(c => S0(c.prompt_id)));
    const LIVE_OUT = new Set(['off', 'refused', 'retired', 'proposed']);
    const asked = prompts.filter(p => coreIds.has(S0(p.prompt_id)) || (!LIVE_OUT.has(S0(p.status || 'active').toLowerCase()) && !S0(p.retired_at)));
    const evidenceOf = new Map();
    const diag = [];
    for (const p of asked) { const pid = S0(p.prompt_id);
      const ev = ARD.rollEvidence({ stored: S0((storedQ.get(pid) || {}).evidence_json), answers8, now: nowMs, prompt_id: pid, ourHosts }); evidenceOf.set(pid, typeof ev === 'string' ? ev.slice(0, 8192) : '');
      const d = un('ARD.diagnose', ARD.diagnose({ site, prompt: p, answers8, units60, evidence: evidenceOf.get(pid), access, pages: aiPages, index, serp: serpS,
        bingStats: fetched ? fetched.bing_stats || null : null, brave: index.brave, brandKnown, ourHosts, rivals, engines, now: nowMs, cfg: {} }));
      if (!d.unavailable) diag.push(d); }
    // ---- E: value and feasibility per question ----
    const values = {}, feas = {};
    for (const d of diag) { const p = promptById.get(S0(d.prompt_id)) || {};
      const v = un('ARL.value', ARL.value({ prompt: p, demand: demand[S0(d.prompt_id)] || demand[S0(p.keyword).toLowerCase()] || (gsc.get(S0(p.keyword).toLowerCase()) ? { gsc_impressions_28d: gsc.get(S0(p.keyword).toLowerCase()) } : null), intent: d.intent, stage: p.stage }));
      const a8 = answers8.filter(x => S0(x.prompt_id) === S0(d.prompt_id));
      const f = un('ARL.feasibility', ARL.feasibility({ prompt: p, market, diag: typeof ARL.rivalsMedian === 'function' ? { ...d, rivals_median: ARL.rivalsMedian(a8) } : d, reach: null }));
      if (!v.unavailable) values[S0(d.prompt_id)] = v; if (!f.unavailable) feas[S0(d.prompt_id)] = f; }
    // ---- C: the source graph ----
    const sources = (ARD.sources({ answers8: answers28, storedSources: storedSrc, mentionsPages: fetched ? fetched.mentions_pages || [] : [], fetched: em.earned || [], prompts,
      values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.V])), rivals, ourHosts, now: nowMs }) || [])
      .slice().sort((a, b) => (Number(b.influence) || 0) - (Number(a.influence) || 0)).slice(0, AIR_CFG.sources_max);
    // FX-A2: the pages the client gave us (the app's source rows, source_from 'client', written only when its own fetch found the business named)
    // are kept as written whatever their influence: they are what L11-L15 / L17 verify against; a weekly run never re-reads or rewrites them
    { const own = storedSrc.filter(r => S0(r.source_from) === 'client' && S0(r.url_key || AIRF.urlKey(r.url)));
      for (const r of own) { const k = S0(r.url_key) || AIRF.urlKey(r.url); const i = sources.findIndex(x => (S0(x.url_key) || AIRF.urlKey(x.url)) === k); const base = i >= 0 ? sources[i] : { url_key: k, url: S0(r.url), host: S0(r.host), page_type: S0(r.page_type), author_kind: S0(r.author_kind), questions: P(r.questions, []), engines: P(r.engines, []), influence: 0, placeability: 0, cites_28d: 0 };
        const x = Object.assign({}, base, { names_client: r.names_client === true || S0(r.names_client) === 'true', from: 'client', checked_at: S0(r.checked_at), last_seen: S0(r.last_seen) || S0(r.checked_at), first_seen: S0(r.first_seen), client: true });
        if (i >= 0) sources[i] = x; else sources.push(x); } }
    const srcByKey = new Map(sources.map(x => [S0(x.url_key) || AIRF.urlKey(x.url), x]));
    // ---- D / E: candidates, scores, the choice ----
    const candidates = ARL.candidates({ site: { ...site, hosts: ourHosts, prompts, pages: aiPages, gsc_pages: gscPages }, diag, sources, arms, stored_actions: storedA, settings: rank, now: nowMs }) || [];
    // LIVE1 (2026-11-07): every placement (a pitch: sink prospect) passes the Link Builder's own vetting BEFORE the choice (OK.placementVet: its
    // stored verdicts, an earlier pitch to the same site, and its rules that need no page), so a refused or already-pitched list is never chosen
    // and the pitch slots go to the next candidates. A reachable contact is preferred; a contact form only is allowed and marked a manual step.
    const outreachSite = bySite(outreachAll, sid, dom), prospectsSite = bySite(prospectsAll, sid, dom);
    // LIVE1: an own page passes the Content Cadence's own freshness rules before the choice, so the one AI ranking page of the week is one the
    // reserved slot can write (live, both sites' refresh targets were pages the agent had published 7-9 days before: the cadence refused both).
    // A refresh waits 60 days after the page was refreshed or published (Cadence_Plan refreshedRecently, F-38); a new page waits 90 days after a
    // page for the same keyword was started or published (Cadence_Plan recent). The question's other own pages and the other questions stay open.
    const keyOfU = (u) => S0(u).toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
    const normKw = (k) => S0(k).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
    const logSite = bySite(logAll, sid, dom); const freshAt = new Map(), kwAt = new Map();
    for (const l of logSite) { const st0 = Date.parse(S0(l.started_at)), pb = Date.parse(S0(l.published_at));
      if (S0(l.existing_page_url) && Number.isFinite(st0) && nowMs - st0 < 60 * DAY) freshAt.set(keyOfU(l.existing_page_url), S0(l.started_at).slice(0, 10));
      if (S0(l.published_url) && Number.isFinite(pb) && nowMs - pb < 60 * DAY) freshAt.set(keyOfU(l.published_url), S0(l.published_at).slice(0, 10));
      if (S0(l.keyword) && (S0(l.status) === 'published' || (Number.isFinite(st0) && nowMs - st0 < 90 * DAY))) kwAt.set(normKw(l.keyword), S0(l.published_at || l.started_at).slice(0, 10)); }
    const ownWhy = (c) => { if (c.lever === 'L06') { const at = freshAt.get(keyOfU(S0((c.ref || {}).url) || c.page_url)); return at ? 'its page was refreshed or published on ' + at + ': the Content Cadence refreshes a page again only after 60 days' : ''; }
      const kw = normKw(c.keyword || (promptById.get(S0((c.ref || {}).prompt_id)) || {}).keyword); const at = kw ? kwAt.get(kw) : ''; return at ? 'a page for "' + kw + '" was written on ' + at + ': the Content Cadence writes a search again only after 90 days' : ''; };
    const vetted = candidates.map(c => { if (c.sink === 'ai_target' && !c.refused && ['L05', 'L06'].includes(c.lever)) { const w = ownWhy(c); return w ? { ...c, refused: 'not written this week: ' + w } : c; }
      if (c.sink !== 'prospect' || c.refused) return c; const url = S0((c.ref || {}).url); const src = url ? srcByKey.get(AIRF.urlKey(url)) || {} : {};
      const v = OK.placementVet({ url, domain: hostOf(url), title: S0(src.title), outreach: outreachSite, prospects: prospectsSite, competitors, ai_rivals: gp.rival_sources || [], topics: gp.topics || [], terms: site.services, contact_email: S0(src.contact_email), contact_url: S0(src.contact_url) });
      if (v.refused) return { ...c, refused: 'not pitched (the Link Builder\'s vetting): ' + v.refused };
      if (v.contact === 'email') return { ...c, contact: 'email', contact_email: v.email };
      if (v.contact === 'form') return { ...c, contact: 'form', contact_url: v.form, manual: true, factor: Math.round(1e4 * (Number(c.factor) || 1) * 0.7) / 1e4, why: S0(c.why) + '; a contact form only: a manual step (send it yourself through ' + v.form + ')' };
      return { ...c, contact: '', factor: Math.round(1e4 * (Number(c.factor) || 1) * 0.85) / 1e4 }; });
    const scored = vetted.map(c => { const sc = un('ARL.score', ARL.score(c, { priors: rpAll, values, feas, weights: null, H: AIR_CFG.H })); return sc.unavailable ? null : { ...c, ...sc }; }).filter(Boolean);
    const openStored = storedA.filter(a => AIR_CFG.open.includes(S0(a.status)));
    const choice = ARL.choose(scored, { capacities: {}, arms, mode, open_actions: storedA.filter(a => ['shadow', ...AIR_CFG.open].includes(S0(a.status))), now: nowMs, units60, exposure }) || { chosen: [], deferred: [], refused: [] };
    // the gate on the way out: a placement pitch to a competitor's own page is refused here, whatever the kit chose (rival lists: learn only)
    const refused = (choice.refused || []).slice(); const chosen = [];
    // LIVE1: ARL.choose returns its own action shape; the vetting's contact facts are carried back by action id (the sink reads them)
    const vetById = new Map(vetted.filter(c => c.sink === 'prospect').map(c => [S0(c.action_id), c]));
    for (const a0 of (choice.chosen || [])) { const vc = vetById.get(S0(a0.action_id)); const a = vc ? { ...a0, contact: vc.contact || '', contact_email: S0(vc.contact_email), contact_url: S0(vc.contact_url), manual: vc.manual === true } : a0;
      const url = S0((a.ref || {}).url); const src = url ? srcByKey.get(AIRF.urlKey(url)) : null;
      if (a.sink === 'prospect') { const why = rivalWhy(hostOf(url), { url, title: src ? src.title || '' : '' });
        if (why || (src && ['rival', 'client'].includes(S0(src.author_kind)))) { refused.push({ what: a.action_id || a.lever, why: why || 'a page written by ' + (src.author_kind === 'client' ? 'the client' : 'a competitor') + ': learned from, never pitched' }); continue; } }
      // RA-14 (FX-A): an own page is screened against the refused tactics before anything is written (shadow shows it too)
      let screen = null; if (['L05', 'L06'].includes(S0(a.lever)) && typeof ARL.screenOwnPage === 'function') { const pq = promptById.get(S0((a.ref || {}).prompt_id)) || {};
        screen = ARL.screenOwnPage({ keyword: pq.keyword || pq.topic, question: pq.prompt, fanouts: ARD.fanoutOf({ prompt_id: S0((a.ref || {}).prompt_id), answers8, evidence: evidenceOf.get(S0((a.ref || {}).prompt_id)) || '' }).slice(0, 8) });
        if (screen.refused) { refused.push({ what: a.action_id || a.lever, why: screen.refused.id + ': ' + screen.refused.why }); continue; } if (!screen.page_type) screen = null; }
      chosen.push({ ...a, screen, prereg: a.prereg && !a.prereg.unavailable ? a.prereg : ARL.prereg(a, { arms, units60, now: nowMs, exposure }) }); }
    // ---- G: verify and judge (only actions AIR executed: mode `on`, an open status); learning runs ONCE after every site (RA-10) ----
    // RA-1 / RA-9 (FX-A): the stages and answer counts at the start are frozen in verify_json (t0_snapshot) the first time our check finds the action
    // done, from the latest stored reading at or before its start (the compact stages_json of the run rows), else this run's reading (labelled)
    const readings = runsPrev.map(r => ({ at: S0(r.checked_at), diag: S0(r.stages_json) ? r.stages_json : P(r.diag_json, []), basis: 'the AI ranking reading of ' + S0(r.checked_at).slice(0, 10) })).filter(x => x.at);
    const stagesAt = (t) => { let best = null; for (const r of readings) { const x = Date.parse(r.at); if (!Number.isFinite(x) || !Number.isFinite(t) || x > t + 6 * 3600e3 || t - x > 14 * DAY) continue; const d = ARL.stagesUnpack(r.diag); if (d.length && (!best || x > best.x)) best = { x, d }; } return best ? best.d : null; };
    const outcomes = [];
    for (const a of openStored.filter(x => S0(x.mode) === 'on')) {
      const qs0 = P(a.questions, []); const act = { ...a, ref: P(a.ref, {}), questions: qs0, engines: P(a.engines, []), expected: P(a.expected_json, {}), prereg: P(a.prereg_json, {}), keyword: S0((promptById.get(S0(qs0[0])) || {}).keyword) };
      const v = ARL.verify(act, { contentLog: bySite(logAll, sid, dom), pages: aiPages, index, listings, outreach, sources, robots: access, bing: index.bing, now: nowMs });
      const sv = P(a.verify_json, {}) || {}; let snap = sv.t0_snapshot || null; const first = !S0(a.happened_at);
      const t0 = Date.parse(act.prereg.t0_rule === 'live_at' ? S0(v.live_at || sv.live_at || a.live_at) : S0(a.happened_at || v.at));
      if (!snap && v.happened === true && Number.isFinite(t0)) snap = ARL.snapshotT0(act, { t0, readings, diagNow: first ? diag : null, units: units60, now: nowMs });   // a start seen weeks ago is never read from this week's stages
      const v2 = snap ? { ...v, t0_snapshot: snap } : v;
      const o = ARL.outcome(act, { units60, diagNow: diag, diagAtT0: snap ? null : stagesAt(t0), arms, now: nowMs, verified: v2, exposure });
      outcomes.push({ action_id: a.action_id, lever: a.lever, site_id: sid, action: { ...a, site_id: sid }, verify: v2, outcome: o, happened: v.happened === true }); }   // ARL.learn / learnable read { action, outcome, happened }
    // RA-12: the false discovery rate over the actions judged in the last quarter (stored verdicts are history, never rewritten)
    const fdrR = typeof ARL.fdr === 'function' ? ARL.fdr({ outcomes, judged: storedA, now: nowMs }) : null;
    // ---- H: the old logic's choice, the comparison, the memo ----
    const old = { targets: (gm.targets || gp.targets || []).filter(t => S0(t.status) === 'queued').slice(0, 10).map(t => ({ target_id: t.target_id, prompt_id: t.prompt_id || '', question: t.question, kind: t.kind, page_url: t.page_url || '', value: t.value })),
      earned: (em.earned || gp.earned || []).slice(0, 10).map(e => ({ url: e.url, host: e.host || hostOf(e.url), kind: e.kind || '', citations: e.citations || 0, mentions_us: e.mentions_us === true, action: S0(e.action_type || e.action).slice(0, 160) })),
      actions: (gm.actions || []).slice(0, 12).map(x => ({ priority: x.priority, type: x.type, action: S0(x.action).slice(0, 200) })) };
    const compare = un('ARL.compareOld', ARL.compareOld({ chosen, old }));
    const blockers = (gm.actions || []).filter(x => ['bing', 'indexnow', 'robots', 'fetchers', 'access', 'render'].includes(S0(x.type))).slice(0, 8).map(x => ({ what: S0(x.action).slice(0, 200), owner: 'client', since: '', blocks: S0(x.why).slice(0, 200) }));
    const cost = { usd: fetched ? Math.round(1e4 * (Number(fetched.cost_usd) || 0)) / 1e4 : 0, basis: fetched ? 'AI Rank Fetched (measured, counted once by task id)' : 'stored data only: no paid or outside read this run' };
    // RA-9: last week's stages come from the compact stages_json (the full diagnosis is trimmed from a run row of about 20 questions or more)
    const diagPrev = !prevRun ? [] : (() => { const st = ARL.stagesUnpack(prevRun.stages_json); if (st.length) return st; const d = P(prevRun.diag_json, []); return Array.isArray(d) ? d : []; })();
    const memo = un('ARL.memo', ARL.memo({ site, diagNow: diag, diagPrev, chosen, open: openStored, outcomes, mde, blockers, cost, old, mode }));
    const panel = { core: panel0.core || [], proposed: panel0.proposed || [], extend: panel0.extend || [], comparable: !!panel0.comparable, why: S0(panel0.why), arms, mde: mde.unavailable ? null : mde };
    // ---- the rows of the five AIR tables (shadow and on) ----
    const q_rows = diag.map(d => { const pid = S0(d.prompt_id); const p = promptById.get(pid) || {}; const c = (panel.core || []).find(x => S0(x.prompt_id) === pid) || null; const sq = storedQ.get(pid) || {};
      const ext = (panel.extend || []).find(x => S0(x.prompt_id) === pid) || null; const arm = armOf.get(pid) || {}; const v = values[pid] || null; const f = feas[pid] || null;
      return { site_id: sid, domain: dom, prompt_id: pid, question: S0(p.prompt).slice(0, 300), intent: S0(d.intent), market: S0(p.market) || (market.unavailable || !market.cc ? '' : market.cc + '-' + (market.lang || 'en')),
        core: !!c, core_since: c ? S0(c.core_since) : S0(sq.core_since), core_until: ext ? S0(ext.core_until) : c ? S0(c.core_until) : '', arm: S0(arm.arm || sq.arm), stratum: S0(arm.stratum || sq.stratum), arm_since: S0(arm.assigned_at || sq.arm_since),
        value: v ? Number(v.V) || 0 : null, demand: v ? Number(v.demand_w) || 0 : null, demand_basis: v ? S0(v.basis).slice(0, 300) : '', feasibility: f ? Number(f.F) || 0 : null,
        stage_json: J(d.engines || {}), best_stage: S0(d.best_stage), parametric_json: J({ parametric_share: d.parametric_share || {}, no_search: d.no_search || [], list_dominated: !!d.list_dominated, nobody_named: !!d.nobody_named }),
        evidence_json: evidenceOf.get(pid) || '', first_named_at: S0(d.first_named_at), last_named_at: S0(d.last_named_at), last_cited_at: S0(d.last_cited_at), updated_at: nowIso, rule_version: AIRF.RULE_VERSION }; });
    const statusOf = (a) => !on ? 'shadow' : (['ai_target', 'prospect', 'protect'].includes(a.sink) || (a.executor === 'human')) ? 'queued' : 'proposed';
    const sinkRefOf = (a) => !on ? '' : a.sink === 'ai_target' ? AIRF.targetId(sid, S0((a.ref || {}).prompt_id)) : a.sink === 'prospect' ? hostOf((a.ref || {}).url) : a.sink === 'protect' ? AIRF.protectKey(sid) : '';
    const storedById = new Map(storedA.map(a => [S0(a.action_id), a]));
    const a_rows = [];
    for (const a of chosen) { const id = S0(a.action_id) || AIRF.actionId(sid, a.lever, a.ref); const st = storedById.get(id) || {};
      // RA-7 (FX-A): a registration is kept only by an attempt that is still open and executed (`on`); a shadow row, or an attempt that ended (did not
      // happen, expired, verified), is registered afresh (registration date, baseline, controls), the earlier attempts kept as history in prereg_json
      const keep = on && AIR_CFG.open.includes(S0(st.status)) && S0(st.mode) === 'on' && !!S0(st.prereg_json);
      const old = !keep && S0(st.prereg_json) && S0(st.status) !== 'shadow' && S0(st.mode) === 'on' ? P(st.prereg_json, {}) || {} : null;
      const fresh = a.prereg && !a.prereg.unavailable ? Object.assign({}, a.prereg, old ? { attempt: (Number(old.attempt) || 1) + 1, previous: [{ registered_at: S0(old.registered_at), status: S0(st.status), verdict: S0((P(st.outcome_json, {}) || {}).verdict) }, ...(old.previous || [])].slice(0, 5) } : {}) : null;
      a_rows.push({ action_id: id, site_id: sid, domain: dom, lever: S0(a.lever), executor: S0(a.executor), scope: S0(a.scope), ref: J(a.ref || {}), questions: J(a.questions || []), engines: J(a.engines || []),
        target_stage: S0(a.target_stage), status: statusOf(a), sink: S0(a.sink), sink_ref: keep ? S0(st.sink_ref) || sinkRefOf(a) : sinkRefOf(a), expected_json: J(a.expected || { p: a.p_hat, gain: a.gain, cost: a.cost, score: a.score, days: a.days }),
        prereg_json: keep ? S0(st.prereg_json) : fresh ? J(fresh) : '',   // written once per attempt, never changed while it runs
        happened_at: keep ? S0(st.happened_at) : '', verify_json: keep ? S0(st.verify_json) : '', outcome_json: keep ? S0(st.outcome_json) : '', learned_at: keep ? S0(st.learned_at) : '', mode, run_id: g.run_id, created_at: keep ? S0(st.created_at) || nowIso : nowIso, updated_at: nowIso,
        client_url: S0(st.client_url) }); }   // FX-A2: the address the client pasted is never wiped by a weekly run (a new attempt re-checks the same page)
    // every stored action has an exit (INVARIANTS rule 4): verified / not happened from its outcome, `expired` once its window + 14 days passed
    const chosenIds = new Set(a_rows.map(r => r.action_id)); const pendingOc = [];
    for (const o of outcomes) { const a = storedById.get(S0(o.action_id)); if (!a || chosenIds.has(S0(a.action_id))) continue; const v = o.verify || {}; const oc = o.outcome || {};
      const status = v.happened === true ? (oc.due && oc.verdict && oc.verdict !== 'not_due' ? 'verified' : 'done') : v.happened === false && oc.due ? 'not_happened' : S0(a.status);
      if (status === S0(a.status) && !(v.happened === true && !S0(a.happened_at))) continue;
      const row = { ...a, status, happened_at: v.happened === true ? (S0(a.happened_at) || S0(v.at) || nowIso) : S0(a.happened_at), verify_json: J(v), outcome_json: oc.due ? J(oc) : S0(a.outcome_json),
        learned_at: !S0(a.learned_at) && typeof ARL.learnable === 'function' && ARL.learnable(o) ? nowIso : S0(a.learned_at), updated_at: nowIso };
      a_rows.push(row); if (oc.due) pendingOc.push({ row, oc, id: S0(a.action_id) }); chosenIds.add(S0(a.action_id)); }
    // RA-16 (FX-A): an executed action that never happened expires at its registration + the lever's longest time to effect + 14 days (ARL.expiryDays,
    // as verify); one that happened is never expired here (it waits for the end of its window); a shadow plan not chosen again: its window + 14 days
    const judgedNow = new Set(outcomes.map(o => S0(o.action_id)));   // verify ran on these this run, with its own clock (a placement's starts at the pitch): no second clock here
    for (const a of storedA) { if (chosenIds.has(S0(a.action_id)) || judgedNow.has(S0(a.action_id)) || !['shadow', ...AIR_CFG.open].includes(S0(a.status)) || S0(a.happened_at) || S0(a.status) === 'done') continue;
      const pre = P(a.prereg_json, {}) || {}; const win = Math.max(AIR_CFG.window_min_days, Number(pre.window_days) || 0); const sh = S0(a.status) === 'shadow';
      const since = Date.parse(sh ? a.updated_at || a.created_at : S0(pre.registered_at) || a.created_at || a.updated_at);
      const days = sh ? win + AIR_CFG.expire_grace_days : (typeof ARL.expiryDays === 'function' ? ARL.expiryDays(S0(a.lever), pre) : win + AIR_CFG.expire_grace_days);
      if (Number.isFinite(since) && nowMs - since > days * DAY) a_rows.push({ ...a, status: 'expired', updated_at: nowIso }); }
    const s_rows = sources.map(x => { const k = S0(x.url_key) || AIRF.urlKey(x.url); const st = storedSrc.find(r => S0(r.url_key) === k) || {};
      return { site_id: sid, domain: dom, url_key: k, url: S0(x.url), host: S0(x.host) || hostOf(x.url), page_type: S0(x.page_type), author_kind: S0(x.author_kind), names_client: x.names_client === null || x.names_client === undefined ? null : !!x.names_client,
        rivals_named: J(x.rivals_named || []), questions: J(x.questions || []), engines: J(x.engines || []), cites_28d: Number(x.cites_28d) || 0, influence: Number(x.influence) || 0, placeability: Number(x.placeability) || 0,
        placeability_why: S0(x.placeability_why).slice(0, 300), contact_email: S0(x.contact_email), contact_url: S0(x.contact_url), source_from: S0(x.from) || 'answers', first_seen: S0(st.first_seen) || nowIso, last_seen: S0(x.last_seen) || nowIso, checked_at: x.client ? S0(x.checked_at) || S0(st.checked_at) : nowIso }; })
      .filter(r => r.url_key && !(sources.find(x => x.client && (S0(x.url_key) || AIRF.urlKey(x.url)) === r.url_key) && !storedSrc.some(z => S0(z.url_key) === r.url_key && S0(z.source_from) !== 'client')));   // FX-A2: a client row that only the app wrote is left exactly as the app wrote it
    const p_rows = [];   // filled after every site (RA-10)
    // ---- the sinks, `on` only (AIRF.writesSinks): nothing below is built for a site in shadow ----
    const sinks = { targets: [], prospects: [], proposed: [], core: [], cache: [], growth: null };
    if (on) {
      const targetsSite = bySite(targetsAll, sid, dom); const maxScore = Math.max(1e-9, ...chosen.map(a => Number(a.score) || 0));
      for (const a of chosen.filter(x => x.sink === 'ai_target')) { const pid = S0((a.ref || {}).prompt_id); const p = promptById.get(pid); if (!p) continue;
        const tid = AIRF.targetId(sid, pid); const st = targetsSite.find(t => S0(t.target_id) === tid) || {};
        if (['writing', 'written', 'won'].includes(S0(st.status))) continue;   // live work or a win: AIR leaves it alone
        const qs = sources.filter(x => (x.questions || []).includes(pid)).slice(0, 6);
        // LIVE1 (2026-11-07): a refresh carries the page it refreshes (the action's own page_url; the ref held only the question, so prod wrote '');
        // a refresh with no address could never be written by the cadence, so it is refused here with its reason, never stored
        const pageUrl = S0((a.ref || {}).url) || S0(a.page_url) || S0(st.page_url);
        if (a.lever === 'L06' && !pageUrl) { refused.push({ what: a.action_id || a.lever, why: 'a refresh with no page address: no page of the site is known for this question' }); continue; }
        sinks.targets.push({ target_id: tid, site_id: sid, domain: dom, prompt_id: pid, question: S0(p.prompt), keyword: S0(p.keyword || p.topic), kind: a.lever === 'L06' ? 'refresh' : 'answer',
          page_url: a.lever === 'L06' ? pageUrl : S0(st.page_url), page_type: a.lever === 'L06' ? '' : (a.screen && a.screen.page_type ? a.screen.page_type : (S0(st.page_type) || 'Guide')), fanout: ARD.fanoutOf({ prompt_id: pid, answers8, evidence: evidenceOf.get(pid) || '' }).slice(0, 8).map(f => f.query).join(' | '),
          sources_json: J(qs.map(x => ({ u: x.url, t: '', n: Number(x.cites_28d) || 1 }))), competitors: [...new Set(qs.flatMap(x => x.rivals_named || []))].slice(0, 8).join(', '), engines: (a.engines || []).join(', '), stage: S0(p.stage),
          value: Math.round(100 * (1 + 4 * Math.min(1, (Number(a.score) || 0) / maxScore))) / 100, status: 'queued', reason: ('AI ranking (' + a.lever + '): ' + (a.screen && a.screen.note ? a.screen.note + '. ' : '') + S0(a.why || (ARL.LEVERS.find(l => l.id === a.lever) || {}).label)).slice(0, 600),
          created_at: S0(st.created_at) || nowIso, updated_at: nowIso, request_id: S0(st.request_id), written_at: S0(st.written_at), won_at: S0(st.won_at), origin: 'ai_rank', action_id: S0(a.action_id), live_at: S0(st.live_at) || null }); }
      for (const a of chosen.filter(x => x.sink === 'prospect')) { const url = S0((a.ref || {}).url); const pd = hostOf(url); if (!pd) continue; const src = srcByKey.get(AIRF.urlKey(url)) || {};
        const st = prospects.find(r => S0(r.prospect_domain) === pd && S0(r.type) === 'ai_source') || null;
        if (st && !(['ai_rank', 'ai_growth', ''].includes(S0(st.origin)) && ['new', ''].includes(S0(st.status)))) continue;   // the Link Builder already works it: AIR does not take it over
        const o = st || {};
        sinks.prospects.push({ site_id: sid, domain: dom, prospect_domain: pd, type: 'ai_source', rank: Number(o.rank) || 0, spam_score: Number(o.spam_score) || 0,
          detail: ('cited for ' + (src.questions || []).length + ' question(s) on ' + (src.engines || []).length + ' engine(s)' + ((src.rivals_named || []).length ? '; names ' + src.rivals_named.slice(0, 3).join(', ') : '')).slice(0, 500),
          source_url: url, target_url: S0(o.target_url), status: S0(o.status) || 'new', first_seen: S0(o.first_seen) || nowIso, last_seen: nowIso, won_at: S0(o.won_at), outreach_subject: S0(o.outreach_subject), outreach_body: S0(o.outreach_body),
          note: S0(o.note) || ('AI ranking placement (' + a.lever + ')' + (a.manual ? ': a contact form only, a manual step' : '')), score: Math.max(0, Math.min(100, Math.round(100 * (Number((a.expected || {}).p) || Number(a.p_hat) || 0)))), origin: 'ai_rank',
          contact_email: S0(o.contact_email) || S0(src.contact_email) || S0(a.contact_email), contact_url: S0(o.contact_url) || S0(src.contact_url) || S0(a.contact_url), contacted_at: S0(o.contacted_at), followup_step: Number(o.followup_step) || 0,
          followup_subject: S0(o.followup_subject), followup_body: S0(o.followup_body), verified_at: S0(o.verified_at), drafted_at: S0(o.drafted_at) }); }
      const fitCtxQ = { ...fitCtx, topics: null };
      for (const q of (panel.proposed || [])) { const text = S0(q.prompt); if (text.length < 10 || AIP.findStored(prompts, sid, text)) continue;
        const kw = S0(q.keyword); const gate = kw ? fitGate(kw, fitCtxQ) : { ok: true }; if (!gate.ok) { refused.push({ what: 'question "' + text.slice(0, 80) + '"', why: 'not proposed: ' + S0(gate.detail || gate.reason) }); continue; }
        sinks.proposed.push({ prompt_id: AIP.promptId(sid, text), site_id: sid, domain: dom, prompt: text, kind: q.intent === 'informational' ? 'learn' : q.intent === 'brand' ? 'brand' : 'recommend', topic: kw, keyword: kw,
          source: 'ai_rank', status: 'proposed', created_at: nowIso, stage: '', cluster: '', volume: null, origin: 'ai_rank', updated_at: nowIso, persona: '', market: S0(q.market) || (market.cc ? market.cc + '-' + (market.lang || 'en') : ''),
          pinned: false, fit_note: S0(q.reason).slice(0, 300), keyword_source: 'ai_rank', last_asked_run: '', last_asked_at: '', asked_n_28d: 0, refused_at_run: '', focus_topic: '', focus_source: '', focus_state: '', focus_seen_at: '', retired_at: '', retire_reason: '' }); }
      for (const c of [...(panel.core || []), ...(panel.extend || [])]) { const pid = S0(c.prompt_id); const p = promptById.get(pid); const until = S0(c.core_until);
        if (!p || !until || S0(p.core_until) === until) continue; if (sinks.core.some(x => x.prompt_id === pid)) { sinks.core.find(x => x.prompt_id === pid).core_until = until; continue; }
        sinks.core.push({ site_id: sid, prompt_id: pid, core_until: until }); }
      const protect = chosen.filter(a => a.sink === 'protect' && S0((a.ref || {}).url)).map(a => ({ url: S0(a.ref.url), until: new Date(nowMs + AIR_CFG.protect_days * DAY).toISOString(), why: S0(a.why || 'AI answers cite this page').slice(0, 200) }));
      if (protect.length) sinks.cache.push({ key: AIRF.protectKey(sid), kind: AIRF.CACHE_KIND, site_id: sid, value: J({ urls: protect }), updated_at: nowIso });
      const human = chosen.filter(a => a.executor === 'human' || ['growth_action', 'site_task', 'listing'].includes(a.sink)).slice(0, AIR_CFG.growth_add_max);
      const gr = gm.growth_row || null;
      if (human.length && gr && gr.run_id) { const had = P(gr.actions_json, []); const list = Array.isArray(had) ? had.slice() : [];
        const lab = (a) => S0((ARL.LEVERS.find(l => l.id === a.lever) || {}).label) || a.lever;
        for (const a of human) { const item = { priority: 2, type: 'ai_rank', action: (lab(a) + (S0((a.ref || {}).url) ? ': ' + a.ref.url : '')).slice(0, 200), why: S0(a.why || 'chosen by AI ranking (' + a.lever + ')').slice(0, 300) };
          if (!list.some(x => x && x.action === item.action)) list.push(item); }
        sinks.growth = { site_id: sid, run_id: S0(gr.run_id), actions_json: J(list) }; }
    }
    const kitsMissing = [...unavailable].sort();
    const air = { market: market.unavailable ? null : market, panel: panel0.unavailable ? null : panel, diag, stages: ARL.stagesPack(diag), sources, candidates: scored.length ? scored : candidates, chosen, deferred: choice.deferred || [], refused, outcomes, priors: p_rows, memo: memo.unavailable ? null : memo,
      compare: compare.unavailable ? null : compare, cost, old, learn: [], fdr: fdrR, set_aside: fitG.set_aside || [], kits_missing: kitsMissing, rule_version: AIRF.RULE_VERSION, checked_at: nowIso,
      rows: { questions: q_rows, actions: a_rows.slice(0, AIR_CFG.actions_max), sources: s_rows, priors: p_rows }, sinks };
    out.push({ json: { site_id: sid, domain: dom, mode, run_id: g.run_id, air, error: '' } });
    siteLearn.push({ sid, air, outcomes, history: storedA.filter(a => S0(a.learned_at)), pendingOc });
  } catch (e) {
    out.push({ json: { site_id: sid, domain: g.domain || '', mode: g.mode || '', run_id: g.run_id || AIRF.runId(sid, nowMs), air: null, error: 'AI ranking plan failed for this site: ' + S0(e && e.message).slice(0, 300) } });
  }
}
// ---- G4 (RA-10, FX-A): learning ONCE over every site's outcomes, so two sites learning one key in one run build one global row, not two that
// overwrite each other; each site's item carries its own rows and the global rows of the keys it touched (identical values in every item)
if (siteLearn.length) { try {
  const allOc = siteLearn.flatMap(x => x.outcomes); const history = siteLearn.flatMap(x => x.history);
  const rowsL = (ARL.learn({ priors: rpAll, outcomes: allOc, now: nowMs, history }) || []).filter(r => r && r.prior_id).map(r => ({ ...r, updated_at: S0(r.updated_at) || nowIso, rule_version: S0(r.rule_version) || AIRF.RULE_VERSION }));
  const claimed = typeof ARL.claimCells === 'function' ? ARL.claimCells(allOc.filter(ARL.learnable), history) : new Map();
  for (const x of siteLearn) { const keys = new Set(rowsL.filter(r => r.scope === x.sid).map(r => r.lever + '|' + r.stage + '|' + r.engine_group)); const levers = new Set(x.outcomes.filter(o => ARL.learnable(o)).map(o => S0(o.lever)));
    const mine = rowsL.filter(r => r.scope === x.sid || (r.scope === 'global' && (keys.has(r.lever + '|' + r.stage + '|' + r.engine_group) || levers.has(S0(r.lever)))));
    x.air.priors.push(...mine); x.air.learn.push(...mine);
    for (const p of x.pendingOc) { const c = claimed.get(p.id); if (c && c.dropped.length) p.row.outcome_json = J(Object.assign({}, p.oc, { learn_overlap: { dropped: c.dropped, why: 'these cells were already taught by an earlier overlapping action: one move teaches one action' } })); } }
} catch (e) { for (const x of siteLearn) x.air.learn_error = 'learning failed: ' + S0(e && e.message).slice(0, 200); } }
return out.length ? out : [{ json: { skip: true, reason: 'no website to plan' } }];
