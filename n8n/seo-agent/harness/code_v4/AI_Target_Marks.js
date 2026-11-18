// v4.12: the AI targets whose page run was started this week -> status `writing` (the AI Growth loop marks them `won` once AI
// names the business for the question).
//
// B9-6 (2026-10-15, benchmark area 9 / INVARIANTS rule 4 — the WRITE half; the read half landed in build section 82):
// `writing` was a promise nobody kept. This node marked every planned target `writing` whatever the spawn did, and nothing ever
// wrote the row forward again, so a question could sit "being written" for ever and never be queued a second time — R1's class
// in the one table R1 did not cover. Two things change here, and both are evidence, not optimism:
//   * a target whose content run could NOT BE STARTED goes back to `queued` with the reason, so the next run picks it up. That is
//     the way back check B of `state_lint.py` now requires of every table a run moves to `writing`.
//   * the row that IS marked says in its own `reason` that nothing has been written yet. `written_at` is the moment the attempt
//     was made — it is what the read half (`Growth_Plan.js`) measures its 14-day staleness from, and the only thing that moves
//     this row to `written` is *AI Target Settle*, against a `seo_content_log` row for the same run.
// What this node CANNOT see: a run that starts and is then refused inside the main workflow (the budget guard, a failed step).
// `Start Content Runs` is an Execute Workflow node with `waitForSubWorkflow: false`, so the outcome never comes back here. That
// gap is exactly what the read half's evidence rule is for; it is not papered over with a guess.
// ---- AQ: the page for an AI question, one rule everywhere (client reports 2026-11-16, devaicon.com; INV1 F1 F5 F8 F11 F13) ----
// devaicon.com was told "Win the answer to 'Which companies offer the best AI automation services for businesses in Dubai?'", clicked
// "Write the page", and the page was written for the panel TOPIC "ai automation services" (the search of its own service page), typed
// "Service Page", and then recorded as published at that service page. One AI question is its own search: the prompt row's `keyword`
// ("best ai automation services dubai"), never the topic the panel was built around. This kit holds what every path needs to say so:
//   AQ.keywordOf(q)         the question's own search (its keyword, else its topic, else the question's words), lower case, at most 80 chars
//   AQ.pageType(t)          a page type the content form accepts ("Comparison Page" is written as a Guide: the form has no comparison type)
//   AQ.done(status)         a target whose page is being written, written or won: no "write a page" action for it
//   AQ.reason(code, args)   the plain sentence for a target's state (the contract's reason codes); args { page_url, keyword, date, market }
//   AQ.clean(text)          a reason a client may read: no run / target ids, no table names, no lever ids, no dollar figures, no long dashes
//   AQ.CODES                the reason codes (the app falls back on the status for a code it does not know)
// Pure: no clock, no table, no network, no URL constructor (n8n sandbox).
const AQ = (() => {
  const S = (v) => String(v == null ? '' : v);
  const FORM_TYPES = ['Service Page', 'Product Page', 'Blog Post', 'Landing Page', 'Guide', 'Pillar Page', 'Local Page'];
  const pageType = (t) => { const x = S(t).trim(); return FORM_TYPES.includes(x) ? x : 'Guide'; };
  const QSTOP = new Set(['which', 'who', 'what', 'how', 'why', 'is', 'are', 'the', 'a', 'an', 'for', 'of', 'in', 'to', 'do', 'does', 'can', 'should', 'i', 'we', 'our', 'my', 'your', 'you']);
  const keywordOf = (q) => { const x = q || {};
    const k = S(x.keyword).toLowerCase().replace(/\s+/g, ' ').trim() || S(x.topic).toLowerCase().replace(/\s+/g, ' ').trim()
      || S(x.prompt || x.question).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w && !QSTOP.has(w)).slice(0, 6).join(' ');
    return k.slice(0, 80); };
  const DONE = ['writing', 'written', 'won'];
  const done = (status) => DONE.includes(S(status));
  const pathOf = (u) => { const m = S(u).match(/^https?:\/\/[^\/?#]+([^?#]*)/i); return m ? (m[1] || '/') : S(u); };
  const day = (d) => S(d).slice(0, 10);
  const CODES = ['new_page', 'refresh_page', 'writing', 'written', 'live', 'won', 'lower_value', 'fresh_page', 'no_longer_lost', 'off_topic', 'other_market',
    'same_search_page', 'run_failed', 'ai_rank', 'not_for_site', 'unjudged', 'draft_failed', 'lost_again', 'ladder_page', 'not_asked', 'off_panel', 'kept_by_you', 'too_few', 'suggested'];
  const reason = (code, args) => { const a = args || {}; const p = a.page_url ? pathOf(a.page_url) : 'your page';
    switch (code) {
      case 'new_page': return 'No page on your website answers this question yet, so a new answer page is planned.';
      case 'refresh_page': return 'Your page ' + p + ' is the closest answer, so it is planned to be improved for this question.';
      case 'same_search_page': return 'Your page ' + p + ' is already the page for "' + S(a.keyword) + '". To win this AI answer it is improved for the question, rather than a second page written for the same search.';
      case 'writing': return 'The page for this question is being written' + (a.date ? ' (started ' + day(a.date) + ')' : '') + '.';
      case 'written': return 'The page for this question is written and waiting to be published.';
      case 'live': return (a.page_url ? 'Your page ' + p + ' answers this question' : 'The page for this question is published') + (a.date ? ' (published ' + day(a.date) + ')' : '') + '. AI answers usually take a few weeks to change.';
      case 'won': return 'AI now names you for this question.';
      case 'lower_value': return 'Other questions are worth more this week; this one is checked again next week.';
      case 'fresh_page': return 'Your page ' + p + ' already answers it and is up to date.';
      case 'no_longer_lost': return 'AI already names you here.';
      case 'off_panel': return 'The question was taken off your AI questions.';
      case 'not_asked': return 'This question was not asked in the last 8 days, so there is nothing to judge yet.';
      case 'too_few': return 'Too few answers named you yet to call this question won.';
      case 'off_topic': return 'This question is not about what you sell (we look at your services, your keywords and your pages). If you do sell it, add it to your services.';
      case 'other_market': return 'This question is about another market than your website\'s.';
      case 'not_for_site': return a.reason === 'job' ? 'It is a search for jobs, not for what you sell.' : a.reason === 'government' ? 'It asks about a government body or service.' : a.reason === 'navigational' ? 'People asking it look for one particular website.' : 'It asks about another company.';
      case 'unjudged': return 'Too little is known about what you sell to tell whether this question is part of it, so it is only suggested, never written on its own.';
      case 'run_failed': return 'The page could not be finished, so it is queued to be written again.';
      case 'draft_failed': return 'The page written for this question did not pass the quality check: fix the draft and run it again.';
      case 'lost_again': return 'AI named you for this question and has stopped, so it is queued again.';
      case 'ladder_page': return 'It is written as the keyword ladder page "' + S(a.keyword) + '" (one search, one page).';
      case 'ai_rank': return 'Chosen by AI ranking: ' + (a.page_url ? 'improving ' + p : 'a page that answers it') + ' is the step most likely to get you named here.';
      case 'kept_by_you': return 'You chose not to write a page for it.';
      case 'suggested': return 'It is listed as a suggestion' + (a.page_url ? ': your page ' + p + ' answers it' : '') + ', and no page is written for it on its own.';
      default: return '';
    } };
  // the ids the engine uses (cad_20261113_devaicon-com_2, ait_..., lad_...), the table names, the AI-ranking lever ids, money, long dashes
  const clean = (t) => S(t)
    .replace(/\b(?:cad|ait|lad|act|air|pub|req)_[A-Za-z0-9_.-]+/g, '')
    .replace(/\bseo_[a-z_]+\b(?:\s+row)?/g, 'record')
    .replace(/\s*\(L\d{2}\)/g, '').replace(/\bL\d{2}\b:?\s*/g, '')
    .replace(/,?\s*expected gain [0-9.]+/gi, '').replace(/\s*\(?client time at \$?[0-9.,]+ an hour\)?/gi, '')
    .replace(/\s*(?:over|at|for|costs?)?\s*(?:US)?\$\s?[0-9][0-9,.]*/g, '')
    .replace(/[—–]/g, ',').replace(/…/g, '.').replace(/[“”]/g, '"').replace(/[‘’]/g, '\'')
    .replace(/\(\s*\)/g, '').replace(/\s+([,.;:])/g, '$1').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
  // CR17 (client report 2026-11-17, Q2 / Q3): the LIVE page that answers a question, one rule for every settle (AI Target Settle, AI Growth's
  // settleOf, the settle at publish time): among the website's published content-log rows, the page whose keyword IS the question's search, or a
  // ladder's MAIN page whose words the question carries (LRU.questionPage, in the website's market), newest first. o: { domain, market, except
  // (an address to leave out) }. Needs LRU inlined beside it (null without it).
  const normD = (d) => S(d).toLowerCase().replace(/^www\./, '');
  const answeredBy = (kw, logs, o) => { const x = o || {}; if (typeof LRU === 'undefined' || !S(kw).trim()) return null;
    return (Array.isArray(logs) ? logs : []).filter(l => l && S(l.status) === 'published' && S(l.published_url).trim() && (!x.domain || normD(l.domain) === normD(x.domain))
      && (!x.except || LRU.urlKey(l.published_url) !== LRU.urlKey(x.except)) && LRU.questionPage(kw, { keyword: l.keyword, rung: l.rung }, x.market || ''))
      .sort((a, b) => S(b.published_at).localeCompare(S(a.published_at)))[0] || null; };
  // CR17 (Q3): when a page goes live ("I published a page", publish detection) the questions it answers settle at once ($0), not on the next
  // weekly settle: devaicon.com's question 37 said "a page is planned" for days after its ladder's main page went live. rows: the content-log rows
  // just recorded live (log_row: keyword, rung, request_id, published_url, published_at, started_at, domain); targets: the website's stored
  // questions; o: { market, now }. A question settles to the page when the run that wrote the page carried it (the same request id), or when the
  // page answers it by the one rule (LRU.questionPage). Only a question waiting for a page (queued), or one whose own run's page this is; a
  // question being written by another run, won, kept out, skipped or set aside is left alone. -> rows for the settle update (the cadence's
  // *Settle AI Targets* columns).
  const settleOnPublish = (rows, targets, o) => { const x = o || {}; const now = S(x.now) || new Date().toISOString(); const out = []; const done0 = new Set();
    if (typeof LRU === 'undefined') return out;
    for (const r of (Array.isArray(rows) ? rows : [])) {
      if (!r || S(r.status) !== 'published' || !S(r.published_url).trim()) continue;
      for (const t of (Array.isArray(targets) ? targets : [])) {
        // review R5 (L2): the page and the question are of the SAME website (a row or a target with no domain matches nothing), and a planned
        // REFRESH of a page settles only against its own run: another new page of the same search does not do that refresh (AI Growth's rule)
        if (!t || !S(t.target_id) || done0.has(S(t.target_id)) || !normD(r.domain) || normD(r.domain) !== normD(t.domain)) continue;
        const st = S(t.status); const own = !!S(r.request_id) && S(t.request_id) === S(r.request_id);
        if (!(st === 'queued' || (own && (st === 'writing' || st === 'written')))) continue;
        if (S(t.kind) === 'refresh' && !own) continue;
        if (!own && !LRU.questionPage(S(t.keyword) || keywordOf(t), { keyword: r.keyword, rung: r.rung }, x.market || '')) continue;
        const args = { page_url: S(r.published_url), date: day(r.published_at || now) };
        done0.add(S(t.target_id));
        out.push({ target_id: S(t.target_id), status: 'written', request_id: S(r.request_id), written_at: S(r.started_at || t.written_at || now), at: now,
          reason_code: 'live', reason_args: JSON.stringify(args), reason: reason('live', args) + ' Settled when the page was recorded live on ' + day(now) + '.' });
      }
    }
    return out; };
  return { FORM_TYPES, pageType, keywordOf, done, DONE, reason, clean, CODES, pathOf, answeredBy, settleOnPublish };
})();
const now = new Date().toISOString();
// the plan items that really went to *Start Content Runs*: `Any Pages?` drops `nothing_to_do` and `Dry Run?` drops a dry run,
// in this order, so index i here is item i there (the node runs in `each` mode).
const items = $('Cadence Plan').all().map(i => i.json).filter(p => p && !p.nothing_to_do && !p.dry_run);
let spawned = null;
try { spawned = $('Start Content Runs').all(); } catch (e) { spawned = null; }
// only trust the index when the two lists line up — a length that differs means something filtered in between, and guessing
// which page failed would be worse than marking as before
const aligned = Array.isArray(spawned) && spawned.length === items.length;
const errOf = (it) => { if (!it) return ''; const e = it.error || (it.json && it.json.error); if (!e) return '';
  return String((e && (e.message || e.description)) || e).slice(0, 160); };
const rows = [];
items.forEach((p, i) => {
  if (!p.target_id) return;
  const rid = (p.body && p.body.request_id) || p.request_id || '';
  const err = aligned ? errOf(spawned[i]) : '';
  if (err) {
    // client reports 2026-11-16 (INV1 F11): the stored reason is plain words for the client; the error stays on this item for the run's log
    rows.push({ json: { target_id: p.target_id, status: 'queued', request_id: '', written_at: '', at: now, error: err,
      reason: 'The page run could not be started on ' + now.slice(0, 10) + ', so the question is queued again rather than left saying "being written".', reason_code: 'run_failed', reason_args: JSON.stringify({ date: now.slice(0, 10) }) } });
    return;
  }
  // INV1 F11: no run id, no table name, no long dash in what the client reads; the run id is in request_id, where Settle and AI Growth read it
  rows.push({ json: { target_id: p.target_id, status: 'writing', request_id: rid, written_at: now, at: now,
    reason: AQ.reason('writing', { date: now }) + ' Nothing has been written yet: it counts as written once the page itself is on record.', reason_code: 'writing', reason_args: JSON.stringify({ date: now.slice(0, 10) }) } });
});
return rows.length ? rows : [{ json: { skip: true } }];
