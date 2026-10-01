// Merge the PDF (when the renderer succeeded) with the original Word-compatible file. Never fails the run.
const src = $('Prepare PDF Report').first();
const got = $input.first() || {};
const pdf = got.binary && got.binary.pdf && !(got.json && got.json.error) ? got.binary.pdf : null;
const name = String(src.json.file_name || 'report.doc').replace(/\.doc$/i, '') + '.pdf';
const binary = {};
if (src.binary && src.binary.data) binary.data = src.binary.data;
if (pdf) binary.pdf = { ...pdf, fileName: name, mimeType: 'application/pdf', fileExtension: 'pdf' };
return [{ json: { ...src.json, pdf_ready: !!pdf, pdf_file_name: pdf ? name : null, pdf_error: pdf ? null : String((got.json && got.json.error && (got.json.error.message || got.json.error)) || 'renderer returned no file').slice(0, 200) }, binary }];