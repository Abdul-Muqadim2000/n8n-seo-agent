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
      + rows.map(l => '<tr><td ' + td + '>' + esc1(l.figure) + '</td><td ' + td + '>' + esc1(l.source_label) + '</td><td ' + td + '>' + esc1(l.period || '—')
        + '</td><td ' + td + '>' + esc1(l.sample || '—') + '</td><td ' + td + '>' + esc1([l.basis_label, l.note].filter(Boolean).join(' — ')) + '</td></tr>').join('')
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
  html += LN.block(lineage) + '</div>';
  // C-11 (re-rating 2026-10-17): a dry run is a test - nothing was done for anyone this week - so its subject says so, and the callback
  // carries `dry_run: true`, which the app's delivery rule holds (app/shared/src/report-delivery.ts, hold code `test_run`)
  const subject = DRY ? '[AI growth · TEST RUN] ' + m.domain + ' — dry run, nothing was submitted'
    : '[AI growth] ' + m.domain + ' — ' + (m.actions.filter(a => a.priority === 1).length ? m.actions.filter(a => a.priority === 1).length + ' high-value action(s)' : 'done for you this week') + (m.alerts.some(a => a.level === 'good') ? ' · a win' : '');
  const file_name = 'ai-growth-' + m.domain.replace(/[^a-z0-9]+/gi, '-') + '-' + m.checked_at.slice(0, 10) + '.html';
  return { json: { ...m, lineage, subject, html, file_name, status: 'progress', stage: 'ai_growth', ...(DRY ? { dry_run: true, dry_run_note } : {}) }, binary: { data: { data: b64(wrapDoc(subject, html)), mimeType: 'text/html', fileName: file_name, fileExtension: 'html' } } };
});
