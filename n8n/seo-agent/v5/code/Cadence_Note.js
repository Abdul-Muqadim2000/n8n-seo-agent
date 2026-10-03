// One note per site: this week's page(s) and why, what comes next, and pages still waiting for a publish link.
// v4.8: plus the pipeline facts from the plan (Manual ladders' next pages, suggestions, queued / won ladders, main pages waiting for support).
const FORM_URL = '__FORM_URL__', API_URL = '__API_URL__';
const plan = $('Cadence Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const path = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '') || '/';
const arr = (v) => Array.isArray(v) ? v : [];
const pipelineHtml = (s) => (arr(s.awaiting_approval).length ? '<p><b>Ready for your approval</b> (Manual ladders, about $1.20 each): ' + arr(s.awaiting_approval).map(a => esc(a.keyword) + ' (ladder "' + esc(a.head) + '", ' + (Number(a.rung) === 4 ? 'main page' : 'rung ' + esc(a.rung)) + ')').join(', ') + '. Start one through the <a href="' + esc(FORM_URL) + '">form</a> or the app.</p>' : '') +
  (arr(s.suggestions).length ? '<p><b>Suggested posts</b> (opportunity posts are set to Manual): ' + arr(s.suggestions).map(u => esc(u.keyword) + ' (' + esc(u.source) + ')').join(', ') + '</p>' : '') +
  (arr(s.waiting_for_support).length ? '<p style="color:#64748b"><b>Main pages waiting for support:</b> ' + arr(s.waiting_for_support).map(w => esc(w.head) + ' (' + w.published + ' of ' + w.supporting + ' supporting pages published, ' + w.needed + ' needed)').join(', ') + '</p>' : '') +
  (arr(s.queued_ladders).length ? '<p style="color:#64748b"><b>Queued ladders</b> (start when an active one is won, fully written or paused): ' + arr(s.queued_ladders).map(q => esc(q.head)).join(', ') + '</p>' : '') +
  (arr(s.won_ladders).length ? '<p style="color:#15803d"><b>Won</b> (main keyword in the top 3 for 4 checks, no more pages): ' + arr(s.won_ladders).map(w => esc(w.head)).join(', ') + '</p>' : '');
const facts = (s) => ({ paused_reason: s.paused_reason || '', waiting_publish: Number(s.waiting_publish) || 0, max_waiting: Number(s.max_waiting) || 0, awaiting_approval: arr(s.awaiting_approval), suggestions: arr(s.suggestions), queued_ladders: arr(s.queued_ladders), won_ladders: arr(s.won_ladders), waiting_for_support: arr(s.waiting_for_support) });
const bySite = new Map(); for (const p of plan) { if (!bySite.has(p.site_id)) bySite.set(p.site_id, []); bySite.get(p.site_id).push(p); }
return [...bySite.values()].map(items => { const s = items[0];
  const html = '<p>Hi,</p><p>This week\'s content for <b>' + esc(s.domain) + '</b> (' + items.length + ' of ' + s.pages_per_week + ' per week):</p><ol>' + items.map(p => '<li><b>' + esc(p.keyword) + '</b> (' + esc(p.page_type) + ') — ' + esc(p.why) + (p.existing_page_url ? '; improves <a href="' + esc(p.existing_page_url) + '">' + esc(path(p.existing_page_url)) + '</a>' : '') + '</li>').join('') + '</ol>' +
    '<p>Each page arrives in its own e-mail within 10-15 minutes as HTML, Markdown and meta.json next to the PDF report. Publish it in your CMS, then report the link through the <a href="' + esc(FORM_URL) + '">form</a> ("I published a page") or the API (' + esc(API_URL) + ', <code>mode: published</code>) so the trackers check indexing and positions.</p>' +
    (s.upcoming.length ? '<p><b>Coming next:</b> ' + s.upcoming.map(u => esc(u.keyword) + ' (' + esc(u.source) + ')').join(', ') + '</p>' : '') +
    (s.pending_publish.length ? '<p style="color:#b45309"><b>Still waiting for your publish link:</b> ' + s.pending_publish.map(p => esc(p.keyword) + ' (written ' + p.days + ' days ago)').join(', ') + '</p>' : '') +
    pipelineHtml(s) +
    '<p style="color:#64748b;font-size:12px">Change the posts per week through "Track my site" (form, or API field blogs_per_week) or the Site Admin workflow. About $1.20 of AI cost per page.</p>';
  return { json: { site_id: s.site_id, domain: s.domain, email: s.email, callback_url: s.callback_url, request_id: s.request_id, subject: '[Content] ' + s.domain + ': ' + items.map(p => p.keyword).join(', '), html, status: 'progress', stage: 'content_cadence', week: s.week,
    pages: items.map(p => ({ keyword: p.keyword, source: p.source, page_type: p.page_type, existing_page_url: p.existing_page_url, request_id: p.request_id, why: p.why })), upcoming: s.upcoming, pending_publish: s.pending_publish, candidates: s.candidates, ...facts(s) } }; });
