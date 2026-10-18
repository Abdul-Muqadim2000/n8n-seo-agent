// AI Growth report per site (e-mail / callback stage ai_growth; v4.12): done for you this week, what to do (ranked, with drafts), page readiness,
// the earned-media list, the questions queued for writing, the entity check.
// G29 (2026-10-13, FIX_PLAN): every figure group says where it came from, over what period and from how big a sample (LN).
/*__REPORT_KIT__*/
/*__LINEAGE__*/
const KIND = { list: '"Best of" list', article: 'Article', news: 'News', review: 'Review site', forum: 'Forum thread', video: 'Video', social: 'Social post', official: 'Official list', encyclopedia: 'Encyclopedia', competitor: 'Competitor page' };
// R94 (2026-10-16): a dry run (`dry_run: true` on the Manual Run - a test, never the weekly run) sends nothing to Bing or IndexNow;
// the request nodes hand on what WOULD have been sent, and the report says so first, instead of "nothing new to send".
const DRY_OF = (sid) => { const pick = (nm) => { try { return $(nm).all().map(i => i.json || {}).find(x => x.dry_run && x.site_id === sid) || null; } catch (e) { return null; } };
  let on = false; try { let t = $('Manual Run').first().json || {}; if (t.body && typeof t.body === 'object') t = { ...t, ...t.body }; on = t.dry_run === true || /^(true|1|yes|on)$/i.test(String(t.dry_run ?? '')); } catch (e) {}
  const b = pick('Bing Submit Requests'), x = pick('IndexNow Requests');
  return (on || b || x) ? { bing: b ? (b.would_submit || []).length : 0, indexnow: x ? (x.would_submit || []).length : 0 } : null; };
// reads Growth Metrics explicitly: the node before it saves a Data Table row and outputs that row, not the summary
return $('Growth Metrics').all().map(i => i.json).filter(m => !m.skip).map(m => {
  const B = m.submitted.bing, X = m.submitted.indexnow;
  const EB = m.earned_basis || {};   // C-3: what the earned-media counts are counted over
  // B9-1 (2026-10-15, benchmark area 9): what a submission actually reaches, said the way the sources say it. Bing's index is read
  // by Bing and Microsoft Copilot; OpenAI documents OAI-SearchBot, not Bing, as what surfaces pages in ChatGPT search; and
  // IndexNow's own FAQ states that submitting "does not guarantee immediate indexing". Sent is sent — never "indexed".
  const O = m.outcome || {};
  const done = [B.submitted ? n(B.submitted) + ' page(s) sent to Bing — the index Bing and Microsoft Copilot answer from (a submission is a notification, not indexing)' : (B.enabled ? (B.in_account ? (B.error ? 'Bing submission failed: ' + esc(B.error) : 'nothing new to send to Bing') : 'not sent to Bing: the site is not in the Bing Webmaster account') : 'Bing submission is off (no Bing Webmaster key)'),
    X.verified ? (X.submitted ? n(X.submitted) + ' page(s) notified through IndexNow (Bing, Yandex, Naver, Seznam, Yep — Google does not take part)' : 'IndexNow ready (nothing new to send)') : 'IndexNow waits for its key file',
    // B9-2 (INVARIANTS rule 4): a page sent is not a page crawled, so the run says what became of the ones sent before
    O.basis === 'measured' ? 'Of ' + n(O.submitted) + ' page(s) sent in the last ' + O.window_days + ' days, <b>' + n(O.crawled) + ' have since been crawled by Bing</b> and ' + n(O.submitted - O.crawled) + ' not yet'
      + (O.not_checked ? ' (' + n(O.not_checked) + ' of them not asked about this run)' : '') + ' — measured from Bing Webmaster Tools, not from the fact that we sent them'
      : O.basis === 'not available' ? 'What became of earlier submissions: not available — ' + esc(O.reason || '') : 'Nothing had been sent before this run, so there is nothing to follow up yet',
    n(m.pages.filter(p => p.status).length) + ' key page(s) checked for AI readiness' + (m.avg_score != null ? ' (average ' + m.avg_score + '/100' + (m.previous_avg_score != null ? ', was ' + m.previous_avg_score : '') + ')' : '')
      + (m.withheld_scores ? ', ' + n(m.withheld_scores) + ' not scored: robots.txt lets no AI search fetcher read them' : ''),
    n(m.earned.length) + ' page(s) AI cites without naming you' + (m.drafts_written ? ', ' + n(m.drafts_written) + ' outreach draft(s) written' : (m.handed_over ? ', ' + n(m.handed_over) + ' handed to the Link Builder (one writer): approve the pitches on the Link building page' : '')),   // P34-1: only the drafts THIS run wrote are counted; the stored ones of earlier runs are not this week's work
    n(m.targets.filter(t => t.status === 'queued').length) + ' question(s) queued for an AI answer page or refresh' + (m.ai_pages_month > 0 ? ' (' + m.ai_pages_month + ' a month, written by the Monday content run)' : ' (AI pages are off)')];
  const DRY = DRY_OF(m.site_id);
  const dry_run_note = DRY ? 'DRY RUN — nothing was submitted: ' + n(DRY.bing) + ' page(s) would have been sent to Bing and ' + n(DRY.indexnow) + ' notified through IndexNow (a test run; the weekly run submits)' : '';
  if (DRY) done.splice(0, 2, '<b>' + dry_run_note + '</b>');
  let html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:860px;color:#0f172a">';
  html += '<h2 style="margin:0 0 4px">AI growth — ' + esc(m.domain) + '</h2>' + p_(esc(m.checked_at.slice(0, 10)) + ' · the weekly work that gets you named and cited in AI answers', true);
  html += alertBox(m.alerts.filter(a => a.level !== 'good'));
  if (m.alerts.some(a => a.level === 'good')) html += '<div style="background:#f0fdf4;border-left:4px solid #15803d;padding:8px 12px;margin:8px 0">' + m.alerts.filter(a => a.level === 'good').map(a => '<div style="font-size:13px">✓ ' + esc(a.text) + '</div>').join('') + '</div>';
  html += h3('Done for you this week') + '<ul style="font-size:13px;margin:4px 0 8px 18px;padding:0">' + done.map(d => '<li>' + d + '</li>').join('') + '</ul>';
  html += h3('What to do next') + table(['', 'Action', 'Why'], m.actions.map(a => [a.priority === 1 ? 'High' : a.priority === 2 ? 'Medium' : 'Low', esc(a.action) + (a.draft ? '<div style="margin-top:4px;padding:6px;background:#f8fafc;font-size:12px;white-space:pre-wrap">' + (a.draft.subject ? '<b>' + esc(a.draft.subject) + '</b>\n' : '') + esc(a.draft.body) + '</div>' : ''), esc(a.why)]), 'nothing to do this week');
  // B-G2 (2026-10-15, INVARIANTS rule 1 + 2): a stored rung the read-path fit gate set aside became no question and no page — named
  // here with its reason, because "we are not writing a page about X because it is a competitor's brand" is the better answer.
  if ((m.set_aside || []).length) html += '<p style="margin:4px 0 8px;font-size:12px;color:#b45309"><b>Set aside</b> (planned before the keyword rule existed, no question and no page): '
    + m.set_aside.map(x => esc(x.note || (x.keyword + ' — ' + x.detail))).join(' | ') + '</p>';
  html += h3('Pages AI cites without naming you (earned media)') + (EB.answers ? p_('Counted over ' + n(EB.answers) + ' AI answers that did not name you, ' + esc(EB.from) + ' to ' + esc(EB.to) + ' (the weekly AI-visibility runs and the daily pulse): a page is counted once for each answer that linked it. The AI visibility report\'s "Sources AI relies on" counts websites over its own run, so the two numbers are not the same measure.', true) : '') + table(['Page', 'Kind', 'Answers citing it', 'Names', 'Next step'], m.earned.slice(0, 12).map(e => [link(e.url, e.title || e.host), esc(KIND[e.kind] || e.kind), n(e.citations) + ' · ' + esc(e.engines.join(', ')),
    e.mentions_us === true ? '<b style="color:#15803d">you</b>' : esc(e.competitors_named.join(', ') || (e.mentions_us === false ? 'not you' : '—')), esc(e.action)]), 'no third-party pages cited this week');
  // B9-3: a withheld score says why instead of printing a number nothing supports; the blocked pages sort to the top
  html += h3('Key pages: can AI read and quote them?') + table(['Page', 'Score', 'Updated', 'Bing', 'Fix first'], m.pages.slice().sort((a, b) => (a.score == null ? -1 : a.score) - (b.score == null ? -1 : b.score)).map(p => [link(p.url),
    p.score == null && p.score_withheld ? '<b style="color:#b91c1c">not scored</b><div style="font-size:11px;color:#64748b">' + esc(p.score_withheld) + '</div>' : p.status ? '<b>' + p.score + '</b>/100' : 'error ' + (p.status || ''), esc(p.updated_on || 'no date'),
    p.bing_crawled_at ? 'crawled ' + esc(p.bing_crawled_at.slice(0, 10)) : (p.bing_known ? 'not crawled' : '—'), esc(p.issues[0] || 'nothing')]), 'no pages checked this week');
  // B9-4: the status travels with the evidence it was decided on — how many answers named the business, out of how many asked
  html += h3('Questions queued for an AI answer page') + table(['Question', 'Plan', 'Status'], m.targets.filter(t => ['queued', 'writing', 'written', 'won'].includes(t.status)).slice(0, 10).map(t => [esc(t.question), t.kind === 'refresh' ? 'refresh ' + link(t.page_url) : 'new answer page',
    esc(t.status) + (t.reason ? '<div style="font-size:11px;color:#64748b">' + esc(String(t.reason).slice(0, 180)) + '</div>' : '')]), 'no lost questions — AI already names you for all of them');
  if ((m.refused_submissions || []).length) html += p_('Not sent: ' + m.refused_submissions.slice(0, 5).map(r => esc(r.url) + ' (' + esc(r.reason) + ')').join('; ') + '.', true);
  if (m.entity) html += h3('Entity') + p_(m.entity.found ? 'Wikidata: <b>' + esc(m.entity.qid) + '</b> lists ' + esc(m.domain) + ' as its official website.' : 'No Wikidata item has ' + esc(m.domain) + ' as its official website' + (m.entity.by_name.length ? ' (items with a similar name: ' + m.entity.by_name.slice(0, 3).map(x => esc(x.label + (x.description ? ' — ' + x.description : ''))).join('; ') + ')' : '') + '.');
  if (!m.submitted.indexnow.verified) html += p_('IndexNow: put a file at <b>' + esc(m.submitted.indexnow.key_url) + '</b> containing only <code>' + esc(m.submitted.indexnow.key) + '</code>.', true);
  // B9-10: Bing's own AI citation data exists, is free, and is in the account we already read - but no API returns it, so it is named, not imported
  html += h3("Bing's own AI citation data (read it in Bing Webmaster Tools)") + p_('<b>AI Performance</b> (public preview since 11 February 2026) shows how often your pages are cited in Microsoft Copilot and Bing AI summaries, which pages, and the <i>grounding queries</i> the AI used to find them; its <b>Topics Portfolio</b> (beta, from 13 October 2026) adds the opportunity queries where other sites appear and yours does not. That is Bing\'s measurement of real Copilot citations. The questions in this report are our own modelled list, asked of the assistants, which is a different thing. <b>No API returns the AI Performance report</b> (the documented Webmaster API has no endpoint for it), so nothing from it is in this report or in our numbers: open Bing Webmaster Tools, Search Performance, AI Performance, and compare it with the list above.', true);
  // B9-7: the wrong claims AI makes about the business, each with the fact on file and the pages that carry it
  if ((m.corrections || []).length) html += h3('Wrong claims AI makes about you (corrections)') + table(['The claim', 'The fact on file', 'Pages that carry it', 'Status'], m.corrections.map(c => [esc(c.claim), c.fact_on_file ? esc(c.true_fact) : '<b style="color:#b45309">needs your fact</b>',
    (c.pages || []).map(pg => link(pg.url, pg.title || pg.host) + '<div style="font-size:11px;color:#64748b">' + (pg.carries_claim === true ? 'the page says it' : pg.carries_claim === false ? 'cited in the answer; the page does not say it' : 'not read') + '</div>').join('') || '—',
    esc(c.status.replace(/_/g, ' ')) + '<div style="font-size:11px;color:#64748b">' + esc(String(c.note || '').slice(0, 220)) + '</div>' + (c.draft ? '<details style="margin-top:4px"><summary>Draft (never sent)</summary><div style="white-space:pre-wrap;font-size:12px">' + esc((c.draft.subject ? c.draft.subject + '\n\n' : '') + c.draft.body) + '</div></details>' : '')]), 'none');
  if (!X.verified || B.enabled) html += p_('What a submission reaches: Bing\'s index, which Bing and Microsoft Copilot answer from — Bing Webmaster Tools reports those citations in its AI Performance report, which has no API, so read it there. OpenAI documents <b>OAI-SearchBot</b>, not Bing, as what surfaces pages in ChatGPT search, and IndexNow states that submitting "does not guarantee immediate indexing".', true);
  const lineage = [
    LN.of('AI readiness score per key page', 'own_check', { basis: 'modelled', period: LN.asOf(m.checked_at), sample: LN.sample(m.pages.filter(p => p.status && p.score != null).length, 'key pages fetched as raw HTML and readable by at least one AI fetcher'),
      note: 'our own 0-100 score (answer in the first 200 characters, a visible update date, question headings, sourced figures) — a model, not a Google or an AI-engine figure' + (m.withheld_scores ? '; ' + m.withheld_scores + ' page(s) have no score because robots.txt lets no AI search fetcher read them' : '') }),
    // B9-2: the one figure in this report that says what a submission achieved, and it is Bing's own answer or it is nothing
    (m.outcome && m.outcome.basis === 'measured')
      ? LN.of('Pages crawled by Bing after we submitted them', 'bing', { basis: 'measured', period: 'the ' + m.outcome.window_days + ' days before ' + String(m.checked_at).slice(0, 10), sample: LN.sample(m.outcome.submitted, 'pages submitted and asked about again'), note: 'Bing Webmaster Tools GetUrlInfo (LastCrawledDate); a submission on its own proves nothing' })
      : LN.unknown('Pages crawled by Bing after we submitted them', (m.outcome && (m.outcome.reason || m.outcome.basis)) || 'no submission has been followed up yet'),
    // B9-3: what the AI fetchers may read is measured from the site's own robots.txt, or it is not checked
    (m.robots && !m.robots.unavailable) ? LN.of('What the AI search fetchers may read', 'own_check', { basis: 'measured', period: LN.asOf(m.checked_at), sample: LN.sample(Object.keys((m.robots && m.robots.verdicts) || {}).length, 'key pages evaluated against robots.txt'), note: (m.robots.note || 'the site\'s own robots.txt') + ', matched by Google\'s documented rules (most specific group, longest rule, Allow wins a tie)' })
      : LN.unknown('What the AI search fetchers may read', (m.robots && (m.robots.reason || m.robots.note)) || 'robots.txt was not read this run'),
    LN.of('Pages AI cites without naming you', 'ai_engines', { basis: 'measured', period: EB.answers ? EB.from + ' to ' + EB.to + ' (' + EB.days + ' days of stored answers: weekly AI-visibility runs and the daily pulse)' : 'the answers stored in the last 8 days', sample: LN.sample(m.earned.length, 'third-party pages cited') + (EB.answers ? ' in ' + EB.answers + ' answers that did not name you' : ''), note: 'the exact pages the assistants linked in their answers; each page counted once per answer that linked it' }),
    B.enabled && B.in_account ? LN.of('Bing crawl state and submissions', 'bing', { basis: 'reported', period: LN.asOf(m.checked_at), sample: LN.sample(B.submitted, 'pages submitted this run') })
      : LN.unknown('Bing crawl state', B.enabled ? 'this site is not in the Bing Webmaster account' : 'no Bing Webmaster key is configured'),
    LN.of('Questions queued for an AI answer page', 'ai_db', { basis: 'estimated', period: LN.asOf(m.checked_at), sample: LN.sample(m.targets.length, 'questions in the panel'), note: 'the value of each question uses DataForSEO\'s AI search volume estimate' }),
  ];
  html += LN.block(lineage) + '</div>';
  // C-11 (re-rating 2026-10-17): a dry run is a test - nothing was done for anyone this week - so its subject says so, and the callback
  // carries `dry_run: true`, which the app's delivery rule holds (app/shared/src/report-delivery.ts, hold code `test_run`)
  const subject = DRY ? '[AI growth · TEST RUN] ' + m.domain + ' — dry run, nothing was submitted'
    : '[AI growth] ' + m.domain + ' — ' + (m.actions.filter(a => a.priority === 1).length ? m.actions.filter(a => a.priority === 1).length + ' high-value action(s)' : 'done for you this week') + (m.alerts.some(a => a.level === 'good') ? ' · a win' : '');
  const file_name = 'ai-growth-' + m.domain.replace(/[^a-z0-9]+/gi, '-') + '-' + m.checked_at.slice(0, 10) + '.html';
  return { json: { ...m, lineage, subject, html, file_name, status: 'progress', stage: 'ai_growth', ...(DRY ? { dry_run: true, dry_run_note } : {}) }, binary: { data: { data: b64(wrapDoc(subject, html)), mimeType: 'text/html', fileName: file_name, fileExtension: 'html' } } };
});
