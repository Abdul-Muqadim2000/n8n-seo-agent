// harness shim (written by build_v4.py section 47): the annotation kit — { from, to, published, audits, links } -> the dated marks of that window
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
  return { marks, html, inRange, breakBetween, EVENTS, KINDS, UPDATES: EVENTS.google_updates || [], BREAKS: EVENTS.data_breaks || [] };
})();
return $input.all().map(i => { const j = i.json || {}; const marks = AN.marks(j);
  return { json: { marks, html: AN.html(marks), breaks: AN.breakBetween(j.from, j.to), updates: AN.UPDATES, data_breaks: AN.BREAKS, registry_updated: AN.EVENTS.updated } }; });
