// Callback payload per site (stage link_builder): the summary plus the full week as a PDF (L3; bytes from n8n's binary store, as the AI and
// backlink callbacks do). The rows stay in n8n — the app reads them from the Data Tables. The report HTML and the document's internals are
// dropped: the PDF carries them.
const items = $input.all(); const out = [];
for (let i = 0; i < items.length; i++) {
  const it = items[i]; const d = it.json || {}; const bin = it.binary || {}; let pdf = null;
  if (bin.pdf) {
    try { const buf = await this.helpers.getBinaryDataBuffer(i, 'pdf'); if (buf && buf.length) pdf = { data: buf.toString('base64'), fileName: bin.pdf.fileName || d.pdf_file_name, mimeType: 'application/pdf' }; }
    catch (e) { if (bin.pdf.data && String(bin.pdf.data).length > 100) pdf = { data: bin.pdf.data, fileName: bin.pdf.fileName || d.pdf_file_name, mimeType: 'application/pdf' }; }
  }
  const { html, doc_title, ...rest } = d;
  out.push({ json: { ...rest, pdf, files: pdf ? { pdf } : {} } });
}
return out;
