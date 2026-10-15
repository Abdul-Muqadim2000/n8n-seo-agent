// Link Builder report per site (e-mail / callback stage link_builder; v4.13): pitches drafted and waiting for approval in the app, journalist
// requests on your topics, links you can add yourself (the listings checklist), redirects to add, and what won links did for their pages.
// G12 / G29 (2026-10-13, FIX_PLAN): "What your page changes did" reads a published or rewritten page against the same control group
// as a won link (one implementation, CT), and every figure carries its source, period and sample (LN).
/*__REPORT_KIT__*/
/*__LINEAGE__*/
/*__CHANGE_TEST__*/
// reads LB Assemble and LB Rows explicitly: the node before this one saves Data Table rows and outputs those rows
const A = $('LB Assemble').all().map(i => i.json).filter(s => !s.skip); const R = $('LB Rows').all().map(i => i.json);
const parse = (t, d) => { try { return JSON.parse(t || ''); } catch (e) { return d; } };
const ANGLE = { broken: 'Dead link on their page', lost: 'Link to restore', mention: 'Mention without a link', list: 'List that leaves you out', ai_source: 'Page AI cites', resource: 'Resource page', gap: 'Links to competitors', comp_new: 'Just linked to a competitor', press: 'Journalist request', digest: 'Journalist request (digest)', podcast: 'Podcast that takes guests' };
const ASSET_KIND = { data: 'Data study', tool: 'Free tool', template: 'Template', guide: 'Definitive guide' };   // L6
const VERDICT = CT.LABELS;   // G12: one set of graded verdicts for links and page changes
const CHANGE = { published: 'Published', rewritten: 'Rewritten' };
const WON_STATE = { live: 'Still live', at_risk: 'Not found this week', lost: 'Gone', not_checked: 'Could not be read' };   // B11-2
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
  const wonChecks = (s.won_checks || []).slice().sort((a, b) => ['lost', 'at_risk', 'not_checked', 'live'].indexOf(a.state) - ['lost', 'at_risk', 'not_checked', 'live'].indexOf(b.state));   // B11-2: what needs the owner first
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
  // B11-2: the links you already have, read again on their own page this week. A link is "live" because we fetched the page and
  // found it, not because a row once said so; a page we could not read says so and counts as neither live nor lost.
  if (wonChecks.length) {
    html += h3('Links you won — are they still there?')
      + '<table style="border-collapse:collapse;margin:8px 0"><tr>' + tile('Still live', n(sm.won_live), 'found on their page ' + esc(s.checked_at.slice(0, 10)))
      + (sm.won_at_risk ? tile('Gone once', n(sm.won_at_risk), 'checked again next week') : '') + (sm.won_lost ? tile('Gone', n(sm.won_lost), 'missing twice running') : '')
      + (sm.won_unchecked ? tile('Not checked', n(sm.won_unchecked), 'their site blocks checks') : '') + '</tr></table>'
      + table(['Linking page', 'What we found', 'Link text'], wonChecks.map(w => [link(w.url, w.prospect_domain), esc(WON_STATE[w.state] || w.state) + '<div style="font-size:12px;color:#64748b">' + esc(w.why) + '</div>',
        w.state === 'live' ? esc(w.anchor || '—') + (w.rel && w.rel !== 'follow' ? ' <span style="font-size:12px;color:#64748b">(' + esc(w.rel) + ')</span>' : '') : '—']), '')
      + p_('One reading is never a loss: a link we cannot find is checked again the following week and only called gone when it is missing twice running — and a page behind a bot wall or one that needs JavaScript is reported as "not checked", never as gone. Links a backlink index already reports are re-read by the backlink monitor instead, so no page is fetched twice.', true)
      + (sm.won_lost ? p_('Losing one is normal and not a reflection on the work: of 865,000 links tracked by Linkody (June 2026), about 63% were still live a year on and a third had gone. What is worth doing is asking: a link removed in an edit often goes back when you ask the person who put it there.', true) : '');
  }
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
    ...(wonChecks.length ? [LN.of('Whether the links you won are still on the page', 'web', { basis: 'measured', period: LN.asOf(s.checked_at),
      sample: LN.sample(wonChecks.length, 'linking pages we fetched ourselves this run'), note: 'our own fetch of the linking page, not an index\'s memory of it; a page we could not read counts as neither live nor lost, and a link is called gone only after two readings in a row missed it' })] : []),
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
    won_checks: wonChecks.map(w => ({ prospect_domain: w.prospect_domain, type: w.type, url: w.url, state: w.state, why: w.why, rel: w.rel, anchor: w.anchor, checked_at: w.at, won_at: w.won_at })),
    podcasts: podcasts.map(o => ({ prospect_domain: o.prospect_domain, show: o.page_title, page_url: o.page_url, status: o.status })), asset_ideas: ideas,
    page_changes: changeReads.map(x => ({ target_url: x.target_url, change: x.change, t0: x.t0, weeks: x.weeks, effect: x.effect, verdict: x.verdict, verdict_label: CT.label(x.verdict), note: x.note })),
    change_method: CT.method, lineage, subject, html, file_name, status: 'progress', stage: 'link_builder' },
    binary: { data: { data: b64(wrapDoc(subject, html)), mimeType: 'text/html', fileName: file_name, fileExtension: 'html' } } };
});
