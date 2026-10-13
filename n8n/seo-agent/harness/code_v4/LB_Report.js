// Link Builder report per site (e-mail / callback stage link_builder; v4.13): pitches drafted and waiting for approval in the app, journalist
// requests on your topics, links you can add yourself (the listings checklist), redirects to add, and what won links did for their pages.
// G12 / G29 (2026-10-13, FIX_PLAN): "What your page changes did" reads a published or rewritten page against the same control group
// as a won link (one implementation, CT), and every figure carries its source, period and sample (LN).
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
  return { of, unknown, note, html, line, block, range, asOf, days, sample, isHonest, SOURCES, BASIS, MISSING };
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
// reads LB Assemble and LB Rows explicitly: the node before this one saves Data Table rows and outputs those rows
const A = $('LB Assemble').all().map(i => i.json).filter(s => !s.skip); const R = $('LB Rows').all().map(i => i.json);
const parse = (t, d) => { try { return JSON.parse(t || ''); } catch (e) { return d; } };
const ANGLE = { broken: 'Dead link on their page', lost: 'Link to restore', mention: 'Mention without a link', list: 'List that leaves you out', ai_source: 'Page AI cites', resource: 'Resource page', gap: 'Links to competitors', comp_new: 'Just linked to a competitor', press: 'Journalist request', digest: 'Journalist request (digest)', podcast: 'Podcast that takes guests' };
const ASSET_KIND = { data: 'Data study', tool: 'Free tool', template: 'Template', guide: 'Definitive guide' };   // L6
const VERDICT = CT.LABELS;   // G12: one set of graded verdicts for links and page changes
const CHANGE = { published: 'Published', rewritten: 'Rewritten' };
const STATUS = { linked: 'Linked', listed: 'Listed (no link seen)', missing: 'Not listed', submitted: 'Submitted', unknown: 'Not checked (the site blocks checks)', ignored: 'Not relevant' };
return A.map(s => {
  const r = R.find(x => x.site_id === s.site_id) || { outreach_rows: s.outreach_rows, drafted: 0, skipped: 0 };
  const rows = r.outreach_rows || [];
  const drafted = rows.filter(o => o.status === 'drafted' && String(o.drafted_at) === s.checked_at);
  const heldRows = rows.filter(o => o.status === 'needs_edit' && String(o.drafted_at) === s.checked_at);   // L2: written, but a check failed — the app shows the reasons
  const press = rows.filter(o => ['press', 'digest'].includes(o.type));   // L5: the Bluesky requests and the ones read from a journalist digest in your mailbox
  const podcasts = rows.filter(o => o.type === 'podcast' && o.status !== 'not_fit');
  const podcastsOut = rows.filter(o => o.type === 'podcast' && o.status === 'not_fit');
  const ideas = s.asset_ideas || [];
  const fixes = rows.filter(o => o.type === 'redirect');
  const listings = (s.listing_rows || []).slice().sort((a, b) => (a.status === 'linked') - (b.status === 'linked') || a.priority - b.priority);
  const reads = (s.impact_rows || []).filter(x => x.kind !== 'page_change');
  const changeReads = (s.impact_rows || []).filter(x => x.kind === 'page_change');
  const sm = s.summary;
  let html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:860px;color:#0f172a">';
  html += '<h2 style="margin:0 0 4px">Link building — ' + esc(s.domain) + '</h2>' + p_(esc(s.checked_at.slice(0, 10)) + ' · new link opportunities, pitches ready for your approval, and what your links did', true);
  if (s.free_only) html += p_('<b>Free check</b>: opportunities, contacts, listings and redirects only — no e-mails drafted and no DataForSEO.', true);
  html += '<table style="border-collapse:collapse;margin:8px 0"><tr>' + tile('Pitches ready', n(r.drafted || 0), (r.held ? r.held + ' more need your edit' : 'approve them in the app')) + tile('Journalist requests', n(sm.press), 'on your topics') + tile('Not listed yet', n(sm.listings_missing), 'places to add yourself') + tile('Redirects to add', n(sm.redirects), 'old URLs that 404')
    + (podcasts.length ? tile('Podcast shows', n(podcasts.length), 'that take guests') : '') + (ideas.length ? tile('Asset ideas', n(ideas.length), 'from your market') : '') + '</tr></table>';
  html += h3('Pitches drafted this week') + table(['Site', 'Why them', 'Your page', 'First subject'], drafted.map(o => { const seq = parse(o.sequence_json, []) || []; return [link(o.page_url || ('https://' + o.prospect_domain + '/'), o.prospect_domain), esc(ANGLE[o.type] || o.type) + (o.evidence ? '<div style="font-size:12px;color:#64748b">' + esc(o.evidence.slice(0, 160)) + '</div>' : ''), link(o.target_url), esc((seq[0] || {}).subject || '')]; }),
    s.free_only ? 'free check: no drafts' : 'no new pitches this week');
  if (heldRows.length) html += h3('Pitches that need your edit before they go out') + table(['Site', 'Why it is held', 'First subject'], heldRows.map(o => { const seq = parse(o.sequence_json, []) || [];
    return [link(o.page_url || '', o.prospect_domain), esc(String(o.fit_reason || '').replace(/^held for your edit: /, '')), esc((seq[0] || {}).subject || '')]; }), '')
    + p_('Every pitch is checked before it is offered: nothing is claimed about your business that your profile does not carry, the address is on their own domain, something from their page is quoted, there is one link to your page, and the e-mail is short with one ask.', true);
  if (rows.some(o => o.status === 'needs_contact')) html += p_(n(rows.filter(o => o.status === 'needs_contact').length) + ' good prospect(s) have no e-mail address on their site: the app lists their contact forms.', true);
  if (press.length) html += h3('Journalist requests on your topics') + table(['Request', 'Deadline', 'How to answer'], press.map(o => [link(o.page_url, o.page_title || 'request') + '<div style="font-size:12px;color:#64748b">' + esc(String(o.evidence).slice(0, 220)) + '</div>', esc(o.deadline || '—'), o.contact_email ? 'e-mail ' + esc(o.contact_email) : 'reply on Bluesky']), '');
  if (podcasts.length) html += h3('Podcast shows that take guests') + table(['Show', 'Why it fits', 'Who to ask'], podcasts.map(o => { const ck = parse(o.checks_json, {}) || {};
    return [link(o.page_url, o.page_title || o.prospect_domain) + (ck.platform ? ' <span style="font-size:12px;color:#64748b">· ' + link(ck.platform, 'listing') + '</span>' : ''),
      esc(o.fit_reason) + (o.evidence ? '<div style="font-size:12px;color:#64748b">' + esc(o.evidence.slice(0, 200)) + '</div>' : ''),
      o.contact_email ? esc(o.contact_email) : o.contact_form_url ? link(o.contact_form_url, 'their contact form') : 'no contact on their own domain']; }), '')
    + p_('A guest appearance is agreed by you, never by us: the pitch offers you as a guest and waits for your approval.' + (podcastsOut.length ? ' ' + n(podcastsOut.length) + ' show(s) were set aside (off your topics, finished, no contact on their own domain) — the app lists the reason.' : ''), true);
  if (ideas.length) html += h3('Assets that earn links in your market') + table(['Idea', 'What it takes', 'What this is based on'], ideas.map(i => [esc(ASSET_KIND[i.kind] || i.kind) + ': ' + esc(i.idea),
    esc(i.how), esc(i.basis) + '<div style="font-size:12px;color:#64748b">' + (i.examples || []).map(x => link(x.url, (x.title || x.url).slice(0, 70)) + ' (' + n(x.rds) + ')').join('<br>') + '</div>']), '')
    + p_('These are the kinds of page that have earned links for your competitors, with the pages that prove it and the number of websites linking to each. Making one is work, and no asset is a promise of links — it is the best-evidenced bet in your market.', true);
  if (listings.length) html += h3('Links you can add yourself') + table(['Where', 'Status', 'Competitors there', 'Why'], listings.slice(0, 20).map(l => [l.submit_url && l.status !== 'linked' ? link(l.submit_url, l.name) : esc(l.name), esc(STATUS[l.status] || l.status) + (l.profile_url ? ' · ' + link(l.profile_url, 'profile') : ''), esc(l.competitors || '—'), esc(String(l.why).slice(0, 200))]), '');
  if (fixes.length) html += h3('Redirects to add (old URLs that now answer 404)') + table(['Old URL', 'Redirect to', ''], fixes.slice(0, 20).map(f => [esc(f.page_url), link(f.target_url), esc(f.target_reason)]), '');
  if (reads.length) html += h3('What your links did') + table(['Link from', 'Your page', 'Weeks', 'Position', 'Verdict'], reads.slice(0, 15).map(x => [esc(x.ref_domain), link(x.target_url), n(x.weeks), x.base_position ? x.base_position + ' → ' + x.position : '—', esc(VERDICT[x.verdict] || x.verdict) + (x.note ? '<div style="font-size:12px;color:#64748b">' + esc(x.note) + '</div>' : '')]), '');
  if (changeReads.length) html += h3('What your page changes did') + table(['Page', 'Change', 'Since', 'Weeks', 'Position', 'Verdict'], changeReads.slice(0, 15).map(x => [link(x.target_url), esc(CHANGE[x.change] || x.change || 'changed'), esc(x.t0), n(x.weeks),
    x.base_position ? x.base_position + ' → ' + x.position : '—', esc(VERDICT[x.verdict] || x.verdict) + (x.note ? '<div style="font-size:12px;color:#64748b">' + esc(x.note) + '</div>' : '')]), '')
    + p_(esc(CT.method), true);
  html += p_('Nothing is sent for you: every pitch waits for your approval in the app and goes out from your own mailbox. Listings are never submitted automatically.', true);
  // G29: where the figures in this report come from
  const lineage = [
    LN.of('Position before and after, for links and page changes', 'gsc_history', { basis: 'measured', period: 'the stored 28-day periods, the last one ending ' + esc(s.checked_at.slice(0, 10)),
      sample: LN.sample(reads.length + changeReads.length, 'readings (' + reads.length + ' links, ' + changeReads.length + ' page changes)'), note: 'impression-weighted average position per page; the control group is the site\'s other pages over the same weeks' }),
    LN.of('New opportunities, journalist requests and listings', 'web', { basis: 'measured', period: LN.asOf(s.checked_at), sample: LN.sample(rows.length, 'prospects read this run'), note: 'pages we fetched ourselves; a page behind a bot wall is reported as "not checked", never as "missing"' }),
    ...(ideas.length ? [LN.of('Which kind of page earns links here', 'backlink_index', { basis: 'reported', period: 'read monthly, last ' + LN.asOf(s.checked_at),
      sample: LN.sample(sm.asset_pages || 0, 'competitor pages with 3 or more linking sites'), note: 'one crawler\'s index of the web; the idea is what worked for them, never a forecast for you' })] : []),
    ...(podcasts.length || podcastsOut.length ? [LN.of('Podcast shows that take guests', 'web', { basis: 'measured', period: LN.asOf(s.checked_at),
      sample: LN.sample(sm.podcasts_read || 0, 'shows whose own website we read'), note: 'a free podcast directory, each show\'s own RSS feed and its own website; a show is only pitched when it says it takes guests and has a contact on its own domain' })] : []),
    s.free_only ? LN.unknown('Competitors\' broken backlinks', 'this was a free check: the DataForSEO backlink index was not asked')
      : LN.of('Competitors\' broken backlinks', 'backlink_index', { basis: 'reported', period: 'read monthly, last ' + LN.asOf(s.checked_at), sample: LN.sample(rows.filter(o => o.type === 'broken').length, 'broken links found'), note: 'one crawler\'s index of the web' }),
  ];
  html += LN.block(lineage) + '</div>';
  const subject = '[Link building] ' + s.domain + ' — ' + (r.drafted ? r.drafted + ' pitch(es) ready' : 'weekly opportunities') + (sm.press ? ' · ' + sm.press + ' journalist request(s)' : '');
  const file_name = 'link-building-' + s.domain.replace(/[^a-z0-9]+/gi, '-') + '-' + s.checked_at.slice(0, 10) + '.html';
  return { json: { site_id: s.site_id, domain: s.domain, email: s.email, callback_url: s.callback_url, request_id: s.request_id, checked_at: s.checked_at, free_only: s.free_only, summary: { ...sm, drafted: r.drafted || 0, held: r.held || 0, writer_skipped: r.skipped || 0, writer_error: r.writer_error || '' },
    drafted: drafted.map(o => ({ prospect_domain: o.prospect_domain, type: o.type, target_url: o.target_url })), listings: listings.map(l => ({ listing_id: l.listing_id, name: l.name, status: l.status })), redirects: fixes.map(f => ({ from: f.page_url, to: f.target_url })),
    impact: reads.map(x => ({ ref_domain: x.ref_domain, target_url: x.target_url, weeks: x.weeks, verdict: x.verdict })),
    podcasts: podcasts.map(o => ({ prospect_domain: o.prospect_domain, show: o.page_title, page_url: o.page_url, status: o.status })), asset_ideas: ideas,
    page_changes: changeReads.map(x => ({ target_url: x.target_url, change: x.change, t0: x.t0, weeks: x.weeks, effect: x.effect, verdict: x.verdict, verdict_label: CT.label(x.verdict), note: x.note })),
    change_method: CT.method, lineage, subject, html, file_name, status: 'progress', stage: 'link_builder' },
    binary: { data: { data: b64(wrapDoc(subject, html)), mimeType: 'text/html', fileName: file_name, fileExtension: 'html' } } };
});
