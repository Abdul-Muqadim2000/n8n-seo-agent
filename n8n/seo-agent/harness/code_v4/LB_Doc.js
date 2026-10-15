// Link Builder — the full weekly document (L3, 2026-10-13, system review FIX_PLAN.md L3; criterion REP 3.6 "Formats"). The weekly e-mail
// stays a summary; THIS is the whole week in one printable document, rendered to PDF by the next nodes (Prepare / Render / Attach PDF LB,
// Gotenberg) and delivered with the callback so the app can offer it like the other reports' PDFs.
// It only READS what *LB Assemble* and *LB Rows* decided (qualification, contacts, our page, link text, sequences, listings, redirects,
// impact) — no decision is taken here — and it carries G29's lineage notes (LN) and G12's control-group wording (CT) unchanged.
// Sections: what to do this week · every opportunity with its qualification · the contacts found on the prospect's own domain · our page
// and the link text per prospect · each drafted sequence with its status (including the ones the quality gate held, with the reasons) ·
// the listings checklist · redirects to reclaim · what the links and the page changes did · where these numbers come from.
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
// ---- change test (G12, 2026-10-13, system review FIX_PLAN.md; CRITERIA_technical_tracking_reporting_ai_links.md 3.4) ----
// "We changed the page and clicks went up" is not a result: seasonality and Google's own updates move every page on a site at once
// (P1: CausalImpact, Brodersen et al. 2015 - measuring a change needs a control or a counterfactual; P2: even the most reliable test
// type SearchPilot publishes wins only about 2 times in 3). The Link Builder already measured a won link against a control group of
// the site's OTHER pages over the same weeks; this kit is that same comparison, lifted out so a PAGE CHANGE can be read the same way.
// The verdicts are graded and deliberately weak: "likely helped" / "possibly helped" / "no clear effect yet" / "too early to tell" /
// "can't tell". Nothing here ever says a change CAUSED anything - a control group narrows the alternatives, it does not prove a cause.
const CT = (() => {
  const LABELS = { likely_helped: 'Likely helped', possibly_helped: 'Possibly helped', no_effect_yet: 'No clear effect yet', too_early: 'Too early to tell', cant_tell: 'Can\'t tell' };
  const MIN_WEEKS = 6;          // a change read before 6 weeks says "too early": Google needs weeks to settle (P2: ~10 weeks per position for a link)
  const MIN_OTHERS = 3;         // fewer than 3 other pages to compare with = no usable control group, so the verdict can only be "possibly"
  const r1 = (n) => Math.round(10 * n) / 10;
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
  const S = (v) => String(v == null ? '' : v);
  const NOTES = {
    link: { early: 'read at 6, 10 and 16 weeks after the link went live', no_data: 'the page had no search impressions before or after the link' },
    page: { early: 'read at 6, 10 and 16 weeks after the change', no_data: 'the page had no search impressions before or after the change' },
  };
  const label = (v) => LABELS[v] || S(v);
  /**
   * One change, against the control group of the site's other pages over the same window. Positions: lower is better, so a positive
   * `page_change` means the page moved UP. `others` are the control pages' own moves (before - after), unrounded.
   * o: { weeks, base, now, others, joint, kind, min_weeks, min_others, no_data, early }
   */
  const compare = (o) => {
    const x = o || {}; const kind = NOTES[x.kind] ? x.kind : 'page';
    const minWeeks = x.min_weeks == null ? MIN_WEEKS : x.min_weeks, minOthers = x.min_others == null ? MIN_OTHERS : x.min_others;
    const weeks = Math.max(0, Math.floor(Number(x.weeks) || 0));
    const out = { weeks, base_position: 0, position: 0, page_change: 0, control_change: 0, control_spread: 0, control_pages: 0, effect: 0, verdict: '', verdict_label: '', note: '' };
    if (weeks < minWeeks) { out.verdict = 'too_early'; out.note = S(x.early) || NOTES[kind].early; out.verdict_label = label(out.verdict); return out; }
    const base = x.base == null || x.base === '' ? null : Number(x.base), now = x.now == null || x.now === '' ? null : Number(x.now);
    if (!Number.isFinite(base) || !Number.isFinite(now) || base <= 0 || now <= 0) {
      out.verdict = 'cant_tell'; out.note = S(x.no_data) || NOTES[kind].no_data; out.verdict_label = label(out.verdict); return out; }
    const others = (x.others || []).map(Number).filter(Number.isFinite);
    out.base_position = r1(base); out.position = r1(now); out.page_change = r1(out.base_position - out.position);
    const mid = median(others);
    out.control_change = r1(mid); out.control_spread = r1(median(others.map(d => Math.abs(d - mid)))); out.control_pages = others.length;
    out.effect = r1(out.page_change - out.control_change);
    const joint = Number(x.joint) || 0;
    out.verdict = others.length < minOthers ? (out.effect > 1 ? 'possibly_helped' : 'no_effect_yet')
      : out.effect > Math.max(1, 2 * out.control_spread) && !joint ? 'likely_helped'
      : out.effect > Math.max(0.5, out.control_spread) ? 'possibly_helped' : 'no_effect_yet';
    out.verdict_label = label(out.verdict);
    out.note = (joint ? (kind === 'link' ? 'another link to this page within 4 weeks (credit shared); ' : 'another change to this page within 4 weeks (credit shared); ') : '')
      + (others.length < minOthers ? 'few other pages to compare with; ' : '')
      + 'position ' + out.base_position + ' → ' + out.position + ' vs the site\'s other pages ' + (out.control_change >= 0 ? '+' : '') + out.control_change;
    return out;
  };
  const method = 'Each change is dated and read against a control group: the same page\'s average Google position before and after, minus what the site\'s OTHER pages did over the same weeks. That removes the part of the move that was the season, the market or a Google update. "Likely helped" means the page beat its control group by more than twice the spread of the control group itself and nothing else changed on that page in the same four weeks; "possibly helped" means it beat the control group by less than that; "no clear effect yet" means it did not. A control group narrows the alternatives: it is never proof of cause.';
  const summary = (rows) => { const list = (rows || []); const by = (v) => list.filter(r => r.verdict === v).length;
    return { total: list.length, likely_helped: by('likely_helped'), possibly_helped: by('possibly_helped'), no_effect_yet: by('no_effect_yet'), too_early: by('too_early'), cant_tell: by('cant_tell'),
      read: list.filter(r => !['too_early', 'cant_tell'].includes(r.verdict)).length }; };
  return { compare, label, summary, method, LABELS, NOTES, MIN_WEEKS, MIN_OTHERS, r1, median };
})();
const A = $('LB Assemble').all().map(i => i.json).filter(s => !s.skip);
const R = $('LB Rows').all().map(i => i.json);
const parse = (t, d) => { try { const v = JSON.parse(t || ''); return v == null ? d : v; } catch (e) { return d; } };
const ANGLE = { broken: 'Dead link on their page', lost: 'Link to restore', mention: 'Mention without a link', list: 'List that leaves you out', ai_source: 'Page AI cites', resource: 'Resource page', gap: 'Links to competitors', comp_new: 'Just linked to a competitor', press: 'Journalist request', redirect: 'Old URL of yours' };
const ROW_STATUS = { drafted: 'Pitch ready for your approval', needs_edit: 'Held for your edit', ready: 'Qualified, waiting for a slot', needs_contact: 'No address on their site', not_fit: 'Not a fit', fix: 'Fix on your own site', won: 'Link live', sent: 'Sent', queued: 'Queued' };
const LIST_STATUS = { linked: 'Listed and linking to you', listed: 'Listed (no link seen)', missing: 'Not listed', submitted: 'Submitted, waiting', unknown: 'Not checked (the site blocks checks)', ignored: 'Not relevant' };
const CHANGE = { published: 'Published', rewritten: 'Rewritten' };
const VERDICT = CT.LABELS;
const ANCHOR = { brand: 'your business name', title: 'the page title', url: 'the page URL' };
const DOC_CSS = '<style>h2,h3{page-break-after:avoid}table{page-break-inside:auto}tr{page-break-inside:avoid}.seq{page-break-inside:avoid;border:1px solid #e2e8f0;padding:8px 10px;margin:6px 0}.step{white-space:pre-wrap;font-size:12px;color:#334155;margin:4px 0 0}</style>';
const cut = (s, n) => { const t = String(s == null ? '' : s); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const pct = (v) => v == null || v === '' ? '—' : Math.round(Number(v) * 100) + '%';
return $input.all().map(item => {
  const d = item.json || {};
  const s = A.find(x => x.site_id === d.site_id) || A[0] || {};
  const r = R.find(x => x.site_id === d.site_id) || {};
  const rows = (r.outreach_rows && r.outreach_rows.length ? r.outreach_rows : (s.outreach_rows || []));
  const day = String(d.checked_at || s.checked_at || new Date().toISOString()).slice(0, 10);
  const sm = d.summary || s.summary || {};
  const pitch = rows.filter(o => ['drafted', 'needs_edit'].includes(o.status) && String(o.drafted_at || '') === String(s.checked_at || d.checked_at));
  const drafted = pitch.filter(o => o.status === 'drafted');
  const held = pitch.filter(o => o.status === 'needs_edit');
  const opportunities = rows.filter(o => o.type !== 'redirect').slice().sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
  const fixes = rows.filter(o => o.type === 'redirect');
  const listings = (s.listing_rows || []).slice().sort((a, b) => (a.status === 'linked') - (b.status === 'linked') || (Number(a.priority) || 0) - (Number(b.priority) || 0));
  const impacts = s.impact_rows || [];
  const reads = impacts.filter(x => x.kind !== 'page_change');
  const changeReads = impacts.filter(x => x.kind === 'page_change');
  const contactRows = [];
  for (const o of opportunities) for (const c of (parse(o.contacts_json, []) || []))
    if (c && c.email) contactRows.push({ prospect: o.prospect_domain, email: c.email, kind: c.kind || c.role || 'contact', name: c.name || '', source: c.source_url || '' });

  let html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:860px;color:#0f172a">' + DOC_CSS;
  html += '<h2 style="margin:0 0 4px">Link building — the full week for ' + esc(s.domain || d.domain) + '</h2>'
    + p_(esc(day) + ' · every opportunity found this week, how each was qualified, the contacts on their own sites, the page and link text we would ask for, the pitches drafted for your approval, the places you can list yourself, the redirects to add, and what your links and page changes did', true);
  if (d.free_only || s.free_only) html += p_('<b>Free check</b>: opportunities, contacts, listings and redirects only — no e-mails were drafted and no paid backlink data was read.', true);
  html += '<table style="border-collapse:collapse;margin:8px 0"><tr>'
    + tile('Pitches ready', n(drafted.length), held.length ? held.length + ' more need your edit' : 'approve them in the app')
    + tile('Opportunities qualified', n(sm.qualified), n(sm.not_fit) + ' turned down with a reason')
    + tile('Not listed yet', n(sm.listings_missing), 'places to add yourself')
    + tile('Redirects to add', n(fixes.length), 'old URLs of yours that 404')
    + '</tr></table>';

  // ---- 1. what to do this week ----
  const todo = [];
  if (drafted.length) todo.push('Approve ' + n(drafted.length) + ' drafted pitch(es) in the app — they go out from your own mailbox, one by one, after you approve them.');
  if (held.length) todo.push('Edit ' + n(held.length) + ' pitch(es) the quality gate held (the reasons are with each one below), or leave them: nothing is sent until you approve it.');
  if (sm.press) todo.push('Answer ' + n(sm.press) + ' journalist request(s) on your topics before their deadlines.');
  if (sm.listings_missing) todo.push('Add your business to ' + n(sm.listings_missing) + ' list(s) you are missing from — these are links you place yourself, no outreach needed.');
  if (fixes.length) todo.push('Add ' + n(fixes.length) + ' redirect(s) so the links and bookmarks pointing at your old URLs keep working.');
  if (rows.some(o => o.status === 'needs_contact')) todo.push(n(rows.filter(o => o.status === 'needs_contact').length) + ' good prospect(s) publish no e-mail address: their contact forms are listed in the app.');
  html += h3('What to do this week') + (todo.length ? '<ol style="font-size:13px;margin:6px 0 0;padding-left:20px">' + todo.map(t => '<li style="margin:3px 0">' + esc(t) + '</li>').join('') + '</ol>' : p_('Nothing needs you this week.', true));

  // ---- 2. every opportunity with its qualification ----
  html += h3('Every opportunity and how it was qualified')
    + p_('Each site was fetched and read before it was offered. A page behind a bot wall is never called "not a fit" — it is kept for a person to look at.', true)
    + table(['Site / page', 'Why them', 'What we decided', 'Topic match', 'Evidence we would quote'], opportunities.slice(0, 60).map(o => [
      link(o.page_url || '', o.prospect_domain) + (o.page_title ? '<div style="font-size:12px;color:#64748b">' + esc(cut(o.page_title, 90)) + '</div>' : ''),
      esc(ANGLE[o.type] || o.type) + (o.deadline ? '<div style="font-size:12px;color:#64748b">deadline ' + esc(o.deadline) + '</div>' : ''),
      esc(ROW_STATUS[o.status] || o.status) + (o.fit_reason ? '<div style="font-size:12px;color:#64748b">' + esc(cut(String(o.fit_reason).replace(/^held for your edit: /, 'held: '), 200)) + '</div>' : ''),
      pct(o.fit),
      esc(cut(o.evidence, 240)),
    ]), 'no opportunities this week');

  // ---- 3. contacts, only on the prospect's own domain ----
  html += h3('Contacts found on the prospect\'s own site')
    + p_('An address is only used when it sits on the prospect\'s own domain: an agency or a partner address printed on their page is never taken as their contact.', true)
    + table(['Site', 'Address', 'Who', 'Where we found it'], contactRows.slice(0, 60).map(c => [esc(c.prospect), esc(c.email), esc([c.name, c.kind].filter(Boolean).join(' · ')), link(c.source, c.source ? undefined : '—')]),
      'no addresses on their own domains this week');

  // ---- 4. our page and the link text per prospect ----
  html += h3('The page we would ask them to link to, and the link text')
    + p_('One page per prospect, chosen by topic match, how close that page is to the first results page, and how many links it still needs — spread across your pages so one page is not asked for every time. The link text is your business name, the page title or the page URL, never a keyword.', true)
    + table(['Site', 'Our page', 'Why this page', 'Link text to ask for'], opportunities.filter(o => o.target_url).slice(0, 60).map(o => [
      esc(o.prospect_domain), link(o.target_url), esc(cut(o.target_reason, 180)), esc(ANCHOR[o.anchor_hint] || o.anchor_hint || '—')]),
      'no page was matched this week');

  // ---- 5. the drafted sequences and their status ----
  html += h3('The pitches drafted this week, exactly as they would be sent');
  if (!pitch.length) html += p_((d.free_only || s.free_only) ? 'This was a free check: nothing was drafted.' : 'Nothing was drafted this week.', true);
  for (const o of pitch) {
    const seq = parse(o.sequence_json, []) || [];
    const okRow = o.status === 'drafted';
    html += '<div class="seq"><div style="font-size:13px"><b>' + esc(o.prospect_domain) + '</b> · ' + esc(ANGLE[o.type] || o.type)
      + ' · <span style="color:' + (okRow ? '#15803d' : '#b45309') + '">' + esc(ROW_STATUS[o.status] || o.status) + '</span>'
      + (o.contact_email ? ' · ' + esc(o.contact_email) : o.contact_form_url ? ' · ' + link(o.contact_form_url, 'contact form') : '')
      + (o.country ? ' · ' + esc(o.country) : '') + '</div>'
      + (okRow ? '' : '<div style="font-size:12px;color:#b45309;margin-top:2px">Held because: ' + esc(cut(String(o.fit_reason || '').replace(/^held for your edit: /, ''), 400)) + '</div>')
      + (o.target_url ? '<div style="font-size:12px;color:#64748b;margin-top:2px">Links to ' + link(o.target_url) + ' as ' + esc(ANCHOR[o.anchor_hint] || o.anchor_hint || 'the page title') + '</div>' : '')
      + seq.map((st, i) => '<div class="step"><b>' + esc(i === 0 ? 'First e-mail' : 'Follow-up ' + i) + (st.wait_days ? ' — after ' + n(st.wait_days) + ' working day(s)' : ' — now') + '</b>'
        + (st.subject ? '<br>Subject: ' + esc(st.subject) : '<br>Subject: (keeps the first e-mail\'s subject, same thread)') + '<br>' + esc(cut(st.body, 1200)) + '</div>').join('')
      + '</div>';
  }
  if (pitch.length) html += p_('Every pitch is checked before it is offered: nothing is claimed about your business that your profile does not carry, the address is on their own domain, something from their page is quoted, there is one link to the page we chose, and the e-mail is short with one clear ask. A pitch that fails a check is held with its reasons instead of being offered.', true);

  // ---- 6. the listings checklist ----
  html += h3('Links you can add yourself (the listings checklist)')
    + table(['Where', 'Status', 'Competitors there', 'Why it is worth it', 'Where to add yourself'], listings.map(l => [
      esc(l.name), esc(LIST_STATUS[l.status] || l.status) + (l.profile_url ? '<div style="font-size:12px">' + link(l.profile_url, 'profile') + '</div>' : ''),
      esc(l.competitors || '—'), esc(cut(l.why, 220)), l.submit_url && l.status !== 'linked' ? link(l.submit_url, 'open') : '—']), 'no listings checked this week');

  // ---- 7. redirects to reclaim ----
  html += h3('Redirects to add (old URLs of yours that now answer 404)')
    + table(['Old URL', 'Redirect to', 'What we saw'], fixes.slice(0, 40).map(f => [esc(f.page_url), link(f.target_url), esc(cut(f.target_reason, 160))]),
      'no old URLs of yours are answering 404');

  // ---- 8. what the links and the page changes did (G12 wording, control group) ----
  html += h3('What your links did') + table(['Link from', 'Your page', 'Weeks', 'Position', 'Reading'], reads.slice(0, 40).map(x => [
    esc(x.ref_domain), link(x.target_url), n(x.weeks), x.base_position ? esc(x.base_position + ' → ' + x.position) : '—',
    esc(VERDICT[x.verdict] || x.verdict) + (x.note ? '<div style="font-size:12px;color:#64748b">' + esc(cut(x.note, 200)) + '</div>' : '')]), 'no link has been live long enough to read yet');
  html += h3('What your page changes did') + table(['Page', 'Change', 'Since', 'Weeks', 'Position', 'Reading'], changeReads.slice(0, 40).map(x => [
    link(x.target_url), esc(CHANGE[x.change] || x.change || 'changed'), esc(x.t0), n(x.weeks), x.base_position ? esc(x.base_position + ' → ' + x.position) : '—',
    esc(VERDICT[x.verdict] || x.verdict) + (x.note ? '<div style="font-size:12px;color:#64748b">' + esc(cut(x.note, 200)) + '</div>' : '')]), 'no page change is old enough to read yet');
  html += p_(esc(CT.method), true);

  // ---- 9. where these numbers come from (G29) ----
  const lineage = (d.lineage && d.lineage.length ? d.lineage : [LN.unknown('The figures in this document', 'the report that builds them did not record their sources')]);
  html += LN.block(lineage);
  html += p_('Nothing is sent for you: every pitch waits for your approval in the app and goes out from your own mailbox. Listings are never submitted automatically, and no link is ever placed on a site we do not own.', true) + '</div>';

  const title = 'Link building — ' + (s.domain || d.domain) + ' — ' + day;
  return { json: { ...d, doc_sections: { opportunities: opportunities.length, contacts: contactRows.length, drafted: drafted.length, held: held.length, listings: listings.length, redirects: fixes.length, impact: reads.length, page_changes: changeReads.length }, doc_title: title },
    binary: { ...(item.binary || {}), data: { data: b64(wrapDoc(title, html)), mimeType: 'text/html', fileName: d.file_name || ('link-building-' + String(s.domain || d.domain).replace(/[^a-z0-9]+/gi, '-') + '-' + day + '.html'), fileExtension: 'html' } } };
});
