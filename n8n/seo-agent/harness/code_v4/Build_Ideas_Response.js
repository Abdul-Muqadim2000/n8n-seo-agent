// API delivery for "suggest keywords": the keyword strategy (JSON + PDF + Word) goes to the callback.
// If content or an audit was also requested, those arrive later as separate callbacks (stage: content / site_audit).
const item = $input.first(); const d = item.json; const ks = d.keyword_strategy || {}; const bin = item.binary || {};
const b64 = async (prop, b) => { try { const buf = await this.helpers.getBinaryDataBuffer(0, prop); if (buf && buf.length) return buf.toString('base64'); } catch (e) {} return (b && b.data && String(b.data).length > 100) ? b.data : null; };
const pick = (k) => ({ keyword: k.keyword, volume: k.volume, kd: k.kd, cpc: k.cpc, intent: k.intent, page_type: k.page_type, topic: k.topic, traffic_potential: k.traffic_potential, opportunity: k.opportunity, ai_search_volume: k.ai_search_volume ?? null, serp_features: k.serp_types || [], why: k.why || null, live: k.live || null });
const pdfData = bin.pdf ? await b64('pdf', bin.pdf) : null;
const docData = bin.data ? await b64('data', bin.data) : null;
return [{ json: {
  status: 'completed', stage: 'keyword_strategy', request_id: d.request_id || null, execution_id: $execution.id, domain: d.domain || null, country: d.country, goal: ks.goal || d.goal,
  summary: { keywords_researched: ks.pool_size, ai_reviewed: ks.ai_reviewed, relevant: ks.total_relevant, clusters: (ks.clusters || []).length, competitors: ks.competitor_domains || [] },
  start_with: ks.pipeline_keyword ? pick(ks.pipeline_keyword) : null,
  priority: (ks.priority || []).map(pick),
  content_plan: (ks.clusters || []).slice(0, 20).map(c => ({ tier: c.tier, topic: c.topic, primary_keyword: c.primary_keyword, page_type: c.page_type, keyword_count: c.keyword_count, total_volume: c.total_volume, supporting: c.supporting })),
  quick_wins: (ks.quick_wins || []).map(pick), questions: (ks.questions || []).map(k => k.keyword), competitor_gaps: (ks.competitor_gaps || []).slice(0, 15).map(pick),
  ai_demand: ks.ai_demand || null, research_failures: ks.research_failures || [],
  follow_ups: { content: !!(d.include_content || d.include_seo_report), audit: !!d.include_audit },
  run_ledger: d.run_ledger || null,
  pdf: pdfData ? { data: pdfData, fileName: bin.pdf.fileName || d.pdf_file_name, mimeType: 'application/pdf' } : null,
  file: docData ? { data: docData, fileName: bin.data.fileName || d.file_name, mimeType: 'application/msword' } : null,
  callback_url: d.callback_url || ''
} }];
