
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
const a = d.site_audit || {};
const cb = a.competitor_benchmark || d.competitor_benchmark || { rows: [] };
const sk = d.site_keywords || null;
const au = d.authority || null;
const ps = d.pagespeed || null;
const cr = d.content_review || null;
const av = d.ai_visibility || null;

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => (n == null || n === '' || isNaN(n)) ? 'N/A' : Number(n).toLocaleString('en-GB');
const ms = (n) => n == null ? 'N/A' : (n >= 1000 ? (n / 1000).toFixed(2) + 's' : Math.round(n) + 'ms');
const today = new Date().toISOString().slice(0, 10);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const SEV = ['Critical', 'High', 'Medium', 'Low', 'Info'];
const SEV_COLOR = { Critical: '#B91C1C', High: '#EA580C', Medium: '#CA8A04', Low: '#2563EB', Info: '#64748B' };
const scoreColor = (s) => s >= 90 ? '#15803D' : s >= 75 ? '#65A30D' : s >= 60 ? '#CA8A04' : '#B91C1C';
const bar = (s) => `<table class="bar"><tr><td style="width:${s}%;background:${scoreColor(s)}">&nbsp;</td><td style="width:${100 - s}%;background:#E2E8F0">&nbsp;</td></tr></table>`;
const yn = (v) => { const t = String(v || '').toLowerCase(); const c = t === 'yes' ? '#15803D' : t === 'no' ? '#B91C1C' : '#CA8A04'; return `<b style="color:${c}">${esc(v || 'unclear')}</b>`; };
const youTag = (r) => r.is_you ? '<b>' + esc(r.domain) + ' (you)</b>' : esc(r.domain);
const diffLabel = (v) => v == null ? 'N/A' : v + (v < 30 ? ' (easy)' : v < 50 ? ' (medium)' : v < 70 ? ' (hard)' : ' (very hard)');

const findings = a.findings || [];
const counts = a.issue_counts || {};
const byCat = (cat) => findings.filter(f => f.category === cat);

function card(f) {
  const scope = f.scope === 'site' ? 'Whole website' : `${f.affected_count} of ${a.pages_crawled} pages (${f.affected_pct}%)`;
  const urls = f.sample_urls || [];
  return `<div class="finding" style="border-left-color:${SEV_COLOR[f.severity]}">
    <div class="ftitle"><span class="badge" style="background:${SEV_COLOR[f.severity]}">${f.severity}</span> ${esc(f.title)}</div>
    <div class="fmeta">${esc(scope)}</div>
    ${f.evidence ? '<p><b>Evidence:</b> ' + esc(f.evidence) + '</p>' : ''}
    ${f.why ? '<p><b>Why it matters:</b> ' + esc(f.why) + '</p>' : ''}
    ${f.fix ? '<p><b>How to fix:</b> ' + esc(f.fix) + '</p>' : ''}
    ${urls.length ? '<p class="small"><b>Affected pages:</b><br>' + urls.map(esc).join('<br>') + (f.affected_count > urls.length ? '<br>…and ' + (f.affected_count - urls.length) + ' more' : '') + '</p>' : ''}
  </div>`;
}
const findingsBlock = (list) => list.length
  ? SEV.map(s => list.filter(f => f.severity === s).map(card).join('')).join('')
  : '<p class="okline">No issues found in this area.</p>';

// ---------- Merged benchmark ----------
const doms = (cb.rows || []).map(r => r.domain);
const get = (arr, dom) => (arr || []).find(x => x.domain === dom) || {};
const bench = doms.map(dom => {
  const c = get(cb.rows, dom);
  const k = get(sk && sk.domains, dom);
  const b = get(au && au.rows, dom);
  const p = get(ps && ps.rows, dom);
  return { domain: dom, is_you: c.is_you, keywords: k.total ?? c.organic_keywords, top10: k.top10 ?? c.top10, traffic: c.est_monthly_traffic, value: c.traffic_value_usd, age: c.domain_age_years, rd: b.referring_domains, dr: b.domain_rank, speed: p.score, lcp: p.field ? (p.field.lcp ?? (p.lab || {}).lcp) : null };
});
const you = bench.find(b => b.is_you) || {};

const catScores = a.category_scores || {};
const lowest = Object.entries(catScores).sort((x, y) => x[1] - y[1])[0] || ['', 0];
const binding = (cr && cr.binding_constraint) ? cr.binding_constraint : ('The weakest area is ' + lowest[0] + ' (' + lowest[1] + '/100).');

let html = '';

// ---------- Cover ----------
html += `<div class="cover">
  <div class="brand">Full SEO Report</div>
  <h1 class="title">${esc(a.domain)}</h1>
  <p class="sub">${esc(d.country || '')} &nbsp;•&nbsp; ${esc(a.pages_crawled)} pages crawled &nbsp;•&nbsp; ${esc(a.crawl_date || today)}</p>
  <table class="scorebox"><tr>
    <td class="big" style="color:${scoreColor(a.health_score)}">${esc(a.health_score)}<span>/100</span></td>
    <td><div class="grade">${esc(a.grade)}</div><div class="lbl">SEO Health Score</div></td>
  </tr></table>
  <p class="by">Prepared by ${esc(d.brand || 'Dev SEO')}</p>
</div>`;

// ---------- Contents ----------
const TOC = ['Executive Summary', 'Scorecard', 'Competitor Benchmark', 'Keywords by Search Intent', 'Authority & Backlinks', 'Content Quality & E-E-A-T', 'Performance & Core Web Vitals', 'AI Search Visibility', 'Structured Data (Schema)', 'Crawlability & Indexing', 'On-Page SEO', 'Images, Security & Technical', 'What Works Well', 'Action Plan', 'Leading Indicators', 'Methodology & Data Sources'];
html += '<h2>Contents</h2><ol class="toc">' + TOC.map(t => '<li>' + t + '</li>').join('') + '</ol>';

// ---------- 1. Executive summary ----------
const top = findings.filter(f => f.severity === 'Critical' || f.severity === 'High').slice(0, 7);
html += `<h2 class="pb">1. Executive Summary</h2>
${cr && cr.business_context ? '<p><b>About the site:</b> ' + esc(cr.business_context) + '</p>' : ''}
<div class="callout"><b>The main thing holding this site back:</b> ${esc(binding)}</div>
<table class="ct"><tr>${SEV.map(s => `<th style="background:${SEV_COLOR[s]}">${s}</th>`).join('')}</tr>
<tr>${SEV.map(s => `<td style="text-align:center;font-size:14pt"><b>${counts[s] || 0}</b></td>`).join('')}</tr></table>
${a.score_cap_reason ? `<div class="note"><b>Score limit applied:</b> ${esc(a.score_cap_reason)}. Calculated score before the limit: ${esc(a.raw_score)}/100.</div>` : ''}
<h3>Key Numbers: You vs Competitors</h3>
<table class="ct"><tr><th>Metric</th><th>You</th><th>Competitor median</th></tr>
<tr><td>Keywords ranking (top 30)</td><td>${num(you.keywords)}</td><td>${num(cb.medians && cb.medians.organic_keywords)}</td></tr>
<tr><td>Keywords in top 10</td><td>${num(you.top10)}</td><td>${num(cb.medians && cb.medians.top10)}</td></tr>
<tr><td>Estimated monthly organic visits</td><td>${num(you.traffic)}</td><td>${num(cb.medians && cb.medians.est_monthly_traffic)}</td></tr>
<tr><td>Referring domains</td><td>${num(you.rd)}</td><td>${num(au && au.medians && au.medians.referring_domains)}</td></tr>
<tr><td>Mobile PageSpeed</td><td>${num(you.speed)}</td><td>${num(ps && ps.medians && ps.medians.score)}</td></tr>
<tr><td>Domain age (years)</td><td>${num(you.age)}</td><td>${num(cb.medians && cb.medians.domain_age_years)}</td></tr></table>
${top.length ? '<h3>Fix These First</h3><ol>' + top.map(f => `<li><b>${esc(f.title)}</b>${f.evidence ? ' <span class="small">(' + esc(f.evidence) + ')</span>' : ''}<br>${esc(f.fix)}</li>`).join('') + '</ol>' : ''}`;

// ---------- 2. Scorecard ----------
html += `<h2>2. Scorecard</h2><table class="ct"><tr><th>Category</th><th style="width:60px">Score</th><th style="width:60px">Weight</th><th style="width:45%"></th></tr>` +
  Object.entries(catScores).map(([cat, s]) => `<tr><td>${esc(cat)}</td><td><b style="color:${scoreColor(s)}">${s}</b></td><td>${esc((a.weights || {})[cat])}%</td><td>${bar(s)}</td></tr>`).join('') + `</table>`;

// ---------- 3. Competitor benchmark ----------
html += `<h2 class="pb">3. Competitor Benchmark</h2>
<p class="small">Competitors: ${esc(cb.source || '')}. Country: ${esc(d.country || '')}.</p>
<table class="ct"><tr><th>Domain</th><th>Keywords</th><th>Top 10</th><th>Est. visits/mo</th><th>Traffic value $</th><th>Ref. domains</th><th>Domain rank</th><th>PageSpeed</th><th>Age (yrs)</th></tr>` +
  bench.map(b => `<tr${b.is_you ? ' class="you"' : ''}><td>${youTag(b)}</td><td>${num(b.keywords)}</td><td>${num(b.top10)}</td><td>${num(b.traffic)}</td><td>${num(b.value)}</td><td>${num(b.rd)}</td><td>${num(b.dr)}</td><td>${num(b.speed)}</td><td>${num(b.age)}</td></tr>`).join('') + `</table>`;

// ---------- 4. Keywords ----------
const INT = ['informational', 'navigational', 'commercial', 'transactional'];
const INT_DESC = {
  informational: 'People researching or learning (how, what, guide)',
  navigational: 'People looking for a specific brand or website',
  commercial: 'People comparing providers before deciding (best, services, company, vs)',
  transactional: 'People ready to act (price, cost, hire, buy, quote)'
};
const compCell = (list) => (list || []).length ? list.map(c => esc(c.domain) + ' #' + c.position).join('<br>') : '—';

html += `<h2 class="pb">4. Keywords by Search Intent</h2>`;
if (sk) {
  if ((sk.seeds || []).length) html += `<p class="small">Keyword research based on your services: ${esc(sk.seeds.join(', '))}</p>`;

  html += `<h3>Current Rankings per Intent (top 30): You vs Competitors</h3><table class="ct"><tr><th>Intent</th>` +
    sk.domains.map(x => `<th>${esc(x.domain)}${x.is_you ? ' (you)' : ''}</th>`).join('') + `</tr>` +
    INT.map(i => `<tr><td>${cap(i)}</td>` + sk.domains.map(x => `<td>${num(x.by_intent[i])}</td>`).join('') + `</tr>`).join('') + `</table>`;

  const hasOwn = INT.some(i => ((sk.your_top_by_intent || {})[i] || []).length);
  if (hasOwn) {
    INT.forEach(i => {
      const list = (sk.your_top_by_intent || {})[i] || [];
      if (!list.length) return;
      html += `<h3>Your Current ${cap(i)} Rankings</h3><table class="ct"><tr><th>Keyword</th><th>Position</th><th>Searches/mo</th><th>Difficulty</th></tr>` +
        list.map(k => `<tr><td>${esc(k.keyword)}</td><td>#${num(k.position)}</td><td>${num(k.volume)}</td><td>${diffLabel(k.difficulty)}</td></tr>`).join('') + `</table>`;
    });
  } else {
    html += `<div class="note">Your site does not rank in the top 30 for any keyword in ${esc(d.country || 'this market')} yet. The opportunities below show which searches to target, grouped by search intent.</div>`;
  }

  html += `<h2>4a. Keyword Opportunities by Search Intent</h2>`;
  INT.forEach(i => {
    const list = (sk.opportunities_by_intent || {})[i] || [];
    html += `<h3>${cap(i)} Keywords</h3><p class="small">${INT_DESC[i]}</p>` + (list.length
      ? `<table class="ct"><tr><th>Keyword</th><th>Searches/mo</th><th>Difficulty</th><th>CPC $</th><th>Your position</th><th>Competitors in top 10</th></tr>` +
        list.map(k => `<tr><td>${esc(k.keyword)}</td><td>${num(k.volume)}</td><td>${diffLabel(k.difficulty)}</td><td>${k.cpc == null ? 'N/A' : k.cpc}</td><td>${k.your_position ? '#' + k.your_position : '—'}</td><td class="small">${compCell(k.competitors)}</td></tr>`).join('') + `</table>`
      : '<p>No keywords with measurable search volume found for this intent.</p>');
  });

  if ((sk.easy_wins || []).length) {
    html += `<h3>Easy Wins (difficulty under 30)</h3><table class="ct"><tr><th>Keyword</th><th>Intent</th><th>Searches/mo</th><th>Difficulty</th><th>Competitors in top 10</th></tr>` +
      sk.easy_wins.map(k => `<tr><td>${esc(k.keyword)}</td><td>${cap(k.intent)}</td><td>${num(k.volume)}</td><td>${num(k.difficulty)}</td><td class="small">${compCell(k.competitors)}</td></tr>`).join('') + `</table>`;
  }

  html += `<h3>Keyword Gap: Competitors Rank, You Don't</h3>` + ((sk.keyword_gap || []).length
    ? `<table class="ct"><tr><th>Keyword</th><th>Searches/mo</th><th>Difficulty</th><th>Intent</th><th>Competitors ranking</th></tr>` + sk.keyword_gap.slice(0, 20).map(g => `<tr><td>${esc(g.keyword)}</td><td>${num(g.volume)}</td><td>${diffLabel(g.difficulty)}</td><td>${cap(g.intent)}</td><td class="small">${compCell(g.competitors)}</td></tr>`).join('') + `</table>`
    : '<p>No keyword gap found.</p>');

  if ((sk.striking_distance || []).length) {
    html += `<h3>Quick Wins: Keywords on Page 2</h3><table class="ct"><tr><th>Keyword</th><th>Position</th><th>Searches/mo</th><th>Ranking page</th></tr>` +
      sk.striking_distance.map(k => `<tr><td>${esc(k.keyword)}</td><td>#${k.position}</td><td>${num(k.volume)}</td><td class="small">${esc(k.url)}</td></tr>`).join('') + `</table>`;
  }
} else html += '<p>Keyword data was not collected in this run.</p>';

// ---------- 5. Authority & backlinks ----------
html += `<h2 class="pb">5. Authority & Backlinks</h2>`;
if (au && au.available) {
  html += `<table class="ct"><tr><th>Domain</th><th>Domain rank</th><th>Backlinks</th><th>Referring domains</th><th>Followed %</th><th>Spam score</th></tr>` +
    au.rows.map(r => `<tr${r.is_you ? ' class="you"' : ''}><td>${youTag(r)}</td><td>${num(r.domain_rank)}</td><td>${num(r.backlinks)}</td><td>${num(r.referring_domains)}</td><td>${r.dofollow_pct == null ? 'N/A' : r.dofollow_pct + '%'}</td><td>${num(r.spam_score)}</td></tr>`).join('') + `</table>`;
  if ((au.gap || []).length) html += `<h3>Link Opportunities (link to competitors, not to you)</h3><table class="ct"><tr><th>Website</th><th>Links to # competitors</th></tr>` +
    au.gap.slice(0, 20).map(g => `<tr><td>${esc(g.referring_domain)}</td><td>${num(g.links_to_competitors)}</td></tr>`).join('') + `</table>`;
} else html += '<div class="note">Backlink data was not available for this run (DataForSEO Backlinks API not active).</div>';
html += '<h3>Findings</h3>' + findingsBlock(byCat('Authority'));

// ---------- 6. Content & E-E-A-T ----------
html += `<h2 class="pb">6. Content Quality & E-E-A-T</h2>`;
if (cr) {
  const sig = cr.eeat_signals || {};
  html += `<h3>Trust Signals on Your Site</h3><table class="kv">` + Object.entries(sig).map(([k, v]) => `<tr><td class="k">${esc(k.replace(/_/g, ' '))}</td><td>${yn(v)}</td></tr>`).join('') + `</table>`;
  if ((cr.competitor_comparison || []).length) html += `<h3>Competitors' Trust Signals</h3><table class="ct"><tr><th>Competitor</th><th>Authors</th><th>Case studies</th><th>Testimonials</th><th>Pricing</th><th>Depth</th><th>Note</th></tr>` +
    cr.competitor_comparison.map(c => `<tr><td>${esc(c.domain)}</td><td>${yn(c.named_authors)}</td><td>${yn(c.case_studies)}</td><td>${yn(c.testimonials)}</td><td>${yn(c.pricing)}</td><td>${esc(c.content_depth)}</td><td class="small">${esc(c.standout)}</td></tr>`).join('') + `</table>`;
}
html += '<h3>Findings</h3>' + findingsBlock(byCat('Content'));

// ---------- 7. Performance ----------
html += `<h2 class="pb">7. Performance & Core Web Vitals</h2>`;
if (ps) {
  html += `<table class="ct"><tr><th>Domain</th><th>Mobile score</th><th>LCP</th><th>CLS</th><th>INP (real users)</th><th>TBT</th><th>Server response</th></tr>` +
    ps.rows.map(r => `<tr${r.is_you ? ' class="you"' : ''}><td>${youTag(r)}</td><td>${num(r.score)}</td><td>${ms(r.field.lcp ?? r.lab.lcp)}</td><td>${(r.field.cls ?? r.lab.cls) == null ? 'N/A' : Number(r.field.cls ?? r.lab.cls).toFixed(2)}</td><td>${ms(r.field.inp)}</td><td>${ms(r.lab.tbt)}</td><td>${ms(r.lab.ttfb)}</td></tr>`).join('') + `</table>`;
  const yps = ps.rows.find(r => r.is_you) || {};
  if ((yps.opportunities || []).length) html += '<h3>Biggest Speed Savings (your homepage)</h3><ul>' + yps.opportunities.map(o => `<li>${esc(o.title)} — about ${num(o.savings_ms)}ms</li>`).join('') + '</ul>';
}
html += '<h3>Findings</h3>' + findingsBlock(byCat('Performance'));

// ---------- 8. AI visibility ----------
html += `<h2 class="pb">8. AI Search Visibility</h2>`;
if (av) {
  const llm = av.llm_answers || [];
  const pname = (p) => p === 'chat_gpt' ? 'ChatGPT (web search on)' : p === 'perplexity' ? 'Perplexity' : esc(p);
  if (llm.length) {
    html += `<h3>What AI Assistants Say (live answers)</h3><table class="ct"><tr><th>Assistant</th><th>Question</th><th>Mentions you</th><th>Providers named</th><th>Sources cited</th></tr>` +
      llm.map(x => `<tr><td>${pname(x.platform)}</td><td class="small">${esc(x.prompt)}</td><td>${x.ok ? (x.mentions_you ? '<b style="color:#15803D">Yes</b>' : '<b style="color:#B91C1C">No</b>') : 'No data (' + esc(x.error || 'API unavailable') + ')'}</td><td class="small">${esc((x.domains_mentioned || []).slice(0, 8).join(', ') || '—')}</td><td class="small">${esc((x.cited_sources || []).slice(0, 6).join(', ') || '—')}</td></tr>`).join('') + `</table>`;
    llm.filter(x => x.ok && x.answer).slice(0, 3).forEach(x => { html += `<div class="callout"><b>${pname(x.platform)} — ${esc(x.kind === 'who' ? 'about the company' : 'recommendation')}:</b><br>${esc(x.answer.slice(0, 700))}${x.answer.length > 700 ? '…' : ''}</div>`; });
  }
  if (av.index_estimate != null) html += `<p><b>Google index estimate (site: search):</b> ${num(av.index_estimate)} URLs vs ${num(a.pages_crawled)} pages crawled. Confirm the exact figure in Search Console.</p>`;
  html += `<h3>Google Results & AI Overviews</h3><table class="ct"><tr><th>Search</th><th>AI Overview</th><th>You cited</th><th>Competitors cited</th><th>Your position</th><th>Competitor positions</th></tr>` +
    (av.queries || []).map(q => `<tr><td>${esc(q.query)} <span class="small">(${esc(q.type)})</span></td><td>${q.ai_overview ? 'Yes' : 'No'}</td><td>${q.you_cited ? '<b style="color:#15803D">Yes</b>' : 'No'}</td><td>${esc(q.competitors_cited.join(', ') || '—')}</td><td>${q.your_position ? '#' + q.your_position : 'Not in top 20'}</td><td class="small">${Object.entries(q.competitor_positions || {}).map(([k, v]) => esc(k) + ': ' + (v ? '#' + v : '—')).join('<br>') || '—'}</td></tr>`).join('') + `</table>`;
  html += '<p class="small">' + esc(av.note || '') + '</p>';
}
html += '<h3>Findings</h3>' + findingsBlock(byCat('AI Search Readiness'));

// ---------- 9-12. Other categories ----------
const section = (no, title, cats) => `<h2 class="pb">${no}. ${title}</h2>` + cats.map(c =>
  (cats.length > 1 ? `<h3>${esc(c)} — ${num(catScores[c])}/100</h3>` : `<p><b>Score:</b> ${num(catScores[c])}/100</p>`) + findingsBlock(byCat(c))).join('');
html += section(9, 'Structured Data (Schema)', ['Schema']);
const sp = (a.sampled_pages || []).filter(p => p && p.url);
if (sp.length) html += `<h3>Schema Found on Sampled Pages</h3><table class="ct"><tr><th>Page</th><th>Type</th><th>Schema types</th></tr>` + sp.map(p => `<tr><td class="small">${esc(p.url)}</td><td>${esc(p.kind)}</td><td>${esc((p.schema_types || []).join(', ') || 'none')}</td></tr>`).join('') + `</table>`;
html += section(10, 'Crawlability & Indexing', ['Crawlability & Indexing']);
html += section(11, 'On-Page SEO', ['On-Page']);
html += section(12, 'Images, Security & Technical', ['Images', 'Security', 'Technical']);

// ---------- 13. What works ----------
html += `<h2 class="pb">13. What Works Well</h2><ul class="good">` + (a.what_works || []).map(w => `<li>${esc(w)}</li>`).join('') + `</ul>`;

// ---------- 14. Action plan ----------
const tech = ['Security', 'Crawlability & Indexing', 'Performance', 'Technical', 'Schema'];
const onsite = ['Content', 'On-Page', 'Images', 'Schema'];
const offsite = ['Authority', 'AI Search Readiness'];
const phase = (title, when, list) => list.length ? `<h3>${title} <span class="small">(${when})</span></h3><ul>` + list.map(f => `<li>${esc(f.title)} <span class="small">[${f.severity}]</span></li>`).join('') + '</ul>' : '';
const p1 = findings.filter(f => ['Critical', 'High'].includes(f.severity) && tech.includes(f.category));
const p2 = findings.filter(f => ['Critical', 'High', 'Medium'].includes(f.severity) && onsite.includes(f.category) && !p1.includes(f));
const p3 = findings.filter(f => offsite.includes(f.category) && f.severity !== 'Info');
const p4 = findings.filter(f => !p1.includes(f) && !p2.includes(f) && !p3.includes(f) && f.severity !== 'Info');
html += `<h2 class="pb">14. Action Plan</h2>` +
  phase('Phase 1 — Fix the foundations', 'Week 1', p1) +
  phase('Phase 2 — Content and on-page', 'Weeks 2-5', p2) +
  phase('Phase 3 — Authority, keywords and AI visibility (run in parallel)', 'Weeks 2-12', p3) +
  phase('Phase 4 — Polish', 'Months 2-3', p4);

// ---------- 15. Leading indicators ----------
const li = [];
li.push('SEO Health Score on the next audit (now ' + a.health_score + '/100)');
if (findings.some(f => /cache/i.test(f.title))) li.push('Homepage CDN cache status shows HIT and server response under 200ms');
li.push('Keywords in Google top 10 (now ' + num(you.top10) + ', competitor median ' + num(cb.medians && cb.medians.top10) + ')');
if (sk && (sk.easy_wins || []).length) li.push('Rankings for the easy-win keywords listed in section 4');
if (au && au.available) li.push('Referring domains (now ' + num(you.rd) + ', competitor median ' + num(au.medians && au.medians.referring_domains) + ')');
if (ps) li.push('Mobile PageSpeed score (now ' + num(you.speed) + ')');
if (av) li.push('Whether ChatGPT and Perplexity name you for category queries, and whether Google AI Overviews cite you');
li.push('Position for your brand name in Google');
html += `<h2>15. Leading Indicators to Track</h2><ul>` + li.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';

// ---------- 16. Methodology ----------
html += `<h2 class="pb">16. Methodology & Data Sources</h2><p>${esc(a.scoring_method)}</p>
<table class="ct"><tr><th>Severity</th><th>Points deducted</th></tr><tr><td>Critical</td><td>30</td></tr><tr><td>High</td><td>15</td></tr><tr><td>Medium</td><td>7</td></tr><tr><td>Low</td><td>3</td></tr><tr><td>Info</td><td>1</td></tr></table>
<table class="ct"><tr><th>Source</th><th>Used for</th></tr>
<tr><td>DataForSEO On-Page crawl</td><td>Page-level technical and on-page checks (up to ${num(d.crawl_max_pages || 200)} pages incl. sitemap)</td></tr>
<tr><td>Direct HTTP and HTML checks</td><td>www/HTTPS, caching, headers, robots.txt, sitemap, llms.txt, schema, forms, images</td></tr>
<tr><td>DataForSEO Labs</td><td>Competitors, rankings, traffic estimates, keyword ideas by intent, keyword gap</td></tr>
<tr><td>DataForSEO Backlinks</td><td>Backlinks, referring domains, link gap</td></tr>
<tr><td>Google PageSpeed Insights</td><td>Lighthouse lab data and real-user Core Web Vitals (mobile)</td></tr>
<tr><td>Google search results (live)</td><td>Brand and category rankings, AI Overview citations, competitor discovery</td></tr>
<tr><td>AI content review (Claude)</td><td>Content quality and E-E-A-T review of sampled pages (listed, not scored)</td></tr>
<tr><td>DataForSEO LLM Responses</td><td>Live ChatGPT (web search) and Perplexity answers about the brand and category</td></tr>
<tr><td>DataForSEO On-Page reports</td><td>Duplicate titles/descriptions, non-indexable pages, redirect chains</td></tr>
<tr><td>Domain registry data</td><td>Domain registration date</td></tr></table>
${(a.not_assessed || []).length ? '<h3>Not Assessed in This Run</h3><ul>' + a.not_assessed.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : ''}
${(a.notes || []).map(n => '<p class="small">' + esc(n) + '</p>').join('')}`;

const css = `
@page { margin: 0.8in; }
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; }
.cover { background: #0F172A; color: #fff; padding: 28px 30px; margin-bottom: 24px; }
.brand { font-size: 10pt; letter-spacing: 2px; text-transform: uppercase; color: #93C5FD; }
.title { font-size: 28pt; margin: 6px 0; color: #fff; }
.sub { color: #CBD5E1; margin: 0 0 14px; }
.scorebox td { vertical-align: middle; padding-right: 18px; color: #fff; }
.big { font-size: 44pt; font-weight: bold; }
.big span { font-size: 14pt; color: #CBD5E1; }
.grade { font-size: 16pt; font-weight: bold; color: #fff; }
.lbl { color: #93C5FD; font-size: 10pt; }
.by { color: #93C5FD; margin: 14px 0 0; font-size: 10pt; }
h2 { color: #1E3A8A; font-size: 15pt; margin-top: 26px; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px; }
h3 { color: #334155; font-size: 12.5pt; margin-top: 16px; }
p { margin: 0 0 8px; }
.toc li { margin-bottom: 3px; }
.ct { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9.5pt; }
.ct th { background: #1E3A8A; color: #fff; padding: 6px; text-align: left; }
.ct td { padding: 6px; border: 1px solid #CBD5E1; vertical-align: top; }
.ct tr.you td { background: #EEF2FF; }
.kv { width: 100%; border-collapse: collapse; margin: 10px 0 16px; }
.kv td { padding: 6px 10px; border: 1px solid #E2E8F0; font-size: 10pt; }
.kv .k { width: 240px; font-weight: bold; background: #EEF2FF; color: #0F172A; text-transform: capitalize; }
.bar { width: 100%; border-collapse: collapse; }
.bar td { height: 10px; padding: 0; border: none; font-size: 4pt; }
.good li { color: #15803D; }
.okline { color: #15803D; }
.callout { border-left: 4px solid #1E3A8A; background: #F1F5F9; padding: 10px 14px; margin: 12px 0; }
.note { border-left: 4px solid #D97706; background: #FFFBEB; padding: 10px 14px; margin: 12px 0; }
.finding { border-left: 5px solid #CBD5E1; background: #F8FAFC; padding: 10px 14px; margin: 12px 0; }
.ftitle { font-weight: bold; font-size: 11.5pt; color: #0F172A; }
.badge { color: #fff; font-size: 8pt; padding: 2px 6px; font-weight: bold; }
.fmeta { font-size: 9pt; color: #64748B; margin: 3px 0 8px; }
.small { font-size: 9pt; color: #64748B; }
.pb { page-break-before: always; }`;

const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Full SEO Report — ${esc(a.domain)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>${css}</style></head><body>${html}</body></html>`;

const fileName = 'full-seo-report-' + String(a.domain).replace(/[^a-z0-9]+/gi, '-') + '-' + today + '.doc';

return [{
  json: {
    run_ledger,
    brand: d.brand || 'Dev SEO',
    report_title: 'Full SEO Report',
    domain: a.domain,
    email: d.email,
    request_id: d.request_id || null,
    callback_url: d.callback_url || '',
    via_webhook: !!d.via_webhook,
    health_score: a.health_score,
    grade: a.grade,
    issue_counts: counts,
    top_issues: top.map(f => f.title),
    file_name: fileName
  },
  binary: {
    data: {
      data: Buffer.from('\ufeff' + doc, 'utf8').toString('base64'),
      mimeType: 'application/msword',
      fileName: fileName,
      fileExtension: 'doc'
    }
  }
}];