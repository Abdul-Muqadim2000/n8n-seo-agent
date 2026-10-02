
// ---- run ledger: DataForSEO spend, AI calls, duration (internal; appears on the final item and in the API callback) ----
const __LEDGER_NODES = ['SERP Top 10', 'Keyword Data', 'Candidate SERP', 'Discover Ideas', 'Start Crawl', 'Get Crawl Summary', 'Get Crawled Pages', 'Run Crawl Extras', 'Find Competitors', 'Fallback SERP', 'Domain Overview', 'DataForSEO Whois', 'Ranked Keywords', 'Keyword Ideas', 'Backlink Summary', 'Backlink Gap', 'AI SERP', 'Ask LLMs', 'Facts SERP', 'Site Authority', 'Run Research', 'Run Competitor Keywords', 'AI Demand'];
const __AI_NODES = ['Site Describer', 'Keyword Seeds', 'Competitor Analyzer', 'Verdict Agent', 'Strategy Brief', 'Copywriter', 'Editor', 'Content Reviewer'];
const run_ledger = { dataforseo_usd: 0, dataforseo_calls: 0, by_node: {}, ai_calls: 0, ai_nodes: [], started_at: null, finished_at: new Date().toISOString(), duration_min: null };
for (const n of __LEDGER_NODES) {
  let items = []; try { items = $(n).all(); } catch (e) { continue; }
  for (const it of items) {
    const j = (it && it.json) || {}; let c = 0;
    if (Array.isArray(j.tasks)) { for (const t of j.tasks) c += Number((t && t.cost) || 0); } else if (j.cost) { c += Number(j.cost) || 0; }
    run_ledger.dataforseo_calls++;
    if (c) { run_ledger.dataforseo_usd += c; run_ledger.by_node[n] = +((run_ledger.by_node[n] || 0) + c).toFixed(4); }
  }
}
for (const n of __AI_NODES) { try { const k = $(n).all().length; if (k) { run_ledger.ai_calls += k; run_ledger.ai_nodes.push(n); } } catch (e) {} }
try { run_ledger.started_at = $('Normalize Input').first().json.started_at || null; } catch (e) {}
if (run_ledger.started_at) run_ledger.duration_min = +(((Date.now() - new Date(run_ledger.started_at)) / 60000).toFixed(1));
run_ledger.dataforseo_usd = +run_ledger.dataforseo_usd.toFixed(4);
const d = $input.first().json;
const md = String(d.output || '');
const kd = d.keyword_data || {};
const ca = d.competitor_analysis || {};
const qa = d.content_qa || {};
const brief = d.content_brief || {};

const wantSeo = d.include_seo_report !== false;
const wantContent = !!d.include_content && md.length > 0;
const wantAudit = !!d.include_audit;
const wantVerdict = !!d.verdict;

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => (n == null || n === '' ? 'N/A' : Number(n).toLocaleString('en-GB'));

let secNo = 0;
const h2 = (title, pageBreak) => '<h2' + (pageBreak ? ' class="pb"' : '') + '>' + (++secNo) + '. ' + esc(title) + '</h2>';

// Schema comes from the QA step (deterministic, page-type aware)
const scriptRe = new RegExp('<' + 'script type="application/ld\\+json">([\\s\\S]*?)<' + '/script>', 'gi');
const schemaBlocks = Array.isArray(d.schema_blocks) ? d.schema_blocks : [];
let content = md.replace(scriptRe, '').trim();
const sf = d.serp_features || null;

// Meta lines alag karo
const metaRe = /^(Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):\s*(.+)$/gim;
const meta = [];
let m;
while ((m = metaRe.exec(content)) !== null) meta.push({ label: m[1], value: m[2] });
content = content.replace(metaRe, '').trim();

function inline(s) {
  let t = esc(s);
  t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  t = t.replace(/\[([^\[\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\[([^\[\]]+)\](?!\()/g, '<span class="ph">[$1]</span>');
  return t;
}

function mdToHtml(text) {
  const out = [];
  let list = null, table = null;
  const closeList = () => { if (list) { out.push('</' + list + '>'); list = null; } };
  const closeTable = () => { if (table) { out.push('</table>'); table = null; } };
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (l.startsWith('|')) {
      closeList();
      if (/^\|[\s:|-]+\|$/.test(l)) continue;
      const cells = l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (!table) { out.push('<table class="ct">'); table = 'open';
        out.push('<tr>' + cells.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr>'); }
      else out.push('<tr>' + cells.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>');
      continue;
    }
    closeTable();
    if (!l) { closeList(); continue; }
    let x;
    if ((x = l.match(/^(#{1,4})\s+(.+)$/))) { closeList(); const h = x[1].length; out.push('<h' + h + '>' + inline(x[2]) + '</h' + h + '>'); continue; }
    if ((x = l.match(/^>\s*(.+)$/))) { closeList(); out.push('<div class="callout">' + inline(x[1].replace(/^Note:\s*/i, '')) + '</div>'); continue; }
    if ((x = l.match(/^Q\d+:\s*(.+)$/))) { closeList(); out.push('<p class="fq">' + inline(x[1]) + '</p>'); continue; }
    if ((x = l.match(/^A\d+:\s*(.+)$/))) { closeList(); out.push('<p class="fa">' + inline(x[1]) + '</p>'); continue; }
    if ((x = l.match(/^[-*]\s+(.+)$/))) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(x[1]) + '</li>'); continue; }
    if ((x = l.match(/^\d+\.\s+(.+)$/))) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(x[1]) + '</li>'); continue; }
    closeList();
    out.push('<p>' + inline(l) + '</p>');
  }
  closeList(); closeTable();
  return out.join('\n');
}

const kv = (rows) => '<table class="kv">' + rows.map(r =>
  '<tr><td class="k">' + esc(r[0]) + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
const ul = (arr) => (arr && arr.length) ? '<ul>' + arr.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>' : '<p>None</p>';

const today = new Date().toISOString().slice(0, 10);
const parts = [];

// ===== COVER =====
const reportType = [wantSeo ? 'SEO Report' : '', wantContent ? 'Page Content' : '', wantAudit ? 'Site Audit' : '',
  (wantVerdict && !wantSeo && !wantContent && !wantAudit) ? 'Keyword Verdict' : '']
  .filter(Boolean).join(' + ');
parts.push(`
<div class="cover">
  <div class="brand">${esc(reportType)}</div>
  <h1 class="title">${esc(d.keyword)}</h1>
  <p class="sub">${esc(d.page_type)} &nbsp;•&nbsp; ${esc(d.country)}${d.domain ? ' &nbsp;•&nbsp; ' + esc(d.domain) : ''} &nbsp;•&nbsp; ${today}</p>
  <p class="by">Prepared by ${esc(d.brand || 'Dev SEO')}</p>
</div>`);

// ===== KEYWORD VERDICT =====
if (wantVerdict) {
  const verdictLabel = { GO: 'GO — Target This Keyword', GO_WITH_CHANGES: 'GO, WITH CHANGES', AVOID: 'AVOID' }[d.verdict] || esc(d.verdict);
  const verdictClass = d.verdict === 'GO' ? 'ok' : (d.verdict === 'AVOID' ? 'bad' : '');
  parts.push(h2('Keyword Verdict') + kv([
    ['Verdict', '<span class="' + verdictClass + '">' + esc(verdictLabel) + '</span>'],
    ['Score', d.verdict_score != null ? d.verdict_score + '/100' : 'N/A'],
    ['Recommended Page Type', esc(d.recommended_page || d.page_type || 'N/A')],
    ['Expected visits/month at #1-3', d.expected_visits_top3 != null ? num(d.expected_visits_top3) : 'N/A'],
    ['Time to rank', d.time_to_rank_months != null ? d.time_to_rank_months + ' months' : 'N/A']
  ]) +
  '<h3>Why</h3>' + ul(d.verdict_reasons) +
  ((d.verdict_changes && d.verdict_changes.length) ? '<h3>What must change first</h3>' + ul(d.verdict_changes) : '') +
  ((d.verdict_risks && d.verdict_risks.length) ? '<h3>Risks / Watch-outs</h3>' + ul(d.verdict_risks) : '') +
  ((d.secondary_keywords && d.secondary_keywords.length) ? '<h3>Secondary Keywords Worth Targeting</h3>' + ul(d.secondary_keywords) : ''));
}

// ===== SEO REPORT =====
if (wantSeo) {
  const trend = kd.trend_yearly_pct;
  const trendTxt = trend == null ? 'N/A' : (trend > 0 ? '+' : '') + trend + '% (last 12 months)';
  const bl = kd.competitor_backlink_strength || {};

  parts.push(h2('Keyword Overview') + kv([
    ['Monthly Searches', num(kd.search_volume)],
    ['Keyword Difficulty', (kd.keyword_difficulty == null ? 'N/A' : kd.keyword_difficulty + '/100') + ' — ' + esc(kd.difficulty_label || '')],
    ['Cost Per Click', kd.cpc == null ? 'N/A' : esc(d.currency) + ' ' + kd.cpc],
    ['Ads Competition', esc(kd.ads_competition || 'N/A')],
    ['Search Intent', esc(ca.search_intent || kd.google_intent || 'N/A')],
    ['Search Trend', esc(trendTxt)],
    ['Competitor Link Strength', 'Avg ' + num(bl.avg_referring_domains) + ' referring domains, ' + num(bl.avg_backlinks) + ' backlinks']
  ]));

  if (d.existing_page && d.existing_page.url) {
    parts.push('<div class="note"><b>Existing page found:</b> ' + esc(d.existing_page.url) + (d.existing_page.source === 'sitemap' ? ' (matched from the sitemap)' : '') + '. The content below is written to improve that page rather than create a duplicate.</div>');
  }
  if (sf) {
    const aio = sf.ai_overview || {};
    parts.push(h2('What the Results Page Looks Like') + kv([
      ['Featured snippet', sf.featured_snippet ? esc(sf.featured_snippet.domain) + ' — "' + esc(String(sf.featured_snippet.text).slice(0, 160)) + '"' : 'None'],
      ['AI Overview', aio.present ? 'Shown — cites ' + esc((aio.cited_domains || []).join(', ') || 'unknown sources') : 'Not shown for this query'],
      ['People Also Ask', (sf.people_also_ask || []).length ? esc(sf.people_also_ask.slice(0, 8).join(' • ')) : 'None'],
      ['Related searches', (sf.related_searches || []).length ? esc(sf.related_searches.slice(0, 8).join(' • ')) : 'None'],
      ['Other features', esc((sf.features_present || []).join(', ') || 'none')],
      ['Results for this query', num(sf.se_results_count)]
    ]) + ((ca.serp_feature_strategy) ? '<div class="callout"><b>How to win the features:</b> ' + esc(ca.serp_feature_strategy) + '</div>' : ''));
  }

  const kt = d.keyword_types;
  if (kt) {
    const groups = [
      ['Informational', 'People looking for information or answers', kt.informational],
      ['Navigational', 'People looking for a specific brand or website', kt.navigational],
      ['Commercial', 'People comparing options before buying', kt.commercial],
      ['Transactional', 'People ready to buy, book or order', kt.transactional]
    ];
    let html = h2('Keyword Research by Search Intent');
    for (const g of groups) {
      const rows = (g[2] || []).map(k =>
        `<tr><td>${esc(k.keyword)}</td><td>${num(k.search_volume)}</td><td>${k.keyword_difficulty == null ? 'N/A' : k.keyword_difficulty}</td><td>${k.cpc == null ? 'N/A' : k.cpc}</td></tr>`).join('');
      html += `<h3>${g[0]} Keywords</h3><p class="small">${g[1]}</p>`;
      html += rows
        ? `<table class="ct"><tr><th>Keyword</th><th>Monthly Searches</th><th>Difficulty</th><th>CPC</th></tr>${rows}</table>`
        : '<p>No keywords found for this intent.</p>';
    }
    parts.push(html);
  }

  const compRows = (d.competitors_summary || []).map(c =>
    `<tr><td>#${esc(c.rank)}</td><td>${esc(c.domain)}</td><td>${esc(c.title)}</td><td>${num(c.word_count)}</td></tr>`).join('');
  const strengths = (ca.competitor_strengths || []).map(s => `<li><b>${esc(s.domain)}:</b> ${esc(s.strength)}</li>`).join('');
  const weaknesses = (ca.competitor_weaknesses || []).map(s => `<li><b>${esc(s.domain)}:</b> ${esc(s.weakness)}</li>`).join('');
  parts.push(h2('Competitor Content Analysis') + `
<p>${esc(ca.intent_explanation || '')}</p>
<h3>Top Ranking Pages</h3>
<table class="ct"><tr><th>Rank</th><th>Domain</th><th>Page Title</th><th>Words</th></tr>${compRows}</table>
<h3>What Competitors Do Well</h3><ul>${strengths || '<li>N/A</li>'}</ul>
<h3>Where Competitors Are Weak</h3><ul>${weaknesses || '<li>N/A</li>'}</ul>
<h3>Content Gaps to Fill</h3>${ul(ca.content_gaps)}
<div class="callout"><b>Recommended Unique Angle:</b> ${esc(brief.unique_angle || ca.unique_angle || '')}</div>
<div class="note"><b>Ranking Feasibility:</b> ${esc(ca.feasibility_note || '')}</div>`);
}

// ===== PAGE CONTENT =====
if (wantContent) {
  parts.push(h2('Content Quality Check', true) + kv([
    ['Status', qa.passed ? '<span class="ok">Passed</span>' : '<span class="bad">Needs review</span>'],
    ['Main Content Words', num(qa.main_content_words) + ' (target ' + num(qa.target_word_count) + ')'],
    ['FAQ Words', num(qa.faq_words)],
    ['Keyword Mentions', num(qa.keyword_mentions) + ' (density ' + (qa.keyword_density_pct == null ? 'N/A' : qa.keyword_density_pct) + '%)'],
    ['Sections (H2)', num(qa.h2_count)],
    ['FAQs', num(qa.faq_count)],
    ['Meta title / description length', num(qa.meta_title_length) + ' / ' + num(qa.meta_description_length) + ' characters'],
    ['Internal links to existing pages', num(qa.internal_links)],
    ['Quick answer block', qa.answer_block_words ? qa.answer_block_words + ' words' : 'Missing'],
    ['Editing rounds', num(qa.round || d.qa_round || 1)],
    ['Schema generated', esc((qa.schema_types || []).join(', ') || 'None')],
    ['Content score', qa.content_score != null ? '<b>' + qa.content_score + '/100</b>' + (qa.score_breakdown ? ' (structure ' + qa.score_breakdown.structure + '/25, topic coverage ' + qa.score_breakdown.coverage + '/25, readability ' + qa.score_breakdown.readability + '/15, specificity ' + qa.score_breakdown.specificity + '/10, clean language ' + qa.score_breakdown.clean_language + '/10, length ' + qa.score_breakdown.length + '/15)' : '') : 'N/A'],
    ['Topic coverage', qa.coverage_pct != null ? qa.coverage_pct + '% of the terms top-ranking pages share' : 'N/A'],
    ['Readability', qa.readability ? 'Flesch ' + qa.readability.flesch + ' · ' + qa.readability.avg_sentence_words + ' words per sentence · passive voice ' + qa.readability.passive_pct + '%' : 'N/A'],
    ['Filler phrases left', (qa.banned_phrases || []).length ? esc(qa.banned_phrases.map(b => b.phrase).slice(0, 6).join(', ')) : 'none'],
    ['Editorial review', qa.critic_score != null ? qa.critic_score + '/100 — ' + esc(qa.critic_verdict || '') : 'N/A']
  ]) + ((qa.warnings && qa.warnings.length) ? '<h3>Warnings (please review before publishing)</h3>' + ul(qa.warnings) : '') +
  ((qa.auto_fixes && qa.auto_fixes.length) ? '<h3>Automatic fixes applied</h3>' + ul(qa.auto_fixes) : '') +
  '<p class="small">Text in <span class="ph">[square brackets]</span> must be replaced with your real business details before publishing.</p>');

  parts.push(h2('Page Content', true) +
    '<h3>SEO Meta Tags</h3>' + (meta.length ? kv(meta.map(x => [x.label, esc(x.value)])) : '') +
    '<div class="content">' + mdToHtml(content) + '</div>');

  const links = (brief.internal_link_suggestions || []).filter(l => l && l.url && content.includes('(' + String(l.url).trim() + ')'));
  if (links.length) {
    parts.push(h2('Internal Links Used') + '<table class="ct"><tr><th>Anchor text</th><th>Links to (existing page)</th></tr>' +
      links.map(l => '<tr><td>' + esc(l.anchor) + '</td><td>' + esc(l.url) + '</td></tr>').join('') + '</table>');
  }
  const imgs = (brief.image_suggestions || []).filter(i => i && i.alt_text);
  if (imgs.length) {
    parts.push(h2('Image Plan') + '<p>Three images per page: a hero (also the featured and Open Graph image, 1200×630 for sharing) and two in-body visuals. Save them as WebP under the suggested file names and keep the alt text.</p><table class="ct"><tr><th>Placement</th><th>Purpose</th><th>What it shows</th><th>Alt text</th><th>File name</th></tr>' +
      imgs.map(i => '<tr><td>' + esc(i.placement) + '</td><td>' + esc(i.purpose || '') + '</td><td>' + esc(i.subject || '') + (i.caption ? '<br><i>' + esc(i.caption) + '</i>' : '') + '</td><td>' + esc(i.alt_text) + '</td><td>' + esc(i.filename || '') + '</td></tr>').join('') + '</table>');
  }
  // ---- v4.4: author, trust and page extras ----
  const au = d.author || null, rv = d.reviewer || null, role = d.page_role || 'standard', vid = d.video || null, hp = d.hub_pages || [];
  const extraRows = [['Page role', esc({ hub: 'Hub / pillar page (table of contents, cluster summaries, "Guides in this series")', case_study: 'Case study (snapshot box, facts from the intake only)', local: 'Local page for ' + (d.local_area || '[City]') + ' (verified NAP block, LocalBusiness schema)', standard: 'Standard page' }[role] || role)],
    ['Author (byline, author box, Person schema)', au ? esc(au.name + (au.job_title ? ', ' + au.job_title : '')) + (au.url ? ' · ' + esc(au.url) : '') : '<span class="bad">No author on file — [placeholders] in the package; set up the business profile</span>'],
    ['Expert reviewer', rv ? esc(rv.name + (rv.job_title ? ', ' + rv.job_title : '')) : 'none'],
    ['Experience notes', (brief.experience_notes || []).length ? ul(brief.experience_notes) : 'none']];
  if (role === 'hub') extraRows.push(['Cluster pages linked', hp.length ? ul(hp.map(p => (p.keyword || p.url) + ' — ' + p.url + (p.planned ? ' (planned)' : ''))) : 'none found']);
  if (vid) extraRows.push(['Video', esc((vid.title || vid.url) + (vid.minutes ? ' · ' + vid.minutes + ' min' : '') + (vid.upload_date ? ' · uploaded ' + String(vid.upload_date).slice(0, 10) : '')) + ((vid.chapters || []).length ? ' · ' + vid.chapters.length + ' key moments' : '') + ' · transcript ' + (vid.transcript ? 'included' : '<span class="bad">missing</span>')]);
  if (d.case_study) extraRows.push(['Case study', esc((d.case_study.client_public === false ? 'anonymised client' : d.case_study.client_name) + ' · ' + (d.case_study.service || '') + (d.case_study.timeline ? ' · ' + d.case_study.timeline : ''))]);
  parts.push(h2('Author, Trust & Page Extras') + kv(extraRows) + ((qa.eeat_notes || []).length ? '<h3>Before publishing</h3>' + ul(qa.eeat_notes) : ''));
  const tc = (qa.term_coverage || []);
  if (tc.length) parts.push(h2('Topic Coverage vs Top-Ranking Pages') + '<p class="small">Terms the top pages share and how often this page uses them.</p><table class="ct"><tr><th>Term</th><th>Target</th><th>Found</th><th></th></tr>' + tc.slice(0, 30).map(t => '<tr><td>' + esc(t.term) + '</td><td>' + t.target + '</td><td>' + t.found + '</td><td>' + (t.ok ? '<span class="ok">ok</span>' : '<span class="bad">add</span>') + '</td></tr>').join('') + '</table>');
  const srcs = (qa.sources_cited || []);
  if (srcs.length) parts.push(h2('Sources Cited') + '<table class="ct"><tr><th>Anchor</th><th>URL</th></tr>' + srcs.map(s => '<tr><td>' + esc(s.anchor) + '</td><td>' + esc(s.url) + '</td></tr>').join('') + '</table>');
  const tv = (brief.title_variants || []), mv = (brief.meta_variants || []);
  if (tv.length || mv.length) parts.push(h2('Title & Meta Alternatives') + (tv.length ? '<h3>Titles</h3>' + ul(tv) : '') + (mv.length ? '<h3>Meta descriptions</h3>' + ul(mv) : ''));
  if (d.critique && ((d.critique.strengths || []).length || (d.critique.problems || []).length)) parts.push(h2('Editorial Review') + kv([['Score', (d.critique.score != null ? d.critique.score + '/100' : 'N/A') + ' — ' + esc(d.critique.verdict || '')]]) + ((d.critique.strengths || []).length ? '<h3>Strengths</h3>' + ul(d.critique.strengths) : '') + ((d.critique.problems || []).length ? '<h3>Issues raised (addressed by the editor)</h3>' + ul(d.critique.problems.slice(0, 8).map(p => '[' + p.severity + '] ' + p.issue)) : ''));
  if (schemaBlocks.length) {
    parts.push(h2('Structured Data (JSON-LD)', true) +
      '<p class="small">Paste each block in the page\'s &lt;head&gt; or before &lt;/body&gt;. Replace every [square-bracket] value first.</p>' +
      schemaBlocks.map(b => '<h3>' + esc(b.type) + '</h3>' + (b.note ? '<p class="small">' + esc(b.note) + '</p>' : '') +
        '<pre class="code">' + esc('<' + 'script type="application/ld+json">\n' + JSON.stringify(b.json, null, 2) + '\n<' + '/script>') + '</pre>').join(''));
  }
}

// ===== SITE AUDIT =====
if (wantAudit) {
  if (d.site_audit) {
    parts.push(h2('Site Audit', true) + '<pre class="code">' + esc(JSON.stringify(d.site_audit, null, 2)) + '</pre>');
  } else {
    parts.push(h2('Site Audit', true) + '<div class="note">The site audit for ' + esc(d.domain) + ' runs separately and is emailed as its own report when it finishes.</div>');
  }
}

const css = `
@page { margin: 0.9in; }
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; }
.cover { background: #0F172A; color: #fff; padding: 28px 30px; margin-bottom: 24px; }
.brand { font-size: 10pt; letter-spacing: 2px; text-transform: uppercase; color: #93C5FD; }
.title { font-size: 26pt; margin: 6px 0; color: #fff; border: none; }
.sub { color: #CBD5E1; margin: 0; }
.by { color: #93C5FD; margin: 10px 0 0; font-size: 10pt; }
h1 { color: #0F172A; font-size: 20pt; border-bottom: 3px solid #0F172A; padding-bottom: 6px; }
h2 { color: #1E3A8A; font-size: 15pt; margin-top: 26px; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px; }
h3 { color: #334155; font-size: 12.5pt; margin-top: 16px; }
h4 { color: #334155; font-size: 11.5pt; }
p { margin: 0 0 9px; }
a { color: #1D4ED8; }
.kv { width: 100%; border-collapse: collapse; margin: 10px 0 16px; }
.kv td { padding: 7px 10px; border: 1px solid #E2E8F0; font-size: 10pt; vertical-align: top; }
.kv .k { width: 190px; font-weight: bold; background: #EEF2FF; color: #0F172A; }
.ct { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
.ct th { background: #1E3A8A; color: #fff; padding: 7px; text-align: left; border: 1px solid #1E3A8A; }
.ct td { padding: 7px; border: 1px solid #CBD5E1; }
.callout { border-left: 4px solid #1E3A8A; background: #F1F5F9; padding: 10px 14px; margin: 12px 0; }
.note { border-left: 4px solid #D97706; background: #FFFBEB; padding: 10px 14px; margin: 12px 0; }
.ph { background: #FEF3C7; color: #92400E; }
.ok { color: #15803D; font-weight: bold; }
.bad { color: #B91C1C; font-weight: bold; }
.fq { font-weight: bold; color: #0F172A; margin-top: 12px; margin-bottom: 2px; }
.fa { margin-left: 14px; color: #334155; }
.small { font-size: 9pt; color: #64748B; }
.code { background: #0F172A; color: #E2E8F0; padding: 12px; font-family: Consolas, monospace; font-size: 8.5pt; white-space: pre-wrap; }
.pb { page-break-before: always; }`;

const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(d.keyword)} — ${esc(reportType)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>${css}</style></head>
<body>${parts.join('\n')}</body></html>`;

const prefix = wantSeo && wantContent ? 'seo-report-and-content'
  : wantSeo ? 'seo-report'
  : wantContent ? 'page-content'
  : wantAudit ? 'site-audit'
  : wantVerdict ? 'keyword-verdict'
  : 'report';
const safe = String(brief.slug || d.keyword || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fileName = prefix + '-' + safe + '-' + today + '.doc';

return [{
  json: {
    run_ledger,
    request_id: d.request_id || null,
    keyword: d.keyword,
    country: d.country,
    domain: d.domain || '',
    email: d.email || '',
    report_type: reportType,
    file_name: fileName,
    qa_passed: qa.passed,
    via_webhook: !!d.via_webhook,
    callback_url: d.callback_url || '',
    mode: d.mode,
    brand: d.brand || 'Dev SEO',
    existing_page: d.existing_page || null,
    qa_summary: qa.passed == null ? '' : (qa.passed ? 'Quality check passed' : 'Quality check: ' + (qa.warnings || []).length + ' item(s) to review'),
    verdict: d.verdict,
    verdict_score: d.verdict_score,
    verdict_reasons: d.verdict_reasons || [],
    verdict_risks: d.verdict_risks || [],
    recommended_page: d.recommended_page,
    secondary_keywords: d.secondary_keywords || [],
    keyword_data: d.keyword_data || null,
    ladder_id: d.ladder_id || '', ladder_rung: d.ladder_rung ?? null, ladder_head: d.ladder_head || '',
    publish_wordpress: !!d.publish_wordpress, wordpress_url: d.wordpress_url || '',
    page_markdown: md || undefined, content_brief_slug: brief.slug || '', schema_blocks: schemaBlocks, content_score: qa.content_score == null ? null : qa.content_score, language_name: d.language_name || 'English', language_code: d.language_code || 'en', content_images: Array.isArray(brief.image_suggestions) ? brief.image_suggestions : [],
    page_role: d.page_role || 'standard', article_like: d.article_like == null ? null : !!d.article_like, author: d.author || null, reviewer: d.reviewer || null, site_profile: d.site_profile || null, hub_pages: d.hub_pages || [], video: d.video || null, case_study: d.case_study || null, case_id: d.case_id || '', local_area: d.local_area || '', content_brief_video_placement: brief.video_placement || '', eeat_notes: qa.eeat_notes || [], page_type: d.page_type || ''
  },
  binary: {
    data: {
      data: Buffer.from('\ufeff' + html, 'utf8').toString('base64'),
      mimeType: 'application/msword',
      fileName: fileName,
      fileExtension: 'doc'
    }
  }
}];