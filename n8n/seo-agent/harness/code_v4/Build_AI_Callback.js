// Callback payload per site for API callers: the AI-visibility data plus the PDF (bytes from n8n's binary store); internals (rows to store, the daily
// samples, learned brand names, planning lists) dropped.
const items = $input.all(); const out = [];
for (let i = 0; i < items.length; i++) {
  const it = items[i]; const d = it.json || {}; const bin = it.binary || {}; let pdf = null;
  if (bin.pdf) { try { const buf = await this.helpers.getBinaryDataBuffer(i, 'pdf'); if (buf && buf.length) pdf = { data: buf.toString('base64'), fileName: bin.pdf.fileName || d.pdf_file_name, mimeType: 'application/pdf' }; } catch (e) { if (bin.pdf.data && String(bin.pdf.data).length > 100) pdf = { data: bin.pdf.data, fileName: bin.pdf.fileName || d.pdf_file_name, mimeType: 'application/pdf' }; } }
  const { html, vis_row, prospect_rows, cache_rows, pulse_rows, aliases, gsc_questions, volume_keywords, key_paths, form_url, api_url, previous, prompts, ...rest } = d;
  out.push({ json: { ...rest, pdf } });
}
return out;
