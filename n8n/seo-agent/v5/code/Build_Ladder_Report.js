/*__REACH__*/
/*__SERP_OBS__*/
/*__LINEAGE__*/
const d = $('Ladder Plan').first().json;   // v4.8: the reach cache row is saved in between; 2026-10-11: D26 (AI Overview as a timed observation), G3 (2025 base rate + chance band), D8 (refused brands listed)
const L = d.ladder || {};
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => (n == null || n === '' || isNaN(n)) ? 'N/A' : Number(n).toLocaleString('en-GB');
const SHORT = { easy: 'easy for you', reachable: 'reachable', hard: 'hard', very_hard: 'very hard' };   // v4.8: difficulty relative to the site's reach
const kdLabel = (v) => v == null ? 'N/A' : v + (L.reach != null ? ' · ' + SHORT[difficultyForYou(v, L.reach, {})] : (v < 30 ? ' · easy' : v < 50 ? ' · medium' : v < 70 ? ' · hard' : ' · very hard'));
const posText = (p) => p ? '#' + p : 'not in top 60';
const months = (m) => Array.isArray(m) ? (m[0] === m[1] ? 'month ' + m[0] : 'months ' + m[0] + '-' + m[1]) : '—';
// R42 (2026-10-16): a ladder run that writes a page while the site already has its limit of written-but-unpublished pages says so, in the
// owner's words, where the notes are read (the Content Cadence stops at that limit; a ladder run does not, so the pile grows by one).
// F-A1 / A-12: a plan built with the website's limits (`L.limits`) states them itself, held pages included; this note is for older plans
if (L.planned && !L.limits && (L.write_now || []).length && L.pile_up && L.pile_up.at_limit) {
  const pu = L.pile_up;
  L.notes = [...(L.notes || []), 'You have ' + pu.waiting + ' page' + (pu.waiting === 1 ? '' : 's') + ' waiting to be published (limit ' + pu.limit + '); this writes page ' + (pu.waiting + 1) + '.'
    + (pu.needs_fix ? ' ' + pu.needs_fix + ' of them did not pass the quality check and need a fix first.' : '')
    + ' Publish or discard the waiting pages before the next one is written: a pile of unpublished pages ranks nothing.'];
}
let secNo = 0;
const h2 = (title, pageBreak) => '<h2' + (pageBreak ? ' class="pb"' : '') + '>' + (++secNo) + '. ' + esc(title) + '</h2>';
const kv = (rows) => '<table class="kv">' + rows.map(r => '<tr><td class="k">' + esc(r[0]) + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
const ul = (arr) => (arr && arr.length) ? '<ul>' + arr.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>' : '<p>None</p>';
const today = new Date().toISOString().slice(0, 10);
const f = L.feasibility || {}; const head = L.head || {}; const top = L.top || {}; const st = L.stats || {};
const rungs = (L.rungs || []).filter(r => r.pages && r.pages.length);
const allPages = rungs.flatMap(r => r.pages);
const statusLabel = { winnable: 'Winnable', stretch: 'A stretch — possible with authority building', unrealistic: 'Not realistic as the top rung' }[f.status] || esc(f.status);
const dv = f.serp_diversity || L.serp_diversity || null;   // B2-5: the destination's results page, and who owns it
const scl = L.serp_clusters || null;                        // B2-4: the rung keywords' own results pages, and the groups they made
// B2-5: a score that moved says so where it is printed, with the number it moved from and the reason
const scoreAdjNote = (f.score != null && f.score_adjustment) ? '<br><span class="small">' + Math.abs(f.score_adjustment) + ' point(s) below the verdict\'s ' + f.score_before
  + ': ' + esc(((f.serp_diversity || {}).domains) || 0) + ' different site(s) own the top ' + esc(((f.serp_diversity || {}).results) || 0) + ' results. A stated rule, not a measured effect.</span>' : '';
// v4.8: the plan for this site (reach, difficulty for you, plan type, order); a refused ladder (duplicate / not realistic) has no pages
const planned = L.planned !== false; const ri = L.reach_info || {};
const DIFF = { easy: 'Easy for your site', reachable: 'Reachable for your site', hard: 'Hard for your site', very_hard: 'Very hard for your site', not_realistic: 'Not realistic for your site' };
const PLAN = { direct: 'Direct plan', short: 'Short ladder', full: 'Full ladder', none: 'No ladder' };
const planName = (PLAN[L.plan_type] || 'Full ladder') + (L.stretch ? ' (stretch)' : '');
const reachHow = ri.method === 'percentile' ? '75% of the ' + num(ri.sample) + ' keywords ' + esc(L.domain) + ' ranks in the top 10 for have a difficulty of ' + ri.p75 + ' or lower'
  : ri.method === 'size' ? esc(L.domain) + ' ranks in the top 10 for ' + num(ri.top10) + ' keyword' + (ri.top10 === 1 ? '' : 's') + (ri.sample ? ' (too few with a known difficulty to measure)' : '') + '; sites of that size usually win keywords up to difficulty ' + ri.size_reach
  : 'the site\'s rankings could not be read, so the starting value for a new site is used';
// B2-1 (2026-10-15): the site-wide reach is one number for the whole website; the plan above was measured against the reach for THIS topic
// when there was enough on-topic evidence to measure one, and `ta.note` says which of the two it was and why.
const ta = L.topic_authority || null;
const reachText = 'Your site\'s reach is difficulty <b>' + esc(ri.reach != null ? ri.reach : L.reach) + '</b>: ' + reachHow + (ri.cached ? ' (measured ' + esc(String(ri.cached_at || '').slice(0, 10)) + ', kept 30 days)' : '') + '.'
  + (ta && ta.note ? ' ' + esc(ta.note) : '');
const diffWhy = L.difficulty_for_you === 'not_realistic' ? 'people searching it look for one particular website or brand, or the verdict says to avoid it'
  : (head.your_position && head.your_position <= 20) ? 'you already rank #' + head.your_position + ' for it'
  : 'its difficulty is ' + (head.kd == null ? 'unknown (counted as ' + (Number(L.reach) + 10) + ')' : head.kd) + ' against your reach of ' + esc(L.reach);
const orderText = { direct: 'Write the main page first (it is within reach now), then ' + Math.max(0, (L.stats || {}).rung_pages || 0) + ' supporting page(s) that link to it.',
  short: 'Write ' + Math.max(0, (L.stats || {}).rung_pages || 0) + ' supporting page(s) first; the main page follows once half of them are live (or it already ranks in the top 30).',
  full: 'Climb rung by rung from the easiest pages; the main page comes last, once the rungs below support it.' + (L.stretch ? ' It is very hard for your site today, so consider the alternatives first.' : ''),
  none: '' }[L.plan_type] || '';
const mainOnly = L.planned && L.plan_type !== 'direct' && !((L.stats || {}).rung_pages);   // no supporting keywords in the data: the main page is written first
const orderLine = mainOnly ? 'No supporting keywords were found in the search data for this topic, so the main page is the whole ladder for now and is written first; supporting pages can be added as the site grows.' : orderText;
const chanceLine = planned && L.chance && L.chance.band === 'unmeasured' ? '<p><b>Estimated chance:</b> ' + esc(L.chance_text || L.chance.label) + '</p>'   // R49: no band printed when the reach rests on no measured ranking
  : planned && L.chance && L.chance.label ? '<p><b>Estimated chance</b> of reaching the top 10 within ' + esc(L.months) + ' months: <b>' + esc(L.chance.band) + '</b> (' + L.chance.range[0] + '-' + L.chance.range[1] + '%) — ' + esc(REACH_CHANCE_NOTE) + '. ' + esc(reachBaseRateText()) + '</p>' : '';
const refusedLine = (L.refused_keywords || []).length ? '<p class="small">Left out as other companies\' brands, government or portal searches, or navigational: ' + L.refused_keywords.slice(0, 12).map(x => '"' + esc(x.keyword) + '" (' + esc(x.reason) + ')').join(', ') + (L.refused_keywords.length > 12 ? ' …' : '') + '.</p>' : '';
const whyPlan = () => h2('Why this plan') + '<p>' + reachText + '</p><p>"' + esc(head.keyword) + '" is <b>' + esc(DIFF[L.difficulty_for_you] || L.difficulty_for_you) + '</b>: ' + diffWhy + '.</p>' +
  (planned ? '<p><b>' + esc(planName) + ' — about ' + esc(L.months) + ' months.</b> ' + esc(orderLine) + '</p>' + chanceLine : '<div class="note"><b>No ladder planned.</b> ' + esc((L.refusal || {}).message || '') + '</div>') +
  ((L.excluded_keywords || []).length ? '<p class="small">Left out because another ladder of this site already covers them (one search, one page): ' + L.excluded_keywords.slice(0, 12).map(x => '"' + esc(x.keyword) + '"').join(', ') + (L.excluded_keywords.length > 12 ? ' …' : '') + '.</p>' : '') + refusedLine +
  '<p class="small">Difficulty for your site: easy up to reach + 5 (or you already rank in the top 20), reachable up to reach + 20, hard up to reach + 40, very hard above. Easy → direct plan (2-4 months, estimated chance good), reachable → short ladder (4-8, fair), hard → full ladder (9-15, low), very hard → full ladder as a stretch (slim); a little faster for strong sites. The month ranges follow the 2025 Ahrefs study (' + REACH_BASE_RATE.top10_within_year_pct + '% of new pages reach the top 10 within a year; ' + REACH_BASE_RATE.of_those_within_month_pct + '% of those within a month); the chance bands are uncalibrated estimates until this system has measured its own ladders.</p>';
// D26: the results page at the time of the check — an observation, not a fact about the query
const sf = d.serp_features || null;
const serpObsLine = sf && !sf.unavailable ? '<p class="small">Results page in the check at ' + esc(obsClock(sf.checked_at || (sf.ai_overview || {}).seen_at)) + ': AI Overview ' + esc(aioObserved([{ seen: (sf.ai_overview || {}).present, at: sf.checked_at || (sf.ai_overview || {}).seen_at }]).text) + ((sf.ai_overview || {}).present && ((sf.ai_overview || {}).cited_domains || []).length ? ' In that check it cited ' + esc(sf.ai_overview.cited_domains.slice(0, 8).join(', ')) + '.' : '') + (sf.featured_snippet ? ' Featured snippet held by ' + esc(sf.featured_snippet.domain) + ' in that check.' : '') + '</p>'
  : sf && sf.unavailable ? '<p class="small">The live results page could not be read for this run (' + esc(sf.error || 'no answer') + '): whether an AI Overview or a featured snippet appears is unknown.</p>' : '';
const statusClass = f.status === 'winnable' ? 'ok' : (f.status === 'unrealistic' ? 'bad' : '');
const parts = [];

parts.push(`
<div class="cover">
  <div class="brand">Keyword Ladder Plan</div>
  <h1 class="title">${esc(head.keyword)}</h1>
  <p class="sub">${esc(L.domain)} &nbsp;•&nbsp; ${esc(L.country)} &nbsp;•&nbsp; ${today}</p>
  <p class="by">Prepared by ${esc(d.brand || 'Dev SEO')}</p>
</div>`);

// 1. Summary
parts.push(h2('The plan in one page') + kv([
  ['Destination keyword', '<b>' + esc(head.keyword) + '</b> — ' + num(head.volume) + ' searches/mo, difficulty ' + kdLabel(head.kd) + (head.cpc != null ? ', CPC ' + String(Math.round(Number(head.cpc) * 100) / 100) : '')],
  ['Is it realistic?', '<span class="' + statusClass + '">' + statusLabel + '</span>' + (f.score != null ? ' (verdict ' + esc(f.verdict) + ', ' + f.score + '/100)' : '') + scoreAdjNote],
  ...(L.stretch && (f.alternatives || []).length ? [['Consider first', f.alternatives.map(a => '"' + esc(a) + '"').join(' · ') + ' — realistic alternatives; the full ladder below is a stretch']] : []),
  ['For your site', '<b>' + esc(DIFF[L.difficulty_for_you] || '—') + '</b> · reach ' + esc(L.reach) + ' · ' + (planned ? esc(planName) + ' · about ' + esc(L.months) + ' months' : 'no ladder planned')],
  ['Where you rank today', (head.your_position ? '#' + head.your_position + ' for the destination keyword' : 'not in the top 60 for the destination keyword') + (st.site_rankings_found ? '; the site ranks for ' + num(st.site_rankings_found) + ' keywords in the top 60' : '')],
  ['The ladder', planned ? num(st.pages_total) + ' pages: ' + rungs.map(r => r.pages.length + ' on rung ' + r.rung).join(', ') + (rungs.length ? ' and' : '') + ' the main page — ' + esc(L.order || '') : 'none — ' + esc((L.refusal || {}).reason === 'duplicate' ? 'this website already has a ladder for this keyword' : 'not realistic for this site')],
  ['Timeline', (L.timeline || []).map(t => esc(t.label) + ': ' + months(t.months)).join(' · ') || '—'],
  ['Traffic potential', planned ? '~' + num(st.traffic_potential_total) + ' visits/month across the ladder once the pages rank in the top 3' : '—'],
  // R1 (2026-10-13): the plan used to call these pages written and promise them as page content before the page run had even started — and a
  // run the day's AI budget refused then left nothing behind but a ladder row saying "writing" (live: execution 500).
  // keyword-first R-K7 (2026-10-19): a Manual ladder writes nothing at start, and its pages wait for the client's OK (never "when the limit clears")
  ['Started now', (L.limits || {}).manual_hold === true ? 'none: this ladder is Manual, so each page waits for your OK (approve it on the Pipeline page or in the weekly "Coming up" plan)'
    : L.held && (L.held.pages || []).length ? 'none — held by the website\'s limits: ' + esc((L.held.why || []).map(w => w.text).join('; and ')) + '. The Content Cadence writes '
    + (L.held.pages.length === 1 ? 'it' : 'them') + ' when the limit clears.' : (L.write_now || []).length ? (L.write_now || []).map(w => '"' + esc(w.keyword) + '" (rung ' + w.rung + ')').join(', ') + ' — started as its own page run; each arrives as its own report. A run the day\'s AI budget refuses writes nothing and puts the page back to "planned" for the next weekly run.' : 'none'],
  ['Tracking', planned ? 'Positions checked ' + esc((L.tracker || {}).cadence || 'weekly') + '; progress e-mail with the next rung; once the top page holds the top 3 for 4 checks it is checked monthly' : 'nothing to track']
]) + ((L.notes || []).filter(n => !(L.refusal && n === L.refusal.message)).length ? '<div class="note">' + L.notes.filter(n => !(L.refusal && n === L.refusal.message)).map(esc).join('<br>') + '</div>' : ''));

// 2. Why this plan (v4.8)
parts.push(whyPlan());

// 3. Feasibility
parts.push(h2('Is the destination realistic?') +
  '<p>Google ranks the head term for the site with the most complete, trusted coverage of the topic. The ladder builds that coverage from the bottom: specific pages that are winnable now, linking up to one strong page for the head term.</p>' +
  '<h3>Why</h3>' + ul(f.reasons) + serpObsLine +
  ((f.what_must_change || []).length ? '<h3>What must change first</h3>' + ul(f.what_must_change) : '') +
  ((f.alternatives || []).length ? '<div class="note"><b>Realistic alternative top rungs:</b> ' + f.alternatives.map(esc).join(' · ') + '. ' + (f.status === 'unrealistic' ? 'Brand terms of other companies are navigational and out of reach; pick one of these as the destination instead.' : 'Consider one of these if authority building stalls.') + '</div>' : '') +
  kv([['Expected visits/month at #1-3', f.expected_visits_top3 != null ? num(f.expected_visits_top3) : 'N/A'], ['Time to rank (verdict estimate)', f.time_to_rank_months != null ? f.time_to_rank_months + ' months' : 'N/A'],
    // B2-5 (2026-10-15): domain diversity is Semrush's fifth ranking factor and it now moves this score - the count is measured, the
    // adjustment is a stated rule, and both are printed here so nobody has to take the number on trust.
    ...(dv ? [['Who owns the results page', (dv.checked ? '<b>' + num(dv.domains) + ' different site(s)</b> in the top ' + num(dv.results) + ' — ' + esc(dv.band) : 'not known: the results page could not be read')
      + '<br><span class="small">' + esc(dv.text) + '</span><br><span class="small">' + esc(dv.basis) + '</span>']] : [])]));

// B2-2 (2026-10-15, benchmark area 2): what the site already has on this topic, before the plan's new pages — the inventory the leaders
// open a content plan with (MarketMuse site inventory; its effort bands start at "optimise the page you have if it matches the topic").
const cov = ta && ta.coverage ? ta.coverage : null;
if (cov) {
  const covPages = (cov.pages || []).length
    ? '<table class="ct"><tr><th>Page you already have on this topic</th><th>Title</th></tr>'
      + cov.pages.map(p => '<tr><td>' + esc(p.url) + '</td><td>' + esc(p.title || '—') + '</td></tr>').join('') + '</table>'
    : '';
  parts.push(h2('What you already have on this topic') + '<p>' + esc(cov.summary) + '</p>' +
    kv([['Pages on this topic', num(cov.pages_on_site)],
      ['Searches you rank for on this topic', num(cov.ranked_keywords) + ' (' + num(cov.top10_keywords) + ' in the top 10)'],
      ['Best position today', cov.best_position ? '#' + cov.best_position + ' for "' + esc(cov.best_keyword) + '"' : 'nothing on this topic ranks yet'],
      ['This plan', num(cov.planned_total) + ' page(s): ' + num(cov.planned_improve) + ' improved, ' + num(cov.planned_new) + ' new']]) + covPages);
}

// B2-4 (2026-10-15, benchmark area 2, criterion K7): the searches Google answers with the SAME pages, and the ones that could not be
// compared. The convention is Keyword Insights' own: the top 7 results at a 40% shared-URL threshold (B2-6).
if (scl && scl.asked) {
  const clRows = (scl.clusters || []).slice(0, 12).map(c => '<tr><td><b>' + esc(c.head_keyword) + '</b></td><td>' + c.keyword_count + '</td><td>'
    + esc((c.keywords || []).slice(1).map(k => '"' + k.keyword + '" (' + k.shared_urls + ' shared)').join(', ') || '—') + '</td></tr>').join('');
  const ncRows = (scl.not_compared || []).slice(0, 10).map(x => '<li>"' + esc(x.keyword) + '" — ' + esc(x.reason) + (x.retried ? ' (asked twice)' : '') + '</li>').join('');
  parts.push(h2('Searches that share a results page') +
    '<p class="small">' + esc(scl.note) + '</p>' +
    (clRows ? '<table class="ct"><tr><th>One page for</th><th>Searches</th><th>Also covers</th></tr>' + clRows + '</table>' : '') +
    kv([['Results pages read', num(scl.compared) + ' of ' + num(scl.asked) + ' asked' + (scl.retried ? ' (' + num(scl.retried) + ' sent again, ' + num(scl.retry_answered) + ' answered)' : '')],
      ['How they were compared', 'the top ' + num(scl.top_n) + ' results, ' + num(scl.min_shared_urls) + ' shared URLs (' + num(scl.min_overlap_pct) + '%)'],
      ['What it cost', '$' + Number(scl.cost_usd || 0).toFixed(4) + '<br><span class="small">' + esc(scl.cost_basis) + '</span>']]) +
    (ncRows ? '<p class="small"><b>Could not be compared</b> — these keep their own group and nothing was merged on their behalf:</p><ul class="small">' + ncRows + '</ul>' : '') +
    (scl.left_uncompared ? '<p class="small">' + num(scl.left_uncompared) + ' further keyword(s) on this topic were below the cap of ' + num(scl.cap) + ' and were not compared.</p>' : ''));
} else if (scl && scl.skip_reason) {
  parts.push(h2('Searches that share a results page') + '<p>' + esc(scl.note || scl.skip_reason) + '</p>');
}
// KW-COMP (2026-10-21, RV-6): who this ladder competes with, read from the same results pages, with the sites that rank but compete with nobody
const cmpL = scl && scl.competitors;
if (cmpL && ((cmpL.picked || []).length || (cmpL.excluded || []).length)) {
  parts.push(h2('Who you compete with on this ladder') +
    ((cmpL.picked || []).length ? '<ul>' + cmpL.picked.map(c => '<li><b>' + esc(c.domain) + '</b>: ' + esc(c.evidence) + '</li>').join('') + '</ul>' : '<p>No business ranked often enough on these results pages to count as a competitor.</p>') +
    '<p class="small">' + esc(cmpL.note) + '</p>');
}

// 4. The ladder (only when pages were planned)
if (planned) {
let ladderHtml = h2('The ladder', true) + '<p class="small">One page per topic. Lower rungs are specific and winnable; each rung links up to the top page. Pages marked "improve" already exist on your site. "Why here" is the data that put the page in this position (B2-3).</p>';
for (const r of rungs) {
  ladderHtml += '<h3>' + esc(r.label) + ' — ' + months(r.months) + '</h3>' +
    '<table class="ct"><tr><th>#</th><th>Page (primary keyword)</th><th>Supporting keywords</th><th>Grouped by</th><th>Page type</th><th>Searches/mo</th><th>Difficulty</th><th>You today</th><th>Page on site</th></tr>' +
    r.pages.map(p => '<tr><td>' + p.page_no + '</td><td><b>' + esc(p.keyword) + '</b>' + (p.why ? '<br><span class="small">' + esc(p.why) + '</span>' : '') + '</td><td>' + esc((p.supporting || []).join(', ') || '—') + '</td><td>' + esc(p.grouped_by || 'topic label') + '</td><td>' + esc(p.page_type) + '</td><td>' + num(p.total_volume) + '</td><td>' + kdLabel(p.kd) + '</td><td>' + esc(posText(p.your_position)) + '</td><td>' + (p.exists ? '<span class="ok">improve</span><br><span class="small">' + esc(p.target_url) + '</span>' : 'new<br><span class="small">' + esc(p.target_url) + '</span>') + '</td></tr>').join('') + '</table>';
}
ladderHtml += '<h3>Top — ' + esc(top.keyword) + ' — ' + months(top.months) + '</h3>' + kv([
  ['Page', (top.exists ? '<span class="ok">improve</span> ' : 'new ') + esc(top.target_url)],
  ['Page type', esc(top.page_type)], ['Supporting keywords', esc((top.supporting || []).join(', ') || '—') + (top.grouped_by ? '<br><span class="small">Grouped by ' + esc(top.grouped_by) + '</span>' : '')],   // A-10
  ['Searches/mo · difficulty', num(top.volume) + ' · ' + kdLabel(top.kd)], ['You today', esc(posText(top.your_position))], ['When', L.plan_type === 'direct' || mainOnly ? 'written first — ' + months(top.months) : months(top.months)],
  ...(top.why ? [['Why here', esc(top.why)]] : [])   // B2-3
]);
parts.push(ladderHtml);

// G32 / K12 (2026-10-13, FIX_PLAN): the site's topic radius — the topics of this ladder that are within reach today, the ones that are a
// stretch and the ones that are out of reach for now, each with the evidence behind the verdict (v5/code/_radius.js, built in Ladder Plan).
// It is shown, not enforced: the plan above is unchanged by it.
const radL = L.topic_radius || null;
const radRowsL = radL ? [...(radL.in_reach || []), ...(radL.stretch || []), ...(radL.far || [])] : [];
if (radRowsL.length) parts.push(h2('Your topic radius: what is within reach and what is a stretch') + '<p class="small">' + esc(radL.summary) + '</p>'
  + '<table class="ct"><tr><th>Topic</th><th>Verdict</th><th>Why</th><th>On what evidence</th></tr>'
  + radRowsL.slice(0, 20).map(t => '<tr><td><b>' + esc(t.topic) + '</b><br>' + esc(t.primary_keyword) + '</td><td>' + esc(t.verdict_label) + '</td><td>' + esc(t.reason) + '</td><td>' + esc((t.evidence || []).join('; ')) + '</td></tr>').join('')
  + '</table><p class="small">' + esc(radL.note) + '</p>');

// 5. Internal link map
parts.push(h2('Internal link map') + '<p class="small">Every rung page links up to the top page and sideways to one sibling; the top page links down to every rung page.</p>' +
  '<table class="ct"><tr><th>From</th><th>Links to</th><th>Type</th></tr>' + (L.link_map || []).slice(0, 60).map(l => '<tr><td>' + esc(l.from) + '</td><td>' + esc(l.to) + '</td><td>' + esc(l.type) + '</td></tr>').join('') + '</table>');

// 6. Write now
parts.push(h2('Pages written now') + ((L.write_now || []).length ? '<table class="ct"><tr><th>#</th><th>Keyword</th><th>Page type</th><th>URL</th><th>Links to</th></tr>' +
  L.write_now.map(w => '<tr><td>' + w.page_no + '</td><td><b>' + esc(w.keyword) + '</b></td><td>' + esc(w.page_type) + '</td><td>' + esc(w.target_url) + (w.exists ? ' (improve)' : ' (new)') + '</td><td>' + esc((w.links_to || []).map(x => x.keyword).join(', ')) + '</td></tr>').join('') + '</table>' +
  '<p>Each page runs through the full content pipeline (competitor analysis, verified facts, brief, copywriter, critic, QA, editor) and arrives as its own PDF and Word file' + (d.email ? ' at ' + esc(d.email) : '') + '. Publish it at the URL above, then the weekly tracker measures the climb.</p>' : (L.held && (L.held.pages || []).length ? '<p><b>Held, not written:</b> ' + L.held.pages.map(w => '"' + esc(w.keyword) + '"').join(', ') + ' — ' + esc((L.held.why || []).map(w => w.text).join('; and ')) + '.</p><p class="small">' + esc((L.limits || {}).text || '') + '</p>' : '<p>No pages requested now.</p>')));

// 7. Requirements
parts.push(h2('What else is needed') + '<table class="ct"><tr><th>Item</th><th>Detail</th></tr>' + (L.requirements || []).map(r => '<tr><td><b>' + esc(r.item) + '</b></td><td>' + esc(r.detail) + '</td></tr>').join('') + '</table>');

// 8. Tracking
parts.push(h2('Tracking and next rungs') + '<p>The ladder is registered for ' + esc((L.tracker || {}).cadence || 'weekly') + ' position checks (Google top 100 for every page\'s primary keyword). The progress e-mail shows position changes, which rungs are in the top 10 / top 3, and the recommendation for the next rung with a ready-to-send request. ' +
  ((L.tracker || {}).auto_next_rung ? 'The next rung\'s pages are generated automatically.' : 'Pages for the next rung are written when you confirm (recommend-only mode).') + ' Once the top page has held the top 3 for 4 checks, the main keyword and the published pages are checked monthly, so a drop is noticed.</p>');
}

// 9. Later
if ((L.later || []).length) parts.push(h2(planned ? 'Keywords for later (difficulty above ' + (Number(L.reach) + 30) + ', or beyond this plan\'s pages)' : 'Keywords found around the main keyword') + '<table class="ct"><tr><th>Keyword</th><th>Searches/mo</th><th>Difficulty</th></tr>' + L.later.map(k => '<tr><td>' + esc(k.keyword) + '</td><td>' + num(k.volume) + '</td><td>' + kdLabel(k.kd) + '</td></tr>').join('') + '</table>');

// 10. Method
parts.push(h2('How this was built') + '<p class="small">' + num(st.pool_size) + ' keywords were pulled around the head term (long-tail suggestions, related searches, keyword ideas for the head term and your services, and the keywords your site already ranks for). ' + num(st.ai_reviewed) + ' were screened by AI for topical relevance to the head term; ' + num(st.relevant) + ' survived. Rungs follow difficulty relative to your reach (' + esc(L.reach) + '): rung 1 up to the reach (long-tail, 20+ searches), rung 2 up to reach + 15, rung 3 up to reach + 30, the head term on top; keywords other ladders of this site already cover are left out. One page per topic cluster, 2-4 pages per rung; a direct plan keeps 2-3 supporting pages, a short ladder 3-5. Traffic potential = searches after SERP-feature click loss × a top-3 click share. Positions and metrics from DataForSEO for ' + esc(L.country) + '.' + ((st.research_failures || []).length ? ' Some data pulls failed: ' + esc(st.research_failures.join('; ')) + '.' : '') + '</p>');

// G29 (2026-10-13, FIX_PLAN): the same plan with every figure's source, period and sample, as a table and as structured fields
const lineage = [
  LN.of('Searches per month and difficulty', 'kwdata', { basis: 'estimated', period: 'the provider\'s latest 12-month average', sample: LN.sample(st.pool_size, 'keywords pulled'),
    note: 'a provider estimate for ' + String(L.country || '') + ', not a measurement of your site; a single keyword\'s volume can be well off' }),
  LN.of('Traffic potential per page', 'model', { basis: 'modelled', period: 'per month, once the page ranks', sample: LN.sample((L.rungs || []).length, 'rungs planned'),
    note: 'searches after results-page click loss × a top-3 click share — modelled, never measured clicks' }),
  LN.of('Difficulty for your site and the plan type', 'model', { basis: 'modelled', period: LN.asOf(today), sample: 'your site\'s reach ' + String(L.reach == null ? 'unknown' : L.reach),
    note: 'your reach against each keyword\'s difficulty; the month ranges and chances are modelled from published base rates, not from your own history yet' }),
  LN.of('Who ranks now and which results-page features show', 'serp', { basis: 'one_sample', period: LN.asOf(today), sample: LN.sample((d.live_checks && d.live_checks.done) || (L.rungs || []).length, 'keywords checked live on Google'),
    note: 'one results page per keyword at one moment, from ' + String(L.country || 'the chosen country') }),
];
parts.push(h2('Where these numbers come from') + '<table class="ct"><tr><th>Figure</th><th>Source</th><th>Period</th><th>Sample</th><th>How it was arrived at</th></tr>'
  + lineage.map(l => '<tr><td>' + esc(l.figure) + '</td><td>' + esc(l.source_label) + '</td><td>' + esc(l.period || '—') + '</td><td>' + esc(l.sample || '—') + '</td><td>' + esc([l.basis_label, l.note].filter(Boolean).join(' — ')) + '</td></tr>').join('')
  + '</table><p class="small">A figure marked "modelled, not measured" is computed, not counted.</p>');

const css = `
@page { margin: 0.9in; }
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; }
.cover { background: #0F172A; color: #fff; padding: 28px 30px; margin-bottom: 24px; }
.brand { font-size: 10pt; letter-spacing: 2px; text-transform: uppercase; color: #93C5FD; }
.title { font-size: 26pt; margin: 6px 0; color: #fff; border: none; }
.sub { color: #CBD5E1; margin: 0; }
.by { color: #93C5FD; margin: 10px 0 0; font-size: 10pt; }
h2 { color: #1E3A8A; font-size: 15pt; margin-top: 26px; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px; }
h3 { color: #334155; font-size: 12.5pt; margin-top: 16px; }
p { margin: 0 0 9px; }
.kv { width: 100%; border-collapse: collapse; margin: 10px 0 16px; }
.kv td { padding: 7px 10px; border: 1px solid #E2E8F0; font-size: 10pt; vertical-align: top; }
.kv .k { width: 190px; font-weight: bold; background: #EEF2FF; color: #0F172A; }
.ct { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 9.5pt; }
.ct th { background: #1E3A8A; color: #fff; padding: 6px; text-align: left; border: 1px solid #1E3A8A; }
.ct td { padding: 6px; border: 1px solid #CBD5E1; vertical-align: top; }
.note { border-left: 4px solid #D97706; background: #FFFBEB; padding: 10px 14px; margin: 12px 0; }
.ok { color: #15803D; font-weight: bold; }
.bad { color: #B91C1C; font-weight: bold; }
.small { font-size: 9pt; color: #64748B; }
.pb { page-break-before: always; }`;
const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(head.keyword)} — Keyword Ladder Plan</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>${css}</style></head>
<body>${parts.join('\n')}</body></html>`;
const safe = String(head.keyword || 'keyword').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fileName = 'keyword-ladder-' + safe + '-' + today + '.doc';
// drop the large intermediate fields; keep what delivery, the store rows and the page runs need
const slim = { ...d, site_text: undefined, client_pages: undefined, existing_page_text: undefined, competitor_digest: undefined, term_digest: undefined, term_model: undefined,
  competitors_summary: undefined, competitor_questions: undefined, stats_seen: undefined, facts: undefined, extra_questions: undefined, serp_digest: undefined,
  site_urls: undefined, internal_link_candidates: undefined, research: undefined, competitor_analysis: undefined, serp_features: undefined, result_html: undefined, reach_cache_row: undefined };
return [{
  json: { ...slim, run_ledger, lineage, request_id: d.request_id || null, report_type: 'Keyword Ladder Plan', file_name: fileName, ladder_id: L.ladder_id, site_urls_count: (d.site_urls || []).length,
    qa_summary: 'Ladder plan: ' + num(st.pages_total) + ' pages, ' + (L.write_now || []).length + ' written now' },
  binary: { data: { data: Buffer.from('﻿' + html, 'utf8').toString('base64'), mimeType: 'application/msword', fileName, fileExtension: 'doc' } }
}];
