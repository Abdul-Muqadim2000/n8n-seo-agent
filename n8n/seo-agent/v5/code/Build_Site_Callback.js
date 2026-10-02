// Callback payload per site for API callers: the report data plus the PDF (bytes read from n8n's binary store); heavy internals dropped.
const items = $input.all(); const out = [];
for (let i = 0; i < items.length; i++) {
  const it = items[i]; const d = it.json || {}; const bin = it.binary || {};
  let pdf = null;
  if (bin.pdf) { try { const buf = await this.helpers.getBinaryDataBuffer(i, 'pdf'); if (buf && buf.length) pdf = { data: buf.toString('base64'), fileName: bin.pdf.fileName || d.pdf_file_name, mimeType: 'application/pdf' }; } catch (e) { if (bin.pdf.data && String(bin.pdf.data).length > 100) pdf = { data: bin.pdf.data, fileName: bin.pdf.fileName || d.pdf_file_name, mimeType: 'application/pdf' }; } }
  const { html, metrics_row, query_rows, site_row, form_url, api_url, service_account_email, ...rest } = d;
  out.push({ json: { ...rest, pdf } });
}
return out;
