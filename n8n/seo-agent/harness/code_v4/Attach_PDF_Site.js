// Attach the PDF (when the renderer succeeded) next to the HTML file, per site; a renderer failure never fails the run.
const src = $('Prepare PDF Site').all(); const got = $input.all();
return src.map((s, i) => { const g = got[i] || {}; const pdf = (g.binary && g.binary.pdf && !(g.json && g.json.error)) ? g.binary.pdf : null;
  const name = String(s.json.file_name || 'seo-performance.html').replace(/\.html?$/i, '') + '.pdf'; const binary = {};
  if (s.binary && s.binary.data) binary.data = s.binary.data; if (pdf) binary.pdf = { ...pdf, fileName: name, mimeType: 'application/pdf', fileExtension: 'pdf' };
  return { json: { ...s.json, pdf_ready: !!pdf, pdf_file_name: pdf ? name : null }, binary }; });