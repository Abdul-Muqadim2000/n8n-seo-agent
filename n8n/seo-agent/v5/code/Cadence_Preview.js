// "Coming up" (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §5.7 / §14.4): the Cycle Dispatcher runs the cadence in preview mode 48 h before each
// website's cycle. *Cadence Plan* planned exactly what that cycle would write and wrote nothing (`preview: true`, `dry_run: true`); this node
// turns its one item per site into ONE `cycle_preview` callback (shape CyclePreview in app/shared/src/cycles.ts) and the e-mail beside it,
// through the same e-mail / callback nodes as the weekly note. Each item says why it was chosen, what it would cost, and whether it is written
// on its own (`auto: true`, the client may Skip it) or waits for the client's OK (`auto: false`, Approve / Skip). A website with nothing to
// write still sends its status: waiting for its first keyword, paused (pile-up or the website itself), or no pages a week.
/*__LINEAGE__*/
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const arr = (v) => Array.isArray(v) ? v : [];
// F-KW (2026-10-20, finding 10): no raw dollar figure in a customer's e-mail: the app shows each item's cost in credits (est_usd travels in the callback)
const LEVEL_LABEL = { 1: 'Only my keywords', 2: 'My keywords and keep my pages healthy', 3: 'Full autopilot' };   // cycles.ts AUTOPILOT_LEVELS
const SRC = { ladder: 'your keyword ladder', decay: 'a page of yours losing visitors', striking: 'close to page one', trend: 'a rising search', ai_answer: 'a question AI answers without you', ai_refresh: 'a page AI could quote better' };
return $('Cadence Plan').all().map(i => i.json).filter(p => p && p.preview === true && p.site_id).map(p => {
  // P1 (2026-10-20): a page held for the author profile and the business facts is listed apart, with what to add (never as "written on its own")
  const items = arr(p.items), sug = arr(p.suggestions), held = items.filter(x => x.held === 'profile'), auto = items.filter(x => x.auto && x.held !== 'profile'), ok = items.filter(x => !x.auto && x.held !== 'profile');
  const rd = (p.readiness && typeof p.readiness === 'object') ? p.readiness : null;
  const level = [1, 2, 3].includes(Number(p.level)) ? Number(p.level) : 2;
  const when = String(p.scheduled_for || '').slice(0, 10) || String(p.cycle_date || '');
  const li = (x) => '<li><b>' + esc(x.keyword) + '</b> (' + esc(SRC[x.source] || x.source) + '): ' + esc(x.why) + (x.existing_page_url ? '; improves ' + esc(x.existing_page_url) : '') + '</li>';
  const profileLine = p.waiting_for_profile && rd ? '<p style="color:#b45309"><b>Waiting for your author profile and business facts.</b> Add ' + esc(rd.missing_text) + ' in Website settings: no page is written (or charged) until they are on file, approved pages included.</p>' : '';
  const status = (p.waiting_for_keyword ? '<p><b>Waiting for your first keyword.</b> Choose the keyword you want to be found for: nothing is written until you do.</p>'
    : p.paused_reason === 'pileup' ? '<p style="color:#b45309"><b>Paused:</b> ' + esc(p.waiting_publish) + ' written pages are waiting to be published (limit ' + esc(p.max_waiting) + '). Publish them so the next cycle can write.</p>'
    : p.paused_reason === 'site_paused' ? '<p style="color:#b45309"><b>This website is paused.</b> Its next cycle writes nothing until it is resumed.</p>'
    : !Number(p.pages_per_week) ? '<p>No pages a week are set for this website, so nothing is written on its own.</p>' : '') + profileLine;
  const html = '<p>Hi,</p><p>Coming up for <b>' + esc(p.domain) + '</b> in the cycle of ' + esc(when) + ' (autopilot: ' + esc(LEVEL_LABEL[level]) + ', ' + esc(Number(p.pages_per_week) || 0) + ' page(s) a week):</p>' + status
    + (auto.length ? '<p><b>Written on their own</b> (skip any you do not want):</p><ol>' + auto.map(li).join('') + '</ol>' : '')
    + (held.length ? '<p><b>Ready to write once your author profile and business facts are on file</b>:</p><ol>' + held.map(li).join('') + '</ol>' : '')
    + (ok.length ? '<p><b>Waiting for your OK</b>:</p><ol>' + ok.map(li).join('') + '</ol>' : '')
    + (sug.length ? '<p><b>Suggestions</b> (written only if you approve them):</p><ol>' + sug.map(li).join('') + '</ol>' : '')
    + (arr(p.refused).length ? '<p style="color:#64748b"><b>Not suggested</b> (not a search this website should target): ' + arr(p.refused).slice(0, 6).map(x => esc(x.keyword) + ' (' + esc(x.reason) + ')').join(', ') + '</p>' : '')
    + (!auto.length && !ok.length && !held.length && !sug.length && !status ? '<p>Nothing to write in this cycle.</p>' : '')
    + '<p style="color:#64748b;font-size:12px">Approve or skip each item in the app before the cycle starts. The app shows what each page costs in credits.</p>';
  // INVARIANTS rule 1: every figure of the plan says where it came from (the price is the run guard's own estimate, the plan is computed)
  const lineage = [LN.of('the cost of each page (shown in credits in the app)', 'model', { basis: 'estimated', note: 'the run guard\'s own estimate of one written page' }),
    LN.of(items.length + ' planned item(s), ' + sug.length + ' suggestion(s)', 'model', { basis: 'modelled', period: 'the cycle of ' + when, note: 'planned from your keyword ladders, your settings, your skips and the site data on file; nothing is written by this plan' })];
  const htmlL = html + LN.block(lineage);
  const callback_body = { site_id: p.site_id, domain: p.domain, cycle_key: String(p.cycle_key || ''), cycle_date: String(p.cycle_date || ''), scheduled_for: String(p.scheduled_for || ''), trigger: 'cycle',
    level, pages_per_week: Number(p.pages_per_week) || 0, waiting_for_keyword: !!p.waiting_for_keyword, paused_reason: String(p.paused_reason || ''), reason: String(p.reason || ''),
    items, suggestions: sug, refused: arr(p.refused), skipped: arr(p.skipped), budget: p.budget || null, est_page_usd: Number(p.est_page_usd) || 0, est_basis: String(p.est_basis || ''),
    waiting_for_profile: !!p.waiting_for_profile, readiness: rd ? { ready: !!rd.ready, missing: arr(rd.missing).map(m => String((m && m.key) || '')).filter(Boolean), missing_text: String(rd.missing_text || '') } : null,
    approved_not_written: arr(p.approved_not_written) };
  return { json: { site_id: p.site_id, domain: p.domain, email: p.email || '', callback_url: p.callback_url || '', request_id: p.request_id, status: 'progress', stage: 'cycle_preview', week: p.week,
    subject: '[Coming up] ' + p.domain + ': ' + (p.waiting_for_keyword ? 'choose your first keyword' : held.length ? 'add your author profile and business facts to write ' + held.length + ' page(s)' : auto.length + ' page(s) written on their own, ' + (ok.length + sug.length) + ' waiting for your OK'),
    html: htmlL, lineage, callback_body: { ...callback_body, lineage } } };
});
