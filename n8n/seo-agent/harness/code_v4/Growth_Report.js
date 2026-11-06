// AI Growth report per site (e-mail / callback stage ai_growth; v4.12): done for you this week, what to do (ranked, with drafts), page readiness,
// the earned-media list, the questions queued for writing, the entity check.
// G29 (2026-10-13, FIX_PLAN): every figure group says where it came from, over what period and from how big a sample (LN).
// ---- shared report helpers (inlined by the build): the same look as the Site Tracker report ----
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v) => (Number(v) || 0).toLocaleString('en-GB');
const td = 'style="padding:4px 8px;border:1px solid #cbd5e1;font-size:13px;vertical-align:top"', th = 'style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left;font-size:12px"';
const table = (headers, rows, empty) => rows.length ? '<table style="border-collapse:collapse;margin:6px 0;max-width:100%">' + '<tr>' + headers.map(h => '<th ' + th + '>' + esc(h) + '</th>').join('') + '</tr>' + rows.map(r => '<tr>' + r.map(c => '<td ' + td + '>' + c + '</td>').join('') + '</tr>').join('') + '</table>' : '<p style="color:#64748b;font-size:13px">' + esc(empty || 'nothing to show') + '</p>';
const tile = (label, value, delta, color) => '<td style="padding:8px 12px;border:1px solid #e2e8f0;min-width:110px;vertical-align:top"><div style="font-size:11px;color:#64748b;text-transform:uppercase">' + esc(label) + '</div><div style="font-size:20px;font-weight:700">' + value + '</div><div style="font-size:12px;color:' + (color || '#475569') + '">' + delta + '</div></td>';
const h3 = (t) => '<h3 style="margin:18px 0 4px;font-size:15px;color:#0f172a">' + esc(t) + '</h3>';
const p_ = (t, muted) => '<p style="margin:4px 0;font-size:13px' + (muted ? ';color:#64748b' : '') + '">' + t + '</p>';
const pathOf = (u) => { const p = String(u || '').replace(/^https?:\/\/[^\/]+/i, ''); return p || '/'; };
const link = (u, label) => u ? '<a href="' + esc(u) + '" style="color:#1d4ed8">' + esc(label || pathOf(u)) + '</a>' : '—';
const dpts = (v) => v == null ? '' : (v > 0 ? '<span style="color:#15803d">▲ ' + v + ' pts</span>' : v < 0 ? '<span style="color:#b91c1c">▼ ' + Math.abs(v) + ' pts</span>' : 'no change');
const briefBox = (b) => b ? '<div style="background:#f8fafc;border-left:4px solid #1d4ed8;padding:10px 12px;margin:8px 0"><div style="font-weight:700;font-size:15px">' + esc(b.headline) + '</div><p style="margin:6px 0 0;font-size:13px">' + esc(b.summary) + '</p></div>' : '';
const alertBox = (alerts) => (alerts || []).length ? '<div style="background:#fef2f2;border-left:4px solid #b91c1c;padding:8px 12px;margin:8px 0">' + alerts.map(a => '<div style="font-size:13px">⚠ ' + esc(a.text || a) + '</div>').join('') + '</div>' : '';
const wrapDoc = (title, body) => '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title></head><body style="margin:24px">' + body + '</body></html>';
const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');

// ---- lineage (G29, 2026-10-13, system review FIX_PLAN.md; CRITERIA_technical_tracking_reporting_ai_links.md 3.11) ----
// Every number a customer reads has to say where it came from, over what period, and how big the sample was. Before this, the AI
// visibility report said it (sample sizes, Wilson ranges) and the others did not: the weekly report printed "1,240 impressions" and
// "#8" side by side without saying that one is a 28-day Search Console count and the other one live sample of one results page.
// LN.of() carries that as structured fields next to the value (`source`, `period`, `sample`, `basis`), LN.note() turns them into one
// short line for a tooltip or a footnote, and LN.block() prints the whole list under a report as "Where these numbers come from".
// Rules: the vocabulary is the one the rest of the system already uses (G6 "modelled, not measured clicks", G8 `calibrated` /
// `modelled` / `unknown`, G28 statistical ranges, G26 `impact_basis`) - this kit makes it universal, it does not invent a second
// scheme. A modelled or uncalibrated number must say so. Where lineage is genuinely unknown the note reads "source not recorded":
// never a guessed source.
const LN = (() => {
  const MISSING = 'source not recorded';
  // where numbers come from. `label` is what a customer reads, `how` the one sentence about what that source can and cannot see.
  const SOURCES = {
    gsc: { label: 'Google Search Console', how: 'Google\'s own count of the impressions and clicks it served; the last 3 days are not final, and figures are averages across devices and locations' },
    gsc_history: { label: 'your stored Search Console history', how: 'the weekly Search Console readings we have kept for this site' },
    inspection: { label: 'Search Console URL Inspection', how: 'Google\'s own answer about one URL at the moment it was asked' },
    gsc_links: { label: 'your Search Console link export', how: 'the sample of links Google shows you; it is a sample, not the whole list' },
    ga4: { label: 'Google Analytics 4', how: 'visits measured on your site by your own GA4 property' },
    serp: { label: 'a live Google results page', how: 'one results page read through DataForSEO at that moment, from one country and one device' },
    kwdata: { label: 'Google Ads keyword data (through DataForSEO)', how: 'the provider\'s monthly search volume and cost per click; a provider estimate for a single keyword, not a measurement of your site' },
    backlink_index: { label: 'the DataForSEO backlink index', how: 'one crawler\'s index of the web: it finds much of the web, never all of it' },
    bing: { label: 'Bing Webmaster Tools', how: 'Bing\'s own figures for the site it has verified' },
    link_graph: { label: 'the Common Crawl web graph', how: 'a public crawl of the web, released every few months' },
    ahrefs: { label: 'the Ahrefs Domain Rating API', how: 'Ahrefs\' own 0-100 rating of a domain' },
    trends: { label: 'Google Trends', how: 'a relative index of search interest (100 = the peak of the period), not a count of searches' },
    ai_engines: { label: 'the AI assistants themselves', how: 'the answers ChatGPT, Gemini, Google AI Mode and the others gave to the questions in your panel' },
    ai_db: { label: 'the DataForSEO AI-answer database', how: 'a database of AI answers and the brands they name' },
    own_check: { label: 'our own fetch of the page', how: 'we requested the page ourselves and read what came back' },
    draft: { label: 'the finished draft itself', how: 'counted in the text this run wrote, before anybody published it' },
    crawl: { label: 'our crawl of your website', how: 'the pages we could reach and read on your site' },
    crux: { label: 'the Chrome User Experience Report', how: 'speed as real Chrome visitors experienced it over 28 days' },
    pagespeed: { label: 'Google PageSpeed Insights (Lighthouse)', how: 'one simulated mobile load in a lab, not what your visitors felt' },
    rdap: { label: 'the domain registry (RDAP, else WHOIS)', how: 'the registry\'s own record of when a domain was registered' },
    gbp: { label: 'Google Business Profile', how: 'the public listing Google holds for the business' },
    wikidata: { label: 'Wikidata', how: 'the public knowledge base search engines read' },
    web: { label: 'public web pages we read', how: 'pages we fetched and quoted; nothing behind a login' },
    you: { label: 'what you told us', how: 'the business profile, the monthly check-in or the forms you filled in' },
    model: { label: 'a model on top of measured data', how: 'computed from measured numbers with a published formula, not measured itself' },
    none: { label: MISSING, how: 'this figure reached the report without its source: treat it as unverified' },
  };
  // how the figure was arrived at. The words are the ones G6 / G8 / G28 already use.
  const BASIS = {
    measured: 'measured',
    calibrated: 'calibrated against your own measured data',
    modelled: 'modelled, not measured',
    one_sample: 'one sample, not an average',
    estimated: 'estimated',
    reported: 'reported by the source',
    unknown: MISSING,
  };
  const S = (v) => String(v == null ? '' : v);
  const fmt = (v) => (Number(v) || 0).toLocaleString('en-GB');
  const esc1 = (s) => S(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const src = (k) => SOURCES[k] || SOURCES.none;
  // "2026-09-15 to 2026-10-12 (28 days)" - the period a figure covers, never an empty string
  const range = (r, label) => { const o = r || {}; const a = S(o.start), b = S(o.end);
    if (!a && !b) return label ? S(label) : 'period not recorded';
    if (a && b) { const d = Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 864e5) + 1;
      return a + ' to ' + b + (Number.isFinite(d) && d > 0 ? ' (' + d + ' day' + (d === 1 ? '' : 's') + ')' : ''); }
    return 'to ' + (b || a); };
  const asOf = (at) => { const d = S(at).slice(0, 10); return d ? 'as of ' + d : 'date not recorded'; };
  const days = (n, end) => (Number(n) || 0) + ' days' + (S(end).slice(0, 10) ? ' to ' + S(end).slice(0, 10) : '');
  const sample = (n, unit) => (n == null || n === '' || !Number.isFinite(Number(n))) ? 'sample not recorded' : fmt(n) + (unit ? ' ' + S(unit) : '');
  // one figure's lineage, as structured fields beside the value
  const of = (figure, source, o) => { const x = o || {}; const key = SOURCES[source] ? source : 'none';
    const basis = BASIS[x.basis] ? x.basis : (key === 'none' ? 'unknown' : 'measured');
    return { figure: S(figure), source: key, source_label: src(key).label, source_how: src(key).how,
      period: S(x.period) || 'period not recorded', sample: x.sample == null ? 'sample not recorded' : S(x.sample),
      basis, basis_label: BASIS[basis], note: S(x.note) };
  };
  // a figure whose source nobody recorded: say exactly that instead of inventing one
  const unknown = (figure, why) => ({ figure: S(figure), source: 'none', source_label: MISSING, source_how: src('none').how,
    period: '', sample: '', basis: 'unknown', basis_label: MISSING, note: S(why) });
  // "Google Search Console · 2026-09-15 to 2026-10-12 (28 days) · 1,240 impressions · measured"
  const note = (l) => { const x = l || {}; const lbl = x.source_label || MISSING;
    return [lbl, x.period, x.sample, x.basis_label === lbl ? '' : x.basis_label, x.note].filter(Boolean).join(' · '); };
  const isHonest = (l) => !!l && (l.basis !== 'unknown' || note(l).indexOf(MISSING) >= 0);
  // ---- the evidence half of the same rule (R10, promoted to the class by lineage_lint.py, 2026-10-15) ----
  // A finding is a figure like any other: it may not be shown without the thing that shows it. R10 was exactly this - Google
  // retired the Mobile Usability report, the API answered VERDICT_UNSPECIFIED for every page, and the audit raised a HIGH finding
  // on 45 of 47 pages whose evidence string was "/:  | /whatwedo/ai-automation: " - punctuation and nothing else. So the test is
  // not `evidence !== ''`: a string that is only separators, brackets or a bare "0" carries no evidence either.
  const hasEvidence = (f) => {
    const ev = S((f || {}).evidence).replace(/<[^>]*>/g, ' ');     // markup is not evidence
    return /[A-Za-z]|[1-9]/.test(ev.replace(/[\s;|,.:·\-–—()\[\]\/]+/g, ' '));
  };
  // the findings that may be shown, and the titles of the ones held back. `allow` names a title that is evidence in itself
  // (a count in the title, a note about data that could not be collected); everything else has to carry its own.
  const unevidenced = (list, o) => { const x = o || {}; const allow = (x.allow || []).map(S);
    return (list || []).filter(f => f && !hasEvidence(f) && allow.indexOf(S(f.title)) < 0).map(f => S(f.title || f.id || 'untitled')); };
  const evidenced = (list, o) => { const x = o || {}; const allow = (x.allow || []).map(S);
    const keep = (list || []).filter(f => f && (hasEvidence(f) || allow.indexOf(S(f.title)) >= 0));
    if (typeof x.onDrop === 'function') { const d = unevidenced(list, o); if (d.length) x.onDrop(d); }
    return keep; };
  const evidenceNote = (dropped) => (dropped || []).length
    ? (dropped.length + ' finding(s) were left out because nothing was measured to show them: ' + dropped.slice(0, 5).join(', ')) : '';
  const html = (l) => '<span style="color:#64748b;font-size:11px">' + esc1(note(l)) + '</span>';
  const line = (l) => '<div style="color:#64748b;font-size:11px;margin-top:2px">' + esc1(note(l)) + '</div>';
  // the block under a report: one row per figure, so no number is left without a source, a period and a sample
  const block = (list, o) => { const rows = (list || []).filter(Boolean); const x = o || {};
    const td = 'style="padding:3px 8px;border:1px solid #cbd5e1;font-size:11px;vertical-align:top;color:#334155"';
    const th = 'style="padding:3px 8px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left;font-size:11px"';
    if (!rows.length) return '';
    return '<h3 style="margin:18px 0 4px;font-size:13px;color:#0f172a">' + esc1(x.title || 'Where these numbers come from') + '</h3>'
      + '<table style="border-collapse:collapse;margin:4px 0;max-width:100%">'
      + '<tr><th ' + th + '>Figure</th><th ' + th + '>Source</th><th ' + th + '>Period</th><th ' + th + '>Sample</th><th ' + th + '>How it was arrived at</th></tr>'
      + rows.map(l => '<tr><td ' + td + '>' + esc1(l.figure) + '</td><td ' + td + '>' + esc1(l.source_label) + '</td><td ' + td + '>' + esc1(l.period || '-')
        + '</td><td ' + td + '>' + esc1(l.sample || '-') + '</td><td ' + td + '>' + esc1([l.basis_label, l.note].filter(Boolean).join(': ')) + '</td></tr>').join('')
      + '</table><p style="color:#64748b;font-size:11px;margin:4px 0">' + esc1(x.footer || 'A figure marked "' + BASIS.modelled + '" is computed, not counted; "' + MISSING + '" means the figure reached this report without its source and should be treated as unverified.') + '</p>';
  };
  return { of, unknown, note, html, line, block, range, asOf, days, sample, isHonest, hasEvidence, evidenced, unevidenced,
    evidenceNote, SOURCES, BASIS, MISSING };
})();
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
// ---- AIRC: the AI ranking plan in the client's words (FX-C RC-1, 2026-11-06; inlined by build_monitors.py through its marker) ----
// The weekly memo of the AI ranking plan (ARL.memo, v5/code/_ai_rank_learn.js) is written for the owner's review: question ids, stage codes,
// statistics, the model's own figures and provider dollars. A client never reads it. This kit turns it into five short sections a client
// reads: what changed, why it moved ("likely helped" / "can't tell yet"), whether our steps worked, what we did and what we need from them.
// It reads only the memo's documented line shapes; a line it does not recognise is left out (never printed raw). No money: the number of
// questions won and the raw spend travel apart (`wins`, `spend_usd`) so the app can show credits; `spend_usd` is stripped before any
// customer sees a payload (app/shared/src/agency.ts clientSafePayload). The app mirror is app/shared/src/ai-rank-client.ts (its test runs
// this file and requires the same output for the same memo).
// Pure: no node access, no clock, no network; n8n sandbox rules (no URL constructor, no defineProperty, no structuredClone).
const AIRC = (() => {
  const S = (v) => (v == null ? '' : String(v)).trim();
  // the engine's lever names (ARL.LEVERS labels), as ARL writes them into the memo; harness AE5 holds this list equal to ARL.LEVERS
  const ENGINE_LABELS = { L01: 'Unblock AI bots in robots.txt', L02: 'Content in raw HTML (server render)', L03: 'Add the site to Bing Webmaster and submit', L04: 'Get the page indexed in Google', L05: 'Own answer page for the searches the engines run', L06: 'Refresh the ranking page for the searches the engines run', L07: 'Cited but not named: fix the passage', L08: 'Placement on an editorial list the answers cite', L09: 'Directory profile on a directory the answers cite', L10: 'Registry or partner listing (eligible only)', L11: 'Earned mention (press, partner, customer case)', L12: 'LinkedIn article by a named person', L13: 'Disclosed community answer', L14: 'Video for the question', L15: 'Correction (own page or ask the source)', L16: 'Protect a cited page; refresh it when citations decay', L17: 'Wikidata / Wikipedia entity' };
  // the client's words for each lever (equal to app/shared/src/ai-rank.ts AI_RANK_LEVER_LABELS; the app's test holds them equal)
  const LABELS = { L01: 'Let AI assistants read your website', L02: 'Put the page text in the page itself, not only in scripts', L03: 'Add your website to Bing Webmaster Tools', L04: 'Get the page into Google', L05: 'A new page that answers the question', L06: 'Refresh the page that ranks for the question', L07: 'Name your business in the passage AI answers quote', L08: 'Get onto a list that AI answers cite', L09: 'A profile on a directory that AI answers cite', L10: 'A registry or partner listing you qualify for', L11: 'Be mentioned in the press, by a partner or a customer', L12: 'A LinkedIn article by a named person', L13: 'An answer in a community, saying who you are', L14: 'A short video that answers the question', L15: 'Correct a wrong claim about your business', L16: 'Keep a page AI answers cite, and refresh it when they stop', L17: 'A Wikidata entry for your business' };
  const LEVER_OF_LABEL = {}; for (const k of Object.keys(ENGINE_LABELS)) LEVER_OF_LABEL[ENGINE_LABELS[k]] = k;
  const label = (lever) => LABELS[S(lever)] || 'A step to get you named in AI answers';
  // where a question stands in one assistant's answers (ARL stage codes), in plain words
  const STAGE = { S0: 'the assistant could not read your website', S1: 'not in the answer', S2: 'your website comes up but is not linked', S3: 'linked but not named', S4: 'named, but weakly or wrongly', S5: 'clearly named', unmeasured: 'not measured' };
  const ENGINES = { 'ChatGPT (API)': 'ChatGPT' };
  const engine = (e) => ENGINES[S(e)] || S(e);
  const WHO = { auto: 'we do it', approve: 'you approve it, we do it', human: 'you do it, we check it' };
  const STATUS = { proposed: 'proposed', queued: 'queued', in_progress: 'in progress', done: 'done', verified: 'confirmed', not_happened: 'did not happen', expired: 'expired', refused: 'not done', shadow: 'trial only' };
  const OPEN = ['proposed', 'queued', 'in_progress'];
  const VERDICT = { 'likely helped': 'likely helped', "can't tell": "can't tell yet", 'no effect seen': 'no change seen yet', 'did not happen': 'the step did not happen', 'not due yet': 'too early to tell' };
  /** a free text (an action's why, a blocker) without ids, stage codes, money, the internal name or the model's figures */
  const plain = (v) => S(v)
    .replace(/[–—]/g, '-').replace(/[‘’]/g, '\'').replace(/[“”]/g, '"').replace(/…/g, '...')
    .replace(/\s*\([^()]*(?:chance|model|prior|bootstrap|fisher|p ?=|own-page|notability)[^()]*\)/gi, '')
    .replace(/\bnotability gate\b/gi, 'the bar for an encyclopedia entry')
    .replace(/\b(?:aip|air|ait|lad|cad)_[A-Za-z0-9_.:-]+/g, '').replace(/\bAIR'?s?\b/g, 'AI ranking').replace(/\bS[0-5]\b/g, '')
    .replace(/(?:US)?\$\s?\d[\d,]*(?:\.\d+)?/g, '').replace(/\s+([,.;:])/g, '$1').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
  const qWords = (q, ctx) => { const t = S(ctx && typeof ctx.question === 'function' ? ctx.question(q) : ''); return t ? '"' + plain(t) + '"' : 'One of your tracked questions'; };
  const lineOf = (l) => (l && typeof l === 'object' ? l : { text: S(l), figures: [] });
  const fig = (l, name) => { const f = (lineOf(l).figures || []).find(x => x && S(x.name) === name); return f ? f.value : undefined; };
  const num = (v) => { const n = Number(v); return v == null || S(v) === '' || !Number.isFinite(n) ? null : n; };

  /** memo (ARL.memo) + ctx -> { v, sections: [{ key, title, lines: [text] }], wins, spend_usd }
   *  ctx: { question(id) -> text, leverOf(actionId) -> lever, actions: [{ lever, executor, status, url }] } */
  const view = (memo, ctx) => { const m = memo && typeof memo === 'object' ? memo : {}; const c = ctx || {};
    const part = (k) => ((m.parts || []).find(p => p && p.key === k) || {}).lines || [];
    const changed = [], why = [], worked = [], did = [], you = [];
    for (const l0 of part('what_changed')) { const t = S(lineOf(l0).text); let x;
      if (t === 'No diagnosis this week.') changed.push('No new reading of your questions this week.');
      else if (/^This is the first reading/.test(t)) changed.push('This is the first week we read your questions, so there is nothing to compare with yet.');
      else if (t === 'No question changed stage this week.') changed.push('No question moved this week.');
      else if ((x = t.match(/^(.+?): found on (\d+) of (\d+) questions \(last week (\d+)\), won on (\d+) \(last week (\d+)\)\.$/)))
        changed.push(engine(x[1]) + ': your website comes up for ' + x[2] + ' of ' + x[3] + ' questions (' + x[4] + ' last week), and you are clearly named for ' + x[5] + ' (' + x[6] + ' last week).');
      else if ((x = t.match(/^Question (\S+) on (.+?): (up|down) from /))) { const from = STAGE[S(fig(l0, 'from'))], to = STAGE[S(fig(l0, 'to'))]; if (!from || !to) continue;
        changed.push(qWords(x[1], c) + ' on ' + engine(x[2]) + ': moved ' + x[3] + ', from ' + from + ' to ' + to + '.'); } }
    for (const l0 of part('why')) { const t = S(lineOf(l0).text); let x;
      if (/^Nothing moved up/.test(t)) { why.push('Nothing moved up this week.'); continue; }
      if (!(x = t.match(/^Question (\S+) on (.+?): (.+)$/))) continue; const head = qWords(x[1], c) + ' on ' + engine(x[2]) + ': ';
      const aid = S(fig(l0, 'attributed_to')); const bg = /background/.test(x[3]);
      if (aid) { const lv = S(typeof c.leverOf === 'function' ? c.leverOf(aid) : '') || LEVER_OF_LABEL[(x[3].match(/after "([^"]+)"/) || [])[1]] || '';
        why.push(head + (bg ? 'can\'t tell yet. It moved after our step "' + label(lv) + '", but questions we did not work on moved the same way.' : 'likely helped by our step "' + label(lv) + '".')); }
      else why.push(head + (bg ? 'it moved on its own: questions we did not work on moved the same way.' : 'it moved without a step of ours.')); }
    for (const l0 of part('projected_vs_real')) { const t = S(lineOf(l0).text); let x;
      if (/^No action has reached the end of its window yet/.test(t)) { worked.push('It is too early to tell whether our steps worked: each one is judged after a few weeks of answers, against questions we did not work on.'); continue; }
      if (!(x = t.match(/^(.+?): we projected .*Verdict: (.+)\.$/))) continue; const lv = LEVER_OF_LABEL[x[1]]; const v = VERDICT[S(x[2])]; if (!v) continue;
      worked.push(label(lv) + ': ' + v + '.'); }
    const acts = (Array.isArray(c.actions) ? c.actions : []).filter(a => a && S(a.lever));
    for (const a of acts) { const st = S(a.status); const ex = S(a.executor) === 'auto' || S(a.executor) === 'approve' ? S(a.executor) : 'human';
      const what = label(a.lever) + (S(a.url) ? ': ' + S(a.url) : '');
      if (ex === 'human') { if (!st || OPEN.includes(st)) you.push(what + ' (you do it, we check it).'); else did.push(what + ' (' + (STATUS[st] || plain(st).replace(/_/g, ' ')) + ').'); }
      else if (ex === 'approve' && (!st || st === 'proposed')) you.push(what + ' (you approve it, we do it).');
      else did.push(what + ' (' + WHO[ex] + (st ? '; ' + (STATUS[st] || plain(st).replace(/_/g, ' ')) : '') + ').'); }
    for (const b of (Array.isArray(m.blockers) ? m.blockers : [])) { const w = plain(b && b.what); if (!w) continue;
      const W = w.charAt(0).toUpperCase() + w.slice(1); (S(b.owner) === 'us' ? did : you).push((S(b.owner) === 'us' ? 'On us: ' : '') + W.replace(/[.\s]+$/, '') + '.'); }
    if (!did.length) did.push('No new step this week.');
    if (!you.length) you.push('Nothing from you this week.');
    let wins = null, spend = null;
    for (const l0 of part('cost_per_win')) { const w = num(fig(l0, 'wins')); const sp = num(fig(l0, 'spend_usd')); if (w != null) wins = w; if (sp != null) spend = sp; }
    const sections = [{ key: 'changed', title: 'What changed', lines: changed }, { key: 'why', title: 'Why it moved', lines: why }, { key: 'worked', title: 'Did our steps work', lines: worked },
      { key: 'did', title: 'What we did', lines: did.slice(0, 10) }, { key: 'you', title: 'What we need from you', lines: you.slice(0, 10) }].filter(s => s.lines.length);
    return { v: 1, sections, wins, spend_usd: spend }; };
  return { view, plain, label, LABELS, ENGINE_LABELS, STAGE, WHO, STATUS };
})();
// ---- AIR (2026-11-06, docs/ai-ranking-2026-11-05 DESIGN 2.H / 6.7, package P6): the AI ranking plan of a website whose AI ranking is `on` ----
// A section "AI ranking plan" in the report and ONE additive key `ai_rank` in the ai_growth callback, built from this run's `AI Rank Plan` item for
// the website (its weekly memo: what changed and why, what we can detect, what we did and what waits, projected against real, the cost per won
// question, AI ranking's plan against the current one). Present ONLY for a website in `on`: a website off, in shadow, or stopped by the kill switch
// has no AI Rank Plan item in `on` mode, so its report and its callback are exactly what they were (shadow is read by the owner elsewhere).
const AIR_ON = (() => { try { return $('AI Rank Plan').all().map(i => i.json || {}).filter(x => x && x.site_id && !x.skip && !x.error && x.air && x.mode === 'on'); } catch (e) { return []; } })();
const AIR_PROMPTS = (() => { try { return new Map($('Load AI Prompts').all().map(i => i.json || {}).filter(r => r && r.prompt_id).map(r => [String(r.prompt_id), String(r.prompt || r.question || '')])); } catch (e) { return new Map(); } })();
const AIR_MONS = (() => { try { return $('Load Monitors').all().map(i => i.json || {}); } catch (e) { return []; } })();
// FX-C RC-1 (2026-11-06): a client never reads the owner's memo. The section and the callback carry the client view (AIRC.view: what changed,
// why it moved, did our steps work, what we did, what we need from you) with the lever names in the client's words; no ids, no stage codes,
// no statistics, no figures of the model, no money (the number of questions won travels as `wins`, the raw spend as `spend_usd`, which the
// app turns into credits and strips before a customer sees it). The raw memo stays in seo_ai_rank_runs for platform admins only.
const AIR_WHO = AIRC.WHO;
// RC-3: the steps that need an address say where the client gives it (the step in the app takes it, our check reads it)
const AIR_CHECK = { L01: 'the next robots.txt reading lets the AI assistants read your site', L02: 'our reading of the page without JavaScript finds its text', L03: 'your site shows in Bing Webmaster Tools and the page is crawled',
  L04: 'Google reports the page as indexed', L05: 'the page is published, answers, and is indexed', L06: 'the page is published, answers, and is indexed', L16: 'the page is published, answers, and is indexed',
  L07: 'our reading of the cited page finds your name in the passage', L08: 'our reading of the list page finds your name', L09: 'the listing is found, or you paste the profile address on the step in the app and our reading confirms it',
  L10: 'the listing is found, or you paste the profile address on the step in the app and our reading confirms it', L11: 'you paste the address on the step in the app and our reading finds your name on it', L12: 'you paste the address on the step in the app and our reading finds your name on it',
  L13: 'you paste the address on the step in the app and our reading finds your name on it', L14: 'you paste the address on the step in the app and our reading finds your name on it', L15: 'you paste the address of the corrected page on the step in the app and our reading confirms it', L17: 'you paste the Wikidata address on the step in the app and our reading finds your website on it' };
const airReportOf = (sid, checkedAt) => { const A = AIR_ON.find(x => x.site_id === sid); if (!A) return null; const air = A.air || {};
  const S_ = (v) => (v == null ? '' : String(v)).trim(); const P_ = (v, d) => { if (v && typeof v === 'object') return v; try { const x = JSON.parse(v); return x == null ? d : x; } catch (e) { return d; } };
  const labelOf = (a) => AIRC.label(a.lever);   // RC-14: the client's words for the lever, never the engine's
  const statusById = new Map(((air.rows || {}).actions || []).map(r => [S_(r.action_id), S_(r.status)]));
  const leverById = new Map([...((air.rows || {}).actions || []), ...(air.chosen || [])].map(r => [S_(r.action_id), S_(r.lever)]));
  const qText = (ids) => (Array.isArray(ids) ? ids : P_(ids, [])).map(id => AIR_PROMPTS.get(S_(id)) || '').filter(Boolean).slice(0, 4);
  const actions = (air.chosen || []).slice(0, 20).map(a => { const ref = P_(a.ref, {}) || {}; const pageUrl = S_(ref.url) || S_(a.page_url);   // FX-C: L07's ref names the question only; the page it fixes is on the chosen action
    return { action_id: S_(a.action_id), lever: S_(a.lever), label: labelOf(a), executor: S_(a.executor), status: statusById.get(S_(a.action_id)) || 'proposed', sink: S_(a.sink), scope: S_(a.scope),
      questions: qText(a.questions), engines: (Array.isArray(a.engines) ? a.engines : P_(a.engines, [])).map(S_).slice(0, 8), target_stage: '', why: AIRC.plain(a.why).slice(0, 300), url: pageUrl }; });
  const steps = (air.chosen || []).filter(a => a.executor === 'human' || ['growth_action', 'site_task', 'listing'].includes(S_(a.sink))).slice(0, 8).map(a => { const ref = P_(a.ref, {}) || {}; const pageUrl = S_(ref.url) || S_(a.page_url);   // FX-C: L07's ref names the question only; the page it fixes is on the chosen action
    return { key: 'ai_rank:' + S_(a.lever) + ':' + AIRF.refKey(ref), lever: S_(a.lever), label: labelOf(a), what: (labelOf(a) + (pageUrl ? ': ' + pageUrl : '')).slice(0, 200), why: AIRC.plain(a.why).slice(0, 300),
      check: AIR_CHECK[S_(a.lever)] || 'our weekly check reads it again', url: pageUrl, action_id: S_(a.action_id), status: statusById.get(S_(a.action_id)) || 'queued' }; });
  const open = ((air.rows || {}).actions || []).filter(r => ['proposed', 'queued', 'in_progress'].includes(S_(r.status))).length;
  const mon = AIR_MONS.find(m => m.site_id === sid) || {};
  const memo = air.memo && typeof air.memo === 'object' ? air.memo : null;
  const client = memo ? AIRC.view(memo, { question: (id) => AIR_PROMPTS.get(S_(id)) || '', leverOf: (id) => leverById.get(S_(id)) || '', actions }) : null;
  return { v: 2, mode: 'on', run_id: S_(A.run_id), checked_at: S_(air.checked_at) || S_(checkedAt), client, actions, steps,
    counts: { core: ((air.panel || {}).core || []).length, chosen: (air.chosen || []).length, deferred: (air.deferred || []).length, refused: (air.refused || []).length, open },
    reserve: AIRF.settingsOf(mon).reserve }; };
const airHtml = (R) => { if (!R) return ''; const e = (v) => esc(String(v == null ? '' : v));
  let h = h3('AI ranking plan') + p_('The work chosen this week to get you named in AI answers, and what has moved. A change is called our doing only when questions we did not work on did not move the same way.', true);
  for (const sec of ((R.client || {}).sections || [])) { const lines = (sec.lines || []).filter(Boolean); if (!lines.length) continue;
    h += '<p style="margin:8px 0 2px;font-size:13px"><b>' + e(sec.title) + '</b></p><ul style="font-size:13px;margin:2px 0 6px 18px;padding:0">' + lines.map(l => '<li>' + e(l) + '</li>').join('') + '</ul>'; }
  const wins = (R.client || {}).wins;
  if (wins != null) h += p_(wins > 0 ? 'Questions won after a confirmed step: <b>' + e(Math.round(wins * 10) / 10) + '</b> (net of the questions that moved on their own). The credits this used are on the AI visibility page in the app.' : 'No question has been won after a confirmed step yet.', true);
  h += table(['Step', 'Who', 'State', 'Why'], R.actions.map(a => [e(a.label) + (a.url ? '<div style="font-size:11px">' + link(a.url) + '</div>' : '') + (a.questions.length ? '<div style="font-size:11px;color:#64748b">for: ' + a.questions.map(e).join(' | ') + '</div>' : ''),
    e(AIR_WHO[a.executor] || 'you do it, we check it'), e(AIRC.STATUS[a.status] || String(a.status).replace(/_/g, ' ')), e(a.why)]), 'nothing new chosen this week');
  if (R.steps.length) h += p_('Steps on your website: ' + R.steps.length + ' (each one is listed in the app with how we check it).', true);
  return h; };
// 2026-10-19: the cycle a website's run belongs to (Growth Plan carries it; Growth Metrics does not)
const cycleOf = (sid) => { try { return ($('Growth Plan').all().map(i => i.json || {}).find(p => p.site_id === sid) || {}).cycle || null; } catch (e) { return null; } };
const KIND = { list: '"Best of" list', article: 'Article', news: 'News', review: 'Review site', forum: 'Forum thread', video: 'Video', social: 'Social post', official: 'Official list', encyclopedia: 'Encyclopedia', competitor: 'Competitor page' };
// R94 (2026-10-16): a dry run (`dry_run: true` on the Manual Run - a test, never the weekly run) sends nothing to Bing or IndexNow;
// the request nodes hand on what WOULD have been sent, and the report says so first, instead of "nothing new to send".
const DRY_OF = (sid) => { const pick = (nm) => { try { return $(nm).all().map(i => i.json || {}).find(x => x.dry_run && x.site_id === sid) || null; } catch (e) { return null; } };
  let on = false; try { let t = $('Manual Run').first().json || {}; if (t.body && typeof t.body === 'object') t = { ...t, ...t.body }; on = t.dry_run === true || /^(true|1|yes|on)$/i.test(String(t.dry_run ?? '')); } catch (e) {}
  const b = pick('Bing Submit Requests'), x = pick('IndexNow Requests');
  return (on || b || x) ? { bing: b ? (b.would_submit || []).length : 0, indexnow: x ? (x.would_submit || []).length : 0 } : null; };
// reads Growth Metrics explicitly: the node before it saves a Data Table row and outputs that row, not the summary
return $('Growth Metrics').all().map(i => i.json).filter(m => !m.skip).map(m => {
  const B = m.submitted.bing, X = m.submitted.indexnow;
  const EB = m.earned_basis || {};   // C-3: what the earned-media counts are counted over
  // B9-1 (2026-10-15, benchmark area 9): what a submission actually reaches, said the way the sources say it. Bing's index is read
  // by Bing and Microsoft Copilot; OpenAI documents OAI-SearchBot, not Bing, as what surfaces pages in ChatGPT search; and
  // IndexNow's own FAQ states that submitting "does not guarantee immediate indexing". Sent is sent — never "indexed".
  const O = m.outcome || {};
  const done = [B.submitted ? n(B.submitted) + ' page(s) sent to Bing — the index Bing and Microsoft Copilot answer from (a submission is a notification, not indexing)' : (B.enabled ? (B.in_account ? (B.error ? 'Bing submission failed: ' + esc(B.error) : 'nothing new to send to Bing') : 'not sent to Bing: the site is not in the Bing Webmaster account') : 'Bing submission is off (no Bing Webmaster key)'),
    X.verified ? (X.submitted ? n(X.submitted) + ' page(s) notified through IndexNow (Bing, Yandex, Naver, Seznam, Yep — Google does not take part)' : 'IndexNow ready (nothing new to send)') : 'IndexNow waits for its key file',
    // B9-2 (INVARIANTS rule 4): a page sent is not a page crawled, so the run says what became of the ones sent before
    O.basis === 'measured' ? 'Of ' + n(O.submitted) + ' page(s) sent in the last ' + O.window_days + ' days, <b>' + n(O.crawled) + ' have since been crawled by Bing</b> and ' + n(O.submitted - O.crawled) + ' not yet'
      + (O.not_checked ? ' (' + n(O.not_checked) + ' of them not asked about this run)' : '') + ' — measured from Bing Webmaster Tools, not from the fact that we sent them'
      : O.basis === 'not available' ? 'What became of earlier submissions: not available — ' + esc(O.reason || '') : 'Nothing had been sent before this run, so there is nothing to follow up yet',
    n(m.pages.filter(p => p.status).length) + ' key page(s) checked for AI readiness' + (m.avg_score != null ? ' (average ' + m.avg_score + '/100' + (m.previous_avg_score != null ? ', was ' + m.previous_avg_score : '') + ')' : '')
      + (m.withheld_scores ? ', ' + n(m.withheld_scores) + ' not scored: robots.txt lets no AI search fetcher read them' : ''),
    n(m.earned.length) + ' page(s) AI cites without naming you' + (m.drafts_written ? ', ' + n(m.drafts_written) + ' outreach draft(s) written' : (m.handed_over ? ', ' + n(m.handed_over) + ' handed to the Link Builder (one writer): approve the pitches on the Link building page' : '')),   // P34-1: only the drafts THIS run wrote are counted; the stored ones of earlier runs are not this week's work
    n(m.targets.filter(t => t.status === 'queued').length) + ' question(s) queued for an AI answer page or refresh' + (m.ai_pages_month > 0 ? ' (' + m.ai_pages_month + ' a month, written by ' + (cycleOf(m.site_id) && cycleOf(m.site_id).date ? 'the content run of this website\'s weekly cycle (' + ST.everyText(ST.weekdayOfDate(cycleOf(m.site_id).date)) + ')' : 'the weekly content run') + ')' : ' (AI pages are off)')];
  const DRY = DRY_OF(m.site_id);
  const dry_run_note = DRY ? 'DRY RUN — nothing was submitted: ' + n(DRY.bing) + ' page(s) would have been sent to Bing and ' + n(DRY.indexnow) + ' notified through IndexNow (a test run; the weekly run submits)' : '';
  if (DRY) done.splice(0, 2, '<b>' + dry_run_note + '</b>');
  let html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:860px;color:#0f172a">';
  html += '<h2 style="margin:0 0 4px">AI growth — ' + esc(m.domain) + '</h2>' + p_(esc(m.checked_at.slice(0, 10)) + ' · the weekly work that gets you named and cited in AI answers', true);
  html += alertBox(m.alerts.filter(a => a.level !== 'good'));
  if (m.alerts.some(a => a.level === 'good')) html += '<div style="background:#f0fdf4;border-left:4px solid #15803d;padding:8px 12px;margin:8px 0">' + m.alerts.filter(a => a.level === 'good').map(a => '<div style="font-size:13px">✓ ' + esc(a.text) + '</div>').join('') + '</div>';
  html += h3('Done for you this week') + '<ul style="font-size:13px;margin:4px 0 8px 18px;padding:0">' + done.map(d => '<li>' + d + '</li>').join('') + '</ul>';
  html += h3('What to do next') + table(['', 'Action', 'Why'], m.actions.map(a => [a.priority === 1 ? 'High' : a.priority === 2 ? 'Medium' : 'Low', esc(a.action) + (a.draft ? '<div style="margin-top:4px;padding:6px;background:#f8fafc;font-size:12px;white-space:pre-wrap">' + (a.draft.subject ? '<b>' + esc(a.draft.subject) + '</b>\n' : '') + esc(a.draft.body) + '</div>' : ''), esc(a.why)]), 'nothing to do this week');
  // B-G2 (2026-10-15, INVARIANTS rule 1 + 2): a stored rung the read-path fit gate set aside became no question and no page — named
  // here with its reason, because "we are not writing a page about X because it is a competitor's brand" is the better answer.
  if ((m.set_aside || []).length) html += '<p style="margin:4px 0 8px;font-size:12px;color:#b45309"><b>Set aside</b> (planned before the keyword rule existed, no question and no page): '
    + m.set_aside.map(x => esc(x.note || (x.keyword + ' — ' + x.detail))).join(' | ') + '</p>';
  html += h3('Pages AI cites without naming you (earned media)') + (EB.answers ? p_('Counted over ' + n(EB.answers) + ' AI answers that did not name you, ' + esc(EB.from) + ' to ' + esc(EB.to) + ' (the weekly AI-visibility runs and the daily pulse): a page is counted once for each answer that linked it. The AI visibility report\'s "Sources AI relies on" counts websites over its own run, so the two numbers are not the same measure.', true) : '') + table(['Page', 'Kind', 'Answers citing it', 'Names', 'Next step'], m.earned.slice(0, 12).map(e => [link(e.url, e.title || e.host), esc(KIND[e.kind] || e.kind), n(e.citations) + ' · ' + esc(e.engines.join(', ')),
    e.mentions_us === true ? '<b style="color:#15803d">you</b>' : esc(e.competitors_named.join(', ') || (e.mentions_us === false ? 'not you' : '—')), esc(e.action)]), 'no third-party pages cited this week');
  // B9-3: a withheld score says why instead of printing a number nothing supports; the blocked pages sort to the top
  html += h3('Key pages: can AI read and quote them?') + table(['Page', 'Score', 'Updated', 'Bing', 'Fix first'], m.pages.slice().sort((a, b) => (a.score == null ? -1 : a.score) - (b.score == null ? -1 : b.score)).map(p => [link(p.url),
    p.score == null && p.score_withheld ? '<b style="color:#b91c1c">not scored</b><div style="font-size:11px;color:#64748b">' + esc(p.score_withheld) + '</div>' : p.status ? '<b>' + p.score + '</b>/100' : 'error ' + (p.status || ''), esc(p.updated_on || 'no date'),
    p.bing_crawled_at ? 'crawled ' + esc(p.bing_crawled_at.slice(0, 10)) : (p.bing_known ? 'not crawled' : '—'), esc(p.issues[0] || 'nothing')]), 'no pages checked this week');
  // B9-4: the status travels with the evidence it was decided on — how many answers named the business, out of how many asked
  html += h3('Questions queued for an AI answer page') + table(['Question', 'Plan', 'Status'], m.targets.filter(t => ['queued', 'writing', 'written', 'won'].includes(t.status)).slice(0, 10).map(t => [esc(t.question), t.kind === 'refresh' ? 'refresh ' + link(t.page_url) : 'new answer page',
    esc(t.status) + (t.reason ? '<div style="font-size:11px;color:#64748b">' + esc(String(t.reason).slice(0, 180)) + '</div>' : '')]), 'no lost questions — AI already names you for all of them');
  if ((m.refused_submissions || []).length) html += p_('Not sent: ' + m.refused_submissions.slice(0, 5).map(r => esc(r.url) + ' (' + esc(r.reason) + ')').join('; ') + '.', true);
  if (m.entity) html += h3('Entity') + p_(m.entity.found ? 'Wikidata: <b>' + esc(m.entity.qid) + '</b> lists ' + esc(m.domain) + ' as its official website.' : 'No Wikidata item has ' + esc(m.domain) + ' as its official website' + (m.entity.by_name.length ? ' (items with a similar name: ' + m.entity.by_name.slice(0, 3).map(x => esc(x.label + (x.description ? ' — ' + x.description : ''))).join('; ') + ')' : '') + '.');
  if (!m.submitted.indexnow.verified) html += p_('IndexNow: put a file at <b>' + esc(m.submitted.indexnow.key_url) + '</b> containing only <code>' + esc(m.submitted.indexnow.key) + '</code>.', true);
  // B9-10: Bing's own AI citation data exists, is free, and is in the account we already read - but no API returns it, so it is named, not imported
  html += h3("Bing's own AI citation data (read it in Bing Webmaster Tools)") + p_('<b>AI Performance</b> (public preview since 11 February 2026) shows how often your pages are cited in Microsoft Copilot and Bing AI summaries, which pages, and the <i>grounding queries</i> the AI used to find them; its <b>Topics Portfolio</b> (beta, from 13 October 2026) adds the opportunity queries where other sites appear and yours does not. That is Bing\'s measurement of real Copilot citations. The questions in this report are our own modelled list, asked of the assistants, which is a different thing. <b>No API returns the AI Performance report</b> (the documented Webmaster API has no endpoint for it), so nothing from it is in this report or in our numbers: open Bing Webmaster Tools, Search Performance, AI Performance, and compare it with the list above.', true);
  // B9-7: the wrong claims AI makes about the business, each with the fact on file and the pages that carry it
  if ((m.corrections || []).length) html += h3('Wrong claims AI makes about you (corrections)') + table(['The claim', 'The fact on file', 'Pages that carry it', 'Status'], m.corrections.map(c => [esc(c.claim), c.fact_on_file ? esc(c.true_fact) : '<b style="color:#b45309">needs your fact</b>',
    (c.pages || []).map(pg => link(pg.url, pg.title || pg.host) + '<div style="font-size:11px;color:#64748b">' + (pg.carries_claim === true ? 'the page says it' : pg.carries_claim === false ? 'cited in the answer; the page does not say it' : 'not read') + '</div>').join('') || '—',
    esc(c.status.replace(/_/g, ' ')) + '<div style="font-size:11px;color:#64748b">' + esc(String(c.note || '').slice(0, 220)) + '</div>' + (c.draft ? '<details style="margin-top:4px"><summary>Draft (never sent)</summary><div style="white-space:pre-wrap;font-size:12px">' + esc((c.draft.subject ? c.draft.subject + '\n\n' : '') + c.draft.body) + '</div></details>' : '')]), 'none');
  if (!X.verified || B.enabled) html += p_('What a submission reaches: Bing\'s index, which Bing and Microsoft Copilot answer from — Bing Webmaster Tools reports those citations in its AI Performance report, which has no API, so read it there. OpenAI documents <b>OAI-SearchBot</b>, not Bing, as what surfaces pages in ChatGPT search, and IndexNow states that submitting "does not guarantee immediate indexing".', true);
  const lineage = [
    LN.of('AI readiness score per key page', 'own_check', { basis: 'modelled', period: LN.asOf(m.checked_at), sample: LN.sample(m.pages.filter(p => p.status && p.score != null).length, 'key pages fetched as raw HTML and readable by at least one AI fetcher'),
      note: 'our own 0-100 score (answer in the first 200 characters, a visible update date, question headings, sourced figures) — a model, not a Google or an AI-engine figure' + (m.withheld_scores ? '; ' + m.withheld_scores + ' page(s) have no score because robots.txt lets no AI search fetcher read them' : '') }),
    // B9-2: the one figure in this report that says what a submission achieved, and it is Bing's own answer or it is nothing
    (m.outcome && m.outcome.basis === 'measured')
      ? LN.of('Pages crawled by Bing after we submitted them', 'bing', { basis: 'measured', period: 'the ' + m.outcome.window_days + ' days before ' + String(m.checked_at).slice(0, 10), sample: LN.sample(m.outcome.submitted, 'pages submitted and asked about again'), note: 'Bing Webmaster Tools GetUrlInfo (LastCrawledDate); a submission on its own proves nothing' })
      : LN.unknown('Pages crawled by Bing after we submitted them', (m.outcome && (m.outcome.reason || m.outcome.basis)) || 'no submission has been followed up yet'),
    // B9-3: what the AI fetchers may read is measured from the site's own robots.txt, or it is not checked
    (m.robots && !m.robots.unavailable) ? LN.of('What the AI search fetchers may read', 'own_check', { basis: 'measured', period: LN.asOf(m.checked_at), sample: LN.sample(Object.keys((m.robots && m.robots.verdicts) || {}).length, 'key pages evaluated against robots.txt'), note: (m.robots.note || 'the site\'s own robots.txt') + ', matched by Google\'s documented rules (most specific group, longest rule, Allow wins a tie)' })
      : LN.unknown('What the AI search fetchers may read', (m.robots && (m.robots.reason || m.robots.note)) || 'robots.txt was not read this run'),
    LN.of('Pages AI cites without naming you', 'ai_engines', { basis: 'measured', period: EB.answers ? EB.from + ' to ' + EB.to + ' (' + EB.days + ' days of stored answers: weekly AI-visibility runs and the daily pulse)' : 'the answers stored in the last 8 days', sample: LN.sample(m.earned.length, 'third-party pages cited') + (EB.answers ? ' in ' + EB.answers + ' answers that did not name you' : ''), note: 'the exact pages the assistants linked in their answers; each page counted once per answer that linked it' }),
    B.enabled && B.in_account ? LN.of('Bing crawl state and submissions', 'bing', { basis: 'reported', period: LN.asOf(m.checked_at), sample: LN.sample(B.submitted, 'pages submitted this run') })
      : LN.unknown('Bing crawl state', B.enabled ? 'this site is not in the Bing Webmaster account' : 'no Bing Webmaster key is configured'),
    LN.of('Questions queued for an AI answer page', 'ai_db', { basis: 'estimated', period: LN.asOf(m.checked_at), sample: LN.sample(m.targets.length, 'questions in the panel'), note: 'the value of each question uses DataForSEO\'s AI search volume estimate' }),
  ];
  // AIR P6: the AI ranking plan (on websites only; nothing for any other website)
  const AIRR = airReportOf(m.site_id, m.checked_at);
  if (AIRR) { html += airHtml(AIRR); lineage.push(LN.of('AI ranking plan', 'own_check', { basis: 'modelled', period: LN.asOf(m.checked_at), sample: LN.sample(AIRR.counts.core, 'core AI questions'),
    note: 'our own model of which steps move a question in AI answers, from the stored answers of the last 8 weeks; projections are estimates, a move is attributed to a step only when control questions did not move the same way' })); }
  html += LN.block(lineage) + '</div>';
  // C-11 (re-rating 2026-10-17): a dry run is a test - nothing was done for anyone this week - so its subject says so, and the callback
  // carries `dry_run: true`, which the app's delivery rule holds (app/shared/src/report-delivery.ts, hold code `test_run`)
  const subject = DRY ? '[AI growth · TEST RUN] ' + m.domain + ' — dry run, nothing was submitted'
    : '[AI growth] ' + m.domain + ' — ' + (m.actions.filter(a => a.priority === 1).length ? m.actions.filter(a => a.priority === 1).length + ' high-value action(s)' : 'done for you this week') + (m.alerts.some(a => a.level === 'good') ? ' · a win' : '');
  const file_name = 'ai-growth-' + m.domain.replace(/[^a-z0-9]+/gi, '-') + '-' + m.checked_at.slice(0, 10) + '.html';
  return { json: { ...m, lineage, subject, html, file_name, status: 'progress', stage: 'ai_growth', ...(DRY ? { dry_run: true, dry_run_note } : {}), ...(AIRR ? { ai_rank: AIRR } : {}) }, binary: { data: { data: b64(wrapDoc(subject, html)), mimeType: 'text/html', fileName: file_name, fileExtension: 'html' } } };
});
