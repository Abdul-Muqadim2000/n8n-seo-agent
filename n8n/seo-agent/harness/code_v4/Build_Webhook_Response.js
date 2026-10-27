const item = $input.first();
const d = item.json;
const bin = item.binary && item.binary.data ? item.binary.data : null;
const pdfBin = item.binary && item.binary.pdf ? item.binary.pdf : null;
// Binary content: code-created binaries carry base64 in .data; binaries written by HTTP nodes are stored on disk and .data
// is only a reference, so read the bytes through the helper and fall back to .data when it already looks like base64.
const b64 = async (prop, b) => { try { const buf = await this.helpers.getBinaryDataBuffer(0, prop); if (buf && buf.length) return buf.toString('base64'); } catch (e) {} return (b && b.data && String(b.data).length > 100) ? b.data : null; };
const docData = bin ? await b64('data', bin) : null;
// G30 (2026-10-13): the produced images (WebP cards built from this page) travel in the callback like the PDF; the app stores every
// embedded file of a callback and offers it for download next to the article.
const imgPlan = ((d.article_meta || {}).images) || [];
const images = [];
for (const k of Object.keys(item.binary || {}).filter(x => /^image_\d+$/.test(x)).sort()) {
  const b = item.binary[k]; const data = await b64(k, b);
  const plan = imgPlan.find(p => p && p.binary_key === k) || {};
  if (data) images.push({ data, fileName: b.fileName || (k + '.webp'), mimeType: b.mimeType || 'image/webp',
    alt_text: plan.alt_text || '', caption: plan.caption || '', width: plan.width ?? null, height: plan.height ?? null, purpose: plan.purpose || '' });
}
const pdfData = pdfBin ? await b64('pdf', pdfBin) : null;

return [{
  json: {
    status: 'completed',
    stage: 'content',
    ladder_id: d.ladder_id || null,
    ladder_rung: d.ladder_rung ?? null,
    ladder_head: d.ladder_head || null,
    request_id: d.request_id || null,
    execution_id: $execution.id,
    verdict: d.verdict,
    score: d.verdict_score,
    score_withheld: !!d.score_withheld,
    evidence: d.verdict_evidence || null,
    reasons: d.verdict_reasons || [],
    risks: d.verdict_risks || [],
    recommended_page: d.recommended_page,
    secondary_keywords: d.secondary_keywords || [],
    keyword_data: d.keyword_data || null,
    existing_page: d.existing_page || null,
    qa_summary: d.qa_summary || null,
    // R11 (2026-10-13): the app shows the last quality round's verdict, not a count of warnings
    qa_publishable: d.qa_publishable == null ? null : !!d.qa_publishable,
    qa_not_ready: !!d.qa_not_ready, qa_label: d.qa_label || null, qa_reasons: d.qa_reasons || [], qa_quality: d.qa_quality || null,
    qa_next_step: d.qa_next_step || null, qa_owner_edits: d.qa_owner_edits || [],
    qa_delivery_status: d.qa_delivery_status || null, qa_client_questions: d.qa_client_questions || [], qa_grade: d.qa_grade || null,   // H1 (2026-10-27): for the app's approval and questions (H3)
    qa_blocking: d.qa_blocking || [], qa_advisory: d.qa_advisory || [],   // 2026-10-21: what to edit by hand (the app's Needs-you can say it instead of "run it again")
    run_ledger: d.run_ledger || null,
    dfs_tasks: (d.run_ledger || {}).dataforseo_tasks ?? null,
    markdown: d.article_markdown || d.page_markdown || null,
    html: d.article_html || null,
    meta: d.article_meta || null,
    images: images.length ? images : null,
    emailed_to: d.email || null,
    callback_url: d.callback_url || '',
    keyword: d.keyword,
    domain: d.domain,
    country: d.country,
    pdf: pdfData ? { data: pdfData, fileName: pdfBin.fileName || d.pdf_file_name, mimeType: 'application/pdf' } : null,
    file: docData ? {
      data: docData,
      fileName: bin.fileName || d.file_name,
      mimeType: bin.mimeType || 'application/msword'
    } : null
  }
}];