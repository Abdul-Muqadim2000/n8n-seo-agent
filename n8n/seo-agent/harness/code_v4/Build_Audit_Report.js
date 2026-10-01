
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
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const today = new Date().toISOString().slice(0, 10);

const SEV = ['Critical', 'High', 'Medium', 'Low', 'Info'];
const SEV_COLOR = { Critical: '#B91C1C', High: '#EA580C', Medium: '#CA8A04', Low: '#2563EB', Info: '#64748B' };
const scoreColor = (s) => s >= 90 ? '#15803D' : s >= 75 ? '#65A30D' : s >= 60 ? '#CA8A04' : '#B91C1C';

const bar = (s) => `<table class="bar"><tr>
  <td style="width:${s}%;background:${scoreColor(s)}">&nbsp;</td>
  <td style="width:${100 - s}%;background:#E2E8F0">&nbsp;</td></tr></table>`;

const counts = a.issue_counts || {};
const findings = a.findings || [];
const top = findings.filter(f => f.severity === 'Critical' || f.severity === 'High').slice(0, 6);

// ---------- Cover ----------
let html = `
<div class="cover">
  <div class="brand">Site Audit Report</div>
  <h1 class="title">${esc(a.domain)}</h1>
  <p class="sub">${esc(a.pages_crawled)} pages crawled &nbsp;•&nbsp; ${esc(a.crawl_date || today)}</p>
  <table class="scorebox"><tr>
    <td class="big" style="color:${scoreColor(a.health_score)}">${esc(a.health_score)}<span>/100</span></td>
    <td><div class="grade">${esc(a.grade)}</div><div class="lbl">Site Health Score (technical)</div></td>
  </tr></table>
  <p class="by">Prepared by ${esc(d.brand || 'Dev SEO')}</p>
</div>`;

// ---------- Contents ----------
html += `<h2>Contents</h2><ol class="toc">
<li>Executive Summary</li><li>Scores by Category</li><li>What Works Well</li>
<li>Issues Found</li><li>Action Plan</li><li>Not Assessed in This Audit</li><li>Methodology</li></ol>`;

// ---------- 1. Executive summary ----------
html += `<h2 class="pb">1. Executive Summary</h2>
<p>We crawled <b>${esc(a.pages_crawled)}</b> pages of <b>${esc(a.domain)}</b> and ran additional checks on security, caching, crawler access and the sitemap. We found:</p>
<table class="ct"><tr>${SEV.map(s => `<th style="background:${SEV_COLOR[s]}">${s}</th>`).join('')}</tr>
<tr>${SEV.map(s => `<td style="text-align:center;font-size:14pt"><b>${counts[s] || 0}</b></td>`).join('')}</tr></table>
${a.score_cap_reason ? `<div class="note"><b>Score limit applied:</b> ${esc(a.score_cap_reason)}. Calculated score before the limit: ${esc(a.raw_score)}/100.</div>` : ''}
${top.length ? '<h3>Fix These First</h3><ol>' + top.map(f => `<li><b>${esc(f.title)}</b>${f.evidence ? ' <span class="small">(' + esc(f.evidence) + ')</span>' : ''}<br>${esc(f.fix)}</li>`).join('') + '</ol>' : '<p>No critical or high-priority issues found.</p>'}`;

// ---------- Key measurements ----------
const ms = a.measurements || {};
const msRows = [
  ['Homepage server response', ms.homepage_ttfb_ms != null ? ms.homepage_ttfb_ms + ' ms' : 'N/A'],
  ['Cache-Control header', ms.cache_control || 'N/A'],
  ['CDN cache status', (ms.cache_status || []).join(' / ') || 'N/A'],
  ['URLs in sitemap', ms.sitemap_urls != null ? ms.sitemap_urls : 'N/A'],
  ['Pages found by crawling', ms.crawled_urls != null ? ms.crawled_urls : a.pages_crawled],
  ['Server', a.server || ms.server || 'N/A']
];
html += `<h3>Key Measurements</h3><table class="kv">` + msRows.map(r => `<tr><td class="k">${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('') + `</table>`;

// ---------- 2. Category scores ----------
html += `<h2>2. Scores by Category</h2><table class="ct"><tr><th>Category</th><th style="width:60px">Score</th><th style="width:60px">Weight</th><th style="width:45%"></th></tr>` +
  Object.entries(a.category_scores || {}).map(([cat, s]) =>
    `<tr><td>${esc(cat)}</td><td><b style="color:${scoreColor(s)}">${s}</b></td><td>${esc((a.weights || {})[cat])}%</td><td>${bar(s)}</td></tr>`).join('') +
  `</table>`;

// ---------- 3. What works ----------
html += `<h2>3. What Works Well</h2><ul class="good">` +
  (a.what_works || []).map(w => `<li>${esc(w)}</li>`).join('') + `</ul>`;

// ---------- 4. Findings ----------
html += `<h2 class="pb">4. Issues Found</h2>`;
for (const sev of SEV) {
  const list = findings.filter(f => f.severity === sev);
  if (!list.length) continue;
  html += `<h3 style="color:${SEV_COLOR[sev]}">${sev} Priority (${list.length})</h3>`;
  for (const f of list) {
    const scope = f.scope === 'site' ? 'Whole website'
      : `${f.affected_count} of ${a.pages_crawled} pages (${f.affected_pct}%)`;
    const urls = f.sample_urls || [];
    html += `<div class="finding" style="border-left-color:${SEV_COLOR[sev]}">
      <div class="ftitle"><span class="badge" style="background:${SEV_COLOR[sev]}">${sev}</span> ${esc(f.title)}</div>
      <div class="fmeta">${esc(f.category)} &nbsp;•&nbsp; ${esc(scope)}</div>
      ${f.evidence ? '<p><b>Evidence:</b> ' + esc(f.evidence) + '</p>' : ''}
      <p><b>Why it matters:</b> ${esc(f.why)}</p>
      <p><b>How to fix:</b> ${esc(f.fix)}</p>
      ${urls.length ? '<p class="small"><b>Affected pages:</b><br>' + urls.map(esc).join('<br>') + (f.affected_count > urls.length ? '<br>…and ' + (f.affected_count - urls.length) + ' more' : '') + '</p>' : ''}
    </div>`;
  }
}

// ---------- 5. Action plan ----------
const phase = (title, sevs, when) => {
  const list = findings.filter(f => sevs.includes(f.severity));
  if (!list.length) return '';
  return `<h3>${title} <span class="small">(${when})</span></h3><ul>` + list.map(f => `<li>${esc(f.title)}</li>`).join('') + `</ul>`;
};
html += `<h2 class="pb">5. Action Plan</h2>` +
  phase('Phase 1 — Urgent', ['Critical', 'High'], 'this week') +
  phase('Phase 2 — Important', ['Medium'], 'next 2-4 weeks') +
  phase('Phase 3 — Polish', ['Low', 'Info'], 'when time allows');

// ---------- 6. Not assessed ----------
html += `<h2>6. Not Assessed in This Audit</h2>
<p>This is a technical site audit. The following areas are part of the Full SEO Report and are not included in this score:</p>
<ul>` + (a.not_assessed || []).map(x => `<li>${esc(x)}</li>`).join('') + `</ul>`;

// ---------- 7. Methodology ----------
html += `<h2>7. Methodology</h2>
<p>${esc(a.scoring_method)}</p>
<table class="ct"><tr><th>Severity</th><th>Points deducted</th></tr>
<tr><td>Critical</td><td>30</td></tr><tr><td>High</td><td>15</td></tr><tr><td>Medium</td><td>7</td></tr><tr><td>Low</td><td>3</td></tr><tr><td>Info</td><td>1</td></tr></table>
<h3>Data Sources</h3>
<table class="ct"><tr><th>Source</th><th>Used for</th></tr>
<tr><td>Full site crawl (DataForSEO On-Page)</td><td>Page-level checks on up to ${esc(d.crawl_max_pages || 200)} pages, including sitemap URLs; duplicate tags, non-indexable pages and redirect chains reports</td></tr>
<tr><td>Direct HTTP checks</td><td>www/HTTPS, caching, security headers, robots.txt, sitemap, llms.txt</td></tr>
<tr><td>Crawler simulation</td><td>Access for 11 search and AI crawlers (user-agent based)</td></tr></table>
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
.toc li { margin-bottom: 4px; }
.ct { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }
.ct th { background: #1E3A8A; color: #fff; padding: 7px; text-align: left; }
.ct td { padding: 7px; border: 1px solid #CBD5E1; vertical-align: middle; }
.kv { width: 100%; border-collapse: collapse; margin: 10px 0 16px; }
.kv td { padding: 7px 10px; border: 1px solid #E2E8F0; font-size: 10pt; }
.kv .k { width: 220px; font-weight: bold; background: #EEF2FF; color: #0F172A; }
.bar { width: 100%; border-collapse: collapse; }
.bar td { height: 10px; padding: 0; border: none; font-size: 4pt; }
.good li { color: #15803D; }
.note { border-left: 4px solid #D97706; background: #FFFBEB; padding: 10px 14px; margin: 12px 0; }
.finding { border-left: 5px solid #CBD5E1; background: #F8FAFC; padding: 10px 14px; margin: 12px 0; }
.ftitle { font-weight: bold; font-size: 11.5pt; color: #0F172A; }
.badge { color: #fff; font-size: 8pt; padding: 2px 6px; font-weight: bold; }
.fmeta { font-size: 9pt; color: #64748B; margin: 3px 0 8px; }
.small { font-size: 9pt; color: #64748B; }
.pb { page-break-before: always; }`;

const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Site Audit — ${esc(a.domain)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>${css}</style></head><body>${html}</body></html>`;

const fileName = 'site-audit-' + String(a.domain).replace(/[^a-z0-9]+/gi, '-') + '-' + today + '.doc';

return [{
  json: {
    run_ledger,
    brand: d.brand || 'Dev SEO',
    report_title: 'Site Audit',
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