// Callback payload per site for API callers: the backlink data, the PDF and the CSV / disavow files (bytes from n8n's binary store).
const items = $input.all(); const out = [];
const bytes = async (i, k, bin) => { try { const b = await this.helpers.getBinaryDataBuffer(i, k); return b && b.length ? b.toString('base64') : null; } catch (e) { return bin[k] && bin[k].data && String(bin[k].data).length > 20 ? bin[k].data : null; } };
for (let i = 0; i < items.length; i++) {
  const it = items[i]; const d = it.json || {}; const bin = it.binary || {}; const files = {};
  for (const k of ['pdf', 'prospects_csv', 'disavow_txt']) if (bin[k]) { const data = await bytes(i, k, bin); if (data) files[k] = { data, fileName: bin[k].fileName, mimeType: bin[k].mimeType }; }
  const { html, candidates, assets, ...rest } = d;
  out.push({ json: { ...rest, pdf: files.pdf || null, files } });
}
return out;
