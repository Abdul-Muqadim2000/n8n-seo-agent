// v4.8: one note for each site that gets no page this week but has something to say — the pile-up guard paused writing (pages wait to be
// published), a Manual ladder's next page waits for approval, pages are listed as suggestions (what the autopilot level does not write on its
// own), or a ladder's main page waits for its supporting pages to be published. Keyword-first (2026-10-19): also the site that waits for its
// first keyword (levels 1 and 2 write nothing before it) and what the fit gate refused, with the reason.
// Same shape as the Cadence Note (pages: []), so the same e-mail / callback nodes send it (stage content_cadence). Nothing in a dry run.
const FORM_URL = 'http://localhost:5678/form/54f85234-172e-43e6-a84d-b5ecaa140e7d', API_URL = 'http://localhost:5678/webhook/seo-keyword-check';
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const arr = (v) => Array.isArray(v) ? v : [];
return $input.all().map(i => i.json).filter(s => s && s.report_only && !s.dry_run && s.site_id).map(s => {
  const wfk = !!s.waiting_for_keyword;   // keyword-first (2026-10-19, R-K2): levels 1 and 2 write nothing before the first keyword the client chose
  const rf = arr(s.refused);   // R-K4: refused by the fit gate, with the reason: never written, never suggested
  const each = '$' + (Number(s.est_page_usd) || 0).toFixed(2);
  const paused = s.paused_reason === 'pileup', ap = arr(s.awaiting_approval), sg = arr(s.suggestions), pend = arr(s.pending_publish), ws = arr(s.waiting_for_support);
  const nf = arr(s.needs_fix), pl = arr(s.paused_ladders);   // R111 / R87: drafts that failed the quality check, ladders whose main keyword was set aside
  const nfHtml = (nf.length && !paused) ? '<p style="color:#b45309"><b>Needs a fix, not a publish:</b> ' + nf.map(x => esc(x.keyword) + (arr(x.reasons).length ? ' (' + arr(x.reasons).map(esc).join('; ') + ')' : '')).join(', ') + '. These drafts did not pass the quality check; fix them and run them again.</p>' : '';
  const plHtml = pl.length ? '<p style="color:#64748b"><b>Paused ladders:</b> ' + pl.map(x => esc(x.head) + (x.reason ? ' (' + esc(x.reason) + ')' : '')).join(', ') + '</p>' : '';
  const wkw = arr(s.waiting_keywords);   // D5: the pages that wait, by name (ladder pages included)
  const aside = arr(s.set_aside).filter(x => x && x.dropped);   // R16: rungs stored before the fit gate, not written
  const subject = '[Content] ' + s.domain + ': ' + (wfk ? 'choose the keyword you want to be found for' : paused ? 'paused, ' + s.waiting_publish + ' written pages waiting for publication' : ap.length ? 'next page ready for your approval' : sg.length ? 'topic suggestions for this week' : nf.length ? nf.length + ' written page' + (nf.length === 1 ? '' : 's') + ' need a fix' : ws.length ? 'publish the supporting pages to unlock the main page' : pl.length ? 'ladder paused' : 'publish the supporting pages to unlock the main page');
  const html = '<p>Hi,</p>' +
    (paused ? '<p><b>No new page for ' + esc(s.domain) + ' this week.</b> ' + esc(s.waiting_publish) + ' written pages waiting for publication (pile-up guard, limit ' + esc(s.max_waiting) + ')' + (wkw.length ? ': ' + wkw.slice(0, 10).map(k => '<b>' + esc(k) + '</b>').join(', ') : '') + '. Publish them and report each link through the <a href="' + esc(FORM_URL) + '">form</a> ("I published a page") or the API (' + esc(API_URL) + ', <code>mode: published</code>); writing continues at the next cycle after that.</p>'
      : wfk ? '<p><b>Waiting for your first keyword.</b> Nothing is written for <b>' + esc(s.domain) + '</b> until you choose the keyword you want to be found for (start a keyword ladder in the app). Your checks and reports keep running.</p>'
      : '<p>Nothing was written automatically for <b>' + esc(s.domain) + '</b> this week' + (s.reason ? ': ' + esc(s.reason) : '') + '.</p>') +
    nfHtml + plHtml +
    (aside.length ? '<p style="color:#b45309"><b>Set aside</b> (planned before this rule existed, not written): ' + aside.map(x => esc(x.note || x.keyword)).join(' | ') + '. These rows are now marked <code>set_aside</code>.</p>' : '') +
    (pend.length ? '<p style="color:#b45309"><b>Waiting for your publish link:</b> ' + pend.map(p => esc(p.keyword) + ' (written ' + p.days + ' days ago)').join(', ') + '</p>' : '') +
    (ap.length ? '<p><b>Ready for your approval</b> (Manual ladders, about $1.20 each): ' + ap.map(a => esc(a.keyword) + ' (ladder "' + esc(a.head) + '", ' + (Number(a.rung) === 4 ? 'main page' : 'rung ' + esc(a.rung)) + ')').join(', ') + '. Start one through the <a href="' + esc(FORM_URL) + '">form</a> or the app.</p>' : '') +
    (ws.length ? '<p><b>Main pages waiting for support:</b> ' + ws.map(w => esc(w.head) + ' (' + w.published + ' of ' + w.supporting + ' supporting pages published, ' + w.needed + ' needed, or the main keyword in the top 30)').join(', ') + '</p>' : '') +
    (sg.length ? '<p><b>Suggested pages</b> (written only after your OK, about ' + each + ' each): ' + sg.map(u => esc(u.keyword) + ' (' + esc(u.source) + '): ' + esc(u.why)).join('; ') + '</p>' : '') +
    (rf.length ? '<p style="color:#64748b"><b>Not suggested</b> (not a search this website should target): ' + rf.slice(0, 6).map(x => esc(x.keyword) + ' (' + esc(x.reason) + ': ' + esc(x.detail) + ')').join('; ') + '</p>' : '') +
    (arr(s.upcoming).length ? '<p><b>Next in line:</b> ' + arr(s.upcoming).map(u => esc(u.keyword) + ' (' + esc(u.source) + ')').join(', ') + '</p>' : '') +
    '<p style="color:#64748b;font-size:12px">Change the pages per week, the autopilot level, Auto / Manual and the waiting-page limit in the app, or the pages per week through the Site Admin workflow.</p>';
  return { json: { site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id, subject, html, status: 'progress', stage: 'content_cadence', week: s.week,
    pages: [], upcoming: arr(s.upcoming), pending_publish: pend, candidates: Number(s.candidates) || 0, paused_reason: s.paused_reason || '', waiting_publish: Number(s.waiting_publish) || 0, waiting_keywords: wkw, max_waiting: Number(s.max_waiting) || 0,
    awaiting_approval: ap, suggestions: sg, set_aside: arr(s.set_aside), queued_ladders: arr(s.queued_ladders), won_ladders: arr(s.won_ladders), waiting_for_support: arr(s.waiting_for_support), needs_fix: nf, paused_ladders: pl,
    level: [1, 2, 3].includes(Number(s.level)) ? Number(s.level) : 2, waiting_for_keyword: wfk, cycle_key: String(s.cycle_key || ''), cycle_date: String(s.cycle_date || ''), scheduled_for: String(s.scheduled_for || ''),
    trigger: String(s.trigger || ''), reason: String(s.reason || ''), budget: s.budget || null, refused: rf, skipped: arr(s.skipped), approved_items: arr(s.approved_items), not_chosen_ladders: arr(s.not_chosen_ladders), est_page_usd: Number(s.est_page_usd) || 0 } };
});
