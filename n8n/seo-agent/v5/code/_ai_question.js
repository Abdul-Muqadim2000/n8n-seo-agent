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
  return { FORM_TYPES, pageType, keywordOf, done, DONE, reason, clean, CODES, pathOf };
})();
