/*__REACH__*/
const d = $('Ladder Plan').first().json;   // v4.8: the reach cache row is saved in between
const L = d.ladder || {};
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => (n == null || n === '' || isNaN(n)) ? 'N/A' : Number(n).toLocaleString('en-GB');
const SHORT = { easy: 'easy for you', reachable: 'reachable', hard: 'hard', very_hard: 'very hard' };   // v4.8: difficulty relative to the site's reach
const kdLabel = (v) => v == null ? 'N/A' : v + (L.reach != null ? ' · ' + SHORT[difficultyForYou(v, L.reach, {})] : (v < 30 ? ' · easy' : v < 50 ? ' · medium' : v < 70 ? ' · hard' : ' · very hard'));
const posText = (p) => p ? '#' + p : 'not in top 60';
const months = (m) => Array.isArray(m) ? (m[0] === m[1] ? 'month ' + m[0] : 'months ' + m[0] + '-' + m[1]) : '—';
let secNo = 0;
const h2 = (title, pageBreak) => '<h2' + (pageBreak ? ' class="pb"' : '') + '>' + (++secNo) + '. ' + esc(title) + '</h2>';
const kv = (rows) => '<table class="kv">' + rows.map(r => '<tr><td class="k">' + esc(r[0]) + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
const ul = (arr) => (arr && arr.length) ? '<ul>' + arr.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>' : '<p>None</p>';
const today = new Date().toISOString().slice(0, 10);
const f = L.feasibility || {}; const head = L.head || {}; const top = L.top || {}; const st = L.stats || {};
const rungs = (L.rungs || []).filter(r => r.pages && r.pages.length);
const allPages = rungs.flatMap(r => r.pages);
const statusLabel = { winnable: 'Winnable', stretch: 'A stretch — possible with authority building', unrealistic: 'Not realistic as the top rung' }[f.status] || esc(f.status);
// v4.8: the plan for this site (reach, difficulty for you, plan type, order); a refused ladder (duplicate / not realistic) has no pages
const planned = L.planned !== false; const ri = L.reach_info || {};
const DIFF = { easy: 'Easy for your site', reachable: 'Reachable for your site', hard: 'Hard for your site', very_hard: 'Very hard for your site', not_realistic: 'Not realistic for your site' };
const PLAN = { direct: 'Direct plan', short: 'Short ladder', full: 'Full ladder', none: 'No ladder' };
const planName = (PLAN[L.plan_type] || 'Full ladder') + (L.stretch ? ' (stretch)' : '');
const reachHow = ri.method === 'percentile' ? '75% of the ' + num(ri.sample) + ' keywords ' + esc(L.domain) + ' ranks in the top 10 for have a difficulty of ' + ri.p75 + ' or lower'
  : ri.method === 'size' ? esc(L.domain) + ' ranks in the top 10 for ' + num(ri.top10) + ' keyword' + (ri.top10 === 1 ? '' : 's') + (ri.sample ? ' (too few with a known difficulty to measure)' : '') + '; sites of that size usually win keywords up to difficulty ' + ri.size_reach
  : 'the site\'s rankings could not be read, so the starting value for a new site is used';
const reachText = 'Your site\'s reach is difficulty <b>' + esc(L.reach) + '</b>: ' + reachHow + (ri.cached ? ' (measured ' + esc(String(ri.cached_at || '').slice(0, 10)) + ', kept 30 days)' : '') + '.';
const diffWhy = L.difficulty_for_you === 'not_realistic' ? 'people searching it look for one particular website or brand, or the verdict says to avoid it'
  : (head.your_position && head.your_position <= 20) ? 'you already rank #' + head.your_position + ' for it'
  : 'its difficulty is ' + (head.kd == null ? 'unknown (counted as ' + (Number(L.reach) + 10) + ')' : head.kd) + ' against your reach of ' + esc(L.reach);
const orderText = { direct: 'Write the main page first (it is within reach now), then ' + Math.max(0, (L.stats || {}).rung_pages || 0) + ' supporting page(s) that link to it.',
  short: 'Write ' + Math.max(0, (L.stats || {}).rung_pages || 0) + ' supporting page(s) first; the main page follows once half of them are live (or it already ranks in the top 30).',
  full: 'Climb rung by rung from the easiest pages; the main page comes last, once the rungs below support it.' + (L.stretch ? ' It is very hard for your site today, so consider the alternatives first.' : ''),
  none: '' }[L.plan_type] || '';
const mainOnly = L.planned && L.plan_type !== 'direct' && !((L.stats || {}).rung_pages);   // no supporting keywords in the data: the main page is written first
const orderLine = mainOnly ? 'No supporting keywords were found in the search data for this topic, so the main page is the whole ladder for now and is written first; supporting pages can be added as the site grows.' : orderText;
const whyPlan = () => h2('Why this plan') + '<p>' + reachText + '</p><p>"' + esc(head.keyword) + '" is <b>' + esc(DIFF[L.difficulty_for_you] || L.difficulty_for_you) + '</b>: ' + diffWhy + '.</p>' +
  (planned ? '<p><b>' + esc(planName) + ' — about ' + esc(L.months) + ' months.</b> ' + esc(orderLine) + '</p>' : '<div class="note"><b>No ladder planned.</b> ' + esc((L.refusal || {}).message || '') + '</div>') +
  ((L.excluded_keywords || []).length ? '<p class="small">Left out because another ladder of this site already covers them (one search, one page): ' + L.excluded_keywords.slice(0, 12).map(x => '"' + esc(x.keyword) + '"').join(', ') + (L.excluded_keywords.length > 12 ? ' …' : '') + '.</p>' : '') +
  '<p class="small">Difficulty for your site: easy up to reach + 5 (or you already rank in the top 20), reachable up to reach + 20, hard up to reach + 40, very hard above. Easy → direct plan (2-4 months), reachable → short ladder (4-8), hard or very hard → full ladder (9-15); a little faster for strong sites.</p>';
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
  ['Destination keyword', '<b>' + esc(head.keyword) + '</b> — ' + num(head.volume) + ' searches/mo, difficulty ' + kdLabel(head.kd) + (head.cpc != null ? ', CPC ' + head.cpc : '')],
  ['Is it realistic?', '<span class="' + statusClass + '">' + statusLabel + '</span>' + (f.score != null ? ' (verdict ' + esc(f.verdict) + ', ' + f.score + '/100)' : '')],
  ...(L.stretch && (f.alternatives || []).length ? [['Consider first', f.alternatives.map(a => '"' + esc(a) + '"').join(' · ') + ' — realistic alternatives; the full ladder below is a stretch']] : []),
  ['For your site', '<b>' + esc(DIFF[L.difficulty_for_you] || '—') + '</b> · reach ' + esc(L.reach) + ' · ' + (planned ? esc(planName) + ' · about ' + esc(L.months) + ' months' : 'no ladder planned')],
  ['Where you rank today', (head.your_position ? '#' + head.your_position + ' for the destination keyword' : 'not in the top 60 for the destination keyword') + (st.site_rankings_found ? '; the site ranks for ' + num(st.site_rankings_found) + ' keywords in the top 60' : '')],
  ['The ladder', planned ? num(st.pages_total) + ' pages: ' + rungs.map(r => r.pages.length + ' on rung ' + r.rung).join(', ') + (rungs.length ? ' and' : '') + ' the main page — ' + esc(L.order || '') : 'none — ' + esc((L.refusal || {}).reason === 'duplicate' ? 'this website already has a ladder for this keyword' : 'not realistic for this site')],
  ['Timeline', (L.timeline || []).map(t => esc(t.label) + ': ' + months(t.months)).join(' · ') || '—'],
  ['Traffic potential', planned ? '~' + num(st.traffic_potential_total) + ' visits/month across the ladder once the pages rank in the top 3' : '—'],
  ['Written now', (L.write_now || []).length ? (L.write_now || []).map(w => '"' + esc(w.keyword) + '" (rung ' + w.rung + ')').join(', ') + ' — delivered separately as page content' : 'none'],
  ['Tracking', planned ? 'Positions checked ' + esc((L.tracker || {}).cadence || 'weekly') + '; progress e-mail with the next rung; once the top page holds the top 3 for 4 checks it is checked monthly' : 'nothing to track']
]) + ((L.notes || []).filter(n => !(L.refusal && n === L.refusal.message)).length ? '<div class="note">' + L.notes.filter(n => !(L.refusal && n === L.refusal.message)).map(esc).join('<br>') + '</div>' : ''));

// 2. Why this plan (v4.8)
parts.push(whyPlan());

// 3. Feasibility
parts.push(h2('Is the destination realistic?') +
  '<p>Google ranks the head term for the site with the most complete, trusted coverage of the topic. The ladder builds that coverage from the bottom: specific pages that are winnable now, linking up to one strong page for the head term.</p>' +
  '<h3>Why</h3>' + ul(f.reasons) +
  ((f.what_must_change || []).length ? '<h3>What must change first</h3>' + ul(f.what_must_change) : '') +
  ((f.alternatives || []).length ? '<div class="note"><b>Realistic alternative top rungs:</b> ' + f.alternatives.map(esc).join(' · ') + '. ' + (f.status === 'unrealistic' ? 'Brand terms of other companies are navigational and out of reach; pick one of these as the destination instead.' : 'Consider one of these if authority building stalls.') + '</div>' : '') +
  kv([['Expected visits/month at #1-3', f.expected_visits_top3 != null ? num(f.expected_visits_top3) : 'N/A'], ['Time to rank (verdict estimate)', f.time_to_rank_months != null ? f.time_to_rank_months + ' months' : 'N/A']]));

// 4. The ladder (only when pages were planned)
if (planned) {
let ladderHtml = h2('The ladder', true) + '<p class="small">One page per topic. Lower rungs are specific and winnable; each rung links up to the top page. Pages marked "improve" already exist on your site.</p>';
for (const r of rungs) {
  ladderHtml += '<h3>' + esc(r.label) + ' — ' + months(r.months) + '</h3>' +
    '<table class="ct"><tr><th>#</th><th>Page (primary keyword)</th><th>Supporting keywords</th><th>Page type</th><th>Searches/mo</th><th>Difficulty</th><th>You today</th><th>Page on site</th></tr>' +
    r.pages.map(p => '<tr><td>' + p.page_no + '</td><td><b>' + esc(p.keyword) + '</b></td><td>' + esc((p.supporting || []).join(', ') || '—') + '</td><td>' + esc(p.page_type) + '</td><td>' + num(p.total_volume) + '</td><td>' + kdLabel(p.kd) + '</td><td>' + esc(posText(p.your_position)) + '</td><td>' + (p.exists ? '<span class="ok">improve</span><br><span class="small">' + esc(p.target_url) + '</span>' : 'new<br><span class="small">' + esc(p.target_url) + '</span>') + '</td></tr>').join('') + '</table>';
}
ladderHtml += '<h3>Top — ' + esc(top.keyword) + ' — ' + months(top.months) + '</h3>' + kv([
  ['Page', (top.exists ? '<span class="ok">improve</span> ' : 'new ') + esc(top.target_url)],
  ['Page type', esc(top.page_type)], ['Supporting keywords', esc((top.supporting || []).join(', ') || '—')],
  ['Searches/mo · difficulty', num(top.volume) + ' · ' + kdLabel(top.kd)], ['You today', esc(posText(top.your_position))], ['When', L.plan_type === 'direct' || mainOnly ? 'written first — ' + months(top.months) : months(top.months)]
]);
parts.push(ladderHtml);

// 5. Internal link map
parts.push(h2('Internal link map') + '<p class="small">Every rung page links up to the top page and sideways to one sibling; the top page links down to every rung page.</p>' +
  '<table class="ct"><tr><th>From</th><th>Links to</th><th>Type</th></tr>' + (L.link_map || []).slice(0, 60).map(l => '<tr><td>' + esc(l.from) + '</td><td>' + esc(l.to) + '</td><td>' + esc(l.type) + '</td></tr>').join('') + '</table>');

// 6. Write now
parts.push(h2('Pages written now') + ((L.write_now || []).length ? '<table class="ct"><tr><th>#</th><th>Keyword</th><th>Page type</th><th>URL</th><th>Links to</th></tr>' +
  L.write_now.map(w => '<tr><td>' + w.page_no + '</td><td><b>' + esc(w.keyword) + '</b></td><td>' + esc(w.page_type) + '</td><td>' + esc(w.target_url) + (w.exists ? ' (improve)' : ' (new)') + '</td><td>' + esc((w.links_to || []).map(x => x.keyword).join(', ')) + '</td></tr>').join('') + '</table>' +
  '<p>Each page runs through the full content pipeline (competitor analysis, verified facts, brief, copywriter, critic, QA, editor) and arrives as its own PDF and Word file' + (d.email ? ' at ' + esc(d.email) : '') + '. Publish it at the URL above, then the weekly tracker measures the climb.</p>' : '<p>No pages requested now.</p>'));

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
  json: { ...slim, run_ledger, request_id: d.request_id || null, report_type: 'Keyword Ladder Plan', file_name: fileName, ladder_id: L.ladder_id, site_urls_count: (d.site_urls || []).length,
    qa_summary: 'Ladder plan: ' + num(st.pages_total) + ' pages, ' + (L.write_now || []).length + ' written now' },
  binary: { data: { data: Buffer.from('﻿' + html, 'utf8').toString('base64'), mimeType: 'application/msword', fileName, fileExtension: 'doc' } }
}];
