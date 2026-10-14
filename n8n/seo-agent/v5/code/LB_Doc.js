// Link Builder — the full weekly document (L3, 2026-10-13, system review FIX_PLAN.md L3; criterion REP 3.6 "Formats"). The weekly e-mail
// stays a summary; THIS is the whole week in one printable document, rendered to PDF by the next nodes (Prepare / Render / Attach PDF LB,
// Gotenberg) and delivered with the callback so the app can offer it like the other reports' PDFs.
// It only READS what *LB Assemble* and *LB Rows* decided (qualification, contacts, our page, link text, sequences, listings, redirects,
// impact) — no decision is taken here — and it carries G29's lineage notes (LN) and G12's control-group wording (CT) unchanged.
// Sections: what to do this week · every opportunity with its qualification · the contacts found on the prospect's own domain · our page
// and the link text per prospect · each drafted sequence with its status (including the ones the quality gate held, with the reasons) ·
// the listings checklist · redirects to reclaim · what the links and the page changes did · where these numbers come from.
/*__REPORT_KIT__*/
/*__LINEAGE__*/
/*__CHANGE_TEST__*/
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
