// AI visibility plan (weekly, in each website's own cycle, and on demand): one job per site — the brand names to look for, the competitors (configured, detected,
// and the brand names AI uses for them, learned by the Answer Analyst), the topics, the stored question panel (seo_ai_prompts: stable week to week
// so the trend means something; up to 50 questions with buyer stage, topic cluster and monthly AI search volume), the engines, the AI Pulse samples
// of the past days (seo_ai_daily) that join this week's figures, last week's numbers, and what is due this run: the monthly full run (Claude and the
// brand question), question discovery (Search Console questions + real questions from the AI-answer database), search volumes, the market-wide
// index (the DataForSEO AI-answer database: your share against the competitors across every answer, not only the panel), AI referral traffic from
// GA4 (visits, key events and revenue from ChatGPT, Perplexity, Gemini, Copilot, Claude …) and the AI-crawler access check. (v4.9)
// B-G1 (2026-10-15, FIX_PLAN §3.16; INVARIANTS rule 2): the question panel used to be built from EVERY stored ladder keyword, so a rung
// that is a competitor's brand or a government portal — exactly what the fit gate refuses when a rung is planned — became a question we
// ask ChatGPT and then score ourselves against. The stored rungs now go through the same read-path gate R16 built (FITR, _fit_gate.js),
// and every rung set aside travels with the plan so the report can name it with its reason instead of quietly shortening the list.
// G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): the panel holds up to 500 questions (persona, funnel stage, topic cluster, market), the weekly
// run asks all of it on every enabled engine and is SPLIT ACROSS EXECUTIONS when it is bigger than one execution should carry
// (AIP.LIMITS.chunk_requests). One run = one run_id, one state row in seo_cache (`ai_run:<site_id>`), one deterministic list of requests;
// every execution asks only what no earlier execution of the same run has answered (so a repeated or resumed chunk never pays twice), and
// the last one computes the week over every answer of the run. This node decides, per site, which of three things this execution is:
// the FIRST chunk of a new run, the NEXT chunk of a run (`continue_run` on the trigger), or the RESUME of a run that went silent (any
// start of the tracker picks it up instead of starting a second run the same week). A start while a chunk is still running is a twin and
// does nothing for that site. Each item carries what is left to spend on the run (est_dfs_usd / est_ai_usd: the run ledger reserves it,
// and the run guard refuses a run the DataForSEO account cannot pay for, with the reason).
// 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.4 / §4.5): a run of a website's weekly cycle (`trigger: 'cycle'`) is a scheduled run for one site: the
// monthly full run (Claude, the brand question, discovery of every volume, the market-wide index and the market view) comes ONLY from the
// `monthly` the Cycle Dispatcher passes - never from the UTC month - and the cycle travels with the run (`cycle`), through every continuation
// of a split run, so only the run's LAST execution settles the cycle's ledger key (Monitor_Ledger_Row).
// F2 (2026-10-23, ENGINE_AUDIT.md E1 / E11 / E17 / E18 / E20 / E22): a run that cannot pay twice. The state row records every key the run
// has SENT (`asked_keys`, written before the requests leave) and AI Requests never asks one of them again; a part whose sent keys were not
// stored is found here (the first time: counted as could-not-be-read and the next part halved; the second time: the run STOPS with an ops
// alert); the run has a hard DataForSEO ceiling (1.5 x its own estimate) checked against what it measured and committed; a part is sized
// by TIME (AIP.chunkPlan: 40 of the execution's 60 minutes), measured from the run's earlier parts. A stopped run is a plan item with
// `stop` and nothing to ask (AI Chunk Handoff writes its state, the ops alert and the caller's notice; its ledger row settles the cycle
// job). An on-demand start that meets an open run is told so at once (`notices`, a `rejected` callback with reason 'open_run', the run's
// id, its progress and when it should finish) and never takes over the open run's caller.
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

// ---- countries: copied from the main workflow's Normalize Input by build_monitors.py (DataForSEO location code = 2000 + ISO numeric) ----
const COUNTRIES = {
  'United States':        { code: 2840, iso: 'US', lang: 'en', language: 'English', spelling: 'American English',   currency: 'USD' },
  'United Kingdom':       { code: 2826, iso: 'GB', lang: 'en', language: 'English', spelling: 'British English',    currency: 'GBP' },
  'Canada':               { code: 2124, iso: 'CA', lang: 'en', language: 'English', spelling: 'Canadian English',   currency: 'CAD' },
  'Australia':            { code: 2036, iso: 'AU', lang: 'en', language: 'English', spelling: 'Australian English', currency: 'AUD' },
  'New Zealand':          { code: 2554, iso: 'NZ', lang: 'en', language: 'English', spelling: 'British English',    currency: 'NZD' },
  'Ireland':              { code: 2372, iso: 'IE', lang: 'en', language: 'English', spelling: 'British English',    currency: 'EUR' },
  'Pakistan':             { code: 2586, iso: 'PK', lang: 'en', language: 'English', spelling: 'British English',    currency: 'PKR' },
  'India':                { code: 2356, iso: 'IN', lang: 'en', language: 'English', spelling: 'British English',    currency: 'INR' },
  'United Arab Emirates': { code: 2784, iso: 'AE', lang: 'en', language: 'English', spelling: 'British English',    currency: 'AED' },
  'Saudi Arabia':         { code: 2682, iso: 'SA', lang: 'en', language: 'English', spelling: 'British English',    currency: 'SAR' },
  'Singapore':            { code: 2702, iso: 'SG', lang: 'en', language: 'English', spelling: 'British English',    currency: 'SGD' },
  'South Africa':         { code: 2710, iso: 'ZA', lang: 'en', language: 'English', spelling: 'British English',    currency: 'ZAR' },
  'Germany':              { code: 2276, iso: 'DE', lang: 'de', language: 'German',  spelling: 'German',             currency: 'EUR' },
  'France':               { code: 2250, iso: 'FR', lang: 'fr', language: 'French',  spelling: 'French',             currency: 'EUR' },
  'Spain':                { code: 2724, iso: 'ES', lang: 'es', language: 'Spanish', spelling: 'European Spanish',   currency: 'EUR' },
  'Italy':                { code: 2380, iso: 'IT', lang: 'it', language: 'Italian', spelling: 'Italian',            currency: 'EUR' },
  'Netherlands':          { code: 2528, iso: 'NL', lang: 'nl', language: 'Dutch',   spelling: 'Dutch',              currency: 'EUR' },
  'Brazil':               { code: 2076, iso: 'BR', lang: 'pt', language: 'Portuguese', spelling: 'Brazilian Portuguese', currency: 'BRL' },
  'Mexico':               { code: 2484, iso: 'MX', lang: 'es', language: 'Spanish', spelling: 'Mexican Spanish',    currency: 'MXN' }
};
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
   *  of this site's weekly run is asked again until a human clears the row or the run is older than resume_days), 'closed' (finished, or
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

  // ---- 6c. a part sized by TIME, not only by count (F2, 2026-10-23: ENGINE_AUDIT.md E11) ----------------------------------------------
  // A 600-request part at ~40-60 s per batch of 10 (Run AI Requests: batch 10, 200 ms apart) is 40-60 minutes BEFORE the retries and the
  // Answer Analyst, against an execution limit of 60: a part that runs out of time loses everything it paid for. A part now gets a time
  // budget (40 of the 60 minutes, less a fixed allowance for loads and writes, the retry pause and the analyst's jobs), and the requests
  // that fit it at the slow-case seconds of each engine (a batch of 10 waits for its slowest answer) — or at the seconds per request the
  // run's earlier parts MEASURED (wall time of the part, analyst taken out), with 20% headroom. Never more than chunk_requests.
  const TIME = { exec_limit_s: 3600, budget_s: 2400, fixed_s: 300, batch: 10, interval_s: 0.2, retry_wait_s: 20, retry_share: 0.15, headroom: 1.2, min_requests: 40,
    analyst_job_s: 30, req_s: { chatgpt: 60, gemini: 60, perplexity: 30, claude: 45, ai_mode: 45, ai_overview: 25, copilot: 20, chatgpt_api: 45, gemini_api: 45 } };
  /** seconds one request costs a part, on these engines: the modelled figure, or the measured one when a part of the run measured it */
  const secPerRequest = (engines, measured) => {
    const es = (engines || []).filter(e => TIME.req_s[e]); const avg = es.length ? es.reduce((t, e) => t + TIME.req_s[e], 0) / es.length : 45;
    const model = (avg / TIME.batch + TIME.interval_s) * (1 + TIME.retry_share);
    return n0(measured) > 0 ? Math.max(0.5, n0(measured) * TIME.headroom) : model; };
  /** how many requests one part may ask: { size, sec_per_request, budget_s, basis } */
  const chunkPlan = (o) => {
    const x = o || {}; const spr = secPerRequest(x.engines, x.measured_s); const aj = Math.max(0, n0(x.analyst_jobs));
    const budget = Math.max(0, n0(x.budget_s) || (TIME.budget_s - TIME.fixed_s - TIME.retry_wait_s - aj * TIME.analyst_job_s));
    let size = Math.min(LIMITS.chunk_requests, Math.max(TIME.min_requests, Math.floor(budget / spr)));
    if (x.halve) size = Math.max(TIME.min_requests, Math.floor(size / 2));
    return { size, sec_per_request: Math.round(spr * 100) / 100, budget_s: Math.round(budget), analyst_jobs: aj, halved: !!x.halve,
      basis: (n0(x.measured_s) > 0 ? 'measured ' + (Math.round(n0(x.measured_s) * 100) / 100) + ' s a request in this run\'s earlier parts (+20%)' : 'modelled ' + (Math.round(spr * 100) / 100) + ' s a request (slow-case engine time / batch of ' + TIME.batch + ', +15% retries)')
        + ', ' + Math.round(budget) + ' s for requests in a part (40 of the 60 minutes, less loads, the retry pause and ' + aj + ' analyst job(s))' + (x.halve ? '; halved after a part that did not finish' : '') }; };

  // ---- 6d. one fit-gate context for the weekly run and the pulse (F2, 2026-10-23: ENGINE_AUDIT.md E18) ------------------------------------
  // The weekly plan protected the ladder heads + the site's services, the pulse the questions' own topics with no services, so one question
  // could be refused on one path and asked on the other. Both now build the gate's input here, from the same rows.
  const servicesOfRow = (row) => { const r = row || {}; if (!(S(r.canonical_host) || S(r.model_updated_at))) return [];
    const arr = (v) => { const x = parse(v, null); return Array.isArray(x) ? x : listOf(v); };
    return [...new Set([...arr(r.declared_services), ...arr(r.services_json)].map(s => S(s).slice(0, 80)).filter(Boolean))].slice(0, 30); };
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
    full_dfs: 0.45, full_ai: 0.3, weeks_per_month: 4.33, pulse_days: 6 };
  const r4 = (x) => Math.round(x * 10000) / 10000; const r2 = (x) => Math.round(x * 100) / 100;
  const sumPrice = (list) => list.reduce((t, e) => t + (PRICE[e] || 0), 0);
  /** the Answer Analyst jobs one weekly run may start (it reads the answers that matter, 12 a job; more for a bigger panel, never past 60) */
  const analystCap = (panel) => Math.min(FIXED.analyst_cap_max, FIXED.analyst_cap_base + Math.floor(n0(panel) / 25));
  /** o: { panel, engines, pulse (bool), pulse_mode ('auto'|'sample'|'full'), pulse_per_week, cluster_size }. Every figure is in US dollars;
   *  `run` is what one execution chain of the weekly tracker spends (weekly / the month's full run), `pulse_day` one pulse morning,
   *  `month` the site's month (4.33 weekly runs + the full run's extra + 26 pulse mornings). */
  const cost = (o) => {
    const x = o || {};
    const panel = clamp(Math.round(n0(x.panel)) || LIMITS.default_new, LIMITS.min, LIMITS.max);
    const engines = [...new Set((x.engines && x.engines.length ? x.engines : DEFAULT_ENGINES).filter(e => PRICE[e] != null))];
    const asked = Math.max(1, panel - 1);                  // the brand question is asked on the month's full run only
    const wE = engines.filter(e => !MONTHLY_ENGINES.includes(e));
    const pE = PULSE_ENGINES.filter(e => engines.includes(e));
    const answers = asked * wE.length;
    const jobs = Math.min(analystCap(panel), Math.ceil(answers * FIXED.analyst_share / FIXED.analyst_per_job));
    const weekly = { dfs: r4(asked * sumPrice(wE)), ai: r4(Math.max(FIXED.weekly_ai_min, FIXED.brief_ai + jobs * FIXED.analyst_job_ai)) };
    weekly.usd = r4(weekly.dfs + weekly.ai);
    const extra = { dfs: r4((engines.includes('claude') ? panel * PRICE.claude : 0) + sumPrice(wE) + FIXED.full_dfs), ai: FIXED.full_ai };
    extra.usd = r4(extra.dfs + extra.ai);
    const full = { dfs: r4(weekly.dfs + extra.dfs), ai: r4(weekly.ai + extra.ai) }; full.usd = r4(full.dfs + full.ai);
    const on = x.pulse !== false && pE.length > 0;
    const pw = on ? pulsePerWeek({ asked, weekly_engines: wE.length, pulse_engines: pE.length, cluster_size: x.cluster_size, mode: x.pulse_mode, per_week: x.pulse_per_week }) : { per_week: 0, headline: halfWidth(answers), cluster: halfWidth(Math.min(asked, n0(x.cluster_size) || LIMITS.cluster_size_guess) * wE.length), capped: false, why: on ? '' : 'the daily pulse is off' };
    const qDay = on ? Math.min(asked, Math.ceil(asked * pw.per_week / FIXED.pulse_days)) : 0;
    const pulse_day = { dfs: r4(qDay * sumPrice(pE)), ai: 0 }; pulse_day.usd = pulse_day.dfs;
    const W = FIXED.weeks_per_month;
    const month = { weekly: r2(W * weekly.usd), full_extra: r2(extra.usd), pulse: r2(W * FIXED.pulse_days * pulse_day.usd) };
    month.total = r2(month.weekly + month.full_extra + month.pulse);
    return { panel, asked, engines, weekly_engines: wE, pulse_engines: on ? pE : [], per_week: pw.per_week, pulse_questions_day: qDay, pulse_why: pw.why, pulse_capped: !!pw.capped,
      requests: { weekly: answers, full: answers + (engines.includes('claude') ? panel : 0) + wE.length, pulse_day: qDay * (on ? pE.length : 0) },
      executions: Math.max(1, Math.ceil(answers / LIMITS.chunk_requests)), analyst_jobs: jobs,
      half_width: { headline: pw.headline, cluster: pw.cluster }, run: { weekly, full }, full_extra: extra, pulse_day, month,
      prices: engines.map(e => ({ engine: e, usd: PRICE[e], basis: PRICE_BASIS[e] || 'measured / priced' })) };
  };

  return { LIMITS, panelSize, normMarket, locationOf, listOf, marketsOf, personasOf, stageOf, stems, jaccard, sameAsk, dedupe, stratumOf, pulseDay, halfWidth,
    pulsePerWeek, pulseSample, reqKey, slice, stateKey, stateOf, stateVerdict, stateRow, panelIds, panelHash, overlap, hash,
    MARKETS_MAX, normQ, hash64, promptId, findStored, keywordOf, KEYWORD_SOURCES, STOPPED, ENG_CODE, packKeys, unpackKeys, CEILING, runCeiling, ceilingLeft, keysUsd, baseState,
    TIME, secPerRequest, chunkPlan, servicesOfRow, fitInput,
    PRICE, PRICE_BASIS, ENGINES, DEFAULT_ENGINES, MONTHLY_ENGINES, PULSE_ENGINES, FIXED, analystCap, cost };
})();
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
    const declared_services = uniq([...declListOf(x.declared_services), ...declListOf(row.declared_services)].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
    const services = uniq([...declared_services, ...listOf(x.services), ...listOf(desc0.products_or_services), ...listOf(desc0.services), ...listOf(desc0.main_services), ...(jparse(row.services_json, []) || [])].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
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
    const inv = pages(model).filter(p => !isGone(p));   // RV-1: a gone page answers nothing
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
    titleShare, titleGap, canonUrl, isListing, pageScore, pageStep, isGone, gonePages,
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
    const hasPlace = toks.some(FIT_REAL_GEO);
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
  // 2. the search data says navigational
  if (String(ctx.intent || '').toLowerCase() === 'navigational') return { ok: false, reason: 'navigational', detail: 'the search data classifies it as navigational (people look for one particular website)' };
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
// ---- AI entities (F1a, 2026-10-23; docs/ai-visibility-2026-10-23/ENGINE_AUDIT.md E3 E4 E5 E8 E10 E16, PROD_STATE.md section 5) ----
// WHO an AI answer names, as ONE entity per business, and in which ROLE. Inlined by build_monitors.py (the AI_ENTITIES placeholder) into
// Parse AI Answers (weekly and pulse), Apply Analysis, Analyst Jobs, AI Cache Rows, Prompt Rows, AI Plan and Pulse Plan.
//  * one entity per business: its id is the registrable domain of its main site. Subdomains fold in (europe.thomsonreuters.com), so do the
//    country / brand variants of one label (cleartax.com + cleartax.in, edicom.com + edicomgroup.com), the names AI uses for it (learned
//    aliases, every spelling of one name), and a former name or an owner written in the answer ("Thomson Reuters (formerly Pagero)").
//    PROD_STATE.md found one business counted 2-3 times, which put the client 4th where it was 2nd.
//  * a role per entity in THAT answer: self (the client), competitor (configured by the owner, or offered by the answer as an option),
//    platform (named as what something integrates with, is built on, or partners with - or a platform the client itself works with),
//    source (cited, or a publisher / directory / review site / government body / association / research firm) or other. Only self and
//    competitor count in the share of voice and in the client's position (E3: a cited directory was a "rival").
//  * short names are matched, not dropped (E4: SAP, Zoho, Xero, Sage): word-bounded, and case-sensitive under 5 letters (an acronym in
//    capitals, a name with its capital) so "asap", "Sapient" and "sage advice" never match.
//  * a domain label that is a common or category word is not a brand name (E5: payroll.ae -> "payroll"); the business name and the
//    owner's brand names are. A word inside a cited domain is never located with indexOf (E8: "small business" is not business.com), and a
//    framework (ASP.NET) is not a business.
// No URL constructor (the n8n Code sandbox has none): hosts are parsed with regexes.
const AIE = (() => {
  const L = (s) => String(s == null ? '' : s).normalize('NFKC');
  const low = (s) => L(s).toLowerCase();
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hostOf = (u) => { const m = String(u || '').match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\d?\./, '') : ''; };
  const normD = (x) => low(x).trim().replace(/^https?:\/\//, '').replace(/^www\d?\./, '').replace(/[\/?#:].*$/, '').replace(/\.+$/, '');
  const SL2 = /^(co|com|org|net|gov|ac|edu|ltd|plc|sch|nic|mil|or|ne|go|gob|gouv|biz|info)\.[a-z]{2}$/;
  const regD = (h) => { const x = normD(h); if (!x || x.indexOf('.') < 0) return x; const p = x.split('.').filter(Boolean); if (p.length <= 2) return p.join('.');
    const sl = p.slice(-2).join('.'); return SL2.test(sl) ? p.slice(-3).join('.') : sl; };
  const isDom = (x) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(String(x || '').trim());
  const labelOf = (d) => regD(d).split('.')[0].replace(/[^a-z0-9]/g, '');
  // words that say what a business does, where, or nothing at all: a label made only of them is a description, not a name (E5, E8)
  const GEN = new Set(('ai software softwares service services erp crm hrms hcm pos tax taxes vat invoice invoices invoicing einvoice einvoicing accounting accountant accountants payroll payrolls '
    + 'finance financial cloud digital online web data tech technology technologies solution solutions system systems business businesses company companies group global international gulf arab '
    + 'arabia emirates national consulting consultant consultants consultancy partner partners network news blog guide guides info best top free app apps shop store market media academy institute '
    + 'university school bank pay pro plus hub one first smart easy get go home house world city daily times post review reviews compare comparison list directory jobs careers firm firms wiki '
    + 'expert experts specialist specialists advisor advisors advisory agency agencies design marketing seo legal law clinic health care property travel logistics trading auto insurance printing events '
    + 'cleaning security training courses implementation integration migration support hosting it hr audit bookkeeping now link links line zone point center centre source labs studio works '
    + 'small medium large enterprise enterprises office offices team people work job salary salaries portal portals check status register registration login account accounts book books '
    + 'summary overview conclusion introduction step steps benefits pros cons cost costs price prices pricing features feature requirements requirement timeline deadline deadlines '
    + 'recommendation recommendations note notes tips tip example examples option options faq faqs answer answers question questions key core scope model format provider providers vendor vendors '
    + 'website websites contact about home details detail notable market players player leading leader leaders other others more why how what when where which who '
    + 'uae dubai abu dhabi sharjah ajman saudi ksa riyadh jeddah qatar doha oman bahrain kuwait egypt india uk usa us middle east mena gcc europe '
    + 'january february march april may june july august september october november december official accredited approved certified local regional '
    + 'e invoice invoicing electronic peppol standard standards compliance compliant ready readiness new top10 ranking rankings lists listing listings yellow pages').split(/\s+/).filter(Boolean));
  const STOPW = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'or', 'vs', 'is', 'are', 'my', 'your', 'our']);
  const splits = (w) => { const n = w.length; const ok = new Array(n + 1).fill(false); ok[0] = true;
    for (let i = 1; i <= n; i++) for (let j = Math.max(0, i - 20); j < i; j++) if (ok[j] && i - j >= 2 && GEN.has(w.slice(j, i))) { ok[i] = true; break; }
    return ok[n]; };
  /** a word (or a domain label) that describes rather than names: in the list, its plural, or made only of such words */
  const commonWord = (w) => { const x = low(w).replace(/[^a-z0-9]/g, ''); if (!x || x.length < 3) return true; return GEN.has(x) || GEN.has(x.replace(/s$/, '')) || splits(x); };
  const CORP = /(group|global|holding|holdings|hq|corp|inc|llc|ltd|intl|international|online|official|software|solutions|systems|technologies|tech|consulting|erp|mea|me|uae|ae|ksa)$/;
  const core = (d) => { const l = labelOf(d); const c = l.length > 6 ? l.replace(CORP, '') : l; return c.length >= 4 ? c : l; };
  const coreOk = (c) => c && c.length >= 4 && !commonWord(c);
  const nn = (s) => low(s).replace(/[^\p{L}\p{N}&]+/gu, '');   // one key per spelling: "EDICOM" = "Edicom", "Tech &" = "Tech&"

  // ---- what kind of site or name a thing is ----
  const GOV = /\.gov(\.[a-z]{2,3})?$|(^|\.)(gouv|gob|go|gv)\.[a-z]{2}$|\.mil(\.[a-z]{2})?$|(^|\.)u\.ae$|\.int$|\.edu(\.[a-z]{2})?$|\.ac\.[a-z]{2}$|(^|\.)(difc|adgm|dmcc|dafz|dafza|jafza|rakez|dso|ifza|shams|kezad|dwtc|dubaichamber|abudhabichamber|dubaided|government|europa|saifzone|ajmanfreezone|fujairahfreezone|hamriyahfz)\.(com|ae|org|eu)$|(^|\.)[a-z]{3,}fz\.(ae|com)$|freezone/i;
  const MEDIA = /(^|\.)(gulfnews|khaleejtimes|thenationalnews|thenational|zawya|arabianbusiness|gulfbusiness|reuters|bloomberg|forbes|cnbc|bbc|ft|wsj|techcrunch|entrepreneur|economist|businessinsider|arabnews|timesofindia|dawn|business|nerdwallet|investopedia|techradar|pcmag|zdnet|cio|computerweekly|itpro|tradearabia|wam|emirates247|khaleej|alkhaleej|albayan|argaam|saudigazette|medium|substack|wikipedia|wikimedia|britannica)\.[a-z.]+$/i;
  const DIRECTORY = /(^|\.)(g2|capterra|clutch|trustpilot|goodfirms|getapp|softwareadvice|crunchbase|yelp|sortlist|designrush|themanifest|softwaresuggest|sourceforge|saashub|alternativeto|producthunt|glassdoor|indeed|hidubai|connect|zoominfo|owler)\.[a-z.]+$|yellowpages|directory|review|compare|listing|ranking|top10|aspl?ist|uaeasp|einvoicinglist/i;
  const RESEARCH = /(^|\.)(gartner|forrester|statista|idc|mckinsey|bcg|bain|frost|marketsandmarkets|mordorintelligence|grandviewresearch)\.[a-z.]+$/i;
  const SOCIAL = /(^|\.)(youtube|youtu|linkedin|facebook|instagram|x|twitter|tiktok|reddit|quora|github|pinterest|t)\.(com|be|co|me)$|(^|\.)(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|ask|chatgpt|openai|perplexity|anthropic|claude|gemini|gstatic|goo)\.[a-z.]+$|vertexaisearch|peppol\.(org|eu)$/i;
  const NAME_SRC = /\b(ministry|authority|federal|government|municipality|chamber|association|council|institute|foundation|commission|department|free ?zone|yellow ?pages|directory|gazette|news|times|journal|magazine|wikipedia|openpeppol|gartner|forrester|statista)\b/i;
  const NAME_OTHER = /^(google|bing|linkedin|youtube|facebook|instagram|twitter|reddit|quora|chatgpt|openai|perplexity|gemini|claude|anthropic|peppol|whatsapp|wikipedia)$/i;
  const kindOfDomain = (d) => { const x = normD(d); return !x ? '' : GOV.test(x) ? 'gov' : SOCIAL.test(x) ? 'other' : MEDIA.test(x) ? 'media' : RESEARCH.test(x) ? 'research' : DIRECTORY.test(x) ? 'directory' : 'site'; };
  const SOURCE_KINDS = new Set(['gov', 'media', 'research', 'directory']);

  // ---- the platforms buyers connect to: named as an integration target, or worked with by the client, they are never rivals ----
  const P_B = '(?<![\\p{L}\\p{N}])', P_E = '(?![\\p{L}\\p{N}])';
  const PLATFORMS = [
    ['microsoft.com', 'Microsoft', P_B + '(?:microsoft(?:\\s+dynamics(?:\\s+365)?)?|dynamics\\s*365|ms\\s+dynamics|d365|business\\s+central|navision|azure|power\\s*bi|power\\s+(?:apps|automate|platform)|office\\s+365|microsoft\\s+365|sharepoint)' + P_E, 'giu'],
    ['sap.com', 'SAP', P_B + '(?:SAP(?:\\s+Business\\s+One|\\s+S\\/4\\s?HANA|\\s+B1)?|S\\/4\\s?HANA|SuccessFactors)' + P_E, 'gu'],
    ['oracle.com', 'Oracle', P_B + '(?:Oracle|ORACLE)(?!\\s+NetSuite)(?:\\s+(?:Fusion|Cloud|ERP|E-Business\\s+Suite))?' + P_E, 'gu'],
    ['netsuite.com', 'NetSuite', P_B + '(?:oracle\\s+)?netsuite' + P_E, 'giu'],
    ['zoho.com', 'Zoho', P_B + '(?:Zoho|ZOHO)(?:\\s+(?:Books|Payroll|CRM|People|One|Invoice|Inventory|Expense))?' + P_E, 'gu'],
    ['odoo.com', 'Odoo', P_B + '(?:Odoo|ODOO)' + P_E, 'gu'],
    ['sage.com', 'Sage', P_B + '(?:Sage|SAGE)(?:\\s+(?:X3|300|50|100|200|Intacct|Accounting|Business\\s+Cloud))?' + P_E, 'gu'],
    ['xero.com', 'Xero', P_B + '(?:Xero|XERO)' + P_E, 'gu'],
    ['intuit.com', 'QuickBooks', P_B + '(?:quickbooks(?:\\s+online)?|intuit)' + P_E, 'giu'],
    ['tallysolutions.com', 'Tally', P_B + '(?:TallyPrime|Tally(?:\\s+ERP\\s*9)?|TALLY)' + P_E, 'gu'],
    ['salesforce.com', 'Salesforce', P_B + 'salesforce' + P_E, 'giu'], ['hubspot.com', 'HubSpot', P_B + 'hubspot' + P_E, 'giu'],
    ['shopify.com', 'Shopify', P_B + 'shopify' + P_E, 'giu'], ['amazon.com', 'AWS', P_B + '(?:AWS|Amazon\\s+Web\\s+Services)' + P_E, 'gu'],
    ['servicenow.com', 'ServiceNow', P_B + 'servicenow' + P_E, 'giu'], ['workday.com', 'Workday', P_B + 'Workday' + P_E, 'gu'],
    ['epicor.com', 'Epicor', P_B + 'epicor' + P_E, 'giu'], ['acumatica.com', 'Acumatica', P_B + 'acumatica' + P_E, 'giu'], ['infor.com', 'Infor', P_B + 'Infor' + P_E, 'gu']];
  const PLAT_DOMS = new Set(PLATFORMS.map(p => p[0]));

  // ---- how a name is found in a text ----
  const B = '(?<![\\p{L}\\p{M}\\p{N}])', E = '(?![\\p{L}\\p{M}\\p{N}])';
  const AR = /[؀-ۿ]/;
  const tokRe = (n) => (n.match(/[\p{L}\p{M}\p{N}]+|[^\s\p{L}\p{M}\p{N}]/gu) || []).map(esc).join('[\\s\\-]*');
  /** a name -> a global regex: a domain literally; an Arabic name with its one-letter prefixes (و ب ل ف ك, ال); a short name (4 letters or
   *  fewer) case-sensitive - as written, or in capitals; a longer one case-insensitive. A name ending in a symbol ("Tech&") may be written
   *  with a space ("Tech &") but not followed by another capitalised word ("Tech & Co Ltd" is another company). */
  const nameRe = (name, o) => {
    const n = L(name).replace(/\s+/g, ' ').trim(); if (n.length < 2) return null;
    if (isDom(n)) return new RegExp('(?<![\\p{L}\\p{N}@.\\-])(?:www\\.)?' + esc(n.toLowerCase()) + '(?![\\p{L}\\p{N}\\-]|\\.[\\p{L}\\p{N}])', 'giu');
    if (AR.test(n)) return new RegExp(B + '(?:ال|[وبلفك])?' + tokRe(n) + E, 'gu');
    const tail = /[^\p{L}\p{M}\p{N}]$/u.test(n) ? '(?![\\p{L}\\p{M}\\p{N}]|\\s+[\\p{Lu}\\p{N}])' : E;
    const alnum = n.replace(/[^\p{L}\p{N}]/gu, '').length;
    if (alnum > 4 && !(o && o.strict)) return new RegExp(B + tokRe(n) + tail, 'giu');
    const forms = new Set();
    if (n === n.toLowerCase()) { if (alnum <= 3) forms.add(n.toUpperCase()); else { forms.add(n[0].toUpperCase() + n.slice(1)); forms.add(n.toUpperCase()); } }
    else { forms.add(n); forms.add(n.toUpperCase()); }
    return new RegExp(B + '(?:' + [...forms].map(tokRe).join('|') + ')' + tail, 'gu');
  };
  /** a name an answer gives a business: a short phrase of capitalised words, not a heading, a category or a field label */
  const DENY = /^(pint-?ae|peppol|uae|ksa|fta|vat|erp|crm|asps?|b2b|b2g|b2c|xml|api|apis|pdf|aed|usd|sar|mof|faq|ceo|cfo|it|ai|ml|saas|sme|smes|ubl|edi|ctc|wps|kyc|gdpr|iso)$/i;
  const nameLike = (name) => {
    const n = L(name).replace(/\s+/g, ' ').trim();
    if (n.length < 2 || n.length > 48 || /[:;,|\\?!]|\.{2}/.test(n) || /(^|\s)(and|or|for|with|in|on|of|the|a|an|to|at|by|vs|versus|&|from|your|our|how|what|why|when)(\s|$)/i.test(n)) return false;
    const w = n.split(' '); if (w.length > 5) return false;
    if (w.every(x => DENY.test(x.replace(/[^\p{L}\p{N}-]/gu, '')) || commonWord(x) || /^\d+$/.test(x))) return false;
    return w.every(x => /^[\p{Lu}\p{N}]/u.test(x) || /^[\p{Ll}]+\p{Lu}/u.test(x) || AR.test(x));
  };
  const DOMAIN_RE = /(?<![\p{L}\p{N}@-])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|ai|co|ae|sa|qa|om|kw|bh|eg|uk|de|fr|es|it|nl|in|pk|sg|au|ca|nz|za|br|mx|us|biz|info|tech|app|cloud|global|digital|solutions|consulting|agency|me|network|one|online|site|store|group|eu))(?![\p{L}\p{N}-])/giu;
  const TECH_TERM = /^(asp|ado|vb|dot|c|f|j)\.net$|^(socket|chart|node|vue|next|react|express)\.(io|js)$/i;
  /** the text a reader sees: link targets and footnote markers dropped (they are citations, not names), anchors kept */
  const visible = (text) => String(text || '')
    .replace(/\[\[\d+\]\]\([^)]*\)/g, ' ').replace(/\[\d+\]\((?:https?:)?\/\/[^)]*\)/g, ' ')
    .replace(/\]\((?:https?:)?\/\/[^)\s]*\)/g, ']').replace(/[?&](utm_[a-z]+|srsltid)=[^\s)&\]]*/gi, '').replace(/\[\d+\]/g, ' ');

  // ---- the client's own names (E5) ----
  /** the brand names to look for: the domain, the business name, the owner's brand names, and the domain label only when it is a NAME (5+
   *  letters, not a common or category word: "techand" yes, "payroll" no) */
  const brandNames = (o) => {
    const dom = normD(o && o.domain); const label = dom.split('.')[0] || '';
    const lab = label.replace(/-/g, '');
    const names = [dom, (o && o.business_name) || '', ...((o && o.brand_names) || [])];
    if (lab.length >= 5 && !commonWord(lab)) names.push(label);
    return [...new Set(names.map(x => L(x).replace(/\s+/g, ' ').trim()).filter(x => x.length >= 3))];
  };
  /** names a plan may still carry from before the rule: the bare label of a common-word domain is dropped (payroll.ae -> "payroll") */
  const ownNames = (plan) => { const dom = normD(plan.domain); const label = dom.split('.')[0];
    return [...new Set([dom, ...(plan.brand_names || [])].map(x => L(x).trim()).filter(x => x.length >= 3 && !(low(x) === label && commonWord(label) && low(plan.business_name || '') !== label)))]; };

  /** what a site row says it sells (seo_sites: declared_services, services_json) - the pulse has no site model of its own */
  const servicesOf = (row) => { const r = row || {}; const out = []; const add = (v) => { if (Array.isArray(v)) v.forEach(add); else if (v) String(v).split(/\n|;|\|/).forEach(x => { const t = x.trim(); if (t) out.push(t.slice(0, 80)); }); };
    add(r.services); add(r.declared_services); try { add(JSON.parse(r.services_json || '[]')); } catch (e) {} return [...new Set(out)].slice(0, 30); };
  // ---- the client's platforms: what its services, topics and facts name ----
  const clientText = (plan) => [plan.business_type, ...(plan.services || []), ...(plan.topics || []), plan.business_facts, plan.accreditation].filter(Boolean).map(String).join(' \n ');
  const clientPlatforms = (plan) => { const t = clientText(plan); return PLATFORMS.filter(([, , src, fl]) => new RegExp(src, fl.replace('g', '')).test(t)).map(p => p[0]); };

  // ---- the book of a site: entities learned in earlier runs (seo_cache ai_entities:<site_id>) ----
  const bookOf = (rows, siteId) => { for (const r of (rows || [])) { const j = r && r.json ? r.json : r; if (j && j.key === 'ai_entities:' + siteId) { try { const v = typeof j.value === 'string' ? JSON.parse(j.value) : j.value; return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } } } return {}; };

  // ---- the directory of a site: every known business, one group per business ----
  const DIRS = new Map();
  const dir = (plan, book) => {
    const key = plan.site_id + '|' + plan.domain + '|' + (plan.run_id || '');
    if (DIRS.has(key)) return DIRS.get(key);
    const P = new Map(); const add = (k) => { if (!P.has(k)) P.set(k, k); };
    const find = (k) => { add(k); let r = k; while (P.get(r) !== r) r = P.get(r); let x = k; while (P.get(x) !== r) { const nx = P.get(x); P.set(x, r); x = nx; } return r; };
    const uni = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) P.set(ra, rb); };
    const display = new Map();   // name key -> how it is written
    const aliasCount = new Map();   // domain -> how many names point to it
    const own = regD(plan.domain); const owned = new Set([own, ...((plan.owned_domains || []).map(regD))].filter(Boolean));
    const configured = [...new Set((Array.isArray(plan.configured_competitors) ? plan.configured_competitors : (plan.competitors || [])).map(regD).filter(x => x && !owned.has(x)))];
    const soft = [...new Set((plan.competitors || []).map(regD).filter(x => x && !owned.has(x)))];
    const selfNames = ownNames(plan);
    const selfKeys = new Set(selfNames.map(nn));
    const doms = new Set([...configured, ...soft]);
    const explicit = new Set();
    const nameKey = (n) => 'n:' + nn(n);
    const putName = (n) => { const k = nameKey(n); if (!display.has(k)) display.set(k, L(n).trim()); return k; };
    for (const [n, d] of Object.entries(plan.aliases || {})) { if (!n || selfKeys.has(nn(n))) continue; const k = putName(n); if (d && isDom(normD(d))) { const r = regD(d); if (owned.has(r)) continue; doms.add(r); uni(k, 'd:' + r); explicit.add(k); aliasCount.set(r, (aliasCount.get(r) || 0) + 1); } else add(k); }
    const roleOfBook = new Map();
    for (const [id, e] of Object.entries(book || {})) { if (!e || typeof e !== 'object') continue; const ds = (e.d || []).map(regD).filter(x => x && !owned.has(x)); const anchor = ds.length ? 'd:' + ds[0] : nameKey(id);
      if (!ds.length && !isDom(id)) putName(id); if (isDom(id)) { const r = regD(id); if (!owned.has(r)) { doms.add(r); uni(anchor, 'd:' + r); } }
      for (const d of ds) { doms.add(d); uni(anchor, 'd:' + d); } for (const n of (e.n || [])) { if (!n || selfKeys.has(nn(n))) continue; const k = putName(n); uni(k, anchor); explicit.add(k); }
      if (e.r) roleOfBook.set(anchor, String(e.r)); }
    for (const d of PLAT_DOMS) add('d:' + d);
    for (const d of doms) add('d:' + d);
    // one business on several domains: the same distinctive core label (edicom.com / edicomgroup.com, cleartax.com / cleartax.in)
    const byCore = new Map(); for (const d of [...doms, ...PLAT_DOMS]) { const c = core(d); if (!coreOk(c)) continue; if (byCore.has(c)) uni('d:' + d, 'd:' + byCore.get(c)); else byCore.set(c, d); }
    // a name with no explicit website joins the domain its spelling names (ClearTax -> cleartax.com, Azentio Software -> azentio.com)
    const nameToDom = (n, list) => { const c = nn(n).replace(/&/g, ''); const first = (low(n).split(/[^\p{L}\p{N}]+/u).filter(Boolean)[0]) || '';
      return list.find(d => { const l = labelOf(d), co = core(d); if (commonWord(l) && commonWord(co)) return false;
        return l === c || co === c || (first.length >= 5 && (first === l || first === co)) || (l.length >= 6 && c.startsWith(l)) || (coreOk(co) && co.length >= 5 && c.startsWith(co)); }) || null; };
    for (const k of display.keys()) if (!explicit.has(k)) { const d = nameToDom(display.get(k), [...doms]); if (d) uni(k, 'd:' + d); }
    // the id of a group: the owner's competitor, else the domain most names point to, else a .com, the shortest, the first alphabetically
    const groups = new Map(); for (const k of P.keys()) { const r = find(k); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(k); }
    const idOfRoot = new Map(), membersOf = new Map();
    const pickId = (keys) => { const ds = keys.filter(k => k.startsWith('d:')).map(k => k.slice(2)); if (!ds.length) { const nk = keys.find(k => k.startsWith('n:')); return nk ? display.get(nk) : keys[0]; }
      const conf = ds.find(d => configured.includes(d)); if (conf) return conf;
      return ds.slice().sort((a, b) => (aliasCount.get(b) || 0) - (aliasCount.get(a) || 0) || (/\.com$/.test(b) ? 1 : 0) - (/\.com$/.test(a) ? 1 : 0) || a.length - b.length || a.localeCompare(b))[0]; };
    for (const [r, keys] of groups) { idOfRoot.set(r, pickId(keys)); membersOf.set(r, keys); }
    const scans = [];   // [{ re, root }] - every known business, found by its names and domains
    const roots = new Set();
    for (const [r, keys] of groups) {
      const id = idOfRoot.get(r); const ds = keys.filter(k => k.startsWith('d:')).map(k => k.slice(2));
      const conf = ds.some(d => configured.includes(d)); const softC = ds.some(d => soft.includes(d));
      const names = new Set();
      for (const k of keys) if (k.startsWith('n:')) names.add(display.get(k));
      for (const d of ds) { names.add(d); if (conf || softC) { const l = labelOf(d), co = core(d);
        for (const x of [l, co]) if (x.length >= 3 && !commonWord(x) && (conf || x.length >= 5)) names.add(x); } }
      for (const n of names) { if (!n || selfKeys.has(nn(n))) continue; if (!isDom(n) && !/\./.test(n) && !conf && !nameLike(n) && !AR.test(n) && !keys.some(k => k === nameKey(n) && explicit.has(k))) continue;
        const re = nameRe(n, { strict: !isDom(n) && n === n.toLowerCase() && n.replace(/[^a-z0-9]/g, '').length <= 4 }); if (re) scans.push({ re, root: r }); }
      roots.add(r); void id;
    }
    for (const [d, , src, fl] of PLATFORMS) scans.push({ re: new RegExp(src, fl), root: find('d:' + d) });
    const selfScans = selfNames.map(n => nameRe(n)).filter(Boolean);
    const cp = new Set(clientPlatforms(plan).map(d => find('d:' + d)));
    const ct = clientText(plan);
    const out = { plan, own, owned, configured, soft, find, idOfRoot, membersOf, display, nameKey, nameToDom, doms, scans, selfScans, selfNames, selfKeys, clientRoots: cp, clientText: ct, roleOfBook, explicit,
      confRoots: new Set(configured.map(d => find('d:' + d))) };
    DIRS.set(key, out);
    return out;
  };

  // ---- the context of one mention ----
  // a sentence ends at . ! ? ; or a line break - not at the dot of "e.g." / "i.e." / "etc." / "Inc." (masked, same length, before the search)
  const maskAbbr = (t) => t.replace(/\b(e\.g|i\.e|etc|vs|approx|inc|ltd|co|no|st)\./gi, (m) => m.replace(/\./g, '_'));
  const sentenceBefore = (vis, at, max) => { const s0 = vis.slice(Math.max(0, at - (max || 140)), at); const s = maskAbbr(s0); let cut = -1; for (const m of s.matchAll(/[.!?;\n]/g)) cut = m.index; return cut >= 0 ? s0.slice(cut + 1) : s0; };
  const sentenceAfter = (vis, end, max) => { const s0 = vis.slice(end, end + (max || 90)); const m = maskAbbr(s0).match(/[.!?;\n]/); return m ? s0.slice(0, m.index) : s0; };
  const REL = /(?:integrat\w*|connect\w*|connectivity|compatib\w*|interoperab\w*|built\s+(?:on|for|with)|runs?\s+on|running\s+on|on\s+top\s+of|plugs?\s+(?:in|into)|plug-?ins?\s+for|add-?ons?\s+for|sync\w*|interfac\w*|works?\s+with|(?:existing|current|legacy)\s+(?:\*\*)?(?:erp|accounting|billing|finance|software|systems?|infrastructure|stack|platforms?|tools?)|(?:erp|accounting|billing|crm)\s+(?:systems?|software|platforms?|tools?)(?:\*\*)?\s*(?:\(|such\s+as|like|e\.g\.|including)|speciali[sz]\w*\s+in|certified\s+(?:in|for|on)|partners?\s+(?:of|for)|resellers?\s+of|implement(?:s|ing|ed|ation\s+of)?|deploy\w*|customi[sz]\w*|migrat\w*\s+(?:to|from)|licen[cs]\w*\s+(?:of|for))/gi;
  const GAP_OK = new Set(['and', 'or', 'e.g', 'eg', 'such', 'as', 'like', 'including', 'the', 'a', 'an', 'your', 'existing', 'current', 'legacy', 'erp', 'software', 'system', 'systems', 'platform', 'platforms',
    'infrastructure', 'accounting', 'billing', 'crm', 'tools', 'stack', 'with', 'etc', 'mainly', 'especially', 'other', 'into', 'to', 'for', 'in', 'on', 'of', 'i.e', 'ie', 'for example', 'example', 'custom', 'cloud', 'finance']);
  const platformBefore = (vis, at) => { const s = sentenceBefore(vis, at, 160); let last = null; for (const m of s.matchAll(REL)) last = m; if (!last) return false;
    const gap = s.slice(last.index + last[0].length); if (gap.length > 90) return false;
    const words = gap.replace(/[*()"'’:,]/g, ' ').split(/\s+/).filter(Boolean);
    return words.every(w => /^[\p{Lu}\p{N}]/u.test(w) || /&$/.test(w) || GAP_OK.has(w.toLowerCase().replace(/\.$/, ''))); };
  const PLAT_AFTER = /^\s*(?:\*\*)?\s*(?:[\p{Lu}\p{N}][\p{L}\p{N}]*\s+){0,3}?(?:(?:gold|silver|certified|solutions?|implementation|authori[sz]ed|official|premier)\s+)*(?:partners?|integrators?|resellers?|implementers?|consultan(?:t|ts|cy|cies)|specialists?|add-?ons?|plug-?ins?|connectors?|integrations?|modules?)(?![\p{L}])/u;
  const platformAfter = (vis, end) => PLAT_AFTER.test(sentenceAfter(vis, end, 60));
  const SRC_BEFORE = /(?:according\s+to|cited\s+by|reported\s+by|sources?:|data\s+from|listed\s+(?:on|in|by)|published\s+(?:by|on|in)|as\s+(?:reported|noted|listed)\s+(?:by|on|in)|via)\s*(?:the\s+)?$/i;
  const SRC_AFTER = /^\s*(?:reports?|reported|notes?|noted|says|said|lists?|listed|ranks?|ranked|publishes?|published|estimates?|found|explains?|writes?)\b/i;

  // ---- one answer -> its entities ----
  const LINE_NAME = [/^\s*#{1,4}\s*(?:\d+[.)]\s*)?(?:\*\*)?([^*\n]+?)(?:\*\*)?\s*$/, /^\s*(?:[-*•]|\d+[.)])\s+(?:\*\*|__)([^*\n]+?)(?:\*\*|__)/, /^\s*(?:\*\*|__)([^*\n]+?)(?:\*\*|__)/,
    /^\s*\|\s*(?:\*\*)?([^|*\n]+?)(?:\*\*)?\s*\|/, /^\s*\d+[.)]\s+([^\n]+?)\s*(?:\s[-–—]\s|$)/];
  const OWN_PHRASE = /(?:formerly(?:\s+known\s+as)?|previously(?:\s+known\s+as)?|now\s+part\s+of|now\s+owned\s+by|acquired\s+by|a\s+subsidiary\s+of|part\s+of)\s+|\(\s*an?\s+(?=[^()]{2,40}?\s+company\s*\))/gi;
  const read = (ans, D) => {
    const plan = D.plan; const text = String(ans.text || ''); const vis = visible(text); const cites = ans.cites || [];
    const isOurs = (h) => { const r = regD(h); return !!r && D.owned.has(r); };
    // local groups for the domains this answer brings
    const local = new Map(); const localRoot = (d) => { const r = regD(d); if (!r) return null; if (D.owned.has(r)) return 'self';
      const known = 'd:' + r; if (D.idOfRoot.has(D.find(known)) && D.membersOf.get(D.find(known)).includes(known)) return D.find(known);
      const c = core(r); if (coreOk(c)) { for (const d of D.doms) if (core(d) === c) return D.find('d:' + d); for (const p of PLAT_DOMS) if (core(p) === c) return D.find('d:' + p); }
      const lk = coreOk(c) ? 'c:' + c : 'd:' + r; if (!local.has(lk)) local.set(lk, { root: 'L:' + lk, doms: new Set() }); local.get(lk).doms.add(r); return 'L:' + lk; };
    const M = [];   // mentions { s, e, root, name }
    const scanRe = (re, root, name) => { re.lastIndex = 0; for (const m of vis.matchAll(re)) { const dm = isDom(m[0]); M.push({ s: m.index, e: m.index + m[0].length, root, name: name || (dm ? normD(m[0]) : m[0]), dom: dm }); } };
    for (const re of D.selfScans) scanRe(re, 'self');
    for (const x of D.scans) scanRe(x.re, x.root);
    // business domains written in the text (an anchor, a bare address); a framework is not one
    DOMAIN_RE.lastIndex = 0;
    for (const m of vis.matchAll(DOMAIN_RE)) { const d = normD(m[1]); if (TECH_TERM.test(d) || !/\.[a-z]{2,}$/.test(d)) continue; const r = localRoot(d); if (r) M.push({ s: m.index, e: m.index + m[0].length, root: r, name: d, dom: true }); }
    // names the engine itself lists (ChatGPT / Gemini brand entities), and the leading names of list items and table rows
    const nameRoot = (n) => { const k = D.nameKey(n); if (D.selfKeys.has(nn(n))) return 'self'; if (D.display.has(k)) return D.find(k);
      const d = D.nameToDom(n, [...D.doms, ...PLAT_DOMS, ...[...local.values()].flatMap(x => [...x.doms])]); if (d) return localRoot(d); return 'N:' + nn(n); };
    const listNames = [];
    { let off = 0; for (const line of vis.split('\n')) {
      if (!/^\s*\|?\s*:?-{2,}/.test(line)) for (const re of LINE_NAME) { const m = line.match(re); if (!m) continue; let raw = m[1];
        if (/:\s*$/.test(raw) || (re !== LINE_NAME[4] && re !== LINE_NAME[3] && /:/.test(raw))) break;
        raw = raw.split(/\s[-–—]\s|:|,|\s\|/)[0].replace(/[*_]+/g, '').trim();
        const par = raw.match(/^(.*?)\s*\(([^()]+)\)\s*$/); let name = par ? par[1].trim() : raw; const alt = par && !/^(formerly|previously|now|a |an |part|owned|acquired)/i.test(par[2]) ? par[2].trim() : '';
        if (!nameLike(name)) { if (alt && nameLike(alt)) name = alt; else break; }
        const at = off + Math.max(0, line.indexOf(name)); listNames.push({ name, alt: alt && nameLike(alt) ? alt : '', at, lineEnd: off + line.length }); break; }
      off += line.length + 1; } }
    for (const x of listNames) { let root = nameRoot(x.name); if (root.startsWith('N:') && x.alt) { const r2 = nameRoot(x.alt); if (!r2.startsWith('N:')) root = r2; }
      // the website on the item's line or the lines under it, until the next item
      const next = listNames.find(y => y.at > x.at); const span = vis.slice(x.at, next ? next.at : Math.min(vis.length, x.at + 320));
      DOMAIN_RE.lastIndex = 0; const dm = [...span.matchAll(DOMAIN_RE)].map(m => normD(m[1])).find(d => !TECH_TERM.test(d));
      x.root = root; x.dom = dm || '';
      M.push({ s: x.at, e: x.at + x.name.length, root, name: x.name, list: true }); }
    for (const n of (ans.entities || [])) { const name = L(n).trim(); if (!name) continue; const root = nameRoot(name); if (root.startsWith('N:') && !nameLike(name)) continue;
      const re = nameRe(name); let hit = false; if (re) { re.lastIndex = 0; for (const m of vis.matchAll(re)) { M.push({ s: m.index, e: m.index + m[0].length, root, name }); hit = true; } }
      if (!hit) M.push({ s: 1e8 + M.length, e: 1e8 + M.length, root, name, engine_list: true }); }
    // a name inside a longer name of ANOTHER business is not a mention ("Oracle" in "Oracle NetSuite")
    M.sort((a, b) => (b.e - b.s) - (a.e - a.s) || a.s - b.s);
    const kept = []; for (const m of M) { if (kept.some(k => k.root !== m.root && m.s < k.e && k.s < m.e && m.s < 1e8)) continue; kept.push(m); }
    // one business: union-find over the roots of this answer
    const U = new Map(); const uf = (k) => { if (!U.has(k)) U.set(k, k); let r = k; while (U.get(r) !== r) r = U.get(r); return r; };
    const join = (a, b) => { if (a === 'self' || b === 'self') return; const ra = uf(a), rb = uf(b); if (ra !== rb) U.set(ra, rb); };
    for (const x of listNames) if (x.dom && x.root !== 'self') { const r = localRoot(x.dom); const known = (k) => !String(k).startsWith('N:') && !String(k).startsWith('L:');
      if (r && r !== 'self' && !(known(r) && known(x.root) && r !== x.root)) join(x.root, r); }
    OWN_PHRASE.lastIndex = 0;
    for (const m of vis.matchAll(OWN_PHRASE)) { const a = m.index, z = m.index + m[0].length;
      const left = kept.filter(k => k.e <= a && a - k.e <= 12 && k.s < 1e8).sort((p, q) => q.e - p.e)[0]; const right = kept.filter(k => k.s >= z && k.s - z <= 8).sort((p, q) => p.s - q.s)[0];
      if (left && right && left.root !== right.root) join(left.root, right.root); }
    // entities
    const ents = new Map();
    const ent = (root) => { const r = root === 'self' ? 'self' : uf(root); if (!ents.has(r)) ents.set(r, { r, roots: new Set(), mentions: [], cited: false, cites: [] }); const e = ents.get(r); e.roots.add(root); return e; };
    for (const m of kept) ent(m.root).mentions.push(m);
    const ourUrls = [];
    for (const c of cites) { const h = c.host || hostOf(c.url); if (!h) continue; if (isOurs(h)) { const e = ent('self'); e.cited = true; if (c.url) ourUrls.push(c.url); continue; }
      const r = localRoot(h); if (!r) continue; const e = ent(r); e.cited = true; e.cites.push(c); }
    // what is known about each entity: its id, domains, names, kind
    const domsOf = (e) => { const out = new Set(); for (const root of e.roots) { if (String(root).startsWith('L:')) { for (const v of local.values()) if (v.root === root) v.doms.forEach(d => out.add(d)); }
      else if (D.membersOf.has(root)) D.membersOf.get(root).filter(k => k.startsWith('d:')).forEach(k => out.add(k.slice(2))); } for (const m of e.mentions) if (m.dom) out.add(regD(m.name)); for (const c of e.cites) out.add(regD(c.host || hostOf(c.url))); return [...out].filter(Boolean); };
    const idOf = (e, ds) => { for (const root of e.roots) if (D.idOfRoot.has(root) && /\./.test(D.idOfRoot.get(root))) return D.idOfRoot.get(root);
      if (ds.length) return ds.slice().sort((a, b) => (D.configured.includes(b) ? 1 : 0) - (D.configured.includes(a) ? 1 : 0) || (/\.com$/.test(b) ? 1 : 0) - (/\.com$/.test(a) ? 1 : 0) || a.length - b.length || a.localeCompare(b))[0];
      for (const root of e.roots) if (D.idOfRoot.has(root)) return D.idOfRoot.get(root);
      const n = e.mentions.find(m => !m.dom); return n ? L(n.name).replace(/\s+/g, ' ').trim() : ''; };
    const list = [];
    for (const e of ents.values()) {
      const named = e.mentions.filter(m => m.s < 1e8 || m.engine_list);
      const at = named.length ? Math.min(...named.map(m => m.s)) : Infinity;
      if (e.r === 'self') { list.push({ id: normD(plan.domain), name: (plan.business_name || D.selfNames.find(x => !isDom(x)) || plan.domain), role: 'self', at, cited: e.cited, named: named.length > 0, domains: [D.own] }); continue; }
      const ds = domsOf(e); const id = idOf(e, ds); if (!id) continue;
      const name = (named.find(m => !m.dom && m.s < 1e8) || named.find(m => !m.dom) || {}).name || (ds[0] || id);
      const rootsF = [...e.roots].map(r => String(r));
      const isConf = rootsF.some(r => D.confRoots.has(r)) || ds.some(d => D.configured.includes(d));
      const isClientPlat = rootsF.some(r => D.clientRoots.has(r)) || (named.some(m => !m.dom && m.name.length >= 5 && D.clientText && nameRe(m.name) && nameRe(m.name).test(D.clientText)));
      const kinds = new Set(ds.map(kindOfDomain)); const names = named.map(m => m.name);
      const srcKind = [...kinds].some(k => SOURCE_KINDS.has(k)) && !ds.some(d => kindOfDomain(d) === 'site' && named.some(m => m.dom && regD(m.name) === d)) || names.some(n => NAME_SRC.test(n));
      const otherKind = (kinds.has('other') && !kinds.has('site')) || names.some(n => NAME_OTHER.test(L(n).trim()));
      let role;
      if (isConf) role = 'competitor';
      else if (!named.length) role = isClientPlat ? 'platform' : 'source';
      else if (srcKind) role = 'source';
      else if (otherKind) role = 'other';
      else if (isClientPlat) role = 'platform';
      else if (named.filter(m => m.s < 1e8).length && named.filter(m => m.s < 1e8).every(m => platformBefore(vis, m.s) || platformAfter(vis, m.e))) role = 'platform';
      else if (named.filter(m => m.s < 1e8).length && named.filter(m => m.s < 1e8).every(m => SRC_BEFORE.test(vis.slice(Math.max(0, m.s - 40), m.s)) || SRC_AFTER.test(vis.slice(m.e, m.e + 30)))) role = 'source';
      else if (ds.length || nameLike(name) || AR.test(name) || rootsF.some(r => D.explicit.has(r))) role = 'competitor';
      else role = 'other';
      list.push({ id, name: L(name).replace(/\s+/g, ' ').trim().slice(0, 60), role, at, cited: e.cited, named: named.length > 0, domains: ds });
    }
    // two entities with one id (a learned alias and a local domain met separately) are one
    const byId = new Map(); for (const x of list) { const k = low(x.id); const y = byId.get(k); if (!y) { byId.set(k, x); continue; }
      y.at = Math.min(y.at, x.at); y.cited = y.cited || x.cited; y.named = y.named || x.named; y.domains = [...new Set([...y.domains, ...x.domains])];
      const rank = { self: 5, competitor: 4, platform: 3, source: 2, other: 1 }; if (rank[x.role] > rank[y.role]) y.role = x.role; }
    const all = [...byId.values()].sort((a, b) => a.at - b.at);
    let pos = 0; for (const x of all) x.position = (x.role === 'self' || x.role === 'competitor') && x.named && x.at < Infinity ? ++pos : null;
    const self = all.find(x => x.role === 'self') || null;
    const named = !!(self && self.named);
    return { vis, named, cited: !!(self && self.cited), position: named ? self.position : null, ourAt: named ? self.at : -1, ourUrls,
      entities: all.map(x => ({ id: x.id, name: x.name, role: x.role, position: x.position, cited: !!x.cited, at: x.at, domains: x.domains })) };
  };

  /** the stored / in-memory form of a row's entities (F1b and the app read this) */
  const compact = (ents) => (ents || []).slice(0, 16).map(x => ({ id: String(x.id).slice(0, 80), name: String(x.name || '').slice(0, 60), role: x.role, position: x.position == null ? null : Number(x.position), cited: !!x.cited }));
  const entitiesOf = (row) => { if (row && Array.isArray(row.entities)) return row.entities; try { const v = JSON.parse((row && row.entities_json) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  /** two ids name one business (subdomain, country / brand variant) */
  const sameEntity = (a, b) => { if (!a || !b) return false; if (low(a) === low(b)) return true; if (!isDom(a) || !isDom(b)) return false; const ra = regD(a), rb = regD(b); if (ra === rb) return true; const ca = core(ra); return coreOk(ca) && ca === core(rb); };

  // ---- E10: a question that names another vendor ----
  /** the first company a question names that is not the client's own (its brand, or a platform its services name): { name, why } or null */
  const vendorIn = (text, o) => {
    const t = L(text); const plan = { site_id: (o && o.site_id) || 'q', domain: (o && o.domain) || '', business_name: (o && o.business_name) || '', brand_names: (o && o.brand_names) || [],
      competitors: (o && o.competitors) || [], configured_competitors: (o && o.configured_competitors) || (o && o.competitors) || [], aliases: (o && o.aliases) || {}, services: (o && o.services) || [], topics: (o && o.topics) || [], business_facts: (o && o.business_facts) || '' };
    const D = dir(plan, (o && o.book) || {});
    const hits = [];
    for (const x of D.scans) { x.re.lastIndex = 0; const m = x.re.exec(t); if (!m) continue; if (D.clientRoots.has(x.root) && !D.confRoots.has(x.root)) continue;
      const role = D.roleOfBook.get(x.root); if (role && role !== 'competitor' && !D.confRoots.has(x.root)) continue;
      hits.push({ at: m.index, name: m[0], why: D.confRoots.has(x.root) ? 'a competitor you track' : PLAT_DOMS.has(D.idOfRoot.get(x.root)) ? 'another vendor\'s product' : 'a business AI names for this topic' }); }
    for (const n of ((o && o.vendors) || [])) { if (!n || D.selfKeys.has(nn(n)) || nn(n).length < 3) continue; const re = nameRe(n); if (!re) continue; re.lastIndex = 0; const m = re.exec(t); if (m && !(D.clientText && nameRe(n).test(D.clientText))) hits.push({ at: m.index, name: m[0], why: 'a company AI names for this topic' }); }
    hits.sort((a, b) => a.at - b.at); return hits[0] || null;
  };

  // ---- E16: one wrong claim, one key, whatever the wording ----
  const CLAIM_STOP = new Set([...STOPW, 'based', 'located', 'headquartered', 'company', 'firm', 'business', 'provider', 'it', 'its', 'they', 'their', 'this', 'that', 'which', 'who', 'has', 'have', 'was', 'were', 'be', 'been', 'as', 'also', 'only', 'offers', 'offer', 'provides', 'provide']);
  const stems = (s) => new Set(low(s).replace(/[’']/g, '').split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1 && !CLAIM_STOP.has(w)).map(w => w.length > 4 ? w.replace(/(ings|ing|ies|ers|er|ed|es|s)$/, '') : w));
  const jac = (a, b) => { if (!a.size && !b.size) return 1; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); };
  const splitIssue = (t) => { const s = String(t || ''); const i = s.indexOf(' → '); return i >= 0 ? [s.slice(0, i), s.slice(i + 3).replace(/^[\p{L} ]{2,30}:\s*/u, '')] : [s, '']; };   // the fact side without its fact-sheet label ("City: Dubai" = "Dubai")
  /** the same wrong claim: it contradicts the same fact (the correct side) and says it in overlapping words (Jaccard >= 0.5 on stems) */
  const sameClaim = (a, b) => { const [ca, fa] = splitIssue(a), [cb, fb] = splitIssue(b); const F1 = stems(fa), F2 = stems(fb);
    if ((F1.size || F2.size) && jac(F1, F2) < 0.6) return false; return jac(stems(ca), stems(cb)) >= 0.5; };
  const claimKey = (t) => { const [c, f] = splitIssue(t); return [...stems(f)].sort().join(' ') + '|' + [...stems(c)].sort().join(' '); };

  return { servicesOf, L, low, normD, regD, hostOf, labelOf, core, commonWord, nameLike, nameRe, visible, kindOfDomain, brandNames, ownNames, clientPlatforms, bookOf, dir, read, compact, entitiesOf, sameEntity, vendorIn, sameClaim, claimKey, PLATFORMS };
})();
const CONFIG = { max_sites_per_run: 15, max_topics: 8, monthly_engines: ['claude'],   // v4.9: Gemini moved to the weekly set (the real gemini.google.com answer costs $0.004 through the scraper)
  gsc_questions: 15, pulse_days: 7 };
const { list, on_demand, want, total, cycle, cycle_why } = monitorSites('ai');
if (!list.length) return [{ json: { nothing_to_do: true, cycle, reason: cycle ? (cycle_why || 'nothing to run for this cycle') : on_demand ? 'no site matches "' + want + '"' : (total ? 'AI visibility is switched off for every site' : 'no sites yet (register one through "Track my site" or plan a keyword ladder)') } }];
const promptRows = rowsOf('Load AI Prompts'), visRows = rowsOf('Load AI Visibility'), ladders = rowsOf('Load Ladders'), daily = rowsOf('Load AI Daily'), cache = rowsOf('Load Cache (AI)'), queries = rowsOf('Load Query History');
// G6: the answers stored by earlier executions of an unfinished run (this week, not the pulse). Read raw: rowsOf() drops a row carrying
// `error` (it is meant for a Data Table node that failed), and an answer the gate could not get carries its task error — it is still
// ASKED, and asking it again in every later execution would never let a run end (a failed task is billed nothing; the report names it).
let runRows = []; try { runRows = $('Load AI Run Answers').all().map(i => i.json).filter(r => r && r.run_id && r.prompt_id && r.engine); } catch (e) {}
const continuing = String(trigger.continue_run || '').trim();   // G6: set when the previous chunk started this execution
const LIVE = new Set(['off', 'refused']);   // G6: a question switched off by the owner or refused by the fit gate is never asked
const now = new Date(); const iso = now.toISOString(); const month = iso.slice(0, 7);
const parse = (t, d) => { try { const v = JSON.parse(t || ''); return v == null ? d : v; } catch (e) { return d; } };
const isoOf = (code) => { const c = Object.values(typeof COUNTRIES === 'object' ? COUNTRIES : {}).find(x => Number(x.code) === Number(code)); return c ? String(c.iso || '').toUpperCase() : ''; };
const codeOfIso = (iso) => { const c = Object.values(typeof COUNTRIES === 'object' ? COUNTRIES : {}).find(x => String(x.iso || '').toUpperCase() === String(iso || '').toUpperCase()); return c ? Number(c.code) : AIP.locationOf(iso); };   // G6: a market outside COUNTRIES keeps its own country
const skipped = [];   // G6: sites this execution does nothing for, with the reason (a twin start, nothing to continue, a run above the ceiling)
const notices = [];   // F2 (E17): the on-demand callers told at once that their check is part of an open run (AI Open Run Notices posts them)
const openRun = (st, s, why) => { const left = Math.max(0, (Number(st.total) || 0) - (Number(st.asked) || 0)); const per = Math.max(1, Number(st.last_size) || AIP.LIMITS.chunk_requests);
  const parts = Math.ceil(left / per); const eta = new Date(Math.max(Date.parse(st.updated_at) || Date.now(), Date.now()) + parts * (AIP.TIME.budget_s + AIP.TIME.fixed_s) * 1000).toISOString();
  return { run_id: st.run_id, status: st.status, part: Number(st.chunk) || 1, asked: Number(st.asked) || 0, total: Number(st.total) || 0, started_at: st.started_at || '', updated_at: st.updated_at || '',
    expected_finish: String(st.status) === 'running' ? eta : '', why }; };
const tell = (s, st, kind) => {   // E17: only a caller that is waiting for its own answer (an on-demand start with a callback) and is not the open run's own caller
  if (!on_demand || !s.callback_url || (st && String(st.request_id || '') && String(st.request_id) === String(s.request_id || ''))) return;
  const o = openRun(st, s, kind);
  const sentence = kind === 'blocked'
    ? 'The AI visibility check of ' + s.domain + ' was not started: this week\'s run (' + o.run_id + ') was stopped (' + String(st.stop_reason || st.status) + '). Nothing was asked and nothing was charged; the team has been alerted.'
    : 'An AI visibility check of ' + s.domain + ' is already running (run ' + o.run_id + ', part ' + o.part + ', ' + o.asked + ' of ' + (o.total || '?') + ' questions asked). ' + (kind === 'resume' ? 'This request started its next part again. ' : '')
      + 'Its report will come with that run' + (o.expected_finish ? ', about ' + o.expected_finish.slice(0, 16).replace('T', ' ') + ' UTC' : '') + '. This request was not run separately and nothing was charged for it.';
  notices.push({ callback_url: s.callback_url, body: { stage: 'rejected', status: 'rejected', reason: 'open_run', skipped: true, error: sentence, request_id: String(s.request_id || ''), domain: s.domain, mode: 'ai_visibility', on_demand: true, open_run: o, cost_usd: 0 } }); };
const QUESTION = /^(how|what|which|who|why|when|where|is|are|can|does|do|should|best|top|cost|price|vs|compare)\b|\?|\b(vs|versus|best|cost|price|how to|which)\b/i;
const planned = list.slice(0, CONFIG.max_sites_per_run).map(s => {
  const label = s.domain.split('.')[0];
  const brand_names = AIE.brandNames({ domain: s.domain, business_name: s.business_name || '', brand_names: s.settings.brand_names || [] });   // P34-6: the model's name is a brand name too; F1a (E5): the label only when it is a name, not a common word (payroll.ae)
  const lrowsAll = ladders.filter(l => normD(l.domain) === s.domain).sort((a, b) => (Number(a.rung) || 0) - (Number(b.rung) || 0));
  const asked = on_demand ? listOf(trigger.topics).map(x => x.toLowerCase()) : [];   // "Main services or products" on the on-demand form / API `topics`
  // D15 (system review 2026-10-11): the plan carries the site's canonical host (the site model, SITE_MODEL_SPEC.md §6), so every URL the run
  // emits is on the host the site really serves; with no model yet the bare domain keeps today's behaviour.
  const site_model = SM.stored(s) || { domain: s.domain, canonical_host: s.domain };
  // G6: the state of this site's split run, and what this execution is for it
  const st = AIP.stateOf(cache, s.site_id);
  const verdict = AIP.stateVerdict(st, iso, continuing);
  if (continuing && verdict !== 'continue') { skipped.push({ domain: s.domain, why: 'nothing to continue: run ' + continuing + ' is ' + (st && st.run_id === continuing ? st.status : 'not the open run') }); return null; }
  if (verdict === 'busy') { tell(s, st, 'busy'); skipped.push({ domain: s.domain, why: 'run ' + st.run_id + ' is still being asked (chunk ' + (st.chunk || 1) + ', ' + (st.asked || 0) + ' of ' + (st.total || '?') + ' requests, updated ' + String(st.updated_at || '').slice(0, 16) + ' UTC); it continues by itself' }); return null; }
  // F2 (E1): a STOPPED run (its answers were not stored, or it reached its money ceiling) blocks this site's weekly run until it is older than
  // resume_days or a person clears the state row — a retry of the cycle job, a catch-up or an on-demand start never pays for it again
  if (verdict === 'blocked') { tell(s, st, 'blocked'); skipped.push({ domain: s.domain, blocked: true, why: 'run ' + st.run_id + ' was stopped (' + String(st.stop_reason || st.status) + '); nothing is asked for this website until the run is older than ' + AIP.LIMITS.resume_days + ' days or the state row ai_run:' + s.site_id + ' is cleared' }); return null; }
  if (verdict === 'resume') tell(s, st, 'resume');
  const going = verdict === 'continue' || verdict === 'resume';
  const mineAll = promptRows.filter(p => p.site_id === s.site_id && !LIVE.has(String(p.status || 'active')) && p.prompt);
  const mineVis = visRows.filter(v => v.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
  const prev = mineVis[0] || null;
  // brand names AI uses for competitors (learned by the Answer Analyst: "ClearTax" -> cleartax.in), so a competitor named without its website still counts
  const aliasRow = cache.find(c => c.key === 'ai_brands:' + s.site_id); const aliases = aliasRow ? parse(aliasRow.value, {}) : {};
  const autoRivals = prev ? (parse(prev.competitors_json, []) || []).filter(c => c && c.domain && c.auto && (c.mentions || 0) >= 2 && /\./.test(c.domain)).map(c => c.domain) : [];
  const competitors = [...new Set([...s.settings.competitors, ...autoRivals])].slice(0, 8);
  // B-G1: the read-path gate, before a single stored rung can become a topic, a question or a page we check for AI readiness.
  // Protected so the ladder's own subject can never read as somebody's brand: the head terms, the site's services and its own keywords.
  // F2 (E18): one gate input for the weekly run and the pulse (AIP.fitInput: ladder heads + the site's services + its keywords)
  const fit_input = AIP.fitInput({ domain: s.domain, competitors, aliases, ladders: lrowsAll, services: SM.services(site_model), keywords: s.keywords || [] });
  const fitCtx = FITR.ctx(fit_input);
  const fit = FITR.rungs(lrowsAll, fitCtx, { where: 'AI question panel' });
  const lrows = fit.keep;
  // and the panel rows ALREADY stored from those rungs (seo_ai_prompts predates the gate too): an auto-written question whose keyword is
  // a competitor's brand is dropped, a question the owner added themselves is kept and only flagged — it is their deliberate choice.
  // The brand question is deliberately about the site itself ("What is X and what does it offer?"), so it is never judged here — the
  // gate's first rule is "names the website itself", and running it over that question would refuse the one question that must stay.
  const fitQ = FITR.rungs(mineAll.filter(p => p.kind !== 'brand'), fitCtx, { where: 'AI question panel', keyword: (p) => p.keyword || p.topic || '', live: (p) => p.source === 'custom' });
  const refusedQ = new Set(fitQ.set_aside.filter(x => x.dropped).map(x => x.prompt_id));
  // G6: pinned questions first (the owner's choice is never cut by a smaller panel), then the stored order (the panel's order)
  const pin = (p) => p.pinned === true || String(p.pinned) === 'true';
  const mine = mineAll.filter(p => p.kind === 'brand' || !refusedQ.has(p.prompt_id)).map((p, i) => ({ p, i }))
    .sort((a, b) => ((pin(b.p) ? 1 : 0) - (pin(a.p) ? 1 : 0)) || a.i - b.i).map(x => x.p);
  const set_aside = [...fit.set_aside, ...fitQ.set_aside];
  const custom = mine.filter(p => p.source === 'custom' || pin(p)), auto = mine.filter(p => p.source !== 'custom' && !pin(p));
  const topics =[...new Set([...asked, ...lrows.map(l => String(l.head_keyword || '').toLowerCase().trim()), ...(s.keywords || []), ...lrows.filter(l => Number(l.rung) !== 4).map(l => String(l.keyword || '').toLowerCase().trim())].filter(Boolean))].slice(0, CONFIG.max_topics);
  // full run = the first run of the month (or any on-demand run): every engine + the brand question + discovery + the market-wide index
  const isFull = (v) => String(v.run_kind || '') === 'full' || String(v.run_kind || '') === 'on_demand' || (!v.run_kind && (() => { const e = parse(v.engines_json, {}); return ['gemini', 'claude'].some(k => e[k] && Number(e[k].asked) > 0 && !e[k].carried); })());
  const lastFull = mineVis.find(isFull) || null;
  // the monthly full run: a cycle run takes it from the dispatcher (cycle.monthly) and nowhere else; outside a cycle the UTC month rule stays
  const full_due = going ? !!st.full_due : (on_demand || (cycle ? cycle.monthly : !mineVis.some(v => String(v.checked_at).slice(0, 7) === month && isFull(v))));
  // the cycle this run belongs to: this start's own (a cycle job, or a continuation that carries it), else the one the split run was started for
  const runCycle = cycle || (going && st && st.cycle && st.cycle.key ? st.cycle : null);
  const carried = lastFull ? { checked_at: lastFull.checked_at, engines: parse(lastFull.engines_json, {}) } : null;
  const room = Math.max(0, s.settings.prompts_max - custom.length);
  const deficit = Math.max(0, room - auto.length);
  // G6: questions are written in the FIRST chunk of a run only (a continuation asks the panel the first chunk stored); the Prompt Writer
  // writes at most writer_batch x writer_jobs_per_run in one run, so a new 500-question panel is written in one week
  const need = going ? 0 : Math.min(AIP.LIMITS.writer_batch * AIP.LIMITS.writer_jobs_per_run, (!auto.length || deficit >= 2) ? deficit : 0);   // top up only when 2+ questions are missing (not every week for one)
  const ownMarket = AIP.normMarket(isoOf(Number(s.location_code) || 2840) + '-' + (s.language_code || 'en')) || 'US-en';
  // the markets the panel covers: the site's own, the ones in its settings, and any market a stored question names (an imported question keeps its market)
  const markets = AIP.marketsOf({ country_iso: isoOf(Number(s.location_code) || 2840), language_code: s.language_code || 'en', ai_markets: [...s.settings.markets, ...mineAll.map(p => p.market).filter(Boolean)] });
  const markets_map = Object.fromEntries(markets.map(m => { const [cc, lang] = m.split('-'); return [m, { location_code: m === ownMarket ? (Number(s.location_code) || 2840) : codeOfIso(cc), language_code: lang || 'en', country_iso: cc }]; }).filter(([, v]) => v.location_code));
  const personas = AIP.personasOf({ ai_personas: s.settings.personas });
  const prompts = [...custom, ...auto].slice(0, s.settings.prompts_max).map(p => ({ prompt_id: p.prompt_id, prompt: p.prompt, kind: p.kind || 'custom', topic: p.topic || '', keyword: p.keyword || '', source: p.source || 'auto',
    stage: p.stage || '', cluster: p.cluster || p.topic || '', volume: p.volume === '' || p.volume == null ? null : Number(p.volume), origin: p.origin || (p.source === 'custom' ? 'custom' : 'writer'), created_at: p.created_at || '',
    persona: String(p.persona || '').trim(), market: markets_map[AIP.normMarket(p.market)] ? AIP.normMarket(p.market) : ownMarket, pinned: pin(p),
    // F2 (E20 / E22 / E9): what the stored row says, carried so a re-upsert never blanks it; a market past the cap is asked in the own market and says so
    market_stored: String(p.market || ''), market_fallback: !!(AIP.normMarket(p.market) && !markets_map[AIP.normMarket(p.market)]), fit_note: String(p.fit_note || ''), keyword_source: String(p.keyword_source || '') }));
  // search volumes: questions without one (new) every week; all of them on the month's full run (AI Keyword Data, $0.0001 a keyword)
  const volume_keywords = [...new Set(prompts.filter(p => p.kind !== 'brand' && p.keyword && (full_due || p.volume === null || Number.isNaN(p.volume))).map(p => String(p.keyword).toLowerCase().trim()).filter(k => k.length >= 3 && k.length <= 120))].slice(0, 100);
  // real questions people search (Search Console, last weeks): long or question-shaped queries are the closest thing to an AI prompt
  const gsc_questions = [...new Map(queries.filter(q => q.site_id === s.site_id && q.query && (String(q.query).split(/\s+/).length >= 5 || QUESTION.test(String(q.query))))
    .sort((a, b) => (Number(b.impressions) || 0) - (Number(a.impressions) || 0)).map(q => [String(q.query).toLowerCase().trim(), { query: String(q.query).trim(), impressions: Number(q.impressions) || 0, clicks: Number(q.clicks) || 0, position: Number(q.position) || 0 }])).values()].slice(0, CONFIG.gsc_questions);
  // AI Pulse samples since the last weekly run (or the past week): they join this week's figures (more samples = a steadier, honest rate)
  // E14 (2026-10-23, F1b): a pulse morning belongs to exactly ONE weekly window, (the previous run's start, this run's start]. The lower
  // bound alone let a split run that finished after a pulse morning pool it, and the next week pool it again. A row's checked_at IS its
  // run's start (a split run keeps the first part's), so it is the next window's lower bound; the window is stored in compare_json.window.
  const prevCmp = prev ? parse(prev.compare_json, null) : null;
  const since = prev ? String(prev.checked_at) : new Date(now.getTime() - CONFIG.pulse_days * 864e5).toISOString();
  const windowTo = going ? String(st.started_at || iso) : iso;
  const pulse_window = { from: since, to: windowTo, days: Math.round(10 * Math.max(0, (Date.parse(windowTo) - Date.parse(since)) / 864e5)) / 10 };
  const pulse_rows = daily.filter(d => d.site_id === s.site_id && String(d.checked_at) > since && String(d.checked_at) <= windowTo).map(d => ({ date: d.date, checked_at: d.checked_at, run_id: d.run_id || '', samples: Number(d.samples) || 0, mentioned: Number(d.mentioned) || 0, cited: Number(d.cited) || 0,
    mention_rate: Number(d.mention_rate) || 0, visibility_score: Number(d.visibility_score) || 0, engines: parse(d.engines_json, {}), prompts: parse(d.prompts_json, {}), competitors: parse(d.competitors_json, {}), sources: parse(d.sources_json, {}),
    rule_version: String(d.rule_version || ''), detail: parse(d.detail_json, null), sample_mode: String(d.sample_mode || ''), partial: d.partial === true || String(d.partial) === 'true' }));
  const prevMention = prev ? Number(prev.mention_rate) || 0 : 0, prevSamples = prev ? Number(prev.samples) || Number(prev.answers) || 0 : 0;
  const location_code = Number(s.location_code) || 2840;
  // ---- G6: this run's identity, what earlier executions of it already asked, and what is left to pay for ----
  const baseId = 'ai_' + iso.slice(0, 10).replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, '');
  const run_id = going ? st.run_id : (st && st.run_id && String(st.run_id).indexOf(baseId) === 0 ? baseId + '_x' + $execution.id : baseId);   // a second run the same day gets its own id: its answers are its own
  const run_checked_at = going ? String(st.started_at || iso) : iso;
  const storedKeys = new Set(going ? runRows.filter(r => r.run_id === run_id && r.prompt_id && r.engine).map(r => AIP.reqKey(r.prompt_id, r.engine)) : []);
  // F2 (E1): what the run has SENT (recorded before it paid) and the part in flight. Earlier parts' keys were checked against the save by their
  // own hand-off; a `pending` part is one that never reached its hand-off, so its keys that are not stored were paid for and lost.
  const sentKeys = going ? AIP.unpackKeys(st.asked_keys) : new Set();
  const pendingKeys = going && st.pending ? AIP.unpackKeys(st.pending.keys) : new Set();
  const lostNow = [...pendingKeys].filter(k => !storedKeys.has(k));
  const lostParts = going ? Number(st.lost_parts) || 0 : 0;
  // a state written before asked_keys existed: the count is all there is (the audit's guard), and a shortfall is a lost part too
  const legacyShort = going && !st.asked_keys && Number(st.asked) > 0 && storedKeys.size < (Number(st.asked) - Number(st.unavailable || 0)) * 0.9;
  // AI Requests is handed EVERY key the run stored or sent: a recorded key is never asked again, whatever happened to its answer
  const doneKeys = [...new Set([...storedKeys, ...sentKeys])];
  const runKind = going ? String(st.run_kind || 'weekly') : (on_demand ? 'on_demand' : full_due ? 'full' : 'weekly');
  const costNow = AIP.cost({ panel: Math.max(prompts.length + need, AIP.LIMITS.min), engines: s.settings.engines, pulse: s.settings.pulse, pulse_mode: s.settings.pulse_mode, pulse_per_week: s.settings.pulse_per_week });
  const runCost = full_due ? costNow.run.full : costNow.run.weekly;
  const spent = going ? { dfs: Number(st.spent_dfs_usd) || 0, ai: Number(st.spent_ai_usd) || 0 } : { dfs: 0, ai: 0 };
  if (!going && runCost.usd > AIP.LIMITS.max_run_usd) { skipped.push({ domain: s.domain, why: 'this run would cost about $' + runCost.usd.toFixed(2) + ' (' + prompts.length + ' questions x ' + s.settings.engines.length + ' engines), above the $' + AIP.LIMITS.max_run_usd + ' a run the tracker allows; nothing was asked or charged — lower the panel or the engines' }); return null; }
  // how many requests this run makes in all, and whether this execution can be its last (the database views, GA4, the crawler check and the
  // metrics run in the last one): an upper bound — the AI Overview is asked once per search phrase, so the real count can only be smaller
  const engNow = s.settings.engines.filter(e => full_due || !CONFIG.monthly_engines.includes(e));
  const reqTotal = (prompts.filter(q => q.kind !== 'brand').length + need) * engNow.length + (full_due ? engNow.filter(e => e !== 'copilot' && e !== 'ai_overview').length : 0);
  const reqLeft = Math.max(0, reqTotal - doneKeys.length);
  // F2 (E1): the run's hard money ceiling (fixed at its start) and what is left under it
  const ceiling = going && Number(st.ceiling_dfs_usd) > 0 ? Number(st.ceiling_dfs_usd) : AIP.runCeiling(runCost.dfs);
  const committed = going ? Math.max(Number(st.spent_dfs_usd) || 0, Number(st.committed_dfs_usd) || 0) : 0;
  let stop = null;
  if (going && (legacyShort || (lostNow.length && (lostParts >= 1 || st.save_failed))))
    stop = { status: 'failed_store', lost: legacyShort ? Math.max(0, Number(st.asked) - storedKeys.size) : lostNow.length,
      reason: (legacyShort ? (Number(st.asked) - storedKeys.size) + ' of the ' + st.asked + ' requests its earlier parts asked have no stored answer' : lostNow.length + ' request(s) of part ' + ((st.pending || {}).chunk || st.chunk) + ' were paid for but their answers were never stored, and this has happened before in this run')
        + '. They are not asked again (that would pay twice); the run is stopped, and nothing more is asked for this website this week. Check the Data Table size and the execution of the part named in the state row, then clear ai_run:' + s.site_id + ' to let a new run start.' };
  else if (going && reqLeft > 0 && committed >= ceiling)
    stop = { status: 'stopped_ceiling', lost: 0, reason: 'the run has spent or committed $' + committed.toFixed(2) + ' of DataForSEO against its ceiling of $' + ceiling.toFixed(2) + ' (1.5 x its own estimate) with ' + reqLeft + ' request(s) still to ask. Nothing more is asked; check the prices in the run\'s ledger rows before clearing ai_run:' + s.site_id + '.' };
  const halve = !stop && (lostNow.length > 0 || !!(going && st.halve_next));
  // F2 (E11): the part sized by TIME (the run's measured seconds per request once a part has measured them), and the analyst jobs it leaves room for
  const aj = Math.min(12, Math.max(6, Math.ceil((Number(costNow.analyst_jobs) || 0) / Math.max(1, Number(costNow.executions) || 1))));
  const cp = AIP.chunkPlan({ engines: engNow, measured_s: going ? Number(st.sec_per_request) || 0 : 0, analyst_jobs: aj, halve });
  const chunk = { no: going ? (Number(st.chunk) || 1) + 1 : 1, size: cp.size, size_time: cp.size, sec_per_request: cp.sec_per_request, size_basis: cp.basis, analyst_jobs_max: aj, going, resumed: verdict === 'resume', final_expected: reqLeft <= cp.size,
    ceiling_dfs_usd: ceiling, committed_dfs_usd: +committed.toFixed(4), ceiling_left_usd: +Math.max(0, ceiling - committed).toFixed(4),
    // F2 (E1): the keys a part paid for whose answers never came back to the table (counted once, never asked again) and the parts that lost them
    lost_now: stop ? 0 : lostNow.length, lost_total: (going ? Number(st.lost) || 0 : 0) + (stop ? 0 : lostNow.length), lost_parts: lostParts + (!stop && lostNow.length ? 1 : 0),
    unanalysed: going && st.pending && !lostNow.length && pendingKeys.size ? pendingKeys.size : 0,
    total_est: reqTotal, done: doneKeys.length, executions: (going && Array.isArray(st.executions)) ? st.executions : [], started_at: run_checked_at,
    // what earlier parts asked and could not be read even when sent again: not asked a third time, named in the week's report
    unavailable: going ? runRows.filter(r => r.run_id === run_id && r.error).length : 0 };
  if (chunk.unavailable) chunk.unavailable_note = chunk.unavailable + ' request(s) of this run could not be read in its earlier part(s), even when sent again; they are not asked again and the week counts the answers that came back';
  if (chunk.lost_total) chunk.lost_note = chunk.lost_total + ' request(s) of this run were paid for in a part that stopped before its answers were stored (the execution\'s time limit, a restart); they are not asked again (that would pay twice) and the week counts the answers that were stored';
  if (chunk.unanalysed) chunk.unanalysed_note = chunk.unanalysed + ' answer(s) of this run were stored by a part that stopped before the Answer Analyst read them; the run\'s last part has the Answer Analyst read them from their stored text (as many as its analyst budget allows; an answer stored before the full text was kept keeps the parser\'s reading)';   // W2-E1
  if (stop) { Object.assign(chunk, { size: 0, size_time: 0, final_expected: null, stop: true }); }   // F2: nothing is asked; the ledger key is the job's own (null is not a part)
  // pages that must stay fetchable for AI: the ones AI cited last time and the keyword-ladder pages (checked against robots.txt per AI bot)
  const pathOf = (u) => { const m = String(u || '').match(/^https?:\/\/[^\/?#]+(\/[^?#]*)?/i); return m ? (m[1] || '/') : (String(u || '').startsWith('/') ? String(u) : ''); };
  const key_paths = [...new Set([...(prev ? (parse(prev.pages_json, []) || []).map(x => pathOf(x && x.url)) : []), ...lrows.map(l => pathOf(l.target_url))].filter(x => x && x !== '/'))].slice(0, 8);
  return { json: { site_id: s.site_id, domain: s.domain,
    // G6: the split run (chunk, what is done, what is left to spend), the markets and personas the panel covers, the cost model of this panel
    chunk, done_keys: doneKeys, markets, markets_map, own_market: ownMarket, personas, pulse_mode: s.settings.pulse_mode, pulse_per_week: s.settings.pulse_per_week,
    est_dfs_usd: stop ? 0 : +Math.min(Math.max(0, runCost.dfs - Math.max(spent.dfs, committed)), Math.max(0, ceiling - committed)).toFixed(4),   /* F2: a dead part's committed money counts as spent */ est_ai_usd: stop ? 0 : +Math.max(0, runCost.ai - spent.ai).toFixed(4), run_cost_est: runCost, cost_model: costNow,
    // F2 (E1): a stopped run asks nothing; AI Chunk Handoff writes its state, the ops alert and the notice to its own caller
    stop, ceiling_dfs_usd: ceiling,
    spent_before: spent, state_before: going ? st : null, canonical_host: site_model.canonical_host || s.domain, country: s.country || '', location_code, language_code: s.language_code || 'en', country_iso: isoOf(location_code),
    // F2 (E17): a run that continues keeps ITS caller (the request id, e-mail and callback it was started with); a different on-demand caller
    // that resumed it was told so at once (notices) and never takes the open run's report
    email: going ? String(st.email || '') : (s.email || ''), callback_url: going ? String(st.callback_url || '') : (s.callback_url || ''),
    request_id: going ? String(st.request_id || '') : (s.request_id || ''), on_demand: going ? !!st.on_demand : on_demand, adhoc: !!s.adhoc,   /* G6: a continuation is the run it continues (scheduled or on demand) */ business_name: s.business_name || ''   /* P34-6: the site model's name (monitorSites nameOf), not seo_profiles alone */, business_type: s.profile.business_type || '', city: s.profile.city || '', profile: s.profile,
    // G10 (2026-10-11 system review): the Answer Analyst can only call a claim wrong against facts on file, so the site model's
    // services, business facts and accreditation status travel with the profile (SITE_MODEL_SPEC.md; with no sheet the analyst
    // reports "not checked", never "no wrong claims")
    services: SM.services(site_model).slice(0, 20), business_facts: SM.facts(site_model).business_facts, accreditation: SM.facts(site_model).accreditation,
    brand_names, competitors, configured_competitors: s.settings.competitors, aliases, topics, engines: s.settings.engines, prompts_max: s.settings.prompts_max, pulse: s.settings.pulse,
    prompts: stop ? [] : prompts, full_due, run_kind: runKind, monthly_engines: CONFIG.monthly_engines.filter(e => s.settings.engines.includes(e)), carried,
    need_prompts: !stop && need > 0, prompts_needed: stop ? 0 : need, need_site_text: !stop && need > 0 && !topics.length && !s.business_name, gsc_questions,
    // G6: discovery runs in a run's first execution (it feeds the Prompt Writer); the database views, GA4 and the crawler check in its last
    discovery_due: !going && !!topics.length && (full_due || need > 0), volume_keywords: going ? [] : volume_keywords, index_due: full_due,
    market_due: !!topics.length && (runCycle ? (going ? !!st.full_due : cycle.monthly) : (!prev || String(prev.market_month || '') !== month)), market_keyword: topics[0] || '',
    ga4_property_id: String(s.ga4_property_id || '').replace(/^properties\//, '').trim(), pulse_rows, pulse_window, key_paths,
    // B-G1: what the gate refused, with its reason, so the report names it instead of printing a shorter list (INVARIANTS rule 1)
    set_aside, set_aside_note: FITR.line(set_aside, 'asked of the AI engines or scored against'),
    // G6: the gate's context, so the questions the Prompt Writer writes this run are judged by the same rule before they are stored
    fit_input,
    // F1b (2026-10-23): the previous row's identity, the rule its figures were counted under and its own counts (metrics_json), so the
    // comparison is made on what that run measured, never rebuilt from a rounded percentage
    previous: prev ? { run_id: String(prev.run_id || ''), rule_version: String(prev.rule_version || ''), stats: parse(prev.metrics_json, null), compare: prevCmp,
      named_rate: prev.named_rate === '' || prev.named_rate == null ? null : Number(prev.named_rate), avg_position: prev.avg_position === '' || prev.avg_position == null ? null : Number(prev.avg_position),
      checked_at: prev.checked_at, mention_rate: prevMention, samples: prevSamples, mentioned_k: Math.round(prevMention * prevSamples / 100),
      // B-L4 (2026-10-15, INVARIANTS rule 1): the panel is settable from 3 to 50 and a weekly check asks fewer engines than the
      // monthly full one, so the stored row's OWN panel size and run kind travel with its figures. Without them AI Metrics
      // subtracted a 20-question run from an 8-question one and called the difference a change in visibility.
      prompts: Number(prev.prompts) || 0, run_kind: String(prev.run_kind || ''), citation_rate: Number(prev.citation_rate), share_of_voice: Number(prev.share_of_voice), avg_rank: Number(prev.avg_rank),
      visibility_score: prev.visibility_score === '' || prev.visibility_score == null ? null : Number(prev.visibility_score), sentiment_score: prev.sentiment_score === '' || prev.sentiment_score == null ? null : Number(prev.sentiment_score),
      engines: parse(prev.engines_json, {}), market_month: prev.market_month || '', market: parse(prev.market_json, null), index: parse(prev.index_json, null), perception: parse(prev.perception_json, null), traffic: parse(prev.traffic_json, null), access: parse(prev.access_json, null),
      competitors: parse(prev.competitors_json, []),
      // G6: the panel that row asked (its question ids: a delta needs 80% of them in common) and its segments (each segment's change is tested against them)
      panel: parse(prev.panel_json, null), segments: (() => { const x = parse(prev.segments_json, null); if (!x || !Array.isArray(x.rows)) return null;
        return { rows: x.rows.map(r => Array.isArray(r) ? { dim: r[0], key: r[1], questions: r[2], n: r[3], k: r[4] } : r) }; })() } : null,
    run_id, checked_at: run_checked_at, cycle: runCycle } };
}).filter(Boolean);
// G6: one execution carries at most exec_requests engine requests across all its sites (a scheduled run covers up to 15). The budget goes
// to the sites in order; a site whose run does not fit is asked in part and continues in its own execution. Only the LAST execution of a
// site's run asks the database views, reads GA4 and the crawler access and computes the week, so those wait for it.
// F2 (E11): and at most what fits the execution's TIME across its sites (each part's own seconds per request, the analyst jobs of every site)
{ let budget = AIP.LIMITS.exec_requests;
  let secs = AIP.TIME.budget_s - AIP.TIME.fixed_s - AIP.TIME.retry_wait_s - Math.min(36, planned.reduce((t, it) => t + (it.json.chunk.stop ? 0 : it.json.chunk.analyst_jobs_max || 0), 0)) * AIP.TIME.analyst_job_s;
  for (const it of planned) { const j = it.json, c = j.chunk; const left = Math.max(0, c.total_est - c.done);
    if (c.stop) { j.index_due = false; j.market_due = false; j.ga4_property_id = ''; j.key_paths = []; j.discovery_due = false; j.volume_keywords = []; continue; }
    const byTime = Math.max(planned.length > 1 ? 0 : AIP.TIME.min_requests, Math.floor(Math.max(0, secs) / Math.max(0.5, c.sec_per_request || 1)));
    c.size = Math.max(0, Math.min(c.size_time || AIP.LIMITS.chunk_requests, budget, byTime)); c.final_expected = left <= c.size; budget -= Math.min(left, c.size); secs -= Math.min(left, c.size) * (c.sec_per_request || 1);
    if (!c.final_expected) { j.index_due = false; j.market_due = false; j.ga4_property_id = ''; j.key_paths = []; } } }
if (!planned.length) return [{ json: { nothing_to_do: true, reason: skipped.map(x => x.domain + ': ' + x.why).join(' | ') || 'nothing to do', skipped, notices } }];
if (skipped.length) planned[0].json.skipped_sites = skipped;
if (notices.length) planned[0].json.notices = notices;
return planned;
