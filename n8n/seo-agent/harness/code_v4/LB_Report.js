// Link Builder report per site (e-mail / callback stage link_builder; v4.13): pitches drafted and waiting for approval in the app, journalist
// requests on your topics, links you can add yourself (the listings checklist), redirects to add, and what won links did for their pages.
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

// reads LB Assemble and LB Rows explicitly: the node before this one saves Data Table rows and outputs those rows
const A = $('LB Assemble').all().map(i => i.json).filter(s => !s.skip); const R = $('LB Rows').all().map(i => i.json);
const parse = (t, d) => { try { return JSON.parse(t || ''); } catch (e) { return d; } };
const ANGLE = { broken: 'Dead link on their page', lost: 'Link to restore', mention: 'Mention without a link', list: 'List that leaves you out', ai_source: 'Page AI cites', resource: 'Resource page', gap: 'Links to competitors', comp_new: 'Just linked to a competitor', press: 'Journalist request' };
const VERDICT = { likely_helped: 'Likely helped', possibly_helped: 'Possibly helped', no_effect_yet: 'No measurable effect yet', too_early: 'Too early', cant_tell: "Can't tell" };
const STATUS = { linked: 'Linked', listed: 'Listed (no link seen)', missing: 'Not listed', submitted: 'Submitted', unknown: 'Not checked (the site blocks checks)', ignored: 'Not relevant' };
return A.map(s => {
  const r = R.find(x => x.site_id === s.site_id) || { outreach_rows: s.outreach_rows, drafted: 0, skipped: 0 };
  const rows = r.outreach_rows || [];
  const drafted = rows.filter(o => o.status === 'drafted' && String(o.drafted_at) === s.checked_at);
  const heldRows = rows.filter(o => o.status === 'needs_edit' && String(o.drafted_at) === s.checked_at);   // L2: written, but a check failed — the app shows the reasons
  const press = rows.filter(o => o.type === 'press');
  const fixes = rows.filter(o => o.type === 'redirect');
  const listings = (s.listing_rows || []).slice().sort((a, b) => (a.status === 'linked') - (b.status === 'linked') || a.priority - b.priority);
  const reads = (s.impact_rows || []);
  const sm = s.summary;
  let html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:860px;color:#0f172a">';
  html += '<h2 style="margin:0 0 4px">Link building — ' + esc(s.domain) + '</h2>' + p_(esc(s.checked_at.slice(0, 10)) + ' · new link opportunities, pitches ready for your approval, and what your links did', true);
  if (s.free_only) html += p_('<b>Free check</b>: opportunities, contacts, listings and redirects only — no e-mails drafted and no DataForSEO.', true);
  html += '<table style="border-collapse:collapse;margin:8px 0"><tr>' + tile('Pitches ready', n(r.drafted || 0), (r.held ? r.held + ' more need your edit' : 'approve them in the app')) + tile('Journalist requests', n(sm.press), 'on your topics') + tile('Not listed yet', n(sm.listings_missing), 'places to add yourself') + tile('Redirects to add', n(sm.redirects), 'old URLs that 404') + '</tr></table>';
  html += h3('Pitches drafted this week') + table(['Site', 'Why them', 'Your page', 'First subject'], drafted.map(o => { const seq = parse(o.sequence_json, []) || []; return [link(o.page_url || ('https://' + o.prospect_domain + '/'), o.prospect_domain), esc(ANGLE[o.type] || o.type) + (o.evidence ? '<div style="font-size:12px;color:#64748b">' + esc(o.evidence.slice(0, 160)) + '</div>' : ''), link(o.target_url), esc((seq[0] || {}).subject || '')]; }),
    s.free_only ? 'free check: no drafts' : 'no new pitches this week');
  if (heldRows.length) html += h3('Pitches that need your edit before they go out') + table(['Site', 'Why it is held', 'First subject'], heldRows.map(o => { const seq = parse(o.sequence_json, []) || [];
    return [link(o.page_url || '', o.prospect_domain), esc(String(o.fit_reason || '').replace(/^held for your edit: /, '')), esc((seq[0] || {}).subject || '')]; }), '')
    + p_('Every pitch is checked before it is offered: nothing is claimed about your business that your profile does not carry, the address is on their own domain, something from their page is quoted, there is one link to your page, and the e-mail is short with one ask.', true);
  if (rows.some(o => o.status === 'needs_contact')) html += p_(n(rows.filter(o => o.status === 'needs_contact').length) + ' good prospect(s) have no e-mail address on their site: the app lists their contact forms.', true);
  if (press.length) html += h3('Journalist requests on your topics') + table(['Request', 'Deadline', 'How to answer'], press.map(o => [link(o.page_url, o.page_title || 'request') + '<div style="font-size:12px;color:#64748b">' + esc(String(o.evidence).slice(0, 220)) + '</div>', esc(o.deadline || '—'), o.contact_email ? 'e-mail ' + esc(o.contact_email) : 'reply on Bluesky']), '');
  if (listings.length) html += h3('Links you can add yourself') + table(['Where', 'Status', 'Competitors there', 'Why'], listings.slice(0, 20).map(l => [l.submit_url && l.status !== 'linked' ? link(l.submit_url, l.name) : esc(l.name), esc(STATUS[l.status] || l.status) + (l.profile_url ? ' · ' + link(l.profile_url, 'profile') : ''), esc(l.competitors || '—'), esc(String(l.why).slice(0, 200))]), '');
  if (fixes.length) html += h3('Redirects to add (old URLs that now answer 404)') + table(['Old URL', 'Redirect to', ''], fixes.slice(0, 20).map(f => [esc(f.page_url), link(f.target_url), esc(f.target_reason)]), '');
  if (reads.length) html += h3('What your links did') + table(['Link from', 'Your page', 'Weeks', 'Position', 'Verdict'], reads.slice(0, 15).map(x => [esc(x.ref_domain), link(x.target_url), n(x.weeks), x.base_position ? x.base_position + ' → ' + x.position : '—', esc(VERDICT[x.verdict] || x.verdict) + (x.note ? '<div style="font-size:12px;color:#64748b">' + esc(x.note) + '</div>' : '')]), '');
  html += p_('Nothing is sent for you: every pitch waits for your approval in the app and goes out from your own mailbox. Listings are never submitted automatically.', true) + '</div>';
  const subject = '[Link building] ' + s.domain + ' — ' + (r.drafted ? r.drafted + ' pitch(es) ready' : 'weekly opportunities') + (sm.press ? ' · ' + sm.press + ' journalist request(s)' : '');
  const file_name = 'link-building-' + s.domain.replace(/[^a-z0-9]+/gi, '-') + '-' + s.checked_at.slice(0, 10) + '.html';
  return { json: { site_id: s.site_id, domain: s.domain, email: s.email, callback_url: s.callback_url, request_id: s.request_id, checked_at: s.checked_at, free_only: s.free_only, summary: { ...sm, drafted: r.drafted || 0, held: r.held || 0, writer_skipped: r.skipped || 0, writer_error: r.writer_error || '' },
    drafted: drafted.map(o => ({ prospect_domain: o.prospect_domain, type: o.type, target_url: o.target_url })), listings: listings.map(l => ({ listing_id: l.listing_id, name: l.name, status: l.status })), redirects: fixes.map(f => ({ from: f.page_url, to: f.target_url })),
    impact: reads.map(x => ({ ref_domain: x.ref_domain, target_url: x.target_url, weeks: x.weeks, verdict: x.verdict })), subject, html, file_name, status: 'progress', stage: 'link_builder' },
    binary: { data: { data: b64(wrapDoc(subject, html)), mimeType: 'text/html', fileName: file_name, fileExtension: 'html' } } };
});
