// W0-G (2026-10-29, page-quality PLAN Fix 7): the final version's documents go into the answer the app waits for. *Finalize Verdict*'s body
// is read as it was answered (this node only adds `files`); the PDF is listed only when the renderer returned one (its bytes read through
// the binary helper, since an HTTP node keeps them on disk, and checked to be a PDF), the Word file whenever the document was printed. A
// renderer that is down, slow or wrong never fails the final version: the answer says the PDF could not be made and the rest is unchanged.
const V = $('Finalize Verdict').first().json || {};
const body = { ...(V.body || {}) };
let D = null; try { D = $('Final Version Document').first().json || null; } catch (e) { D = null; }
const it = $input.first() || {};
const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');
let pdf = null, pdfMissing = '';
if (D && D.final_doc === true) {
  const got = !!(it.binary && it.binary.pdf) && !(it.json && it.json.error);
  if (got) {
    try {
      const buf = await this.helpers.getBinaryDataBuffer(0, 'pdf');
      if (buf && buf.length > 200 && buf.slice(0, 5).toString('latin1') === '%PDF-') pdf = buf.toString('base64');
      else pdfMissing = 'the PDF renderer did not return a PDF';
    } catch (e) { pdfMissing = 'the PDF could not be read'; }
  } else pdfMissing = 'the PDF renderer did not answer';
} else pdfMissing = 'there was no page to print';
const base = String((D && D.final_file_base) || 'page-final');
body.files = {
  pdf: pdf ? { data: pdf, fileName: base + '.pdf', mimeType: 'application/pdf' } : null,
  word: D && D.final_doc === true && D.final_word_html ? { data: b64('﻿' + D.final_word_html), fileName: base + '.doc', mimeType: 'application/msword' } : null,
  pdf_missing: pdf ? '' : pdfMissing
};
return [{ json: { ...V, body } }];
