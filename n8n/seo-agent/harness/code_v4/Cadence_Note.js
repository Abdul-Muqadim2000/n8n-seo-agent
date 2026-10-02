// One note per site: this week's page(s) and why, what comes next, and pages still waiting for a publish link.
const FORM_URL = 'http://localhost:5678/form/54f85234-172e-43e6-a84d-b5ecaa140e7d', API_URL = 'http://localhost:5678/webhook/seo-keyword-check';
const plan = $('Cadence Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const path = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '') || '/';
const bySite = new Map(); for (const p of plan) { if (!bySite.has(p.site_id)) bySite.set(p.site_id, []); bySite.get(p.site_id).push(p); }
return [...bySite.values()].map(items => { const s = items[0];
  const html = '<p>Hi,</p><p>This week\'s content for <b>' + esc(s.domain) + '</b> (' + items.length + ' of ' + s.pages_per_week + ' per week):</p><ol>' + items.map(p => '<li><b>' + esc(p.keyword) + '</b> (' + esc(p.page_type) + ') — ' + esc(p.why) + (p.existing_page_url ? '; improves <a href="' + esc(p.existing_page_url) + '">' + esc(path(p.existing_page_url)) + '</a>' : '') + '</li>').join('') + '</ol>' +
    '<p>Each page arrives in its own e-mail within 10-15 minutes as HTML, Markdown and meta.json next to the PDF report. Publish it in your CMS, then report the link through the <a href="' + esc(FORM_URL) + '">form</a> ("I published a page") or the API (' + esc(API_URL) + ', <code>mode: published</code>) so the trackers check indexing and positions.</p>' +
    (s.upcoming.length ? '<p><b>Coming next:</b> ' + s.upcoming.map(u => esc(u.keyword) + ' (' + esc(u.source) + ')').join(', ') + '</p>' : '') +
    (s.pending_publish.length ? '<p style="color:#b45309"><b>Still waiting for your publish link:</b> ' + s.pending_publish.map(p => esc(p.keyword) + ' (written ' + p.days + ' days ago)').join(', ') + '</p>' : '') +
    '<p style="color:#64748b;font-size:12px">Change the posts per week through "Track my site" (form, or API field blogs_per_week) or the Site Admin workflow. About $1.20 of AI cost per page.</p>';
  return { json: { site_id: s.site_id, domain: s.domain, email: s.email, callback_url: s.callback_url, request_id: s.request_id, subject: '[Content] ' + s.domain + ': ' + items.map(p => p.keyword).join(', '), html, status: 'progress', stage: 'content_cadence', week: s.week,
    pages: items.map(p => ({ keyword: p.keyword, source: p.source, page_type: p.page_type, existing_page_url: p.existing_page_url, request_id: p.request_id, why: p.why })), upcoming: s.upcoming, pending_publish: s.pending_publish, candidates: s.candidates } }; });
