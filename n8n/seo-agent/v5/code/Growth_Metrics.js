// AI Growth per site (v4.12): what was done automatically this week (pages sent to Bing / IndexNow, key pages checked), the page readiness, the
// questions queued for an answer page or a refresh (the Content Cadence writes them), the earned-media list with drafts, the entity check, the
// actions ranked by value, alerts; plus the rows for seo_ai_pages, seo_ai_targets, seo_link_prospects, seo_ai_growth and seo_cache.
/*__SITE_MODEL__*/
/*__DRAFTS__*/
// RV-1 / RV-16 (2026-10-21): key pages that answer 404 (old addresses AI still cites) are ONE redirect action with the page each should go to,
// not "fix X (answers 404)" one by one, and they have no readiness score (the average was 25 with them at 0, 52-70 without)
/*__GONE__*/
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const all = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const ready = all('AI Readiness').filter(x => !x.skip), earnedAll = all('Earned Media').filter(x => !x.skip);
const oIn = all('AI Outreach Input').filter(x => !x.skip), oOut = all('AI Outreach Writer');
const bSub = all('Bing Submit Requests').filter(x => !x.skip), bRes = all('Submit to Bing'), bReq = all('Bing Growth Requests').filter(x => !x.skip);
// B9-2 / B9-3 (2026-10-15, benchmark area 9): the answers Bing gave about the pages we submitted in earlier runs, the pages a
// submission was refused for, and what the AI search fetchers are allowed to read at all.
const bReqAll = all('Bing Growth Requests'), bInfo = all('Fetch Bing Growth'), bSubAll = all('Bing Submit Requests'), iReqAll = all('IndexNow Requests');
const robots = all('Robots Verdicts (Growth)').filter(x => !x.skip);
const kReq = all('IndexNow Key Requests').filter(x => !x.skip), kRes = all('Fetch IndexNow Key'), iReq = all('IndexNow Requests').filter(x => !x.skip), iRes = all('Submit IndexNow');
const eReq = all('Entity Requests').filter(x => !x.skip), eRes = all('Fetch Wikidata');
const BING = __BING_ENABLED__;
const jsonOf = (r) => { if (!r) return {}; if (r.d !== undefined || r.ErrorCode !== undefined || r.search || r.query) return r; const b = r.body ?? r.data; if (b && typeof b === 'object') return b; try { return JSON.parse(b || '{}'); } catch (e) { return {}; } };
const parseJ = (raw) => { if (raw && typeof raw === 'object') return raw; try { return JSON.parse(String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')); } catch (e) { return {}; } };
const keyOf = (u) => { const m = String(u || '').trim().match(/^https?:\/\/(?:www\.)?([^\/?#]+)([^?#]*)/i); if (!m) return ''; return m[1].toLowerCase() + ((m[2] || '/').replace(/\/+$/, '') || '/'); };
const dateOfMs = (v) => { const m = String(v || '').match(/Date\((-?\d+)/); if (!m) return ''; const t = Number(m[1]); return t > 946684800000 ? new Date(t).toISOString() : ''; };   // "/Date(…)/"; year 1 = never crawled
const J = (o) => JSON.stringify(o);
const out = [];
for (const p of plans) {
  const now = p.checked_at;
  // ---- submissions ----
  const bi = bSub.findIndex(x => x.site_id === p.site_id); const br = bi >= 0 ? jsonOf(bRes[bi]) : null;
  const bingOk = bi >= 0 && br && !br.ErrorCode && !br.Message && !(br.error);
  const inAccount = bReq.some(x => x.site_id === p.site_id);
  const bing = { enabled: BING, in_account: inAccount, submitted: bingOk ? bSub[bi].urls.length : 0, urls: bi >= 0 ? bSub[bi].urls : [], quota: bi >= 0 ? bSub[bi].quota : null, error: bi >= 0 && !bingOk ? String((br && (br.Message || (br.error && (br.error.message || br.error)))) || 'no answer').slice(0, 200) : '' };
  const ki = kReq.findIndex(x => x.site_id === p.site_id); const kr = ki >= 0 ? (kRes[ki] || {}) : {};
  const verified = Number(kr.statusCode) === 200 && String(kr.body ?? kr.data ?? '').trim() === p.indexnow_key;
  const ii = iReq.findIndex(x => x.site_id === p.site_id); const ir = ii >= 0 ? (iRes[ii] || {}) : null;
  const inStatus = ir ? (Number(ir.statusCode) || (ir.error ? 0 : 200)) : 0; const inOk = ir && [200, 202].includes(inStatus);
  const indexnow = { key: p.indexnow_key, key_url: SM.siteUrl({ canonical_host: p.site_host, domain: p.domain }, '/' + p.indexnow_key + '.txt'), verified, submitted: inOk ? iReq[ii].urls.length : 0, status: inStatus || null, error: ir && !inOk ? 'IndexNow answered ' + (inStatus || 'nothing') : '' };
  const subVia = new Map(); for (const u of (bingOk ? bing.urls : [])) subVia.set(keyOf(u), 'bing'); if (inOk) for (const u of iReq[ii].urls) subVia.set(keyOf(u), subVia.has(keyOf(u)) ? 'bing+indexnow' : 'indexnow');
  // ---- pages ----
  const pages = ready.filter(r => r.site_id === p.site_id).map(r => ({ ...r, submitted_now: subVia.get(keyOf(r.url)) || '' }));
  const keyInfo = new Map(p.key_pages.map(k => [keyOf(k.url), k]));
  const page_rows = pages.map(r => { const k = keyInfo.get(keyOf(r.url)) || {}; const st = (p.stored_pages || []).find(x => x.key === keyOf(r.url)) || {};
    return { site_id: p.site_id, domain: p.domain, url: r.url, kind: r.kind, checked_at: r.checked_at, status: r.status, score: r.score, checks_json: J(r.checks.map(c => ({ key: c.key, ok: c.ok, weight: c.weight, label: c.label, detail: c.detail }))),
      issues: r.issues.slice(0, 4).join(' | ').slice(0, 1000), words_raw: r.words_raw, title: r.title, updated_on: r.updated_on, bing_crawled_at: r.bing_crawled_at, bing_status: r.bing_status,
      submitted_at: r.submitted_now ? now : (st.submitted_at || ''), submitted_via: r.submitted_now || st.submitted_via || '', cited_by: (k.cited_by || []).join(', '), questions: (k.questions || []).join(' | ').slice(0, 600) }; });
  // submitted pages not checked this week and never stored: a first row so the next run knows they were sent
  for (const [k, via] of subVia) if (!pages.some(r => keyOf(r.url) === k) && !(p.stored_pages || []).some(x => x.key === k)) { const kp = keyInfo.get(k); const url = (kp && kp.url) || 'https://' + k;
    page_rows.push({ site_id: p.site_id, domain: p.domain, url, kind: (kp && kp.kind) || 'page', checked_at: '', status: 0, score: null, checks_json: '', issues: '', words_raw: 0, title: '', updated_on: '', bing_crawled_at: '', bing_status: 0, submitted_at: now, submitted_via: via, cited_by: '', questions: '' }); }
  // B9-3: a page no AI search fetcher may read has NO readiness score, so it is not in the average either — a withheld score is
  // not a zero and not a silent omission: it is reported as "not scored" with the rule that withheld it.
  const scored = pages.filter(r => r.status && r.score != null);
  const withheld = pages.filter(r => r.score == null && r.score_withheld);
  const avg_score = scored.length ? Math.round(scored.reduce((t, r) => t + r.score, 0) / scored.length) : null;
  const robots_site = robots.find(x => x.site_id === p.site_id) || null;
  // ---- B9-2 (INVARIANTS rule 4): what became of the pages we submitted. A submission is a notification; Bing's own answer
  // (GetUrlInfo: LastCrawledDate) is the only evidence that one became a crawl, and when it cannot be asked the figure is not
  // estimated — it says it is not available, and why.
  const daysAgo = (d) => d ? (new Date(now) - new Date(d)) / 864e5 : Infinity;
  const infoByKey = new Map();
  bReqAll.forEach((q, i) => { if (q && q.kind === 'info' && q.site_id === p.site_id) { const d = (jsonOf(bInfo[i]) || {}).d; infoByKey.set(keyOf(q.page), d || null); } });
  const crawlOf = (st) => { const d = infoByKey.get(keyOf(st.url)); const fresh = d ? dateOfMs(d.LastCrawledDate) : ''; return fresh || st.bing_crawled_at || ''; };
  const subWindow = Number(p.follow_up_days) || 45;
  const outcome = (() => {
    if (!BING) return { basis: 'not available', reason: 'Bing submission is off for this installation (no Bing Webmaster key)' };
    if (!inAccount) return { basis: 'not available', reason: 'the site is not in the Bing Webmaster account, so Bing cannot be asked what it has crawled' };
    const rows = (p.stored_pages || []).filter(st => st.submitted_at && daysAgo(st.submitted_at) <= subWindow)
      .map(st => ({ url: st.url, submitted_at: st.submitted_at, via: st.submitted_via || '', crawled_at: crawlOf(st), asked: infoByKey.has(keyOf(st.url)) }));
    for (const [k, via] of subVia) if (!rows.some(r => keyOf(r.url) === k)) rows.push({ url: (keyInfo.get(k) || {}).url || k, submitted_at: now, via, crawled_at: '', asked: false, sent_now: true });
    const earlier = rows.filter(r => !r.sent_now); const crawled = earlier.filter(r => r.crawled_at);
    const waiting = earlier.filter(r => !r.crawled_at);
    return { basis: earlier.length ? 'measured' : 'none', source: 'Bing Webmaster Tools (GetUrlInfo)', window_days: subWindow, submitted: earlier.length, crawled: crawled.length,
      sent_now: rows.length - earlier.length, checked_now: earlier.filter(r => r.asked).length, not_checked: waiting.filter(r => !r.asked).length,
      waiting: waiting.map(r => ({ url: r.url, days: Math.round(daysAgo(r.submitted_at)), asked: r.asked })).sort((a, b) => b.days - a.days).slice(0, 8),
      reason: earlier.length ? '' : 'nothing had been submitted in the last ' + subWindow + ' days before this run' };
  })();
  const refusedSub = [...((bSubAll.find(x => x.site_id === p.site_id) || {}).refused || []), ...((iReqAll.find(x => x.site_id === p.site_id) || {}).refused || [])]
    .filter((r, i, a) => a.findIndex(x => x.url === r.url) === i);
  // ---- earned media (+ drafts) ----
  const em = earnedAll.find(x => x.site_id === p.site_id) || { earned: [], prospect_rows: [], outreach_jobs: [] };
  const oi = oIn.findIndex(x => x.site_id === p.site_id); const drafts = oi >= 0 && oOut[oi] && !oOut[oi].error ? ((parseJ(oOut[oi].output).drafts) || []) : [];
  const draftFor = (job) => drafts.find(d => Number(d.n) === job.n) || null;
  // P34-1 (live 2026-10-12): the drafts the report counts and prints are the ones THIS run's writer produced. Reading them off the
  // stored prospect row brought back the pitches of 2026-10-02 — written before the D12 / D13 gates — as "8 outreach draft(s) written",
  // including one to tax.gov.ae. A draft written now is stamped (drafted_at); Earned Media has already withdrawn the superseded ones.
  const wroteNow = new Map();
  const prospect_rows = em.prospect_rows.map(r => { const job = em.outreach_jobs.find(j => j.prospect_domain === r.prospect_domain && j.kind !== 'correction'); const d = job ? draftFor(job) : null;
    if (!(d && d.body)) return r;
    const fresh = DRAFTS.fresh(d, now); wroteNow.set(r.prospect_domain, { subject: fresh.outreach_subject, body: fresh.outreach_body });
    return { ...r, outreach_subject: fresh.outreach_subject, outreach_body: fresh.outreach_body, drafted_at: fresh.drafted_at }; });   // status stays new (the app's prospect statuses: new / contacted / won / rejected / ignored); a stored draft = ready to send
  const earned = em.earned.slice(0, 15).map(e => { const row = prospect_rows.find(r => r.prospect_domain === e.host && r.source_url === e.url); return { ...e, status: row ? row.status : '', contact_email: (row && row.contact_email) || e.contact_email || '', draft: wroteNow.get(e.host) || null }; });
  // B9-7: the wrong claims AI makes, each with the fact on file and the pages that carry it; a draft only where the one writer wrote one
  const corrections = (em.corrections || []).map(c => { const job = c.job_n ? em.outreach_jobs.find(j => j.n === c.job_n && j.kind === 'correction') : null; const d = job ? draftFor(job) : null;
    return { ...c, draft: d && d.body ? { subject: String(d.subject || ''), body: String(d.body) } : null, status: c.status === 'draft_requested' ? (d && d.body ? 'drafted' : 'draft_failed') : c.status }; });
  const drafts_written = wroteNow.size, handed_over = p.link_builder ? em.prospect_rows.filter(r => /Link Builder/.test(String(r.note || ''))).length : 0;
  const newlyWon = prospect_rows.filter(r => r.status === 'won' && r.won_at === now);
  // ---- targets ----
  const targets = p.targets; const queued = targets.filter(t => t.status === 'queued').sort((a, b) => b.value - a.value); const wonT = targets.filter(t => t.status === 'won' && t.won_at === now);
  // ---- entity (Wikidata) ----
  let entity = p.previous_entity || null;
  const er = eReq.map((q, i) => ({ q, r: jsonOf(eRes[i]) })).filter(x => x.q.site_id === p.site_id);
  if (er.length) { const byName = ((er.find(x => x.q.kind === 'name') || {}).r || {}).search || []; const bySite = er.filter(x => x.q.kind === 'site').flatMap(x => ((x.r.query || {}).search || []).map(s => s.title)).filter(Boolean);
    const qid = bySite[0] || ''; entity = { checked_at: now, found: !!qid, qid, by_site: [...new Set(bySite)], by_name: byName.slice(0, 5).map(s => ({ id: s.id, label: s.label, description: s.description || '' })),
      errors: er.filter(x => !x.r || (!x.r.search && !x.r.query)).length }; }
  // ---- actions (most valuable first) and alerts ----
  const actions = []; const alerts = [];
  const goneP = pages.filter(r => r.gone || GONE.isGone(r.status));
  const gone_pages = GONE.plan(goneP.map(r => ({ url: r.url, status: r.status })), [...pages.filter(r => r.status >= 200 && r.status < 300), ...(p.key_pages || [])].filter(k => !goneP.some(g => keyOf(g.url) === keyOf(k.url))),
    SM.siteUrl({ canonical_host: p.site_host, domain: p.domain }, '/'));
  { const ga = GONE.action(gone_pages); if (ga) { actions.push({ ...ga, why: gone_pages.length + ' key page(s) AI cites or that we track answer ' + [...new Set(gone_pages.map(r => r.status || 404))].join(' / ') + ': every assistant and every searcher who follows them lands on an error page. Do not improve or submit these pages: they no longer exist.' });
    alerts.push({ level: 'high', text: gone_pages.length + ' key page(s) no longer answer (' + gone_pages.slice(0, 3).map(r => r.from).join(', ') + (gone_pages.length > 3 ? ' and more' : '') + '): redirect them to the closest live page.' }); } }
  for (const r of pages.filter(r => !(r.gone || GONE.isGone(r.status)) && (!r.status || r.status >= 400 || r.checks.some(c => c.key === 'indexable' && c.ok === false && r.status >= 200 && r.status < 300)))) {
    actions.push({ priority: 1, type: 'access', action: 'Fix ' + r.url + (r.status >= 400 || !r.status ? ' (answers ' + (r.status || 'nothing') + ')' : ' (not indexable)'), why: r.issues[0] || 'Assistants cannot use a page they cannot fetch or index.' });
    if (['cited', 'target', 'ladder', 'content', 'home'].includes(r.kind)) alerts.push({ level: 'high', text: 'Key page ' + r.url + ' cannot be used by AI: ' + (r.issues[0] || 'error ' + r.status) });
  }
  for (const r of pages.filter(r => r.checks.some(c => c.key === 'raw_text' && c.ok === false))) actions.push({ priority: 1, type: 'render', action: 'Serve the text of ' + r.url + ' in the HTML', why: 'Only ' + r.words_raw + ' words without JavaScript; ChatGPT, Claude, Perplexity and Gemini do not run JavaScript.' });
  // B9-3: robots.txt decides this before anything on the page does — a blocked page is the first thing to fix, and a key page
  // no assistant may read at all is an alert, not a low score.
  for (const r of pages.filter(r => (r.robots_blocked || []).length)) {
    actions.push({ priority: 1, type: 'robots', action: 'Let the AI search fetchers read ' + r.url + ' (robots.txt)', why: r.issues[0] || ('robots.txt blocks ' + r.robots_blocked.join(', ') + ' (' + r.robots_rule + ').') });
    if (r.score_withheld && ['cited', 'target', 'ladder', 'content', 'home'].includes(r.kind)) alerts.push({ level: 'high', text: 'No AI search fetcher may read ' + r.url + ': ' + r.robots_rule + ' in robots.txt. It cannot be quoted whatever is on it.' });
  }
  // B9-8: a page that answers a browser and refuses the AI answer fetchers is a high finding (its score is withheld, never printed)
  for (const r of pages.filter(r => (r.findings || []).some(f => f.key === 'ai_fetchers_refused'))) {
    const f = r.findings.find(f => f.key === 'ai_fetchers_refused');
    actions.push({ priority: 1, type: 'fetchers', action: 'Let the AI answer fetchers read ' + r.url + ' (' + f.bots.join(', ') + ' refused)', why: f.text });
    alerts.push({ level: 'high', text: f.text.slice(0, 300) + ' ' + r.url });
  }
  // B9-7: a wrong claim is either waiting for the owner's fact, or has a correction to review - never sent from here
  for (const c of corrections) {
    if (c.status === 'needs_fact') actions.push({ priority: 2, type: 'fact', action: 'Tell us the true answer to a wrong claim AI makes: "' + c.claim.slice(0, 100) + '"', why: c.note });
    else if (c.status === 'drafted') actions.push({ priority: 2, type: 'correction', action: 'Review the correction drafted for ' + ((c.pages.find(pg => pg.carries_claim) || {}).host || 'the publisher') + ' (it is not sent)', why: 'AI says "' + c.claim.slice(0, 100) + '"; the fact on file: ' + c.true_fact });
    else if (c.status === 'handed_over') actions.push({ priority: 2, type: 'correction', action: 'Approve the Link Builder\'s correction pitch for "' + c.claim.slice(0, 80) + '"', why: c.note });
  }
  // B9-5: a page AI used to cite and has stopped citing — measured from our own stored weekly checks, and the best refresh there is
  for (const kp of (p.key_pages || []).filter(k => k.decay).slice(0, 2)) actions.push({ priority: 2, type: 'decay', action: 'Refresh ' + kp.url + ' — AI has stopped citing it',
    why: 'It was cited in ' + kp.decay.cited_in + ' of the last ' + kp.decay.runs + ' weekly AI checks and in neither of the last two (last cited ' + (kp.decay.last_cited || 'earlier') + '). Update it with new facts and show the new date.', url: kp.url });
  for (const e of earned.filter(e => e.draft || e.action_type === 'reply').slice(0, 3)) actions.push({ priority: 1, type: 'earned', action: e.action, why: 'AI cited "' + (e.title || e.url) + '" ' + e.citations + 'x (' + e.engines.join(', ') + ') for "' + (e.questions[0] || '') + '"' + (e.competitors_named.length ? '; it names ' + e.competitors_named.join(', ') + ' and not you' : '') + (e.draft ? '. A draft is ready.' : ''), url: e.url, draft: e.draft });
  if (!verified) actions.push({ priority: 2, type: 'indexnow', action: 'Put one file on the website: ' + indexnow.key_url, why: 'The file contains just ' + p.indexnow_key + '. Then every new or updated page is notified the same day to the IndexNow engines — Bing (which Microsoft Copilot answers from), Yandex, Naver, Seznam, Yep and Amazon; Google does not take part, and a notification is not an indexing.', key: p.indexnow_key, key_url: indexnow.key_url });
  if (BING && !inAccount) actions.push({ priority: 2, type: 'bing', action: 'Add ' + p.site_host + ' to Bing Webmaster Tools', why: 'Import it from Google Search Console (one click) in the account the agent reads: new pages are then submitted to Bing every week and Bing\'s crawl of each key page is checked.' });
  for (const t of queued.filter(t => !(t.kind === 'refresh' && gone_pages.some(g => keyOf(g.from_url) === keyOf(t.page_url)))).slice(0, 2)) actions.push({ priority: 2, type: t.kind === 'refresh' ? 'refresh' : 'content', action: (t.kind === 'refresh' ? 'Refresh ' + t.page_url + ' to answer "' : 'Write an answer page for "') + t.question + '"', why: t.reason + (p.ai_pages_month > 0 ? '. Queued: the Monday content run writes it (' + p.ai_pages_month + ' AI pages a month).' : '. AI pages are off for this site: write it from the AI visibility page.'), target_id: t.target_id,
    api_body: { mode: 'keyword', keyword: t.keyword, country: p.country, domain: p.domain, page_type: t.page_type || 'Guide', existing_page_url: t.kind === 'refresh' ? t.page_url : '', receive: ['Keyword Report', 'Page Content'], ai_target: { question: t.question, kind: t.kind, fanout: t.fanout.split(' | ').filter(Boolean), sources: JSON.parse(t.sources_json || '[]'), competitors: t.competitors.split(', ').filter(Boolean), target_id: t.target_id } } });
  for (const r of pages.filter(r => ['cited', 'target', 'ladder', 'content'].includes(r.kind) && r.score != null && r.checks.some(c => (c.key === 'fresh' || c.key === 'answer_first') && c.ok !== true)).slice(0, 3)) actions.push({ priority: 3, type: 'page', action: 'Improve ' + r.url + ' (AI-readiness ' + r.score + '/100)', why: r.issues.slice(0, 2).join(' ') });
  if (entity && !entity.found) actions.push({ priority: 3, type: 'entity', action: 'Become a recognised entity', why: 'No Wikidata item has ' + p.domain + ' as its official website. Wikidata accepts organisations with independent sources (press, registries): once covered, create the item with the website (P856), the founding date and the location — knowledge graphs feed AI answers.' });
  for (const w of newlyWon) alerts.push({ level: 'good', text: 'You are now named on ' + w.source_url + ', a page AI cites for your topic.' });
  // B9-4: a win carries the evidence it was called on, and a win that has gone is said out loud instead of standing for ever
  for (const t of wonT) alerts.push({ level: 'good', text: 'AI now names you for "' + t.question + '" — ' + (((p.won_now || []).find(w => w.target_id === t.target_id) || {}).observed || 'measured on the answers of the last 8 days') + ' (an AI target written for it).' });
  for (const w of (p.won_lost || [])) alerts.push({ level: 'medium', text: 'AI has stopped naming you for "' + w.question + '" (won ' + (w.won_at || 'earlier') + ', lost again ' + w.lost_at + '; ' + w.observed + '). It is back in the queue.' });
  // B9-6: a question whose page run was started and never produced a page would otherwise sit "being written" for ever
  for (const st of (p.stalled_targets || [])) alerts.push({ level: 'medium', text: 'The page for "' + st.question + '" was started on ' + st.since + ' and never arrived (' + st.detail + '): the question is back in the queue.' });
  const growth_row = { site_id: p.site_id, domain: p.domain, run_id: p.run_id, checked_at: now, submitted: bing.submitted + indexnow.submitted,
    // B9-2: the run row keeps what became of the submissions, so next week can compare like with like
    submitted_json: J({ bing, indexnow: { ...indexnow, key: undefined }, outcome, refused: refusedSub.slice(0, 10), robots: robots_site ? { found: robots_site.found, unavailable: robots_site.unavailable, reason: robots_site.reason, blocked_pages: (robots_site.blocked_pages || []).length } : null }),
    indexnow: verified ? 'verified' : 'key_missing',
    pages_checked: scored.length, avg_score, pages_json: J(pages.map(r => ({ url: r.url, kind: r.kind, score: r.score, status: r.status, issues: r.issues.slice(0, 3), updated_on: r.updated_on, words_raw: r.words_raw, bing_crawled_at: r.bing_crawled_at, submitted: r.submitted_now }))),
    // 2026-10-19 (agent E4): the questions the fit gate refused (stored `set_aside`, never written) are counted beside the others, so the
    // summary of 6 targets never reads as 4 because two were quietly left out
    targets_json: J({ queued: queued.length, writing: targets.filter(t => t.status === 'writing').length, written: targets.filter(t => t.status === 'written').length, won: targets.filter(t => t.status === 'won').length,
      set_aside: targets.filter(t => t.status === 'set_aside').length, top: queued.slice(0, 5).map(t => ({ target_id: t.target_id, question: t.question, kind: t.kind, page_url: t.page_url, value: t.value })) }),
    earned_json: J(earned.slice(0, 12).map(e => ({ url: e.url, title: e.title, host: e.host, kind: e.kind, citations: e.citations, engines: e.engines, questions: e.questions, mentions_us: e.mentions_us, competitors_named: e.competitors_named, action: e.action, status: e.status, drafted: !!e.draft }))),
    entity_json: entity ? J(entity) : '', actions_json: J(actions.map(({ api_body, draft, ...a }) => a).slice(0, 12)), alerts: alerts.map(a => a.level + ': ' + a.text).join(' | ').slice(0, 2000), cost_usd: oi >= 0 ? 0.03 : 0 };
  const cache_rows = (p.indexnow_new || (verified && !p.indexnow_verified_at)) ? [{ key: 'indexnow:' + p.site_id, kind: 'ai', site_id: p.site_id, value: J({ key: p.indexnow_key, verified_at: verified ? now : '', created_at: now }), updated_at: now }] : [];
  out.push({ json: { site_id: p.site_id, domain: p.domain, site_host: p.site_host, business_name: p.business_name, email: p.email, callback_url: p.callback_url, request_id: p.request_id, on_demand: p.on_demand, run_id: p.run_id, checked_at: now, ai_pages_month: p.ai_pages_month,
    submitted: { bing, indexnow }, outcome, refused_submissions: refusedSub, robots: robots_site, withheld_scores: withheld.length, key_pages: p.key_pages || [], won_lost: p.won_lost || [], win_min_answers: p.win_min_answers || 2,
    pages: pages.map(({ checks, ...r }) => ({ ...r, checks: checks.map(c => ({ key: c.key, ok: c.ok, label: c.label })) })), avg_score, previous_avg_score: p.previous ? p.previous.avg_score : null,
    targets: targets.map(t => ({ target_id: t.target_id, question: t.question, kind: t.kind, page_url: t.page_url, status: t.status, value: t.value, reason: t.reason, engines: t.engines, competitors: t.competitors })),
    // B-G2 (2026-10-15): the rungs the read-path fit gate set aside, with the reason, so the report says why the list is shorter
    set_aside: p.set_aside || [], set_aside_note: p.set_aside_note || '',
    earned, earned_basis: p.earned_basis || null, corrections, entity, actions: actions.slice(0, 12), alerts, drafts_written, handed_over, page_rows, target_rows: targets, prospect_rows, growth_row, cache_rows,
    gone_pages } });   // RV-1: the key pages that no longer answer, with the redirect each needs
}
return out.length ? out : [{ json: { skip: true } }];
