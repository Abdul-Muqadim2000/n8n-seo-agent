// Weekly performance report per site: e-mail HTML (KPI tiles, actions, tracked keywords, ladder pages, movers, opportunities, traffic, trends),
// the same document as a file for the PDF renderer, and the fields for the callback. Uses the AI brief when present, the facts otherwise.
// G12 / G29 (2026-10-13, FIX_PLAN): the period's events are listed with their dates (pages published, audit fixes, Google updates, the
// num=100 data break) so a move in the numbers can be read against what happened, and every figure group carries its source, period and
// sample — inline under the tiles and in full in "Where these numbers come from".
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
// ---- chart annotations (G12, 2026-10-13, system review FIX_PLAN.md; CRITERIA_technical_tracking_reporting_ai_links.md 3.5 / 2.12) ----
// A line that falls in mid-September 2025 is not a ranking problem: that is the week Google stopped serving 100 results on one page.
// A line that climbs two weeks after a page went live is the page. Rank Ranger and Search Console both mark such events on their
// charts; we marked nothing, so every chart had to be read without its context. These marks are computed from data already stored -
// published pages (`seo_content_log.published_at`), the technical audits (`seo_audits`), and the dated registry in
// `v5/data/seo_events.json` (Google updates and data breaks) - and never from a guess. A date with no event produces no mark.
// The registry is THE one place to add a new Google update: the build inlines the same file here, into _site_stats.js and into the
// app (app/shared/src/seo-events.generated.ts), so the engine and the dashboards mark the same dates.
const AN = (() => {
  const EVENTS = Object.assign({ updated: '', google_updates: [], data_breaks: [] }, {"updated": "2026-10-15", "google_updates": [{"name": "March 2025 core update", "start": "2025-03-13", "end": "2025-03-26"}, {"name": "June 2025 core update", "start": "2025-06-30", "end": "2025-07-16"}, {"name": "August 2025 spam update", "start": "2025-08-26", "end": "2025-09-21"}, {"name": "December 2025 core update", "start": "2025-12-11", "end": "2025-12-29"}, {"name": "February 2026 Discover update", "start": "2026-02-05", "end": "2026-02-26"}, {"name": "March 2026 spam update", "start": "2026-03-24", "end": "2026-03-24"}, {"name": "March 2026 core update", "start": "2026-03-27", "end": "2026-04-08"}, {"name": "May 2026 core update", "start": "2026-05-21", "end": "2026-06-01"}, {"name": "June 2026 spam update", "start": "2026-06-24", "end": "2026-06-26"}, {"name": "August 2026 spam update", "start": "2026-08-18", "end": "2026-08-20"}, {"name": "September 2026 spam update", "start": "2026-09-24", "end": "2026-10-07"}], "data_breaks": [{"name": "num=100 stopped working", "start": "2025-09-10", "end": "2025-09-19", "affects": ["impressions", "position"], "detail": "Google stopped serving 100 results on one page in mid-September 2025, so the SEO tools that read 100 results at a time disappeared from the counts. Impressions fell and average position improved on most sites without anything changing on the site: figures from before and after this break are not comparable."}]});
  const KINDS = {
    publish: { label: 'Page published', tone: 'good' },
    fix: { label: 'Audit fixes', tone: 'good' },
    google_update: { label: 'Google update', tone: 'warning' },
    data_break: { label: 'Data break', tone: 'warning' },
    link: { label: 'Link won', tone: 'good' },
    note: { label: 'Your note', tone: 'neutral' },
  };
  const S = (v) => String(v == null ? '' : v);
  const day = (v) => S(v).slice(0, 10);
  const esc1 = (s) => S(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // a point event is in the window when its day is inside it; a dated range is in when it overlaps it. An open end means "no limit".
  const inRange = (from, to, start, end) => { const a = day(from), b = day(to), s0 = day(start), e0 = day(end) || day(start);
    if (!s0) return false;
    if (a && e0 < a) return false;
    if (b && s0 > b) return false;
    return true; };
  const mark = (kind, date, label, o) => { const x = o || {};
    return { kind, date: day(date), date_end: day(x.date_end) || day(date), label: S(label), detail: S(x.detail), url: S(x.url), source: S(x.source),
      tone: (KINDS[kind] || {}).tone || 'neutral', kind_label: (KINDS[kind] || {}).label || kind,
      ...(x.report_type ? { report_type: S(x.report_type) } : {}) }; };   // R20: which kind of audit a `fix` mark came from
  // every event inside [from, to]. `published`: seo_content_log rows; `audits`: seo_audits rows (oldest first or any order);
  // `links`: won links with their first sighting. Everything optional - what is missing simply produces no marks.
  const marks = (o) => {
    const x = o || {}; const from = day(x.from), to = day(x.to); const out = [];
    for (const p of (x.published || [])) {
      const d = day(p.published_at || p.publishedAt || p.date);
      if (!d || !inRange(from, to, d, d)) continue;
      const kw = S(p.keyword).trim();
      out.push(mark('publish', d, kw ? 'Published: "' + kw + '"' : 'Page published', { url: S(p.published_url || p.publishedUrl || p.url), source: 'seo_content_log',
        detail: S(p.source) === 'ladder' ? 'a keyword-ladder page' : S(p.source) === 'cadence' ? 'a page of the weekly cadence' : S(p.source) ? 'source: ' + S(p.source) : '' }));
    }
    // R20 (2026-10-14, the second re-rating): the feed chained every audit to the one before it, whatever kind of report it was. With a
    // full SEO report (health 68) sitting between two technical audits (health 80) the same day, the owner read "Technical audit health
    // 80 → 68 · 24 more findings", "Audit fixes: 24 findings gone — health 68 → 80" and "Technical audit health 80 → 80" as three events
    // — three invented moves. The two reports check different things and score differently (D2 / R2 fixed exactly this inside the audit's
    // own diff). A delta is now computed only against the previous report OF THE SAME KIND, and a change of kind is said, never scored.
    const kindOfAudit = (a) => { const t = S(a.report_type || a.reportType || a.type).toLowerCase().trim();
      return /^(full|full_report|full_seo|seo_report)$/.test(t) ? 'full' : /^(site_audit|audit|technical|tech_audit|site)$/.test(t) ? 'site_audit' : (t || 'site_audit'); };
    const AUDIT_LABEL = { site_audit: 'Technical audit', full: 'Full SEO report' };
    const auditName = (k) => (AUDIT_LABEL[k] || 'Audit (' + k + ')');
    const audits = (x.audits || []).filter(a => day(a.audited_at || a.auditedAt)).slice()
      .sort((a, b) => day(a.audited_at || a.auditedAt).localeCompare(day(b.audited_at || b.auditedAt)));
    const lastOf = new Map(); let lastAny = null;
    for (let i = 0; i < audits.length; i++) {
      const a = audits[i]; const kind = kindOfAudit(a);
      const prev = lastOf.get(kind) || null; const prevAny = lastAny;
      lastOf.set(kind, a); lastAny = a;
      const d = day(a.audited_at || a.auditedAt);
      if (!inRange(from, to, d, d)) continue;
      const nFind = Number(a.findings == null ? a.findingsCount : a.findings), pFind = prev ? Number(prev.findings == null ? prev.findingsCount : prev.findings) : NaN;
      const hs = Number(a.health_score == null ? a.healthScore : a.health_score), ps = prev ? Number(prev.health_score == null ? prev.healthScore : prev.health_score) : NaN;
      const fixed = (Number.isFinite(nFind) && Number.isFinite(pFind)) ? pFind - nFind : null;
      const name = auditName(kind); const lower = name.toLowerCase();
      const switched = !prev && prevAny && kindOfAudit(prevAny) !== kind
        ? 'the report before it was a ' + auditName(kindOfAudit(prevAny)).toLowerCase() + (Number.isFinite(Number(prevAny.health_score)) ? ' (' + Number(prevAny.health_score) + '/100)' : '')
          + ': different checks, so the two scores are not comparable' : '';
      const detail = [Number.isFinite(hs) ? (Number.isFinite(ps) ? 'health ' + ps + ' → ' + hs : 'health ' + hs + '/100') : '',
        fixed == null ? '' : fixed > 0 ? fixed + ' fewer finding' + (fixed === 1 ? '' : 's') + ' than the audit before'
          : fixed < 0 ? Math.abs(fixed) + ' more finding' + (fixed === -1 ? '' : 's') + ' than the audit before' : 'the same findings as the audit before',
        switched || (!prev ? 'the first ' + lower + ' on record: nothing to compare it with' : '')].filter(Boolean).join(' · ');
      out.push(mark('fix', d, fixed != null && fixed > 0 ? 'Audit fixes: ' + fixed + ' finding' + (fixed === 1 ? '' : 's') + ' gone' + (kind === 'site_audit' ? '' : ' (' + lower + ')') : name,
        { detail, source: 'seo_audits', report_type: kind }));
    }
    // B7-7 (W3-D): the owner's own dated notes (monthly check-in notes) are marks too; the text is theirs, shown as written
    for (const nt of (x.notes || [])) {
      const d = day(nt.date);
      if (!d || !inRange(from, to, d, d) || !S(nt.text).trim()) continue;
      out.push(mark('note', d, 'Your note', { detail: S(nt.text).trim().slice(0, 300), source: S(nt.source) || 'seo_console_checkins' }));
    }
    for (const l of (x.links || [])) {
      const d = day(l.t0 || l.first_seen || l.date);
      if (!d || !inRange(from, to, d, d)) continue;
      out.push(mark('link', d, 'Link won: ' + S(l.ref_domain || l.refDomain), { url: S(l.target_url || l.targetUrl), source: 'seo_backlinks' }));
    }
    for (const u of (EVENTS.google_updates || [])) {
      if (!inRange(from, to, u.start, u.end)) continue;
      out.push(mark('google_update', u.start, 'Google: ' + S(u.name), { date_end: u.end, source: 'v5/data/seo_events.json',
        detail: 'Google changed its ranking systems between ' + day(u.start) + ' and ' + day(u.end) + '. A move in this window may be part of the cause, which cannot be proven from these numbers.' }));
    }
    for (const b of (EVENTS.data_breaks || [])) {
      if (!inRange(from, to, b.start, b.end)) continue;
      out.push(mark('data_break', b.start, 'Data break: ' + S(b.name), { date_end: b.end, source: 'v5/data/seo_events.json', detail: S(b.detail) }));
    }
    out.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
    return out;
  };
  // does a before / after comparison straddle a data break? Then the two sides are not comparable and the report says so.
  const breakBetween = (from, to) => (EVENTS.data_breaks || []).filter(b => inRange(from, to, b.start, b.end))
    .map(b => ({ name: S(b.name), start: day(b.start), end: day(b.end), detail: S(b.detail), affects: (b.affects || []).map(S) }));
  const html = (list, o) => { const rows = (list || []); const x = o || {};
    if (!rows.length) return x.empty === false ? '' : '<p style="color:#64748b;font-size:13px">Nothing happened in this period that would explain a move in the charts.</p>';
    const td = 'style="padding:4px 8px;border:1px solid #cbd5e1;font-size:12px;vertical-align:top"';
    const th = 'style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left;font-size:11px"';
    return '<table style="border-collapse:collapse;margin:6px 0;max-width:100%"><tr><th ' + th + '>Date</th><th ' + th + '>Event</th><th ' + th + '>What it was</th></tr>'
      + rows.map(m => '<tr><td ' + td + '>' + esc1(m.date + (m.date_end && m.date_end !== m.date ? ' to ' + m.date_end : '')) + '</td><td ' + td + '>'
        + esc1(m.label) + '</td><td ' + td + '>' + esc1(m.detail || m.kind_label) + '</td></tr>').join('') + '</table>';
  };
  // B7-7: said once in the report. Search Console's own annotations live only in Search Console (the API has no annotations resource).
  const OWN_NOTES_LINE = "Search Console's own chart annotations stay in Search Console: Google offers no API that returns them. The marks above are your published pages, your audits, your dated notes and the Google updates we track.";
  return { OWN_NOTES_LINE, marks, html, inRange, breakBetween, EVENTS, KINDS, UPDATES: EVENTS.google_updates || [], BREAKS: EVENTS.data_breaks || [] };
})();
const metrics = $('Site Metrics').all().map(i => i.json);
// 2026-10-19: the website's own weekly day ("every Wednesday", or "each week" when it has no cycle yet), from its Site Plan item
const planOf = (sid) => { try { return $('Site Plan').all().map(i => i.json || {}).find(p => p.site_id === sid) || {}; } catch (e) { return {}; } };
let briefs = []; try { briefs = $('Site Brief').all().map(i => (i.json && i.json.output && typeof i.json.output === 'object') ? i.json.output : null); } catch (e) { briefs = []; }
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v) => (Number(v) || 0).toLocaleString('en-GB');
const r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
const pct = (cur, prev) => prev > 0 ? Math.round((cur - prev) / prev * 100) : (cur > 0 ? null : 0);
const pctS = (v) => v == null ? 'new' : (v > 0 ? '▲ ' : v < 0 ? '▼ ' : '') + Math.abs(v) + '%';
const posS = (v) => !v ? '—' : '#' + r1(v);
const dcol = (v, invert) => v == null ? '#475569' : ((invert ? -v : v) > 0 ? '#15803d' : (invert ? -v : v) < 0 ? '#b91c1c' : '#475569');
const td = 'style="padding:4px 8px;border:1px solid #cbd5e1;font-size:13px;vertical-align:top"', th = 'style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left;font-size:12px"';
const table = (headers, rows, empty) => rows.length ? '<table style="border-collapse:collapse;margin:6px 0;max-width:100%">' + '<tr>' + headers.map(h => '<th ' + th + '>' + esc(h) + '</th>').join('') + '</tr>' + rows.map(r => '<tr>' + r.map(c => '<td ' + td + '>' + c + '</td>').join('') + '</tr>').join('') + '</table>' : '<p style="color:#64748b;font-size:13px">' + esc(empty || 'nothing to show') + '</p>';
const tile = (label, value, delta, color) => '<td style="padding:8px 12px;border:1px solid #e2e8f0;min-width:110px;vertical-align:top"><div style="font-size:11px;color:#64748b;text-transform:uppercase">' + esc(label) + '</div><div style="font-size:20px;font-weight:700">' + value + '</div><div style="font-size:12px;color:' + (color || '#475569') + '">' + delta + '</div></td>';
const h3 = (t) => '<h3 style="margin:18px 0 4px;font-size:15px;color:#0f172a">' + esc(t) + '</h3>';
// R92 part 2 (W3-D): a page row whose host is not the canonical one (`other_host` / `hosts`) prints its FULL URL, so a reader can see the host differs
const path = (u, row) => { if (row && (row.other_host || (row.hosts && row.hosts.length > 1))) return String(u || ''); const p = String(u || '').replace(/^https?:\/\/[^\/]+/i, ''); return p || '/'; };
const link = (u, row) => u ? '<a href="' + esc(u) + '" style="color:#1d4ed8">' + esc(path(u, row)) + '</a>' : '—';
const deltaS = (cur, prev) => { const d = cur - prev; return (d > 0 ? '<span style="color:#15803d">+' + n(d) + '</span>' : d < 0 ? '<span style="color:#b91c1c">' + n(d) + '</span>' : '0'); };
return metrics.map((m, i) => {
  const b = briefs[i] || null; const G = m.gsc, A = m.ga4;
  const period = m.period.current.start + ' to ' + m.period.current.end;
  const sa = m.service_account_email || '<i>(service-account e-mail: ask your administrator)</i>';
  let html = '<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;max-width:860px">';
  html += '<h2 style="margin:0 0 2px;font-size:20px">SEO performance: ' + esc(m.domain) + '</h2><p style="margin:0 0 10px;color:#64748b;font-size:13px">Last 28 days (' + esc(period) + ') vs the 28 days before · week ' + m.weeks_tracked + ' of tracking' + (m.on_demand ? ' · on-demand run' : '') + '</p>';
  if (b) { html += '<div style="background:#f8fafc;border-left:4px solid #1d4ed8;padding:10px 12px;margin:8px 0"><div style="font-weight:700;font-size:15px">' + esc(b.headline) + '</div><p style="margin:6px 0 0;font-size:14px">' + esc(b.summary) + '</p>' + ((b.highlights || []).length ? '<ul style="margin:6px 0 0;padding-left:18px;font-size:13px">' + b.highlights.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') + '</div>'; }
  const hard = m.alerts.filter(a => a.level === 'high' || a.level === 'medium');
  if (hard.length) html += '<div style="background:#fef2f2;border-left:4px solid #b91c1c;padding:8px 12px;margin:8px 0;font-size:13px"><b>Alerts</b><ul style="margin:4px 0 0;padding-left:18px">' + hard.map(a => '<li>' + esc(a.text) + '</li>').join('') + '</ul></div>';
  if (!G.connected || !A.connected) html += '<div style="background:#fffbeb;border-left:4px solid #d97706;padding:8px 12px;margin:8px 0;font-size:13px"><b>Connect Google to get real data</b><ol style="margin:4px 0 0;padding-left:18px">' +
    (!G.connected ? '<li><b>Search Console:</b> open <a href="https://search.google.com/search-console/users">Settings → Users and permissions</a> for ' + esc(m.domain) + ' and add <b>' + sa + '</b> with <i>Full</i> permission. ' + (G.error ? '<span style="color:#64748b">(' + esc(G.error) + ')</span>' : '') + '</li>' : '') +
    (!A.connected ? '<li><b>Google Analytics 4:</b> Admin → Property access management → add the same e-mail as <i>Viewer</i>. The property is detected automatically from its web stream URL; or register the site again with its GA4 property ID. ' + (A.error ? '<span style="color:#64748b">(' + esc(A.error) + ')</span>' : '') + '</li>' : '') +
    '</ol><p style="margin:4px 0 0">The next weekly report (or an on-demand run) picks the access up automatically.</p></div>';
  let tiles = '';
  if (G.connected) tiles += tile('Clicks', n(G.totals.cur.clicks), pctS(G.deltas.clicks_pct) + (G.deltas.yoy_clicks_pct != null ? ' · ' + pctS(G.deltas.yoy_clicks_pct) + ' YoY' : ''), dcol(G.deltas.clicks_pct)) + tile('Impressions', n(G.totals.cur.impressions), pctS(G.deltas.impressions_pct), dcol(G.deltas.impressions_pct)) + tile('CTR', (G.totals.cur.ctr * 100).toFixed(1) + '%', (G.deltas.ctr_pts > 0 ? '+' : '') + G.deltas.ctr_pts + ' pts', dcol(G.deltas.ctr_pts)) + tile('Avg position', posS(G.totals.cur.position), G.deltas.position == null ? '—' : (G.deltas.position > 0 ? '▲ ' : G.deltas.position < 0 ? '▼ ' : '') + Math.abs(G.deltas.position) + ' places', dcol(G.deltas.position));
  if (A.connected) { const ps = pct(A.organic.cur.sessions, A.organic.prev.sessions), pk = pct(A.organic.cur.key_events, A.organic.prev.key_events); tiles += tile('Organic sessions', n(A.organic.cur.sessions), pctS(ps) + ' · ' + A.organic_share + '% of all sessions', dcol(ps)) + tile('Key events (organic)', n(A.organic.cur.key_events), pctS(pk) + ' · ' + n(A.organic.cur.engaged) + ' engaged sessions', dcol(pk)); }
  if (tiles) html += '<table cellspacing="6" style="border-collapse:separate;margin:8px 0"><tr>' + tiles + '</tr></table>';
  // G29: the figures above, with their source, period and sample, right under them (the full list is at the end of the report)
  const LIN = m.lineage || [];
  const linOf = (re) => LIN.find(l => re.test(l.figure)) || null;
  if (LIN.length) { const top = linOf(/^Clicks, impressions/) || LIN[0];
    html += '<p style="margin:2px 0 8px;font-size:11px;color:#64748b">' + esc(LN.note(top)) + (linOf(/^Organic sessions/) ? ' · ' + esc(LN.note(linOf(/^Organic sessions/))) : '') + '</p>'; }
  // G12: what happened inside the two periods this report compares — the marks the dashboard charts carry, as a dated list here
  const MK = m.annotations || [], BRK = m.data_breaks || [];
  if (BRK.length) html += '<div style="background:#fffbeb;border-left:4px solid #d97706;padding:8px 12px;margin:8px 0;font-size:13px"><b>These two periods are not directly comparable</b><ul style="margin:4px 0 0;padding-left:18px">'
    + BRK.map(b => '<li>' + esc(b.name) + ' (' + esc(b.start) + ' to ' + esc(b.end) + '): ' + esc(b.detail) + '</li>').join('') + '</ul></div>';
  if (MK.length) html += h3('What happened in this period') + AN.html(MK, { empty: false })
    + '<p style="font-size:12px;color:#64748b">' + esc(m.annotation_note || AN.OWN_NOTES_LINE) + '</p>'
    + '<p style="font-size:12px;color:#64748b">Every chart in your dashboard is marked with these dates. A Google update inside the period may be part of the cause of a move, which cannot be proven from these numbers.</p>';
  // B7-1 (2026-10-15, benchmark area 7): did the change work, or did the whole site move? Every dated change, read over its OWN
  // 28 days after against the 28 before, against the control group of the site's other pages over exactly the same days. A change
  // that could not be read keeps its row with the reason — a shorter list would read as "nothing was tried".
  const CTST = m.change_tests || null;
  if (CTST && (CTST.tests || []).length) {
    html += h3('Did it work? Your changes against the rest of the site')
      + table(['Page', 'What changed', 'Clicks before → after', 'The rest of the site expected', 'Verdict', 'Position'],
        CTST.tests.slice(0, 6).map(t => [link(t.url) + (t.keyword ? '<br><span style="color:#64748b;font-size:11px">' + esc(t.keyword) + '</span>' : ''),
          esc(t.what || 'changed') + ' ' + esc(t.date), t.read ? n(t.prev_clicks) + ' → ' + n(t.clicks) : '—',
          t.read && t.expected != null ? n(t.expected) + (t.lift_pct == null ? '' : ' <span style="color:#64748b">(' + (t.lift_pct >= 0 ? '+' : '') + t.lift_pct + '% vs expected)</span>') : '—',
          '<b>' + esc(t.verdict) + '</b>', t.read && t.position_verdict ? esc(t.position_verdict) : '—']))
      + '<ul style="font-size:12px;color:#475569;margin:4px 0;padding-left:18px">'
      + CTST.tests.slice(0, 6).map(t => '<li>' + esc(t.url) + ': ' + esc(t.basis || '') + '</li>').join('') + '</ul>'
      + '<p style="font-size:12px;color:#64748b">' + esc(CTST.method) + '</p>';
  } else if (CTST && CTST.reason) html += h3('Did it work? Your changes against the rest of the site')
    + '<p style="font-size:13px;color:#b45309">' + esc(CTST.reason) + '</p>';
  // R111 / R59 (2026-10-16): the Site Tracker emits `fix_draft` (a draft whose last quality round failed: fix it and run it again,
  // never "publish it") and `host_split` (Google serves the bare host and www apart). Either may arrive without a sentence of its own,
  // so the report words it from its fields instead of printing an empty bullet.
  const reasonsOf = (a) => (Array.isArray(a.reasons) ? a.reasons : String(a.reasons || '').split(';')).map(x => String(x).trim()).filter(Boolean);
  const wordAction = (a) => {
    if (a.action) return a;
    if (a.type === 'fix_draft') return { ...a, action: 'Fix the draft for "' + (a.keyword || 'this page') + '" and run it again: it did not pass the quality check, so it is not ready to publish', why: a.why || (reasonsOf(a).length ? 'The quality check found: ' + reasonsOf(a).slice(0, 3).join('; ') + '.' : '') };
    if (a.type === 'host_split') return { ...a, action: 'Make one host the only one Google serves: some pages appear under the bare domain and others under www', why: a.why || 'Redirect the other host to the canonical one, so the two versions stop splitting clicks and indexing.' };
    return a;
  };
  const acts = ((b && Array.isArray(b.actions) && b.actions.length) ? b.actions.slice(0, 6).map(a => ({ action: a.action, why: a.why, keyword: a.keyword, url: a.url, type: a.type, reasons: a.reasons })) : m.actions.slice(0, 6)).map(wordAction).filter(a => a.action);
  const withBody = m.actions.filter(a => a.api_body);
  html += h3('Do this week') + (acts.length ? '<ol style="margin:4px 0;padding-left:20px;font-size:14px">' + acts.map(a => '<li style="margin:4px 0"><b>' + esc(a.action) + '</b>' + (a.why ? '<br><span style="color:#475569;font-size:13px">' + esc(a.why) + '</span>' : '') + '</li>').join('') + '</ol>' : '<p style="font-size:13px;color:#64748b">Nothing urgent this week.</p>');
  if (withBody.length) html += '<p style="font-size:13px">Start the work with one click: open the <a href="' + esc(m.form_url) + '">SEO Assistant form</a> ("I know my keyword") or send one of these to the API (' + esc(m.api_url) + '):</p>' + withBody.slice(0, 3).map(a => '<pre style="background:#f1f5f9;padding:8px;font-size:11px;white-space:pre-wrap">' + esc(JSON.stringify(a.api_body)) + '</pre>').join('');
  // v4.5: the growth monitors' latest results (AI Visibility Tracker Mon 07:00, Backlink Monitor Mon 07:30, Audit Scheduler monthly)
  // R78 (2026-10-16): the block compared the two newest rows of each table whatever their TYPE — a full SEO report against the
  // technical audit before it ("health 70 ▼13"), a full backlink snapshot against a free_only one that never reads DataForSEO
  // ("18 referring domains ▲18"). Each row is now compared only with the previous row of the SAME kind, filtered BEFORE the two
  // newest are taken: an audit with the previous audit of its report_type (the engine's own diff rule, Audit_Diff.js), a backlink
  // snapshot with the previous one that read the same sources (free_only vs DataForSEO), an AI run with the previous one over the
  // same engines and the same panel (AI_Metrics.js B-L4). No like-for-like baseline = no arrow.
  const rowsOf = (name) => { try { return $(name).all().map(x => x.json).filter(r => r && r.site_id === m.site_id && !r.error).sort((x, y) => String(y.checked_at || y.audited_at).localeCompare(String(x.checked_at || x.audited_at))); } catch (e) { return []; } };
  const AVR = rowsOf('Load AI Visibility (Site)'), BLR = rowsOf('Load Backlink Snapshots (Site)'), AUR = rowsOf('Load Audits (Site)');
  const av = AVR[0] || null, bl = BLR[0] || null;
  const engSet = (r) => { let e = {}; try { e = JSON.parse(r.engines_json || '{}') || {}; } catch (x) {} return Object.keys(e).filter(k => k !== 'claude' && !(e[k] || {}).carried).sort().join('+'); };
  const av0 = av ? (AVR.slice(1).find(r => engSet(r) === engSet(av)) || null) : null;
  const avPanelOk = av && av0 && (() => { const a = Number(av.prompts) || 0, b = Number(av0.prompts) || 0; return a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) <= 0.2; })();
  const avWhy = av && !(av0 && avPanelOk) && AVR.length > 1 ? (!av0 ? 'not compared: the earlier runs asked a different set of AI engines' : 'not compared: the earlier run asked ' + n(av0.prompts) + ' questions, this one ' + n(av.prompts)) : '';
  const blKind = (r) => String(r.mode || '') === 'free' ? 'free' : 'index';
  const bl0 = bl ? (BLR.slice(1).find(r => blKind(r) === blKind(bl)) || null) : null;
  const AUDIT_LABEL = { site_audit: 'Technical audit', full: 'Full SEO report' };
  const auAll = []; for (const r of AUR) { const t = String(r.report_type || ''); if (!auAll.includes(t)) auAll.push(t); }
  const auTypes = auAll.some(Boolean) ? auAll.filter(Boolean) : auAll;   // rows without a type (before v4.5) only when nothing newer has one
  const auPairs = auTypes.slice(0, 2).map(t => { const list = AUR.filter(r => String(r.report_type || '') === t); return { t, cur: list[0], prev: t ? (list[1] || null) : null }; });
  if (av || bl || auPairs.length) {
    const dp = (cur, prev) => prev == null ? '' : (cur - prev > 0 ? ' <span style="color:#15803d">▲' + r1(cur - prev) + '</span>' : cur - prev < 0 ? ' <span style="color:#b91c1c">▼' + r1(prev - cur) + '</span>' : '');
    const rows = [];
    if (av) { let comp = []; try { comp = JSON.parse(av.competitors_json || '[]'); } catch (e) {} const pv = av0 && avPanelOk ? av0 : null; rows.push(['<b>AI answers</b> (' + esc(String(av.checked_at).slice(0, 10)) + ')', 'named in ' + r1(av.mention_rate) + '%' + dp(Number(av.mention_rate), pv ? Number(pv.mention_rate) : null) + ' · pages cited in ' + r1(av.citation_rate) + '% · share of voice ' + r1(av.share_of_voice) + '%' + (comp[0] ? ' (leader: ' + esc(comp[0].domain) + ' ' + comp[0].share + '%)' : '') + (avWhy ? ' <span style="color:#64748b">(' + esc(avWhy) + ')</span>' : '') + (av.alerts ? '<br><span style="color:#b91c1c">' + esc(av.alerts) + '</span>' : '')]); }
    if (bl) {
      // R112: the merged count (every source, each link checked on its page) is THE count, as in the backlinks report itself;
      // DataForSEO's own figure is the index's, and a free_only check has no index figures at all
      const free = blKind(bl) === 'free'; const hasU = bl.union_domains !== '' && bl.union_domains != null;
      const count = hasU ? n(bl.union_domains) + ' linking sites (all sources)' + dp(Number(bl.union_domains), bl0 && bl0.union_domains !== '' && bl0.union_domains != null ? Number(bl0.union_domains) : null)
        : n(bl.referring_domains) + ' referring domains (DataForSEO)' + dp(Number(bl.referring_domains), bl0 ? Number(bl0.referring_domains) : null);
      rows.push(['<b>Backlinks</b> (' + esc(String(bl.checked_at).slice(0, 10)) + ', ' + esc(bl.mode) + ')', count + (hasU && !free ? " · DataForSEO's index: " + n(bl.referring_domains) : '') + ' · ' + n(bl.new_links) + ' new / ' + n(bl.lost_links) + ' lost' + (Number(bl.important_lost) ? ' · <b style="color:#b91c1c">' + bl.important_lost + ' important lost</b>' : '') + (Number(bl.spammy_new) ? ' · ' + bl.spammy_new + ' spammy' : '') + (free ? ' · free sources only' : " · spam score " + n(bl.spam_score) + " (the index's)")]);
    }
    for (const pr of auPairs) { const au = pr.cur; rows.push(['<b>' + esc(AUDIT_LABEL[pr.t] || 'Audit') + '</b> (' + esc(String(au.audited_at).slice(0, 10)) + ')', 'health ' + n(au.health_score) + '/100' + dp(Number(au.health_score), pr.prev ? Number(pr.prev.health_score) : null) + ' (' + esc(au.grade) + ') · ' + n(au.critical) + ' critical, ' + n(au.high) + ' high, ' + n(au.medium) + ' medium · ' + n(au.pages_crawled) + ' pages crawled']); }
    html += h3('AI search, backlinks and technical health') + table(['Monitor', 'Latest'], rows) + '<p style="font-size:12px;color:#64748b">Details in the AI-visibility, backlink and audit reports (separate e-mails).</p>';
  }
  if (m.tracked.length) html += h3('Tracked keywords') + table(['Keyword', 'Source', 'Search Console avg', 'Before', 'Live Google check', 'Clicks', 'Impr.', 'Ranking page'], m.tracked.map(t => [esc(t.keyword), esc(t.source === 'ladder' ? (t.rung === 4 ? 'ladder top' : 'ladder rung ' + t.rung) : t.source === 'blog' ? 'blog page' : 'your list'),
    G.connected ? posS(t.gsc_position) : '<span style="color:#94a3b8">connect GSC</span>', G.connected ? posS(t.gsc_prev_position) : '—', t.serp_position == null ? '—' : (t.serp_position > 0 ? '#' + t.serp_position : t.serp_position === 0 ? 'not in top 50' : 'check failed') + (t.serp_checked_at ? '<br><span style="color:#94a3b8;font-size:11px">' + esc(String(t.serp_checked_at).slice(0, 10)) + '</span>' : ''), n(t.clicks), n(t.impressions), link(t.page || t.serp_url)]));
  // B-G3 (2026-10-15, INVARIANTS rule 1 + 2): a rung the read-path fit gate set aside bought no rank check and is not in the table
  // above — so it is named here, with its reason, rather than leaving a shorter list nobody can explain.
  if ((m.set_aside || []).length) html += '<p style="margin:2px 0 8px;font-size:12px;color:#b45309"><b>Set aside</b> (planned before the keyword rule existed): '
    + m.set_aside.map(x => esc(x.note || (x.keyword + ' — ' + x.detail))).join(' | ') + '</p>';
  const linLine = (re) => { const l = linOf(re); return l ? '<p style="margin:2px 0 8px;font-size:11px;color:#64748b">' + esc(LN.note(l)) + '</p>' : ''; };
  if (m.tracked.length) html += linLine(/^Live Google check/) || linLine(/^Clicks, impressions/);
  const C = m.console || { notices: [], last_checkin: null, checkin_due: false };
  if (C.notices.length || C.last_checkin || C.checkin_due) {
    html += h3('Search Console notices and monthly check-in');
    if (C.notices.length) html += table(['Received', 'Kind', 'Notice'], C.notices.slice(0, 8).map(n => [esc(String(n.received_at).slice(0, 10)), esc(n.kind.replace(/_/g, ' ')) + (n.severity === 'critical' ? ' <b style="color:#b91c1c">urgent</b>' : ''), esc(n.subject)]));
    else html += '<p style="font-size:13px;color:#64748b">No Search Console notification in the last 35 days' + (m.service_account_email ? '' : '') + '.</p>';
    if (C.last_checkin) { const ck = C.last_checkin; html += '<p style="font-size:13px"><b>Last check-in (' + esc(ck.month) + '):</b> manual action ' + (ck.manual_action ? '<b style="color:#b91c1c">yes</b>' : 'no') + ', security issue ' + (ck.security_issue ? '<b style="color:#b91c1c">yes</b>' : 'no') + (ck.csv_kind === 'reasons' ? '; Pages report: ' + n(ck.not_indexed_total) + ' pages not indexed' + ((ck.coverage.reasons || []).length ? ' (' + ck.coverage.reasons.slice(0, 3).map(r => esc(r.reason) + ' ' + n(r.pages)).join(', ') + ')' : '') : ck.csv_kind === 'chart' ? '; Pages chart: ' + n(ck.coverage.indexed_total) + ' indexed, ' + n(ck.not_indexed_total) + ' not indexed' : '') + (ck.notes ? '; notes: ' + esc(ck.notes.slice(0, 160)) : '') + '</p>'; }
    if (C.checkin_due) html += '<p style="font-size:13px;color:#b45309"><b>Monthly check-in due:</b> open the <a href="' + esc(m.form_url) + '">form</a> ("Search Console check-in"), answer two questions and upload the Pages report export (Search Console → Pages → Export). It covers what the API cannot see: manual actions, security issues and the site-wide index coverage.</p>';
  }
  // v4.8 publish detection: written pages found live on the site this week (sitemap: planned slug, else title / H1) — shown only when there are some
  const found = m.detected_published || [];
  if (found.length) html += '<div style="background:#f0fdf4;border-left:4px solid #15803d;padding:8px 12px;margin:8px 0;font-size:13px"><b>We found these pages live on your site:</b><ul style="margin:4px 0 0;padding-left:18px">' + found.map(f => '<li><b>' + esc(f.keyword) + '</b> → <a href="' + esc(f.url) + '" style="color:#1d4ed8">' + esc(f.url) + '</a>' + (f.ladder_id ? ' <span style="color:#64748b">(keyword ladder)</span>' : '') + '</li>').join('') + '</ul><p style="margin:4px 0 0">— tracking has started: Google indexing and positions are followed from now on. Not the right page? Report the correct link with "I published a page".</p></div>';
  if ((m.pending_publish || []).length) html += '<p style="font-size:13px;color:#b45309"><b>Written, waiting for your publish link:</b> ' + m.pending_publish.map(p => esc(p.keyword) + ' (' + p.days + ' days ago)').join(', ') + ' — report it through the <a href="' + esc(m.form_url) + '">form</a> ("I published a page") so indexing and positions are tracked.</p>';
  if (m.ladder_pages.length) html += h3('Your pages: index status') + table(['Page', 'Rung', 'Status', 'Indexed', 'Coverage', 'Last crawl'], m.ladder_pages.map(p => [link(p.url), p.rung === 4 ? 'top' : p.rung ? String(p.rung) : 'blog', esc(p.status) + (p.detected ? ' <span style="color:#15803d">(found live this week)</span>' : ''), p.indexed == null ? '<span style="color:#94a3b8">' + esc(p.inspect_error || 'unknown') + '</span>' : (p.indexed ? '<span style="color:#15803d">yes</span>' : '<span style="color:#b91c1c">no</span>'), esc(p.coverage || '—'), esc(p.last_crawl ? String(p.last_crawl).slice(0, 10) : '—')]));
  if (G.connected) {
    // G9 (2026-10-12): every query row is read, so the report can say what Google withholds and split brand from non-brand
    const AN = (G.anonymised || {}).current || null, BS = G.brand_split || null;
    if (AN || BS) html += h3('Where the searches came from') + '<p style="font-size:13px">' +
      (BS ? 'Non-brand (people who did not search your name): <b>' + n(BS.non_brand.clicks) + '</b> clicks from ' + n(BS.non_brand.queries) + ' queries' + (BS.previous.non_brand.clicks ? ' (' + pctS(pct(BS.non_brand.clicks, BS.previous.non_brand.clicks)) + ')' : '') + ' · brand: ' + n(BS.brand.clicks) + ' clicks from ' + n(BS.brand.queries) + ' queries' + (BS.names.length ? ' <span style="color:#64748b">(brand = ' + esc(BS.names.join(', ')) + ')</span>' : '') + '.<br>' : '') +
      (AN ? 'Queries Google does not name (rare searches, withheld for privacy): ' + n(AN.clicks) + ' clicks and ' + n(AN.impressions) + ' impressions, ' + AN.impressions_pct + '% of all impressions.' : '') +
      (G.scraper_queries && G.scraper_queries.count ? '<br>' + n(G.scraper_queries.count) + ' queries came from SEO tools or scrapers (search operators) and are left out of every list above: ' + esc((G.scraper_queries.sample || []).join(', ')) + '.' : '') +
      // C-6 (re-rating 2026-10-17): searches for another website, named apart and never a quick win
      (G.other_site_queries && G.other_site_queries.count ? '<br>' + n(G.other_site_queries.count) + ' searches were for another website, not yours, and are left out of every list above: ' + esc((G.other_site_queries.sample || []).map(x => '"' + x.query + '" (' + x.site + ', ' + x.impressions + ' impressions)').join(', ')) + '.' : '') +
      ((G.truncated || []).length ? '<br><span style="color:#b45309">Search Console returned more rows than this run read (' + esc(G.truncated.join(', ')) + '): the figures below cover the ' + n(G.rows_read) + ' rows read.</span>' : '') + '</p>';
    // B7-6 (W3-D): brand in one place, three sources side by side
    const BSR = m.brand_series || null;
    if (BSR) html += h3('Brand demand: three measurements side by side') + table(['Line', 'Source', 'Before → now', 'Basis'],
        BSR.lines.map(l => l.read ? [esc(l.label), esc(l.source), n(l.prev) + ' → ' + n(l.cur) + ' (' + esc(l.change.text) + ')', esc(l.basis)] : [esc(l.label), esc(l.source), '—', 'Not read: ' + esc(l.reason)]))
      + '<p style="font-size:12px;color:#64748b">' + esc(BSR.note) + '</p>';
    // B7-4 (W3-D): Discover and Google News, only where the property has them; otherwise ONE line that says so
    const STY = G.search_types || null;
    if (STY) for (const [k, lab] of [['discover', 'Discover'], ['google_news', 'Google News']]) { const b = STY[k]; if (!b) continue;
      html += b.has_data ? h3(lab + ' (Google, separate from web search)') + '<p style="font-size:13px"><b>' + n(b.cur.clicks) + '</b> clicks and ' + n(b.cur.impressions) + ' impressions, ' + esc(b.change.text) + '. <span style="color:#64748b">' + esc(b.basis) + '</span></p>'
        : '<p style="font-size:12px;color:#64748b">' + esc(b.reason) + '.</p>'; }
    // B7-5 (W3-D): content groups, each on the same statistical bar as the site-wide alerts
    const CG = G.content_groups || null;
    if (CG && CG.configured) html += h3('How each part of the site is doing') + table(['Group', 'Pages', 'Clicks before → now', 'Verdict'],
        CG.groups.map(g => g.valid ? [esc(g.name), n(g.pages), n(g.prev_clicks) + ' → ' + n(g.clicks), g.change.real ? esc(g.change.direction === 'down' ? 'Fell: ' : 'Grew: ') + esc(g.change.text) : g.change.watch ? 'Watch: ' + esc(g.change.text) + ' (inside normal variation)' : g.change.measurable ? 'No real change' : 'Too few clicks to judge'] : [esc(g.name), '—', '—', 'Not used: ' + esc(g.reason)])
          .concat(CG.ungrouped ? [['All other pages', n(CG.ungrouped.pages), n(CG.ungrouped.prev_clicks) + ' → ' + n(CG.ungrouped.clicks), CG.ungrouped.change.real ? esc(CG.ungrouped.change.text) : 'No real change']] : []))
      + '<p style="font-size:12px;color:#64748b">' + esc(CG.note) + '</p>';
    // B7-8 (W3-D): the latest days, preliminary, apart from every tested figure
    const RC = G.recent || null;
    if (RC && RC.read) html += '<p style="font-size:13px;border-left:4px solid #94a3b8;padding:4px 10px;margin:8px 0"><b>Since the report window</b> (' + esc(RC.start) + ' to ' + esc(RC.end) + ', ' + n(RC.days) + ' day' + (RC.days === 1 ? '' : 's') + '): ' + n(RC.clicks) + ' clicks, ' + n(RC.impressions) + ' impressions'
      + (RC.window_daily_clicks != null ? ' (the report window averaged ' + RC.window_daily_clicks + ' clicks a day)' : '') + '. <span style="color:#64748b">' + esc(RC.label) + '</span></p>';
    // B3-12 (W3-D): Google's Search Console report on generative-AI performance has no API
    html += '<p style="font-size:12px;color:#64748b">Search Console\'s own generative-AI performance report is only in Search Console\'s interface: the Search Analytics API offers no search type or dimension that returns it, so none of its numbers are in this report.</p>';
    // B7-2 (2026-10-15, benchmark area 7): the device and the country, free and first-party. A split Google did not answer prints
    // its reason — an empty table would read as "no phone traffic" (INVARIANTS rule 1).
    const DV = G.devices || null, CO = G.countries || null;
    const DVL = { DESKTOP: 'Desktop', MOBILE: 'Phones', TABLET: 'Tablets' };
    if (DV) html += h3('Where your visitors searched from') + (DV.read
      ? table(['Device', 'Clicks', 'Change', 'Share of clicks', 'Impressions', 'Position'],
          DV.rows.map(d => [esc(DVL[d.key] || d.key), n(d.clicks), deltaS(d.clicks, d.prev_clicks), d.share + '%', n(d.impressions), posS(d.position)]), 'no device rows came back')
      : '<p style="font-size:13px;color:#b45309">' + esc(DV.reason) + '.</p>');
    if (CO && CO.read && CO.rows.length) html += table(['Country', 'Clicks', 'Change', 'Share of clicks', 'Impressions', 'Position'],
      CO.rows.slice(0, 6).map(c => [esc(String(c.key).toUpperCase()), n(c.clicks), deltaS(c.clicks, c.prev_clicks), c.share + '%', n(c.impressions), posS(c.position)]));
    else if (CO && !CO.read) html += '<p style="font-size:13px;color:#b45309">' + esc(CO.reason) + '.</p>';
    // B7-3: two of your own pages shown for one search — observed by Google, never inferred
    const CB = G.cannibal || [];
    if (CB.length) html += h3('Searches two of your pages compete for')
      + table(['Search', 'Impressions', 'Your pages', 'Google shows most often'],
        CB.slice(0, 6).map(c => [esc(c.query), n(c.impressions), c.pages.map(p => link(p.page) + ' <span style="color:#64748b">' + p.share + '% at #' + p.position + '</span>').join('<br>'),
          link(c.preferred) + (c.split ? '<br><span style="color:#b45309;font-size:11px">but ' + esc(c.best.page) + ' ranks better when it is shown</span>' : '')]))
      + '<p style="font-size:12px;color:#64748b">' + esc((G.cannibal_summary || {}).note || '') + '</p>';
    html += h3('Quick wins: striking distance (positions 4-20)') + table(['Query', 'Position', 'Before', 'Impressions', 'Clicks', 'Page'], G.striking.slice(0, 10).map(q => [esc(q.query), posS(q.position), posS(q.prev_position), n(q.impressions), n(q.clicks), link(q.page)]), 'no query between positions 4 and 20 with enough impressions yet');
    if (G.ctr_gaps.length) html += h3('Low click-through for the position (rewrite titles)') + table(['Query', 'Position', 'Impressions', 'CTR', 'Expected', 'Page'], G.ctr_gaps.slice(0, 6).map(q => [esc(q.query), posS(q.position), n(q.impressions), (q.ctr * 100).toFixed(1) + '%', Math.round(q.expected_ctr * 100) + '%', link(q.page)]));
    html += h3('Query movers') + '<table style="border-collapse:collapse;width:100%"><tr><td style="vertical-align:top;padding-right:8px;width:50%"><b style="font-size:13px;color:#15803d">Winners</b>' + table(['Query', 'Clicks', 'Position'], G.winners.slice(0, 6).map(q => [esc(q.query), n(q.clicks) + ' (' + deltaS(q.clicks, q.prev_clicks) + ')', posS(q.position) + (q.prev_position ? ' <span style="color:#94a3b8">was ' + posS(q.prev_position) + '</span>' : '')]), 'no clear winners') + '</td><td style="vertical-align:top;width:50%"><b style="font-size:13px;color:#b91c1c">Losers</b>' + table(['Query', 'Clicks', 'Position'], G.losers.slice(0, 6).map(q => [esc(q.query), n(q.clicks) + ' (' + deltaS(q.clicks, q.prev_clicks) + ')', posS(q.position) + (q.prev_position ? ' <span style="color:#94a3b8">was ' + posS(q.prev_position) + '</span>' : '')]), 'no clear losers') + '</td></tr></table>';
    if (G.new_queries.length || G.lost_queries.length) html += '<p style="font-size:13px"><b>New queries:</b> ' + (G.new_queries.slice(0, 8).map(q => esc(q.query) + ' (' + n(q.impressions) + ' impr.)').join(', ') || 'none') + '<br><b>Lost queries:</b> ' + (G.lost_queries.slice(0, 8).map(q => esc(q.query) + ' (' + n(q.prev_clicks) + ' clicks before)').join(', ') || 'none') + '</p>';
    html += h3('Pages') + table(['Page', 'Clicks', 'Change', 'Impressions', 'Position'], G.top_pages.slice(0, 8).map(p => [link(p.page, p), n(p.clicks), deltaS(p.clicks, p.prev_clicks), n(p.impressions), posS(p.position)]));
    // B4-1 (2026-10-15, benchmark area 4): every page with clicks is tested against the 28 days before AND the same 28 days a
    // year earlier, so this list is what really decayed — and the line underneath names what was checked and refused, because a
    // report that only prints its hits cannot be told apart from one that found nothing.
    if (G.decaying_pages.length) html += '<p style="font-size:13px"><b style="color:#b91c1c">Pages losing traffic:</b> ' + G.decaying_pages.slice(0, 5).map(p => esc(path(p.page, p)) + ' (' + n(p.prev_clicks) + ' → ' + n(p.clicks) + ' clicks, −' + n(p.lost) + (p.kind === 'clickthrough' ? ', still shown as often: title and description first' : '') + ')').join('; ') + '</p>';
    if (G.decay_summary && G.decay_summary.tested) { const ds = G.decay_summary;
      html += '<p style="font-size:12px;color:#64748b">Decay check: ' + n(ds.tested) + ' pages tested, <b>' + n(ds.decaying) + '</b> really losing traffic'
        + (ds.seasonal ? ', ' + n(ds.seasonal) + ' down only against the weeks before and not against a year ago (seasonal)' : '')
        + (ds.watch ? ', ' + n(ds.watch) + ' large but inside sampling noise' : '')
        + (ds.too_small ? ', ' + n(ds.too_small) + ' with too few clicks to test (under ' + n(ds.min_click_events) + ' over both periods)' : '')
        + '. ' + esc(ds.note) + '</p>'; }
  }
  if (A.connected) html += h3('Traffic (GA4, organic search)') + '<p style="font-size:13px">Organic: <b>' + n(A.organic.cur.sessions) + '</b> sessions (' + pctS(pct(A.organic.cur.sessions, A.organic.prev.sessions)) + '), ' + n(A.organic.cur.engaged) + ' engaged, ' + n(A.organic.cur.key_events) + ' key events, ' + n(A.organic.cur.users) + ' users · all channels: ' + n(A.total.cur.sessions) + ' sessions' + (A.channels.length ? ' (' + A.channels.slice(0, 4).map(c => esc(c.channel) + ' ' + n(c.sessions)).join(', ') + ')' : '') + (A.detected ? ' · property ' + esc(A.property_id) + ' detected automatically' : '') + '</p>' + table(['Landing page', 'Organic sessions', 'Change', 'Engaged', 'Key events'], A.landing.slice(0, 8).map(l => [link(l.page), n(l.sessions), deltaS(l.sessions, l.prev_sessions), n(l.engaged), n(l.key_events)]));
  if (m.trends.length) html += h3('Search interest (Google Trends, 12 months)') + table(['Keyword', 'Direction', 'Last 4 weeks vs average', 'Peak', 'Rising related searches'], m.trends.map(t => [esc(t.keyword), t.error ? '<span style="color:#94a3b8">' + esc(t.error) + '</span>' : t.direction === 'sparse' ? '<span style="color:#94a3b8">too little search volume for a trend</span>' : esc(t.direction), (t.change_pct == null || t.direction === 'sparse') ? '—' : (t.change_pct > 0 ? '+' : '') + t.change_pct + '%', esc(t.peak_date ? String(t.peak_date).slice(0, 7) : '—'), esc((t.rising || []).slice(0, 4).map(r => r.query + ' (' + r.value + ')').join(', ') || '—')]));
  if (m.trends.length) html += linLine(/^Search interest/);
  if (LIN.length) html += LN.block(LIN);
  if (b && (b.watch || []).length) html += h3('Watch') + '<ul style="font-size:13px;margin:4px 0;padding-left:18px">' + b.watch.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
  html += '<p style="color:#64748b;font-size:12px;margin-top:16px">' + (G.connected ? 'A fall in clicks, impressions or sessions is only called a fall when it is beyond normal week-to-week variation (two-sample Poisson test, 95%); a larger move at low volume is shown as "Watch". ' : '') + 'Search Console figures are final up to 3 days ago and are averages across devices and locations; the live Google check is one SERP sample from DataForSEO. Trends are a relative index (100 = peak of the year). Reports run ' + (planOf(m.site_id).every_week || 'each week') + (planOf(m.site_id).cycle ? ' (this website\'s weekly cycle)' : '') + (m.tracked.some(t => t.source === 'ladder') ? '; the keyword ladder gets its own progress e-mail' : '') + '. Reply to this e-mail to pause tracking.</p></div>';
  const hi = m.alerts.filter(a => a.level === 'high').length; const parts = [];
  // R113 (2026-10-16): the subject follows the report's own significance test (G28). Clicks 21 -> 32 is "up 52%" in arithmetic and
  // "not a real change" in the test printed under it, so the subject no longer says "32 clicks ▲ 52%": it leads with a change the test
  // calls real and says the clicks are within normal variation. Without a significance block (older runs) the subject is unchanged.
  const SG = m.significance || null, SC = SG && SG.clicks;
  if (G.connected && SC && SC.real === false) {
    const realOne = ['impressions', 'sessions'].find(k => SG[k] && SG[k].real === true && SG[k].pct != null);
    if (realOne) parts.push(realOne + ' ' + pctS(SG[realOne].pct));
    parts.push(n(G.totals.cur.clicks) + ' clicks (within normal variation)');
  } else if (G.connected) parts.push(n(G.totals.cur.clicks) + ' clicks ' + pctS(G.deltas.clicks_pct)); if (hi) parts.push(hi + ' alert' + (hi > 1 ? 's' : '')); if (found.length) parts.push(found.length + ' page' + (found.length > 1 ? 's' : '') + ' found live'); if (G.connected && G.striking.length) parts.push(G.striking.length + ' quick win' + (G.striking.length > 1 ? 's' : ''));
  const subject = (G.connected ? '[SEO weekly] ' : '[SEO tracking] ') + m.domain + ' — ' + (parts.length ? parts.join(' · ') : 'connect Google Search Console to see real data');
  const file_name = 'seo-performance-' + m.domain.replace(/[^a-z0-9.]+/g, '-') + '-' + m.period.current.end + '.html';
  const doc = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(subject) + '</title></head><body style="margin:24px">' + html + '</body></html>';
  return { json: { ...m, brief: b, subject, html, file_name, status: 'progress', stage: 'site_tracker' }, binary: { data: { data: Buffer.from(doc, 'utf8').toString('base64'), mimeType: 'text/html', fileName: file_name, fileExtension: 'html' } } };
});
