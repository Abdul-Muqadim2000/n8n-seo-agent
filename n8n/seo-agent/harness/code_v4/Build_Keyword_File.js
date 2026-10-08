
// ---- run ledger: DataForSEO spend, AI calls, duration (internal; appears on the final item and in the API callback) ----
const __LEDGER_NODES = ['SERP Top 10', 'SERP Top 10 (Retry)', 'Facts SERP (Retry)', 'Keyword Data', 'Candidate SERP', 'Discover Ideas', 'Start Crawl', 'Get Crawl Summary', 'Get Crawled Pages', 'Run Crawl Extras', 'Find Competitors', 'Fallback SERP', 'Domain Overview', 'DataForSEO Whois', 'Ranked Keywords', 'Keyword Ideas', 'Backlink Summary', 'Backlink Gap', 'AI SERP', 'Ask LLMs', 'Facts SERP', 'Site Authority', 'Run Research', 'Run Competitor Keywords', 'AI Demand', 'Run Reach Requests'];
const __AI_NODES = ['Site Describer', 'Keyword Seeds', 'Competitor Analyzer', 'Verdict Agent', 'Strategy Brief', 'Copywriter', 'Editor', 'Content Reviewer', 'Keyword Relevance', 'Critic'];
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
const today = new Date().toISOString().slice(0, 10);

const extras = [d.include_seo_report ? 'keyword report' : '', d.include_content ? 'page content' : '', d.include_audit ? (d.include_full_report ? 'full SEO report' : 'site audit') : ''].filter(Boolean);
const topKw = ((d.keyword_suggestions || {}).recommended || [])[0];
const note = extras.length && d.email
  ? '<div style="font-family:Arial;max-width:860px;margin:0 auto 20px;padding:14px 18px;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46">Your ' + extras.join(', ') +
    ((d.include_seo_report || d.include_content) && topKw ? ' for the top keyword "' + String(topKw.keyword) + '"' : '') +
    ' will be emailed to ' + d.email + ' within about ' + (d.include_audit ? '20' : '5') + ' minutes.</div>'
  : '';

const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Keyword Ideas — ${String(d.domain || 'your business')}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>@page { margin: 0.8in; } body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }</style>
</head><body>${d.result_html || '<p>No keyword ideas were generated.</p>'}${note}</body></html>`;

const safe = String(d.domain || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fileName = 'keyword-ideas-' + safe + '-' + today + '.doc';

return [{
  json: { ...d, result_html: undefined, file_name: fileName, run_ledger },
  binary: {
    data: {
      data: Buffer.from('\ufeff' + doc, 'utf8').toString('base64'),
      mimeType: 'application/msword',
      fileName: fileName,
      fileExtension: 'doc'
    }
  }
}];