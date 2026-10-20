// "Coming up" (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §5.7 / §14.4): the Cycle Dispatcher runs the cadence in preview mode 48 h before each
// website's cycle. *Cadence Plan* planned exactly what that cycle would write and wrote nothing (`preview: true`, `dry_run: true`); this node
// turns its one item per site into ONE `cycle_preview` callback (shape CyclePreview in app/shared/src/cycles.ts) and the e-mail beside it,
// through the same e-mail / callback nodes as the weekly note. Each item says why it was chosen, what it would cost, and whether it is written
// on its own (`auto: true`, the client may Skip it) or waits for the client's OK (`auto: false`, Approve / Skip). A website with nothing to
// write still sends its status: waiting for its first keyword, paused (pile-up or the website itself), or no pages a week.
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
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const arr = (v) => Array.isArray(v) ? v : [];
// F-KW (2026-10-20, finding 10): no raw dollar figure in a customer's e-mail: the app shows each item's cost in credits (est_usd travels in the callback)
const LEVEL_LABEL = { 1: 'Only my keywords', 2: 'My keywords and keep my pages healthy', 3: 'Full autopilot' };   // cycles.ts AUTOPILOT_LEVELS
const SRC = { ladder: 'your keyword ladder', decay: 'a page of yours losing visitors', striking: 'close to page one', trend: 'a rising search', ai_answer: 'a question AI answers without you', ai_refresh: 'a page AI could quote better' };
return $('Cadence Plan').all().map(i => i.json).filter(p => p && p.preview === true && p.site_id).map(p => {
  const items = arr(p.items), sug = arr(p.suggestions), auto = items.filter(x => x.auto), ok = items.filter(x => !x.auto);
  const level = [1, 2, 3].includes(Number(p.level)) ? Number(p.level) : 2;
  const when = String(p.scheduled_for || '').slice(0, 10) || String(p.cycle_date || '');
  const li = (x) => '<li><b>' + esc(x.keyword) + '</b> (' + esc(SRC[x.source] || x.source) + '): ' + esc(x.why) + (x.existing_page_url ? '; improves ' + esc(x.existing_page_url) : '') + '</li>';
  const status = p.waiting_for_keyword ? '<p><b>Waiting for your first keyword.</b> Choose the keyword you want to be found for: nothing is written until you do.</p>'
    : p.paused_reason === 'pileup' ? '<p style="color:#b45309"><b>Paused:</b> ' + esc(p.waiting_publish) + ' written pages are waiting to be published (limit ' + esc(p.max_waiting) + '). Publish them so the next cycle can write.</p>'
    : p.paused_reason === 'site_paused' ? '<p style="color:#b45309"><b>This website is paused.</b> Its next cycle writes nothing until it is resumed.</p>'
    : !Number(p.pages_per_week) ? '<p>No pages a week are set for this website, so nothing is written on its own.</p>' : '';
  const html = '<p>Hi,</p><p>Coming up for <b>' + esc(p.domain) + '</b> in the cycle of ' + esc(when) + ' (autopilot: ' + esc(LEVEL_LABEL[level]) + ', ' + esc(Number(p.pages_per_week) || 0) + ' page(s) a week):</p>' + status
    + (auto.length ? '<p><b>Written on their own</b> (skip any you do not want):</p><ol>' + auto.map(li).join('') + '</ol>' : '')
    + (ok.length ? '<p><b>Waiting for your OK</b>:</p><ol>' + ok.map(li).join('') + '</ol>' : '')
    + (sug.length ? '<p><b>Suggestions</b> (written only if you approve them):</p><ol>' + sug.map(li).join('') + '</ol>' : '')
    + (arr(p.refused).length ? '<p style="color:#64748b"><b>Not suggested</b> (not a search this website should target): ' + arr(p.refused).slice(0, 6).map(x => esc(x.keyword) + ' (' + esc(x.reason) + ')').join(', ') + '</p>' : '')
    + (!auto.length && !ok.length && !sug.length && !status ? '<p>Nothing to write in this cycle.</p>' : '')
    + '<p style="color:#64748b;font-size:12px">Approve or skip each item in the app before the cycle starts. The app shows what each page costs in credits.</p>';
  // INVARIANTS rule 1: every figure of the plan says where it came from (the price is the run guard's own estimate, the plan is computed)
  const lineage = [LN.of('the cost of each page (shown in credits in the app)', 'model', { basis: 'estimated', note: 'the run guard\'s own estimate of one written page' }),
    LN.of(items.length + ' planned item(s), ' + sug.length + ' suggestion(s)', 'model', { basis: 'modelled', period: 'the cycle of ' + when, note: 'planned from your keyword ladders, your settings, your skips and the site data on file; nothing is written by this plan' })];
  const htmlL = html + LN.block(lineage);
  const callback_body = { site_id: p.site_id, domain: p.domain, cycle_key: String(p.cycle_key || ''), cycle_date: String(p.cycle_date || ''), scheduled_for: String(p.scheduled_for || ''), trigger: 'cycle',
    level, pages_per_week: Number(p.pages_per_week) || 0, waiting_for_keyword: !!p.waiting_for_keyword, paused_reason: String(p.paused_reason || ''), reason: String(p.reason || ''),
    items, suggestions: sug, refused: arr(p.refused), skipped: arr(p.skipped), budget: p.budget || null, est_page_usd: Number(p.est_page_usd) || 0, est_basis: String(p.est_basis || '') };
  return { json: { site_id: p.site_id, domain: p.domain, email: p.email || '', callback_url: p.callback_url || '', request_id: p.request_id, status: 'progress', stage: 'cycle_preview', week: p.week,
    subject: '[Coming up] ' + p.domain + ': ' + (p.waiting_for_keyword ? 'choose your first keyword' : auto.length + ' page(s) written on their own, ' + (ok.length + sug.length) + ' waiting for your OK'),
    html: htmlL, lineage, callback_body: { ...callback_body, lineage } } };
});
