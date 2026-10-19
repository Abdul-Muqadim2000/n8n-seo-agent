// Link Builder plan (v4.13, LINK_BUILDER_SPEC.md; weekly in each website's own cycle, after the Backlink Monitor and AI Growth, or on demand): per site with the Link
// Builder on, what to look for this week — journalist requests (weekly), resource pages, the listings checklist, our old URLs in the Wayback
// Machine, podcast shows that take guests on the site's topics (L5) and competitors' broken backlinks and most-linked pages (L6)
// (monthly: every ~25 days, kept in seo_cache linkbld:<site>), the prospects to qualify — and what
// the pitches need: topics, competitors, the business profile (signature), our pages with their position and links (which page to point to).
// On demand with free_only: no DataForSEO, no Claude ($0).
// 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.4 / §4.8): a cycle run (`trigger: 'cycle'`) is a scheduled run for one site; the monthly sources keep
// their rolling 25 days (per site already), and "pitches per page this month" counts the website's own month (its time zone, seo_cycles.tz).
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
  const regDomain = (h) => { const p = String(h || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean); if (p.length <= 2) return p.join('.');
    const sld = /^(co|com|net|org|gov|edu|ac|ltd|plc|sch|nic|or|ne|go|mil|biz|info)$/; return (sld.test(p[p.length - 2]) && p[p.length - 1].length === 2) ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
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
    const place = { content: 1, body: 0.65, sidebar: 0.4, nav: 0.3, footer: 0.2, comment: 0.1 }[l.placement || 'body'] ?? 0.6;
    const editorial = (l.original === false ? 0.4 : 1) * (Number(l.sitewide) >= 20 ? 0.5 : 1) * (['guest_post', 'sponsored'].includes(l.link_type) ? 0.4 : 1);
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
  return { text, attr, hostOf, regDomain, refKey, sameSite, isInfra, isScraper, isSearchPage, isWire, normUrl, cleanUrl, placementAt, anchorPlacements, linksTo, pageFacts, contextAt, challenge, emailsIn, verify, mention, domainKind, quality, values, anchorKind, SPAM_RE, isGambling, footPath, footprints };
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
    const services = uniq([...listOf(x.services), ...listOf(desc0.products_or_services), ...listOf(desc0.services), ...listOf(desc0.main_services), ...(jparse(row.services_json, []) || [])].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
    const navStored = jparse(row.nav_pages_json, []) || [];
    const navFresh = x.nav_pages || (html && canonical_host ? navFromHtml(html, canonical_host) : []);
    const nav_pages = (navFresh.length ? navFresh : navStored).map(p => ({ url: S(p.url), title: S(p.title), path: S(p.path) || pathOf(p.url) })).filter(p => p.url).slice(0, 12);

    const pages = (Array.isArray(x.pages) ? x.pages : []).map(p => ({ url: S(p.url), title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod),
      queries: Array.isArray(p.queries) ? p.queries : (jparse(p.queries_json, []) || []) })).filter(p => p.url);

    const business_facts = S(req.business_facts || x.business_facts || row.business_facts).slice(0, 2000);
    const cta = S(req.cta || x.cta || row.cta).slice(0, 200);
    const mon = x.monitors || {};
    const brand_names = uniq([...listOf(mon.brand_names), ...listOf(x.brand_names), ...listOf(row.brand_names), nameHit.value].filter(Boolean));
    const competitors = uniq([...listOf(mon.competitors), ...listOf(x.competitors), ...listOf(row.competitors)].map(bare).filter(d => d && d !== domain)).slice(0, 8);
    const accreditation = S(x.accreditation || row.accreditation);
    const updated_at = S(x.updated_at) || S(row.model_updated_at) || new Date().toISOString();

    return { site_id, domain, canonical_host, host_source, home_url: 'https://' + canonical_host + '/',
      business_name: nameHit.value, name_source: nameHit.source, logo_url: logoHit.value, logo_source: logoHit.source,
      nap, services, nav_pages, pages, business_facts, cta, brand_names, competitors, accreditation,
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
  const matchPage = (model, keyword, prefer) => {   // `prefer`: a URL that wins a tie (the page Search Console itself credits for the search)
    const prefKey = prefer ? bare(hostOf(prefer)) + pathOf(prefer).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase() : "";
    const isPref = (u) => !!prefKey && (bare(hostOf(u)) + pathOf(u).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase()) === prefKey;
    const want = matchTerms(keyword); if (!want.length) return null;
    const key = tokensOf(keyword).join(' ');
    const inv = pages(model);
    const byQuery = [];
    for (const p of inv) {
      const q = (p.queries || []).find(x => tokensOf(x.query || x.keyword || x).join(' ') === key && (Number((x || {}).impressions) || 0) > 0);
      if (q) byQuery.push({ url: p.url, title: p.title, source: p.source, matched_by: 'query', score: 1, impressions: Number(q.impressions) || 0 });
    }
    byQuery.sort((a, b) => Number(isListing(a.url)) - Number(isListing(b.url)) || b.impressions - a.impressions);
    const qHit = byQuery[0] || null;
    const listingOf = (lst, best) => ({ url: lst.url, impressions: lst.impressions,
      note: 'Google currently shows ' + pathOf(lst.url) + ' (a listing page) for this search; the page that is about it is ' + pathOf(best.url) });
    if (qHit && !isListing(qHit.url)) { const lst = byQuery.find(x => isListing(x.url)); return lst ? { ...qHit, listing: listingOf(lst, qHit) } : qHit; }
    let best = null;
    for (const p of inv) {
      if (qHit && isListing(p.url)) continue;   // R56: looking for the dedicated page behind a listing's impressions
      const slug = matchTerms(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''));
      const title = matchTerms(S(p.title) + ' ' + S(p.h1));
      const inSlug = shareIn(want, slug);
      const inTitle = shareIn(want, title);
      const score = Math.max(inSlug, inTitle);
      if (score + 1e-9 >= MATCH_MIN && (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && isPref(p.url) && !isPref(best.url)))) best = { url: p.url, title: p.title, source: p.source, matched_by: inSlug >= inTitle ? 'slug' : 'title', score: Math.round(score * 100) / 100, impressions: 0 };
    }
    if (qHit && best) return { ...best, listing: listingOf(qHit, best) };
    return qHit || best;
  };
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
      if (seen.has(k)) { const old = out.find(o => pathOf(o.url).replace(/\/$/, '').toLowerCase() === k); if (old) { old.title = old.title || S(p.title); old.h1 = old.h1 || S(p.h1); old.lastmod = old.lastmod || S(p.lastmod); const q = queriesOf(p); if (q.length) old.queries = q; } continue; }
      seen.add(k); out.push({ url: u, title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries: queriesOf(p) }); }
    return out; })() });
  // the model exactly as it was stored (seo_sites row or a seo_cache value), with its own timestamp -- never "now", so isFresh() is honest
  const stored = (row) => { const r = (row && typeof row === 'object') ? row : {}; return (S(r.canonical_host) || S(r.model_updated_at)) ? from(r, {}) : null; };
  const FRESH_DAYS = 7;
  const ageDays = (model) => { const t = Date.parse(S((model || {}).model_updated_at)); return Number.isFinite(t) ? (Date.now() - t) / 864e5 : Infinity; };
  const isFresh = (model, days) => !!(model && S(model.canonical_host) && ageDays(model) < (Number(days) > 0 ? Number(days) : FRESH_DAYS));
  // exactly the seo_sites columns the model owns (plus the two keys), ready to merge into a site row or a cache value
  const COLUMNS = ['site_id', 'domain', 'canonical_host', 'business_name', 'logo_url', 'nap_json', 'services_json', 'nav_pages_json', 'business_facts', 'cta', 'brand_names', 'competitors', 'accreditation', 'model_updated_at'];
  const toRow = (model) => { const m = model || {};
    return { site_id: S(m.site_id), domain: S(m.domain), canonical_host: S(m.canonical_host), business_name: S(m.business_name), logo_url: S(m.logo_url),
      nap_json: JSON.stringify(nap(m)), services_json: JSON.stringify(services(m)), nav_pages_json: JSON.stringify((m.nav_pages || []).map(p => ({ url: p.url, title: p.title }))),
      business_facts: S(m.business_facts).slice(0, 2000), cta: S(m.cta).slice(0, 200), brand_names: (m.brand_names || []).join(', ').slice(0, 500),
      competitors: (m.competitors || []).join(', ').slice(0, 500), accreditation: S(m.accreditation).slice(0, 200), model_updated_at: S(m.model_updated_at) };
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
    decay_basis: S(p.decay_basis).slice(0, 900), measured_at: S(p.measured_at) }));
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
  return { from, stored, siteUrl, apiTarget, name, nap, services, pages, facts, matchPage, withPages, toRow, pageRows, COLUMNS, isFresh, ageDays, FRESH_DAYS, MATCH_MIN,
    titleShare, titleGap, canonUrl, isListing, pageScore, pageStep,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml, matchTerms } };
})();
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
const CONFIG = { max_sites_per_run: 15, sequences_per_week: 10, monthly_days: 25, qualify_per_week: 25 };
const { list, on_demand, want, total, cycle, cycle_why } = monitorSites('links');   // `trigger` comes from the shared snippet
if (!list.length) return [{ json: { nothing_to_do: true, cycle, reason: cycle ? (cycle_why || 'nothing to run for this cycle') : on_demand ? 'no site matches "' + want + '"' : (total ? 'the Link Builder is switched off for every site' : 'no sites yet') } }];
const cycleRows = rowsOf('Load Cycles');   // 2026-10-19: each website's time zone
const prospects = rowsOf('Load Link Prospects'), outreach = rowsOf('Load Link Outreach'), ladders = rowsOf('Load Ladders'), logs = rowsOf('Load Content Log'), snaps = rowsOf('Load Backlink Snapshots');
const profiles = rowsOf('Load Profiles'), cache = rowsOf('Load Cache (Links)'), targets = rowsOf('Load AI Targets'), ledger = rowsOf('Load Backlinks'), queries = rowsOf('Load Query History'), ranks = rowsOf('Load Rank History');
// R93 (2026-10-16, re-rating 2026-10-15): the site's page inventory (seo_pages: each page's real <title> / H1). A target page used to be named
// by the first Search Console query of the page — 13 of 16 targets in exec 628 had a query as their "title", so the writer's anchor hint
// "title" meant an exact-match keyword link, against the product's own "brand / title / URL, never a keyword" rule.
const invRows = rowsOf('Load Pages (LB)').filter(r => r.url);
const now = new Date(); const iso = now.toISOString();
const parse = (t, d) => { try { return JSON.parse(t || ''); } catch (e) { return d; } };
const countryOf = (code) => { const e = Object.entries(typeof COUNTRIES === 'object' ? COUNTRIES : {}).find(([, c]) => Number(c.code) === Number(code)); return e ? { name: e[0], iso: String(e[1].iso || '').toUpperCase() } : { name: '', iso: '' }; };
const STOP = /^(the|and|for|with|from|your|our|best|top|how|what|why|guide|services?|company|solutions?|in|of|to|a|an|uae|dubai|near|me)$/i;
const days = (d) => d ? (now.getTime() - new Date(d).getTime()) / 864e5 : 1e9;
const pathKey = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
return list.slice(0, CONFIG.max_sites_per_run).map(s => {
  const free_only = on_demand && /^(true|1|yes|on)$/i.test(String(trigger.free_only ?? ''));
  const st = parse((cache.find(c => c.key === 'linkbld:' + s.site_id) || {}).value, {}) || {};
  const due = (k) => on_demand || days(st[k]) >= CONFIG.monthly_days;
  const lastFull = snaps.filter(x => x.site_id === s.site_id && x.mode === 'full').sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0];
  const kept = lastFull ? (parse(lastFull.competitors_json, []) || []).map(c => c.domain).filter(Boolean) : [];
  const competitors = (s.settings.competitors.length ? s.settings.competitors : kept).slice(0, 3);
  // R4 (2026-10-13): who the site actually competes with in the results, read from the rank checks of the last 90 days
  // (seo_rank_history.competitors_json, written by _rank_serp.js: `above` = the domains ahead of us, `competitors` = the top 10). Only the
  // qualification gate uses this list; the pitches still name the up-to-3 declared competitors.
  // R21 (2026-10-14): the host the results page showed is kept, but the list is keyed on the REGISTRABLE domain - ae.invoiceq.com ranked
  // above us for "peppol uae" and invoiceq.com was pitched anyway. And a row whose competitors_json was cut to the column limit mid-JSON
  // (RS.pack truncates an over-long snapshot) is still read: the hosts and their positions are picked out of the text that is there.
  const rivalHosts = (raw) => {
    const c = parse(raw, null);
    if (c && typeof c === 'object') return [...(c.above || []), ...(c.competitors || [])]
      .map(x => ({ host: String((x && (x.d || x.domain)) || ''), position: Number(x && (x.p || x.position)) || 0 }));
    return [...String(raw || '').matchAll(/"(?:d|domain)"\s*:\s*"([^"]+)"(?:\s*,\s*"(?:p|position)"\s*:\s*(\d+))?/g)]
      .map(m => ({ host: m[1], position: Number(m[2]) || 0 }));
  };
  const serp_rivals = (() => {
    const cut = new Date(Date.now() - 90 * 864e5).toISOString(); const byDom = new Map();
    for (const h of ranks.filter(r => normD(r.domain) === s.domain && String(r.checked_at || '') >= cut)) {
      for (const x of rivalHosts(h.competitors_json)) {
        const host = String(x.host || '').toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
        const dom = LK.regDomain(host); const pos = Number(x.position) || 0;
        if (!host || !dom || dom === LK.regDomain(s.domain) || !/\./.test(dom)) continue;
        const was = byDom.get(dom);
        if (!was || (pos > 0 && (!was.position || pos < was.position))) byDom.set(dom, { domain: dom, host, position: pos || (was && was.position) || 0, keyword: String(h.keyword || '') });
      }
    }
    return [...byDom.values()].sort((a, b) => (a.position || 99) - (b.position || 99)).slice(0, 40);
  })();
  // C-2 / C-8 (re-rating 2026-10-17): the businesses AI recommends instead of the site (the AI Visibility Tracker's stored rivals and the
  // Answer Analyst's learned names) are rivals here too - pactsoft.ae ("PACT REVENU") and the vendors AI cited were qualified as prospects
  const ai_rivals = (() => { let vis = [], cacheAi = []; try { vis = $('Load AI Visibility (LB)').all().map(i => i.json).filter(r => r && r.site_id); } catch (e) {}
    try { cacheAi = $('Load Cache (LB Rivals)').all().map(i => i.json).filter(r => r && r.key); } catch (e) {}
    return RV.aiRivals({ site_id: s.site_id, own: s.domain, vis_rows: vis, cache_rows: cacheAi }); })();
  const pr = profiles.find(x => x.site_id === s.site_id) || {};
  const lad = ladders.filter(l => normD(l.domain) === s.domain);
  const topics = [...new Set([...lad.map(l => l.head_keyword || l.keyword), ...(s.keywords || []), pr.business_type].map(x => String(x || '').trim().toLowerCase()).filter(x => x && x.split(/\s+/).some(w => !STOP.test(w))))].slice(0, 4);
  const c = countryOf(s.location_code);
  // our pages: published ladder pages, AI answer pages, written pages, the top Search Console pages, the homepage
  const site_model = SM.stored(s) || { domain: s.domain, canonical_host: s.domain };   // D15: our page links are on the canonical host
  const home = SM.siteUrl(site_model, '/');
  // D13: the business name comes from the one site model (profile -> the homepage's og:site_name / Organization name -> what the app sent),
  // never from the domain label — pitches signed "techand" went out for Tech& (live 2026-10-11). With no name on file the pitches carry a
  // bracket for the owner instead of a guess.
  const bn = String(pr.business_name || '').trim();
  const modelName = SM.name(site_model);
  const named = (bn && bn.toLowerCase() !== 'home') ? bn : (modelName && SM.helpers.bare(modelName) !== site_model.domain ? modelName : '');
  const brand = named || s.domain; const brand_known = !!named;
  const services = SM.services(site_model); const accreditation = SM.facts(site_model).accreditation;
  // every URL of ours is served on the canonical host (D15): Search Console and the ladder rows mix www and the bare host
  const ourUrl = (u) => { const h = String((String(u || '').match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '').toLowerCase().replace(/^www\./, '');
    return h && h === s.domain ? SM.siteUrl(site_model, String(u).replace(/^https?:\/\/[^\/?#]*/i, '')) : u; };
  const myQ = queries.filter(q => q.site_id === s.site_id && q.page);
  const lastPeriod = myQ.map(q => String(q.period_end || '')).sort().pop() || '';
  const posOf = new Map(); const imp = new Map();
  for (const q of myQ.filter(q => String(q.period_end) === lastPeriod)) { const k = pathKey(q.page); const i = Number(q.impressions) || 0; const p = Number(q.position) || 0; if (!p) continue;
    imp.set(k, (imp.get(k) || 0) + i); posOf.set(k, (posOf.get(k) || 0) + p * Math.max(1, i)); }
  const posFor = (u, kw) => { const k = pathKey(u); if (imp.has(k)) return Math.round(10 * posOf.get(k) / Math.max(1, imp.get(k))) / 10;
    const r = ranks.filter(h => h.keyword === kw && Number(h.position) > 0).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0]; return r ? Number(r.position) : 0; };
  const myLedger0 = ledger.filter(l => l.site_id === s.site_id && l.status !== 'lost' && l.kind !== 'social');
  const farms = LK.footprints(myLedger0, { domain: s.domain, brands: [brand, ...(s.settings.brand_names || [])].filter(Boolean) });   // link-farm pages count as no link (D3), whatever an older ledger row says
  const myLedger = myLedger0.filter(l => l.link_type !== 'spam' && !farms.has(l.ref_domain));
  const rdsTo = (u) => { const k = pathKey(u); const set = new Set(); for (const l of myLedger) if (pathKey(l.to_url) === k) set.add(l.ref_domain + (l.rel === 'follow' ? '' : '~')); let n = 0; for (const x of set) n += x.endsWith('~') ? 0.5 : 1; return n; };
  const kwShare = (u) => { const k = pathKey(u); const mine = myLedger.filter(l => pathKey(l.to_url) === k && l.anchor_kind); return mine.length ? mine.filter(l => l.anchor_kind === 'money').length / mine.length : 0; };
  // 2026-10-19: "this month" is the website's own month (its time zone), not the UTC one - a pitch drafted on the 31st at 21:00 in New York
  // belongs to that month, not the next
  const tz = ST.tzOf(cycleRows, s); const month = ST.monthKey(now, tz);
  const pitched = (u) => outreach.filter(o => o.site_id === s.site_id && pathKey(o.target_url) === pathKey(u) && o.drafted_at && ST.monthKey(o.drafted_at, tz) === month).length;
  const pages = [];
  // R93: a page's title is its own title — the inventory's <title> / H1, else the menu text the site model read — never a search query.
  // A page whose title is not on record gets none (the writer then offers the brand as link text); the query stays its `keyword`.
  const invTitle = new Map(invRows.filter(r => r.site_id === s.site_id || normD(r.url) === s.domain).map(r => [pathKey(r.url), String(r.title || r.h1 || '').trim()]));
  for (const n of (site_model.nav_pages || [])) { const k = pathKey(SM.siteUrl(site_model, n.path || '/')); if (n.title && !invTitle.get(k)) invTitle.set(k, String(n.title)); }
  const realTitle = (u) => invTitle.get(pathKey(ourUrl(u))) || '';
  const addPage = (url0, title, keyword, kind, page_type) => { const url = ourUrl(url0); if (!url || pages.some(p => pathKey(p.url) === pathKey(url))) return; pages.push({ url, title: String(realTitle(url) || (kind === 'home' ? title : '') || '').slice(0, 140), keyword: String(keyword || '').slice(0, 100), kind, page_type: page_type || '',
    position: posFor(url, keyword), rds: rdsTo(url), kw_share: Math.round(100 * kwShare(url)) / 100, pitched: pitched(url) }); };
  addPage(home, brand, brand, 'home');
  for (const l of lad.filter(l => l.target_url && (l.status === 'published' || l.page_exists === true || l.page_exists === 'true')).sort((a, b) => (Number(b.rung) || 0) - (Number(a.rung) || 0)))
    addPage(l.target_url, l.keyword, l.keyword, Number(l.rung) === 4 ? 'hub' : /service|product|landing|pricing/i.test(l.page_type || '') ? 'money' : 'guide', l.page_type);
  for (const t of targets.filter(t => t.site_id === s.site_id && t.page_url && ['won', 'writing', 'written', 'done'].includes(String(t.status || '')))) addPage(t.page_url, t.question, t.keyword || t.question, 'answer');
  for (const l of logs.filter(l => normD(l.domain) === s.domain && l.published_url)) addPage(l.published_url, l.keyword, l.keyword, /service|product|landing/i.test(l.page_type || '') ? 'money' : 'article', l.page_type);
  // R93: a Search Console page is named by its real title (or none); its strongest TOPICAL query is its keyword — a navigational query
  // ("techandkey com": a domain typed as a search) says nothing about the page's topic and is skipped when another query exists
  const navQ = (q) => /\b(com|net|org|www|ae|io|ai)\b/.test(String(q || '').toLowerCase()) && String(q || '').trim().split(/\s+/).length <= 3;
  for (const [k, n] of [...imp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) { const qs = myQ.filter(x => pathKey(x.page) === k && String(x.period_end) === lastPeriod).sort((a, b) => (Number(b.impressions) || 0) - (Number(a.impressions) || 0));
    const q = qs.find(x => !navQ(x.query)) || qs[0]; addPage(q.page, '', q.query, 'page'); }
  const mineP = prospects.filter(p => p.site_id === s.site_id);
  const mineO = outreach.filter(o => o.site_id === s.site_id);
  return { json: { site_id: s.site_id, domain: s.domain, country: s.country || c.name || '', country_iso: c.iso, location_code: Number(s.location_code) || 2840, language_code: s.language_code || 'en',
    email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '', on_demand, free_only, competitors, serp_rivals, ai_rivals, topics, brand, brand_known, services, accreditation,
    brand_names: [...new Set([brand, named, ...s.settings.brand_names, s.domain.split('.')[0].length >= 5 ? s.domain.split('.')[0] : ''].filter(Boolean))],
    profile: { business_name: bn, business_type: pr.business_type || '', author_name: pr.author_name || '', author_job_title: pr.author_job_title || '', street_address: pr.street_address || '', city: pr.city || '', region: pr.region || '',
      postal_code: pr.postal_code || '', country_code: pr.country_code || c.iso || '', phone: pr.phone || '', public_email: pr.public_email || '', logo_url: pr.logo_url || '' },
    pages, home, canonical_host: site_model.canonical_host || s.domain, budget: CONFIG.sequences_per_week, qualify_max: CONFIG.qualify_per_week,
    due: { listings: due('listings_at'), resources: due('resources_at'), wayback: due('wayback_at'), broken: due('broken_at') && !free_only, press: true,
      podcasts: due('podcasts_at'), assets: due('assets_at') && !free_only },   // L5: podcast shows (free, monthly). L6: the asset ideas read from the competitors' most-linked pages (DataForSEO domain_pages, monthly, ~$0.02 a competitor)
    state: st, prospects_open: mineP.filter(p => (p.status || 'new') === 'new').length, outreach_rows: mineO.length, checked_at: iso, cycle, tz, month } };
});
