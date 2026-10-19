// One note per site: this week's page(s) and why, what comes next, and pages still waiting for a publish link.
// v4.8: plus the pipeline facts from the plan (Manual ladders' next pages, suggestions, queued / won ladders, main pages waiting for support).
const FORM_URL = '__FORM_URL__', API_URL = '__API_URL__';
const plan = $('Cadence Plan').all().map(i => i.json).filter(p => !p.nothing_to_do && !p.preview);   // a preview item (Cadence Preview) is never a written page
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const path = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '') || '/';
const arr = (v) => Array.isArray(v) ? v : [];
// R16 (2026-10-13, FIX_PLAN §3.11): planned rungs the fit gate set aside, with the reason — a competitor's brand or a government
// portal planned before the rule existed is named here instead of being written in silence.
const asideHtml = (s) => { const a = arr(s.set_aside); if (!a.length) return '';
  return '<p style="color:#b45309"><b>Set aside</b> (planned before this rule existed, not written): ' + a.map(x => esc(x.note || x.keyword)).join(' | ')
    + '. These rows are now marked <code>set_aside</code>; if one is right for you after all, start it by hand through the form or the app.</p>'; };
const fixHtml = (s) => (s.paused_reason !== 'pileup' && arr(s.needs_fix).length ? '<p style="color:#b45309"><b>Needs a fix, not a publish:</b> ' + arr(s.needs_fix).map(x => esc(x.keyword) + (arr(x.reasons).length ? ' (' + arr(x.reasons).map(esc).join('; ') + ')' : '')).join(', ') + '. These drafts did not pass the quality check; fix them and run them again.</p>' : '')
  + (arr(s.paused_ladders).length ? '<p style="color:#64748b"><b>Paused ladders:</b> ' + arr(s.paused_ladders).map(x => esc(x.head) + (x.reason ? ' (' + esc(x.reason) + ')' : '')).join(', ') + '</p>' : '');   // R111 / R87
// keyword-first (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §5.1 R-K4): what the fit gate refused, with the reason; never written, never suggested
const refusedHtml = (s) => arr(s.refused).length ? '<p style="color:#64748b"><b>Not suggested</b> (not a search this website should target): ' + arr(s.refused).slice(0, 6).map(x => esc(x.keyword) + ' (' + esc(x.reason) + ': ' + esc(x.detail) + ')').join('; ') + '</p>' : '';
const pipelineHtml = (s) => asideHtml(s) + fixHtml(s) + (arr(s.awaiting_approval).length ? '<p><b>Ready for your approval</b> (Manual ladders, about $1.20 each): ' + arr(s.awaiting_approval).map(a => esc(a.keyword) + ' (ladder "' + esc(a.head) + '", ' + (Number(a.rung) === 4 ? 'main page' : 'rung ' + esc(a.rung)) + ')').join(', ') + '. Start one through the <a href="' + esc(FORM_URL) + '">form</a> or the app.</p>' : '') +
  (arr(s.suggestions).length ? '<p><b>Suggested pages</b> (written only after your OK, about $' + (Number(s.est_page_usd) || 0).toFixed(2) + ' each): ' + arr(s.suggestions).map(u => esc(u.keyword) + ' (' + esc(u.source) + ')').join(', ') + '</p>' : '') +
  refusedHtml(s) +
  (arr(s.waiting_for_support).length ? '<p style="color:#64748b"><b>Main pages waiting for support:</b> ' + arr(s.waiting_for_support).map(w => esc(w.head) + ' (' + w.published + ' of ' + w.supporting + ' supporting pages published, ' + w.needed + ' needed)').join(', ') + '</p>' : '') +
  (arr(s.queued_ladders).length ? '<p style="color:#64748b"><b>Queued ladders</b> (start when an active one is won, fully written or paused): ' + arr(s.queued_ladders).map(q => esc(q.head)).join(', ') + '</p>' : '') +
  (arr(s.won_ladders).length ? '<p style="color:#15803d"><b>Won</b> (main keyword in the top 3 for 4 checks, no more pages): ' + arr(s.won_ladders).map(w => esc(w.head)).join(', ') + '</p>' : '');
// keyword-first (2026-10-19): the level, whether the site waits for its first keyword, the cycle, the budget and the client's decisions travel
// with the note to the app (the content_cadence callback), so its "Write it" can carry each suggestion's source and AI target (CyclePreviewItem)
const facts = (s) => ({ level: [1, 2, 3].includes(Number(s.level)) ? Number(s.level) : 2, waiting_for_keyword: !!s.waiting_for_keyword, cycle_key: String(s.cycle_key || ''), cycle_date: String(s.cycle_date || ''),
  scheduled_for: String(s.scheduled_for || ''), trigger: String(s.trigger || ''), budget: s.budget || null, refused: arr(s.refused), skipped: arr(s.skipped), approved_items: arr(s.approved_items),
  not_chosen_ladders: arr(s.not_chosen_ladders), est_page_usd: Number(s.est_page_usd) || 0, set_aside: arr(s.set_aside), paused_reason: s.paused_reason || '', waiting_publish: Number(s.waiting_publish) || 0, waiting_keywords: arr(s.waiting_keywords), max_waiting: Number(s.max_waiting) || 0, awaiting_approval: arr(s.awaiting_approval), suggestions: arr(s.suggestions), queued_ladders: arr(s.queued_ladders), won_ladders: arr(s.won_ladders), waiting_for_support: arr(s.waiting_for_support), needs_fix: arr(s.needs_fix), paused_ladders: arr(s.paused_ladders) });
// keyword-first (2026-10-19): a cycle's note is filed under the cycle run's own request id (cyc_...); each page keeps its own
const bySite = new Map(); for (const p of plan) { if (!bySite.has(p.site_id)) bySite.set(p.site_id, []); bySite.get(p.site_id).push(p); }
return [...bySite.values()].map(items => { const s = items[0];
  const html = '<p>Hi,</p><p>This week\'s content for <b>' + esc(s.domain) + '</b> (' + items.length + ' of ' + s.pages_per_week + ' per week):</p><ol>' + items.map(p => '<li><b>' + esc(p.keyword) + '</b> (' + esc(p.page_type) + ') — ' + esc(p.why) + (p.existing_page_url ? '; improves <a href="' + esc(p.existing_page_url) + '">' + esc(path(p.existing_page_url)) + '</a>' : '') + '</li>').join('') + '</ol>' +
    '<p>Each page arrives in its own e-mail within 10-15 minutes as HTML, Markdown and meta.json next to the PDF report. Publish it in your CMS, then report the link through the <a href="' + esc(FORM_URL) + '">form</a> ("I published a page") or the API (' + esc(API_URL) + ', <code>mode: published</code>) so the trackers check indexing and positions.</p>' +
    (s.upcoming.length ? '<p><b>Coming next:</b> ' + s.upcoming.map(u => esc(u.keyword) + ' (' + esc(u.source) + ')').join(', ') + '</p>' : '') +
    (s.pending_publish.length ? '<p style="color:#b45309"><b>Still waiting for your publish link:</b> ' + s.pending_publish.map(p => esc(p.keyword) + ' (written ' + p.days + ' days ago)').join(', ') + '</p>' : '') +
    pipelineHtml(s) +
    '<p style="color:#64748b;font-size:12px">Change the pages per week and the autopilot level in the app (or the pages per week through the Site Admin workflow). About $' + (Number(s.est_page_usd) || 0).toFixed(2) + ' per page.</p>';
  return { json: { site_id: s.site_id, domain: s.domain, email: s.email, callback_url: s.callback_url, request_id: s.cycle_request_id || s.request_id, subject: '[Content] ' + s.domain + ': ' + items.map(p => p.keyword).join(', '), html, status: 'progress', stage: 'content_cadence', week: s.week,
    pages: items.map(p => ({ keyword: p.keyword, source: p.source, page_type: p.page_type, existing_page_url: p.existing_page_url, request_id: p.request_id, why: p.why, item_key: p.item_key || '', auto: p.auto !== false, approved: !!p.approved, est_usd: Number(p.est_usd) || 0 })), upcoming: s.upcoming, pending_publish: s.pending_publish, candidates: s.candidates, ...facts(s) } }; });
