// v4.8: one note for each site that gets no page this week but has something to say — the pile-up guard paused writing (pages wait to be
// published), a Manual ladder's next page waits for approval, opportunity posts are listed as suggestions (opportunities Manual), or a
// ladder's main page waits for its supporting pages to be published.
// Same shape as the Cadence Note (pages: []), so the same e-mail / callback nodes send it (stage content_cadence). Nothing in a dry run.
const FORM_URL = 'http://localhost:5678/form/54f85234-172e-43e6-a84d-b5ecaa140e7d', API_URL = 'http://localhost:5678/webhook/seo-keyword-check';
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const arr = (v) => Array.isArray(v) ? v : [];
return $input.all().map(i => i.json).filter(s => s && s.report_only && !s.dry_run && s.site_id).map(s => {
  const paused = s.paused_reason === 'pileup', ap = arr(s.awaiting_approval), sg = arr(s.suggestions), pend = arr(s.pending_publish), ws = arr(s.waiting_for_support);
  const subject = '[Content] ' + s.domain + ': ' + (paused ? 'paused, ' + s.waiting_publish + ' pages wait to be published' : ap.length ? 'next page ready for your approval' : sg.length ? 'topic suggestions for this week' : 'publish the supporting pages to unlock the main page');
  const html = '<p>Hi,</p>' +
    (paused ? '<p><b>No new page for ' + esc(s.domain) + ' this week.</b> ' + esc(s.waiting_publish) + ' pages are written but not published yet (the limit is ' + esc(s.max_waiting) + '). Publish them and report each link through the <a href="' + esc(FORM_URL) + '">form</a> ("I published a page") or the API (' + esc(API_URL) + ', <code>mode: published</code>); writing continues the Monday after.</p>'
      : '<p>Nothing was written automatically for <b>' + esc(s.domain) + '</b> this week.</p>') +
    (pend.length ? '<p style="color:#b45309"><b>Waiting for your publish link:</b> ' + pend.map(p => esc(p.keyword) + ' (written ' + p.days + ' days ago)').join(', ') + '</p>' : '') +
    (ap.length ? '<p><b>Ready for your approval</b> (Manual ladders, about $1.20 each): ' + ap.map(a => esc(a.keyword) + ' (ladder "' + esc(a.head) + '", ' + (Number(a.rung) === 4 ? 'main page' : 'rung ' + esc(a.rung)) + ')').join(', ') + '. Start one through the <a href="' + esc(FORM_URL) + '">form</a> or the app.</p>' : '') +
    (ws.length ? '<p><b>Main pages waiting for support:</b> ' + ws.map(w => esc(w.head) + ' (' + w.published + ' of ' + w.supporting + ' supporting pages published, ' + w.needed + ' needed, or the main keyword in the top 30)').join(', ') + '</p>' : '') +
    (sg.length ? '<p><b>Suggested posts</b> (opportunity posts are set to Manual): ' + sg.map(u => esc(u.keyword) + ' (' + esc(u.source) + ') — ' + esc(u.why)).join('; ') + '</p>' : '') +
    (arr(s.upcoming).length ? '<p><b>Next in line:</b> ' + arr(s.upcoming).map(u => esc(u.keyword) + ' (' + esc(u.source) + ')').join(', ') + '</p>' : '') +
    '<p style="color:#64748b;font-size:12px">Change the posts per week, Auto / Manual and the waiting-page limit in the app, or the posts per week through the Site Admin workflow.</p>';
  return { json: { site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id, subject, html, status: 'progress', stage: 'content_cadence', week: s.week,
    pages: [], upcoming: arr(s.upcoming), pending_publish: pend, candidates: Number(s.candidates) || 0, paused_reason: s.paused_reason || '', waiting_publish: Number(s.waiting_publish) || 0, max_waiting: Number(s.max_waiting) || 0,
    awaiting_approval: ap, suggestions: sg, queued_ladders: arr(s.queued_ladders), won_ladders: arr(s.won_ladders), waiting_for_support: arr(s.waiting_for_support) } };
});
