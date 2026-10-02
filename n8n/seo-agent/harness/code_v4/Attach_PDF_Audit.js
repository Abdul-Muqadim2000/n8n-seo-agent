// Merge the PDF (when the renderer succeeded) with the original Word-compatible file. Never fails the run.
const src = $('Prepare PDF Audit').first();
const got = $input.first() || {};
const pdf = got.binary && got.binary.pdf && !(got.json && got.json.error) ? got.binary.pdf : null;
const name = String(src.json.file_name || 'report.doc').replace(/\.doc$/i, '') + '.pdf';
const binary = {};
if (src.binary && src.binary.data) binary.data = src.binary.data;
if (pdf) binary.pdf = { ...pdf, fileName: name, mimeType: 'application/pdf', fileExtension: 'pdf' };
let __fp = {}; try { __fp = $('Restore Audit Item').first().binary || {}; } catch (e) {}
if (__fp.fix_pack_zip) binary.fix_pack_zip = __fp.fix_pack_zip; else for (const k of Object.keys(__fp)) if (k.startsWith('fix_')) binary[k] = __fp[k];
return [{ json: { ...src.json, pdf_ready: !!pdf, pdf_file_name: pdf ? name : null, pdf_error: pdf ? null : String((got.json && got.json.error && (got.json.error.message || got.json.error)) || 'renderer returned no file').slice(0, 200) }, binary }];